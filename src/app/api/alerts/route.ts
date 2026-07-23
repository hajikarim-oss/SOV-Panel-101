import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

export async function GET() {
  try {
    const rules = await queryAll(
      `SELECT ar.*, c.name as campaign_name
       FROM alert_rules ar
       LEFT JOIN campaigns c ON c.id = ar.campaign_id
       ORDER BY ar.created_at DESC`
    )
    return NextResponse.json({ rules })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { campaign_id, brand_name, metric, threshold, direction, webhook_url, email } = await req.json()
    if (!campaign_id || !metric || threshold == null || !direction) {
      return NextResponse.json({ error: 'campaign_id, metric, threshold, direction required' }, { status: 400 })
    }
    await queryOne(
      `INSERT INTO alert_rules (campaign_id, brand_name, metric, threshold, direction, webhook_url, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [campaign_id, brand_name || '', metric, threshold, direction, webhook_url || null, email || null]
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    for (const [k, v] of Object.entries(updates)) {
      if (['is_active', 'threshold', 'direction', 'webhook_url', 'email', 'brand_name', 'metric'].includes(k)) {
        sets.push(`${k} = $${i++}`)
        vals.push(v)
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    vals.push(id)
    await queryOne(
      `UPDATE alert_rules SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
      vals
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await queryOne(`DELETE FROM alert_rules WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
