import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { getSystemMetadata } from '@/lib/migrations'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const cid = campaignId || null

    const lastViews = await getSystemMetadata('last_views_refresh')
    const lastRanking = await getSystemMetadata('last_ranking_refresh')

    const kwCount = await queryAll<any>(
      cid ? `SELECT COUNT(*) as cnt FROM keywords WHERE status = 'active' AND campaign_id = $1` : `SELECT COUNT(*) as cnt FROM keywords WHERE status = 'active'`,
      cid ? [cid] : []
    )
    const kvCount = await queryAll<any>(
      cid ? `SELECT COUNT(*) as cnt FROM keyword_videos WHERE campaign_id = $1` : `SELECT COUNT(*) as cnt FROM keyword_videos`,
      cid ? [cid] : []
    )
    const ksCount = await queryAll<any>(
      cid ? `SELECT COUNT(*) as cnt FROM keyword_shorts WHERE campaign_id = $1` : `SELECT COUNT(*) as cnt FROM keyword_shorts`,
      cid ? [cid] : []
    )

    const kwCountVal = kwCount?.[0]?.cnt ?? 0
    const kvCountVal = kvCount?.[0]?.cnt ?? 0
    const ksCountVal = ksCount?.[0]?.cnt ?? 0
    const totalVideos = kvCountVal + ksCountVal

    const vsToday = await queryAll<any>(
      cid ? `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE AND campaign_id = $1` : `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE`,
      cid ? [cid] : []
    )
    const vs1d = await queryAll<any>(
      cid ? `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE - INTERVAL '1 day' AND campaign_id = $1` : `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE - INTERVAL '1 day'`,
      cid ? [cid] : []
    )
    const vs7d = await queryAll<any>(
      cid ? `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE - INTERVAL '7 days' AND campaign_id = $1` : `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE - INTERVAL '7 days'`,
      cid ? [cid] : []
    )
    const vs30d = await queryAll<any>(
      cid ? `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE - INTERVAL '30 days' AND campaign_id = $1` : `SELECT COALESCE(SUM(view_count), 0) as total_views FROM view_snapshots WHERE snapshot_date = CURRENT_DATE - INTERVAL '30 days'`,
      cid ? [cid] : []
    )

    const uniqueStats = cid
      ? await queryAll<any>(`SELECT COUNT(DISTINCT v.id) as unique_count, COALESCE(SUM(v.view_count), 0) as total_viewership, COUNT(DISTINCT v.channel_name) as unique_channels FROM (SELECT video_id FROM keyword_videos WHERE campaign_id = $1 UNION ALL SELECT video_id FROM keyword_shorts WHERE campaign_id = $1) uv INNER JOIN videos v ON v.id = uv.video_id`, [cid, cid])
      : await queryAll<any>(`SELECT COUNT(DISTINCT v.id) as unique_count, COALESCE(SUM(v.view_count), 0) as total_viewership, COUNT(DISTINCT v.channel_name) as unique_channels FROM (SELECT video_id FROM keyword_videos UNION ALL SELECT video_id FROM keyword_shorts) uv INNER JOIN videos v ON v.id = uv.video_id`)

    const vs = uniqueStats?.[0] || {} as any

    const topChannels = cid
      ? await queryAll<any>(`SELECT v.channel_name, COUNT(*) as freq FROM keyword_videos kv INNER JOIN videos v ON v.id = kv.video_id WHERE kv.campaign_id = $1 GROUP BY v.channel_name ORDER BY freq DESC LIMIT 1`, [cid])
      : await queryAll<any>(`SELECT v.channel_name, COUNT(*) as freq FROM keyword_videos kv INNER JOIN videos v ON v.id = kv.video_id WHERE kv.campaign_id IS NOT NULL GROUP BY v.channel_name ORDER BY freq DESC LIMIT 1`)

    const newVids = cid
      ? await queryAll<any>(`SELECT COUNT(*) as cnt FROM campaign_videos WHERE first_seen_at >= NOW() - INTERVAL '7 days' AND campaign_id = $1`, [cid])
      : await queryAll<any>(`SELECT COUNT(*) as cnt FROM campaign_videos WHERE first_seen_at >= NOW() - INTERVAL '7 days'`)

    const untagged = await queryAll<any>(`SELECT COUNT(*) as cnt FROM videos WHERE is_deleted = FALSE AND (tags IS NULL OR tags = '{}'::text[])`)

    const brandStats = cid
      ? await queryAll<any>(`SELECT bt.brand_name, SUM(v.view_count) as brand_views, COUNT(DISTINCT bt.video_id) as video_count FROM brand_tags bt INNER JOIN videos v ON v.id = bt.video_id WHERE bt.campaign_id = $1 GROUP BY bt.brand_name ORDER BY brand_views DESC`, [cid])
      : await queryAll<any>(`SELECT bt.brand_name, SUM(v.view_count) as brand_views, COUNT(DISTINCT bt.video_id) as video_count FROM brand_tags bt INNER JOIN videos v ON v.id = bt.video_id GROUP BY bt.brand_name ORDER BY brand_views DESC`)

    const activeJobs = await queryAll<any>(`SELECT COUNT(*) as cnt FROM scrape_jobs WHERE status IN ('running', 'pending')`)
    const totalVids = await queryAll<any>(`SELECT COUNT(*) as cnt FROM videos WHERE is_deleted = FALSE`)
    const transcriptsCount = await queryAll<any>(`SELECT COUNT(*) as cnt FROM video_transcripts WHERE fetch_status = 'success'`)

    const totalViewership = vs.total_viewership || 0
    const totalBrandViews = (brandStats || []).reduce((sum: number, b: any) => sum + (b.brand_views || 0), 0) || 1
    const top5ByViewership = (brandStats || []).slice(0, 5).map((b: any) => ({
      brand_name: b.brand_name,
      brand_total_views: b.brand_views || 0,
      sov_percent: totalBrandViews > 0 ? Math.round(((b.brand_views || 0) / totalBrandViews) * 1000) / 10 : 0,
      video_count: b.video_count || 0,
    }))

    const totalBrandMentions = (brandStats || []).reduce((sum: number, b: any) => sum + (b.video_count || 0), 0) || 1
    const top5ByFrequency = (brandStats || []).slice(0, 5).map((b: any) => ({
      brand_name: b.brand_name,
      brand_total_freq: b.video_count || 0,
      freq_sov_percent: Math.round(((b.video_count || 0) / totalBrandMentions) * 1000) / 10,
      video_count: b.video_count || 0,
    }))

    const totalVidsVal = totalVids?.[0]?.cnt ?? 0
    const transcriptsVal = transcriptsCount?.[0]?.cnt ?? 0
    const transcriptCoverage = totalVidsVal > 0 ? Math.round((transcriptsVal / totalVidsVal) * 100) : 0

    return NextResponse.json({
      lastUpdatedViews: lastViews,
      lastUpdatedRanking: lastRanking,
      totalKeywords: kwCountVal,
      totalVideos,
      totalViewership,
      uniqueVideos: vs.unique_count || 0,
      uniqueVideoViewership: totalViewership,
      uniqueChannels: vs.unique_channels || 0,
      mostRankingChannel: topChannels?.[0] ? { name: topChannels[0].channel_name, totalFrequency: topChannels[0].freq } : null,
      newVideosLast7Days: newVids?.[0]?.cnt || 0,
      untaggedVideos: untagged?.[0]?.cnt || 0,
      top5ByViewership,
      top5ByFrequency,
      growth: {
        h24: pctChange(vsToday?.[0]?.total_views || 0, vs1d?.[0]?.total_views || 0),
        d7: pctChange(vsToday?.[0]?.total_views || 0, vs7d?.[0]?.total_views || 0),
        d30: pctChange(vsToday?.[0]?.total_views || 0, vs30d?.[0]?.total_views || 0),
      },
      activeScrapingJobs: activeJobs?.[0]?.cnt || 0,
      transcriptCoverage,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function pctChange(now: number, prev: number) {
  return prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : 0
}
