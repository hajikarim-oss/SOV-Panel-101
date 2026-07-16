import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379'
const isUpstash = redisUrl.includes('upstash.io')
const resolvedUrl = isUpstash && redisUrl.startsWith('redis://')
  ? redisUrl.replace('redis://', 'rediss://')
  : redisUrl

let redis: Redis | null = null

function getRedis(): any {
  if (!redis) {
    redis = new Redis(resolvedUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      enableReadyCheck: true,
      lazyConnect: true,
      tls: isUpstash ? { rejectUnauthorized: false } : undefined,
    })
    
    redis.on('error', (err) => {
      console.error('Redis connection error:', err)
    })
    
    redis.on('connect', () => {
      console.log('Redis connected' + (isUpstash ? ' (Upstash)' : ''))
    })
  }
  return redis
}

export const QUEUE_NAMES = {
  KEYWORD_SCRAPE: 'keyword-scrape',
  DAILY_VIEWS: 'daily-views',
  WEEKLY_REFRESH: 'weekly-refresh',
  BRAND_ANALYSIS: 'brand-analysis',
  TRANSCRIPT_FETCH: 'transcript-fetch',
  QUOTA_MONITOR: 'quota-monitor',
  SHEETS_SYNC: 'sheets-sync',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]

export interface ScrapeJobData {
  campaignId: string
  keywordId: string
  keywordText: string
  archiveBefore?: boolean
  priority?: number
}

export interface DailyViewsJobData {
  campaignId?: string
}

export interface WeeklyRefreshJobData {
  campaignId?: string
}

export interface BrandAnalysisJobData {
  campaignId?: string
  limit?: number
  videoIds?: string[]
}

export interface TranscriptJobData {
  videoId: string
  youtubeId: string
}

export interface QuotaMonitorJobData {
  alertThreshold?: number
}

export interface SheetsSyncJobData {
  trigger?: string
}

const queues = new Map<QueueName, Queue>()

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!queues.has(name)) {
    queues.set(name, new Queue<T>(name, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }))
  }
  return queues.get(name)! as Queue<T>
}

export async function closeAllQueues() {
  await Promise.all(
    Array.from(queues.values()).map(q => q.close())
  )
  if (redis) {
    await redis.quit()
    redis = null
  }
}

export function createWorker<T = unknown>(
  name: QueueName,
  processor: (job: Job<T>) => Promise<unknown>,
  options: {
    concurrency?: number
    limiter?: { max: number; duration: number }
  } = {}
) {
  const worker = new Worker<T>(name, processor, {
    connection: getRedis(),
    concurrency: options.concurrency ?? 1,
    limiter: options.limiter,
  })

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed in queue ${name}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed in queue ${name}:`, err)
  })

  worker.on('error', (err) => {
    console.error(`Worker error in queue ${name}:`, err)
  })

  return worker
}

export const queueEvents = new Map<QueueName, QueueEvents>()

export function getQueueEvents(name: QueueName): QueueEvents {
  if (!queueEvents.has(name)) {
    queueEvents.set(name, new QueueEvents(name, { connection: getRedis() }))
  }
  return queueEvents.get(name)!
}

export async function addJob<T = unknown>(
  name: QueueName,
  data: T,
  options: {
    priority?: number
    delay?: number
    jobId?: string
    repeat?: { pattern: string; limit?: number }
  } = {}
) {
  const queue = getQueue<T>(name)
  return queue.add(name as any, data as any, {
    priority: options.priority ?? 0,
    delay: options.delay ?? 0,
    jobId: options.jobId,
    repeat: options.repeat,
  })
}

export async function getJobCounts(name: QueueName) {
  try {
    const queue = getQueue(name)
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])
    return { waiting, active, completed, failed, delayed }
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
  }
}