import { NextRequest, NextResponse } from 'next/server'
import { syncAllDataToSheets } from '@/lib/google-sheets'

export async function POST(req: NextRequest) {
  try {
    const result = await syncAllDataToSheets()
    return NextResponse.json({
      ok: true,
      message: `Synced ${result.rowsWritten} rows across ${result.sheetsUpdated.length} sheets`,
      ...result,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { queryOne } = await import('@/lib/supabase')
    const lastSync = await queryOne<any>(
      `SELECT value, updated_at FROM system_metadata WHERE key = 'sheets_sync_log'`
    )

    return NextResponse.json({
      lastSync: lastSync ? JSON.parse(lastSync.value) : null,
      lastSyncAt: lastSync?.updated_at || null,
      configured: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
