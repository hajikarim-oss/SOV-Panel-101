import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const weekStart = getWeekStart()
    const prevWeekStart = new Date(new Date(weekStart).getTime() - 7 * 86400000).toISOString().split('T')[0]

    let params: any[] = [prevWeekStart]
    let idx = 2
    let campCond = ''
    if (campaignId) { campCond = `AND h.campaign_id = $${idx++}`; params.push(campaignId) }

    // Primary: ranked last week but not in current rankings
    let dropped = await queryAll(`
      SELECT DISTINCT
        v.youtube_id, v.title, v.channel_name, v.view_count, v.thumbnail_url, v.duration_sec, v.tags,
        h.rank as last_rank,
        h.week_start as last_seen_at,
        h.form_type,
        k.text as keyword_text,
        STRING_AGG(DISTINCT bt.brand_name, ',') as brand_names
      FROM keyword_rank_history h
      INNER JOIN videos v ON v.id = h.video_id
      INNER JOIN keywords k ON k.id = h.keyword_id
      LEFT JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = h.campaign_id
      WHERE h.week_start = $1
        AND h.rank <= 10
        AND NOT EXISTS (SELECT 1 FROM keyword_videos kv WHERE kv.keyword_id = h.keyword_id AND kv.video_id = h.video_id AND kv.rank <= 10)
        AND NOT EXISTS (SELECT 1 FROM keyword_shorts ks WHERE ks.keyword_id = h.keyword_id AND ks.video_id = h.video_id AND ks.rank <= 10)
        ${campCond}
      GROUP BY v.id, v.youtube_id, v.title, v.channel_name, v.view_count, v.thumbnail_url, v.duration_sec, v.tags, h.keyword_id, h.rank, h.form_type, h.week_start, k.text
      ORDER BY h.rank ASC
      LIMIT 100
    `, params)

    // Fallback A: no history - videos previously scraped but no longer current
    if (dropped.length === 0 && campaignId) {
      dropped = await queryAll(`
        SELECT DISTINCT
          v.youtube_id, v.title, v.channel_name, v.view_count, v.thumbnail_url, v.duration_sec, v.tags,
          MIN(old_kv.rank) as last_rank,
          MAX(old_kv.last_seen_at) as last_seen_at,
          'long' as form_type,
          STRING_AGG(DISTINCT k.text, ',') as keyword_text,
          STRING_AGG(DISTINCT bt.brand_name, ',') as brand_names
        FROM videos v
        INNER JOIN keyword_videos old_kv ON old_kv.video_id = v.id
        INNER JOIN keywords k ON k.id = old_kv.keyword_id
        LEFT JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = old_kv.campaign_id
        WHERE NOT EXISTS (
          SELECT 1 FROM keyword_videos kv2
          WHERE kv2.keyword_id = old_kv.keyword_id AND kv2.video_id = v.id
            AND kv2.last_seen_at = (SELECT MAX(last_seen_at) FROM keyword_videos kv3 WHERE kv3.keyword_id = old_kv.keyword_id)
        )
        AND old_kv.campaign_id = $1
        GROUP BY v.id
        ORDER BY last_seen_at DESC
        LIMIT 50
      `, [campaignId])
    }

    // Fallback B: videos in pool but not recent
    if (dropped.length === 0 && campaignId) {
      const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      dropped = await queryAll(`
        SELECT DISTINCT
          v.youtube_id, v.title, v.channel_name, v.view_count, v.thumbnail_url, v.duration_sec, v.tags,
          MAX(kv.last_seen_at) as last_seen_at,
          MIN(kv.rank) as last_rank,
          'long' as form_type,
          STRING_AGG(DISTINCT k.text, ',') as keyword_text,
          STRING_AGG(DISTINCT bt.brand_name, ',') as brand_names
        FROM videos v
        INNER JOIN (
          SELECT video_id, keyword_id, campaign_id, rank, discovered_at, last_seen_at FROM keyword_videos
          UNION ALL
          SELECT video_id, keyword_id, campaign_id, rank, discovered_at, last_seen_at FROM keyword_shorts
        ) kv ON kv.video_id = v.id
        INNER JOIN keywords k ON k.id = kv.keyword_id
        LEFT JOIN brand_tags bt ON bt.video_id = v.id AND bt.campaign_id = kv.campaign_id
        WHERE kv.last_seen_at < $1 AND kv.campaign_id = $2
        GROUP BY v.id
        ORDER BY last_seen_at DESC
        LIMIT 50
      `, [sevenAgo, campaignId])
    }

    const enriched = dropped.map((v: any) => {
      let tagsArr: string[] = []
      if (Array.isArray(v.tags)) tagsArr = v.tags
      else try { tagsArr = JSON.parse(v.tags || '[]') } catch {}
      const brandTagNames = v.brand_names ? v.brand_names.split(',').filter(Boolean) : []
      const allBrands = [...new Set([...brandTagNames, ...tagsArr])].filter(Boolean)
      return {
        ...v, thumbnail_url: v.thumbnail_url || '',
        keywords_appeared: typeof v.keyword_text === 'string' ? v.keyword_text.split(',') : [],
        brands: allBrands,
        is_short: v.form_type === 'short' || v.duration_sec < 240,
        drop_reason: 'pushed_out',
      }
    })

    return NextResponse.json({ data: enriched, week_start: weekStart, source: dropped.length > 0 ? 'history' : 'fallback' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
