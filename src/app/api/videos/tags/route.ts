import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const { youtube_id, tags, campaign_id } = await req.json()
    if (!youtube_id || !campaign_id || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'youtube_id, campaign_id, and tags array required' }, { status: 400 })
    }

    // 1. Find internal video id
    const video = await queryOne(`SELECT id FROM videos WHERE youtube_id = $1`, [youtube_id])
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

    // 2. Update tags
    await queryOne(`UPDATE videos SET tags = $1 WHERE id = $2`, [JSON.stringify(tags), video.id])

    // 3. Delete existing brand tags
    await queryOne(`DELETE FROM brand_tags WHERE video_id = $1 AND campaign_id = $2`, [video.id, campaign_id])

    // 4. Insert new brand tags
    for (const tag of tags) {
      if (tag.trim()) {
        await queryOne(
          `INSERT INTO brand_tags (video_id, brand_name, campaign_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [video.id, tag.trim(), campaign_id]
        )
      }
    }

    return NextResponse.json({ ok: true, tags })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
