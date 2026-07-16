import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const { youtube_id, tags, campaign_id } = await req.json()
    if (!youtube_id || !campaign_id || !Array.isArray(tags)) {
      return NextResponse.json({ error: 'youtube_id, campaign_id, and tags array required' }, { status: 400 })
    }

    const { data: video } = await supabase.from('videos').select('id').eq('youtube_id', youtube_id).single()
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

    await supabase.from('videos').update({ tags }).eq('id', video.id)

    await supabase.from('brand_tags').delete().eq('video_id', video.id).eq('campaign_id', campaign_id)

    const inserts = tags.filter((t: string) => t.trim()).map((tag: string) => ({
      video_id: video.id,
      brand_name: tag.trim(),
      campaign_id,
    }))
    if (inserts.length > 0) {
      await supabase.from('brand_tags').upsert(inserts, { onConflict: 'video_id,brand_name,campaign_id', ignoreDuplicates: true })
    }

    return NextResponse.json({ ok: true, tags })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Video tags PATCH error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
