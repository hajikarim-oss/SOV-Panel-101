import { queryAll } from './supabase'

export interface QuotaStatus {
  total_keys: number
  active_keys: number
  total_capacity: number
  total_used: number
  utilization_percent: number
  keys_near_limit: Array<{
    id: string
    label: string
    units_used: number
    units_limit: number
    usage_percent: number
  }>
  estimated_days_until_exhaustion: number
}

export async function getQuotaStatus(): Promise<QuotaStatus> {
  const keys = await queryAll<any>(`
    SELECT id, label, units_used, units_limit, is_active FROM api_keys
  `)

  const activeKeys = keys?.filter(k => k.is_active) || []
  const totalCapacity = activeKeys.reduce((sum, k) => sum + (k.units_limit || 0), 0)
  const totalUsed = activeKeys.reduce((sum, k) => sum + (k.units_used || 0), 0)
  const utilizationPercent = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0

  const keysNearLimit = activeKeys
    .map(k => ({
      id: k.id,
      label: k.label,
      units_used: k.units_used || 0,
      units_limit: k.units_limit || 10000,
      usage_percent: ((k.units_used || 0) / (k.units_limit || 10000)) * 100,
    }))
    .filter(k => k.usage_percent > 80)
    .sort((a, b) => b.usage_percent - a.usage_percent)

  const dailyUsage = await getDailyUsage()
  const estimatedDays = dailyUsage > 0
    ? Math.floor((totalCapacity - totalUsed) / dailyUsage)
    : 999

  return {
    total_keys: keys?.length || 0,
    active_keys: activeKeys.length,
    total_capacity: totalCapacity,
    total_used: totalUsed,
    utilization_percent: Math.round(utilizationPercent * 10) / 10,
    keys_near_limit: keysNearLimit,
    estimated_days_until_exhaustion: estimatedDays,
  }
}

async function getDailyUsage(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const data = await queryAll<any>(
    `SELECT quota_used FROM scrape_jobs WHERE created_at >= $1 AND status = 'completed'`,
    [today]
  )
  return (data || []).reduce((sum, j) => sum + (j.quota_used || 0), 0)
}

export interface QuotaAlert {
  level: 'warning' | 'critical' | 'exhausted'
  message: string
  key_id?: string
  key_label?: string
  usage_percent: number
}

export async function checkQuotaAlerts(): Promise<QuotaAlert[]> {
  const alerts: QuotaAlert[] = []
  const status = await getQuotaStatus()

  if (status.utilization_percent > 90) {
    alerts.push({
      level: 'critical',
      message: `Overall quota utilization is ${status.utilization_percent}%. Keys may be exhausted soon.`,
      usage_percent: status.utilization_percent,
    })
  }

  for (const key of status.keys_near_limit) {
    const level = key.usage_percent > 95 ? 'exhausted' : 'warning'
    alerts.push({
      level,
      message: `Key "${key.label}" is at ${key.usage_percent.toFixed(1)}% quota usage.`,
      key_id: key.id,
      key_label: key.label,
      usage_percent: key.usage_percent,
    })
  }

  if (status.estimated_days_until_exhaustion < 2) {
    alerts.push({
      level: 'exhausted',
      message: `All keys estimated to be exhausted within ${status.estimated_days_until_exhaustion} day(s).`,
      usage_percent: 100,
    })
  }

  return alerts
}

export async function requestQuotaIncrease(
  projectId: string,
  currentLimit: number,
  requestedLimit: number,
  justification: string
): Promise<{ success: boolean; message: string; ticketId?: string }> {
  const requestPayload = {
    project_id: projectId,
    current_limit: currentLimit,
    requested_limit: requestedLimit,
    justification,
    timestamp: new Date().toISOString(),
    usage_data: await getQuotaStatus(),
  }

  const ticketId = `QIR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  await queryAll(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [
      `quota_ticket_${ticketId}`,
      JSON.stringify({ ...requestPayload, ticket_id: ticketId, status: 'pending', submitted_at: new Date().toISOString() }),
      new Date().toISOString(),
    ]
  )

  return {
    success: true,
    message: `Quota increase request created. Ticket: ${ticketId}. Please submit this to Google Cloud Console.`,
    ticketId,
  }
}

export function getGoogleCloudConsoleUrl(projectId: string): string {
  return `https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas?project=${projectId}`
}

export function getQuotaIncreaseRequestTemplate(): string {
  return `
Quota Increase Request for YouTube Data API v3

Project ID: [YOUR_PROJECT_ID]
API: YouTube Data API v3
Current Quota: 10,000 units/day
Requested Quota: 1,000,000 units/day

Justification:
--------------

We are building a competitive intelligence dashboard for the Indian market that tracks YouTube video performance across multiple brands and keywords. Our system needs to:

1. Monitor search rankings for 50+ keywords across multiple categories
2. Track daily view counts for 500+ videos
3. Analyze brand mentions in video transcripts

Current Usage:
- Daily API calls: ~15,000 units (with quota rotation across 10 keys)
- Primary use case: Market research and competitive analysis
- Geographic focus: India (regionCode=IN)

We have implemented:
- API key rotation (10 keys with quota tracking)
- Intelligent caching (24h view refresh cycle)
- Campaign video pool (reduces redundant API calls)
- OAuth 2.0 authentication for secure access

This quota increase is essential for maintaining real-time competitive intelligence across our monitored brands and keywords.

Contact: [YOUR_EMAIL]
`.trim()
}

export async function exportQuotaReport(): Promise<string> {
  const status = await getQuotaStatus()
  const alerts = await checkQuotaAlerts()

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total_keys: status.total_keys,
      active_keys: status.active_keys,
      total_capacity: status.total_capacity,
      total_used: status.total_used,
      utilization_percent: status.utilization_percent,
      estimated_days_until_exhaustion: status.estimated_days_until_exhaustion,
    },
    keys_near_limit: status.keys_near_limit,
    active_alerts: alerts,
    recommendations: generateRecommendations(status, alerts),
  }

  return JSON.stringify(report, null, 2)
}

function generateRecommendations(status: QuotaStatus, alerts: QuotaAlert[]): string[] {
  const recommendations: string[] = []

  if (status.utilization_percent > 80) {
    recommendations.push('Consider adding more API keys to distribute quota load')
  }

  if (status.estimated_days_until_exhaustion < 7) {
    recommendations.push('Request quota increase from Google Cloud Console immediately')
  }

  if (status.keys_near_limit.length > 3) {
    recommendations.push('Multiple keys are near limit - consider spreading requests more evenly')
  }

  if (status.active_keys < 5) {
    recommendations.push('Add more API keys (recommended: 10 keys for production use)')
  }

  if (alerts.some(a => a.level === 'exhausted')) {
    recommendations.push('URGENT: Some keys are exhausted - enable fallback to campaign pool')
  }

  return recommendations
}
