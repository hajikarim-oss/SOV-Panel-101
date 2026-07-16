import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
  const sort = req.nextUrl.searchParams.get('sort') ?? 'views'
  const search = req.nextUrl.searchParams.get('q')

  if (!campaignId) return NextResponse.json({ data: [], total: 0, page, limit })

  try {
    const key = cacheKey.videosCampaign(campaignId, page, sort, search || '')
    const data = await getCached(key, () => fetchCampaignVideos(campaignId!, page, limit, sort, search), CACHE_TTL.videos_campaign)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Campaign videos API error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchCampaignVideos(campaignId: string, page: number, limit: number, sort: string, search: string | null) {
  const offset = (page - 1) * limit

  const { data: cvRows } = await supabase.from('campaign_videos').select('video_id, first_seen_at').eq('campaign_id', campaignId)

  if (!cvRows || cvRows.length === 0) {
    return { data: [], total: 0, page, limit }
  }

  const videoIds = [...new Set(cvRows.map((r: any) => r.video_id))]
  const firstSeenMap = new Map<string, string>()
  for (const r of cvRows) firstSeenMap.set(r.video_id, r.first_seen_at)

  // Parallel batch fetch videos
  const BATCH = 500
  const videoBatchPromises = []
  for (let i = 0; i < videoIds.length; i += BATCH) {
    let vidQuery = supabase.from('videos').select('id, youtube_id, title, channel_name, channel_id, tags, view_count, duration, duration_sec, thumbnail_url, published_at, is_deleted')
    vidQuery = vidQuery.in('id', videoIds.slice(i, i + BATCH)).eq('is_deleted', false)
    if (search) vidQuery = vidQuery.or(`title.ilike.%${search}%,channel_name.ilike.%${search}%`)
    videoBatchPromises.push(vidQuery)
  }
  const videoBatchResults = await Promise.all(videoBatchPromises)

  const allVideos: any[] = []
  for (const result of videoBatchResults) {
    for (const v of (result.data || []) as any[]) {
      v.first_seen_at = firstSeenMap.get(v.id)
      allVideos.push(v)
    }
  }

  // Sort
  if (sort === 'views') allVideos.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
  else if (sort === 'title') allVideos.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''))
  else if (sort === 'date') allVideos.sort((a: any, b: any) => (b.first_seen_at || '').localeCompare(a.first_seen_at || ''))
  else if (sort === 'channel') allVideos.sort((a: any, b: any) => (a.channel_name || '').localeCompare(b.channel_name || ''))

  const total = allVideos.length
  const paged = allVideos.slice(offset, offset + limit)

  // Fetch brand_tags for paged videos only
  const brandTagMap = new Map<string, string[]>()
  if (paged.length > 0) {
    const pagedIds = paged.map((v: any) => v.id)
    const { data: btRows } = await supabase.from('brand_tags').select('video_id, brand_name').in('video_id', pagedIds)
    for (const bt of (btRows || []) as any[]) {
      if (!brandTagMap.has(bt.video_id)) brandTagMap.set(bt.video_id, [])
      brandTagMap.get(bt.video_id)!.push(bt.brand_name)
    }
  }

  const enriched = paged.map((v: any) => ({
    ...v,
    tags: brandTagMap.get(v.id) || [],
  }))

  return { data: enriched, total, page, limit }
}
