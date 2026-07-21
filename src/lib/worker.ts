import { Job } from 'bullmq'
import { createWorker, QUEUE_NAMES, ScrapeJobData, DailyViewsJobData, WeeklyRefreshJobData, BrandAnalysisJobData } from './queue'
import { scrapeKeyword, runDailyViewUpdatePg, runWeeklyKeywordRefreshPg, runBrandAnalysisPg } from './scrape-pipeline-pg'
import { refreshMaterializedViews, resetDailyQuotas, setSystemMetadata } from './migrations'
import { queryAll } from './supabase'

export function startScrapeWorker() {
  const worker = createWorker<ScrapeJobData>(
    QUEUE_NAMES.KEYWORD_SCRAPE,
    async (job: Job<ScrapeJobData>) => {
      const { campaignId, keywordId, keywordText, archiveBefore } = job.data

      await job.updateProgress(0)

      await queryAll(
        `UPDATE scrape_jobs SET status = 'running', started_at = $1 WHERE id = $2`,
        [new Date().toISOString(), job.id!]
      )

      try {
        const result = await scrapeKeyword(campaignId, keywordId, keywordText, { archiveBefore })

        await job.updateProgress(100)

        await queryAll(
          `UPDATE scrape_jobs SET status = 'completed', results_count = $1, quota_used = $2, error_msg = $3, completed_at = $4 WHERE id = $5`,
          [result.ranked, result.quota_cost, `pool_reused=${result.reused_from_pool}, new_fetched=${result.new_videos_fetched}`, new Date().toISOString(), job.id!]
        )

        return result
      } catch (err: any) {
        await queryAll(
          `UPDATE scrape_jobs SET status = 'failed', error_msg = $1, completed_at = $2 WHERE id = $3`,
          [err.message?.slice(0, 255) || 'Unknown error', new Date().toISOString(), job.id!]
        )

        throw err
      }
    },
    { concurrency: 2 }
  )

  return worker
}

export function startDailyViewsWorker() {
  const worker = createWorker<DailyViewsJobData>(
    QUEUE_NAMES.DAILY_VIEWS,
    async (job: Job<DailyViewsJobData>) => {
      const { campaignId } = job.data

      await job.updateProgress(0)

      try {
        const result = await runDailyViewUpdatePg(campaignId)

        await job.updateProgress(100)

        await refreshMaterializedViews()

        return result
      } catch (err: any) {
        console.error('Daily views update failed:', err)
        throw err
      }
    },
    { concurrency: 1 }
  )

  return worker
}

export function startWeeklyRefreshWorker() {
  const worker = createWorker<WeeklyRefreshJobData>(
    QUEUE_NAMES.WEEKLY_REFRESH,
    async (job: Job<WeeklyRefreshJobData>) => {
      const { campaignId } = job.data

      await job.updateProgress(0)

      try {
        const result = await runWeeklyKeywordRefreshPg(campaignId)

        await job.updateProgress(100)

        await refreshMaterializedViews()

        return result
      } catch (err: any) {
        console.error('Weekly refresh failed:', err)
        throw err
      }
    },
    { concurrency: 1 }
  )

  return worker
}

export function startBrandAnalysisWorker() {
  const worker = createWorker<BrandAnalysisJobData>(
    QUEUE_NAMES.BRAND_ANALYSIS,
    async (job: Job<BrandAnalysisJobData>) => {
      const { campaignId, limit } = job.data

      await job.updateProgress(0)

      try {
        const result = await runBrandAnalysisPg(campaignId, limit || 10)

        await job.updateProgress(100)

        return result
      } catch (err: any) {
        console.error('Brand analysis failed:', err)
        throw err
      }
    },
    { concurrency: 1 }
  )

  return worker
}

export function startAllWorkers() {
  console.log('Starting background workers...')

  const scrapeWorker = startScrapeWorker()
  const dailyViewsWorker = startDailyViewsWorker()
  const weeklyRefreshWorker = startWeeklyRefreshWorker()
  const brandAnalysisWorker = startBrandAnalysisWorker()

  console.log('All workers started')

  return {
    scrapeWorker,
    dailyViewsWorker,
    weeklyRefreshWorker,
    brandAnalysisWorker,
  }
}

export async function initializeScheduledJobs() {
  const scrapeQueue = (await import('./queue')).getQueue(QUEUE_NAMES.DAILY_VIEWS)

  const existingJobs = await (scrapeQueue as any).getJobIds()
  if (existingJobs.length === 0) {
    await (scrapeQueue as any).add('daily-views', {}, {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'daily-views-recurring',
    })
    console.log('Scheduled daily views job')
  }

  const weeklyQueue = (await import('./queue')).getQueue(QUEUE_NAMES.WEEKLY_REFRESH)
  const weeklyJobs = await (weeklyQueue as any).getJobIds()
  if (weeklyJobs.length === 0) {
    await (weeklyQueue as any).add('weekly-refresh', {}, {
      repeat: { pattern: '0 6 * * 1' },
      jobId: 'weekly-refresh-recurring',
    })
    console.log('Scheduled weekly refresh job')
  }
}
