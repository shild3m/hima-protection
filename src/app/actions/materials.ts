'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
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

const UNITS = ['meter', 'liter', 'ml', 'piece', 'roll', 'box', 'bottle'] as const

const MaterialSchema = z.object({
  name: z.string().min(1, 'اسم المادة مطلوب').max(200),
  sku: z.string().min(1, 'رمز المادة مطلوب').max(100),
  unit: z.enum(UNITS, { message: 'الوحدة غير صحيحة' }),
  min_stock: z.number().min(0, 'الحد الأدنى يجب أن يكون 0 على الأقل').default(0),
  max_stock: z.number().min(0).optional().nullable(),
  cost_per_unit: z.number().min(0, 'التكلفة يجب أن تكون 0 على الأقل').default(0),
  supplier_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

const MaterialUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(100).optional(),
  unit: z.enum(UNITS).optional(),
  min_stock: z.number().min(0).optional(),
  max_stock: z.number().min(0).optional().nullable(),
  cost_per_unit: z.number().min(0).optional(),
  supplier_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

type MaterialInput = z.infer<typeof MaterialSchema>

export async function getMaterials(
  search?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('materials:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('materials')
      .select('*, supplier:suppliers(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`name.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get materials error:', error)
      return { success: false as const, error: 'تعذر جلب المواد' }
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

export async function getMaterial(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('materials:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('materials')
      .select('*, supplier:suppliers(id, name)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'المادة غير موجودة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createMaterial(input: MaterialInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('materials:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('materials:create')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const validated = MaterialSchema.parse(input)
    const supabase = await createClient()

    if (validated.supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('id', validated.supplier_id)
        .eq('is_active', true)
        .maybeSingle()

      if (!supplier) {
        return { success: false as const, error: 'المورد غير موجود أو غير نشط' }
      }
    }

    const { data, error } = await supabase
      .from('materials')
      .insert({
        name: validated.name,
        sku: validated.sku,
        unit: validated.unit,
        min_stock: validated.min_stock,
        max_stock: validated.max_stock || null,
        cost_per_unit: validated.cost_per_unit,
        supplier_id: validated.supplier_id || null,
        notes: validated.notes || null,
        current_stock: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Create material error:', error)
      if (error.code === '23505') {
        return { success: false as const, error: 'رمز المادة موجود بالفعل' }
      }
      return { success: false as const, error: 'تعذر إنشاء المادة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'material_created',
      resourceType: 'materials',
      resourceId: data.id,
      newValues: { name: validated.name, sku: validated.sku, unit: validated.unit },
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateMaterial(id: string, input: z.infer<typeof MaterialUpdateSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('materials:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('materials:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const validated = MaterialUpdateSchema.parse(input)
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('materials')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المادة غير موجودة' }
    }

    if (validated.supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('id', validated.supplier_id)
        .eq('is_active', true)
        .maybeSingle()

      if (!supplier) {
        return { success: false as const, error: 'المورد غير موجود أو غير نشط' }
      }
    }

    const updateData: Record<string, unknown> = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.sku !== undefined) updateData.sku = validated.sku
    if (validated.unit !== undefined) updateData.unit = validated.unit
    if (validated.min_stock !== undefined) updateData.min_stock = validated.min_stock
    if (validated.max_stock !== undefined) updateData.max_stock = validated.max_stock
    if (validated.cost_per_unit !== undefined) updateData.cost_per_unit = validated.cost_per_unit
    if (validated.supplier_id !== undefined) updateData.supplier_id = validated.supplier_id || null
    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await supabase
      .from('materials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update material error:', error)
      if (error.code === '23505') {
        return { success: false as const, error: 'رمز المادة موجود بالفعل' }
      }
      return { success: false as const, error: 'تعذر تحديث المادة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'material_updated',
      resourceType: 'materials',
      resourceId: id,
      newValues: updateData,
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function toggleMaterialActive(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('materials:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('materials:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('materials')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المادة غير موجودة' }
    }

    const { data, error } = await supabase
      .from('materials')
      .update({ is_active: !existing.is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false as const, error: 'تعذر تحديث حالة المادة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: existing.is_active ? 'material_deactivated' : 'material_activated',
      resourceType: 'materials',
      resourceId: id,
      newValues: { is_active: !existing.is_active },
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getLowStockMaterials() {
  const user = await requireAuth()
  if (!user.permissions.includes('materials:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('materials')
      .select('*, supplier:suppliers(id, name)')
      .eq('is_active', true)
      .order('current_stock', { ascending: true })

    if (error) {
      return { success: false as const, error: 'تعذر جلب المواد' }
    }

    const lowStock = (data || []).filter(m => m.current_stock <= m.min_stock)

    return { success: true as const, data: lowStock }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
