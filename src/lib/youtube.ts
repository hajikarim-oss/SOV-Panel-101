import { getDb } from './db'
import { decryptApiKey } from './crypto'

// ── Types ─────────────────────────────────────────────────────────
export interface YouTubeVideo {
  youtube_id: string
  title: string
  description: string
  channel_name: string
  channel_id: string
  view_count: number
  published_at: string
  thumbnail_url: string
  duration: string
  duration_sec: number
  tags: string[]
}

export interface SearchHit {
  position: number
  youtube_id: string
  title: string
  channel_name: string
  channel_id: string
  published_at: string
  thumbnail_url: string
}

export interface SearchResult {
  hits: SearchHit[]
  quota_cost: number
}

// Parse ISO 8601 duration (e.g. PT5M12S or PT1H2M3S) to total seconds
export function parseDurationSec(duration: string | null): number {
  if (!duration) return 0
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0', 10)
  const m = parseInt(match[2] ?? '0', 10)
  const s = parseInt(match[3] ?? '0', 10)
  return h * 3600 + m * 60 + s
}

export function isShortForm(durationSec: number): boolean {
  // YouTube Shorts are officially <= 60 seconds.
  // Videos with durationSec=0 are unknown (detail fetch failed) — do NOT classify as either format.
  return durationSec > 0 && durationSec <= 60
}

// ── Key Rotation — atomic select + reserve ──────────────────────────
export function getNextAvailableKey(minUnits = 100): { api_key: string; key_id: string } | null {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  // Reset expired keys first
  db.prepare(`
    UPDATE api_keys SET units_used = 0, reset_date = ?
    WHERE reset_date < ? AND is_active = 1
  `).run(today, today)

  // Atomic: select the least-used key AND reserve capacity in one statement
  const key = db.prepare(`
    UPDATE api_keys
    SET units_used = units_used + ?, last_used_at = datetime('now')
    WHERE id = (
      SELECT id FROM api_keys
      WHERE is_active = 1 AND (units_used + ?) <= units_limit
      ORDER BY units_used ASC
      LIMIT 1
    )
    RETURNING id, api_key
  `).get(minUnits, minUnits) as { id: string; api_key: string } | undefined

  if (!key) return null

  let decryptedKey: string
  try {
    decryptedKey = decryptApiKey(key.api_key)
  } catch {
    decryptedKey = key.api_key
  }

  return { api_key: decryptedKey, key_id: key.id }
}

function refundQuota(key_id: string, units: number) {
  const db = getDb()
  db.prepare(`
    UPDATE api_keys SET units_used = MAX(0, units_used - ?), last_used_at = datetime('now')
    WHERE id = ?
  `).run(units, key_id)
}

function markKeyExhausted(key_id: string) {
  const db = getDb()
  db.prepare(`UPDATE api_keys SET units_used = units_limit WHERE id = ?`).run(key_id)
}

async function youtubeFetch(url: URL, key_id: string, quotaUnits: number) {
  const res = await fetch(url.toString())

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errMsg = (err as { error?: { message?: string } })?.error?.message ?? res.statusText
    if (res.status === 403 || res.status === 429) {
      markKeyExhausted(key_id)
    } else {
      // Refund quota for non-quota errors (400, 500, network, etc.)
      refundQuota(key_id, quotaUnits)
    }
    throw new Error(`YouTube API error: ${errMsg}`)
  }

  // Quota only counts on success — already pre-reserved in getNextAvailableKey
  return res.json()
}

// ── Fetch channel country details (1 unit per request) ─────────────
export async function fetchChannelCountries(channelIds: string[]): Promise<{ countries: Map<string, string>; quota_cost: number }> {
  if (channelIds.length === 0) return { countries: new Map(), quota_cost: 0 }

  const uniqueIds = Array.from(new Set(channelIds)).slice(0, 50)
  const keyInfo = getNextAvailableKey(1)
  if (!keyInfo) return { countries: new Map(), quota_cost: 0 }

  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('id', uniqueIds.join(','))
  url.searchParams.set('key', keyInfo.api_key)

  try {
    const data = await youtubeFetch(url, keyInfo.key_id, 1) as {
      items?: Array<{ id: string; snippet?: { country?: string } }>
    }
    const countries = new Map<string, string>()
    if (data.items) {
      for (const item of data.items) {
        if (item.snippet?.country) {
          countries.set(item.id, item.snippet.country.toUpperCase())
        }
      }
    }
    return { countries, quota_cost: 1 }
  } catch (err) {
    console.error('Error fetching channel countries:', err)
    return { countries: new Map(), quota_cost: 1 }
  }
}

// ── Search only (100 units) — plus regionCode=IN + channel country API (1 unit) ──
export async function searchKeyword(
  keyword: string,
  maxResults = 50,
  regionCode = 'IN'
): Promise<SearchResult> {
  const keyInfo = getNextAvailableKey(100)
  if (!keyInfo) throw new Error('NO_API_KEYS: All API keys are exhausted for today.')

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'id,snippet')
  searchUrl.searchParams.set('q', keyword)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('maxResults', String(Math.min(maxResults, 50)))
  searchUrl.searchParams.set('regionCode', regionCode)
  searchUrl.searchParams.set('key', keyInfo.api_key)

  const searchData = await youtubeFetch(searchUrl, keyInfo.key_id, 100) as {
    items: Array<{ id: { videoId: string }; snippet: {
      title?: string
      channelTitle?: string
      channelId?: string
      publishedAt?: string
      thumbnails?: { medium?: { url?: string } }
    } }>
  }

  const initialHits = (searchData.items ?? [])
    .map((item, index) => ({
      position: index + 1,
      youtube_id: item.id.videoId,
      title: item.snippet?.title ?? '',
      channel_name: item.snippet?.channelTitle ?? '',
      channel_id: item.snippet?.channelId ?? '',
      published_at: item.snippet?.publishedAt ?? '',
      thumbnail_url: item.snippet?.thumbnails?.medium?.url ?? '',
    }))
    .filter(h => Boolean(h.youtube_id))

  // Filter hits to ignore non-Indian channels
  let quota_cost = 100
  let filteredHits = initialHits

  if (initialHits.length > 0) {
    const channelIds = initialHits.map(h => h.channel_id)
    const { countries, quota_cost: channelCost } = await fetchChannelCountries(channelIds)
    quota_cost += channelCost
    filteredHits = initialHits.filter(h => {
      const country = countries.get(h.channel_id)
      // Ignore if explicitly set to another country (not IN)
      if (country && country !== 'IN') {
        return false
      }
      return true
    })
  }

  return { hits: filteredHits, quota_cost }
}

// ── Fetch details only for unknown IDs (1 unit per request up to 50 IDs) ─────────
export async function fetchVideoDetails(youtubeIds: string[]): Promise<{ videos: YouTubeVideo[]; quota_cost: number }> {
  if (youtubeIds.length === 0) return { videos: [], quota_cost: 0 }

  // Slice to max 50 to fit YouTube API limit per request
  const idsToFetch = youtubeIds.slice(0, 50)
  const keyInfo = getNextAvailableKey(1) // 1 unit for videos.list
  if (!keyInfo) throw new Error('NO_API_KEYS: All API keys are exhausted for today.')

  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  statsUrl.searchParams.set('part', 'statistics,snippet,contentDetails')
  statsUrl.searchParams.set('id', idsToFetch.join(','))
  statsUrl.searchParams.set('key', keyInfo.api_key)

  const statsData = await youtubeFetch(statsUrl, keyInfo.key_id, 1) as {
    items: Array<{ id: string; snippet: {
      title?: string
      description?: string
      channelTitle?: string
      channelId?: string
      publishedAt?: string
      thumbnails?: { medium?: { url?: string } }
    }; statistics: { viewCount?: string }; contentDetails: { duration?: string } }>
  }

  const videos: YouTubeVideo[] = (statsData.items ?? []).map(item => {
    const durStr = item.contentDetails?.duration ?? ''
    return {
      youtube_id: item.id,
      title: item.snippet?.title ?? '',
      description: item.snippet?.description ?? '',
      channel_name: item.snippet?.channelTitle ?? '',
      channel_id: item.snippet?.channelId ?? '',
      view_count: parseInt(item.statistics?.viewCount ?? '0', 10),
      published_at: item.snippet?.publishedAt ?? '',
      thumbnail_url: item.snippet?.thumbnails?.medium?.url ?? '',
      duration: durStr,
      duration_sec: parseDurationSec(durStr),
      tags: [],
    }
  })

  return { videos, quota_cost: 1 }
}

// ── Batch view refresh for cron (50 IDs per call, costs 1 unit) ─────────────────
export async function fetchViewCountsBatch(youtubeIds: string[]): Promise<{
  stats: Array<{ youtube_id: string; view_count: number; is_deleted: boolean }>
  quota_cost: number
}> {
  if (youtubeIds.length === 0) return { stats: [], quota_cost: 0 }

  const idsToFetch = youtubeIds.slice(0, 50)
  const keyInfo = getNextAvailableKey(1) // 1 unit for videos.list
  if (!keyInfo) throw new Error('NO_API_KEYS: All API keys are exhausted for today.')

  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  statsUrl.searchParams.set('part', 'statistics')
  statsUrl.searchParams.set('id', idsToFetch.join(','))
  statsUrl.searchParams.set('key', keyInfo.api_key)

  const statsData = await youtubeFetch(statsUrl, keyInfo.key_id, 1) as {
    items: Array<{ id: string; statistics: { viewCount?: string } }>
  }

  const found = new Set((statsData.items ?? []).map(i => i.id))
  const stats = idsToFetch.map(id => ({
    youtube_id: id,
    view_count: found.has(id)
      ? parseInt(statsData.items!.find(i => i.id === id)!.statistics?.viewCount ?? '0', 10)
      : 0,
    is_deleted: !found.has(id),
  }))

  return { stats, quota_cost: 1 }
}

// Legacy wrapper kept for any remaining imports
export async function searchYouTube(keyword: string, maxResults = 50): Promise<{
  videos: YouTubeVideo[]
  api_key_used: string
  quota_cost: number
}> {
  const { hits, quota_cost: searchCost } = await searchKeyword(keyword, maxResults)
  const ids = hits.map(h => h.youtube_id)
  const { videos, quota_cost: detailCost } = await fetchVideoDetails(ids)
  return {
    videos,
    api_key_used: 'optimized',
    quota_cost: searchCost + detailCost,
  }
}

export { saveScrapeResults } from './scrape-pipeline'
