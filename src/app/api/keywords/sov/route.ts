import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  const language = req.nextUrl.searchParams.get('language') ?? 'all'
  const type = req.nextUrl.searchParams.get('type') ?? 'all'

  if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

  try {
    // Get all brands in campaign
    const brands = await queryAll(`SELECT name FROM campaign_brands WHERE campaign_id = $1`, [campaignId])
    const brandNames = brands.map((b: any) => b.name)

    // Get keywords
    let conditions = ['k.campaign_id = $1']
    const params: any[] = [campaignId]
    let idx = 2
    if (language !== 'all') { conditions.push(`k.language = $${idx++}`); params.push(language) }
    if (type !== 'all') { conditions.push(`k.type = $${idx++}`); params.push(type) }

    const keywords = await queryAll(`
      SELECT k.id, k.text, k.type, k.language, k.status
      FROM keywords k
      WHERE ${conditions.join(' AND ')}
      ORDER BY k.created_at DESC
    `, params)

    const data = keywords.map((kw: any) => {
      // Get videos for this keyword (long form only for simplicity in SOV view)
      const videos: any[] = [] // Will be populated synchronously
      return { keyword: kw.text, total_videos: 0 }
    })

    // For each keyword, get video views and brand distribution
    const enrichedData = await Promise.all(keywords.map(async (kw: any) => {
      const videos = await queryAll(`
        SELECT v.id, v.view_count, v.title, v.channel_name, v.tags
        FROM videos v
        WHERE v.id IN (
          SELECT video_id FROM keyword_videos WHERE keyword_id = $1
          UNION
          SELECT video_id FROM keyword_shorts WHERE keyword_id = $1
        )
      `, [kw.id])

      const totalViews = videos.reduce((acc: number, v: any) => acc + (v.view_count || 0), 0)

      const entry: Record<string, string | number> = {
        keyword: kw.text, total_videos: videos.length,
      }
      let brandTotal = 0

      for (const bName of brandNames) {
        const brandViews = videos
          .filter((v: any) => {
            let tagsArr: string[] = []
            if (Array.isArray(v.tags)) tagsArr = v.tags
            else try { tagsArr = JSON.parse(v.tags || '[]') } catch {}
            return tagsArr.some((t: string) => t.toLowerCase() === bName.toLowerCase()) ||
              v.title.toLowerCase().includes(bName.toLowerCase()) ||
              v.channel_name.toLowerCase().includes(bName.toLowerCase())
          })
          .reduce((acc: number, v: any) => acc + (v.view_count || 0), 0)

        const pct = totalViews > 0 ? parseFloat(((brandViews / totalViews) * 100).toFixed(1)) : 0
        entry[bName] = pct
        brandTotal += pct
      }

      entry['Other'] = parseFloat(Math.max(0, 100 - brandTotal).toFixed(1))
      return entry
    }))

    return NextResponse.json({ data: enrichedData, brandNames })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
