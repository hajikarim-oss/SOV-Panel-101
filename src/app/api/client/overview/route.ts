import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const brandName = req.nextUrl.searchParams.get('brand_name')
    if (!campaignId || !brandName) {
      return NextResponse.json({ error: 'campaign_id and brand_name are required' }, { status: 400 })
    }
    const decodedBrand = decodeURIComponent(brandName)

    // 1. Total/Unique brand videos and views
    const stats = await queryOne(`
      SELECT COUNT(DISTINCT v.youtube_id) as unique_videos, SUM(v.view_count) as unique_views
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = cv.campaign_id
      WHERE cv.campaign_id = $1 AND bt.brand_name = $2
    `, [campaignId, decodedBrand])

    // 2. Share of Voice Percentage
    const totalViewsResult = await queryOne(`
      SELECT SUM(v.view_count) as total_views
      FROM videos v
      INNER JOIN campaign_videos cv ON cv.video_id = v.id
      WHERE cv.campaign_id = $1
    `, [campaignId])
    const totalViews = totalViewsResult?.total_views || 1
    const sovPercent = parseFloat((((stats?.unique_views || 0) / totalViews) * 100).toFixed(1))

    // 3. Competitor Pie Chart Data
    const competitors = await queryAll(`
      SELECT bt.brand_name as name, SUM(v.view_count) as value
      FROM brand_tags bt
      INNER JOIN videos v ON v.id = bt.video_id
      WHERE bt.campaign_id = $1
      GROUP BY bt.brand_name
      ORDER BY value DESC
    `, [campaignId])

    const compTotal = competitors.reduce((acc: number, c: any) => acc + c.value, 0) || 1
    const competitorPie = competitors.map((c: any) => ({
      name: c.name, value: c.value,
      sov_percent: parseFloat(((c.value / compTotal) * 100).toFixed(1))
    }))

    // 4. Keyword Rankings
    const keywordRankings = await queryAll(`
      SELECT k.text as keyword, MIN(kv.rank) as best_rank, MAX(v.view_count) as top_views, k.type, k.language
      FROM keywords k
      INNER JOIN (
        SELECT video_id, keyword_id, rank FROM keyword_videos
        UNION
        SELECT video_id, keyword_id, rank FROM keyword_shorts
      ) kv ON kv.keyword_id = k.id
      INNER JOIN videos v ON v.id = kv.video_id
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = k.campaign_id
      WHERE k.campaign_id = $1 AND bt.brand_name = $2
      GROUP BY k.id, k.text, k.type, k.language
      ORDER BY best_rank ASC
    `, [campaignId, decodedBrand])

    return NextResponse.json({
      metrics: {
        unique_videos: stats?.unique_videos || 0,
        unique_views: stats?.unique_views || 0,
        sov_percent: sovPercent,
        total_keywords: keywordRankings.length
      },
      competitorPie, keywordRankings
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
