import { NextRequest, NextResponse } from 'next/server'
import { runDailyViewUpdatePg, runWeeklyKeywordRefreshPg } from '@/lib/scrape-pipeline-pg'
import { refreshMaterializedViews, setSystemMetadata, getSystemMetadata } from '@/lib/migrations'

export const runtime = 'nodejs'

// Vercel cron calls this endpoint directly — no BullMQ needed
// Workers can't run on serverless (no persistent process)
export async function GET(req: NextRequest) {
  return handleCron(req)
}
export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = req.nextUrl.searchParams.get('job') ?? 'auto'
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined
  const isMonday = new Date().getDay() === 1

  const results: Record<string, unknown> = { job, ran_at: new Date().toISOString() }

  try {
    // Run daily views directly (no queue — workers don't run on Vercel)
    if (job === 'daily_views' || job === 'auto') {
      console.log(`[Cron] Starting daily views update${campaignId ? ` for campaign ${campaignId}` : ''}`)
      const result = await runDailyViewUpdatePg(campaignId)
      await refreshMaterializedViews()
      await setSystemMetadata('last_views_refresh', new Date().toISOString())
      results.daily_views = { ...result, status: 'completed' }
      console.log(`[Cron] Daily views: ${result.updated} updated, ${result.deleted} deleted`)
    }

    // Run weekly refresh on Mondays
    if (job === 'weekly_refresh' || (job === 'auto' && isMonday)) {
      console.log('[Cron] Starting weekly keyword refresh')
      const result = await runWeeklyKeywordRefreshPg(campaignId)
      await refreshMaterializedViews()
      await setSystemMetadata('last_ranking_refresh', new Date().toISOString())
      await setSystemMetadata('last_weekly_refresh', new Date().toISOString())
      results.weekly_refresh = { ...result, status: 'completed' }
      console.log(`[Cron] Weekly refresh: ${result.keywords_processed} keywords`)
    }

    results.metadata = {
      last_views_refresh: await getSystemMetadata('last_views_refresh'),
      last_ranking_refresh: await getSystemMetadata('last_ranking_refresh'),
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[Cron] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
