import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { refreshMaterializedViews, setSystemMetadata, getSystemMetadata } from '@/lib/migrations'
import { getViewCountsOAuth } from '@/lib/youtube-oauth'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  return handleCron(req)
}
export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-vercel-cron-secret')
  const expected = process.env.CRON_SECRET

  if (expected) {
    const secretMatch = secret === expected
    if (!secretMatch) {
      const token = req.cookies.get('sov_session')?.value
      const session = token ? await verifyToken(token) : null
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
  }

  const job = req.nextUrl.searchParams.get('job') ?? 'daily_views'
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined

  if (job === 'daily_views' || job === 'auto') {
    return runDailyViewsAll(req)
  }

  if (job === 'weekly_refresh') {
    const { runWeeklyKeywordRefreshPg } = await import('@/lib/scrape-pipeline-pg')
    const result = await runWeeklyKeywordRefreshPg(campaignId)
    await refreshMaterializedViews()
    await setSystemMetadata('last_ranking_refresh', new Date().toISOString())
    return NextResponse.json({ ok: true, weekly_refresh: { ...result, status: 'completed' } })
  }

  if (job === 'refresh_views') {
    await refreshMaterializedViews()
    return NextResponse.json({ ok: true, message: 'Materialized views refreshed' })
  }

  return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 })
}

async function runDailyViewsAll(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined
  const startTime = Date.now()
  const today = new Date().toISOString().split('T')[0]

  // Clear any stale state from previous crashed runs
  const listKey = 'daily_views_video_list'
  const progressKey = 'daily_views_progress'
  await supabase.from('system_metadata').delete().eq('key', listKey)
  await supabase.from('system_metadata').delete().eq('key', progressKey)
  await setSystemMetadata('daily_views_start', new Date().toISOString())

  // Build the full unique video list
  let cvQuery = supabase
    .from('campaign_videos')
    .select('video_id, campaign_id, videos!inner(id, youtube_id, is_deleted)')
  if (campaignId) cvQuery = cvQuery.eq('campaign_id', campaignId)

  const { data: cvRows } = await cvQuery

  if (!cvRows || cvRows.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      total: 0,
      elapsed_ms: 0,
    })
  }

  // Deduplicate by video id (same video in multiple campaigns)
  const seen = new Set<string>()
  const videoList = cvRows
    .filter((r: any) => !r.videos.is_deleted)
    .filter((r: any) => {
      if (seen.has(r.videos.id)) return false
      seen.add(r.videos.id)
      return true
    })
    .map((r: any) => ({
      id: r.videos.id,
      youtube_id: r.videos.youtube_id,
      campaign_id: r.campaign_id,
    }))

  const total = videoList.length

  // Process all videos in batches of 50 (YouTube API limit)
  const BATCH_SIZE = 50
  let updated = 0
  let deleted = 0
  let batchErrors = 0
  let processed = 0

  for (let i = 0; i < videoList.length; i += BATCH_SIZE) {
    const batch = videoList.slice(i, i + BATCH_SIZE)
    const ids = batch.map(r => r.youtube_id).filter(Boolean)
    if (ids.length === 0) continue

    try {
      const stats = await getViewCountsOAuth(ids)

      const viewMap = new Map<string, number>()
      const deletedIds: string[] = []
      for (const stat of stats) {
        if (stat.is_deleted) deletedIds.push(stat.youtube_id)
        else viewMap.set(stat.youtube_id, stat.view_count)
      }

      if (deletedIds.length > 0) {
        await supabase.from('videos').update({ is_deleted: true }).in('youtube_id', deletedIds)
        deleted += deletedIds.length
      }

      // Batch update view counts
      for (const [ytId, vc] of viewMap) {
        await supabase.from('videos').update({ view_count: vc }).eq('youtube_id', ytId)
      }

      // Upsert view snapshots
      const vsRows = batch
        .filter(r => viewMap.has(r.youtube_id))
        .map(r => ({
          video_id: r.id,
          campaign_id: r.campaign_id,
          view_count: viewMap.get(r.youtube_id)!,
          snapshot_date: today,
        }))
      if (vsRows.length > 0) {
        await supabase.from('view_snapshots').upsert(vsRows, {
          onConflict: 'video_id,campaign_id,snapshot_date',
          ignoreDuplicates: false,
        })
      }

      updated += viewMap.size
      processed += batch.length
    } catch (batchErr) {
      console.error(`Batch failed at offset ${i}:`, batchErr)
      batchErrors++
      processed += batch.length
    }
  }

  // Clean up
  await supabase.from('system_metadata').delete().eq('key', listKey)
  await supabase.from('system_metadata').delete().eq('key', progressKey)
  await setSystemMetadata('last_views_refresh', new Date().toISOString())

  const elapsed = Date.now() - startTime

  try {
    await refreshMaterializedViews()
  } catch (err) {
    console.error('Materialized view refresh failed:', err)
  }

  return NextResponse.json({
    ok: true,
    processed,
    updated,
    deleted,
    batch_errors: batchErrors,
    total,
    completed: true,
    elapsed_ms: elapsed,
  })
}
