import { NextResponse, type NextRequest } from 'next/server'
import { readSessionCookie, isSessionCookieFresh } from '@/lib/session-cookie'

// Sync check: is there a session cookie whose JWT is present and not expired?
// This avoids a network round-trip to Supabase on every request. The layout's
// requireAuth()/getCurrentUser() remains the authoritative verification.
function hasFreshSessionCookie(request: NextRequest): boolean {
  const cookies = request.cookies.getAll()
  return isSessionCookieFresh(readSessionCookie(cookies))
}

export async function updateSession(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname

    if (pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)) {
      return NextResponse.next({ request })
    }

    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isCrmRoute = pathname === '/crm' || pathname.startsWith('/crm/')
    const isDealerRoute = pathname === '/dealer' || pathname.startsWith('/dealer/')

    if ((isAdminRoute || isCrmRoute || isDealerRoute) && pathname !== '/staff-login') {
      if (!hasFreshSessionCookie(request)) {
        return NextResponse.redirect(new URL('/staff-login', request.url))
      }
    }

    return NextResponse.next({ request })
  } catch (e) {
    console.error('Middleware auth error for path:', request.nextUrl.pathname, e)
    const pathname = request.nextUrl.pathname
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isCrmRoute = pathname === '/crm' || pathname.startsWith('/crm/')
    const isDealerRoute = pathname === '/dealer' || pathname.startsWith('/dealer/')
    if (isAdminRoute || isCrmRoute || isDealerRoute) {
      return NextResponse.redirect(new URL('/staff-login', request.url))
    }
    return NextResponse.next({ request })
  }
}