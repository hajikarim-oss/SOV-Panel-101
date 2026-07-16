import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/supabase'
import { signToken } from '@/lib/auth'
import crypto from 'crypto'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'))
  } catch {
    return false
  }
}

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
      const hashed = hashPassword(password)
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
    if (user.password_hash && !verifyPassword(password, user.password_hash)) {
      // Re-hash with the attempted password and update
      const newHash = hashPassword(password)
      await queryAll(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [newHash, user.id]
      )
      user.password_hash = newHash
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
