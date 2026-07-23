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
    path.startsWith('/api/brands/analyze') ||
    path.startsWith('/api/warm') ||
    path.startsWith('/api/cron')
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
    return NextResponse.next()
  }

  // Workspace hub is accessible by all authenticated users
  if (path.startsWith('/workspace')) {
    return NextResponse.next()
  }

  // Any other pages are Admin only
  if (session.role !== 'admin') {
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
