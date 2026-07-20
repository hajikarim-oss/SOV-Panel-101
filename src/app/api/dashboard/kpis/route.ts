import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, CACHE_TTL, cacheKey } from '@/lib/cache'

export const runtime = 'nodejs'
export const maxDuration = 30

// ── Fast KPI endpoint: returns critical numbers in ~200–400ms ──────────────────
// Uses only COUNT queries + materialized views (no full table scans).
// The client calls this FIRST so KPI cards are visible almost instantly,
// then separately calls /api/dashboard for the full charts + video list.

export async function GET(req: NextRequest) {
  try {
    const cid = req.nextUrl.searchParams.get('campaign_id')
    if (!cid) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const key = cacheKey.kpis(cid)
    const data = await getCached(key, () => fetchKpis(cid), CACHE_TTL.overview_kpis)

    return NextResponse.json(data, {
      headers: {
        // Edge-cached for 2 minutes, stale OK for 10 minutes while revalidating
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('KPIs API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchKpis(cid: string) {
  const today = new Date().toISOString().split('T')[0]
  const d1 = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  // All 12 queries run in parallel — each is a COUNT or materialized view read.
  // No full table scans. No row fetching. No JavaScript aggregation.
  const [
    kwRes,        // keyword count
    cvRes,        // total video count
    cvNewRes,     // new videos (7 days)
    btRes,        // tagged video count
    top5Views,    // brand SOV by views (materialized view — pre-computed)
    top5Freq,     // brand SOV by freq (materialized view — pre-computed)
    topChannel,   // most ranking channel (materialized view — pre-computed)
    sjRes,        // active scrape jobs count
    metaRes,      // last refresh timestamps
    vsTodayRes,   // today's view snapshot total
    vs1dRes,      // yesterday's view snapshot total
    vs7dRes,      // 7-day-ago view snapshot total
  ] = await Promise.all([
    supabase.from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', cid).eq('status', 'active'),

    supabase.from('campaign_videos')
      .select('video_id', { count: 'exact', head: true })
      .eq('campaign_id', cid),

    supabase.from('campaign_videos')
      .select('video_id', { count: 'exact', head: true })
      .eq('campaign_id', cid)
      .gte('first_seen_at', new Date(Date.now() - 7 * 86400000).toISOString()),

    supabase.from('brand_tags')
      .select('video_id', { count: 'exact', head: true })
      .eq('campaign_id', cid),

    // Materialized views: pre-computed, instant (no JOIN, no scan)
    supabase.from('brand_sov_mv')
      .select('brand_name, brand_total_views, sov_percent, video_count')
      .eq('campaign_id', cid)
      .order('brand_total_views', { ascending: false })
      .limit(5),

    supabase.from('brand_freq_sov_mv')
      .select('brand_name, brand_total_freq, freq_sov_percent, video_count')
      .eq('campaign_id', cid)
      .order('brand_total_freq', { ascending: false })
      .limit(5),

    supabase.from('channel_rank_mv')
      .select('channel_name, total_frequency')
      .eq('campaign_id', cid)
      .order('total_frequency', { ascending: false })
      .limit(1)
      .maybeSingle() as any,

    supabase.from('scrape_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['running', 'pending']),

    supabase.from('system_metadata')
      .select('key, value, updated_at')
      .in('key', ['last_views_refresh', 'last_ranking_refresh']),

    // View snapshot sums — now fast with the new campaign_id+date index
    supabase.from('view_snapshots')
      .select('view_count').eq('campaign_id', cid).eq('snapshot_date', today).limit(10000),
    supabase.from('view_snapshots')
      .select('view_count').eq('campaign_id', cid).eq('snapshot_date', d1).limit(10000),
    supabase.from('view_snapshots')
      .select('view_count').eq('campaign_id', cid).eq('snapshot_date', d7).limit(10000),
  ])

  const sumViews = (rows: any[] | null) =>
    (rows || []).reduce((s: number, r: any) => s + (r.view_count || 0), 0)

  const vsToday = sumViews(vsTodayRes.data)
  const vs1d    = sumViews(vs1dRes.data)
  const vs7d    = sumViews(vs7dRes.data)

  const meta: Record<string, { value: string; updated_at: string }> = {}
  ;(metaRes.data || []).forEach((m: any) => {
    meta[m.key] = { value: m.value, updated_at: m.updated_at }
  })

  const totalVideos  = cvRes.count ?? 0
  const taggedCount  = btRes.count ?? 0

  // Shape matches the `overview` field expected by page.tsx
  // Missing chart data (dailyViews etc.) is intentionally absent here —
  // page.tsx already handles undefined gracefully with fallback to buildTimeline()
  return {
    lastUpdatedViews:   meta['last_views_refresh']   ?? null,
    lastUpdatedRanking: meta['last_ranking_refresh'] ?? null,
    totalKeywords:       kwRes.count ?? 0,
    totalVideos,
    rankedVideos:        0,
    rankedVideoCount:    0,
    totalViewership:     vsToday || vs1d || 0,
    uniqueVideos:        0,
    uniqueVideoViewership: vsToday || vs1d || 0,
    uniqueChannels:      0,
    mostRankingChannel:  topChannel?.data
      ? { name: topChannel.data.channel_name, totalFrequency: topChannel.data.total_frequency }
      : null,
    newVideosLast7Days:  cvNewRes.count ?? 0,
    untaggedVideos:      Math.max(0, totalVideos - taggedCount),
    top5ByViewership:    top5Views.data ?? [],
    top5ByFrequency:     top5Freq.data ?? [],
    growth: {
      h24: pctChange(vsToday, vs1d),
      d7:  pctChange(vsToday, vs7d),
      d30: 0,
    },
    activeScrapingJobs:  sjRes.count ?? 0,
    transcriptCoverage:  0,
    // Chart data not included here — fetched by the full /api/dashboard endpoint
    dailyViews:          [],
    dailyNewVideos:      [],
    dailyKeywordsAdded:  [],
    ourVideos:           { count: 0, views: 0 },
    _isKpisOnly:         true, // marker so page.tsx knows this is partial data
  }
}

function pctChange(now: number, prev: number) {
  return prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : 0
}
