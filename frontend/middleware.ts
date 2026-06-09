import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const session = request.cookies.get('auth_session')?.value
  const token = process.env.SESSION_TOKEN

  // Valid session — let through
  if (token && session === token) {
    return NextResponse.next()
  }

  // Not authenticated — redirect to login, preserving the full original URL
  const loginUrl = new URL('/login', request.url)
  const redirect = pathname + search
  if (redirect && redirect !== '/login') {
    loginUrl.searchParams.set('redirect', redirect)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Protect everything except the login page, auth API, Next.js internals, and static assets
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
