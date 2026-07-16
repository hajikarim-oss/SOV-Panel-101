import { Redis } from '@upstash/redis'

// Safe initialization to handle dummy env variables during build phase
let redisInstance: Redis | null = null
try {
  const url = process.env.UPSTASH_REDIS_REST_URL
  if (url && url.startsWith('https://')) {
    redisInstance = Redis.fromEnv()
  }
} catch (e) {
  console.warn("Upstash Redis initialization warning (expected during build/CI):", e)
}

export const redis = redisInstance

export const CACHE_TTL = {
  overview_kpis: 43200,        // 12 hr — all KPIs except views
  brand_sov: 43200,            // 12 hr
  video_leaderboard: 43200,    // 12 hr
  sov_trend: 43200,            // 12 hr
  brand_detail: 43200,         // 12 hr
  brand_growth: 43200,         // 12 hr
  dropped_rankings: 43200,     // 12 hr
  multi_keyword: 43200,        // 12 hr
  system_metadata: 30,         // 30 sec
  keywords_sov: 43200,         // 12 hr
  brands_overview: 43200,      // 12 hr
  campaigns: 43200,            // 12 hr
  videos_campaign: 43200,      // 12 hr
  videos_pending: 43200,       // 12 hr
  campaign_videos: 43200,      // 12 hr
  keywords: 43200,             // 12 hr
  views_snapshot: 60,          // 1 min — views always fresh
} as const

// ── Stale-While-Revalidate Cache Wrapper ──────────────────────────────────────
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  try {
    if (redis) {
      const cached = await redis.get<T>(key)
      if (cached !== null) return cached
    }
  } catch {
    // Redis unavailable → fall through to DB
  }

  const fresh = await fetcher()

  try {
    if (redis) {
      await redis.setex(key, ttl, JSON.stringify(fresh))
    }
  } catch {
    // Best-effort cache write
  }

  return fresh
}

// ── Cache Key Builder ─────────────────────────────────────────────────────────
export const cacheKey = {
  overview: (campaignId: string) => `campaign:${campaignId}:overview`,
  brandSov: (campaignId: string) => `campaign:${campaignId}:brands:sov`,
  freqSov: (campaignId: string) => `campaign:${campaignId}:brands:freq-sov`,
  leaderboard: (campaignId: string, sort: string, page: number, tab: string) =>
    `campaign:${campaignId}:videos:leaderboard:${tab}:${sort}:page:${page}`,
  sovTrend: (campaignId: string, brands: string, range: string) =>
    `campaign:${campaignId}:sov-trend:${brands}:${range}`,
  keywordsSov: (campaignId: string, lang: string, type: string) =>
    `campaign:${campaignId}:keywords:sov:${lang}:${type}`,
  brandGrowth: (campaignId: string, metric: string, period: string) =>
    `campaign:${campaignId}:brands:growth:${metric}:${period}`,
  brandDetail: (campaignId: string, brandName: string) =>
    `campaign:${campaignId}:brand:${brandName}`,
  droppedRankings: (campaignId: string) => `campaign:${campaignId}:videos:dropped`,
  multiKeyword: (campaignId: string, minKeywords: number) =>
    `campaign:${campaignId}:videos:multi-keyword:${minKeywords}`,
  metadata: () => `system:metadata`,
  scrapeJobs: (campaignId: string) => `campaign:${campaignId}:scrape-jobs`,
  campaigns: () => `campaigns:all`,
  videosCampaign: (campaignId: string, page: number, sort: string, search: string) =>
    `campaign:${campaignId}:videos:campaign:${sort}:p${page}:${search || ''}`,
  videosPending: (campaignId: string, page: number, search: string) =>
    `campaign:${campaignId}:videos:pending:p${page}:${search || ''}`,
  keywords: (campaignId: string) => `campaign:${campaignId}:keywords`,
  brands: (campaignId: string) => `campaign:${campaignId}:brands`,
  brandsTags: (campaignId: string) => `campaign:${campaignId}:brands:tags`,
}

// ── Invalidate all keys for a campaign ───────────────────────────────────────
export async function invalidateCampaign(campaignId: string) {
  try {
    if (redis) {
      const keys = await redis.keys(`campaign:${campaignId}:*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      // Also clear metadata
      await redis.del(cacheKey.metadata())
    }
  } catch {
    // Best-effort invalidation
  }
}

// ── In-flight Request Deduplication (prevents thundering herd) ───────────────
const inflightRequests = new Map<string, Promise<unknown>>()

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key) as Promise<T>
  }

  const promise = fetcher().finally(() => {
    inflightRequests.delete(key)
  })

  inflightRequests.set(key, promise)
  return promise
}
