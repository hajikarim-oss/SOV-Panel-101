import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandName: string }> }) {
  try {
    const { brandName } = await params
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const decodedBrand = decodeURIComponent(brandName)

    const { data: brandTagRows } = await supabase.from('brand_tags').select('video_id').eq('campaign_id', campaignId).eq('brand_name', decodedBrand)
    const brandVideoIds = [...new Set((brandTagRows || []).map((bt: any) => bt.video_id))]

    let uniqueVideos = 0
    let uniqueViews = 0
    let totalVideos = 0
    let totalViews = 0
    let allVids: any[] = []

    if (brandVideoIds.length > 0) {
      const BATCH = 500
      for (let i = 0; i < brandVideoIds.length; i += BATCH) {
        const batch = brandVideoIds.slice(i, i + BATCH)
        const { data } = await supabase.from('videos').select('id, youtube_id, view_count, title, channel_name, published_at').in('id', batch)
        allVids.push(...(data || []))
      }
      uniqueVideos = new Set(allVids.map((v: any) => v.youtube_id)).size
      uniqueViews = allVids.reduce((sum: number, v: any) => sum + (v.view_count || 0), 0)
      totalVideos = allVids.length
      totalViews = uniqueViews
    }

    const today = new Date().toISOString().split('T')[0]
    const d7ago = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const d30ago = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    async function getSnapForBrand(date: string): Promise<number> {
      const { data: snaps } = await supabase.from('view_snapshots').select('view_count, video_id').eq('snapshot_date', date).eq('campaign_id', campaignId)
      if (!snaps || snaps.length === 0) return 0
      const snapVideoIds = new Set(snaps.map((s: any) => s.video_id))
      return snaps.filter((s: any) => brandVideoIds.includes(s.video_id)).reduce((sum: number, s: any) => sum + (s.view_count || 0), 0)
    }

    const nowV = await getSnapForBrand(today) || uniqueViews
    const v7 = await getSnapForBrand(d7ago)
    const v30 = await getSnapForBrand(d30ago)
    const pctChange = (now: number, prev: number) => prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : 0

    const topVideos = allVids.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 10)

    let topKeywords: any[] = []
    if (brandVideoIds.length > 0) {
      const kvRes = await supabase.from('keyword_videos').select('keyword_id, video_id, rank').in('video_id', brandVideoIds.slice(0, 500))
      const ksRes = await supabase.from('keyword_shorts').select('keyword_id, video_id, rank').in('video_id', brandVideoIds.slice(0, 500))
      const allKv = [...(kvRes.data || []), ...(ksRes.data || [])]
      const kwIds = [...new Set(allKv.map((k: any) => k.keyword_id))]
      if (kwIds.length > 0) {
        const { data: kwRows } = await supabase.from('keywords').select('id, text, language').in('id', kwIds)
        const kwMap = new Map((kwRows || []).map((k: any) => [k.id, k]))
        const kwStats = new Map<string, { keyword: string; best_rank: number; count: number }>()
        for (const kv of allKv) {
          const kw = kwMap.get(kv.keyword_id)
          if (!kw) continue
          if (!kwStats.has(kw.text)) kwStats.set(kw.text, { keyword: kw.text, best_rank: kv.rank, count: 0 })
          const s = kwStats.get(kw.text)!
          s.best_rank = Math.min(s.best_rank, kv.rank)
          s.count++
        }
        topKeywords = Array.from(kwStats.values()).sort((a, b) => b.count - a.count).slice(0, 10)
      }
    }

    let langBreakdown: any[] = []
    if (brandVideoIds.length > 0) {
      const kvRes2 = await supabase.from('keyword_videos').select('keyword_id').in('video_id', brandVideoIds.slice(0, 200))
      const kwIds2 = [...new Set((kvRes2.data || []).map((k: any) => k.keyword_id))]
      if (kwIds2.length > 0) {
        const BATCH = 500
        const allKw: any[] = []
        for (let i = 0; i < kwIds2.length; i += BATCH) {
          const { data } = await supabase.from('keywords').select('language').in('id', kwIds2.slice(i, i + BATCH))
          allKw.push(...(data || []))
        }
        const langMap = new Map<string, number>()
        for (const k of allKw) {
          const lang = k.language || 'unknown'
          langMap.set(lang, (langMap.get(lang) || 0) + 1)
        }
        langBreakdown = Array.from(langMap.entries()).map(([language, video_count]) => ({ language, video_count }))
      }
    }

    return NextResponse.json({
      metrics: {
        total_videos: totalVideos,
        unique_videos: uniqueVideos,
        total_views: totalViews,
        unique_views: uniqueViews,
        growth_7d: pctChange(nowV, v7),
        growth_30d: pctChange(nowV, v30),
      },
      topVideos, topKeywords, langBreakdown,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Brand detail API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
