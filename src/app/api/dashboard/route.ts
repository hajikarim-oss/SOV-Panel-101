import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'

// Consolidated endpoint: returns overview + keywords + top videos in ONE call
// Eliminates the 3-function cold start waterfall on the overview page
export async function GET(req: NextRequest) {
  try {
    const cid = req.nextUrl.searchParams.get('campaign_id')
    const isOurs = req.nextUrl.searchParams.get('is_ours')
    if (!cid) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const data = await getCached(
      `dashboard:v3:${cid}:${isOurs || 'all'}`,
      () => fetchDashboard(cid!, isOurs),
      CACHE_TTL.overview_kpis
    )
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Dashboard API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchDashboard(cid: string, isOurs?: string | null) {
  const today = new Date().toISOString().split('T')[0]
  const d1 = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  // ── Phase 1: All lightweight queries in parallel ──
  const [kwRes, cvRes, kvRes, ksRes, btRes, cbRes, vsTodayRes, vs1dRes, vs7dRes, vs30dRes, sjRes, cvNewRes] = await Promise.all([
    supabase.from('keywords').select('id, text, language, category, type').eq('campaign_id', cid).eq('status', 'active'),
    supabase.from('campaign_videos').select('video_id').eq('campaign_id', cid),
    supabase.from('keyword_videos').select('video_id, rank, keyword_id').eq('campaign_id', cid),
    supabase.from('keyword_shorts').select('video_id, rank, keyword_id').eq('campaign_id', cid),
    supabase.from('brand_tags').select('brand_name, video_id').eq('campaign_id', cid),
    supabase.from('campaign_brands').select('name').eq('campaign_id', cid),
    supabase.from('view_snapshots').select('view_count').eq('snapshot_date', today).eq('campaign_id', cid),
    supabase.from('view_snapshots').select('view_count').eq('snapshot_date', d1).eq('campaign_id', cid),
    supabase.from('view_snapshots').select('view_count').eq('snapshot_date', d7).eq('campaign_id', cid),
    supabase.from('view_snapshots').select('view_count').eq('snapshot_date', d30).eq('campaign_id', cid),
    supabase.from('scrape_jobs').select('id').in('status', ['running', 'pending']).limit(100),
    supabase.from('campaign_videos').select('video_id').eq('campaign_id', cid).gte('first_seen_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ])

  let lastViews: any = null
  let lastRanking: any = null
  try {
    const [lv, lr] = await Promise.all([
      supabase.from('system_metadata').select('value, updated_at').eq('key', 'last_views_refresh').single(),
      supabase.from('system_metadata').select('value, updated_at').eq('key', 'last_ranking_refresh').single(),
    ])
    lastViews = lv.data
    lastRanking = lr.data
  } catch {}

  const keywords = (kwRes.data || [])
  const totalKeywords = keywords.length
  const allCvVideoIds = [...new Set((cvRes.data || []).map((r: any) => r.video_id))]
  const totalVideos = allCvVideoIds.length
  const rankedVideos = (kvRes.data || []).length + (ksRes.data || []).length
  const brandTags = (btRes.data || [])
  const newVidsLast7Days = (cvNewRes.data || []).length

  const sumRows = (rows: any[] | null) => (rows || []).reduce((s: number, r: any) => s + (r.view_count || 0), 0)
  const vsToday = sumRows(vsTodayRes.data)
  const vs1d = sumRows(vs1dRes.data)
  const vs7d = sumRows(vs7dRes.data)
  const vs30d = sumRows(vs30dRes.data)

  const taggedIds = new Set(brandTags.map((bt: any) => bt.video_id))
  const untaggedVideos = allCvVideoIds.filter(id => !taggedIds.has(id)).length

  // ── Phase 2: Heavy video query in batches ──
  const BATCH = 500
  const videoBatchPromises = []
  for (let i = 0; i < allCvVideoIds.length; i += BATCH) {
    videoBatchPromises.push(
      supabase.from('videos').select('id, view_count, channel_name, tags, title, thumbnail_url, youtube_id, channel_id, is_ours').in('id', allCvVideoIds.slice(i, i + BATCH))
    )
  }
  const videoBatchResults = await Promise.all(videoBatchPromises)
  const videoRows: any[] = []
  for (const result of videoBatchResults) {
    videoRows.push(...(result.data || []))
  }

  // Build a map for quick video lookup
  const videoMap = new Map<string, any>()
  for (const v of videoRows) {
    videoMap.set(v.id, v)
  }

  // Total Viewership: top 10 ranked videos per keyword (deduplicated)
  const top10VideoIdsPerKw = new Set<string>()
  const kvByKw = new Map<string, typeof kvRes.data extends (infer T)[] | null ? T[] : never>()
  const ksByKw = new Map<string, typeof ksRes.data extends (infer T)[] | null ? T[] : never>()
  for (const kv of (kvRes.data || [])) {
    if (!kvByKw.has(kv.keyword_id)) kvByKw.set(kv.keyword_id, [])
    kvByKw.get(kv.keyword_id)!.push(kv)
  }
  for (const ks of (ksRes.data || [])) {
    if (!ksByKw.has(ks.keyword_id)) ksByKw.set(ks.keyword_id, [])
    ksByKw.get(ks.keyword_id)!.push(ks)
  }
  for (const kw of keywords) {
    const kvs = (kvByKw.get(kw.id) || []).sort((a: any, b: any) => a.rank - b.rank).slice(0, 10)
    const kss = (ksByKw.get(kw.id) || []).sort((a: any, b: any) => a.rank - b.rank).slice(0, 10)
    for (const kv of kvs) top10VideoIdsPerKw.add(kv.video_id)
    for (const ks of kss) top10VideoIdsPerKw.add(ks.video_id)
  }

  let totalViewership = 0
  const channelFreq = new Map<string, number>()
  for (const v of videoRows) {
    if (v.channel_name) channelFreq.set(v.channel_name, (channelFreq.get(v.channel_name) || 0) + 1)
  }

  // Build keyword_id → language map for regional SOV
  const kwLangMap = new Map<string, string>()
  for (const kw of keywords) { kwLangMap.set(kw.id, kw.language || 'en') }

  // Pre-build video_id → Set<language> from keyword_videos + keyword_shorts
  const videoLangMap = new Map<string, Set<string>>()
  for (const kv of (kvRes.data || [])) {
    const lang = kwLangMap.get(kv.keyword_id)
    if (lang) {
      if (!videoLangMap.has(kv.video_id)) videoLangMap.set(kv.video_id, new Set())
      videoLangMap.get(kv.video_id)!.add(lang)
    }
  }
  for (const ks of (ksRes.data || [])) {
    const lang = kwLangMap.get(ks.keyword_id)
    if (lang) {
      if (!videoLangMap.has(ks.video_id)) videoLangMap.set(ks.video_id, new Set())
      videoLangMap.get(ks.video_id)!.add(lang)
    }
  }

  // Track per-language views from top-10-per-keyword videos only
  const langViewsMap = new Map<string, number>()
  const langVideoCountMap = new Map<string, number>()

  for (const vid of top10VideoIdsPerKw) {
    const v = videoMap.get(vid)
    if (v) totalViewership += v.view_count || 0

    const vidLangs = videoLangMap.get(vid)
    if (vidLangs) {
      for (const lang of vidLangs) {
        langViewsMap.set(lang, (langViewsMap.get(lang) || 0) + (v.view_count || 0))
        langVideoCountMap.set(lang, (langVideoCountMap.get(lang) || 0) + 1)
      }
    }
  }

  // Compute "our videos" stats before filtering
  const ourVideoRows = videoRows.filter(v => v.is_ours)
  const ourVideoCount = ourVideoRows.length
  const ourVideoViews = ourVideoRows.reduce((s, v) => s + (v.view_count || 0), 0)

  const uniqueChannels = channelFreq.size

  let topChannel = null
  let maxFreq = 0
  for (const [ch, freq] of channelFreq) {
    if (freq > maxFreq) { maxFreq = freq; topChannel = ch }
  }

  const brandStatsMap = new Map<string, { brand_views: number; video_count: number }>()
  for (const bt of brandTags) {
    if (!brandStatsMap.has(bt.brand_name)) brandStatsMap.set(bt.brand_name, { brand_views: 0, video_count: 0 })
    const m = brandStatsMap.get(bt.brand_name)!
    m.brand_views += videoMap.get(bt.video_id)?.view_count || 0
    m.video_count++
  }
  const brandStats = Array.from(brandStatsMap.entries())
    .map(([brand_name, m]) => ({ brand_name, ...m }))
    .sort((a: any, b: any) => b.brand_views - a.brand_views)

  const totalBrandViews = brandStats.reduce((sum: number, b: any) => sum + (b.brand_views || 0), 0) || 1
  const top5ByViewership = brandStats.slice(0, 5).map((b: any) => ({
    brand_name: b.brand_name,
    brand_total_views: b.brand_views || 0,
    sov_percent: Math.round(((b.brand_views || 0) / totalBrandViews) * 1000) / 10,
    video_count: b.video_count || 0,
  }))
  const totalBrandMentions = brandStats.reduce((sum: number, b: any) => sum + (b.video_count || 0), 0) || 1
  const top5ByFrequency = brandStats.slice(0, 5).map((b: any) => ({
    brand_name: b.brand_name,
    brand_total_freq: b.video_count || 0,
    freq_sov_percent: Math.round(((b.video_count || 0) / totalBrandMentions) * 1000) / 10,
    video_count: b.video_count || 0,
  }))

  let transcriptCoverage = 0
  try {
    const { data: transcriptData } = await supabase.from('video_transcripts').select('video_id').eq('fetch_status', 'success')
    transcriptCoverage = totalVideos > 0 ? Math.round(((transcriptData?.length || 0) / totalVideos) * 100) : 0
  } catch {}

  const [dailyViews, dailyNewVideos, dailyKeywords] = await Promise.all([
    getDailyData('view_snapshots', 'snapshot_date', 'view_count', cid, 'SUM'),
    getDailyData('campaign_videos', 'first_seen_at', 'video_id', cid, 'COUNT'),
    getDailyData('keywords', 'created_at', 'id', cid, 'COUNT'),
  ])

  // ── Top 200 videos for leaderboard (sorted by views) ──
  // Build video→keywords mapping for regional language detection
  const kwTextMap = new Map<string, string>()
  for (const kw of keywords) { kwTextMap.set(kw.id, kw.text) }
  const videoKeywordsMap = new Map<string, string[]>()
  for (const kv of (kvRes.data || [])) {
    const kwText = kwTextMap.get(kv.keyword_id)
    if (kwText) {
      if (!videoKeywordsMap.has(kv.video_id)) videoKeywordsMap.set(kv.video_id, [])
      videoKeywordsMap.get(kv.video_id)!.push(kwText)
    }
  }
  for (const ks of (ksRes.data || [])) {
    const kwText = kwTextMap.get(ks.keyword_id)
    if (kwText) {
      if (!videoKeywordsMap.has(ks.video_id)) videoKeywordsMap.set(ks.video_id, [])
      const arr = videoKeywordsMap.get(ks.video_id)!
      if (!arr.includes(kwText)) arr.push(kwText)
    }
  }

  const topVideos = videoRows
    .sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 200)
    .map((v: any) => {
      const tags = (brandTags || []).filter((bt: any) => bt.video_id === v.id).map((bt: any) => bt.brand_name)
      const kv = (kvRes.data || []).find((k: any) => k.video_id === v.id)
      const ks = (ksRes.data || []).find((k: any) => k.video_id === v.id)
      return {
        ...v,
        tags,
        keywords_appeared: videoKeywordsMap.get(v.id) || [],
        rank: kv?.rank ?? ks?.rank ?? null,
        keyword_id: kv?.keyword_id ?? ks?.keyword_id ?? null,
      }
    })

  // ── Enriched keywords with counts ──
  const enrichedKeywords = keywords.map((kw: any) => {
    const kvCount = (kvRes.data || []).filter((k: any) => k.keyword_id === kw.id).length
    const ksCount = (ksRes.data || []).filter((k: any) => k.keyword_id === kw.id).length
    return {
      ...kw,
      long_form_count: kvCount,
      short_form_count: ksCount,
    }
  })

  return {
    overview: {
      lastUpdatedViews: lastViews,
      lastUpdatedRanking: lastRanking,
      totalKeywords,
      totalVideos,
      rankedVideos,
      totalViewership,
      uniqueVideos: videoRows.length,
      uniqueVideoViewership: totalViewership,
      uniqueChannels,
      mostRankingChannel: topChannel ? { name: topChannel, totalFrequency: maxFreq } : null,
      newVideosLast7Days: newVidsLast7Days,
      untaggedVideos,
      top5ByViewership,
      top5ByFrequency,
      growth: {
        h24: pctChange(vsToday, vs1d),
        d7: pctChange(vsToday, vs7d),
        d30: pctChange(vsToday, vs30d),
      },
      activeScrapingJobs: (sjRes.data || []).length,
      transcriptCoverage,
      dailyViews,
      dailyNewVideos,
      dailyKeywordsAdded: dailyKeywords,
      ourVideos: { count: ourVideoCount, views: ourVideoViews },
    },
    keywords: enrichedKeywords,
    topVideos,
    campaignBrands: (cbRes.data || []).map((b: any) => b.name),
    regionalStats: Object.fromEntries(langViewsMap.entries()),
    regionalVideoCounts: Object.fromEntries(langVideoCountMap.entries()),
  }
}

async function getDailyData(
  table: string,
  dateCol: string,
  valueCol: string,
  campaignId: string | null,
  agg: 'SUM' | 'COUNT'
): Promise<{ date: string; views?: number; count?: number }[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  let q = supabase.from(table).select(`${dateCol}, ${valueCol}`)
  if (campaignId) q = q.eq('campaign_id', campaignId)
  q = q.gte(dateCol, thirtyDaysAgo).order(dateCol, { ascending: true })
  const { data } = await q
  if (!data || data.length === 0) return []

  const grouped = new Map<string, number[]>()
  for (const row of data as any[]) {
    const rawDate = row[dateCol]
    const dateStr = typeof rawDate === 'string' ? rawDate.split('T')[0] : String(rawDate)
    if (!grouped.has(dateStr)) grouped.set(dateStr, [])
    grouped.get(dateStr)!.push(agg === 'COUNT' ? 1 : (row[valueCol] || 0))
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, vals]) => ({
      date,
      ...(agg === 'SUM' ? { views: vals.reduce((s, v) => s + v, 0) } : { count: vals.length }),
    }))
}

function pctChange(now: number, prev: number) {
  return prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : 0
}
