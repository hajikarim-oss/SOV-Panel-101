import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll } from '@/lib/supabase'

export async function GET() {
  try {
    const row = await queryOne<any>(
      `SELECT value, updated_at FROM system_metadata WHERE key = 'app_settings'`
    )
    const settings = row?.value ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {}
    return NextResponse.json({ settings, updatedAt: row?.updated_at || null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const existing = await queryOne<any>(
      `SELECT value FROM system_metadata WHERE key = 'app_settings'`
    )
    const current = existing?.value ? (typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value) : {}
    const merged = { ...current, ...body }

    await queryAll(
      `INSERT INTO system_metadata (key, value, updated_at)
       VALUES ('app_settings', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(merged)]
    )
    return NextResponse.json({ ok: true, settings: merged })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
