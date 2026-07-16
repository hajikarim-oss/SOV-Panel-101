import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Warm all critical serverless functions by importing and touching them
// Called by Vercel cron every 4 minutes to prevent cold starts
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

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    ms: Date.now() - start,
  })
}
