import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { video_id, brand_name, campaign_id } = body

    if (!video_id || !brand_name || !campaign_id) {
      return NextResponse.json({ error: 'video_id, brand_name, and campaign_id are required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('brand_tags')
      .upsert({ video_id, brand_name: brand_name.trim(), campaign_id }, { onConflict: 'video_id,brand_name,campaign_id' })

    if (error) {
      console.error('Brand tag save error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Brand tag API error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const video_id = searchParams.get('video_id')
    const brand_name = searchParams.get('brand_name')
    const campaign_id = searchParams.get('campaign_id')

    if (!video_id || !brand_name || !campaign_id) {
      return NextResponse.json({ error: 'video_id, brand_name, and campaign_id are required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('brand_tags')
      .delete()
      .eq('video_id', video_id)
      .eq('brand_name', brand_name)
      .eq('campaign_id', campaign_id)

    if (error) {
      console.error('Brand tag delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
