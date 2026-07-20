import { getDb } from './db'
import {
  searchKeyword,
  fetchVideoDetails,
  fetchViewCountsBatch,
  isShortForm,
  type YouTubeVideo,
  type SearchHit,
} from './youtube'
import { fetchTranscript } from './transcript'
import { analyzeBrandsFromTranscript } from './brand-analyzer'

export interface ScrapeResult {
  saved: number
  ranked: number
  pool_added: number
  quota_cost: number
  new_videos_fetched: number
  reused_from_pool: number
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getCampaignPoolIds(campaignId: string): Set<string> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT v.youtube_id
    FROM campaign_videos cv
    INNER JOIN videos v ON v.id = cv.video_id
    WHERE cv.campaign_id = ?
  `).all(campaignId) as Array<{ youtube_id: string }>
  return new Set(rows.map(r => r.youtube_id))
}

function loadCampaignPoolVideos(campaignId: string, limit = 50): YouTubeVideo[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT v.youtube_id, v.title, v.description, v.channel_name, v.channel_id, v.view_count,
           v.published_at, v.thumbnail_url, v.duration, v.duration_sec, v.tags
    FROM campaign_videos cv
    INNER JOIN videos v ON v.id = cv.video_id
    WHERE cv.campaign_id = ? AND v.is_deleted = 0
    ORDER BY v.view_count DESC
    LIMIT ?
  `).all(campaignId, limit) as Array<{
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
    tags: string
  }>

  return rows.map(r => {
    let tags: string[] = []
    try { tags = JSON.parse(r.tags || '[]') } catch {}
    return {
      youtube_id: r.youtube_id,
      title: r.title ?? '',
      description: r.description ?? '',
      channel_name: r.channel_name ?? '',
      channel_id: r.channel_id ?? '',
      view_count: r.view_count ?? 0,
      published_at: r.published_at ?? '',
      thumbnail_url: r.thumbnail_url ?? '',
      duration: r.duration ?? '',
      duration_sec: r.duration_sec ?? 0,
      tags,
    }
  })
}

function loadVideosFromDb(youtubeIds: string[]): Map<string, YouTubeVideo> {
  const db = getDb()
  const map = new Map<string, YouTubeVideo>()
  if (youtubeIds.length === 0) return map

  const placeholders = youtubeIds.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT youtube_id, title, description, channel_name, channel_id, view_count,
           published_at, thumbnail_url, duration, duration_sec, tags
    FROM videos WHERE youtube_id IN (${placeholders})
  `).all(...youtubeIds) as Array<{
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
    tags: string
  }>

  for (const row of rows) {
    let tags: string[] = []
    try { tags = JSON.parse(row.tags || '[]') } catch { tags = [] }
    map.set(row.youtube_id, {
      youtube_id: row.youtube_id,
      title: row.title ?? '',
      description: row.description ?? '',
      channel_name: row.channel_name ?? '',
      channel_id: row.channel_id ?? '',
      view_count: row.view_count ?? 0,
      published_at: row.published_at ?? '',
      thumbnail_url: row.thumbnail_url ?? '',
      duration: row.duration ?? '',
      duration_sec: row.duration_sec ?? 0,
      tags,
    })
  }
  return map
}

function hitToPartialVideo(hit: SearchHit): YouTubeVideo {
  return {
    youtube_id: hit.youtube_id,
    title: hit.title,
    description: '',
    channel_name: hit.channel_name,
    channel_id: hit.channel_id,
    view_count: 0,
    published_at: hit.published_at,
    thumbnail_url: hit.thumbnail_url,
    duration: '',
    duration_sec: 0,
    tags: [],
  }
}

/** Archive current ranks before replacing (for week-over-week dropped detection). */
export function archiveKeywordRanks(keywordId: string, campaignId: string) {
  const db = getDb()
  const weekStart = getWeekStart()

  const archive = db.prepare(`
    INSERT OR IGNORE INTO keyword_rank_history
      (id, keyword_id, campaign_id, video_id, rank, form_type, week_start)
    SELECT
      lower(hex(randomblob(16))),
      keyword_id, campaign_id, video_id, rank, 'long', ?
    FROM keyword_videos WHERE keyword_id = ?
  `)
  archive.run(weekStart, keywordId)

  const archiveShorts = db.prepare(`
    INSERT OR IGNORE INTO keyword_rank_history
      (id, keyword_id, campaign_id, video_id, rank, form_type, week_start)
    SELECT
      lower(hex(randomblob(16))),
      keyword_id, campaign_id, video_id, rank, 'short', ?
    FROM keyword_shorts WHERE keyword_id = ?
  `)
  archiveShorts.run(weekStart, keywordId)
}

/**
 * Quota-optimized keyword scrape:
 * 1) Search 50 results (100 units)
 * 2) Fetch details ONLY for videos not already in campaign pool
 * 3) Store all 50 in campaign pool; rank top 10 long + top 10 short
 */
export async function scrapeKeyword(
  campaignId: string,
  keywordId: string,
  keywordText: string,
  options: { archiveBefore?: boolean } = {}
): Promise<ScrapeResult> {
  let hits: SearchHit[] = []
  let quotaCost = 0
  try {
    const searchRes = await searchKeyword(keywordText, 50)
    hits = searchRes.hits
    quotaCost = searchRes.quota_cost
  } catch (err: any) {
    // If API keys/quota are exhausted, try to reuse campaign pool as a fallback.
    const msg = String(err?.message ?? '')
    if (msg.includes('NO_API_KEYS') || msg.toLowerCase().includes('quota exceeded')) {
      const poolVideos = loadCampaignPoolVideos(campaignId, 50)
      if (poolVideos.length > 0) {
        // Convert pool videos into ordered hits (partial) so downstream logic can proceed.
        hits = poolVideos.map((v, i) => ({
          position: i + 1,
          youtube_id: v.youtube_id,
          title: v.title,
          channel_name: v.channel_name,
          channel_id: v.channel_id,
          published_at: v.published_at,
          thumbnail_url: v.thumbnail_url,
        }))
        // no quota consumed when using local pool
        quotaCost = 0
      } else {
        throw err
      }
    } else {
      throw err
    }
  }

  const db = getDb()
  const campaignBrands = db.prepare(`
    SELECT name FROM campaign_brands WHERE campaign_id = ?
  `).all(campaignId) as Array<{ name: string }>
  const brandNames = campaignBrands.map(b => b.name)

  const filteredHits = hits.filter(hit => {
    const channelLower = hit.channel_name.toLowerCase().trim()
    for (const bName of brandNames) {
      const bLower = bName.toLowerCase().trim()
      if (bLower.length < 2) continue
      
      if (channelLower === bLower) return false
      
      const suffixes = ['india', 'global', 'electronics', 'official', 'support', 'care', 'hq', 'usa', 'vietnam', 'uk', 'deutschland', 'philippines', 'indonesia', 'malaysia', 'singapore', 'appliances']
      for (const s of suffixes) {
        if (channelLower === `${bLower} ${s}` || channelLower === `${s} ${bLower}` || channelLower === `${bLower}${s}` || channelLower === `${s}${bLower}`) {
          return false
        }
      }
      
      if (channelLower.includes(bLower) && (channelLower.includes('official') || channelLower.includes('electronics') || channelLower.endsWith(' india') || channelLower.endsWith(' global') || channelLower.endsWith(' care'))) {
        return false
      }
    }
    return true
  })

  const poolIds = getCampaignPoolIds(campaignId)
  const unknownIds = filteredHits.map(h => h.youtube_id).filter(id => !poolIds.has(id))

  const { videos: fetchedVideos, quota_cost: fetchCost } = await fetchVideoDetails(unknownIds)
  quotaCost += fetchCost

  const fetchedMap = new Map(fetchedVideos.map(v => [v.youtube_id, v]))
  const dbMap = loadVideosFromDb(filteredHits.map(h => h.youtube_id).filter(id => poolIds.has(id) && !fetchedMap.has(id)))

  const orderedVideos: YouTubeVideo[] = filteredHits.map(hit => {
    return fetchedMap.get(hit.youtube_id)
      ?? dbMap.get(hit.youtube_id)
      ?? hitToPartialVideo(hit)
  })

  if (options.archiveBefore) {
    archiveKeywordRanks(keywordId, campaignId)
  }

  db.prepare(`DELETE FROM keyword_videos WHERE keyword_id = ?`).run(keywordId)
  db.prepare(`DELETE FROM keyword_shorts WHERE keyword_id = ?`).run(keywordId)

  const ranked = saveScrapeResults(campaignId, keywordId, orderedVideos, filteredHits)

  db.prepare(`UPDATE keywords SET last_scraped_at = datetime('now') WHERE id = ?`).run(keywordId)
  setMetadata('last_ranking_refresh', new Date().toISOString())

  return {
    saved: orderedVideos.length,
    ranked: ranked.ranked,
    pool_added: ranked.pool_added,
    quota_cost: quotaCost,
    new_videos_fetched: unknownIds.length,
    reused_from_pool: filteredHits.length - unknownIds.length,
  }
}

export function saveScrapeResults(
  campaignId: string,
  keywordId: string,
  videos: YouTubeVideo[],
  hits?: SearchHit[]
): { ranked: number; pool_added: number } {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const campaignBrands = db.prepare(`
    SELECT name FROM campaign_brands WHERE campaign_id = ?
  `).all(campaignId) as Array<{ name: string }>
  const brandNames = campaignBrands.map(b => b.name)

  const upsertVideo = db.prepare(`
    INSERT INTO videos (youtube_id, title, description, channel_name, channel_id, view_count, published_at, duration, duration_sec, thumbnail_url, tags)
    VALUES (@youtube_id, @title, @description, @channel_name, @channel_id, @view_count, @published_at, @duration, @duration_sec, @thumbnail_url, @tags)
    ON CONFLICT(youtube_id) DO UPDATE SET
      view_count = CASE WHEN excluded.view_count > 0 THEN excluded.view_count ELSE videos.view_count END,
      title = excluded.title,
      description = CASE WHEN excluded.description != '' THEN excluded.description ELSE videos.description END,
      channel_name = excluded.channel_name,
      duration = CASE WHEN excluded.duration != '' THEN excluded.duration ELSE videos.duration END,
      duration_sec = CASE WHEN excluded.duration_sec > 0 THEN excluded.duration_sec ELSE videos.duration_sec END,
      thumbnail_url = excluded.thumbnail_url
  `)

  const upsertPool = db.prepare(`
    INSERT OR IGNORE INTO campaign_videos (campaign_id, video_id)
    SELECT @campaign_id, id FROM videos WHERE youtube_id = @youtube_id
  `)

  const upsertLongMapping = db.prepare(`
    INSERT OR REPLACE INTO keyword_videos (id, keyword_id, campaign_id, video_id, rank, scraped_at)
    SELECT lower(hex(randomblob(16))), @keyword_id, @campaign_id, id, @rank, datetime('now')
    FROM videos WHERE youtube_id = @youtube_id
  `)

  const upsertShortMapping = db.prepare(`
    INSERT OR REPLACE INTO keyword_shorts (id, keyword_id, campaign_id, video_id, rank, scraped_at)
    SELECT lower(hex(randomblob(16))), @keyword_id, @campaign_id, id, @rank, datetime('now')
    FROM videos WHERE youtube_id = @youtube_id
  `)

  const upsertSnapshot = db.prepare(`
    INSERT OR REPLACE INTO view_snapshots (id, video_id, campaign_id, view_count, snapshot_date)
    SELECT lower(hex(randomblob(16))), id, @campaign_id, @view_count, @snapshot_date
    FROM videos WHERE youtube_id = @youtube_id
  `)

  const insertBrandTag = db.prepare(`
    INSERT OR IGNORE INTO brand_tags (video_id, brand_name, campaign_id)
    SELECT id, @brand_name, @campaign_id
    FROM videos WHERE youtube_id = @youtube_id
  `)

  const longForm: YouTubeVideo[] = []
  const shortForm: YouTubeVideo[] = []
  for (const v of videos) {
    if (v.duration_sec === 0) continue // unknown duration — skip format ranking
    if (isShortForm(v.duration_sec)) {
      if (shortForm.length < 10) shortForm.push(v)
    } else if (longForm.length < 10) {
      longForm.push(v)
    }
  }

  let poolAdded = 0
  let ranked = 0

  const tx = db.transaction(() => {
    // Store ALL search results in campaign pool (up to 50)
    for (const v of videos) {
      const matchedBrands = brandNames.filter(b =>
        v.title.toLowerCase().includes(b.toLowerCase()) ||
        v.channel_name.toLowerCase().includes(b.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(b.toLowerCase()))
      )

      upsertVideo.run({
        ...v,
        tags: JSON.stringify(matchedBrands),
      })

      const poolResult = upsertPool.run({ campaign_id: campaignId, youtube_id: v.youtube_id })
      if (poolResult.changes > 0) poolAdded++

      matchedBrands.forEach(bName => {
        insertBrandTag.run({ youtube_id: v.youtube_id, brand_name: bName, campaign_id: campaignId })
      })
    }

    longForm.forEach((v, index) => {
      // Use index within the longForm list as the rank (1-based)
      let computedRank = index + 1
      if (computedRank < 1) computedRank = 1
      if (computedRank > 10) computedRank = 10
      upsertLongMapping.run({
        keyword_id: keywordId,
        campaign_id: campaignId,
        youtube_id: v.youtube_id,
        rank: computedRank,
      })
      upsertSnapshot.run({
        campaign_id: campaignId,
        youtube_id: v.youtube_id,
        view_count: v.view_count,
        snapshot_date: today,
      })
      ranked++
    })

    shortForm.forEach((v, index) => {
      // Use index within the shortForm list as the rank (1-based)
      let computedRank = index + 1
      if (computedRank < 1) computedRank = 1
      if (computedRank > 10) computedRank = 10
      upsertShortMapping.run({
        keyword_id: keywordId,
        campaign_id: campaignId,
        youtube_id: v.youtube_id,
        rank: computedRank,
      })
      upsertSnapshot.run({
        campaign_id: campaignId,
        youtube_id: v.youtube_id,
        view_count: v.view_count,
        snapshot_date: today,
      })
      ranked++
    })
  })

  tx()
  return { ranked, pool_added: poolAdded }
}

export function setMetadata(key: string, value: string) {
  const db = getDb()
  db.prepare(`
    INSERT INTO system_metadata (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value)
}

export function getMetadata(key: string): string | null {
  const db = getDb()
  const row = db.prepare(`SELECT value FROM system_metadata WHERE key = ?`).get(key) as { value: string } | undefined
  return row?.value ?? null
}

/** Daily cron: refresh view counts for all tracked videos (1 unit per video, batched by 50). */
export async function runDailyViewUpdate(campaignId?: string): Promise<{
  updated: number
  deleted: number
  quota_cost: number
  batches: number
}> {
  const db = getDb()
  const where = campaignId ? 'WHERE cv.campaign_id = ?' : ''
  const params = campaignId ? [campaignId] : []

  const rows = db.prepare(`
    SELECT DISTINCT v.youtube_id, v.id as video_id, cv.campaign_id
    FROM campaign_videos cv
    INNER JOIN videos v ON v.id = cv.video_id
    ${where}
    AND v.is_deleted = 0
  `).all(...params) as Array<{ youtube_id: string; video_id: string; campaign_id: string }>

  const today = new Date().toISOString().split('T')[0]
  let quotaCost = 0
  let updated = 0
  let deleted = 0
  let batches = 0

  const updateVideo = db.prepare(`UPDATE videos SET view_count = ? WHERE youtube_id = ?`)
  const markDeleted = db.prepare(`UPDATE videos SET is_deleted = 1 WHERE youtube_id = ?`)
  const upsertSnap = db.prepare(`
    INSERT OR REPLACE INTO view_snapshots (id, video_id, campaign_id, view_count, snapshot_date)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
  `)

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const ids = batch.map(r => r.youtube_id)
    const { stats, quota_cost } = await fetchViewCountsBatch(ids)
    quotaCost += quota_cost
    batches++

    const tx = db.transaction(() => {
      for (const stat of stats) {
        const row = batch.find(r => r.youtube_id === stat.youtube_id)
        if (!row) continue

        if (stat.is_deleted) {
          markDeleted.run(stat.youtube_id)
          deleted++
          continue
        }

        updateVideo.run(stat.view_count, stat.youtube_id)
        upsertSnap.run(row.video_id, row.campaign_id, stat.view_count, today)
        updated++
      }
    })
    tx()
  }

  setMetadata('last_views_refresh', new Date().toISOString())
  return { updated, deleted, quota_cost: quotaCost, batches }
}

/** Monday cron: re-scrape every active keyword across all campaigns. */
export async function runWeeklyKeywordRefresh(campaignId?: string): Promise<{
  keywords_processed: number
  failed: number
  total_quota: number
}> {
  const db = getDb()
  const where = campaignId
    ? `WHERE k.status = 'active' AND k.campaign_id = ?`
    : `WHERE k.status = 'active'`
  const params = campaignId ? [campaignId] : []

  const keywords = db.prepare(`
    SELECT k.id, k.text, k.campaign_id
    FROM keywords k
    ${where}
    ORDER BY k.last_scraped_at IS NULL DESC, k.last_scraped_at ASC
  `).all(...params) as Array<{ id: string; text: string; campaign_id: string }>

  let totalQuota = 0
  let failed = 0

  for (const kw of keywords) {
    try {
      const result = await scrapeKeyword(kw.campaign_id, kw.id, kw.text, { archiveBefore: true })
      totalQuota += result.quota_cost
    } catch {
      failed++
    }
  }

  setMetadata('last_weekly_refresh', new Date().toISOString())
  return { keywords_processed: keywords.length - failed, failed, total_quota: totalQuota }
}

/** Estimate quota for a campaign with N keywords (after pool is warm). */
export function estimateQuotaPerKeyword(poolSize: number): {
  first_keyword: number
  subsequent_avg: number
  daily_views_per_500_videos: number
  weekly_10_keywords: number
} {
  const first = 100 + 50 // search + all new details
  const subsequent = 100 + Math.max(0, Math.round(50 * 0.1)) // ~10% new videos per keyword
  return {
    first_keyword: first,
    subsequent_avg: subsequent,
    daily_views_per_500_videos: 10, // 500/50 batches = 10 units
    weekly_10_keywords: subsequent * 10,
  }
}

/** Analyze unanalyzed videos using AI brand detection. */
export async function runBrandAnalysis(campaignId?: string, limit = 10): Promise<{
  analyzed: number
  skipped: number
  no_transcript: number
  brands_found: number
}> {
  const db = getDb()

  // Get campaign brands for context
  const brandNames = campaignId
    ? (db.prepare('SELECT name FROM campaign_brands WHERE campaign_id = ?').all(campaignId) as any[]).map(r => r.name)
    : []

  // Find videos not yet analyzed
  const where = campaignId
    ? `WHERE v.id NOT IN (SELECT video_id FROM brand_analysis)
       AND v.is_deleted = 0
       AND v.id IN (SELECT video_id FROM campaign_videos WHERE campaign_id = ?)`
    : `WHERE v.id NOT IN (SELECT video_id FROM brand_analysis)
       AND v.is_deleted = 0`
  const params = campaignId ? [campaignId] : []

  const videos = db.prepare(`
    SELECT v.id, v.youtube_id, v.title, v.channel_name, v.description
    FROM videos v
    ${where}
    ORDER BY v.view_count DESC
    LIMIT ?
  `).all(...params, limit) as any[]

  let analyzed = 0
  let noTranscript = 0
  let brandsFound = 0

  const insertAnalysis = db.prepare(
    `INSERT INTO brand_analysis (video_id, brand_name, confidence, mention_type, context_quotes)
     VALUES (?, ?, ?, ?, ?)`
  )
  const upsertTranscript = db.prepare(
    `INSERT OR REPLACE INTO video_transcripts (video_id, transcript_text, language)
     VALUES (?, ?, ?)`
  )
  const updateTags = db.prepare(
    `UPDATE videos SET tags = ? WHERE id = ?`
  )
  const insertBrandTag = db.prepare(
    `INSERT OR IGNORE INTO brand_tags (video_id, brand_name, campaign_id)
     VALUES (?, ?, ?)`
  )

  for (const video of videos) {
    try {
      // Check for existing transcript
      let transcriptRow = db.prepare(
        'SELECT transcript_text, language FROM video_transcripts WHERE video_id = ?'
      ).get(video.id) as any

      let transcriptText = transcriptRow?.transcript_text
      let language = transcriptRow?.language || 'en'

      if (!transcriptText) {
        const result = await fetchTranscript(video.youtube_id)
        if (!result) {
          noTranscript++
          continue
        }
        transcriptText = result.text
        language = result.language
        upsertTranscript.run(video.id, transcriptText, language)
      }

      // Analyze with AI
      const detections = await analyzeBrandsFromTranscript(
        transcriptText,
        video.title,
        brandNames,
        video.channel_name || '',
        video.description || ''
      )

      // Store detections
      for (const d of detections) {
        insertAnalysis.run(
          video.id,
          d.brand_name,
          d.confidence,
          d.mention_type,
          JSON.stringify(d.context_quotes || [])
        )
        if (d.confidence >= 0.6) brandsFound++
      }

      // Merge high-confidence brands into video tags
      const highConfBrands = detections
        .filter(d => d.confidence >= 0.6)
        .map(d => d.brand_name)

      if (highConfBrands.length > 0) {
        const currentTags = JSON.parse(
          (db.prepare('SELECT tags FROM videos WHERE id = ?').get(video.id) as any)?.tags || '[]'
        )
        const mergedTags = [...new Set([...currentTags, ...highConfBrands])]
        updateTags.run(JSON.stringify(mergedTags), video.id)

        if (campaignId) {
          for (const brand of highConfBrands) {
            insertBrandTag.run(video.id, brand, campaignId)
          }
        }
      }

      analyzed++

      // Rate limit: 15 RPM on Gemini free tier
      await new Promise(r => setTimeout(r, 4500))
    } catch (err) {
      console.error(`Analysis failed for ${video.youtube_id}:`, err)
    }
  }

  setMetadata('last_brand_analysis', new Date().toISOString())
  return { analyzed, skipped: videos.length - analyzed - noTranscript, no_transcript: noTranscript, brands_found: brandsFound }
}
