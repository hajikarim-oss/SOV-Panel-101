import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id')

    let where = ''
    const params: any[] = []
    if (campaignId) { where = 'WHERE k.campaign_id = $1'; params.push(campaignId) }

    const keywords = await queryAll(`
      SELECT k.*,
        (SELECT COUNT(*)::int FROM keyword_videos kv WHERE kv.keyword_id = k.id) as long_form_count,
        (SELECT COUNT(*)::int FROM keyword_shorts ks WHERE ks.keyword_id = k.id) as short_form_count,
        (SELECT MAX(kv.last_seen_at) FROM keyword_videos kv WHERE kv.keyword_id = k.id) as last_scraped
      FROM keywords k ${where}
      ORDER BY k.created_at DESC
    `, params)

    return NextResponse.json({ keywords })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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
      const result = await queryOne(
        `INSERT INTO keywords (campaign_id, text, language, type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (campaign_id, text) DO NOTHING
         RETURNING id`,
        [campaignId, kw.text.trim(), kw.language ?? 'en', kw.type ?? 'generic']
      )
      if (result) added++
    }

    return NextResponse.json({ added }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await queryOne(`DELETE FROM keywords WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json()
    await queryOne(`UPDATE keywords SET status = $1 WHERE id = $2`, [status, id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
