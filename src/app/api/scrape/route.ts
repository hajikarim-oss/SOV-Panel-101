import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { scrapeKeyword } from '@/lib/scrape-pipeline-pg'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, keyword_id } = await req.json()
    if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const kwFilter = keyword_id ? `AND id = $2` : ''
    const params: any[] = [campaign_id]
    if (keyword_id) params.push(keyword_id)

    const keywords = await queryAll<any>(
      `SELECT * FROM keywords WHERE campaign_id = $1 AND status = 'active' ${kwFilter}`,
      params
    )

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'No active keywords found' }, { status: 400 })
    }

    const keys = await queryAll<any>(
      `SELECT id FROM api_keys WHERE is_active = TRUE AND units_limit >= 100`
    )

    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'NO_API_KEYS: All API keys are exhausted for today' }, { status: 503 })
    }

    const results: Array<{ keyword: string; ranked: number; quota_cost: number; error?: string }> = []

    for (const kw of keywords) {
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
        results.push({ keyword: kw.text, ranked: result.ranked, quota_cost: result.quota_cost })
      } catch (err: any) {
        console.error(`Scrape failed for keyword "${kw.text}":`, err)
        await queryAll(
          `UPDATE scrape_jobs SET status = 'failed', error_msg = $1, completed_at = $2 WHERE id = $3`,
          [err.message?.substring(0, 500) || 'Unknown error', new Date().toISOString(), jobId]
        )
        results.push({ keyword: kw.text, ranked: 0, quota_cost: 0, error: err.message?.substring(0, 200) })
      }
    }

    const totalRanked = results.reduce((s, r) => s + r.ranked, 0)
    const totalQuota = results.reduce((s, r) => s + r.quota_cost, 0)

    return NextResponse.json({
      ok: true,
      message: `Scraped ${results.length} keyword(s): ${totalRanked} videos ranked, ${totalQuota} quota units used.`,
      results,
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
