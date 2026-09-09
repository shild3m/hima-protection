'use server'

import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

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

const AdjustmentSchema = z.object({
  material_id: z.string().uuid('معرف المادة غير صحيح'),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  direction: z.enum(['in', 'out'], { message: 'الاتجاه يجب أن يكون صادر أو وارد' }),
  notes: z.string().max(1000).optional().nullable(),
})

export async function getStockMovements(
  materialId?: string,
  type?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('inventory:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('inventory_transactions')
      .select('*, material:materials(id, name, sku, unit, current_stock)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (materialId) {
      query = query.eq('material_id', materialId)
    }

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get stock movements error:', error)
      return { success: false as const, error: 'تعذر جلب حركات المخزون' }
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

export async function adjustStock(input: z.infer<typeof AdjustmentSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('inventory:adjust')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = AdjustmentSchema.parse(input)
    const supabase = await createClient()

    const idempotencyKey = `adj_${validated.material_id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const { data: result, error: rpcError } = await supabase.rpc('record_stock_adjustment', {
      p_material_id: validated.material_id,
      p_quantity: validated.quantity,
      p_direction: validated.direction,
      p_notes: validated.notes || null,
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      console.error('Adjust stock RPC error:', rpcError)
      return { success: false as const, error: 'تعذر تعديل المخزون' }
    }

    if (!result || !result.success) {
      return { success: false as const, error: result?.error || 'تعذر تعديل المخزون' }
    }

    return { success: true as const, data: result }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false as const, error: err.issues[0]?.message || 'بيانات غير صحيحة' }
    }
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getInventorySummary() {
  const user = await requireAuth()
  if (!user.permissions.includes('inventory:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: materials, error } = await supabase
      .from('materials')
      .select('id, name, sku, unit, current_stock, min_stock, max_stock, cost_per_unit, is_active')
      .order('name', { ascending: true })

    if (error) {
      return { success: false as const, error: 'تعذر جلب ملخص المخزون' }
    }

    const active = (materials || []).filter(m => m.is_active)
    const totalMaterials = active.length
    const lowStock = active.filter(m => m.current_stock <= m.min_stock).length
    const outOfStock = active.filter(m => m.current_stock === 0).length
    const totalValue = active.reduce((sum, m) => sum + (m.current_stock * m.cost_per_unit), 0)

    return {
      success: true as const,
      data: {
        totalMaterials,
        lowStock,
        outOfStock,
        materials: active,
      },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

const WasteSchema = z.object({
  material_id: z.string().uuid('معرف المادة غير صحيح'),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  notes: z.string().min(1, 'السبب مطلوب').max(1000),
})

export async function recordWaste(input: z.infer<typeof WasteSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('inventory:adjust')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = WasteSchema.parse(input)
    const supabase = await createClient()

    const idempotencyKey = `waste_${validated.material_id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const { data: result, error: rpcError } = await supabase.rpc('record_stock_adjustment', {
      p_material_id: validated.material_id,
      p_quantity: validated.quantity,
      p_direction: 'out',
      p_notes: `[هدر] ${validated.notes}`,
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      console.error('Record waste RPC error:', rpcError)
      return { success: false as const, error: 'تعذر تسجيل الهدر' }
    }

    if (!result || !result.success) {
      return { success: false as const, error: result?.error || 'تعذر تسجيل الهدر' }
    }

    return { success: true as const, data: result }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false as const, error: err.issues[0]?.message || 'بيانات غير صحيحة' }
    }
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

const ReturnSchema = z.object({
  material_id: z.string().uuid('معرف المادة غير صحيح'),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  notes: z.string().max(1000).optional().nullable(),
})

export async function recordReturn(input: z.infer<typeof ReturnSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('inventory:adjust')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = ReturnSchema.parse(input)
    const supabase = await createClient()

    const idempotencyKey = `return_${validated.material_id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const { data: result, error: rpcError } = await supabase.rpc('record_stock_adjustment', {
      p_material_id: validated.material_id,
      p_quantity: validated.quantity,
      p_direction: 'in',
      p_notes: validated.notes ? `[إرجاع] ${validated.notes}` : '[إرجاع]',
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      console.error('Record return RPC error:', rpcError)
      return { success: false as const, error: 'تعذر تسجيل الإرجاع' }
    }

    if (!result || !result.success) {
      return { success: false as const, error: result?.error || 'تعذر تسجيل الإرجاع' }
    }

    return { success: true as const, data: result }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false as const, error: err.issues[0]?.message || 'بيانات غير صحيحة' }
    }
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

const UsageSchema = z.object({
  material_id: z.string().uuid('معرف المادة غير صحيح'),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  booking_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  vehicle_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export async function recordUsage(input: z.infer<typeof UsageSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('inventory:usage')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = UsageSchema.parse(input)
    const supabase = await createClient()

    const idempotencyKey = `usage_${validated.material_id}_${validated.booking_id || 'manual'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const { data: result, error: rpcError } = await supabase.rpc('record_inventory_usage', {
      p_material_id: validated.material_id,
      p_quantity: validated.quantity,
      p_booking_id: validated.booking_id || null,
      p_service_id: validated.service_id || null,
      p_vehicle_id: validated.vehicle_id || null,
      p_notes: validated.notes || null,
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      console.error('Record usage RPC error:', rpcError)
      return { success: false as const, error: 'تعذر تسجيل الاستهلاك' }
    }

    if (!result || !result.success) {
      return { success: false as const, error: result?.error || 'تعذر تسجيل الاستهلاك' }
    }

    return { success: true as const, data: result }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false as const, error: err.issues[0]?.message || 'بيانات غير صحيحة' }
    }
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
