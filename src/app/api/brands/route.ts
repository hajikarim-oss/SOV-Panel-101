import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    if (campaignId) {
      const list = await queryAll(`
        SELECT id, name, type, created_at FROM campaign_brands WHERE campaign_id = $1 ORDER BY created_at ASC
      `, [campaignId])

      const enriched = await Promise.all(list.map(async (b: any) => {
        const videoCountResult = await queryOne(`
          SELECT COUNT(DISTINCT bt.video_id) as cnt
          FROM brand_tags bt
          WHERE bt.brand_name = $1 AND bt.campaign_id = $2
        `, [b.name, campaignId])
        const videoCount = videoCountResult?.cnt ?? 0

        const viewResult = await queryOne(`
          SELECT COALESCE(SUM(v.view_count), 0)::bigint as total_views
          FROM brand_tags bt
          INNER JOIN videos v ON v.id = bt.video_id
          WHERE bt.brand_name = $1 AND bt.campaign_id = $2
        `, [b.name, campaignId])

        const freqResult = await queryOne(`
          SELECT COUNT(DISTINCT kv.keyword_id)::int as total_frequency
          FROM brand_tags bt
          LEFT JOIN keyword_videos kv ON kv.video_id = bt.video_id
          WHERE bt.brand_name = $1 AND bt.campaign_id = $2
        `, [b.name, campaignId])

        return {
          ...b,
          video_count: videoCount ?? 0,
          total_views: Number(viewResult?.total_views ?? 0),
          total_frequency: freqResult?.total_frequency ?? 0,
          sov_percent: 0,
          freq_sov_percent: 0,
          has_data: (videoCount ?? 0) > 0,
        }
      }))

      const totalViews = enriched.reduce((s, b) => s + (b.total_views || 0), 0) || 1
      const totalFreq = enriched.reduce((s, b) => s + (b.total_frequency || 0), 0) || 1
      const hasScrapeData = enriched.some(b => b.has_data)
      enriched.forEach(b => {
        if (hasScrapeData) {
          b.sov_percent = Math.round((b.total_views / totalViews) * 1000) / 10
          b.freq_sov_percent = Math.round((b.total_frequency / totalFreq) * 1000) / 10
        }
      })

      return NextResponse.json({ data: enriched, has_scrape_data: hasScrapeData })
    }

    // Legacy: no campaign
    const brands = await queryAll(`
      SELECT bt.brand_name, SUM(v.view_count)::bigint as total_views,
             COUNT(DISTINCT v.id)::int as video_count
      FROM brand_tags bt
      INNER JOIN videos v ON v.id = bt.video_id
      GROUP BY bt.brand_name
      ORDER BY total_views DESC
    `)

    const totalV = brands.reduce((s: number, b: any) => s + Number(b.total_views || 0), 0) || 1
    const result = brands.map((b: any) => ({
      brand_name: b.brand_name,
      brand_total_views: Number(b.total_views),
      brand_total_freq: 0,
      sov_percent: Math.round((Number(b.total_views) / totalV) * 1000) / 10,
      freq_sov_percent: 0,
      video_count: b.video_count,
      has_data: true,
    }))

    return NextResponse.json({ data: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaign_id, name, type } = body
    if (!campaign_id || !name) return NextResponse.json({ error: 'campaign_id and name required' }, { status: 400 })

    await queryOne(
      `INSERT INTO campaign_brands (campaign_id, name, type)
       VALUES ($1, $2, $3)
       ON CONFLICT (campaign_id, name) DO NOTHING`,
      [campaign_id, name.trim(), type ?? 'competitor']
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, campaign_id } = body
    if (!id || !campaign_id) return NextResponse.json({ error: 'id and campaign_id required' }, { status: 400 })

    await queryOne(`DELETE FROM campaign_brands WHERE id = $1 AND campaign_id = $2`, [id, campaign_id])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
