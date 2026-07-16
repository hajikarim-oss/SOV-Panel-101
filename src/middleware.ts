import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('sov_session')?.value
  const path = req.nextUrl.pathname

  // Public assets / api routes are excluded
  if (
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/login') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/brands/analyze')
  ) {
    return NextResponse.next()
  }

  // Token verify
  const session = token ? await verifyToken(token) : null

  if (!session) {
    // API routes must return JSON — redirecting to /login yields HTML and breaks fetch().json()
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Role permissions routing
  if (path.startsWith('/client')) {
    // Brand users are allowed to access client routes. Admins can also view client pages.
    return NextResponse.next()
  }

  // Any other pages are Admin only
  if (session.role !== 'admin') {
    // Redirect non-admin user trying to access admin pages to their master client dashboard
    const clientUrl = new URL('/client', req.url)
    return NextResponse.redirect(clientUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/cron (cron jobs can bypass or authenticate via query secret)
     */
    '/((?!api/cron).*)',
  ],
}
