import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne } from '@/lib/supabase'

// ── GET /api/api-keys ──────────────────────────────────────────────
export async function GET() {
  try {
    const { decryptApiKey, maskApiKey } = await import('@/lib/crypto')

    const rawKeys = await queryAll(`
      SELECT id, label, bucket, units_used, units_limit, is_active,
             last_used_at, reset_date, created_at, api_key
      FROM api_keys
      ORDER BY bucket ASC, units_used ASC
    `)

    const keys = rawKeys.map((k: any) => {
      let masked = '••••••••••••••••••••••••••••••••'
      try {
        const plain = decryptApiKey(k.api_key)
        masked = maskApiKey(plain)
      } catch {
        masked = k.api_key.slice(0, 8) + '••••••••••••••••'
      }
      return {
        id: k.id, label: k.label, bucket: k.bucket,
        units_used: k.units_used, units_limit: k.units_limit,
        is_active: k.is_active, last_used_at: k.last_used_at,
        reset_date: k.reset_date, created_at: k.created_at,
        api_key_masked: masked,
        usage_pct: parseFloat(((k.units_used / Math.max(k.units_limit, 1)) * 100).toFixed(1)),
      }
    })

    const stats = await queryOne(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
        SUM(units_used) as total_used,
        SUM(units_limit) as total_capacity,
        SUM(CASE WHEN (units_used + 100) > units_limit THEN 1 ELSE 0 END) as exhausted
      FROM api_keys
    `)

    return NextResponse.json({ keys, stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST /api/api-keys — add one key ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { encryptApiKey } = await import('@/lib/crypto')
    const { label, api_key, bucket, units_limit } = await req.json()
    if (!api_key?.trim()) return NextResponse.json({ error: 'api_key required' }, { status: 400 })

    const raw = api_key.trim()
    if (!raw.startsWith('AIza') || raw.length < 30) {
      return NextResponse.json({ error: 'Invalid YouTube API key format (must start with AIza)' }, { status: 400 })
    }

    const encrypted = encryptApiKey(raw)
    await queryOne(`
      INSERT INTO api_keys (label, api_key, bucket, units_limit)
      VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
    `, [label?.trim() || 'New Key', encrypted, bucket ?? 1, units_limit ?? 10000])

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── PATCH /api/api-keys — toggle active or reset quota ────────────
export async function PATCH(req: NextRequest) {
  try {
    const { id, action } = await req.json()
    if (action === 'toggle') {
      await queryOne(`UPDATE api_keys SET is_active = NOT is_active WHERE id = $1`, [id])
    } else if (action === 'reset') {
      await queryOne(`UPDATE api_keys SET units_used = 0, reset_date = CURRENT_DATE WHERE id = $1`, [id])
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── DELETE /api/api-keys?id=xxx ────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await queryOne(`DELETE FROM api_keys WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
