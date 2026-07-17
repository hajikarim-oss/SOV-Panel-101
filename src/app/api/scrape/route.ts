import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { getQueue, QUEUE_NAMES, getJobCounts, ScrapeJobData } from '@/lib/queue'
import { scrapeKeyword } from '@/lib/scrape-pipeline-pg'

async function tryEnqueue(campaignId: string, keywordId: string, keywordText: string, jobId: string): Promise<boolean> {
  try {
    const queue = getQueue<ScrapeJobData>(QUEUE_NAMES.KEYWORD_SCRAPE)
    await queue.add(QUEUE_NAMES.KEYWORD_SCRAPE, {
      campaignId,
      keywordId,
      keywordText,
      archiveBefore: true,
    }, { jobId, priority: 1 })
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, keyword_id } = await req.json()
    if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    const kwFilter = keyword_id ? `AND id = '${keyword_id.replace(/'/g, "''")}'` : ''
    const keywords = await queryAll<any>(
      `SELECT * FROM keywords WHERE campaign_id = $1 AND status = 'active' ${kwFilter}`,
      [campaign_id]
    )

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'No active keywords found' }, { status: 400 })
    }

    const keys = await queryAll<any>(
      `SELECT id FROM api_keys WHERE is_active = TRUE AND units_limit >= 100`
    )

    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'NO_API_KEYS: All keys exhausted for today' }, { status: 503 })
    }

    const jobs: Array<{ id: string; keyword: string; mode: string }> = []
    const syncResults: Array<{ keyword: string; result: any }> = []

    for (const kw of keywords) {
      const jobId = `scrape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      await queryAll(
        `INSERT INTO scrape_jobs (id, campaign_id, keyword_id, keyword_text, status, job_type, started_at)
         VALUES ($1, $2, $3, $4, 'running', 'keyword_scrape', $5)`,
        [jobId, campaign_id, kw.id, kw.text, new Date().toISOString()]
      )

      const enqueued = await tryEnqueue(campaign_id, kw.id, kw.text, jobId)

      if (enqueued) {
        jobs.push({ id: jobId, keyword: kw.text, mode: 'queue' })
      } else {
        // Redis unavailable — run synchronously
        try {
          const result = await scrapeKeyword(campaign_id, kw.id, kw.text)
          await queryAll(
            `UPDATE scrape_jobs SET status = 'completed', results_count = $1, completed_at = $2 WHERE id = $3`,
            [result.ranked, new Date().toISOString(), jobId]
          )
          syncResults.push({ keyword: kw.text, result })
          jobs.push({ id: jobId, keyword: kw.text, mode: 'sync' })
        } catch (err: any) {
          console.error(`Scrape failed for keyword "${kw.text}":`, err)
          await queryAll(
            `UPDATE scrape_jobs SET status = 'failed', error_msg = $1, completed_at = $2 WHERE id = $3`,
            [err.message?.substring(0, 500) || 'Unknown error', new Date().toISOString(), jobId]
          )
          jobs.push({ id: jobId, keyword: kw.text, mode: 'sync-error' })
        }
      }
    }

    const hasQueue = jobs.some(j => j.mode === 'queue')
    const hasSync = jobs.some(j => j.mode === 'sync')

    return NextResponse.json({
      ok: true,
      message: hasQueue
        ? `Queued ${jobs.filter(j => j.mode === 'queue').length} keyword(s) for background processing.`
        : hasSync
          ? `Redis unavailable — ran ${syncResults.length} keyword(s) synchronously.`
          : `Processed ${jobs.length} keyword(s).`,
      jobs,
      syncResults,
      quota_hint: {
        per_keyword_search: 100,
        per_new_video: 1,
        note: 'Videos already in campaign pool skip the videos.list call',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const campaignFilter = campaignId ? `WHERE campaign_id = '${campaignId.replace(/'/g, "''")}'` : ''

    const jobs = await queryAll<any>(
      `SELECT * FROM scrape_jobs ${campaignFilter} ORDER BY created_at DESC LIMIT 50`
    )

    const statsData = await queryAll<any>(`SELECT status, results_count, quota_used FROM scrape_jobs`)

    const stats = {
      total: statsData?.length || 0,
      running: statsData?.filter(j => j.status === 'running').length || 0,
      completed: statsData?.filter(j => j.status === 'completed').length || 0,
      failed: statsData?.filter(j => j.status === 'failed').length || 0,
      total_results: statsData?.reduce((sum, j) => sum + (j.results_count || 0), 0) || 0,
      total_quota_used: statsData?.reduce((sum, j) => sum + (j.quota_used || 0), 0) || 0,
    }

    const queueCounts = await getJobCounts(QUEUE_NAMES.KEYWORD_SCRAPE)

    return NextResponse.json({
      jobs,
      stats,
      queue: queueCounts,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
