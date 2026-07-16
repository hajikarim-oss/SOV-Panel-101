import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sov_dashboard_secret_key_minimum_32_characters'
)

// Simplified PBKDF2 style hashing or basic HMAC-SHA256 signature to avoid importing 'crypto'
// inside the Next.js Middleware edge runtime context.
export function hashPassword(password: string): string {
  // Since hashPassword is only used on the server API side, we can dynamically require 'crypto'
  // to prevent Edge Runtime middleware bundler import failures.
  const crypto = require('crypto')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false
  const crypto = require('crypto')
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'))
}

export async function signToken(payload: { id: string; email: string; role: 'admin' | 'brand'; campaign_id?: string | null; brand_name?: string | null }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { id: string; email: string; role: 'admin' | 'brand'; campaign_id?: string | null; brand_name?: string | null }
  } catch {
    return null
  }
}

export async function getSession(req: NextRequest) {
  const token = req.cookies.get('sov_session')?.value
  if (!token) return null
  return verifyToken(token)
}
