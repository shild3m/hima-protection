import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { CurrentUser } from '@/types/rbac'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
  const user = await getSessionUser()
  if (!user?.id) return null

  const admin = getSupabaseAdmin()

  // 1 query: staff + roles + role_permissions (nested join)
  const { data: staff } = await admin
    .from('staff')
    .select('id, email, user_id, role_id, role, is_active, roles(role_permissions(permissions(resource, action)))')
    .eq('user_id', user.id)
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

    return {
      auth_user_id: user.id,
      email: staff.email,
      staff_id: staff.id,
      name: staff.email,
      role_id: staff.role_id || '',
      role_name: staff.role,
      permissions,
      is_active: true,
      user: { id: user.id, email: user.email! },
    }
  }

  // 1 query: dealer lookup
  const { data: dealer } = await admin
    .from('dealers')
    .select('id, email, user_id, is_active, status')
    .eq('user_id', user.id)
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

    return {
      auth_user_id: user.id,
      email: dealer.email || user.email!,
      staff_id: dealer.id,
      name: dealer.email || user.email!,
      role_id: dealerRoleId || '',
      role_name: 'dealer',
      permissions,
      is_active: true,
      user: { id: user.id, email: user.email! },
    }
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
