import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { refreshMaterializedViews, setSystemMetadata, getSystemMetadata } from '@/lib/migrations'
import { getViewCountsOAuth } from '@/lib/youtube-oauth'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  return handleCron(req)
}
export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-vercel-cron-secret')
  const expected = process.env.CRON_SECRET
  const secretMatch = expected && secret === expected

  if (!secretMatch) {
    const token = req.cookies.get('sov_session')?.value
    const session = token ? await verifyToken(token) : null
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const job = req.nextUrl.searchParams.get('job') ?? 'daily_views'
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined

  if (job === 'daily_views' || job === 'auto') {
    return runDailyViewsChunked(req)
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

async function runDailyViewsChunked(req: NextRequest) {
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10), 25)
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined

  // Step 1: Build the full video list (cache it between chunks via system_metadata)
  const listKey = 'daily_views_video_list'
  const progressKey = 'daily_views_progress'

  let videoList: { id: string; youtube_id: string; campaign_id: string }[] = []

  const cachedList = await getSystemMetadata(listKey)
  if (cachedList) {
    try {
      videoList = JSON.parse(cachedList)
    } catch {
      // corrupted, rebuild
    }
  }

  if (!videoList.length) {
    // Rebuild: get all campaign_videos joined with videos
    let cvQuery = supabase
      .from('campaign_videos')
      .select('video_id, campaign_id, videos!inner(id, youtube_id, is_deleted)')
    if (campaignId) cvQuery = cvQuery.eq('campaign_id', campaignId)

    const { data: cvRows } = await cvQuery

    if (!cvRows || cvRows.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        remaining: 0,
        total: 0,
        chunk: { offset: 0, limit },
        elapsed_ms: 0,
      })
    }

    videoList = cvRows
      .filter((r: any) => !r.videos.is_deleted)
      .map((r: any) => ({
        id: r.videos.id,
        youtube_id: r.videos.youtube_id,
        campaign_id: r.campaign_id,
      }))

    // Deduplicate by video id (same video in multiple campaigns)
    const seen = new Set<string>()
    videoList = videoList.filter(v => {
      if (seen.has(v.id)) return false
      seen.add(v.id)
      return true
    })

    await setSystemMetadata(listKey, JSON.stringify(videoList))
    await setSystemMetadata('daily_views_total', String(videoList.length))
  }

  const total = videoList.length
  const chunk = videoList.slice(offset, offset + limit)

  if (chunk.length === 0) {
    // All done
    await supabase.from('system_metadata').delete().eq('key', listKey)
    await supabase.from('system_metadata').delete().eq('key', progressKey)

    const startStr = await getSystemMetadata('daily_views_start')
    const elapsed = startStr ? Date.now() - new Date(startStr).getTime() : 0

    return NextResponse.json({
      ok: true,
      processed: 0,
      remaining: 0,
      total,
      completed: true,
      elapsed_ms: elapsed,
    })
  }

  // Mark start time on first chunk
  if (offset === 0) {
    await setSystemMetadata('daily_views_start', new Date().toISOString())
  }

  const today = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  // Step 2: Process this chunk — YouTube API calls in batches of 50
  let updated = 0
  let deleted = 0
  let batchErrors = 0

  for (let i = 0; i < chunk.length; i += 50) {
    const batch = chunk.slice(i, i + 50)
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
    } catch (batchErr) {
      console.error(`Batch failed at offset ${i}:`, batchErr)
      batchErrors++
      // Continue with next batch instead of failing entirely
    }
  }

  const elapsed = Date.now() - startTime
  const remaining = total - (offset + chunk.length)

  // If all done, clean up cached list
  if (remaining <= 0) {
    await supabase.from('system_metadata').delete().eq('key', listKey)
    await supabase.from('system_metadata').delete().eq('key', progressKey)
    await setSystemMetadata('last_views_refresh', new Date().toISOString())
    await refreshMaterializedViews()
  } else {
    // Save progress for resumability
    await setSystemMetadata(progressKey, JSON.stringify({
      offset: offset + chunk.length,
      total,
      updated_so_far: parseInt((await getSystemMetadata('daily_views_updated')) ?? '0', 10) + updated,
      last_chunk_at: new Date().toISOString(),
    }))
  }

  return NextResponse.json({
    ok: true,
    processed: chunk.length,
    updated,
    deleted,
    batch_errors: batchErrors,
    remaining,
    total,
    completed: remaining <= 0,
    chunk: { offset, limit },
    elapsed_ms: elapsed,
  })
}
