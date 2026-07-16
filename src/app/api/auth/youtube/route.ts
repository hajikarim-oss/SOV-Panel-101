import { NextRequest, NextResponse } from 'next/server'
import { generateAuthUrl, loadOAuthTokens, revokeOAuthTokens } from '@/lib/youtube-oauth'

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action')

    if (action === 'status') {
      const tokens = await loadOAuthTokens()
      return NextResponse.json({
        connected: !!tokens,
        has_refresh_token: !!tokens?.refresh_token,
        expires_at: tokens?.expiry_date,
      })
    }

    if (action === 'disconnect') {
      await revokeOAuthTokens()
      return NextResponse.json({ ok: true, message: 'YouTube OAuth disconnected' })
    }

    const authUrl = generateAuthUrl()
    return NextResponse.json({ auth_url: authUrl })
  } catch (err: any) {
    console.error('YouTube auth error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUrl = generateAuthUrl()
    return NextResponse.redirect(authUrl)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
