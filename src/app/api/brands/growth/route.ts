import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const metric = req.nextUrl.searchParams.get('metric') ?? 'views'
    const period = req.nextUrl.searchParams.get('period') ?? '7d'

    const periodDays = period === '24h' ? 1 : period === '30d' ? 30 : 7
    const today = new Date().toISOString().split('T')[0]
    const periodStart = new Date(Date.now() - periodDays * 86400000).toISOString().split('T')[0]
    const prevStart = new Date(Date.now() - periodDays * 2 * 86400000).toISOString().split('T')[0]

    // Check if brand_tags has data
    let hasBrandTagData = false
    if (campaignId) {
      const cnt = await queryOne(`SELECT COUNT(*) as cnt FROM brand_tags WHERE campaign_id = $1`, [campaignId])
      hasBrandTagData = (cnt?.cnt || 0) > 0
    }

    // No scraped data - return registered brands with zeroes
    if (!hasBrandTagData && campaignId) {
      const registered = await queryAll(`
        SELECT name as brand_name FROM campaign_brands WHERE campaign_id = $1 ORDER BY created_at ASC
      `, [campaignId])

      const fallback = registered.map((b: any, i: number) => ({
        brand_name: b.brand_name, currentValue: 0, previousValue: 0,
        growthPercent: 0, rankMovement: 0, currentRank: i + 1,
        sparklineData: new Array(periodDays).fill(0), video_count: 0, has_data: false,
      }))

      return NextResponse.json({ data: fallback, period, has_scrape_data: false })
    }

    // Get brands with data
    const where = campaignId ? 'WHERE bt.campaign_id = $1' : ''
    const params: any[] = campaignId ? [campaignId] : []
    const metricOrder = metric === 'views' ? 'current_views DESC' : 'total_frequency DESC'

    const brands = await queryAll(`
      SELECT bt.brand_name, SUM(v.view_count) as current_views,
             COUNT(DISTINCT v.id) as video_count,
             COUNT(DISTINCT kv.keyword_id) as total_frequency
      FROM brand_tags bt
      INNER JOIN videos v ON v.id = bt.video_id
      LEFT JOIN (
        SELECT video_id, keyword_id FROM keyword_videos
        UNION
        SELECT video_id, keyword_id FROM keyword_shorts
      ) kv ON kv.video_id = v.id
      ${where}
      GROUP BY bt.brand_name
      ORDER BY ${metricOrder}
    `, params)

    const enriched = await Promise.all(brands.map(async (b: any, currentRank: number) => {
      // Recent and previous period snapshots
      const recentParams: any[] = [b.brand_name, periodStart, today]
      const prevParams: any[] = [b.brand_name, prevStart, periodStart]
      let rcSql = '', pcSql = '', rfSql = '', pfSql = ''

      if (campaignId) {
        rcSql = `AND bt.campaign_id = $4`
        recentParams.push(campaignId)
        pcSql = `AND bt.campaign_id = $4`
        prevParams.push(campaignId)
      }

      const recentSnap = await queryOne(`
        SELECT SUM(vs.view_count) as sv FROM view_snapshots vs
        INNER JOIN brand_tags bt ON bt.video_id = vs.video_id
        WHERE bt.brand_name = $1 AND vs.snapshot_date >= $2 AND vs.snapshot_date <= $3 ${rcSql}
      `, recentParams)

      const previousSnap = await queryOne(`
        SELECT SUM(vs.view_count) as sv FROM view_snapshots vs
        INNER JOIN brand_tags bt ON bt.video_id = vs.video_id
        WHERE bt.brand_name = $1 AND vs.snapshot_date >= $2 AND vs.snapshot_date < $3 ${pcSql}
      `, prevParams)

      const recentVal = metric === 'views' ? (recentSnap?.sv ?? 0) : 0
      const previousVal = metric === 'views' ? (previousSnap?.sv ?? 0) : 0
      const growthPercent = previousVal > 0
        ? parseFloat((((recentVal - previousVal) / previousVal) * 100).toFixed(1))
        : 0

      // Sparkline data
      const sparkDays: number[] = []
      for (let i = periodDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
        const sparkParams: any[] = [b.brand_name, d]
        let scSql = ''
        if (campaignId) { scSql = 'AND bt.campaign_id = $3'; sparkParams.push(campaignId) }

        const snap = await queryOne(`
          SELECT SUM(vs.view_count) as sv FROM view_snapshots vs
          INNER JOIN brand_tags bt ON bt.video_id = vs.video_id
          WHERE bt.brand_name = $1 AND vs.snapshot_date = $2 ${scSql}
        `, sparkParams)
        sparkDays.push(snap?.sv ?? 0)
      }

      const currentVal = metric === 'views' ? (b.current_views ?? 0) : (b.total_frequency ?? 0)
      return {
        brand_name: b.brand_name, currentValue: currentVal,
        previousValue: previousVal || recentVal, growthPercent,
        rankMovement: 0, currentRank: currentRank + 1,
        sparklineData: sparkDays, video_count: b.video_count ?? 0, has_data: true,
      }
    }))

    // Rank movement
    const prevOrder = [...enriched].sort((a, b) => b.previousValue - a.previousValue)
    const prevRankMap = new Map(prevOrder.map((b, i) => [b.brand_name, i + 1]))
    enriched.forEach((b, i) => {
      const prevRank = prevRankMap.get(b.brand_name) ?? i + 1
      b.rankMovement = prevRank - (i + 1)
    })

    return NextResponse.json({ data: enriched, period, has_scrape_data: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
