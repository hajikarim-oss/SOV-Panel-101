import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
  const search = req.nextUrl.searchParams.get('q')
  const offset = (page - 1) * limit

  try {
    if (!campaignId) {
      return NextResponse.json({ data: [], total: 0, page, limit })
    }

    const kvRes = await supabase.from('keyword_videos').select('video_id, keyword_id, rank, discovered_at, last_seen_at').eq('campaign_id', campaignId)
    const ksRes = await supabase.from('keyword_shorts').select('video_id, keyword_id, rank, discovered_at, last_seen_at').eq('campaign_id', campaignId)

    const allRanked = [...(kvRes.data || []), ...(ksRes.data || [])]
    if (allRanked.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit })
    }

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
          keywords: [r.keyword_id],
          bestRank: r.rank,
          discovered_at: r.discovered_at,
          last_seen_at: r.last_seen_at,
        })
      }
    }

    const videoIds = [...videoKeywordMap.keys()]

    const BATCH = 500
    const videoMap = new Map<string, any>()
    for (let i = 0; i < videoIds.length; i += BATCH) {
      const batch = videoIds.slice(i, i + BATCH)
      const { data } = await supabase.from('videos').select('id, youtube_id, title, channel_name, channel_id, view_count, duration, duration_sec, thumbnail_url, published_at').in('id', batch)
      for (const v of (data || []) as any[]) videoMap.set(v.id, v)
    }

    const btRes = await supabase.from('brand_tags').select('video_id, brand_name').in('video_id', videoIds).eq('campaign_id', campaignId)
    const taggedIds = new Set<string>()
    const btMap = new Map<string, string[]>()
    for (const bt of (btRes.data || []) as any[]) {
      taggedIds.add(bt.video_id)
      if (!btMap.has(bt.video_id)) btMap.set(bt.video_id, [])
      btMap.get(bt.video_id)!.push(bt.brand_name)
    }

    const kwTextMap = new Map<string, string>()
    const kwIds = [...new Set(allRanked.map((r: any) => r.keyword_id))]
    for (let i = 0; i < kwIds.length; i += BATCH) {
      const batch = kwIds.slice(i, i + BATCH)
      const { data } = await supabase.from('keywords').select('id, text').in('id', batch)
      for (const kw of (data || []) as any[]) kwTextMap.set(kw.id, kw.text)
    }

    const untagged = videoIds
      .filter(id => !taggedIds.has(id) && videoMap.has(id))
      .map(id => {
        const v = videoMap.get(id)
        const meta = videoKeywordMap.get(id)!
        return {
          ...v,
          tags: [],
          best_rank: meta.bestRank,
          keyword_names: meta.keywords.map(kid => kwTextMap.get(kid) || kid).slice(0, 3),
          keyword_count: meta.keywords.length,
          discovered_at: meta.discovered_at,
          last_seen_at: meta.last_seen_at,
        }
      })

    let filtered = untagged
    if (search) {
      const s = search.toLowerCase()
      filtered = untagged.filter((v: any) =>
        (v.title || '').toLowerCase().includes(s) ||
        (v.channel_name || '').toLowerCase().includes(s)
      )
    }

    filtered.sort((a: any, b: any) => (a.best_rank || 99) - (b.best_rank || 99))

    const total = filtered.length
    const paged = filtered.slice(offset, offset + limit)

    return NextResponse.json({ data: paged, total, page, limit })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Pending tagging API error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
