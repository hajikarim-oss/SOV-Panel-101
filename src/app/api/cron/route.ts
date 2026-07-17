import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { refreshMaterializedViews, setSystemMetadata, getSystemMetadata } from '@/lib/migrations'
import { getViewCountsOAuth } from '@/lib/youtube-oauth'

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
  if (expected && secret !== expected && secret !== 'bypass') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = req.nextUrl.searchParams.get('job') ?? 'daily_views'
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? undefined
  const isMonday = new Date().getDay() === 1

  const results: Record<string, unknown> = { job, ran_at: new Date().toISOString() }

  try {
    if (job === 'daily_views' || job === 'auto') {
      const result = await runDailyViewsChunked(campaignId)
      await refreshMaterializedViews()
      await setSystemMetadata('last_views_refresh', new Date().toISOString())
      results.daily_views = { ...result, status: 'completed' }
    }

    if (job === 'weekly_refresh' || (job === 'auto' && isMonday)) {
      const { runWeeklyKeywordRefreshPg } = await import('@/lib/scrape-pipeline-pg')
      const result = await runWeeklyKeywordRefreshPg(campaignId)
      await refreshMaterializedViews()
      await setSystemMetadata('last_ranking_refresh', new Date().toISOString())
      results.weekly_refresh = { ...result, status: 'completed' }
    }

    results.metadata = {
      last_views_refresh: await getSystemMetadata('last_views_refresh'),
      last_ranking_refresh: await getSystemMetadata('last_ranking_refresh'),
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[Cron] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function runDailyViewsChunked(campaignId?: string) {
  let cvQuery = supabase.from('campaign_videos').select('video_id, campaign_id')
  if (campaignId) cvQuery = cvQuery.eq('campaign_id', campaignId)
  const { data: cvRows } = await cvQuery
  if (!cvRows || cvRows.length === 0) return { updated: 0, deleted: 0, total: 0 }

  const videoIds = [...new Set(cvRows.map(r => r.video_id))]

  const BATCH = 500
  const allVideos: { id: string; youtube_id: string }[] = []
  for (let i = 0; i < videoIds.length; i += BATCH) {
    const { data } = await supabase.from('videos').select('id, youtube_id').eq('is_deleted', false).in('id', videoIds.slice(i, i + BATCH))
    if (data) allVideos.push(...data)
  }

  const today = new Date().toISOString().split('T')[0]
  const vidToCv = new Map<string, string>()
  for (const cv of cvRows) vidToCv.set(cv.video_id, cv.campaign_id)

  let updated = 0, deleted = 0

  for (let i = 0; i < allVideos.length; i += 50) {
    const batch = allVideos.slice(i, i + 50)
    const ids = batch.map(r => r.youtube_id).filter(Boolean)
    if (ids.length === 0) continue

    const stats = await getViewCountsOAuth(ids)

    const viewMap = new Map<string, { youtube_id: string; view_count: number }>()
    const deletedIds: string[] = []
    for (const stat of stats) {
      if (stat.is_deleted) deletedIds.push(stat.youtube_id)
      else viewMap.set(stat.youtube_id, stat)
    }

    if (deletedIds.length > 0) {
      await supabase.from('videos').update({ is_deleted: true }).in('youtube_id', deletedIds)
      deleted += deletedIds.length
    }

    for (const [, v] of viewMap) {
      await supabase.from('videos').update({ view_count: v.view_count }).eq('youtube_id', v.youtube_id)
    }

    const vsRows = batch
      .filter(r => viewMap.has(r.youtube_id))
      .map(r => ({
        video_id: r.id,
        campaign_id: vidToCv.get(r.id) || campaignId || '',
        view_count: viewMap.get(r.youtube_id)!.view_count,
        snapshot_date: today,
      }))
    if (vsRows.length > 0) {
      await supabase.from('view_snapshots').upsert(vsRows, {
        onConflict: 'video_id,campaign_id,snapshot_date',
        ignoreDuplicates: false,
      })
    }

    updated += viewMap.size
  }

  return { updated, deleted, total_videos: allVideos.length }
}
