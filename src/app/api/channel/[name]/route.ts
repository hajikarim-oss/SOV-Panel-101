import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const channelName = decodeURIComponent(name)
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    const videos = await queryAll(`
      SELECT v.youtube_id, v.title, v.view_count, v.like_count,
             v.published_at, (v.duration_sec < 240) as is_short, v.channel_id,
             MIN(COALESCE(kv.rank, ks.rank)) as best_rank,
             COUNT(DISTINCT COALESCE(kv.keyword_id, ks.keyword_id)) as keyword_count
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      LEFT JOIN keyword_videos kv ON kv.video_id = v.id
      LEFT JOIN keyword_shorts ks ON ks.video_id = v.id
      WHERE v.channel_name = $1
      ${campaignId ? 'AND cv.campaign_id = $2' : ''}
      GROUP BY v.id
      ORDER BY v.view_count DESC
      LIMIT 50
    `, campaignId ? [channelName, campaignId] : [channelName])

    if (videos.length === 0) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

    const totalViews = videos.reduce((s: number, v: any) => s + (v.view_count || 0), 0)
    const avgViews = Math.round(totalViews / videos.length)
    const bestRank = videos.map(v => v.best_rank).filter(Boolean).reduce((a: number, b: number) => Math.min(a, b), 999)
    const channelId = videos[0]?.channel_id ?? null
    const totalLikes = videos.reduce((s: number, v: any) => s + (v.like_count || 0), 0)

    const totalCampaignViewsResult = await queryOne(`
      SELECT SUM(v.view_count) as tv FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      ${campaignId ? 'WHERE cv.campaign_id = $1' : ''}
    `, campaignId ? [campaignId] : [])
    const totalCampaignViews = totalCampaignViewsResult?.tv || 1
    const sovPercent = Math.round((totalViews / totalCampaignViews) * 10000) / 100

    // Keywords this channel ranks for
    const keywords = await queryAll(`
      SELECT k.text, MIN(COALESCE(kv.rank, ks.rank)) as rank, COUNT(DISTINCT v.id) as video_count
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      LEFT JOIN keyword_videos kv ON kv.video_id = v.id
      LEFT JOIN keyword_shorts ks ON ks.video_id = v.id
      LEFT JOIN keywords k ON k.id = COALESCE(kv.keyword_id, ks.keyword_id)
      WHERE v.channel_name = $1
      ${campaignId ? 'AND cv.campaign_id = $2' : ''}
      GROUP BY k.text
      HAVING MIN(COALESCE(kv.rank, ks.rank)) IS NOT NULL
      ORDER BY rank ASC
      LIMIT 20
    `, campaignId ? [channelName, campaignId] : [channelName])

    // Brands mentioned
    const brandRows = await queryAll(`
      SELECT DISTINCT bt.brand_name
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = cv.campaign_id
      WHERE v.channel_name = $1
      ${campaignId ? 'AND cv.campaign_id = $2' : ''}
    `, campaignId ? [channelName, campaignId] : [channelName])

    return NextResponse.json({
      channelName, channelId, videoCount: videos.length,
      totalViews, avgViews,
      bestRank: bestRank < 999 ? bestRank : null,
      sovPercent, totalLikes, keywords,
      brands: brandRows.map((r: any) => r.brand_name),
      videos: videos.map((v: any) => ({
        youtube_id: v.youtube_id, title: v.title,
        view_count: v.view_count, like_count: v.like_count,
        published_at: v.published_at, is_short: v.is_short === true,
        best_rank: v.best_rank, keyword_count: v.keyword_count,
      }))
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
