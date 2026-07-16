import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/youtube-oauth'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=youtube_auth_denied`, req.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/login?error=no_code`, req.url))
    }

    const tokens = await exchangeCode(code)

    return NextResponse.redirect(new URL(`/control?youtube=connected`, req.url))
  } catch (err: any) {
    console.error('YouTube OAuth callback failed:', err)
    return NextResponse.redirect(new URL(`/login?error=oauth_failed`, req.url))
  }
}
