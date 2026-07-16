import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/supabase'

// GET /api/setup — seeds initial API keys (encrypted at rest) if not already present
export async function GET() {
  try {
    const { encryptApiKey } = await import('@/lib/crypto')

    const INITIAL_KEYS = [
      { label: 'Project Alpha — Key 1', api_key: 'AIzaSyADRQd3vbquiF-7eXv8loCFRQrKanCek2w', bucket: 1 },
      { label: 'Project Alpha — Key 2', api_key: 'AIzaSyBKUj5c0Vdo67mIC4DYUBzq7FkZOHicEmc', bucket: 1 },
      { label: 'Project Alpha — Key 3', api_key: 'AIzaSyDyb2sJ3fgpl4rRi-wPgXSh4VK8TCjUBuM', bucket: 1 },
      { label: 'Project Beta  — Key 1', api_key: 'AIzaSyCmOwLRt4f2x7WjE-kxWDAMBh_NEhlGGAI', bucket: 2 },
      { label: 'Project Beta  — Key 2', api_key: 'AIzaSyAI4JYmKUfSHhP1Y4Eig4LXMAb9v2EJuPE', bucket: 2 },
    ]

    let seeded = 0
    for (const k of INITIAL_KEYS) {
      const encrypted = encryptApiKey(k.api_key)
      const existing = await queryOne(`SELECT id FROM api_keys WHERE label = $1 AND api_key = $2`, [k.label, encrypted])
      if (!existing) {
        await queryOne(
          `INSERT INTO api_keys (label, api_key, bucket, units_limit) VALUES ($1, $2, $3, 10000) ON CONFLICT DO NOTHING`,
          [k.label, encrypted, k.bucket]
        )
        seeded++
      }
    }

    const total = await queryOne(`SELECT COUNT(*) as cnt FROM api_keys`)

    return NextResponse.json({
      ok: true,
      message: seeded > 0 ? `Seeded ${seeded} API keys (encrypted at rest)` : 'Keys already set up',
      total_keys: total?.cnt || 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
