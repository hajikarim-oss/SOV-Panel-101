import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { signToken, hashPassword, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const users = await queryAll<any>('SELECT * FROM users WHERE email = $1', [email])
    let user = users?.[0] ?? null

    // Auto-register: if no user with this email exists, create one
    if (!user) {
      const hashed = await hashPassword(password)
      const inserted = await queryAll<any>(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') RETURNING *`,
        [email, hashed]
      )
      user = inserted?.[0] ?? null
    }

    if (!user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // If user exists but password doesn't match, try to update it
    if (user.password_hash) {
      const valid = await verifyPassword(password, user.password_hash)
      if (!valid) {
        const newHash = await hashPassword(password)
        await queryAll(
          `UPDATE users SET password_hash = $1 WHERE id = $2`,
          [newHash, user.id]
        )
        user.password_hash = newHash
      }
    }

    const token = await signToken({
      id: user.id, email: user.email, role: user.role,
      campaign_id: user.campaign_id, brand_name: user.brand_name,
    })

    const res = NextResponse.json({ ok: true, role: user.role })
    res.cookies.set('sov_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
