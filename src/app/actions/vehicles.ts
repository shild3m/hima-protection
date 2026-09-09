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

const VehicleSchema = z.object({
  customer_id: z.string().uuid('معرف العميل غير صحيح'),
  make: z.string().min(1, 'شركة الصنع مطلوبة').max(100),
  model: z.string().min(1, 'الموديل مطلوب').max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  plate_number: z.string().max(20).optional().nullable(),
  vin: z.string().max(17).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().default(true),
})

type VehicleInput = z.infer<typeof VehicleSchema>

export async function getVehicles(search?: string, page?: number, pageSize?: number) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('vehicles')
      .select('*, customer:customers(id, full_name, phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`make.ilike.%${sanitized}%,model.ilike.%${sanitized}%,plate_number.ilike.%${sanitized}%,vin.ilike.%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get vehicles error:', error)
      return { success: false as const, error: 'تعذر جلب المركبات' }
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

export async function getVehicle(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, customer:customers(id, full_name, phone, email)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'المركبة غير موجودة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createVehicle(input: VehicleInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = VehicleSchema.parse(input)
    const supabase = await createClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', validated.customer_id)
      .maybeSingle()

    if (!customer) {
      return { success: false as const, error: 'العميل غير موجود' }
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        customer_id: validated.customer_id,
        make: validated.make.trim(),
        model: validated.model.trim(),
        year: validated.year || null,
        color: validated.color || null,
        plate_number: validated.plate_number || null,
        vin: validated.vin || null,
        notes: validated.notes || null,
        is_active: validated.is_active,
      })
      .select('*, customer:customers(id, full_name, phone)')
      .single()

    if (error) {
      console.error('Create vehicle error:', error)
      return { success: false as const, error: 'تعذر إنشاء المركبة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'vehicle_created',
      resourceType: 'vehicles',
      resourceId: data.id,
      newValues: { make: data.make, model: data.model, customer_id: data.customer_id, is_active: data.is_active },
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('vehicles')
      .select('id, customer_id, make, model, year, color, plate_number, vin, notes, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المركبة غير موجودة' }
    }

    const validated = VehicleSchema.partial().parse(input)
    const updateData: Record<string, unknown> = {}

    if (validated.customer_id !== undefined) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', validated.customer_id)
        .maybeSingle()

      if (!customer) {
        return { success: false as const, error: 'العميل غير موجود' }
      }
      updateData.customer_id = validated.customer_id
    }
    if (validated.make !== undefined) updateData.make = validated.make.trim()
    if (validated.model !== undefined) updateData.model = validated.model.trim()
    if (validated.year !== undefined) updateData.year = validated.year || null
    if (validated.color !== undefined) updateData.color = validated.color || null
    if (validated.plate_number !== undefined) updateData.plate_number = validated.plate_number || null
    if (validated.vin !== undefined) updateData.vin = validated.vin || null
    if (validated.notes !== undefined) updateData.notes = validated.notes || null
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updateData)
      .eq('id', id)
      .select('*, customer:customers(id, full_name, phone)')
      .single()

    if (error) {
      console.error('Update vehicle error:', error)
      return { success: false as const, error: 'تعذر تحديث المركبة' }
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
      action: 'vehicle_updated',
      resourceType: 'vehicles',
      resourceId: id,
      oldValues: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValues: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function toggleVehicleStatus(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('vehicles')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المركبة غير موجودة' }
    }

    const newStatus = !existing.is_active

    const { data, error } = await supabase
      .from('vehicles')
      .update({ is_active: newStatus })
      .eq('id', id)
      .select('*, customer:customers(id, full_name, phone)')
      .single()

    if (error) {
      console.error('Toggle vehicle error:', error)
      return { success: false as const, error: 'تعذر تغيير حالة المركبة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: newStatus ? 'vehicle_activated' : 'vehicle_deactivated',
      resourceType: 'vehicles',
      resourceId: id,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: newStatus },
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
