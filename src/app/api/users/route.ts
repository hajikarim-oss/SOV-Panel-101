import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'
import { hashPassword } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const users = await queryAll(`
      SELECT u.id, u.email, u.role, u.brand_name, c.name as campaign_name
      FROM users u
      LEFT JOIN campaigns c ON c.id = u.campaign_id
      ORDER BY u.created_at DESC
    `)
    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, role, campaign_id, brand_name } = await req.json()
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 })
    }

    const hashed = hashPassword(password)
    await queryOne(`
      INSERT INTO users (email, password_hash, role, campaign_id, brand_name)
      VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING
    `, [email, hashed, role, campaign_id || null, brand_name || null])

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await queryOne('DELETE FROM users WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
