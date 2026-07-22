import { NextRequest, NextResponse } from 'next/server'
import { supabase, queryAll } from '@/lib/supabase'
import { getCached, CACHE_TTL } from '@/lib/cache'
import { authorizeCampaignAccess } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const cid = req.nextUrl.searchParams.get('campaign_id')
    const month = req.nextUrl.searchParams.get('month') // YYYY-MM format

    const { authorized, error } = await authorizeCampaignAccess(req, cid)
    if (!authorized) return error
    if (!cid) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const data = await getCached(
      `analytics-calendar:${cid}:${month || 'current'}`,
      () => fetchCalendarData(cid!, month),
      CACHE_TTL.overview_kpis
    )
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Analytics Calendar API error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchCalendarData(cid: string, monthParam: string | null) {
  const now = new Date()
  const targetMonth = monthParam
    ? new Date(monthParam + '-01')
    : new Date(now.getFullYear(), now.getMonth(), 1)

  const year = targetMonth.getFullYear()
  const month = targetMonth.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const startDate = monthStart.toISOString().split('T')[0]
  const endDate = monthEnd.toISOString().split('T')[0]

  // Look back 30 days before month start for ranking comparisons
  const lookbackDate = new Date(monthStart.getTime() - 30 * 86400000).toISOString().split('T')[0]

  // Also get previous month for comparison
  const prevMonthStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const prevMonthEnd = new Date(year, month, 0).toISOString().split('T')[0]

  const [
    dailyViews,
    dailyNewVideos,
    dailyKeywords,
    scrapeJobs,
    brandSOVTrend,
    rankingChanges,
    monthSummary,
    prevMonthViews,
  ] = await Promise.all([
    // Daily view snapshots for the month
    queryAll<{ snapshot_date: string; total_views: number }>(`
      SELECT snapshot_date::TEXT, SUM(view_count)::BIGINT as total_views
      FROM view_snapshots
      WHERE campaign_id = $1 AND snapshot_date >= $2::date AND snapshot_date <= $3::date
      GROUP BY snapshot_date ORDER BY snapshot_date ASC
    `, [cid, startDate, endDate]),

    // Daily new videos discovered
    queryAll<{ date: string; count: number }>(`
      SELECT DATE(first_seen_at)::TEXT as date, COUNT(*)::INT as count
      FROM campaign_videos
      WHERE campaign_id = $1 AND DATE(first_seen_at) >= $2 AND DATE(first_seen_at) <= $3
      GROUP BY DATE(first_seen_at) ORDER BY DATE(first_seen_at) ASC
    `, [cid, startDate, endDate]),

    // Daily keywords added
    queryAll<{ date: string; count: number }>(`
      SELECT DATE(created_at)::TEXT as date, COUNT(*)::INT as count
      FROM keywords
      WHERE campaign_id = $1 AND DATE(created_at) >= $2 AND DATE(created_at) <= $3
      GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC
    `, [cid, startDate, endDate]),

    // Scrape jobs per day
    queryAll<{ date: string; count: number; results: number }>(`
      SELECT DATE(completed_at)::TEXT as date, COUNT(*)::INT as count, SUM(results_count)::INT as results
      FROM scrape_jobs
      WHERE campaign_id = $1 AND status = 'completed' AND DATE(completed_at) >= $2 AND DATE(completed_at) <= $3
      GROUP BY DATE(completed_at) ORDER BY DATE(completed_at) ASC
    `, [cid, startDate, endDate]),

    // Brand SOV daily for top brands (from view_snapshots + brand_tags)
    queryAll<{ date: string; brand: string; views: number }>(`
      SELECT
        vs.snapshot_date::TEXT as date,
        bt.brand_name as brand,
        SUM(vs.view_count)::BIGINT as views
      FROM view_snapshots vs
      JOIN brand_tags bt ON bt.video_id = vs.video_id AND bt.campaign_id = vs.campaign_id
      WHERE vs.campaign_id = $1
        AND vs.snapshot_date >= $2::date AND vs.snapshot_date <= $3::date
      GROUP BY vs.snapshot_date, bt.brand_name
      ORDER BY vs.snapshot_date ASC, views DESC
    `, [cid, startDate, endDate]),

    // Ranking changes: compare each day's rank vs previous day
    queryAll<{ date: string; keyword: string; brand: string; old_rank: number; new_rank: number; video_title: string; channel: string; view_count: number }>(`
      WITH daily_ranks AS (
        SELECT
          kv.discovered_at::DATE as day,
          k.text as keyword,
          v.channel_name as brand,
          kv.rank,
          v.title as video_title,
          v.channel_name as channel,
          v.view_count,
          ROW_NUMBER() OVER (PARTITION BY kv.keyword_id, kv.discovered_at::DATE ORDER BY kv.rank ASC) as rn
        FROM keyword_videos kv
        JOIN keywords k ON k.id = kv.keyword_id
        JOIN videos v ON v.id = kv.video_id
        WHERE kv.campaign_id = $1
          AND kv.discovered_at >= $2 AND kv.discovered_at <= $3
      ),
      ranked AS (
        SELECT * FROM daily_ranks WHERE rn <= 5
      ),
      with_prev AS (
        SELECT
          r.*,
          LAG(r.rank) OVER (PARTITION BY r.keyword, r.day ORDER BY r.day) as prev_rank
        FROM ranked r
      )
      SELECT
        day::TEXT as date,
        keyword,
        brand,
        prev_rank as old_rank,
        rank as new_rank,
        video_title,
        channel,
        view_count
      FROM with_prev
      WHERE prev_rank IS NOT NULL AND prev_rank != rank
      ORDER BY day DESC, ABS(rank - prev_rank) DESC
      LIMIT 200
    `, [cid, lookbackDate, endDate]),

    // Month summary totals
    queryAll<{ total_views: number; total_videos: number; total_keywords: number }>(`
      SELECT
        COALESCE(SUM(vs.view_count), 0)::BIGINT as total_views,
        (SELECT COUNT(DISTINCT cv.video_id) FROM campaign_videos cv
         WHERE cv.campaign_id = $1 AND DATE(cv.first_seen_at) >= $2 AND DATE(cv.first_seen_at) <= $3) as total_videos,
        (SELECT COUNT(*)::INT FROM keywords k
         WHERE k.campaign_id = $1 AND DATE(k.created_at) >= $2 AND DATE(k.created_at) <= $3) as total_keywords
      FROM view_snapshots vs
      WHERE vs.campaign_id = $1 AND vs.snapshot_date >= $2::date AND vs.snapshot_date <= $3::date
    `, [cid, startDate, endDate]),

    // Previous month views for comparison
    queryAll<{ total_views: number }>(`
      SELECT COALESCE(SUM(view_count), 0)::BIGINT as total_views
      FROM view_snapshots
      WHERE campaign_id = $1 AND snapshot_date >= $2::date AND snapshot_date <= $3::date
    `, [cid, prevMonthStart, prevMonthEnd]),
  ])

  // Assemble daily data map
  const daysInMonth = monthEnd.getDate()
  const dailyData: Record<string, any> = {}

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dailyData[dateStr] = {
      date: dateStr,
      views: 0,
      newVideos: 0,
      keywordsAdded: 0,
      scrapeJobs: 0,
      scrapeResults: 0,
      rankings: [],
      topBrands: [],
    }
  }

  for (const row of dailyViews) {
    if (dailyData[row.snapshot_date]) dailyData[row.snapshot_date].views = Number(row.total_views) || 0
  }
  for (const row of dailyNewVideos) {
    if (dailyData[row.date]) dailyData[row.date].newVideos = row.count || 0
  }
  for (const row of dailyKeywords) {
    if (dailyData[row.date]) dailyData[row.date].keywordsAdded = row.count || 0
  }
  for (const row of scrapeJobs) {
    if (dailyData[row.date]) {
      dailyData[row.date].scrapeJobs = row.count || 0
      dailyData[row.date].scrapeResults = row.results || 0
    }
  }

  // Brand SOV per day
  const brandByDay: Record<string, Record<string, number>> = {}
  for (const row of brandSOVTrend) {
    if (!brandByDay[row.date]) brandByDay[row.date] = {}
    brandByDay[row.date][row.brand] = Number(row.views) || 0
  }
  for (const [date, brands] of Object.entries(brandByDay)) {
    if (!dailyData[date]) continue
    const total = Object.values(brands).reduce((s, v) => s + v, 0) || 1
    dailyData[date].topBrands = Object.entries(brands)
      .map(([brand, views]) => ({ brand, views, sov: Math.round((views / total) * 1000) / 10 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
  }

  // Rankings per day
  const rankByDay: Record<string, any[]> = {}
  for (const row of rankingChanges) {
    if (!rankByDay[row.date]) rankByDay[row.date] = []
    if (rankByDay[row.date].length < 10) {
      rankByDay[row.date].push({
        keyword: row.keyword,
        brand: row.brand,
        oldRank: row.old_rank,
        newRank: row.new_rank,
        movement: row.old_rank - row.new_rank,
        videoTitle: row.video_title,
        channel: row.channel,
        viewCount: row.view_count,
      })
    }
  }
  for (const [date, rankings] of Object.entries(rankByDay)) {
    if (dailyData[date]) dailyData[date].rankings = rankings
  }

  const totalViews = Number(monthSummary[0]?.total_views) || 0
  const prevViews = Number(prevMonthViews[0]?.total_views) || 0
  const viewsGrowth = prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 1000) / 10 : 0

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    monthLabel: targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    days: Object.values(dailyData),
    summary: {
      totalViews,
      totalVideos: Number(monthSummary[0]?.total_videos) || 0,
      totalKeywords: Number(monthSummary[0]?.total_keywords) || 0,
      viewsGrowth,
      avgDailyViews: Math.round(totalViews / daysInMonth),
      daysWithScrapes: scrapeJobs.length,
      totalRankingChanges: rankingChanges.length,
    },
  }
}
