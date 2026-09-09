'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'بيانات غير صحيحة'
  }
  return 'حدث خطأ غير متوقع'
}

function sanitizeSearch(input: string): string {
  return input.trim()
    .replace(/,/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\./g, '')
    .replace(/\*/g, '')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

function validatePage(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return 1
  return Math.floor(num)
}

function validatePageSize(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return PAGE_SIZE
  return Math.min(Math.floor(num), MAX_PAGE_SIZE)
}

const CustomerSchema = z.object({
  full_name: z.string().min(1, 'اسم العميل مطلوب').max(200),
  phone: z.string().min(5, 'رقم الجوال مطلوب').max(20),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')).nullable(),
  source: z.enum(['walk_in', 'referral', 'online', 'social', 'phone']).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().default(true),
})

type CustomerInput = z.infer<typeof CustomerSchema>

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '').trim()
}

export async function getCustomers(search?: string, page?: number, pageSize?: number) {
  const user = await requireAuth()
  if (!user.permissions.includes('customers:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`full_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get customers error:', error)
      return { success: false as const, error: 'تعذر جلب العملاء' }
    }

    return {
      success: true as const,
      data: data || [],
      pagination: {
        page: currentPage,
        pageSize: size,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / size),
      },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getCustomer(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('customers:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'العميل غير موجود' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getCustomerVehicles(customerId: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get customer vehicles error:', error)
      return { success: false as const, error: 'تعذر جلب مركبات العميل' }
    }

    return { success: true as const, data: data || [] }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createCustomer(input: CustomerInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('customers:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = CustomerSchema.parse(input)
    const supabase = await createClient()
    const normalizedPhone = normalizePhone(validated.phone)

    const { data: existing } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (existing) {
      return { success: false as const, error: `عميل بنفس رقم الجوال موجود بالفعل (${existing.full_name})` }
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        full_name: validated.full_name.trim(),
        phone: normalizedPhone,
        email: validated.email || null,
        source: validated.source || null,
        notes: validated.notes || null,
        is_active: validated.is_active,
      })
      .select()
      .single()

    if (error) {
      console.error('Create customer error:', error)
      return { success: false as const, error: 'تعذر إنشاء العميل' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'customer_created',
      resourceType: 'customers',
      resourceId: data.id,
      newValues: { full_name: data.full_name, source: data.source, is_active: data.is_active },
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>) {
  const user = await requireAuth()
  if (!user.permissions.includes('customers:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, source, notes, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'العميل غير موجود' }
    }

    const validated = CustomerSchema.partial().parse(input)
    const updateData: Record<string, unknown> = {}

    if (validated.full_name !== undefined) updateData.full_name = validated.full_name.trim()
    if (validated.phone !== undefined) {
      const normalizedPhone = normalizePhone(validated.phone)
      const { data: phoneConflict } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', normalizedPhone)
        .neq('id', id)
        .maybeSingle()

      if (phoneConflict) {
        return { success: false as const, error: 'رقم الجوال مستخدم بالفعل بعميل آخر' }
      }
      updateData.phone = normalizedPhone
    }
    if (validated.email !== undefined) updateData.email = validated.email || null
    if (validated.source !== undefined) updateData.source = validated.source || null
    if (validated.notes !== undefined) updateData.notes = validated.notes || null
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update customer error:', error)
      return { success: false as const, error: 'تعذر تحديث العميل' }
    }

    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}
    for (const key of Object.keys(updateData)) {
      if ((existing as Record<string, unknown>)[key] !== updateData[key]) {
        oldValues[key] = (existing as Record<string, unknown>)[key]
        newValues[key] = updateData[key]
      }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'customer_updated',
      resourceType: 'customers',
      resourceId: id,
      oldValues: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValues: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function toggleCustomerStatus(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('customers:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('customers')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'العميل غير موجود' }
    }

    const newStatus = !existing.is_active

    const { data, error } = await supabase
      .from('customers')
      .update({ is_active: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Toggle customer error:', error)
      return { success: false as const, error: 'تعذر تغيير حالة العميل' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: newStatus ? 'customer_activated' : 'customer_deactivated',
      resourceType: 'customers',
      resourceId: id,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: newStatus },
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
