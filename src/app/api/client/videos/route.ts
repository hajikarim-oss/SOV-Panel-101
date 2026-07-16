import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const brandName = req.nextUrl.searchParams.get('brand_name')
    if (!campaignId || !brandName) {
      return NextResponse.json({ error: 'campaign_id and brand_name are required' }, { status: 400 })
    }
    const decodedBrand = decodeURIComponent(brandName)

    const videos = await queryAll(`
      SELECT DISTINCT v.youtube_id, v.title, v.channel_name, v.view_count, v.published_at,
             MIN(kv.rank) as best_rank, COUNT(DISTINCT kv.keyword_id) as keyword_count,
             STRING_AGG(DISTINCT k.text, ',') as keywords_appeared
      FROM videos v
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = $1
      INNER JOIN (
        SELECT video_id, keyword_id, rank FROM keyword_videos
        UNION
        SELECT video_id, keyword_id, rank FROM keyword_shorts
      ) kv ON kv.video_id = v.id
      INNER JOIN keywords k ON k.id = kv.keyword_id
      WHERE bt.brand_name = $2
      GROUP BY v.id
      ORDER BY v.view_count DESC
      LIMIT 10
    `, [campaignId, decodedBrand])

    const enriched = videos.map((v: any) => ({
      ...v, keywords_appeared: v.keywords_appeared ? v.keywords_appeared.split(',') : [],
    }))

    return NextResponse.json({ data: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
