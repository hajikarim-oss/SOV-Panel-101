import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const sort = req.nextUrl.searchParams.get('sort') ?? 'views'
    const tab = req.nextUrl.searchParams.get('tab') ?? 'long'
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
    const brandName = req.nextUrl.searchParams.get('brand_name')
    const keywordId = req.nextUrl.searchParams.get('keyword_id')
    const channelName = req.nextUrl.searchParams.get('channel_name')
    const search = req.nextUrl.searchParams.get('q')
    const offset = (page - 1) * limit

    const kvTable = tab === 'short' ? 'keyword_shorts' : 'keyword_videos'

    let kwConditions = ['TRUE']
    const kwParams: any[] = []
    let kwParamIdx = 1
    if (campaignId) {
      kwConditions.push(`kv.campaign_id = $${kwParamIdx++}`)
      kwParams.push(campaignId)
    }
    if (keywordId) {
      kwConditions.push(`kv.keyword_id = $${kwParamIdx++}`)
      kwParams.push(keywordId)
    }
    const kwWhere = kwConditions.join(' AND ')

    const rankedVideos = await queryAll<{
      video_id: string
      keyword_id: string
      rank: number
      discovered_at: string
      last_seen_at: string
    }>(
      `SELECT kv.video_id, kv.keyword_id, kv.rank, kv.discovered_at, kv.last_seen_at
       FROM ${kvTable} kv
       WHERE ${kwWhere}`,
      kwParams
    )

    if (rankedVideos.length === 0) {
      return NextResponse.json({ data: [], total: 0, channels: [] })
    }

    const videoIdSet = new Set(rankedVideos.map(r => r.video_id))
    const videoIds = Array.from(videoIdSet)
    const keywordIdSet = new Set(rankedVideos.map(r => r.keyword_id))
    const keywordIds = Array.from(keywordIdSet)

    const videos = await queryAll<any>(
      `SELECT id, youtube_id, title, channel_name, channel_id, tags,
              view_count, duration, duration_sec, thumbnail_url, published_at
       FROM videos WHERE id = ANY($1)`,
      [videoIds]
    )

    const keywordRows = await queryAll<{ id: string; text: string }>(
      `SELECT id, text FROM keywords WHERE id = ANY($1)`,
      [keywordIds]
    )
    const keywordTextMap = new Map(keywordRows.map(k => [k.id, k.text]))

    const videoKeywordMap = new Map<string, { keyword_text: string; rank: number }[]>()
    for (const r of rankedVideos) {
      const kwText = keywordTextMap.get(r.keyword_id) || r.keyword_id
      if (!videoKeywordMap.has(r.video_id)) videoKeywordMap.set(r.video_id, [])
      videoKeywordMap.get(r.video_id)!.push({ keyword_text: kwText, rank: r.rank })
    }

    const videoStatsMap = new Map<string, { best_rank: number; keyword_count: number; discovered_at: string; last_seen_at: string }>()
    for (const [vid, ranks] of videoKeywordMap) {
      const bestRank = Math.min(...ranks.map(r => r.rank))
      const kwCount = ranks.length
      const videoRanks = rankedVideos.filter(r => r.video_id === vid)
      const discovered = videoRanks.reduce((min, r) => !min || r.discovered_at < min ? r.discovered_at : min, '')
      const lastSeen = videoRanks.reduce((max, r) => !max || r.last_seen_at > max ? r.last_seen_at : max, '')
      videoStatsMap.set(vid, { best_rank: bestRank, keyword_count: kwCount, discovered_at: discovered, last_seen_at: lastSeen })
    }

    let videoMap = new Map(videos.map(v => [v.id, v]))

    let vConditions = ['TRUE']
    const vParams: any[] = []
    let vParamIdx = 1
    if (brandName) {
      vConditions.push(`v.id IN (SELECT video_id FROM brand_tags WHERE brand_name = $${vParamIdx++}${campaignId ? ` AND campaign_id = $${vParamIdx++}` : ''})`)
      vParams.push(brandName)
      if (campaignId) vParams.push(campaignId)
    }
    if (channelName) {
      vConditions.push(`v.channel_name = $${vParamIdx++}`)
      vParams.push(channelName)
    }
    if (search) {
      vConditions.push(`(v.title ILIKE $${vParamIdx} OR v.channel_name ILIKE $${vParamIdx})`)
      vParams.push(`%${search}%`)
      vParamIdx++
    }
    vConditions.push(`v.id = ANY($${vParamIdx++})`)
    vParams.push(videoIds)

    if (vConditions.length > 1) {
      const filtered = await queryAll<{ id: string }>(
        `SELECT id FROM videos v WHERE ${vConditions.join(' AND ')}`,
        vParams
      )
      const filteredIds = new Set(filtered.map(f => f.id))
      videoIds.filter(id => filteredIds.has(id))
    }

    let brandMap = new Map<string, string[]>()
    const brandRows = await queryAll<{ video_id: string; brand_name: string }>(
      `SELECT video_id::text, brand_name FROM brand_tags WHERE video_id::text = ANY($1)`,
      [videoIds]
    )
    for (const br of brandRows) {
      if (!brandMap.has(br.video_id)) brandMap.set(br.video_id, [])
      brandMap.get(br.video_id)!.push(br.brand_name)
    }

    let enriched = videoIds.map(vid => {
      const v = videoMap.get(vid)
      if (!v) return null
      const stats = videoStatsMap.get(vid)
      let tagsArr: string[] = []
      if (Array.isArray(v.tags)) tagsArr = v.tags
      else try { tagsArr = JSON.parse(v.tags || '[]') } catch {}

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
        is_short: tab === 'short',
        is_new: stats?.discovered_at ? new Date(stats.discovered_at) > new Date(Date.now() - 7 * 86400000) : false,
        best_rank: stats?.best_rank || 0,
        keyword_count: stats?.keyword_count || 0,
        discovered_at: stats?.discovered_at || '',
        last_seen_at: stats?.last_seen_at || '',
        keywords_appeared: (videoKeywordMap.get(vid) || []).map(r => r.keyword_text),
        keyword_ranks: videoKeywordMap.get(vid) || [],
        brands: brandMap.get(vid) || [],
      }
    }).filter(Boolean) as any[]

    if (brandName) {
      enriched = enriched.filter(v => v.brands.includes(brandName))
    }

    const sortFn = sort === 'rank'
      ? (a: any, b: any) => a.best_rank - b.best_rank
      : sort === 'views'
        ? (a: any, b: any) => b.view_count - a.view_count
        : (a: any, b: any) => b.keyword_count - a.keyword_count
    enriched.sort(sortFn)

    const total = enriched.length
    const paginated = enriched.slice(offset, offset + limit)

    const channelSet = new Set<string>()
    enriched.forEach(v => { if (v.channel_name) channelSet.add(v.channel_name) })
    const channels = Array.from(channelSet).sort()

    return NextResponse.json({ data: paginated, total, channels })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
