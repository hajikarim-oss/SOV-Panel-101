import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    if (campaignId) {
      let cbQuery = supabase.from('campaign_brands').select('id, name, type, created_at').eq('campaign_id', campaignId).order('created_at', { ascending: true })
      const { data: brandList } = await cbQuery

      if (!brandList || brandList.length === 0) {
        return NextResponse.json({ data: [], has_scrape_data: false })
      }

      const enriched = await Promise.all(brandList.map(async (b: any) => {
        const [videoRes, viewRes, freqRes] = await Promise.all([
          supabase.from('brand_tags').select('video_id', { count: 'exact', head: true }).eq('brand_name', b.name).eq('campaign_id', campaignId),
          supabase.from('brand_tags').select('video_id').eq('brand_name', b.name).eq('campaign_id', campaignId),
          supabase.from('keyword_videos').select('keyword_id').eq('campaign_id', campaignId),
        ])

        const videoIds = (viewRes.data || []).map((r: any) => r.video_id)
        let totalViews = 0
        if (videoIds.length > 0) {
          const BATCH = 500
          for (let i = 0; i < videoIds.length; i += BATCH) {
            const batch = videoIds.slice(i, i + BATCH)
            const { data } = await supabase.from('videos').select('view_count').in('id', batch)
            totalViews += (data || []).reduce((sum: number, v: any) => sum + (v.view_count || 0), 0)
          }
        }

        const kvVideoIds = new Set((freqRes.data || []).map((r: any) => r.video_id))
        const totalFrequency = videoIds.filter((vid: string) => kvVideoIds.has(vid)).length

        return {
          ...b,
          video_count: videoRes.count || 0,
          total_views: totalViews,
          total_frequency: totalFrequency,
          sov_percent: 0,
          freq_sov_percent: 0,
          has_data: (videoRes.count || 0) > 0,
        }
      }))

      const totalViews = enriched.reduce((s, b) => s + (b.total_views || 0), 0) || 1
      const totalFreq = enriched.reduce((s, b) => s + (b.total_frequency || 0), 0) || 1
      const hasScrapeData = enriched.some(b => b.has_data)
      enriched.forEach(b => {
        if (hasScrapeData) {
          b.sov_percent = Math.round((b.total_views / totalViews) * 1000) / 10
          b.freq_sov_percent = Math.round((b.total_frequency / totalFreq) * 1000) / 10
        }
      })

      return NextResponse.json({ data: enriched, has_scrape_data: hasScrapeData })
    }

    // Legacy: no campaign
    const { data: brandTags } = await supabase.from('brand_tags').select('brand_name, video_id')
    if (!brandTags || brandTags.length === 0) return NextResponse.json({ data: [] })

    const brandAgg = new Map<string, { views: number; videoIds: Set<string> }>()
    for (const bt of brandTags as any[]) {
      if (!brandAgg.has(bt.brand_name)) brandAgg.set(bt.brand_name, { views: 0, videoIds: new Set() })
      brandAgg.get(bt.brand_name)!.videoIds.add(bt.video_id)
    }

    const allVids = [...new Set(brandTags.map((bt: any) => bt.video_id))]
    const videoViews = new Map<string, number>()
    const BATCH = 500
    for (let i = 0; i < allVids.length; i += BATCH) {
      const batch = allVids.slice(i, i + BATCH)
      const { data } = await supabase.from('videos').select('id, view_count').in('id', batch)
      for (const v of (data || []) as any[]) videoViews.set(v.id, v.view_count || 0)
    }
    for (const [brand, agg] of brandAgg) {
      for (const vid of agg.videoIds) agg.views += videoViews.get(vid) || 0
    }

    const totalV = Array.from(brandAgg.values()).reduce((s, a) => s + a.views, 0) || 1
    const result = Array.from(brandAgg.entries())
      .map(([name, agg]) => ({
        brand_name: name,
        brand_total_views: agg.views,
        brand_total_freq: 0,
        sov_percent: Math.round((agg.views / totalV) * 1000) / 10,
        freq_sov_percent: 0,
        video_count: agg.videoIds.size,
        has_data: true,
      }))
      .sort((a, b) => b.brand_total_views - a.brand_total_views)

    return NextResponse.json({ data: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Brands API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
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
    console.error('Brands POST error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, campaign_id } = body
    if (!id || !campaign_id) return NextResponse.json({ error: 'id and campaign_id required' }, { status: 400 })

    await supabase.from('campaign_brands').delete().eq('id', id).eq('campaign_id', campaign_id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Brands DELETE error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
