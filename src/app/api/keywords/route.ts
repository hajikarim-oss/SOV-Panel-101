import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    let q = supabase.from('keywords').select('*').order('created_at', { ascending: false })
    if (campaignId) q = q.eq('campaign_id', campaignId)

    const { data: keywords, error } = await q

    if (error) {
      console.error('Keywords GET error:', error)
      return NextResponse.json({ error: error.message, keywords: [] }, { status: 500 })
    }

    const enriched = await Promise.all((keywords || []).map(async (kw: any) => {
      const [kvRes, ksRes, lastRes] = await Promise.all([
        supabase.from('keyword_videos').select('id', { count: 'exact', head: true }).eq('keyword_id', kw.id),
        supabase.from('keyword_shorts').select('id', { count: 'exact', head: true }).eq('keyword_id', kw.id),
        supabase.from('keyword_videos').select('last_seen_at').eq('keyword_id', kw.id).order('last_seen_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      return {
        ...kw,
        long_form_count: kvRes.count || 0,
        short_form_count: ksRes.count || 0,
        last_scraped: lastRes.data?.last_seen_at || kw.last_scraped_at || null,
      }
    }))

    return NextResponse.json({ keywords: enriched })
  } catch (e: any) {
    console.error('Keywords API error:', e)
    return NextResponse.json({ error: e.message, keywords: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const items = Array.isArray(body.keywords)
      ? body.keywords
      : [{ text: body.text, language: body.language, type: body.type }]

    const campaignId = body.campaign_id
    if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

    let added = 0
    for (const kw of items) {
      if (!kw.text?.trim()) continue
      const { data, error } = await supabase
        .from('keywords')
        .upsert(
          { campaign_id: campaignId, text: kw.text.trim(), language: kw.language ?? 'en', category: kw.type ?? 'generic' },
          { onConflict: 'campaign_id,text', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle()
      if (data && !error) added++
    }

    return NextResponse.json({ added }, { status: 201 })
  } catch (e: any) {
    console.error('Keywords POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await supabase.from('keywords').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Keywords DELETE error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json()
    await supabase.from('keywords').update({ status }).eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Keywords PATCH error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
