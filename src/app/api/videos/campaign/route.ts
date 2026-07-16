import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
  const sort = req.nextUrl.searchParams.get('sort') ?? 'views'
  const search = req.nextUrl.searchParams.get('q')
  const offset = (page - 1) * limit

  try {
    let cvQuery = supabase.from('campaign_videos').select('video_id, first_seen_at')
    if (campaignId) cvQuery = cvQuery.eq('campaign_id', campaignId)
    const { data: cvRows } = await cvQuery

    if (!cvRows || cvRows.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit })
    }

    const videoIds = [...new Set(cvRows.map((r: any) => r.video_id))]
    const firstSeenMap = new Map<string, string>()
    for (const r of cvRows) firstSeenMap.set(r.video_id, r.first_seen_at)

    const BATCH = 500
    const allVideos: any[] = []
    for (let i = 0; i < videoIds.length; i += BATCH) {
      const batch = videoIds.slice(i, i + BATCH)
      let vidQuery = supabase.from('videos').select('id, youtube_id, title, channel_name, channel_id, tags, view_count, duration, duration_sec, thumbnail_url, published_at, is_deleted')
      vidQuery = vidQuery.in('id', batch).eq('is_deleted', false)
      if (search) vidQuery = vidQuery.or(`title.ilike.%${search}%,channel_name.ilike.%${search}%`)
      const { data } = await vidQuery
      allVideos.push(...(data || []))
    }

    for (const v of allVideos) {
      v.first_seen_at = firstSeenMap.get(v.id)
    }

    if (search) {
      const filtered = allVideos.filter((v: any) =>
        (v.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (v.channel_name || '').toLowerCase().includes(search.toLowerCase())
      )
      allVideos.length = 0
      allVideos.push(...filtered)
    }

    if (sort === 'views') allVideos.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
    else if (sort === 'title') allVideos.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''))
    else if (sort === 'date') allVideos.sort((a: any, b: any) => (b.first_seen_at || '').localeCompare(a.first_seen_at || ''))
    else if (sort === 'channel') allVideos.sort((a: any, b: any) => (a.channel_name || '').localeCompare(b.channel_name || ''))

    const total = allVideos.length
    const paged = allVideos.slice(offset, offset + limit)

    const brandTagMap = new Map<string, string[]>()
    if (paged.length > 0) {
      const pagedIds = paged.map((v: any) => v.id)
      for (let i = 0; i < pagedIds.length; i += BATCH) {
        const batch = pagedIds.slice(i, i + BATCH)
        const { data: btRows } = await supabase.from('brand_tags').select('video_id, brand_name').in('video_id', batch)
        for (const bt of (btRows || []) as any[]) {
          if (!brandTagMap.has(bt.video_id)) brandTagMap.set(bt.video_id, [])
          brandTagMap.get(bt.video_id)!.push(bt.brand_name)
        }
      }
    }

    const enriched = paged.map((v: any) => ({
      ...v,
      tags: brandTagMap.get(v.id) || [],
    }))

    return NextResponse.json({ data: enriched, total, page, limit })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Campaign videos API error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
