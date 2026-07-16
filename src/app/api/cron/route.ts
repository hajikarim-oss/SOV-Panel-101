import { NextRequest, NextResponse } from 'next/server'
import { getQueue, QUEUE_NAMES, addJob, DailyViewsJobData, WeeklyRefreshJobData } from '@/lib/queue'
import { getSystemMetadata } from '@/lib/migrations'

export async function POST(req: NextRequest) {
  return handleCron(req)
}

export async function GET(req: NextRequest) {
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

  try {
    const results: Record<string, unknown> = { job, ran_at: new Date().toISOString() }

    if (job === 'daily_views' || job === 'auto') {
      const dailyQueue = getQueue<DailyViewsJobData>(QUEUE_NAMES.DAILY_VIEWS)
      const dailyJob = await dailyQueue.add('daily-views', {
        campaignId,
      }, {
        jobId: `daily-${Date.now()}`,
        priority: 0,
      })

      results.daily_views = {
        job_id: dailyJob.id,
        status: 'queued',
        message: 'Daily views update queued for background processing',
      }
    }

    if (job === 'weekly_refresh' || (job === 'auto' && isMonday)) {
      const weeklyQueue = getQueue<WeeklyRefreshJobData>(QUEUE_NAMES.WEEKLY_REFRESH)
      const weeklyJob = await weeklyQueue.add('weekly-refresh', {
        campaignId,
      }, {
        jobId: `weekly-${Date.now()}`,
        priority: 0,
      })

      results.weekly_refresh = {
        job_id: weeklyJob.id,
        status: 'queued',
        message: 'Weekly keyword refresh queued for background processing',
      }
    }

    results.metadata = {
      last_views_refresh: await getSystemMetadata('last_views_refresh'),
      last_ranking_refresh: await getSystemMetadata('last_ranking_refresh'),
      last_weekly_refresh: await getSystemMetadata('last_weekly_refresh'),
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
