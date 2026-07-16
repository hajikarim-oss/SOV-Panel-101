import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandName: string }> }) {
  try {
    const { brandName } = await params
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const decodedBrand = decodeURIComponent(brandName)

    // 1. Campaign stats for this brand
    const uniqueStats = await queryOne(`
      SELECT COUNT(DISTINCT v.youtube_id) as unique_videos, SUM(v.view_count) as unique_views
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = cv.campaign_id
      WHERE cv.campaign_id = $1 AND bt.brand_name = $2
    `, [campaignId, decodedBrand])

    const totalStats = await queryOne(`
      SELECT COUNT(DISTINCT v.id) as total_videos, SUM(v.view_count) as total_views
      FROM videos v
      INNER JOIN (
        SELECT video_id, campaign_id FROM keyword_videos
        UNION
        SELECT video_id, campaign_id FROM keyword_shorts
      ) kv ON kv.video_id = v.id
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = kv.campaign_id
      WHERE kv.campaign_id = $1 AND bt.brand_name = $2
    `, [campaignId, decodedBrand])

    // 2. Growth rates
    const today = new Date().toISOString().split('T')[0]
    const d7ago = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const d30ago = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const getSnap = async (date: string) => await queryOne(`
      SELECT SUM(vs.view_count) as sv
      FROM view_snapshots vs
      INNER JOIN brand_tags bt ON bt.video_id = vs.video_id AND bt.campaign_id = vs.campaign_id
      WHERE vs.snapshot_date = $1 AND vs.campaign_id = $2 AND bt.brand_name = $3
    `, [date, campaignId, decodedBrand])

    const nowV = (await getSnap(today))?.sv || uniqueStats?.unique_views || 0
    const v7 = (await getSnap(d7ago))?.sv || 0
    const v30 = (await getSnap(d30ago))?.sv || 0
    const pctChange = (now: number, prev: number) => prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : 0

    // 3. Top videos for the brand
    const topVideos = await queryAll(`
      SELECT DISTINCT v.youtube_id, v.title, v.channel_name, v.view_count, v.published_at,
             MIN(COALESCE(kv.rank, ks.rank)) as best_rank,
             COUNT(DISTINCT COALESCE(kv.keyword_id, ks.keyword_id)) as keywords_count
      FROM videos v
      INNER JOIN brand_tags bt ON bt.video_id = v.id
      LEFT JOIN keyword_videos kv ON kv.video_id = v.id
      LEFT JOIN keyword_shorts ks ON ks.video_id = v.id
      WHERE bt.campaign_id = $1 AND bt.brand_name = $2
      GROUP BY v.id
      ORDER BY v.view_count DESC
      LIMIT 10
    `, [campaignId, decodedBrand])

    // 4. Top keywords for the brand
    const topKeywords = await queryAll(`
      SELECT k.text as keyword, MIN(COALESCE(kv.rank, ks.rank)) as best_rank,
             COUNT(DISTINCT v.id) as brand_videos_count
      FROM keywords k
      INNER JOIN keyword_videos kv ON kv.keyword_id = k.id
      LEFT JOIN keyword_shorts ks ON ks.keyword_id = k.id
      INNER JOIN videos v ON v.id = COALESCE(kv.video_id, ks.video_id)
      INNER JOIN brand_tags bt ON bt.video_id = v.id
      WHERE bt.campaign_id = $1 AND bt.brand_name = $2
      GROUP BY k.id, k.text
      ORDER BY brand_videos_count DESC
      LIMIT 10
    `, [campaignId, decodedBrand])

    // 5. Language Breakdown
    const langBreakdown = await queryAll(`
      SELECT k.language, COUNT(DISTINCT v.id) as video_count
      FROM keywords k
      INNER JOIN keyword_videos kv ON kv.keyword_id = k.id
      LEFT JOIN keyword_shorts ks ON ks.keyword_id = k.id
      INNER JOIN videos v ON v.id = COALESCE(kv.video_id, ks.video_id)
      INNER JOIN brand_tags bt ON bt.video_id = v.id
      WHERE bt.campaign_id = $1 AND bt.brand_name = $2
      GROUP BY k.language
    `, [campaignId, decodedBrand])

    return NextResponse.json({
      metrics: {
        total_videos: totalStats?.total_videos || 0,
        unique_videos: uniqueStats?.unique_videos || 0,
        total_views: totalStats?.total_views || 0,
        unique_views: uniqueStats?.unique_views || 0,
        growth_7d: pctChange(nowV, v7),
        growth_30d: pctChange(nowV, v30),
      },
      topVideos, topKeywords, langBreakdown,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
