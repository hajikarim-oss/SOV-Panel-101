import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

// PATCH /api/videos/ownership — toggle is_ours for a video
export async function PATCH(req: NextRequest) {
  try {
    const { video_id, is_ours, campaign_id } = await req.json()
    if (!video_id) return NextResponse.json({ error: 'video_id required' }, { status: 400 })

    // Update videos table
    const { error: vErr } = await supabase
      .from('videos')
      .update({ is_ours: !!is_ours })
      .eq('id', video_id)
    if (vErr) throw vErr

    // Also update campaign_videos if campaign_id provided
    if (campaign_id) {
      await supabase
        .from('campaign_videos')
        .update({ is_ours: !!is_ours })
        .eq('video_id', video_id)
        .eq('campaign_id', campaign_id)
    }

    return NextResponse.json({ ok: true, video_id, is_ours: !!is_ours })
  } catch (e: any) {
    console.error('Ownership toggle error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/videos/ownership — bulk toggle
export async function POST(req: NextRequest) {
  try {
    const { video_ids, is_ours, campaign_id } = await req.json()
    if (!video_ids?.length) return NextResponse.json({ error: 'video_ids required' }, { status: 400 })

    const { error: vErr } = await supabase
      .from('videos')
      .update({ is_ours: !!is_ours })
      .in('id', video_ids)
    if (vErr) throw vErr

    if (campaign_id) {
      await supabase
        .from('campaign_videos')
        .update({ is_ours: !!is_ours })
        .in('video_id', video_ids)
        .eq('campaign_id', campaign_id)
    }

    return NextResponse.json({ ok: true, count: video_ids.length, is_ours: !!is_ours })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
