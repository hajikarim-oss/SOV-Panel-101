import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my',
  'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'how',
  'when', 'where', 'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'also', 'now', 'here', 'there', 'then', 'once', 'video', 'videos', 'youtube',
  'shorts', 'short', 'new', 'best', 'top', 'vs', 'review', '2024', '2025', '2026', '2027',
])

function extractCommonPhrases(titles: string[], descriptions: string[]): string[] {
  const freq = new Map<string, number>()
  const tokenize = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))

  for (const title of titles) {
    const words = tokenize(title)
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      freq.set(phrase, (freq.get(phrase) ?? 0) + 2)
    }
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  for (const desc of descriptions) {
    const words = tokenize(desc.slice(0, 200))
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([term, count]) => `${term} (${count})`)
}

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const minKeywords = parseInt(req.nextUrl.searchParams.get('min_keywords') ?? '5')
    const brandName = req.nextUrl.searchParams.get('brand_name')
    const keywordId = req.nextUrl.searchParams.get('keyword_id')
    const channelName = req.nextUrl.searchParams.get('channel_name')
    const search = req.nextUrl.searchParams.get('q')

    let conditions = ['TRUE']
    const params: any[] = []
    let idx = 1

    if (campaignId) { conditions.push(`kv.campaign_id = $${idx++}`); params.push(campaignId) }
    if (brandName) {
      conditions.push(`v.id IN (SELECT video_id FROM brand_tags WHERE brand_name = $${idx++}${campaignId ? ` AND campaign_id = $${idx++}` : ''})`)
      params.push(brandName)
      if (campaignId) params.push(campaignId)
    }
    if (keywordId) { conditions.push(`kv.keyword_id = $${idx++}`); params.push(keywordId) }
    if (channelName) { conditions.push(`v.channel_name = $${idx++}`); params.push(channelName) }
    if (search) { conditions.push(`(v.title ILIKE $${idx} OR v.channel_name ILIKE $${idx})`); params.push(`%${search}%`); idx++ }

    const whereClause = conditions.join(' AND ')

    const videos = await queryAll(`
      SELECT
        v.youtube_id, v.title, v.description, v.channel_name, v.view_count, v.thumbnail_url, v.duration_sec, v.tags,
        COUNT(DISTINCT kv.keyword_id) as keyword_count,
        STRING_AGG(DISTINCT k.text, ',') as keywords_appeared,
        STRING_AGG(DISTINCT bt.brand_name, ',') as brand_names
      FROM videos v
      INNER JOIN (
        SELECT video_id, keyword_id, campaign_id FROM keyword_videos
        UNION
        SELECT video_id, keyword_id, campaign_id FROM keyword_shorts
      ) kv ON kv.video_id = v.id
      INNER JOIN keywords k ON k.id = kv.keyword_id
      LEFT JOIN brand_tags bt ON bt.video_id = v.id ${campaignId ? 'AND bt.campaign_id = kv.campaign_id' : ''}
      WHERE ${whereClause}
      GROUP BY v.id
      HAVING COUNT(DISTINCT kv.keyword_id) >= $${idx++}
      ORDER BY keyword_count DESC, v.view_count DESC
      LIMIT 100
    `, [...params, minKeywords])

    const channelsList = campaignId ? await queryAll(`
      SELECT DISTINCT v.channel_name
      FROM videos v
      INNER JOIN (
        SELECT video_id, campaign_id FROM keyword_videos
        UNION
        SELECT video_id, campaign_id FROM keyword_shorts
      ) kv ON kv.video_id = v.id
      WHERE kv.campaign_id = $1 AND v.channel_name IS NOT NULL AND v.channel_name != ''
      ORDER BY v.channel_name ASC
    `, [campaignId]) : []

    const enriched = videos.map((v: any) => {
      let tagsArr: string[] = []
      if (Array.isArray(v.tags)) tagsArr = v.tags
      else try { tagsArr = JSON.parse(v.tags || '[]') } catch {}
      const brandTagNames = v.brand_names ? v.brand_names.split(',').filter(Boolean) : []
      const allBrands = [...new Set([...brandTagNames, ...tagsArr])].filter(Boolean)
      return {
        youtube_id: v.youtube_id, title: v.title, description: v.description || '',
        channel_name: v.channel_name, view_count: v.view_count, thumbnail_url: v.thumbnail_url || '',
        duration_sec: v.duration_sec, keyword_count: v.keyword_count,
        keywords_appeared: v.keywords_appeared ? v.keywords_appeared.split(',') : [],
        brands: allBrands, is_short: v.duration_sec < 240,
      }
    })

    const commonTerms = extractCommonPhrases(enriched.map(v => v.title || ''), enriched.map(v => v.description || ''))
    return NextResponse.json({ data: enriched, common_terms: commonTerms, channels: channelsList.map((c: any) => c.channel_name) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
