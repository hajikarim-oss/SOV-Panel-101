import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Warm critical serverless functions + daily quota reset
// Called by Vercel cron daily at 7 AM UTC
export async function GET() {
  const start = Date.now()

  // Touch Supabase to keep that connection pool warm too
  try {
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('campaigns').select('id').limit(1)
  } catch {}

  // Touch Redis
  try {
    const { redis } = await import('@/lib/cache')
    if (redis) await redis.ping()
  } catch {}

  // Daily reset: zero out all active API key quotas for the new day
  try {
    const { resetDailyQuotas } = await import('@/lib/migrations')
    await resetDailyQuotas()
  } catch {}

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    ms: Date.now() - start,
  })
}
