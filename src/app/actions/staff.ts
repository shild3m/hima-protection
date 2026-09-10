'use server'

import { requireAuth, requirePermission, getSupabaseAdmin, invalidateUserCache } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const StaffCreateSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  full_name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(200),
  phone: z.string().max(20).optional(),
  role_id: z.string().uuid('معرف الدور غير صحيح'),
})

const StaffUpdateSchema = z.object({
  full_name: z.string().min(2).max(200).optional(),
  phone: z.string().max(20).optional(),
  role_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
})

export async function getStaff(search?: string, page = 1, pageSize = 20) {
  try {
    const user = await requirePermission('staff', 'read')
    const admin = getSupabaseAdmin()
    let query = admin
      .from('staff')
      .select('id, email, full_name, phone, role, role_id, is_active, created_at, updated_at', { count: 'exact' })

    if (search) {
      const sanitized = search.replace(/[%_]/g, '')
      query = query.or(`full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { success: false, error: 'تعذر جلب بيانات الموظفين' }
    return {
      success: true,
      data: data || [],
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createStaff(input: {
  email: string
  full_name: string
  phone?: string
  role_id: string
}) {
  try {
    const user = await requirePermission('staff', 'create')
    const rl = await checkRateLimit('staff:create')
    if (!rl.ok) return { success: false, error: rl.error }

    const parsed = StaffCreateSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message }
    }

    const data = parsed.data
    const admin = getSupabaseAdmin()

    // Resolve role_id to actual role name from database (do NOT trust client-provided role string)
    const { data: roleRecord } = await admin
      .from('roles')
      .select('id, name')
      .eq('id', data.role_id)
      .single()

    if (!roleRecord) {
      return { success: false, error: 'الدور المحدد غير موجود' }
    }

    const actualRoleName = roleRecord.name

    // Prevent creating super_admin unless caller is super_admin
    if (actualRoleName === 'super_admin' && user.role_name !== 'super_admin') {
      return { success: false, error: 'لا يمكنك إنشاء مدير عام' }
    }

    const { data: result, error } = await admin
      .from('staff')
      .insert({
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        role_id: data.role_id,
        role: actualRoleName,
        is_active: true,
      })
      .select()
      .single()
    if (error) return { success: false, error: 'تعذر إنشاء الموظف' }
    await logAudit({ userId: user.staff_id, action: 'create', resourceType: 'staff', resourceId: result.id, newValues: { email: data.email, full_name: data.full_name, role: actualRoleName } })
    return { success: true, data: result }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function updateStaff(id: string, input: {
  full_name?: string
  phone?: string
  role_id?: string
  is_active?: boolean
}) {
  try {
    const user = await requirePermission('staff', 'update')
    const rl = await checkRateLimit('staff:update')
    if (!rl.ok) return { success: false, error: rl.error }

    const parsed = StaffUpdateSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message }
    }

    const data = parsed.data
    const admin = getSupabaseAdmin()

    // Self-modification guard: prevent staff from modifying their own role or active status
    if (id === user.staff_id) {
      if (data.role_id !== undefined) {
        return { success: false, error: 'لا يمكنك تغيير دورك الخاص' }
      }
      if (data.is_active !== undefined) {
        return { success: false, error: 'لا يمكنك تعطيل حسابك الخاص' }
      }
    }

    // Resolve role_id to actual role name from database if provided
    let actualRoleName: string | null = null
    if (data.role_id) {
      const { data: roleRecord } = await admin
        .from('roles')
        .select('id, name')
        .eq('id', data.role_id)
        .single()

      if (!roleRecord) {
        return { success: false, error: 'الدور المحدد غير موجود' }
      }
      actualRoleName = roleRecord.name

      // Prevent escalating to super_admin unless caller is super_admin
      if (actualRoleName === 'super_admin' && user.role_name !== 'super_admin') {
        return { success: false, error: 'لا يمكنك تعيين دور مدير عام' }
      }
    }

    // Build explicit allowlist - no spread
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.full_name !== undefined) updateData.full_name = data.full_name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.role_id !== undefined) {
      updateData.role_id = data.role_id
      updateData.role = actualRoleName
    }
    if (data.is_active !== undefined) updateData.is_active = data.is_active

    const { data: result, error } = await admin
      .from('staff')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: 'تعذر تحديث بيانات الموظف' }
    // Invalidate permission cache when role or active status changed
    if (data.role_id !== undefined || data.is_active !== undefined) {
      const user_id = result?.user_id
      if (user_id) invalidateUserCache(user_id)
    }
    await logAudit({ userId: user.staff_id, action: 'update', resourceType: 'staff', resourceId: id, newValues: updateData })
    return { success: true, data: result }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function toggleStaffStatus(id: string) {
  try {
    const user = await requirePermission('staff', 'update')
    const rl = await checkRateLimit('staff:update')
    if (!rl.ok) return { success: false, error: rl.error }

    const admin = getSupabaseAdmin()

    // Self-modification guard
    if (id === user.staff_id) {
      return { success: false, error: 'لا يمكنك تعطيل حسابك الخاص' }
    }

    const { data: current } = await admin.from('staff').select('is_active').eq('id', id).single()
    if (!current) return { success: false, error: 'الموظف غير موجود' }
    const { data, error } = await admin
      .from('staff')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: 'تعذر تحديث حالة الموظف' }
    // Invalidate affected user's permission cache so toggles take effect immediately
    const user_id = data?.user_id
    if (user_id) invalidateUserCache(user_id)
    await logAudit({ userId: user.staff_id, action: 'toggle_status', resourceType: 'staff', resourceId: id, newValues: { is_active: !current.is_active } })
    return { success: true, data }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}
