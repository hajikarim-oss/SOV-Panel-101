import { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverviewData {
  lastUpdatedViews: string | null
  lastUpdatedRanking: string | null
  totalKeywords: number
  totalVideos: number
  totalViewership: number
  uniqueVideos: number
  uniqueVideoViewership: number
  uniqueChannels: number
  mostRankingChannel: { name: string; totalFrequency: number } | null
  newVideosLast7Days: number
  untaggedVideos: number
  top5ByViewership: Array<{ brand_name: string; brand_total_views: number; sov_percent: number; video_count: number }>
  top5ByFrequency: Array<{ brand_name: string; brand_total_freq: number; freq_sov_percent: number; video_count: number }>
  growth: { h24: number; d7: number; d30: number }
  activeScrapingJobs: number
  transcriptCoverage: number
}


export interface BrandStat {
  brand_name: string
  brand_total_views: number
  brand_total_freq: number
  sov_percent: number
  freq_sov_percent: number
  video_count: number
}

export interface VideoLeaderboardItem {
  id: string
  youtube_id: string
  title: string
  channel_name: string
  tags: string[]
  view_count: number
  search_appearance_count: number
  discovered_at: string
  thumbnail_url: string | null
  is_our_video: boolean
  is_new: boolean
  sparkline: number[]
}

export interface BrandGrowthItem {
  brand_name: string
  currentValue: number
  previousValue: number
  growthPercent: number
  rankMovement: number
  sparklineData: number[]
}

export interface SovTrendPoint {
  date: string
  [brand: string]: number | string
}

export interface DroppedVideo {
  youtube_id: string
  title: string
  channel_name: string
  tags: string[]
  keywords_appeared: string[]
  last_seen_at: string
  last_rank: number
  drop_reason: 'deleted' | 'pushed_out'
}

export interface MultiKeywordVideo {
  youtube_id: string
  title: string
  description: string | null
  channel_name: string
  tags: string[]
  keyword_count: number
  keywords_appeared: string[]
  search_appearance_count: number
  view_count: number
  extracted_phrases: string[] | null
}

// ── Helper: Parse ISO 8601 duration ──────────────────────────────────────────
export function parseDurationSeconds(duration: string | null): number {
  if (!duration) return 0
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0')
  const m = parseInt(match[2] ?? '0')
  const s = parseInt(match[3] ?? '0')
  return h * 3600 + m * 60 + s
}

export function isShortVideo(duration: string | null): boolean {
  return parseDurationSeconds(duration) < 240
}

// ── Overview (Page 1) ─────────────────────────────────────────────────────────
export async function getOverviewData(
  db: SupabaseClient,
  campaignId: string
): Promise<OverviewData> {
  const [
    metadataRes,
    keywordsRes,
    videosRes,
    channelRes,
    newVideosRes,
    untaggedRes,
    top5ViewsRes,
    top5FreqRes,
    growthRes,
    scrapeJobsRes,
  ] = await Promise.all([
    // Last updated timestamps
    db.from('system_metadata').select('key, value').in('key', ['last_views_refresh', 'last_ranking_refresh']),

    // Total keywords
    db.from('keywords').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),

    // Total & unique videos + viewership
    db.rpc('get_video_stats', { p_campaign_id: campaignId }),

    // Most ranking channel from materialized view
    db.from('channel_rank_mv').select('*').eq('campaign_id', campaignId).order('total_frequency', { ascending: false }).limit(1),

    // New videos in last 7 days
    db.from('keyword_videos')
      .select('video_id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .gte('discovered_at', new Date(Date.now() - 7 * 86400000).toISOString()),

    // Untagged videos (no brand tags assigned)
    db.from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .or(`tags.eq.{},tags.is.null`),

    // Top 5 brands by viewership
    db.from('brand_sov_mv')
      .select('brand_name, brand_total_views, sov_percent, video_count')
      .eq('campaign_id', campaignId)
      .order('brand_total_views', { ascending: false })
      .limit(5),

    // Top 5 brands by frequency
    db.from('brand_freq_sov_mv')
      .select('brand_name, brand_total_freq, freq_sov_percent, video_count')
      .eq('campaign_id', campaignId)
      .order('brand_total_freq', { ascending: false })
      .limit(5),

    // Growth rates (computed via DB function)
    db.rpc('get_growth_rates', { p_campaign_id: campaignId }),

    // Active scrape jobs
    db.from('scrape_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'running'),
  ])

  const metadata: Record<string, string | null> = {}
  metadataRes.data?.forEach((m: { key: string; value: string | null }) => { metadata[m.key] = m.value })

  const stats = videosRes.data?.[0] ?? {}

  return {
    lastUpdatedViews: metadata['last_views_refresh'] ?? null,
    lastUpdatedRanking: metadata['last_ranking_refresh'] ?? null,
    totalKeywords: keywordsRes.count ?? 0,
    totalVideos: stats.total_videos ?? 0,
    totalViewership: stats.total_views ?? 0,
    uniqueVideos: stats.unique_videos ?? 0,
    uniqueVideoViewership: stats.unique_views ?? 0,
    uniqueChannels: stats.unique_channels ?? 0,
    mostRankingChannel: channelRes.data?.[0]
      ? { name: channelRes.data[0].channel_name, totalFrequency: channelRes.data[0].total_frequency }
      : null,
    newVideosLast7Days: newVideosRes.count ?? 0,
    untaggedVideos: untaggedRes.count ?? 0,
    top5ByViewership: top5ViewsRes.data ?? [],
    top5ByFrequency: top5FreqRes.data ?? [],
    growth: growthRes.data?.[0] ?? { h24: 0, d7: 0, d30: 0 },
    activeScrapingJobs: scrapeJobsRes.count ?? 0,
    transcriptCoverage: stats.transcript_coverage ?? 0,
  }
}

// ── Video Leaderboard (Page 2) ────────────────────────────────────────────────
export async function getVideoLeaderboard(
  db: SupabaseClient,
  campaignId: string,
  sort: 'views' | 'frequency',
  page: number,
  limit: number
): Promise<{ data: VideoLeaderboardItem[]; total: number }> {
  const offset = (page - 1) * limit
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const orderColumn = sort === 'views' ? 'view_count' : 'search_appearance_count'

  const { data, error, count } = await db
    .from('keyword_videos')
    .select(`
      video_id,
      search_appearance_count,
      discovered_at,
      is_our_video,
      videos!inner (
        id, youtube_id, title, channel_name, tags, thumbnail_url, is_deleted
      )
    `, { count: 'exact' })
    .eq('campaign_id', campaignId)
    .eq('videos.is_deleted', false)
    .order(orderColumn, { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  // Enrich with latest view counts and sparklines
  const videoIds = (data ?? []).map((r: { video_id: string }) => r.video_id)

  const [latestViews, sparklines] = await Promise.all([
    db.from('view_snapshots')
      .select('video_id, view_count')
      .in('video_id', videoIds)
      .order('snapshot_date', { ascending: false }),

    db.rpc('get_sparklines', { p_video_ids: videoIds, p_days: 7 }),
  ])

  const viewMap = new Map<string, number>()
  latestViews.data?.forEach((v: { video_id: string; view_count: number }) => {
    if (!viewMap.has(v.video_id)) viewMap.set(v.video_id, v.view_count)
  })

  const sparklineMap = new Map<string, number[]>()
  sparklines.data?.forEach((s: { video_id: string; views: number[] }) => {
    sparklineMap.set(s.video_id, s.views)
  })

  const items: VideoLeaderboardItem[] = (data ?? []).map((row: any) => {
    const video = Array.isArray(row.videos) ? row.videos[0] : row.videos
    return {
      id: row.video_id,
      youtube_id: video?.youtube_id,
      title: video?.title,
      channel_name: video?.channel_name,
      tags: video?.tags ?? [],
      view_count: viewMap.get(row.video_id) ?? 0,
      search_appearance_count: row.search_appearance_count,
      discovered_at: row.discovered_at,
      thumbnail_url: video?.thumbnail_url,
      is_our_video: row.is_our_video,
      is_new: new Date(row.discovered_at) > new Date(sevenDaysAgo),
      sparkline: sparklineMap.get(row.video_id) ?? [],
    }
  })

  return { data: items, total: count ?? 0 }
}

// ── Brand Growth (Page 3) ─────────────────────────────────────────────────────
export async function getBrandGrowth(
  db: SupabaseClient,
  campaignId: string,
  metric: 'views' | 'frequency',
  period: '24h' | '7d' | '30d'
): Promise<BrandGrowthItem[]> {
  const { data, error } = await db.rpc('get_brand_growth', {
    p_campaign_id: campaignId,
    p_metric: metric,
    p_period: period,
  })
  if (error) throw error
  return data ?? []
}

// ── SOV Trend (Page 4) ────────────────────────────────────────────────────────
export async function getSovTrend(
  db: SupabaseClient,
  campaignId: string,
  brands: string[],
  range: 'daily' | 'monthly' | '3m' | '6m' | '1y',
  metricType: 'views' | 'frequency' = 'views'
): Promise<SovTrendPoint[]> {
  const daysMap = { daily: 7, monthly: 30, '3m': 90, '6m': 180, '1y': 365 }
  const days = daysMap[range]
  const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

  const { data, error } = await db
    .from('sov_snapshots')
    .select('brand_name, snapshot_date, sov_percent')
    .eq('campaign_id', campaignId)
    .eq('metric_type', metricType)
    .in('brand_name', brands)
    .gte('snapshot_date', fromDate)
    .order('snapshot_date', { ascending: true })

  if (error) throw error

  // Pivot: date → {brand: sov_percent}
  const pivotMap = new Map<string, SovTrendPoint>()
  ;(data ?? []).forEach((row: { brand_name: string; snapshot_date: string; sov_percent: number }) => {
    if (!pivotMap.has(row.snapshot_date)) {
      pivotMap.set(row.snapshot_date, { date: row.snapshot_date })
    }
    pivotMap.get(row.snapshot_date)![row.brand_name] = row.sov_percent
  })

  return Array.from(pivotMap.values())
}

// ── Keyword-wise SOV (Page 5) ─────────────────────────────────────────────────
export async function getKeywordsSov(
  db: SupabaseClient,
  campaignId: string,
  language: string,
  type: string
) {
  let query = db.from('keywords').select(`
    id, text, category, language,
    keyword_videos (
      video_id,
      search_appearance_count,
      videos (tags)
    )
  `).eq('campaign_id', campaignId)

  if (language !== 'all') query = query.eq('language', language)
  if (type !== 'all') query = query.eq('category', type)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ── All Brands Overview (Page 6) ──────────────────────────────────────────────
export async function getBrandsOverview(
  db: SupabaseClient,
  campaignId: string
) {
  const [viewsRes, freqRes] = await Promise.all([
    db.from('brand_sov_mv')
      .select('brand_name, brand_total_views, sov_percent, video_count')
      .eq('campaign_id', campaignId)
      .order('brand_total_views', { ascending: false }),

    db.from('brand_freq_sov_mv')
      .select('brand_name, brand_total_freq, freq_sov_percent, video_count')
      .eq('campaign_id', campaignId)
      .order('brand_total_freq', { ascending: false }),
  ])

  return {
    byViews: viewsRes.data ?? [],
    byFrequency: freqRes.data ?? [],
  }
}

// ── Brand Detail (Page 7) ─────────────────────────────────────────────────────
export async function getBrandDetail(
  db: SupabaseClient,
  campaignId: string,
  brandName: string
) {
  const { data: videos, error } = await db
    .from('keyword_videos')
    .select(`
      video_id, search_appearance_count, keywords_appeared, is_our_video,
      videos!inner (
        youtube_id, title, channel_name, tags, published_at, duration, thumbnail_url
      )
    `)
    .eq('campaign_id', campaignId)
    .contains('videos.tags', [brandName])

  if (error) throw error

  const videoIds = (videos ?? []).map((v: { video_id: string }) => v.video_id)

  const [latestViews, brandMentions, growth] = await Promise.all([
    db.from('view_snapshots')
      .select('video_id, view_count')
      .in('video_id', videoIds)
      .order('snapshot_date', { ascending: false }),

    db.from('brand_mentions')
      .select('video_id, mention_count, mention_context')
      .in('video_id', videoIds)
      .eq('brand_name', brandName)
      .order('mention_count', { ascending: false })
      .limit(10),

    db.rpc('get_brand_growth_detail', {
      p_campaign_id: campaignId,
      p_brand_name: brandName,
    }),
  ])

  const viewMap = new Map<string, number>()
  latestViews.data?.forEach((v: { video_id: string; view_count: number }) => {
    if (!viewMap.has(v.video_id)) viewMap.set(v.video_id, v.view_count)
  })

  const totalViews = Array.from(viewMap.values()).reduce((a, b) => a + b, 0)
  const uniqueChannels = new Set(
    (videos ?? []).map((v: any) => {
      const video = Array.isArray(v.videos) ? v.videos[0] : v.videos
      return video?.channel_name
    }).filter(Boolean)
  ).size

  return {
    totalVideos: videos?.length ?? 0,
    uniqueChannels,
    totalViewership: totalViews,
    growth: growth.data?.[0] ?? {},
    topVideos: (videos ?? [])
      .sort((a: { video_id: string }, b: { video_id: string }) => (viewMap.get(b.video_id) ?? 0) - (viewMap.get(a.video_id) ?? 0))
      .slice(0, 10),
    brandMentions: brandMentions.data ?? [],
  }
}

// ── Dropped Rankings (Page 8) ─────────────────────────────────────────────────
export async function getDroppedRankings(
  db: SupabaseClient,
  campaignId: string,
  lookbackDays: number = 7
): Promise<DroppedVideo[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString()
  const windowStart = new Date(Date.now() - lookbackDays * 2 * 86400000).toISOString()

  const { data, error } = await db
    .from('keyword_videos')
    .select(`
      video_id, keywords_appeared, cross_keyword_ranks, last_seen_at,
      videos!inner (
        youtube_id, title, channel_name, tags, is_deleted
      )
    `)
    .eq('campaign_id', campaignId)
    .lt('last_seen_at', cutoff)
    .gte('last_seen_at', windowStart)

  if (error) throw error

  return (data ?? []).map((row: any) => {
    const video = Array.isArray(row.videos) ? row.videos[0] : row.videos
    return {
      youtube_id: video?.youtube_id,
      title: video?.title,
      channel_name: video?.channel_name,
      tags: video?.tags ?? [],
      keywords_appeared: row.keywords_appeared ?? [],
      last_seen_at: row.last_seen_at,
      last_rank: Math.min(...(row.cross_keyword_ranks ?? [999])),
      drop_reason: video?.is_deleted ? 'deleted' : 'pushed_out',
    }
  })
}

// ── Multi-keyword Videos (Page 9) ─────────────────────────────────────────────
export async function getMultiKeywordVideos(
  db: SupabaseClient,
  campaignId: string,
  minKeywords: number
): Promise<MultiKeywordVideo[]> {
  const { data, error } = await db
    .from('keyword_videos')
    .select(`
      video_id, keyword_count, keywords_appeared, search_appearance_count,
      videos!inner (
        youtube_id, title, description, channel_name, tags
      ),
      video_phrase_summary (extracted_phrases)
    `)
    .eq('campaign_id', campaignId)
    .gte('keyword_count', minKeywords)
    .order('keyword_count', { ascending: false })
    .limit(200)

  if (error) throw error

  const videoIds = (data ?? []).map((r: { video_id: string }) => r.video_id)
  const latestViews = await db
    .from('view_snapshots')
    .select('video_id, view_count')
    .in('video_id', videoIds)
    .order('snapshot_date', { ascending: false })

  const viewMap = new Map<string, number>()
  latestViews.data?.forEach((v: { video_id: string; view_count: number }) => {
    if (!viewMap.has(v.video_id)) viewMap.set(v.video_id, v.view_count)
  })

  return (data ?? []).map((row: any) => {
    const video = Array.isArray(row.videos) ? row.videos[0] : row.videos
    return {
      youtube_id: video?.youtube_id,
      title: video?.title,
      description: video?.description,
      channel_name: video?.channel_name,
      tags: video?.tags ?? [],
      keyword_count: row.keyword_count ?? 0,
      keywords_appeared: row.keywords_appeared ?? [],
      search_appearance_count: row.search_appearance_count,
      view_count: viewMap.get(row.video_id) ?? 0,
      extracted_phrases: row.video_phrase_summary?.extracted_phrases ?? null,
    }
  })
}

// ── System Metadata ───────────────────────────────────────────────────────────
export async function getSystemMetadata(db: SupabaseClient) {
  const { data } = await db.from('system_metadata').select('key, value, updated_at')
  const map: Record<string, string | null> = {}
  data?.forEach((m: { key: string; value: string | null }) => { map[m.key] = m.value })
  return map
}
