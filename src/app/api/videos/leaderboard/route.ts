import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const sort = req.nextUrl.searchParams.get('sort') ?? 'views'
    const tab = req.nextUrl.searchParams.get('tab') ?? 'all'
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
    const brandName = req.nextUrl.searchParams.get('brand_name')
    const keywordId = req.nextUrl.searchParams.get('keyword_id')
    const channelName = req.nextUrl.searchParams.get('channel_name')
    const search = req.nextUrl.searchParams.get('q')
    const offset = (page - 1) * limit

    let conditions = ['TRUE']
    const params: any[] = []
    let paramIdx = 1

    if (campaignId) {
      conditions.push(`kv.campaign_id = $${paramIdx++}`)
      params.push(campaignId)
    }
    if (brandName) {
      conditions.push(`v.id IN (SELECT video_id FROM brand_tags WHERE brand_name = $${paramIdx++}${campaignId ? ` AND campaign_id = $${paramIdx++}` : ''})`)
      params.push(brandName)
      if (campaignId) params.push(campaignId)
    }
    if (keywordId) {
      conditions.push(`kv.keyword_id = $${paramIdx++}`)
      params.push(keywordId)
    }
    if (channelName) {
      conditions.push(`v.channel_name = $${paramIdx++}`)
      params.push(channelName)
    }
    if (search) {
      conditions.push(`(v.title ILIKE $${paramIdx} OR v.channel_name ILIKE $${paramIdx})`)
      params.push(`%${search}%`)
      paramIdx++
    }

    const whereClause = conditions.join(' AND ')

    const orderBy = sort === 'rank'
      ? 'best_rank ASC'
      : sort === 'views'
        ? 'v.view_count DESC'
        : 'keyword_count DESC'

    const kvTable = tab === 'short' ? 'keyword_shorts' : 'keyword_videos'
    const isShortExpr = tab === 'short' ? 'TRUE' : 'FALSE'

    let fromClause: string
    if (tab === 'all') {
      fromClause = `(
        SELECT kv.video_id, kv.rank, kv.keyword_id, kv.campaign_id, kv.discovered_at, kv.last_seen_at, FALSE as is_short FROM keyword_videos kv
        UNION ALL
        SELECT ks.video_id, ks.rank, ks.keyword_id, ks.campaign_id, ks.discovered_at, ks.last_seen_at, TRUE as is_short FROM keyword_shorts ks
      ) kv`
    } else {
      fromClause = `${kvTable} kv`
    }

    const isShortSelect = tab === 'all' ? 'BOOL_OR(kv.is_short) as is_short' : `${isShortExpr} as is_short`

    const videos = await queryAll(`
      SELECT 
        v.id, v.youtube_id, v.title, v.channel_name, v.tags, v.channel_id,
        v.view_count, v.duration, v.duration_sec, v.thumbnail_url, v.published_at,
        MIN(kv.rank) as best_rank,
        COUNT(DISTINCT kv.keyword_id) as keyword_count,
        MIN(kv.discovered_at) as discovered_at,
        MAX(kv.last_seen_at) as last_seen_at,
        STRING_AGG(DISTINCT k.text, ',') as keywords_appeared,
        ${isShortSelect}
      FROM videos v
      INNER JOIN ${fromClause} ON kv.video_id = v.id
      INNER JOIN keywords k ON k.id = kv.keyword_id
      WHERE ${whereClause}
      GROUP BY v.id
      ORDER BY ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset])

    const totalResult = await queryOne(`
      SELECT COUNT(DISTINCT v.id) as cnt
      FROM videos v
      INNER JOIN ${fromClause} ON kv.video_id = v.id
      WHERE ${whereClause}
    `, params)
    const total = totalResult?.cnt ?? 0

    const channelsList = campaignId ? await queryAll(`
      SELECT DISTINCT v.channel_name
      FROM videos v
      INNER JOIN ${fromClause} ON kv.video_id = v.id
      WHERE kv.campaign_id = $1 AND v.channel_name IS NOT NULL AND v.channel_name != ''
      ORDER BY v.channel_name ASC
    `, [campaignId]) : []

    const videoIds = videos.map((v: any) => v.id)

    let brandMap = new Map<string, string[]>()
    let keywordRankMap = new Map<string, { keyword_text: string; rank: number }[]>()
    if (videoIds.length > 0) {
      const brandRows = await queryAll<{ video_id: string; brand_name: string }>(
        `SELECT video_id::text, brand_name FROM brand_tags WHERE video_id::text = ANY($1)`,
        [videoIds]
      )
      for (const br of brandRows) {
        if (!brandMap.has(br.video_id)) brandMap.set(br.video_id, [])
        brandMap.get(br.video_id)!.push(br.brand_name)
      }

      let keywordRanksFromClause: string
      if (tab === 'all') {
        keywordRanksFromClause = `(
          SELECT kv.video_id, kv.rank, kv.keyword_id FROM keyword_videos kv
          UNION ALL
          SELECT ks.video_id, ks.rank, ks.keyword_id FROM keyword_shorts ks
        ) krv`
      } else {
        keywordRanksFromClause = `${kvTable} krv`
      }

      const kwRankSql = campaignId
        ? `SELECT krv.video_id::text, k.text as keyword_text, krv.rank
           FROM ${keywordRanksFromClause}
           INNER JOIN keywords k ON k.id = krv.keyword_id
           WHERE krv.video_id::text = ANY($1) AND krv.campaign_id = $2
           ORDER BY krv.rank ASC`
        : `SELECT krv.video_id::text, k.text as keyword_text, krv.rank
           FROM ${keywordRanksFromClause}
           INNER JOIN keywords k ON k.id = krv.keyword_id
           WHERE krv.video_id::text = ANY($1)
           ORDER BY krv.rank ASC`
      const kwRankParams = campaignId ? [videoIds, campaignId] : [videoIds]

      const kwRankRows = await queryAll<{ video_id: string; keyword_text: string; rank: number }>(kwRankSql, kwRankParams)
      for (const kr of kwRankRows) {
        if (!keywordRankMap.has(kr.video_id)) keywordRankMap.set(kr.video_id, [])
        keywordRankMap.get(kr.video_id)!.push({ keyword_text: kr.keyword_text, rank: kr.rank })
      }
    }

    const enriched = videos.map((v: any) => {
      let tagsArr: string[] = []
      if (Array.isArray(v.tags)) tagsArr = v.tags
      else try { tagsArr = JSON.parse(v.tags || '[]') } catch {}

      const keywords_appeared = v.keywords_appeared ? v.keywords_appeared.split(',') : []

      return {
        id: v.id,
        youtube_id: v.youtube_id,
        title: v.title,
        channel_name: v.channel_name,
        channel_id: v.channel_id || '',
        view_count: v.view_count || 0,
        duration: v.duration || '',
        duration_sec: v.duration_sec || 0,
        thumbnail_url: v.thumbnail_url || '',
        published_at: v.published_at || '',
        tags: tagsArr,
        is_short: v.is_short,
        is_new: v.discovered_at ? new Date(v.discovered_at) > new Date(Date.now() - 7 * 86400000) : false,
        best_rank: v.best_rank || 0,
        keyword_count: v.keyword_count || 0,
        discovered_at: v.discovered_at,
        last_seen_at: v.last_seen_at,
        keywords_appeared,
        keyword_ranks: keywordRankMap.get(v.id) || [],
        brands: brandMap.get(v.id) || [],
      }
    })

    return NextResponse.json({ data: enriched, total, channels: channelsList.map((c: any) => c.channel_name) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
