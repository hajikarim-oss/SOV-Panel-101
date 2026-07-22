import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'sov_dashboard_secret_key_minimum_32_characters'
)

// Uses Web Crypto API (available in Edge Runtime) instead of Node.js crypto
// to avoid Edge bundler errors while keeping strong password hashing.

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = bytesToHex(salt)

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  )

  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-512' },
    keyMaterial, 512
  )

  return `${saltHex}:${bytesToHex(new Uint8Array(hash))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(':')) return false
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false

  const salt = hexToBytes(saltHex)

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  )

  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-512' },
    keyMaterial, 512
  )

  const computedHex = bytesToHex(new Uint8Array(hash))

  // Constant-time comparison (same length, byte-by-byte)
  if (computedHex.length !== hashHex.length) return false
  let diff = 0
  for (let i = 0; i < computedHex.length; i++) diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i)
  return diff === 0
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

export async function authorizeCampaignAccess(
  req: NextRequest,
  campaignId: string | null
): Promise<{ authorized: boolean; error?: NextResponse }> {
  if (!campaignId) {
    return { authorized: false, error: NextResponse.json({ error: 'campaign_id required' }, { status: 400 }) }
  }

  const session = await getSession(req)
  if (!session) {
    return { authorized: false, error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  // Admin can access any campaign
  if (session.role === 'admin') {
    return { authorized: true }
  }

  // Brand users can only access their assigned campaign
  if (session.campaign_id !== campaignId) {
    return { authorized: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { authorized: true }
}
