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

  if (job === 'sheets_sync') {
    const { syncAllDataToSheets } = await import('@/lib/google-sheets')
    try {
      const result = await syncAllDataToSheets()
      return NextResponse.json({ ok: true, ...result })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 })
}

interface CvRow {
  video_id: string
  campaign_id: string
  videos: {
    id: string
    youtube_id: string | null
    is_deleted: boolean
  } | null
}

async function runDailyViewsAll(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined
  const startTime = Date.now()
  const today = new Date().toISOString().split('T')[0]

  await setSystemMetadata('daily_views_start', new Date().toISOString())

  // Use LEFT JOIN so orphaned campaign_videos rows don't drop videos from the list
  let cvQuery = supabase
    .from('campaign_videos')
    .select('video_id, campaign_id, videos(id, youtube_id, is_deleted)')
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

  // Build youtube_id → campaign entries map (skip videos without a matching videos row or with null youtube_id)
  const ytIdMap = new Map<string, Array<{ video_id: string; campaign_id: string }>>()
  const seenYtIds = new Set<string>()

  for (const raw of cvRows) {
    const r = raw as unknown as CvRow
    if (!r.videos) continue
    if (r.videos.is_deleted) continue
    if (!r.videos.youtube_id) continue
    const key = r.videos.youtube_id

    if (!ytIdMap.has(key)) {
      ytIdMap.set(key, [])
      seenYtIds.add(r.videos.id)
    }
    ytIdMap.get(key)!.push({ video_id: r.videos.id, campaign_id: r.campaign_id })
  }

  const uniqueYtIds = Array.from(ytIdMap.keys())
  const totalEntries = Array.from(ytIdMap.values()).reduce((s, a) => s + a.length, 0)

  // Resume from previous timed-out run
  const resumeRaw = await getSystemMetadata('daily_views_resume_offset')
  const resumeOffset = resumeRaw ? parseInt(resumeRaw, 10) : 0

  const BATCH_SIZE = 50
  let updated = 0
  let deleted = 0
  let processed = 0

  try {
    for (let i = resumeOffset; i < uniqueYtIds.length; i += BATCH_SIZE) {
      const batchYtIds = uniqueYtIds.slice(i, i + BATCH_SIZE)

      const stats = await getViewCountsOAuth(batchYtIds)

      const viewMap = new Map<string, number>()
      const deletedIds: string[] = []
      for (const stat of stats) {
        if (stat.is_deleted) deletedIds.push(stat.youtube_id)
        else viewMap.set(stat.youtube_id, stat.view_count)
      }

      // Mark deleted videos
      if (deletedIds.length > 0) {
        await supabase.from('videos').update({ is_deleted: true }).in('youtube_id', deletedIds)
        deleted += deletedIds.length
      }

      // Update view counts in bulk
      if (viewMap.size > 0) {
        for (const [ytId, vc] of viewMap) {
          await supabase.from('videos').update({ view_count: vc }).eq('youtube_id', ytId)
        }
        updated += viewMap.size
      }

      // Upsert view snapshots for ALL campaign entries
      const vsRows: Array<{
        video_id: string
        campaign_id: string
        view_count: number
        snapshot_date: string
      }> = []
      for (const ytId of batchYtIds) {
        const vc = viewMap.get(ytId)
        if (vc === undefined) continue
        const entries = ytIdMap.get(ytId)!
        for (const entry of entries) {
          vsRows.push({
            video_id: entry.video_id,
            campaign_id: entry.campaign_id,
            view_count: vc,
            snapshot_date: today,
          })
        }
      }

      if (vsRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('view_snapshots')
          .upsert(vsRows, {
            onConflict: 'video_id,campaign_id,snapshot_date',
            ignoreDuplicates: false,
          })
        if (upsertErr) {
          // Fallback: try PK without campaign_id if the constraint doesn't include it
          const { error: fallbackErr } = await supabase
            .from('view_snapshots')
            .upsert(vsRows, {
              onConflict: 'video_id,snapshot_date',
              ignoreDuplicates: false,
            })
          if (fallbackErr) throw fallbackErr
        }
      }

      processed += batchYtIds.length

      // Save resume offset
      await supabase.from('system_metadata').upsert({
        key: 'daily_views_resume_offset',
        value: String(i + batchYtIds.length),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
    }

    // Clear resume state
    await supabase.from('system_metadata').delete().eq('key', 'daily_views_resume_offset')
    await setSystemMetadata('last_views_refresh', new Date().toISOString())
  } catch (err) {
    console.error('Daily views failed:', err)
    return NextResponse.json({
      ok: false,
      processed,
      updated,
      deleted,
      total_unique: uniqueYtIds.length,
      total_entries: totalEntries,
      completed: false,
      resume_offset: processed > 0 ? processed : resumeOffset,
      elapsed_ms: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }

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
    total_unique: uniqueYtIds.length,
    total_entries: totalEntries,
    completed: true,
    elapsed_ms: elapsed,
  })
}
