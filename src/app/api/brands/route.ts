import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const isOurs = req.nextUrl.searchParams.get('is_ours')
    if (!campaignId) return NextResponse.json({ data: [], has_scrape_data: false })

    const key = `${cacheKey.brands(campaignId)}:${isOurs || 'all'}`
    const data = await getCached(key, () => fetchBrands(campaignId!, isOurs), CACHE_TTL.brands_overview)
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Brands API error:', e)
    return NextResponse.json({ error: msg, data: [] }, { status: 500 })
  }
}

async function fetchBrands(campaignId: string, isOurs?: string | null) {
  // Get brand names from brand_tags (the source of truth)
  const { data: btRows } = await supabase.from('brand_tags').select('brand_name, video_id').eq('campaign_id', campaignId)

  if (!btRows || btRows.length === 0) {
    // Fallback to campaign_brands
    const { data: cbRows } = await supabase.from('campaign_brands').select('name').eq('campaign_id', campaignId)
    const cbBrands = [...new Set((cbRows || []).map((b: any) => b.name))].sort()
    if (cbBrands.length === 0) return { data: [], has_scrape_data: false }

    return {
      data: cbBrands.map(name => ({
        name, type: 'registered', video_count: 0, total_views: 0,
        sov_percent: 0, freq_sov_percent: 0, has_data: false,
      })),
      has_scrape_data: false,
    }
  }

  // Build brand → video aggregation
  const brandAgg = new Map<string, { videoIds: Set<string>; views: number }>()
  for (const bt of btRows) {
    if (!brandAgg.has(bt.brand_name)) brandAgg.set(bt.brand_name, { videoIds: new Set(), views: 0 })
    brandAgg.get(bt.brand_name)!.videoIds.add(bt.video_id)
  }

  // Fetch all video views in parallel batches
  const allVideoIds = [...new Set(btRows.map((bt: any) => bt.video_id))]
  const videoViews = new Map<string, number>()
  const BATCH = 500
  const videoBatchPromises = []
  for (let i = 0; i < allVideoIds.length; i += BATCH) {
    videoBatchPromises.push(
      supabase.from('videos').select('id, view_count, is_ours').in('id', allVideoIds.slice(i, i + BATCH))
    )
  }
  const videoBatchResults = await Promise.all(videoBatchPromises)
  for (const result of videoBatchResults) {
    for (const v of (result.data || []) as any[]) videoViews.set(v.id, v.view_count || 0)
  }

  // Sum views per brand (with is_ours filter)
  for (const [, agg] of brandAgg) {
    for (const vid of agg.videoIds) {
      const vData = videoBatchResults.flatMap(r => r.data || []).find((v: any) => v.id === vid) as any
      if (isOurs === 'true' && !vData?.is_ours) continue
      if (isOurs === 'false' && vData?.is_ours) continue
      agg.views += videoViews.get(vid) || 0
    }
  }

  // Get keyword video counts for frequency SOV
  const { data: kvRows } = await supabase.from('keyword_videos').select('video_id').eq('campaign_id', campaignId)
  const kvVideoIds = new Set((kvRows || []).map((r: any) => r.video_id))

  // Build enriched brand list
  const totalViews = Array.from(brandAgg.values()).reduce((s, a) => s + a.views, 0) || 1
  const brands = Array.from(brandAgg.entries())
    .map(([name, agg]) => {
      const freq = [...agg.videoIds].filter(vid => kvVideoIds.has(vid)).length
      return {
        name,
        type: 'tagged',
        video_count: agg.videoIds.size,
        total_views: agg.views,
        total_frequency: freq,
        sov_percent: 0,
        freq_sov_percent: 0,
        has_data: agg.videoIds.size > 0,
      }
    })
    .sort((a, b) => b.total_views - a.total_views)

  const totalFreq = brands.reduce((s, b) => s + (b.total_frequency || 0), 0) || 1
  for (const b of brands) {
    b.sov_percent = Math.round((b.total_views / totalViews) * 1000) / 10
    b.freq_sov_percent = Math.round(((b.total_frequency || 0) / totalFreq) * 1000) / 10
  }

  return { data: brands, has_scrape_data: true }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaign_id, name, type } = body
    if (!campaign_id || !name) return NextResponse.json({ error: 'campaign_id and name required' }, { status: 400 })

    await supabase
      .from('campaign_brands')
      .upsert(
        { campaign_id, name: name.trim(), type: type ?? 'competitor' },
        { onConflict: 'campaign_id,name', ignoreDuplicates: true }
      )

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, campaign_id } = body
    if (!id || !campaign_id) return NextResponse.json({ error: 'id and campaign required' }, { status: 400 })

    await supabase.from('campaign_brands').delete().eq('id', id).eq('campaign_id', campaign_id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
