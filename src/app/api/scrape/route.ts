import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { scrapeKeyword } from '@/lib/scrape-pipeline-pg'
import { authorizeCampaignAccess } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, keyword_id, limit = 2 } = await req.json()

    const { authorized, error } = await authorizeCampaignAccess(req, campaign_id)
    if (!authorized) return error
    if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    // 1. Clean up any scrape_jobs stuck in 'running' for more than 5 minutes (from timed-out requests)
    await queryAll(
      `UPDATE scrape_jobs SET status = 'failed', error_msg = 'Timed out — request did not complete', completed_at = $1
       WHERE status = 'running' AND started_at < NOW() - INTERVAL '5 minutes'`,
      [new Date().toISOString()]
    )

    // 2. Build keyword filter — skip keywords scraped in the last 12 hours
    let kwFilter = `AND status = 'active'`
    const params: any[] = [campaign_id]

    if (keyword_id) {
      kwFilter += ` AND id = $2`
      params.push(keyword_id)
    } else {
      kwFilter += ` AND (last_scraped_at IS NULL OR last_scraped_at < NOW() - INTERVAL '12 hours')`
    }

    const keywords = await queryAll<any>(
      `SELECT * FROM keywords WHERE campaign_id = $1 ${kwFilter}`,
      params
    )

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({
        ok: true,
        message: keyword_id
          ? 'Keyword not found or already scraped recently'
          : 'All active keywords were scraped within the last 12 hours. Nothing to do.',
        results: [],
        remaining: 0,
        total: 0,
      })
    }

    // 3. Check for available API keys
    const keys = await queryAll<any>(
      `SELECT id FROM api_keys WHERE is_active = TRUE AND (units_used + 100) <= units_limit`
    )

    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'NO_API_KEYS: All API keys are exhausted for today' }, { status: 503 })
    }

    // 4. Process batch in parallel
    const batch = keywords.slice(0, Math.min(limit, keywords.length))
    const remaining = keywords.length - batch.length

    const scrapeJobs = batch.map(async (kw: any) => {
      const jobId = `scrape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      await queryAll(
        `INSERT INTO scrape_jobs (id, campaign_id, keyword_id, keyword_text, status, job_type, started_at)
         VALUES ($1, $2, $3, $4, 'running', 'keyword_scrape', $5)`,
        [jobId, campaign_id, kw.id, kw.text, new Date().toISOString()]
      )

      try {
        const result = await scrapeKeyword(campaign_id, kw.id, kw.text)
        await queryAll(
          `UPDATE scrape_jobs SET status = 'completed', results_count = $1, quota_used = $2, completed_at = $3 WHERE id = $4`,
          [result.ranked, result.quota_cost, new Date().toISOString(), jobId]
        )
        return { keyword: kw.text, ranked: result.ranked, quota_cost: result.quota_cost }
      } catch (err: any) {
        console.error(`Scrape failed for keyword "${kw.text}":`, err)
        await queryAll(
          `UPDATE scrape_jobs SET status = 'failed', error_msg = $1, completed_at = $2 WHERE id = $3`,
          [err.message?.substring(0, 500) || 'Unknown error', new Date().toISOString(), jobId]
        )
        return { keyword: kw.text, ranked: 0, quota_cost: 0, error: err.message?.substring(0, 200) }
      }
    })

    const results = await Promise.all(scrapeJobs)

    const totalRanked = results.reduce((s, r) => s + r.ranked, 0)
    const totalQuota = results.reduce((s, r) => s + r.quota_cost, 0)

    return NextResponse.json({
      ok: true,
      message: remaining > 0
        ? `Scraped ${results.length} of ${keywords.length} keyword(s). ${remaining} remaining — call again to continue.`
        : `Scraped ${results.length} keyword(s): ${totalRanked} videos ranked, ${totalQuota} quota units used.`,
      results,
      remaining,
      total: keywords.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const campaignFilter = campaignId ? `WHERE campaign_id = $1` : ''
    const params = campaignId ? [campaignId] : []

    const jobs = await queryAll<any>(
      `SELECT * FROM scrape_jobs ${campaignFilter} ORDER BY created_at DESC LIMIT 50`,
      params
    )

    const statsData = await queryAll<any>(`SELECT status, results_count, quota_used FROM scrape_jobs`)

    const stats = {
      total: statsData?.length || 0,
      running: statsData?.filter((j: any) => j.status === 'running').length || 0,
      completed: statsData?.filter((j: any) => j.status === 'completed').length || 0,
      failed: statsData?.filter((j: any) => j.status === 'failed').length || 0,
      total_results: statsData?.reduce((sum: number, j: any) => sum + (j.results_count || 0), 0) || 0,
      total_quota_used: statsData?.reduce((sum: number, j: any) => sum + (j.quota_used || 0), 0) || 0,
    }

    return NextResponse.json({ jobs, stats })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
