import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const cid = campaignId || null

    let lastViews: any = null
    let lastRanking: any = null
    try {
      const { data: lv } = await supabase.from('system_metadata').select('value, updated_at').eq('key', 'last_views_refresh').single()
      lastViews = lv
      const { data: lr } = await supabase.from('system_metadata').select('value, updated_at').eq('key', 'last_ranking_refresh').single()
      lastRanking = lr
    } catch {}

    let kwQuery = supabase.from('keywords').select('id', { count: 'exact', head: true }).eq('status', 'active')
    if (cid) kwQuery = kwQuery.eq('campaign_id', cid)
    const { count: kwCountVal } = await kwQuery

    let cvQuery = supabase.from('campaign_videos').select('video_id', { count: 'exact', head: true })
    if (cid) cvQuery = cvQuery.eq('campaign_id', cid)
    const { count: totalVideoPoolVal } = await cvQuery
    const totalVideos = totalVideoPoolVal || 0

    let kvQuery = supabase.from('keyword_videos').select('id', { count: 'exact', head: true })
    if (cid) kvQuery = kvQuery.eq('campaign_id', cid)
    const { count: kvCountVal } = await kvQuery

    let ksQuery = supabase.from('keyword_shorts').select('id', { count: 'exact', head: true })
    if (cid) ksQuery = ksQuery.eq('campaign_id', cid)
    const { count: ksCountVal } = await ksQuery

    const rankedVideos = (kvCountVal || 0) + (ksCountVal || 0)

    const today = new Date().toISOString().split('T')[0]
    const d1 = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    async function sumViews(dateStr: string): Promise<number> {
      let q = supabase.from('view_snapshots').select('view_count').eq('snapshot_date', dateStr)
      if (cid) q = q.eq('campaign_id', cid)
      const { data } = await q
      return (data || []).reduce((sum: number, r: any) => sum + (r.view_count || 0), 0)
    }

    const [vsToday, vs1d, vs7d, vs30d] = await Promise.all([sumViews(today), sumViews(d1), sumViews(d7), sumViews(d30)])

    let cvForStats = supabase.from('campaign_videos').select('video_id')
    if (cid) cvForStats = cvForStats.eq('campaign_id', cid)
    const { data: cvStatsRows } = await cvForStats
    const allVideoIds = [...new Set((cvStatsRows || []).map((r: any) => r.video_id))]

    let unique_count = 0
    let total_viewership = 0
    let unique_channels = 0

    if (allVideoIds.length > 0) {
      const BATCH = 500
      const videoRows: any[] = []
      for (let i = 0; i < allVideoIds.length; i += BATCH) {
        const batch = allVideoIds.slice(i, i + BATCH)
        const { data } = await supabase.from('videos').select('id, view_count, channel_name').in('id', batch)
        videoRows.push(...(data || []))
      }
      const uniqueChannels = new Set<string>()
      videoRows.forEach((v: any) => {
        total_viewership += v.view_count || 0
        if (v.channel_name) uniqueChannels.add(v.channel_name)
      })
      unique_count = videoRows.length
      unique_channels = uniqueChannels.size
    }

    const vs = { unique_count, total_viewership, unique_channels }

    let topChannels: any = null
    if (allVideoIds.length > 0) {
      const BATCH = 500
      const channelFreq = new Map<string, number>()
      for (let i = 0; i < allVideoIds.length; i += BATCH) {
        const batch = allVideoIds.slice(i, i + BATCH)
        const { data } = await supabase.from('videos').select('channel_name').in('id', batch)
        for (const v of (data || []) as any[]) {
          if (v.channel_name) channelFreq.set(v.channel_name, (channelFreq.get(v.channel_name) || 0) + 1)
        }
      }
      let maxFreq = 0
      let maxChannel = ''
      for (const [ch, freq] of channelFreq) {
        if (freq > maxFreq) { maxFreq = freq; maxChannel = ch }
      }
      if (maxChannel) topChannels = [{ channel_name: maxChannel, freq: maxFreq }]
    }

    let newVidQuery = supabase.from('campaign_videos').select('video_id', { count: 'exact', head: true })
    if (cid) newVidQuery = newVidQuery.eq('campaign_id', cid)
    newVidQuery = newVidQuery.gte('first_seen_at', new Date(Date.now() - 7 * 86400000).toISOString())
    const { count: newVidsVal } = await newVidQuery

    let untaggedVal = 0
    if (cid) {
      let cvForTagging = supabase.from('campaign_videos').select('video_id').eq('campaign_id', cid)
      const { data: cvTagRows } = await cvForTagging
      const allCvVideoIds = (cvTagRows || []).map((r: any) => r.video_id)

      if (allCvVideoIds.length > 0) {
        const BATCH = 500
        const taggedIds = new Set<string>()
        for (let i = 0; i < allCvVideoIds.length; i += BATCH) {
          const batch = allCvVideoIds.slice(i, i + BATCH)
          const { data: btRows } = await supabase.from('brand_tags').select('video_id').in('video_id', batch).eq('campaign_id', cid)
          for (const bt of (btRows || []) as any[]) taggedIds.add(bt.video_id)
        }
        untaggedVal = allCvVideoIds.length - taggedIds.size
      }
    } else {
      let untaggedQuery = supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_deleted', false).or('tags.is.null,tags.eq.{}')
      const { count: uv } = await untaggedQuery
      untaggedVal = uv || 0
    }

    let btQuery = supabase.from('brand_tags').select('brand_name, video_id')
    if (cid) btQuery = btQuery.eq('campaign_id', cid)
    const { data: brandTags } = await btQuery

    const brandVideoIds = [...new Set((brandTags || []).map((bt: any) => bt.video_id))]
    const brandVideoMap = new Map<string, { view_count: number }>()
    if (brandVideoIds.length > 0) {
      const BATCH = 500
      for (let i = 0; i < brandVideoIds.length; i += BATCH) {
        const batch = brandVideoIds.slice(i, i + BATCH)
        const { data } = await supabase.from('videos').select('id, view_count').in('id', batch)
        for (const v of (data || []) as any[]) brandVideoMap.set(v.id, v)
      }
    }

    const brandStatsMap = new Map<string, { brand_views: number; video_count: number }>()
    for (const bt of (brandTags || []) as any[]) {
      if (!brandStatsMap.has(bt.brand_name)) brandStatsMap.set(bt.brand_name, { brand_views: 0, video_count: 0 })
      const m = brandStatsMap.get(bt.brand_name)!
      m.brand_views += brandVideoMap.get(bt.video_id)?.view_count || 0
      m.video_count++
    }
    const brandStats = Array.from(brandStatsMap.entries())
      .map(([brand_name, m]) => ({ brand_name, ...m }))
      .sort((a: any, b: any) => b.brand_views - a.brand_views)

    const totalBrandViews = brandStats.reduce((sum: number, b: any) => sum + (b.brand_views || 0), 0) || 1
    const top5ByViewership = brandStats.slice(0, 5).map((b: any) => ({
      brand_name: b.brand_name,
      brand_total_views: b.brand_views || 0,
      sov_percent: totalBrandViews > 0 ? Math.round(((b.brand_views || 0) / totalBrandViews) * 1000) / 10 : 0,
      video_count: b.video_count || 0,
    }))

    const totalBrandMentions = brandStats.reduce((sum: number, b: any) => sum + (b.video_count || 0), 0) || 1
    const top5ByFrequency = brandStats.slice(0, 5).map((b: any) => ({
      brand_name: b.brand_name,
      brand_total_freq: b.video_count || 0,
      freq_sov_percent: Math.round(((b.video_count || 0) / totalBrandMentions) * 1000) / 10,
      video_count: b.video_count || 0,
    }))

    const totalVidsVal = allVideoIds.length
    let transcriptsVal = 0
    try {
      const { count } = await supabase.from('video_transcripts').select('video_id', { count: 'exact', head: true }).eq('fetch_status', 'success')
      transcriptsVal = count || 0
    } catch {}
    const transcriptCoverage = totalVidsVal > 0 ? Math.round((transcriptsVal / totalVidsVal) * 100) : 0

    let activeJobsVal = 0
    try {
      const { count } = await supabase.from('scrape_jobs').select('id', { count: 'exact', head: true }).in('status', ['running', 'pending'])
      activeJobsVal = count || 0
    } catch {}

    const dailyViewsRows = await getDailyData('view_snapshots', 'snapshot_date', 'view_count', cid, 'SUM')
    const dailyNewVideos = await getDailyData('campaign_videos', 'first_seen_at', 'video_id', cid, 'COUNT')
    const dailyKeywordsAdded = await getDailyData('keywords', 'created_at', 'id', cid, 'COUNT')

    return NextResponse.json({
      lastUpdatedViews: lastViews,
      lastUpdatedRanking: lastRanking,
      totalKeywords: kwCountVal || 0,
      totalVideos,
      rankedVideos,
      totalViewership: vs.total_viewership,
      uniqueVideos: vs.unique_count,
      uniqueVideoViewership: vs.total_viewership,
      uniqueChannels: vs.unique_channels,
      mostRankingChannel: topChannels?.[0] ? { name: topChannels[0].channel_name, totalFrequency: topChannels[0].freq } : null,
      newVideosLast7Days: newVidsVal || 0,
      untaggedVideos: untaggedVal || 0,
      top5ByViewership,
      top5ByFrequency,
      growth: {
        h24: pctChange(vsToday, vs1d),
        d7: pctChange(vsToday, vs7d),
        d30: pctChange(vsToday, vs30d),
      },
      activeScrapingJobs: activeJobsVal,
      transcriptCoverage,
      dailyViews: dailyViewsRows,
      dailyNewVideos,
      dailyKeywordsAdded,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Overview API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
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
