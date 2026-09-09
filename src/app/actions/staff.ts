'use server'

import { requireAuth, requirePermission, getSupabaseAdmin } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const StaffCreateSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  full_name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(200),
  phone: z.string().max(20).optional(),
  role_id: z.string().uuid('معرف الدور غير صحيح'),
  role: z.enum(['super_admin', 'admin', 'receptionist', 'inventory_manager', 'technician', 'accountant', 'dealer']),
})

const StaffUpdateSchema = z.object({
  full_name: z.string().min(2).max(200).optional(),
  phone: z.string().max(20).optional(),
  role_id: z.string().uuid().optional(),
  role: z.enum(['super_admin', 'admin', 'receptionist', 'inventory_manager', 'technician', 'accountant', 'dealer']).optional(),
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
  role: string
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

    // Verify role_id exists in roles table
    const { data: roleExists } = await admin
      .from('roles')
      .select('id')
      .eq('id', data.role_id)
      .single()

    if (!roleExists) {
      return { success: false, error: 'الدور المحدد غير موجود' }
    }

    // Prevent creating super_admin unless caller is super_admin
    if (data.role === 'super_admin' && user.role_name !== 'super_admin') {
      return { success: false, error: 'لا يمكنك إنشاء مدير عام' }
    }

    const { data: result, error } = await admin
      .from('staff')
      .insert({
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        role_id: data.role_id,
        role: data.role,
        is_active: true,
      })
      .select()
      .single()
    if (error) return { success: false, error: 'تعذر إنشاء الموظف' }
    return { success: true, data: result }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

export async function updateStaff(id: string, input: {
  full_name?: string
  phone?: string
  role_id?: string
  role?: string
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

    // Verify role_id exists if provided
    if (data.role_id) {
      const { data: roleExists } = await admin
        .from('roles')
        .select('id')
        .eq('id', data.role_id)
        .single()

      if (!roleExists) {
        return { success: false, error: 'الدور المحدد غير موجود' }
      }
    }

    // Prevent escalating to super_admin unless caller is super_admin
    if (data.role === 'super_admin' && user.role_name !== 'super_admin') {
      return { success: false, error: 'لا يمكنك تعيين دور مدير عام' }
    }

    // Build explicit allowlist - no spread
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (data.full_name !== undefined) updateData.full_name = data.full_name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.role_id !== undefined) updateData.role_id = data.role_id
    if (data.role !== undefined) updateData.role = data.role
    if (data.is_active !== undefined) updateData.is_active = data.is_active

    const { data: result, error } = await admin
      .from('staff')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: 'تعذر تحديث بيانات الموظف' }
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
    const { data: current } = await admin.from('staff').select('is_active').eq('id', id).single()
    if (!current) return { success: false, error: 'الموظف غير موجود' }
    const { data, error } = await admin
      .from('staff')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: 'تعذر تحديث حالة الموظف' }
    return { success: true, data }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}
