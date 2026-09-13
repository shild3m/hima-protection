'use server'

import { z } from 'zod'
import { requireAuth, getSupabaseAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const ServiceSchema = z.object({
  name: z.string().min(1, 'اسم الخدمة مطلوب').max(200),
  icon_key: z.string().max(50).optional().nullable(),
  short_description: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  base_price: z.number().min(0, 'السعر يجب أن يكون صفر أو أكثر'),
  duration_minutes: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().default(0),
  image_url: z.string().url().optional().nullable(),
  meta_title: z.string().max(200).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
})

type ServiceInput = z.infer<typeof ServiceSchema>

function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'بيانات غير صحيحة'
  }
  return 'حدث خطأ غير متوقع'
}

export async function getServices(search?: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const admin = getSupabaseAdmin()
    let query = admin
      .from('services')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[,]/g, '').replace(/%/g, '\\%').replace(/_/g, '\\_')
      query = query.or(`name.ilike.%${sanitized}%,short_description.ilike.%${sanitized}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get services error:', error)
      return { success: false as const, error: 'تعذر جلب الخدمات' }
    }

    return { success: true as const, data: data || [] }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getService(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createService(input: ServiceInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = ServiceSchema.parse(input)

    const { data, error } = await getSupabaseAdmin()
      .from('services')
      .insert({
        name: validated.name,
        icon_key: validated.icon_key || null,
        short_description: validated.short_description || null,
        description: validated.description || null,
        base_price: validated.base_price,
        duration_minutes: validated.duration_minutes || null,
        is_active: validated.is_active,
        display_order: validated.display_order,
        image_url: validated.image_url || null,
        meta_title: validated.meta_title || null,
        meta_description: validated.meta_description || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Create service error:', error)
      return { success: false as const, error: 'تعذر إنشاء الخدمة' }
    }

    await logAudit({ userId: user.staff_id, action: 'create', resourceType: 'service', resourceId: data.id, newValues: data })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateService(id: string, input: Partial<ServiceInput>) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = ServiceSchema.partial().parse(input)

    const { data: existing } = await getSupabaseAdmin()
      .from('services')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    const updateData: Record<string, unknown> = {}

    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.icon_key !== undefined) updateData.icon_key = validated.icon_key || null
    if (validated.short_description !== undefined) updateData.short_description = validated.short_description || null
    if (validated.description !== undefined) updateData.description = validated.description || null
    if (validated.base_price !== undefined) updateData.base_price = validated.base_price
    if (validated.duration_minutes !== undefined) updateData.duration_minutes = validated.duration_minutes || null
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active
    if (validated.display_order !== undefined) updateData.display_order = validated.display_order
    if (validated.image_url !== undefined) updateData.image_url = validated.image_url || null
    if (validated.meta_title !== undefined) updateData.meta_title = validated.meta_title || null
    if (validated.meta_description !== undefined) updateData.meta_description = validated.meta_description || null

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await getSupabaseAdmin()
      .from('services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update service error:', error)
      return { success: false as const, error: 'تعذر تحديث الخدمة' }
    }

    await logAudit({ userId: user.staff_id, action: 'update', resourceType: 'service', resourceId: id, newValues: updateData })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function toggleServiceStatus(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const { data: existing } = await getSupabaseAdmin()
      .from('services')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    const { data, error } = await getSupabaseAdmin()
      .from('services')
      .update({ is_active: !existing.is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Toggle service error:', error)
      return { success: false as const, error: 'تعذر تغيير حالة الخدمة' }
    }

    await logAudit({ userId: user.staff_id, action: 'toggle_status', resourceType: 'service', resourceId: id, newValues: { is_active: !existing.is_active } })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function deleteService(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:delete')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const { data: existing } = await getSupabaseAdmin()
      .from('services')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    const { data: hasBooking } = await getSupabaseAdmin()
      .from('bookings')
      .select('id')
      .eq('service_id', id)
      .limit(1)
      .maybeSingle()

    if (hasBooking) {
      return { success: false as const, error: 'لا يمكن حذف الخدمة لأنها مرتبطة بحجوزات. استخدم التعطيل بدلاً من الحذف.' }
    }

    const { error } = await getSupabaseAdmin()
      .from('services')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete service error:', error)
      return { success: false as const, error: 'تعذر حذف الخدمة' }
    }

    await logAudit({ userId: user.staff_id, action: 'delete', resourceType: 'service', resourceId: id })

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
