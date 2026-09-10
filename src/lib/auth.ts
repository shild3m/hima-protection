import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { CurrentUser } from '@/types/rbac'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const userCache = new Map<string, { user: CurrentUser; ts: number }>()
const CACHE_TTL = 30000

function getCacheKey(user_id: string): string { return `cu_${user_id}` }

export function invalidateUserCache(userId: string) {
  userCache.delete(getCacheKey(userId))
}

function getCachedUser(user_id: string): CurrentUser | null {
  const entry = userCache.get(getCacheKey(user_id))
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.user
  userCache.delete(getCacheKey(user_id))
  return null
}

function setCachedUser(user_id: string, user: CurrentUser) {
  userCache.set(getCacheKey(user_id), { user, ts: Date.now() })
}

export function getSupabaseAdmin() {
  return createAdminClient(supabaseUrl, supabaseServiceKey)
}

export async function getSessionUser() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionUser = await getSessionUser()
  if (!sessionUser?.id) return null

  const cached = getCachedUser(sessionUser.id)
  if (cached) return cached

  const admin = getSupabaseAdmin()

  // 1 query: staff + roles + role_permissions (nested join)
const { data: staff } = await admin
     .from('staff')
     .select('id, email, user_id, role_id, role, is_active, roles(role_permissions(permissions(resource, action)))')
     .eq('user_id', sessionUser.id)
     .maybeSingle()

  if (staff) {
    if (staff.is_active === false) return null

    let permissions: string[] = []
    const rolePerms = (staff.roles as { role_permissions?: { permissions?: { resource: string; action: string } }[] } | null)?.role_permissions
    if (rolePerms) {
      permissions = rolePerms.map(
        (rp) => `${rp.permissions?.resource}:${rp.permissions?.action}`
      )
    }

    const result: CurrentUser = {
      auth_user_id: sessionUser.id,
      email: staff.email,
      staff_id: staff.id,
      name: staff.email,
      role_id: staff.role_id || '',
      role_name: staff.role,
      permissions,
      is_active: true,
      user: { id: sessionUser.id, email: sessionUser.email! },
    }
    setCachedUser(sessionUser.id, result)
    return result
  }

  // 1 query: dealer lookup
  const { data: dealer } = await admin
    .from('dealers')
    .select('id, email, user_id, is_active, status')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (dealer && dealer.is_active && dealer.status === 'active') {
    // 1 query: dealer role + permissions (nested join)
    const { data: dealerRole } = await admin
      .from('roles')
      .select('id, role_permissions(permissions(resource, action))')
      .eq('name', 'dealer')
      .maybeSingle()

    const dealerRoleId = dealerRole?.id
    let permissions: string[] = []
    const dealerPerms = dealerRole?.role_permissions as unknown as { permissions?: { resource: string; action: string } }[] | undefined
    if (dealerPerms) {
      permissions = dealerPerms.map(
        (rp) => `${rp.permissions?.resource}:${rp.permissions?.action}`
      )
    }

    const result: CurrentUser = {
      auth_user_id: sessionUser.id,
      email: dealer.email || sessionUser.email!,
      staff_id: dealer.id,
      name: dealer.email || sessionUser.email!,
      role_id: dealerRoleId || '',
      role_name: 'dealer',
      permissions,
      is_active: true,
      user: { id: sessionUser.id, email: sessionUser.email! },
    }
    setCachedUser(sessionUser.id, result)
    return result
  }

  return null
}

export async function requireAuth(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    redirect('/staff-login')
  }
  return currentUser
}

export async function requirePermission(resource: string, action: string) {
  const user = await requireAuth()
  const perm = `${resource}:${action}`
  if (!user.permissions.includes(perm)) {
    redirect('/admin/unauthorized')
  }
  return user
}

export async function requireAdmin(): Promise<{ user: CurrentUser; role: string } | import('next/server').NextResponse> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    const { NextResponse } = await import('next/server')
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }
  if (currentUser.role_name !== 'super_admin' && currentUser.role_name !== 'admin') {
    const { NextResponse } = await import('next/server')
    return NextResponse.json({ error: 'غير مصرح — الصلاحيات غير كافية' }, { status: 403 })
  }
  return { user: currentUser, role: currentUser.role_name }
}
