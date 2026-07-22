import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { authorizeCampaignAccess } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const brandName = req.nextUrl.searchParams.get('brand_name')
    const { authorized, error: authError } = await authorizeCampaignAccess(req, campaignId)
    if (!authorized) return authError!
    if (!campaignId || !brandName) {
      return NextResponse.json({ error: 'campaign_id and brand_name are required' }, { status: 400 })
    }
    const decodedBrand = decodeURIComponent(brandName)

    const weekStart = new Date()
    const day = weekStart.getDay()
    const diff = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diff)
    const currentWeekStart = weekStart.toISOString().split('T')[0]

    const dropped = await queryAll(`
      SELECT v.youtube_id, v.title, v.channel_name, h.rank as last_rank, h.week_start as last_seen_date, k.text as keyword
      FROM keyword_rank_history h
      INNER JOIN videos v ON v.id = h.video_id
      INNER JOIN keywords k ON k.id = h.keyword_id
      INNER JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = h.campaign_id
      WHERE h.campaign_id = $1 AND bt.brand_name = $2
        AND h.video_id NOT IN (
          SELECT video_id FROM keyword_videos WHERE campaign_id = $1
          UNION
          SELECT video_id FROM keyword_shorts WHERE campaign_id = $1
        )
      ORDER BY h.recorded_at DESC
      LIMIT 10
    `, [campaignId, decodedBrand])

    return NextResponse.json({ data: dropped })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
