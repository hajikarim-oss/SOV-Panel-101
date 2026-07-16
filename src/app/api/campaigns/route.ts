import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

// GET /api/campaigns
export async function GET() {
  try {
    const campaigns = await queryAll(`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM keywords k WHERE k.campaign_id = c.id AND k.status = 'active') as keyword_count,
        (SELECT COUNT(*)::int FROM campaign_brands cb WHERE cb.campaign_id = c.id) as brand_count,
        (SELECT MAX(j.created_at) FROM scrape_jobs j WHERE j.campaign_id = c.id) as last_scraped
      FROM campaigns c
      ORDER BY c.created_at DESC
    `)

    return NextResponse.json({ campaigns })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/campaigns
export async function POST(req: NextRequest) {
  try {
    const { name, category, sub_category, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

    const campaign = await queryOne(`
      INSERT INTO campaigns (name, category, sub_category, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING
      RETURNING *
    `, [name.trim(), category ?? '', sub_category ?? '', description ?? ''])

    if (!campaign) return NextResponse.json({ error: 'Campaign name already exists' }, { status: 409 })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
