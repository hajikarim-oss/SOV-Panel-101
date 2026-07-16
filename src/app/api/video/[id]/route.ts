import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

// GET /api/video/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: youtubeId } = await params
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    // Main video record
    const video = await queryOne(`
      SELECT v.*, cv.first_seen_at, cv.campaign_id
      FROM videos v
      LEFT JOIN campaign_videos cv ON cv.video_id = v.id
      ${campaignId ? 'WHERE v.youtube_id = $1 AND cv.campaign_id = $2' : 'WHERE v.youtube_id = $1'}
      LIMIT 1
    `, campaignId ? [youtubeId, campaignId] : [youtubeId])

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Keyword rank appearances
    const kwRanks = await queryAll(`
      SELECT k.text as keyword_text, kv.rank, k.language
      FROM keyword_videos kv
      INNER JOIN keywords k ON k.id = kv.keyword_id
      WHERE kv.video_id = $1
      ${campaignId ? 'AND kv.campaign_id = $2' : ''}
      UNION ALL
      SELECT k.text as keyword_text, ks.rank, k.language
      FROM keyword_shorts ks
      INNER JOIN keywords k ON k.id = ks.keyword_id
      WHERE ks.video_id = $1
      ${campaignId ? 'AND ks.campaign_id = $2' : ''}
      ORDER BY rank ASC
    `, campaignId ? [video.id, campaignId] : [video.id])

    // Best rank across all keywords
    const bestRank = kwRanks.length > 0 ? Math.min(...kwRanks.map((k: any) => k.rank)) : null

    // View history from snapshots
    const viewHistory = await queryAll(`
      SELECT snapshot_date as date, view_count as views
      FROM view_snapshots
      WHERE video_id = $1
      ORDER BY snapshot_date ASC
      LIMIT 60
    `, [video.id])

    // Other videos from same channel in campaign
    const relatedVideos = await queryAll(`
      SELECT v.youtube_id, v.title, v.view_count, v.published_at
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      WHERE v.channel_name = $1 AND v.youtube_id != $2
      ${campaignId ? 'AND cv.campaign_id = $3' : ''}
      ORDER BY v.view_count DESC
      LIMIT 5
    `, campaignId ? [video.channel_name, youtubeId, campaignId] : [video.channel_name, youtubeId])

    // Brand tags for this video
    const tags = await queryAll(`
      SELECT brand_name FROM brand_tags WHERE video_id = $1
      ${campaignId ? 'AND campaign_id = $2' : ''}
    `, campaignId ? [video.id, campaignId] : [video.id])

    // AI brand analysis results
    const brandAnalysis = await queryAll(`
      SELECT brand_name, confidence, mention_type, context_quotes
      FROM brand_analysis WHERE video_id = $1
      ORDER BY confidence DESC
    `, [video.id])

    // Transcript status
    const transcript = await queryOne(`
      SELECT language, fetched_at FROM video_transcripts WHERE video_id = $1
    `, [video.id])

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
        first_seen_at: video.first_seen_at,
        is_short: (video.duration_sec || 0) < 240,
        description: video.description,
      },
      kwRanks,
      bestRank,
      viewHistory,
      relatedVideos,
      tags: tags.map((t: any) => t.brand_name),
      brandAnalysis: brandAnalysis.map((b: any) => ({
        ...b,
        context_quotes: typeof b.context_quotes === 'string' ? JSON.parse(b.context_quotes || '[]') : b.context_quotes || [],
      })),
      transcript: transcript || null,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
