import { queryAll, queryOne, batchUpsert } from './supabase'
import {
  searchYouTubeOAuth,
  getVideoDetailsOAuth,
  getViewCountsOAuth,
  getChannelDetailsOAuth,
} from './youtube-oauth'
import { fetchTranscript } from './transcript'
import { analyzeBrandsFromTranscript } from './brand-analyzer'
import { getQueue, QUEUE_NAMES, addJob, ScrapeJobData, DailyViewsJobData } from './queue'

export interface ScrapeResult {
  saved: number
  ranked: number
  pool_added: number
  quota_cost: number
  new_videos_fetched: number
  reused_from_pool: number
}

interface SearchHit {
  position: number
  youtube_id: string
  title: string
  channel_name: string
  channel_id: string
  published_at: string
  thumbnail_url: string
}

interface YouTubeVideo {
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

function parseDurationSec(duration: string | null): number {
  if (!duration) return 0
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0', 10)
  const m = parseInt(match[2] ?? '0', 10)
  const s = parseInt(match[3] ?? '0', 10)
  return h * 3600 + m * 60 + s
}

function pgArray(items: string[]): string {
  return `{${items.map(i => `"${i.replace(/"/g, '\\"')}"`).join(',')}}`
}

function isShortForm(durationSec: number): boolean {
  return durationSec > 0 && durationSec < 240
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

async function getCampaignPoolIds(campaignId: string): Promise<Set<string>> {
  const rows = await queryAll<{ youtube_id: string }>(
    `SELECT v.youtube_id FROM campaign_videos cv INNER JOIN videos v ON v.id = cv.video_id WHERE cv.campaign_id = $1`,
    [campaignId]
  )
  return new Set(rows.map(r => r.youtube_id).filter(Boolean))
}

async function loadCampaignPoolVideos(campaignId: string, limit: number = 50): Promise<YouTubeVideo[]> {
  const rows = await queryAll<any>(
    `SELECT v.youtube_id, v.title, v.description, v.channel_name, v.channel_id,
            v.view_count, v.published_at, v.thumbnail_url, v.duration, v.duration_sec, v.tags
     FROM campaign_videos cv
     INNER JOIN videos v ON v.id = cv.video_id
     WHERE cv.campaign_id = $1
     ORDER BY v.view_count DESC
     LIMIT ${limit}`,
    [campaignId]
  )

  return rows.map(r => ({
    youtube_id: r.youtube_id || '',
    title: r.title || '',
    description: r.description || '',
    channel_name: r.channel_name || '',
    channel_id: r.channel_id || '',
    view_count: r.view_count || 0,
    published_at: r.published_at || '',
    thumbnail_url: r.thumbnail_url || '',
    duration: r.duration || '',
    duration_sec: r.duration_sec || 0,
    tags: Array.isArray(r.tags) ? r.tags : [],
  }))
}

async function loadVideosFromDb(youtubeIds: string[]): Promise<Map<string, YouTubeVideo>> {
  if (youtubeIds.length === 0) return new Map()

  const rows = await queryAll<any>(
    `SELECT youtube_id, title, description, channel_name, channel_id, view_count, published_at, thumbnail_url, duration, duration_sec, tags
     FROM videos WHERE youtube_id = ANY($1)`,
    [youtubeIds]
  )

  const map = new Map<string, YouTubeVideo>()
  for (const row of rows) {
    map.set(row.youtube_id, {
      youtube_id: row.youtube_id,
      title: row.title || '',
      description: row.description || '',
      channel_name: row.channel_name || '',
      channel_id: row.channel_id || '',
      view_count: row.view_count || 0,
      published_at: row.published_at || '',
      thumbnail_url: row.thumbnail_url || '',
      duration: row.duration || '',
      duration_sec: row.duration_sec || 0,
      tags: Array.isArray(row.tags) ? row.tags : [],
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

export async function archiveKeywordRanks(keywordId: string, campaignId: string): Promise<void> {
  const weekStart = getWeekStart()

  // 1. Archive long-form — 1 query
  await queryAll(`
    INSERT INTO keyword_rank_history (id, keyword_id, campaign_id, video_id, rank, form_type, week_start)
    SELECT gen_random_uuid()::text, keyword_id, campaign_id, video_id, rank, 'long', '${weekStart}'
    FROM keyword_videos WHERE keyword_id = '${keywordId}'
    ON CONFLICT (keyword_id, video_id, form_type, week_start) DO NOTHING
  `)

  // 2. Archive short-form — 1 query
  await queryAll(`
    INSERT INTO keyword_rank_history (id, keyword_id, campaign_id, video_id, rank, form_type, week_start)
    SELECT gen_random_uuid()::text, keyword_id, campaign_id, video_id, rank, 'short', '${weekStart}'
    FROM keyword_shorts WHERE keyword_id = '${keywordId}'
    ON CONFLICT (keyword_id, video_id, form_type, week_start) DO NOTHING
  `)
}

export async function scrapeKeyword(
  campaignId: string,
  keywordId: string,
  keywordText: string,
  options: { archiveBefore?: boolean } = {}
): Promise<ScrapeResult> {
  let hits: SearchHit[] = []
  let quotaCost = 0

  try {
    const searchRes = await searchYouTubeOAuth(keywordText, 50)
    hits = (searchRes.items || []).map((item, index) => ({
      position: index + 1,
      youtube_id: item.id.videoId,
      title: item.snippet?.title ?? '',
      channel_name: item.snippet?.channelTitle ?? '',
      channel_id: item.snippet?.channelId ?? '',
      published_at: item.snippet?.publishedAt ?? '',
      thumbnail_url: item.snippet?.thumbnails?.medium?.url ?? '',
    })).filter(h => Boolean(h.youtube_id))
    quotaCost = 100
  } catch (err: any) {
    const msg = String(err?.message ?? '')
    if (msg.includes('quota') || msg.includes('429') || msg.includes('403')) {
      const poolVideos = await loadCampaignPoolVideos(campaignId, 50)
      if (poolVideos.length > 0) {
        hits = poolVideos.map((v, i) => ({
          position: i + 1,
          youtube_id: v.youtube_id,
          title: v.title,
          channel_name: v.channel_name,
          channel_id: v.channel_id,
          published_at: v.published_at,
          thumbnail_url: v.thumbnail_url,
        }))
        quotaCost = 0
      } else {
        throw err
      }
    } else {
      throw err
    }
  }

  const brandNames = await queryAll<{ name: string }>(
    `SELECT name FROM campaign_brands WHERE campaign_id = $1`, [campaignId]
  ).then(rows => rows.map(r => r.name))

  const filteredHits = hits.filter(hit => {
    const channelLower = hit.channel_name.toLowerCase().trim()
    for (const bName of brandNames) {
      const bLower = bName.toLowerCase().trim()
      if (bLower.length < 2) continue
      if (channelLower === bLower) return false

      const suffixes = ['india', 'global', 'electronics', 'official', 'support', 'care', 'hq']
      for (const s of suffixes) {
        if (channelLower === `${bLower} ${s}` || channelLower === `${s} ${bLower}`) {
          return false
        }
      }

      if (channelLower.includes(bLower) && (
        channelLower.includes('official') ||
        channelLower.includes('electronics') ||
        channelLower.endsWith(' india') ||
        channelLower.endsWith(' global')
      )) {
        return false
      }
    }
    return true
  })

  const poolIds = await getCampaignPoolIds(campaignId)
  const unknownIds = filteredHits.map(h => h.youtube_id).filter(id => !poolIds.has(id))

  let fetchedVideos: YouTubeVideo[] = []
  if (unknownIds.length > 0) {
    try {
      const detailsRes = await getVideoDetailsOAuth(unknownIds.slice(0, 50))
      fetchedVideos = (detailsRes.items || []).map(item => ({
        youtube_id: item.id,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        channel_name: item.snippet?.channelTitle || '',
        channel_id: item.snippet?.channelId || '',
        view_count: parseInt(item.statistics?.viewCount || '0', 10),
        published_at: item.snippet?.publishedAt || '',
        thumbnail_url: item.snippet?.thumbnails?.medium?.url || '',
        duration: item.contentDetails?.duration || '',
        duration_sec: parseDurationSec(item.contentDetails?.duration),
        tags: [],
      }))
      quotaCost += 1
    } catch (err) {
      console.error('Failed to fetch video details:', err)
    }
  }

  const fetchedMap = new Map(fetchedVideos.map(v => [v.youtube_id, v]))
  const dbMap = await loadVideosFromDb(
    filteredHits.map(h => h.youtube_id).filter(id => poolIds.has(id) && !fetchedMap.has(id))
  )

  const orderedVideos: YouTubeVideo[] = filteredHits.map(hit => {
    return fetchedMap.get(hit.youtube_id)
      ?? dbMap.get(hit.youtube_id)
      ?? hitToPartialVideo(hit)
  })

  if (options.archiveBefore) {
    await archiveKeywordRanks(keywordId, campaignId)
  }

  await queryAll(`DELETE FROM keyword_videos WHERE keyword_id = $1`, [keywordId])
  await queryAll(`DELETE FROM keyword_shorts WHERE keyword_id = $1`, [keywordId])

  const ranked = await saveScrapeResults(campaignId, keywordId, orderedVideos, filteredHits)

  const now = new Date().toISOString()
  await queryAll(
    `UPDATE keywords SET last_scraped_at = $1 WHERE id = $2`,
    [now, keywordId]
  )

  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ('last_ranking_refresh', '${now}', '${now}')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
  )

  return {
    saved: orderedVideos.length,
    ranked: ranked.ranked,
    pool_added: ranked.pool_added,
    quota_cost: quotaCost,
    new_videos_fetched: unknownIds.length,
    reused_from_pool: filteredHits.length - unknownIds.length,
  }
}

export async function saveScrapeResults(
  campaignId: string,
  keywordId: string,
  videos: YouTubeVideo[],
  hits?: SearchHit[]
): Promise<{ ranked: number; pool_added: number }> {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  // 1. Get brand names — 1 query
  const brandNames = await queryAll<{ name: string }>(
    `SELECT name FROM campaign_brands WHERE campaign_id = $1`, [campaignId]
  ).then(rows => rows.map(r => r.name))

  // 2. Split into long/short form
  const longForm: YouTubeVideo[] = []
  const shortForm: YouTubeVideo[] = []
  for (const v of videos) {
    if (isShortForm(v.duration_sec)) {
      if (shortForm.length < 10) shortForm.push(v)
    } else if (longForm.length < 10) {
      longForm.push(v)
    }
  }

  // 3. Compute matched brands for each video (in-memory, no DB)
  const videoBrandMap = new Map<string, string[]>()
  for (const v of videos) {
    const matched = brandNames.filter(b =>
      v.title.toLowerCase().includes(b.toLowerCase()) ||
      v.channel_name.toLowerCase().includes(b.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(b.toLowerCase()))
    )
    videoBrandMap.set(v.youtube_id, matched)
  }

  // 4. Batch: Check which videos already exist — 1 query
  const allYoutubeIds = videos.map(v => v.youtube_id)
  const existingRows = await queryAll<{ id: string; youtube_id: string }>(
    `SELECT id, youtube_id FROM videos WHERE youtube_id = ANY($1)`,
    [allYoutubeIds]
  )
  const existingMap = new Map(existingRows.map(r => [r.youtube_id, r.id]))

  // 5. Batch: Insert new videos — 1 query
  const newVideos = videos.filter(v => !existingMap.has(v.youtube_id))
  if (newVideos.length > 0) {
    const valueRows = newVideos.map(v => {
      const tags = videoBrandMap.get(v.youtube_id) || []
      const tagsArr = tags.length > 0
        ? `ARRAY[${tags.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}]`
        : `'{}'::text[]`
      return `('${v.youtube_id}','${v.title.replace(/'/g,"''")}','${(v.description || '').replace(/'/g,"''")}','${v.channel_name.replace(/'/g,"''")}','${v.channel_id}',${v.view_count || 0},'${v.published_at}','${v.duration || ''}',${v.duration_sec || 0},'${(v.thumbnail_url || '').replace(/'/g,"''")}',${tagsArr})`
    })
    const inserted = await queryAll<{ id: string; youtube_id: string }>(
      `INSERT INTO videos (youtube_id, title, description, channel_name, channel_id, view_count, published_at, duration, duration_sec, thumbnail_url, tags)
       VALUES ${valueRows.join(',')}
       ON CONFLICT (youtube_id) DO UPDATE SET
         view_count = EXCLUDED.view_count, title = EXCLUDED.title, channel_name = EXCLUDED.channel_name,
         duration = EXCLUDED.duration, duration_sec = EXCLUDED.duration_sec, thumbnail_url = EXCLUDED.thumbnail_url, tags = EXCLUDED.tags
       RETURNING id, youtube_id`
    )
    for (const r of inserted) existingMap.set(r.youtube_id, r.id)
  }

  // 6. Batch: Update existing videos — 1 query (only if there are existing)
  if (newVideos.length < videos.length) {
    const existingToUpdate = videos.filter(v => existingMap.has(v.youtube_id))
    const cases = existingToUpdate.map(v => {
      const id = existingMap.get(v.youtube_id)!
      return `WHEN youtube_id = '${v.youtube_id}' THEN ${v.view_count || 0}`
    }).join(' ')
    const titleCases = existingToUpdate.map(v => {
      return `WHEN youtube_id = '${v.youtube_id}' THEN '${v.title.replace(/'/g,"''")}'`
    }).join(' ')
    const tagsCases = existingToUpdate.map(v => {
      const tags = videoBrandMap.get(v.youtube_id) || []
      const tagsArr = tags.length > 0
        ? `ARRAY[${tags.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}]`
        : `'{}'::text[]`
      return `WHEN youtube_id = '${v.youtube_id}' THEN ${tagsArr}`
    }).join(' ')
    if (cases) {
      await queryAll(`UPDATE videos SET view_count = CASE ${cases} ELSE view_count END WHERE youtube_id = ANY($1)`, [existingToUpdate.map(v => v.youtube_id)])
    }
  }

  // 7. Batch: Upsert campaign_videos — 1 query
  const cvRows = videos.map(v => ({ campaign_id: campaignId, video_id: existingMap.get(v.youtube_id)! })).filter(r => r.video_id)
  if (cvRows.length > 0) {
    await batchUpsert('campaign_videos', cvRows, 'campaign_id,video_id')
  }

  // 8. Batch: Upsert brand_tags — 1 query
  const btRows: Record<string, any>[] = []
  for (const v of videos) {
    const vid = existingMap.get(v.youtube_id)
    if (!vid) continue
    for (const bName of (videoBrandMap.get(v.youtube_id) || [])) {
      btRows.push({ video_id: vid, brand_name: bName, campaign_id: campaignId })
    }
  }
  if (btRows.length > 0) {
    await batchUpsert('brand_tags', btRows, 'video_id,brand_name,campaign_id')
  }

  // 9. Batch: Upsert keyword_videos + keyword_shorts + view_snapshots — up to 3 queries
  const kvRows: Record<string, any>[] = []
  const ksRows: Record<string, any>[] = []
  const vsRows: Record<string, any>[] = []

  for (let i = 0; i < longForm.length; i++) {
    const v = longForm[i]
    const vid = existingMap.get(v.youtube_id)
    if (!vid) continue
    const rank = Math.max(1, Math.min(10, i + 1))
    kvRows.push({ keyword_id: keywordId, campaign_id: campaignId, video_id: vid, rank, discovered_at: now, last_seen_at: now })
    vsRows.push({ video_id: vid, campaign_id: campaignId, view_count: v.view_count || 0, snapshot_date: today })
  }

  for (let i = 0; i < shortForm.length; i++) {
    const v = shortForm[i]
    const vid = existingMap.get(v.youtube_id)
    if (!vid) continue
    const rank = Math.max(1, Math.min(10, i + 1))
    ksRows.push({ keyword_id: keywordId, campaign_id: campaignId, video_id: vid, rank, discovered_at: now, last_seen_at: now })
    vsRows.push({ video_id: vid, campaign_id: campaignId, view_count: v.view_count || 0, snapshot_date: today })
  }

  // Run all three batch upserts in parallel — 1 HTTP request each
  await Promise.all([
    kvRows.length > 0 ? batchUpsert('keyword_videos', kvRows, 'keyword_id,video_id') : Promise.resolve(),
    ksRows.length > 0 ? batchUpsert('keyword_shorts', ksRows, 'keyword_id,video_id') : Promise.resolve(),
    vsRows.length > 0 ? batchUpsert('view_snapshots', vsRows, 'video_id,campaign_id,snapshot_date') : Promise.resolve(),
  ])

  return { ranked: kvRows.length + ksRows.length, pool_added: cvRows.length }
}

export async function runDailyViewUpdatePg(campaignId?: string): Promise<{
  updated: number
  deleted: number
  quota_cost: number
  batches: number
}> {
  // 1. Get all videos to update — 1 query (batch SELECT)
  const whereClause = campaignId
    ? `WHERE cv.campaign_id = '${campaignId}' AND v.is_deleted = FALSE`
    : `WHERE v.is_deleted = FALSE`

  const rows = await queryAll<{ youtube_id: string; video_id: string; campaign_id: string }>(
    `SELECT v.youtube_id, v.id as video_id, cv.campaign_id
     FROM campaign_videos cv
     INNER JOIN videos v ON v.id = cv.video_id
     ${whereClause}`
  )

  const today = new Date().toISOString().split('T')[0]
  let quotaCost = 0
  let updated = 0
  let deleted = 0
  let batches = 0

  // 2. Batch YouTube API calls in groups of 50 (YouTube max)
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const ids = batch.map(r => r.youtube_id).filter(Boolean)

    if (ids.length === 0) continue

    const stats = await getViewCountsOAuth(ids)
    quotaCost += 1
    batches++

    // 3. Batch UPDATE videos — 1 query per batch
    const viewMap = new Map<string, number>()
    const deletedIds: string[] = []
    for (const stat of stats) {
      if (stat.is_deleted) {
        deletedIds.push(stat.youtube_id)
      } else {
        viewMap.set(stat.youtube_id, stat.view_count)
      }
    }

    // Batch mark deleted videos
    if (deletedIds.length > 0) {
      await queryAll(
        `UPDATE videos SET is_deleted = TRUE WHERE youtube_id = ANY($1)`,
        [deletedIds]
      )
      deleted += deletedIds.length
    }

    // Batch update view counts
    if (viewMap.size > 0) {
      const ids = Array.from(viewMap.keys())
      const cases = ids.map(id =>
        `WHEN youtube_id = '${id}' THEN ${viewMap.get(id)}`
      ).join(' ')
      await queryAll(
        `UPDATE videos SET view_count = CASE ${cases} ELSE view_count END WHERE youtube_id = ANY($1)`,
        [ids]
      )
    }

    // 4. Batch UPSERT view_snapshots — 1 query per batch
    const vsRows = batch
      .filter(r => viewMap.has(r.youtube_id))
      .map(r => ({
        video_id: r.video_id,
        campaign_id: r.campaign_id,
        view_count: viewMap.get(r.youtube_id)!,
        snapshot_date: today,
      }))
    if (vsRows.length > 0) {
      await batchUpsert('view_snapshots', vsRows, 'video_id,campaign_id,snapshot_date')
    }

    updated += viewMap.size
  }

  // 5. Update system metadata — 1 query
  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ('last_views_refresh', '${new Date().toISOString()}', '${new Date().toISOString()}')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
  )

  return { updated, deleted, quota_cost: quotaCost, batches }
}

export async function runWeeklyKeywordRefreshPg(campaignId?: string): Promise<{
  keywords_processed: number
  failed: number
  total_quota: number
}> {
  const whereClause = campaignId
    ? `WHERE status = 'active' AND campaign_id = '${campaignId}'`
    : `WHERE status = 'active'`

  const keywords = await queryAll<{ id: string; text: string; campaign_id: string }>(
    `SELECT id, text, campaign_id FROM keywords ${whereClause} ORDER BY last_scraped_at ASC NULLS FIRST`
  )

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

  const now = new Date().toISOString()
  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ('last_weekly_refresh', '${now}', '${now}')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
  )

  return { keywords_processed: keywords.length - failed, failed, total_quota: totalQuota }
}

export async function runBrandAnalysisPg(campaignId?: string, limit: number = 10): Promise<{
  analyzed: number
  skipped: number
  no_transcript: number
  brands_found: number
}> {
  // 1. Get brand names — 1 query
  const brandNames = campaignId
    ? await queryAll<{ name: string }>(
        `SELECT name FROM campaign_brands WHERE campaign_id = $1`, [campaignId]
      ).then(rows => rows.map(r => r.name))
    : []

  // 2. Get videos to analyze — 1 query
  const whereClause = campaignId
    ? `WHERE v.is_deleted = FALSE AND v.id IN (SELECT video_id FROM campaign_videos WHERE campaign_id = '${campaignId}')`
    : `WHERE v.is_deleted = FALSE`

  const videos = await queryAll<{ id: string; youtube_id: string; title: string }>(
    `SELECT v.id, v.youtube_id, v.title FROM videos v
     ${whereClause}
     AND v.id NOT IN (SELECT video_id FROM brand_analysis)
     ORDER BY v.view_count DESC
     LIMIT ${limit}`
  )

  let analyzed = 0
  let noTranscript = 0
  let brandsFound = 0

  for (const video of videos) {
    try {
      let transcriptText = ''
      let language = 'en'

      // 3. Check for existing transcript — 1 query
      const existingTranscript = await queryOne<{ transcript_text: string; language: string }>(
        `SELECT transcript_text, language FROM video_transcripts WHERE video_id = $1`,
        [video.id]
      )

      if (existingTranscript?.transcript_text) {
        transcriptText = existingTranscript.transcript_text
        language = existingTranscript.language || 'en'
      } else {
        const result = await fetchTranscript(video.youtube_id)
        if (!result) {
          noTranscript++
          continue
        }
        transcriptText = result.text
        language = result.language

        // 4. Save transcript — 1 query
        await queryAll(
          `INSERT INTO video_transcripts (video_id, youtube_id, transcript_text, language, fetch_status)
           VALUES ($1, $2, $3, $4, 'success')
           ON CONFLICT (video_id) DO UPDATE SET transcript_text = EXCLUDED.transcript_text, language = EXCLUDED.language, fetch_status = EXCLUDED.fetch_status`,
          [video.id, video.youtube_id, transcriptText, language]
        )
      }

      const detections = await analyzeBrandsFromTranscript(transcriptText, video.title, brandNames)

      // 5. Batch insert brand analysis — 1 query
      if (detections.length > 0) {
        const baRows = detections.map(d => ({
          video_id: video.id,
          brand_name: d.brand_name,
          confidence: d.confidence,
          mention_type: d.mention_type,
          context_quotes: JSON.stringify(d.context_quotes),
        }))
        await batchUpsert('brand_analysis', baRows, 'video_id,brand_name')
        brandsFound += detections.filter(d => d.confidence >= 0.6).length
      }

      const highConfBrands = detections.filter(d => d.confidence >= 0.6).map(d => d.brand_name)

      if (highConfBrands.length > 0) {
        // 6. Update video tags — 1 query
        const currentVideo = await queryOne<{ tags: any }>(
          `SELECT tags FROM videos WHERE id = $1`, [video.id]
        )
        const currentTags = Array.isArray(currentVideo?.tags) ? currentVideo!.tags : []
        const mergedTags = [...new Set([...currentTags, ...highConfBrands])]
        await queryAll(
          `UPDATE videos SET tags = $1 WHERE id = $2`,
          [JSON.stringify(mergedTags), video.id]
        )

        // 7. Batch upsert brand_tags — 1 query
        if (campaignId) {
          const btRows = highConfBrands.map(brand => ({
            video_id: video.id,
            brand_name: brand,
            campaign_id: campaignId,
          }))
          await batchUpsert('brand_tags', btRows, 'video_id,brand_name,campaign_id')
        }
      }

      analyzed++
      await new Promise(r => setTimeout(r, 4500))
    } catch (err) {
      console.error(`Analysis failed for ${video.youtube_id}:`, err)
    }
  }

  // 8. Update system metadata — 1 query
  const now = new Date().toISOString()
  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ('last_brand_analysis', '${now}', '${now}')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
  )

  return { analyzed, skipped: videos.length - analyzed - noTranscript, no_transcript: noTranscript, brands_found: brandsFound }
}
