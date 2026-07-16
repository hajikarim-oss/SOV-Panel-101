import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: youtubeId } = await params
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    const { data: video } = await supabase.from('videos').select('*').eq('youtube_id', youtubeId).single()
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

    let firstSeenAt = null
    let videoCampaignId = null
    if (campaignId) {
      const { data: cv } = await supabase.from('campaign_videos').select('first_seen_at, campaign_id').eq('video_id', video.id).eq('campaign_id', campaignId).maybeSingle()
      firstSeenAt = cv?.first_seen_at || null
      videoCampaignId = cv?.campaign_id || null
    } else {
      const { data: cv } = await supabase.from('campaign_videos').select('first_seen_at, campaign_id').eq('video_id', video.id).order('first_seen_at', { ascending: false }).limit(1).maybeSingle()
      firstSeenAt = cv?.first_seen_at || null
      videoCampaignId = cv?.campaign_id || null
    }

    const [kvRes, ksRes] = await Promise.all([
      supabase.from('keyword_videos').select('keyword_id, rank').eq('video_id', video.id).then(async (r) => {
        if (!r.data || r.data.length === 0) return { data: [] }
        const kwIds = [...new Set(r.data.map((d: any) => d.keyword_id))]
        const { data: kws } = await supabase.from('keywords').select('id, text, language').in('id', kwIds)
        const kwMap = new Map((kws || []).map((k: any) => [k.id, k]))
        return { data: r.data.map((d: any) => ({ keyword_text: kwMap.get(d.keyword_id)?.text || d.keyword_id, rank: d.rank, language: kwMap.get(d.keyword_id)?.language || null })) }
      }),
      supabase.from('keyword_shorts').select('keyword_id, rank').eq('video_id', video.id).then(async (r) => {
        if (!r.data || r.data.length === 0) return { data: [] }
        const kwIds = [...new Set(r.data.map((d: any) => d.keyword_id))]
        const { data: kws } = await supabase.from('keywords').select('id, text, language').in('id', kwIds)
        const kwMap = new Map((kws || []).map((k: any) => [k.id, k]))
        return { data: r.data.map((d: any) => ({ keyword_text: kwMap.get(d.keyword_id)?.text || d.keyword_id, rank: d.rank, language: kwMap.get(d.keyword_id)?.language || null })) }
      }),
    ])

    const kwRanks = [...(kvRes.data || []), ...(ksRes.data || [])].sort((a: any, b: any) => a.rank - b.rank)
    const bestRank = kwRanks.length > 0 ? Math.min(...kwRanks.map((k: any) => k.rank)) : null

    const { data: viewHistory } = await supabase.from('view_snapshots').select('snapshot_date as date, view_count as views').eq('video_id', video.id).order('snapshot_date', { ascending: true }).limit(60)

    let relatedVideos: any[] = []
    if (video.channel_name) {
      let relQ = supabase.from('videos').select('youtube_id, title, view_count, published_at').eq('channel_name', video.channel_name).neq('youtube_id', youtubeId).order('view_count', { ascending: false }).limit(5)
      if (campaignId) {
        const { data: cvIds } = await supabase.from('campaign_videos').select('video_id').eq('campaign_id', campaignId)
        if (cvIds && cvIds.length > 0) {
          relQ = relQ.in('id', cvIds.map((c: any) => c.video_id))
        }
      }
      const { data: relData } = await relQ
      relatedVideos = relData || []
    }

    let tagQuery = supabase.from('brand_tags').select('brand_name').eq('video_id', video.id)
    if (campaignId) tagQuery = tagQuery.eq('campaign_id', campaignId)
    const { data: tagRows } = await tagQuery

    const { data: brandAnalysis } = await supabase.from('brand_analysis').select('brand_name, confidence, mention_type, context_quotes').eq('video_id', video.id).order('confidence', { ascending: false })

    const { data: transcript } = await supabase.from('video_transcripts').select('language, fetched_at').eq('video_id', video.id).maybeSingle()

    return NextResponse.json({
      video: {
        youtube_id: video.youtube_id,
        title: video.title,
        channel_name: video.channel_name,
        channel_id: video.channel_id,
        view_count: video.view_count,
        like_count: video.like_count,
        comment_count: video.comment_count,
        duration: video.duration,
        published_at: video.published_at,
        thumbnail_url: video.thumbnail_url,
        first_seen_at: firstSeenAt,
        is_short: (video.duration_sec || 0) < 240,
        description: video.description,
      },
      kwRanks,
      bestRank,
      viewHistory: viewHistory || [],
      relatedVideos,
      tags: (tagRows || []).map((t: any) => t.brand_name),
      brandAnalysis: (brandAnalysis || []).map((b: any) => ({
        ...b,
        context_quotes: typeof b.context_quotes === 'string' ? JSON.parse(b.context_quotes || '[]') : b.context_quotes || [],
      })),
      transcript: transcript || null,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Video detail API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
