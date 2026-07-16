import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

// GET /api/campaigns/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const campaign = await queryOne(`SELECT * FROM campaigns WHERE id = $1`, [id])
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const keywords = await queryAll(`
      SELECT k.*,
        (SELECT COUNT(*)::int FROM keyword_videos kv WHERE kv.keyword_id = k.id) as long_form_count,
        (SELECT COUNT(*)::int FROM keyword_shorts ks WHERE ks.keyword_id = k.id) as short_form_count,
        (SELECT MAX(kv2.last_seen_at) FROM keyword_videos kv2 WHERE kv2.keyword_id = k.id) as last_scraped
      FROM keywords k WHERE k.campaign_id = $1 ORDER BY k.created_at DESC
    `, [id])

    const brands = await queryAll(`SELECT * FROM campaign_brands WHERE campaign_id = $1 ORDER BY created_at ASC`, [id])
    const jobs = await queryAll(`SELECT * FROM scrape_jobs WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 20`, [id])

    return NextResponse.json({ campaign, keywords, brands, jobs })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/campaigns/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    await queryOne(
      `UPDATE campaigns SET name=$1, category=$2, sub_category=$3, description=$4, status=$5 WHERE id=$6`,
      [body.name, body.category ?? '', body.sub_category ?? '', body.description ?? '', body.status ?? 'active', id]
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await queryOne(`DELETE FROM campaigns WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
