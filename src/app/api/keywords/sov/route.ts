import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const language = req.nextUrl.searchParams.get('language') ?? 'all'
  const type = req.nextUrl.searchParams.get('type') ?? 'all'

  if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

  try {
    let cbQuery = supabase.from('campaign_brands').select('name').eq('campaign_id', campaignId)
    const { data: brandRows } = await cbQuery
    let brandNames = (brandRows || []).map((b: any) => b.name)

    if (brandNames.length === 0) {
      const { data: btRows } = await supabase.from('brand_tags').select('brand_name').eq('campaign_id', campaignId)
      brandNames = [...new Set((btRows || []).map((bt: any) => bt.brand_name))].sort()
    }

    let kwQuery = supabase.from('keywords').select('id, text, type, language, status').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    if (language !== 'all') kwQuery = kwQuery.eq('language', language)
    if (type !== 'all') kwQuery = kwQuery.eq('category', type)

    const { data: keywords } = await kwQuery
    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ data: [], brandNames })
    }

    const kwIds = keywords.map((k: any) => k.id)

    const [kvRes, ksRes] = await Promise.all([
      supabase.from('keyword_videos').select('keyword_id, video_id').in('keyword_id', kwIds),
      supabase.from('keyword_shorts').select('keyword_id, video_id').in('keyword_id', kwIds),
    ])

    const kwVideoMap = new Map<string, Set<string>>()
    for (const kv of kvRes.data || []) {
      if (!kwVideoMap.has(kv.keyword_id)) kwVideoMap.set(kv.keyword_id, new Set())
      kwVideoMap.get(kv.keyword_id)!.add(kv.video_id)
    }
    for (const ks of ksRes.data || []) {
      if (!kwVideoMap.has(ks.keyword_id)) kwVideoMap.set(ks.keyword_id, new Set())
      kwVideoMap.get(ks.keyword_id)!.add(ks.video_id)
    }

    const allVideoIds = [...new Set([...(kvRes.data || []).map((r: any) => r.video_id), ...(ksRes.data || []).map((r: any) => r.video_id)])]

    const videoMap = new Map<string, any>()
    const BATCH = 500
    for (let i = 0; i < allVideoIds.length; i += BATCH) {
      const batch = allVideoIds.slice(i, i + BATCH)
      const { data } = await supabase.from('videos').select('id, view_count, title, channel_name, tags').in('id', batch)
      for (const v of (data || []) as any[]) videoMap.set(v.id, v)
    }

    const enrichedData = keywords.map((kw: any) => {
      const videoIds = kwVideoMap.get(kw.id) || new Set()
      const videos = [...videoIds].map(id => videoMap.get(id)).filter(Boolean)

      const totalViews = videos.reduce((acc: number, v: any) => acc + (v.view_count || 0), 0)

      const entry: Record<string, string | number> = {
        keyword: kw.text, total_videos: videos.length,
      }
      let brandTotal = 0

      for (const bName of brandNames) {
        const brandViews = videos
          .filter((v: any) => {
            let tagsArr: string[] = []
            if (Array.isArray(v.tags)) tagsArr = v.tags
            else try { tagsArr = JSON.parse(v.tags || '[]') } catch {}
            return tagsArr.some((t: string) => t.toLowerCase() === bName.toLowerCase()) ||
              (v.title || '').toLowerCase().includes(bName.toLowerCase()) ||
              (v.channel_name || '').toLowerCase().includes(bName.toLowerCase())
          })
          .reduce((acc: number, v: any) => acc + (v.view_count || 0), 0)

        const pct = totalViews > 0 ? parseFloat(((brandViews / totalViews) * 100).toFixed(1)) : 0
        entry[bName] = pct
        brandTotal += pct
      }

      entry['Other'] = parseFloat(Math.max(0, 100 - brandTotal).toFixed(1))
      return entry
    })

    return NextResponse.json({ data: enrichedData, brandNames })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Keyword SOV API error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
