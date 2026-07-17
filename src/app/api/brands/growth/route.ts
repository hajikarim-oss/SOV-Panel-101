import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const metric = req.nextUrl.searchParams.get('metric') ?? 'views'
    const period = req.nextUrl.searchParams.get('period') ?? '7d'
    const isOurs = req.nextUrl.searchParams.get('is_ours')
    if (!campaignId) return NextResponse.json({ data: [], period, has_scrape_data: false })

    const key = `${cacheKey.brandGrowth(campaignId, metric, period)}:${isOurs || 'all'}`
    const data = await getCached(key, () => fetchGrowth(campaignId!, metric, period, isOurs), CACHE_TTL.brand_growth)
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Brand growth API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchGrowth(campaignId: string, metric: string, period: string, isOurs?: string | null) {
  const periodDays = period === '24h' ? 1 : period === '30d' ? 30 : 7
  const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString().split('T')[0]
  const prevStart = new Date(Date.now() - periodDays * 2 * 86400000).toISOString().split('T')[0]

  // Fetch brand_tags directly (count:'exact',head:true returns null on some tables)
  const { data: brandTags } = await supabase
    .from('brand_tags')
    .select('brand_name, video_id')
    .eq('campaign_id', campaignId)

  if (!brandTags || brandTags.length === 0) {
    // Fallback to campaign_brands
    const { data: registered } = await supabase.from('campaign_brands').select('name as brand_name').eq('campaign_id', campaignId)
    const brands = registered || []
    if (brands.length === 0) return { data: [], period, has_scrape_data: false }
    return {
      data: brands.map((b: any, i: number) => ({
        brand_name: b.brand_name, currentValue: 0, previousValue: 0,
        growthPercent: 0, rankMovement: 0, currentRank: i + 1,
        sparklineData: new Array(periodDays).fill(0), video_count: 0, has_data: false,
      })),
      period, has_scrape_data: false,
    }
  }

  // Build brand aggregation in single pass
  const brandAgg = new Map<string, { videoIds: Set<string>; views: number }>()
  for (const bt of (brandTags || []) as any[]) {
    if (!brandAgg.has(bt.brand_name)) brandAgg.set(bt.brand_name, { videoIds: new Set(), views: 0 })
    brandAgg.get(bt.brand_name)!.videoIds.add(bt.video_id)
  }

  const allVids = [...new Set((brandTags || []).map((bt: any) => bt.video_id))]

  // Parallel: fetch video views + snapshot data
  const BATCH = 500
  const videoBatchPromises = []
  for (let i = 0; i < allVids.length; i += BATCH) {
    videoBatchPromises.push(
      supabase.from('videos').select('id, view_count, is_ours').in('id', allVids.slice(i, i + BATCH))
    )
  }

  const [videoBatchResults, { data: allSnaps }] = await Promise.all([
    Promise.all(videoBatchPromises),
    supabase.from('view_snapshots')
      .select('video_id, view_count, snapshot_date')
      .eq('campaign_id', campaignId)
      .gte('snapshot_date', prevStart),
  ])

  // Merge video views
  const videoViews = new Map<string, number>()
  const videoIsOurs = new Map<string, boolean>()
  for (const result of videoBatchResults) {
    for (const v of (result.data || []) as any[]) {
      videoViews.set(v.id, v.view_count || 0)
      videoIsOurs.set(v.id, v.is_ours || false)
    }
  }

  // Filter by is_ours if specified
  const filteredVids = isOurs === 'true'
    ? allVids.filter(id => videoIsOurs.get(id) === true)
    : isOurs === 'false'
    ? allVids.filter(id => videoIsOurs.get(id) !== true)
    : allVids
  const filteredVidSet = new Set(filteredVids)

  for (const [, agg] of brandAgg) {
    agg.videoIds.forEach(id => { if (filteredVidSet.has(id)) agg.views += videoViews.get(id) || 0 })
  }

  // Build snapshot map in single pass
  const snapByDateBrand = new Map<string, Map<string, number>>()
  for (const snap of (allSnaps || []) as any[]) {
    const d = typeof snap.snapshot_date === 'string' ? snap.snapshot_date.split('T')[0] : String(snap.snapshot_date)
    if (!snapByDateBrand.has(d)) snapByDateBrand.set(d, new Map())
    for (const [brand, agg] of brandAgg) {
      if (agg.videoIds.has(snap.video_id)) {
        const bm = snapByDateBrand.get(d)!
        bm.set(brand, (bm.get(brand) || 0) + (snap.view_count || 0))
      }
    }
  }

  const sortedBrands = Array.from(brandAgg.entries())
    .map(([name, agg]) => ({ brand_name: name, current_views: agg.views, video_count: agg.videoIds.size }))
    .sort((a, b) => metric === 'views' ? b.current_views - a.current_views : b.video_count - a.video_count)

  const enriched = sortedBrands.map((b, currentRank) => {
    // Find all available snapshot dates for this brand (sorted ascending)
    const availableDates: string[] = []
    for (const [date, bm] of snapByDateBrand) {
      if (bm.has(b.brand_name)) availableDates.push(date)
    }
    availableDates.sort()

    // Compare latest snapshot vs earliest snapshot (or previous period)
    let recentVal = 0, previousVal = 0
    if (availableDates.length >= 2) {
      // Latest date value
      const latestDate = availableDates[availableDates.length - 1]
      recentVal = snapByDateBrand.get(latestDate)?.get(b.brand_name) || 0
      // Previous date value
      const prevDate = availableDates[availableDates.length - 2]
      previousVal = snapByDateBrand.get(prevDate)?.get(b.brand_name) || 0
    } else if (availableDates.length === 1) {
      // Only one snapshot — compare with current videos.view_count
      recentVal = b.current_views
      previousVal = 0
    }

    const growthPercent = previousVal > 0 ? parseFloat((((recentVal - previousVal) / previousVal) * 100).toFixed(1)) : (recentVal > 0 ? 100 : 0)

    // Sparkline from all available dates
    const sparklineData: number[] = availableDates.map(d => snapByDateBrand.get(d)?.get(b.brand_name) || 0)

    return {
      brand_name: b.brand_name,
      currentValue: metric === 'views' ? b.current_views : b.video_count,
      previousValue: previousVal, growthPercent, rankMovement: 0, currentRank: currentRank + 1,
      sparklineData, video_count: b.video_count, has_data: availableDates.length > 0,
    }
  })

  const prevOrder = [...enriched].sort((a, b) => b.previousValue - a.previousValue)
  const prevRankMap = new Map(prevOrder.map((b, i) => [b.brand_name, i + 1]))
  enriched.forEach((b) => { b.rankMovement = (prevRankMap.get(b.brand_name) ?? b.currentRank) - b.currentRank })

  return { data: enriched, period, has_scrape_data: true }
}
