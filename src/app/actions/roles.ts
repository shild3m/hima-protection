'use server'

import { requirePermission, getSupabaseAdmin } from '@/lib/auth'

export async function getRoles() {
  try {
    await requirePermission('roles', 'manage')
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('roles')
      .select('id, name, description, created_at')
      .order('name')
    if (error) return { success: false, error: 'تعذر جلب الأدوار' }
    return { success: true, data: data || [] }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getRolePermissions(roleId: string) {
  try {
    await requirePermission('roles', 'manage')
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('role_permissions')
      .select('id, permissions!inner(id, resource, action)')
      .eq('role_id', roleId)
    if (error) return { success: false, error: 'تعذر جلب صلاحيات الدور' }
    return { success: true, data: data || [] }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getAllPermissions() {
  try {
    await requirePermission('roles', 'manage')
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('permissions')
      .select('id, resource, action')
      .order('resource')
    if (error) return { success: false, error: 'تعذر جلب الصلاحيات' }
    return { success: true, data: data || [] }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getStaffCountByRole() {
  try {
    await requirePermission('roles', 'manage')
    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('staff')
      .select('role_id')
    if (error) return { success: false, error: 'تعذر جلب عدد الموظفين' }
    const counts: Record<string, number> = {}
    for (const s of data || []) {
      counts[s.role_id] = (counts[s.role_id] || 0) + 1
    }
    return { success: true, data: counts }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}
