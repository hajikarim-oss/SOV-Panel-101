import { Redis } from '@upstash/redis'

// ── L1: In-Process Memory Cache (0ms, 30s TTL) ────────────────────────────────
// Lives inside the Node.js process — zero network latency.
// Prevents hammering Redis for repeated requests within the same function instance.
interface MemEntry { data: unknown; expiresAt: number }
const memCache = new Map<string, MemEntry>()
const MEM_TTL_MS = 30_000  // 30 seconds
const MEM_MAX_SIZE = 150   // cap to prevent OOM

function getL1<T>(key: string): T | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return null
  }
  return entry.data as T
}

function setL1(key: string, data: unknown, ttlMs = MEM_TTL_MS) {
  // Evict oldest entry if at capacity
  if (memCache.size >= MEM_MAX_SIZE) {
    const firstKey = memCache.keys().next().value
    if (firstKey) memCache.delete(firstKey)
  }
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function invalidateL1(pattern?: string) {
  if (!pattern) { memCache.clear(); return }
  for (const key of memCache.keys()) {
    if (key.includes(pattern)) memCache.delete(key)
  }
}

// ── L2: Redis Cache (~10ms) ───────────────────────────────────────────────────
let redisInstance: Redis | null = null
try {
  const url = process.env.UPSTASH_REDIS_REST_URL
  if (url && url.startsWith('https://')) {
    redisInstance = Redis.fromEnv()
  }
} catch (e) {
  console.warn('Upstash Redis initialization warning (expected during build/CI):', e)
}

export const redis = redisInstance

export const CACHE_TTL = {
  overview_kpis: 43200,
  brand_sov: 43200,
  video_leaderboard: 43200,
  sov_trend: 43200,
  brand_detail: 43200,
  brand_growth: 43200,
  dropped_rankings: 43200,
  multi_keyword: 43200,
  system_metadata: 30,
  keywords_sov: 43200,
  brands_overview: 43200,
  campaigns: 43200,
  videos_campaign: 43200,
  videos_pending: 43200,
  campaign_videos: 43200,
  keywords: 43200,
  views_snapshot: 60,
} as const

// ── In-flight Deduplication (prevents thundering herd on cold start) ──────────
const inflight = new Map<string, Promise<unknown>>()

async function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inflight.has(key)) return inflight.get(key) as Promise<T>
  const p = fetcher().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// ── Main Cache Wrapper: L1 → L2 → Fetcher ────────────────────────────────────
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // L1: memory hit (0ms — fastest possible)
  const l1 = getL1<T>(key)
  if (l1 !== null) return l1

  return dedupedFetch(key, async () => {
    // L2: Redis hit (~10ms)
    try {
      if (redis) {
        const cached = await redis.get<T>(key)
        if (cached !== null) {
          setL1(key, cached) // promote to L1
          return cached
        }
      }
    } catch {}

    // L3: Fetch fresh from database
    const fresh = await fetcher()

    // Write to L1 + L2 simultaneously (fire-and-forget for Redis)
    setL1(key, fresh)
    try {
      if (redis) {
        redis.setex(key, ttl, JSON.stringify(fresh)).catch(() => {})
      }
    } catch {}

    return fresh
  })
}

// ── Stale-While-Revalidate: return L1 immediately, refresh in background ──────
export async function getCachedSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const l1 = getL1<T>(key)
  if (l1 !== null) {
    // Serve stale data immediately, refresh in background
    Promise.resolve().then(() =>
      fetcher()
        .then(fresh => {
          setL1(key, fresh)
          if (redis) redis.setex(key, ttl, JSON.stringify(fresh)).catch(() => {})
        })
        .catch(() => {})
    )
    return l1
  }
  return getCached(key, fetcher, ttl)
}

// ── Client-side cache (localStorage, 5 min TTL) ───────────────────────────────
const CLIENT_CACHE_PREFIX = 'sov_cache:'
const CLIENT_CACHE_TTL = 5 * 60 * 1000

export function getClientCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CLIENT_CACHE_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CLIENT_CACHE_TTL) {
      localStorage.removeItem(CLIENT_CACHE_PREFIX + key)
      return null
    }
    return data as T
  } catch { return null }
}

export function setClientCache(key: string, data: unknown) {
  try {
    localStorage.setItem(CLIENT_CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

export function clearClientCache(pattern?: string) {
  try {
    const prefix = CLIENT_CACHE_PREFIX + (pattern || '')
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k))
  } catch {}
}

// ── Cache Key Builder ─────────────────────────────────────────────────────────
export const cacheKey = {
  overview: (campaignId: string) => `campaign:${campaignId}:overview`,
  kpis: (campaignId: string) => `campaign:${campaignId}:kpis:v1`,
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

export async function invalidateCampaign(campaignId: string) {
  invalidateL1(`campaign:${campaignId}`)
  try {
    if (redis) {
      const keys = await redis.keys(`campaign:${campaignId}:*`)
      if (keys.length > 0) await redis.del(...keys)
      await redis.del(cacheKey.metadata())
    }
  } catch {}
  clearClientCache(`campaign:${campaignId}`)
}
