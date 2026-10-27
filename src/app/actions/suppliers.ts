'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  CACHE_TAGS,
  getSupplierOptionsCached,
  getSuppliersPageCached,
} from '@/lib/data-cache'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'بيانات غير صحيحة'
  }
  return 'حدث خطأ غير متوقع'
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

const SupplierSchema = z.object({
  name: z.string().min(1, 'اسم المورد مطلوب').max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('البريد الإلكتروني غير صحيح').max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

const SupplierUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export async function getSuppliers(
  search?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const res = await getSuppliersPageCached(search?.trim() || '', from, to)

    if (!res.ok) {
      return { success: false as const, error: res.error }
    }

    return {
      success: true as const,
      data: res.data,
      pagination: {
        page: currentPage,
        pageSize: size,
        total: res.count,
        totalPages: Math.ceil(res.count / size),
      },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

/** Active suppliers for dropdowns (cached org-wide). */
export async function getSupplierOptions() {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const res = await getSupplierOptionsCached()
  if (!res.ok) {
    return { success: false as const, error: res.error }
  }

  return { success: true as const, data: res.data }
}

export async function getSupplier(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'المورد غير موجود' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createSupplier(input: z.infer<typeof SupplierSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = SupplierSchema.parse(input)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: validated.name,
        phone: validated.phone || null,
        email: validated.email || null,
        address: validated.address || null,
        notes: validated.notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Create supplier error:', error)
      return { success: false as const, error: 'تعذر إنشاء المورد' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'supplier_created',
      resourceType: 'suppliers',
      resourceId: data.id,
      newValues: { name: validated.name },
    })

    updateTag(CACHE_TAGS.suppliers)
    updateTag(CACHE_TAGS.materials)

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateSupplier(id: string, input: z.infer<typeof SupplierUpdateSchema>) {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = SupplierUpdateSchema.parse(input)
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المورد غير موجود' }
    }

    const updateData: Record<string, unknown> = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.email !== undefined) updateData.email = validated.email || null
    if (validated.address !== undefined) updateData.address = validated.address || null
    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false as const, error: 'تعذر تحديث المورد' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'supplier_updated',
      resourceType: 'suppliers',
      resourceId: id,
      newValues: updateData,
    })

    updateTag(CACHE_TAGS.suppliers)
    updateTag(CACHE_TAGS.materials)

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function toggleSupplierActive(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المورد غير موجود' }
    }

    const { data, error } = await supabase
      .from('suppliers')
      .update({ is_active: !existing.is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false as const, error: 'تعذر تحديث حالة المورد' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: existing.is_active ? 'supplier_deactivated' : 'supplier_activated',
      resourceType: 'suppliers',
      resourceId: id,
      newValues: { is_active: !existing.is_active },
    })

    updateTag(CACHE_TAGS.suppliers)

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function deleteSupplier(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('suppliers:delete')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المورد غير موجود' }
    }

    const { data: hasPurchases } = await supabase
      .from('purchases')
      .select('id')
      .eq('supplier_id', id)
      .limit(1)
      .maybeSingle()

    if (hasPurchases) {
      return { success: false as const, error: 'لا يمكن حذف المورد لوجود مشتريات مرتبطة. استخدم التعطيل بدلاً من الحذف.' }
    }

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete supplier error:', error)
      return { success: false as const, error: 'تعذر حذف المورد' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'supplier_deleted',
      resourceType: 'suppliers',
      resourceId: id,
      newValues: { name: existing.name },
    })

    updateTag(CACHE_TAGS.suppliers)
    updateTag(CACHE_TAGS.materials)

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
