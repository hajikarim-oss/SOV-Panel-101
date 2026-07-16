import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCached, cacheKey, CACHE_TTL } from '@/lib/cache'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
  const search = req.nextUrl.searchParams.get('q')

  if (!campaignId) return NextResponse.json({ data: [], total: 0, page, limit })

  try {
    const key = cacheKey.videosPending(campaignId, page, search || '')
    const data = await getCached(key, () => fetchPendingTagging(campaignId!, page, limit, search), CACHE_TTL.videos_pending)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Pending tagging API error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchPendingTagging(campaignId: string, page: number, limit: number, search: string | null) {
  const offset = (page - 1) * limit

  // Parallel: keyword_videos + keyword_shorts
  const [kvRes, ksRes] = await Promise.all([
    supabase.from('keyword_videos').select('video_id, keyword_id, rank, discovered_at, last_seen_at').eq('campaign_id', campaignId),
    supabase.from('keyword_shorts').select('video_id, keyword_id, rank, discovered_at, last_seen_at').eq('campaign_id', campaignId),
  ])

  const allRanked = [...(kvRes.data || []), ...(ksRes.data || [])]
  if (allRanked.length === 0) {
    return { data: [], total: 0, page, limit }
  }

  // Build video → keyword mapping in single pass
  const videoKeywordMap = new Map<string, { keywords: string[]; bestRank: number; discovered_at: string; last_seen_at: string }>()
  for (const r of allRanked) {
    const existing = videoKeywordMap.get(r.video_id)
    if (existing) {
      existing.keywords.push(r.keyword_id)
      if (r.rank < existing.bestRank) existing.bestRank = r.rank
      if (r.discovered_at > existing.discovered_at) existing.discovered_at = r.discovered_at
      if (r.last_seen_at > existing.last_seen_at) existing.last_seen_at = r.last_seen_at
    } else {
      videoKeywordMap.set(r.video_id, {
        keywords: [r.keyword_id], bestRank: r.rank,
        discovered_at: r.discovered_at, last_seen_at: r.last_seen_at,
      })
    }
  }

  const videoIds = [...videoKeywordMap.keys()]

  // Parallel: fetch videos + brand_tags + keywords
  const BATCH = 500
  const videoBatchPromises = []
  for (let i = 0; i < videoIds.length; i += BATCH) {
    videoBatchPromises.push(
      supabase.from('videos').select('id, youtube_id, title, channel_name, channel_id, view_count, duration, duration_sec, thumbnail_url, published_at').in('id', videoIds.slice(i, i + BATCH))
    )
  }

  const kwIds = [...new Set(allRanked.map((r: any) => r.keyword_id))]
  const kwBatchPromises = []
  for (let i = 0; i < kwIds.length; i += BATCH) {
    kwBatchPromises.push(
      supabase.from('keywords').select('id, text').in('id', kwIds.slice(i, i + BATCH))
    )
  }

  const [videoBatchResults, { data: btRows }, kwBatchResults] = await Promise.all([
    Promise.all(videoBatchPromises),
    supabase.from('brand_tags').select('video_id, brand_name').in('video_id', videoIds).eq('campaign_id', campaignId),
    Promise.all(kwBatchPromises),
  ])

  // Merge video data
  const videoMap = new Map<string, any>()
  for (const result of videoBatchResults) {
    for (const v of (result.data || []) as any[]) videoMap.set(v.id, v)
  }

  // Build brand_tags map
  const taggedIds = new Set<string>()
  const btMap = new Map<string, string[]>()
  for (const bt of (btRows || []) as any[]) {
    taggedIds.add(bt.video_id)
    if (!btMap.has(bt.video_id)) btMap.set(bt.video_id, [])
    btMap.get(bt.video_id)!.push(bt.brand_name)
  }

  // Merge keyword text
  const kwTextMap = new Map<string, string>()
  for (const result of kwBatchResults) {
    for (const kw of (result.data || []) as any[]) kwTextMap.set(kw.id, kw.text)
  }

  // Build untagged list
  const untagged = videoIds
    .filter(id => !taggedIds.has(id) && videoMap.has(id))
    .map(id => {
      const v = videoMap.get(id)
      const meta = videoKeywordMap.get(id)!
      return {
        ...v, tags: [], best_rank: meta.bestRank,
        keyword_names: meta.keywords.map(kid => kwTextMap.get(kid) || kid).slice(0, 3),
        keyword_count: meta.keywords.length,
        discovered_at: meta.discovered_at, last_seen_at: meta.last_seen_at,
      }
    })

  let filtered = untagged
  if (search) {
    const s = search.toLowerCase()
    filtered = untagged.filter((v: any) =>
      (v.title || '').toLowerCase().includes(s) || (v.channel_name || '').toLowerCase().includes(s)
    )
  }

  filtered.sort((a: any, b: any) => (a.best_rank || 99) - (b.best_rank || 99))

  const total = filtered.length
  const paged = filtered.slice(offset, offset + limit)

  return { data: paged, total, page, limit }
}
