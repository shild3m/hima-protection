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

const PurchaseItemInputSchema = z.object({
  material_id: z.string().uuid(),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unit_cost: z.number().min(0, 'تكلفة الوحدة يجب أن تكون 0 على الأقل'),
})

const PurchaseSchema = z.object({
  supplier_id: z.string().uuid('معرف المورد غير صحيح'),
  purchase_date: z.string().min(1, 'التاريخ مطلوب').refine((val) => {
    const d = new Date(val)
    return !isNaN(d.getTime())
  }, 'التاريخ غير صحيح'),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(PurchaseItemInputSchema).min(1, 'يجب إضافة عنصر واحد على الأقل'),
})

export async function getPurchases(
  search?: string,
  status?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('purchases')
      .select('*, supplier:suppliers(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.ilike('notes', `%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get purchases error:', error)
      return { success: false as const, error: 'تعذر جلب المشتريات' }
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

export async function getPurchase(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('purchases')
      .select('*, supplier:suppliers(id, name)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'الشراء غير موجود' }
    }

    const { data: items } = await supabase
      .from('purchase_items')
      .select('*, material:materials(id, name, sku, unit)')
      .eq('purchase_id', id)
      .order('created_at', { ascending: true })

    return {
      success: true as const,
      data: { ...data, items: items || [] },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createPurchase(input: z.infer<typeof PurchaseSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('purchases:create')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const validated = PurchaseSchema.parse(input)
    const supabase = await createClient()

    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, is_active')
      .eq('id', validated.supplier_id)
      .maybeSingle()

    if (!supplier || !supplier.is_active) {
      return { success: false as const, error: 'المورد غير موجود أو غير نشط' }
    }

    const materialIds = validated.items.map(item => item.material_id)
    const uniqueMaterialIds = [...new Set(materialIds)]
    const { data: materials } = await supabase
      .from('materials')
      .select('id, is_active')
      .in('id', uniqueMaterialIds)

    const materialMap = new Map((materials || []).map(m => [m.id, m]))
    for (const item of validated.items) {
      const material = materialMap.get(item.material_id)
      if (!material || !material.is_active) {
        return { success: false as const, error: 'أحد المواد غير موجودة أو غير نشطة' }
      }
    }

    let totalAmount = 0
    for (const item of validated.items) {
      totalAmount += item.quantity * item.unit_cost
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        supplier_id: validated.supplier_id,
        purchase_date: validated.purchase_date,
        notes: validated.notes || null,
        total_amount: totalAmount,
        status: 'draft',
        created_by: user.auth_user_id,
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('Create purchase error:', purchaseError)
      return { success: false as const, error: 'تعذر إنشاء الشراء' }
    }

    const purchaseItems = validated.items.map(item => ({
      purchase_id: purchase.id,
      material_id: item.material_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total_cost: item.quantity * item.unit_cost,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_items')
      .insert(purchaseItems)

    if (itemsError) {
      console.error('Create purchase items error:', itemsError)
      await supabase.from('purchases').delete().eq('id', purchase.id)
      return { success: false as const, error: 'تعذر إنشاء عناصر الشراء' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'purchase_created',
      resourceType: 'purchases',
      resourceId: purchase.id,
      newValues: {
        supplier_id: validated.supplier_id,
        total_amount: totalAmount,
        items_count: validated.items.length,
      },
    })

    return { success: true as const, data: { ...purchase, items: purchaseItems } }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function receivePurchase(purchaseId: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:receive')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('purchases:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    const { data: purchase } = await supabase
      .from('purchases')
      .select('id, status')
      .eq('id', purchaseId)
      .maybeSingle()

    if (!purchase) {
      return { success: false as const, error: 'الشراء غير موجود' }
    }

    if (purchase.status !== 'draft') {
      return { success: false as const, error: 'يمكن استلام المشتريات المسودة فقط' }
    }

    const { data: items } = await supabase
      .from('purchase_items')
      .select('id')
      .eq('purchase_id', purchaseId)

    if (!items || items.length === 0) {
      return { success: false as const, error: 'لا توجد عناصر في هذا الشراء' }
    }

    const { data: result, error: rpcError } = await supabase.rpc('receive_existing_purchase', {
      p_purchase_id: purchaseId,
    })

    if (rpcError) {
      console.error('Receive purchase RPC error:', rpcError)
      return { success: false as const, error: 'تعذر استلام الشراء' }
    }

    if (!result || !result.success) {
      return { success: false as const, error: result?.error || 'تعذر استلام الشراء' }
    }

    return { success: true as const, data: result }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function cancelPurchase(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('purchases:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('purchases')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الشراء غير موجود' }
    }

    if (existing.status === 'received' || existing.status === 'cancelled') {
      return { success: false as const, error: 'لا يمكن إلغاء هذا الشراء' }
    }

    const { data, error } = await supabase
      .from('purchases')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false as const, error: 'تعذر إلغاء الشراء' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'purchase_cancelled',
      resourceType: 'purchases',
      resourceId: id,
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getSupplierPurchaseHistory(
  supplierId: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()

    const [dataResult, statsResult] = await Promise.all([
      supabase
        .from('purchases')
        .select('id, status, total_amount, purchase_date, received_at, created_at', { count: 'exact' })
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .range(from, to),
      supabase
        .from('purchases')
        .select('id, total_amount, status')
        .eq('supplier_id', supplierId),
    ])

    const { data, error, count } = dataResult

    if (error) {
      return { success: false as const, error: 'تعذر جلب سجل المشتريات' }
    }

    const stats = statsResult.data
    const totalPurchases = stats?.length || 0
    const totalSpend = (stats || [])
      .filter((s: { status: string }) => s.status === 'received')
      .reduce((sum: number, s: { total_amount: number }) => sum + (s.total_amount || 0), 0)
    const lastPurchase = data && data.length > 0 ? data[0].created_at : null

    return {
      success: true as const,
      data: data || [],
      stats: {
        total_purchases: totalPurchases,
        total_spend: totalSpend,
        last_purchase: lastPurchase,
      },
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

export async function getMaterialPurchaseHistory(
  materialId: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('purchases:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()

    const { data, error, count } = await supabase
      .from('purchase_items')
      .select(`
        id, quantity, unit_cost, total_cost, created_at,
        purchase:purchases(id, status, purchase_date, supplier:suppliers(id, name))
      `, { count: 'exact' })
      .eq('material_id', materialId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return { success: false as const, error: 'تعذر جلب سجل مشتريات المادة' }
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
