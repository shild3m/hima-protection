import { NextResponse, type NextRequest } from 'next/server'

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const json = atob(padded)
    const payload = JSON.parse(json)
    if (typeof payload !== 'object' || payload === null) return null
    return payload
  } catch {
    return null
  }
}

// Sync check: is there a session cookie whose JWT is present and not expired?
// This avoids a network round-trip to Supabase on every request. The layout's
// requireAuth()/getCurrentUser() remains the authoritative verification.
function hasFreshSessionCookie(request: NextRequest): boolean {
  const tokenCookie = request.cookies.getAll().find((c) => c.name.includes('auth-token'))
  if (!tokenCookie?.value) return false
  const payload = decodeJwtPayload(String(tokenCookie.value))
  if (!payload?.exp) return false
  return payload.exp * 1000 > Date.now()
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