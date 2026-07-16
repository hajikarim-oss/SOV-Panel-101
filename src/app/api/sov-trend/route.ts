import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const metric = req.nextUrl.searchParams.get('metric') ?? 'views'
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30')

    // Get brand names
    const brandCond = campaignId ? 'WHERE cb.campaign_id = $1' : ''
    const bParams: any[] = campaignId ? [campaignId] : []
    const brands = await queryAll(`
      SELECT DISTINCT cb.name as brand_name
      FROM campaign_brands cb
      ${brandCond}
      ORDER BY cb.name
    `, bParams)

    // Build date range
    const dates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      dates.push(d.toISOString().split('T')[0])
    }

    if (brands.length === 0) return NextResponse.json({ data: [], brands: [] })

    // Check if we have snapshots
    let hasSnapshots = false
    if (campaignId) {
      const cnt = await queryOne(`SELECT COUNT(*) as c FROM view_snapshots WHERE campaign_id = $1`, [campaignId])
      hasSnapshots = (cnt?.c || 0) > 0
    }

    // Fetch snapshots for each brand per date
    const trendData = await Promise.all(dates.map(async (date) => {
      const row: Record<string, string | number> = { date }
      let total = 0
      const brandVals: Record<string, number> = {}

      for (const { brand_name } of brands) {
        const params: any[] = [brand_name, date]
        let idx = 3
        let campSql = ''
        if (campaignId) { campSql = `AND bt.campaign_id = $${idx++}`; params.push(campaignId) }

        const snap = await queryOne(`
          SELECT SUM(vs.view_count) as sv
          FROM view_snapshots vs
          INNER JOIN brand_tags bt ON bt.video_id = vs.video_id
          WHERE bt.brand_name = $1 AND vs.snapshot_date = $2 ${campSql}
        `, params)

        const val = snap?.sv ?? 0
        brandVals[brand_name] = val
        total += val
      }

      brands.forEach(({ brand_name }: any) => {
        row[brand_name] = total > 0 ? Math.round((brandVals[brand_name] / total) * 1000) / 10 : 0
      })
      return row
    }))

    const nonEmptyRows = trendData.filter(row =>
      brands.some((b: any) => (row[b.brand_name] as number) > 0)
    )

    return NextResponse.json({
      data: hasSnapshots && nonEmptyRows.length > 0 ? nonEmptyRows : trendData,
      brands: brands.map((b: any) => b.brand_name),
      has_scrape_data: hasSnapshots
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
