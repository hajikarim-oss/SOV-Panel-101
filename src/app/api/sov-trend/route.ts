import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30')

    // 1. Get brand names - fallback to brand_tags if campaign_brands is empty
    let brandQuery = supabase.from('campaign_brands').select('name')
    if (campaignId) brandQuery = brandQuery.eq('campaign_id', campaignId)
    const { data: brandRows } = await brandQuery

    let brandNames: string[] = (brandRows || []).map((b: any) => b.name)

    if (brandNames.length === 0 && campaignId) {
      const { data: btRows } = await supabase.from('brand_tags').select('brand_name').eq('campaign_id', campaignId)
      brandNames = [...new Set((btRows || []).map((bt: any) => bt.brand_name))].sort()
    }

    if (brandNames.length === 0) {
      return NextResponse.json({ data: [], brands: [], has_scrape_data: false })
    }

    // 2. Get all video_ids tagged with these brands
    let btQuery = supabase.from('brand_tags').select('video_id, brand_name')
    if (campaignId) btQuery = btQuery.eq('campaign_id', campaignId)
    const { data: brandTags } = await btQuery

    if (!brandTags || brandTags.length === 0) {
      return NextResponse.json({ data: [], brands: brandNames, has_scrape_data: false })
    }

    const brandVideoMap = new Map<string, string[]>()
    const videoBrandMap = new Map<string, string[]>()
    for (const bt of brandTags as any[]) {
      if (!brandVideoMap.has(bt.brand_name)) brandVideoMap.set(bt.brand_name, [])
      brandVideoMap.get(bt.brand_name)!.push(bt.video_id)
      if (!videoBrandMap.has(bt.video_id)) videoBrandMap.set(bt.video_id, [])
      videoBrandMap.get(bt.video_id)!.push(bt.brand_name)
    }

    const allVideoIds = [...new Set(brandTags.map((bt: any) => bt.video_id))]

    // 3. Check if snapshots exist
    let snapCountQuery = supabase.from('view_snapshots').select('id', { count: 'exact', head: true })
    if (campaignId) snapCountQuery = snapCountQuery.eq('campaign_id', campaignId)
    const { count: snapCount } = await snapCountQuery
    const hasSnapshots = (snapCount || 0) > 0

    // 4. Fetch all snapshots in bulk for the date range
    const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0]

    let snapQuery = supabase.from('view_snapshots').select('video_id, view_count, snapshot_date')
    if (campaignId) snapQuery = snapQuery.eq('campaign_id', campaignId)
    snapQuery = snapQuery.gte('snapshot_date', startDate).in('video_id', allVideoIds.length > 0 ? allVideoIds : ['__none__'])

    const { data: snapshots } = await snapQuery

    // 5. Build a map: date -> brand -> total views
    const dateBrandViews = new Map<string, Map<string, number>>()

    for (const snap of (snapshots || []) as any[]) {
      const dateStr = typeof snap.snapshot_date === 'string' ? snap.snapshot_date.split('T')[0] : String(snap.snapshot_date)
      if (!dateBrandViews.has(dateStr)) dateBrandViews.set(dateStr, new Map())

      const brandNamesForVideo = videoBrandMap.get(snap.video_id)
      if (brandNamesForVideo) {
        const brandMap = dateBrandViews.get(dateStr)!
        for (const brandName of brandNamesForVideo) {
          brandMap.set(brandName, (brandMap.get(brandName) || 0) + (snap.view_count || 0))
        }
      }
    }

    // 6. Build the time-series data
    const dates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      dates.push(d.toISOString().split('T')[0])
    }

    const trendData = dates.map(date => {
      const row: Record<string, string | number> = {
        date: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
      }

      const brandMap = dateBrandViews.get(date)
      let total = 0
      if (brandMap) {
        for (const views of brandMap.values()) total += views
      }

      for (const brandName of brandNames) {
        const views = brandMap?.get(brandName) || 0
        row[brandName] = total > 0 ? Math.round((views / total) * 1000) / 10 : 0
      }

      return row
    })

    return NextResponse.json({
      data: trendData,
      brands: brandNames,
      has_scrape_data: hasSnapshots,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('SOV trend API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
