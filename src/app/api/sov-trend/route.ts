import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30')
    const isOurs = req.nextUrl.searchParams.get('is_ours')
    if (!campaignId) return NextResponse.json({ data: [], brands: [], has_scrape_data: false })

    const key = `${cacheKey.sovTrend(campaignId, 'all', String(days))}:${isOurs || 'all'}`
    const data = await getCached(key, () => fetchSovTrend(campaignId!, days, isOurs), CACHE_TTL.sov_trend)
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('SOV trend API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchSovTrend(campaignId: string, days: number, isOurs?: string | null) {
  // Parallel: get brand names from campaign_brands AND brand_tags simultaneously
  const [cbRes, btRes] = await Promise.all([
    supabase.from('campaign_brands').select('name').eq('campaign_id', campaignId),
    supabase.from('brand_tags').select('brand_name, video_id').eq('campaign_id', campaignId),
  ])

  let brandNames: string[] = (cbRes.data || []).map((b: any) => b.name)
  if (brandNames.length === 0) {
    brandNames = [...new Set((btRes.data || []).map((bt: any) => bt.brand_name))].sort()
  }

  if (brandNames.length === 0) {
    return { data: [], brands: [], has_scrape_data: false }
  }

  const brandTags = btRes.data || []
  if (brandTags.length === 0) {
    return { data: [], brands: brandNames, has_scrape_data: false }
  }

  // Build maps in a single pass
  const videoBrandMap = new Map<string, string[]>()
  for (const bt of brandTags) {
    if (!videoBrandMap.has(bt.video_id)) videoBrandMap.set(bt.video_id, [])
    videoBrandMap.get(bt.video_id)!.push(bt.brand_name)
  }

  const allVideoIds = [...videoBrandMap.keys()]

  // Fetch is_ours for filtering
  let filteredVideoIds = allVideoIds
  if (isOurs && allVideoIds.length > 0) {
    const BATCH = 500
    const vidBatchPromises = []
    for (let i = 0; i < allVideoIds.length; i += BATCH) {
      vidBatchPromises.push(
        supabase.from('videos').select('id, is_ours').in('id', allVideoIds.slice(i, i + BATCH))
      )
    }
    const vidBatchResults = await Promise.all(vidBatchPromises)
    const vidsSet = new Set<string>()
    for (const r of vidBatchResults) {
      for (const v of (r.data || []) as any[]) {
        if (isOurs === 'true' && v.is_ours) vidsSet.add(v.id)
        if (isOurs === 'false' && !v.is_ours) vidsSet.add(v.id)
      }
    }
    filteredVideoIds = allVideoIds.filter(id => vidsSet.has(id))
  }

  // Fetch snapshot data
  const startDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0]

  const { data: snapshots } = await supabase
    .from('view_snapshots')
    .select('video_id, view_count, snapshot_date')
    .eq('campaign_id', campaignId)
    .gte('snapshot_date', startDate)
    .in('video_id', filteredVideoIds.length > 0 ? filteredVideoIds : ['__none__'])

  const hasSnapshots = (snapshots || []).length > 0

  // Build date → brand → views map in a single pass
  const dateBrandViews = new Map<string, Map<string, number>>()
  for (const snap of (snapshots || []) as any[]) {
    const dateStr = typeof snap.snapshot_date === 'string' ? snap.snapshot_date.split('T')[0] : String(snap.snapshot_date)
    if (!dateBrandViews.has(dateStr)) dateBrandViews.set(dateStr, new Map())

    const brandsForVideo = videoBrandMap.get(snap.video_id)
    if (brandsForVideo) {
      const brandMap = dateBrandViews.get(dateStr)!
      for (const brandName of brandsForVideo) {
        brandMap.set(brandName, (brandMap.get(brandName) || 0) + (snap.view_count || 0))
      }
    }
  }

  // Build time-series
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    dates.push(d.toISOString().split('T')[0])
  }

  const trendData = dates
    .map((date, idx) => {
      const row: Record<string, string | number> = {
        date: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
      }
      const brandMap = dateBrandViews.get(date)
      let total = 0
      if (brandMap) { for (const views of brandMap.values()) total += views }
      for (const brandName of brandNames) {
        const views = brandMap?.get(brandName) || 0
        row[brandName] = total > 0 ? Math.round((views / total) * 1000) / 10 : 0
      }
      return { row, hasData: total > 0, idx }
    })
    .filter(({ hasData, idx }) => hasData || idx === dates.length - 1)
    .map(({ row }) => row)

  return { data: trendData, brands: brandNames, has_scrape_data: hasSnapshots }
}
