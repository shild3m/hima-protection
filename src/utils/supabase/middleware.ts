import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options))
          },
        },
      }
    )

    if (request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/static') ||
        request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)) {
      return supabaseResponse
    }

    const { data: { user } } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isCrmRoute = pathname === '/crm' || pathname.startsWith('/crm/')
    const isDealerRoute = pathname === '/dealer' || pathname.startsWith('/dealer/')

    // ─── CRM / Dealer: session check at middleware level ──────────
    if ((isCrmRoute || isDealerRoute) && pathname !== '/staff-login') {
      if (!user) {
        return NextResponse.redirect(new URL('/staff-login', request.url))
      }
    }

    if (isAdminRoute && pathname !== '/staff-login') {
      if (!user) {
        return NextResponse.redirect(new URL('/staff-login', request.url))
      }

      const supabaseRbac = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value))
              supabaseResponse = NextResponse.next({ request })
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options))
            },
          },
        }
      )

      const { data: staffMember } = await supabaseRbac
        .from('staff')
        .select('id, role_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!staffMember) {
        return NextResponse.redirect(new URL('/admin/unauthorized', request.url))
      }

      const { data: role } = await supabaseRbac
        .from('roles')
        .select('name')
        .eq('id', staffMember.role_id)
        .maybeSingle()

      if (!role) {
        return NextResponse.redirect(new URL('/admin/unauthorized', request.url))
      }

      const { data: rolePerms } = await supabaseRbac
        .from('role_permissions')
        .select('permissions(resource, action)')
        .eq('role_id', staffMember.role_id)

      const permissions = ((rolePerms as unknown as { permissions?: { resource: string; action: string } }[] | null) || []).map((p) => `${p.permissions?.resource}:${p.permissions?.action}`)

      const permHeader = permissions.join(',')
      supabaseResponse.headers.set('x-user-id', user.id)
      supabaseResponse.headers.set('x-staff-id', staffMember.id)
      supabaseResponse.headers.set('x-role-name', role.name)
      supabaseResponse.headers.set('x-permissions', permHeader)
    }

    return supabaseResponse
  } catch (e) {
    console.error('Middleware auth error for path:', request.nextUrl.pathname, e)
    const pathname = request.nextUrl.pathname
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isCrmRoute = pathname === '/crm' || pathname.startsWith('/crm/')
    const isDealerRoute = pathname === '/dealer' || pathname.startsWith('/dealer/')
    if (isAdminRoute || isCrmRoute || isDealerRoute) {
      return NextResponse.redirect(new URL('/staff-login', request.url))
    }
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 })
  }
}
