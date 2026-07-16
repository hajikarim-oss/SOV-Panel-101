import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const metric = req.nextUrl.searchParams.get('metric') ?? 'views'
    const period = req.nextUrl.searchParams.get('period') ?? '7d'
    const periodDays = period === '24h' ? 1 : period === '30d' ? 30 : 7

    const today = new Date().toISOString().split('T')[0]
    const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString().split('T')[0]
    const prevStart = new Date(Date.now() - periodDays * 2 * 86400000).toISOString().split('T')[0]

    let hasBrandTagData = false
    if (campaignId) {
      const { count } = await supabase.from('brand_tags').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
      hasBrandTagData = (count || 0) > 0
    }

    if (!hasBrandTagData && campaignId) {
      const { data: registered } = await supabase.from('campaign_brands').select('name as brand_name').eq('campaign_id', campaignId).order('created_at', { ascending: true })
      const fallback = (registered || []).map((b: any, i: number) => ({
        brand_name: b.brand_name, currentValue: 0, previousValue: 0,
        growthPercent: 0, rankMovement: 0, currentRank: i + 1,
        sparklineData: new Array(periodDays).fill(0), video_count: 0, has_data: false,
      }))
      return NextResponse.json({ data: fallback, period, has_scrape_data: false })
    }

    let btQuery = supabase.from('brand_tags').select('brand_name, video_id')
    if (campaignId) btQuery = btQuery.eq('campaign_id', campaignId)
    const { data: brandTags } = await btQuery

    const brandAgg = new Map<string, { videoIds: Set<string>; views: number }>()
    for (const bt of (brandTags || []) as any[]) {
      if (!brandAgg.has(bt.brand_name)) brandAgg.set(bt.brand_name, { videoIds: new Set(), views: 0 })
      brandAgg.get(bt.brand_name)!.videoIds.add(bt.video_id)
    }

    const allVids = [...new Set((brandTags || []).map((bt: any) => bt.video_id))]
    const videoViews = new Map<string, number>()
    const BATCH = 500
    for (let i = 0; i < allVids.length; i += BATCH) {
      const { data } = await supabase.from('videos').select('id, view_count').in('id', allVids.slice(i, i + BATCH))
      for (const v of (data || []) as any[]) videoViews.set(v.id, v.view_count || 0)
    }
    for (const [, agg] of brandAgg) {
      for (const vid of agg.videoIds) agg.views += videoViews.get(vid) || 0
    }

    const { data: allSnaps } = await supabase.from('view_snapshots').select('video_id, view_count, snapshot_date').eq('campaign_id', campaignId).gte('snapshot_date', prevStart)
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
      let recentVal = 0, previousVal = 0
      for (let i = 0; i < periodDays; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
        recentVal += snapByDateBrand.get(d)?.get(b.brand_name) || 0
      }
      for (let i = periodDays; i < periodDays * 2; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
        previousVal += snapByDateBrand.get(d)?.get(b.brand_name) || 0
      }
      const growthPercent = previousVal > 0 ? parseFloat((((recentVal - previousVal) / previousVal) * 100).toFixed(1)) : 0

      const sparklineData: number[] = []
      for (let i = periodDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
        sparklineData.push(snapByDateBrand.get(d)?.get(b.brand_name) || 0)
      }

      return {
        brand_name: b.brand_name,
        currentValue: metric === 'views' ? b.current_views : b.video_count,
        previousValue: previousVal,
        growthPercent,
        rankMovement: 0,
        currentRank: currentRank + 1,
        sparklineData,
        video_count: b.video_count,
        has_data: true,
      }
    })

    const prevOrder = [...enriched].sort((a, b) => b.previousValue - a.previousValue)
    const prevRankMap = new Map(prevOrder.map((b, i) => [b.brand_name, i + 1]))
    enriched.forEach((b) => {
      b.rankMovement = (prevRankMap.get(b.brand_name) ?? b.currentRank) - b.currentRank
    })

    return NextResponse.json({ data: enriched, period, has_scrape_data: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Brand growth API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
