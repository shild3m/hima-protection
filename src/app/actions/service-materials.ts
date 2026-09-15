'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ServiceMaterialRowSchema = z.object({
  material_id: z.string().uuid('معرف المادة غير صحيح'),
  qty_small: z.number().min(0, 'الكمية يجب أن تكون 0 أو أكثر').max(100000).default(0),
  qty_medium: z.number().min(0, 'الكمية يجب أن تكون 0 أو أكثر').max(100000).default(0),
  qty_large: z.number().min(0, 'الكمية يجب أن تكون 0 أو أكثر').max(100000).default(0),
})

const SaveSchema = z.object({
  service_id: z.string().uuid('معرف الخدمة غير صحيح'),
  rows: z.array(ServiceMaterialRowSchema),
})

export type ServiceMaterialRow = z.infer<typeof ServiceMaterialRowSchema>

export async function getServiceMaterials(serviceId?: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:read') && !user.permissions.includes('materials:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    let query = supabase
      .from('service_materials')
      .select('id, service_id, material_id, qty_small, qty_medium, qty_large, material:materials(id, name, sku, unit)')

    if (serviceId) {
      query = query.eq('service_id', serviceId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Get service materials error:', error)
      return { success: false as const, error: 'تعذر جلب المواد المطلوبة' }
    }

    return { success: true as const, data: data || [] }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function saveServiceMaterials(input: {
  service_id: string
  rows: ServiceMaterialRow[]
}) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:update') && !user.permissions.includes('inventory:adjust')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('service-materials:save')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const validated = SaveSchema.parse(input)
    const supabase = await createClient()

    const { data: service } = await supabase
      .from('services')
      .select('id, name')
      .eq('id', validated.service_id)
      .maybeSingle()

    if (!service) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    const rows = validated.rows.filter(r => r.qty_small > 0 || r.qty_medium > 0 || r.qty_large > 0)

    if (rows.length > 0) {
      const materialIds = [...new Set(rows.map(r => r.material_id))]
      const { data: materials } = await supabase
        .from('materials')
        .select('id')
        .in('id', materialIds)

      if (!materials || materials.length !== materialIds.length) {
        return { success: false as const, error: 'إحدى المواد غير موجودة' }
      }
    }

    const { error: deleteError } = await supabase
      .from('service_materials')
      .delete()
      .eq('service_id', validated.service_id)

    if (deleteError) {
      console.error('Delete service materials error:', deleteError)
      return { success: false as const, error: 'تعذر حفظ المواد المطلوبة' }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('service_materials')
        .insert(rows.map(r => ({
          service_id: validated.service_id,
          material_id: r.material_id,
          qty_small: r.qty_small,
          qty_medium: r.qty_medium,
          qty_large: r.qty_large,
        })))

      if (insertError) {
        console.error('Insert service materials error:', insertError)
        return { success: false as const, error: 'تعذر حفظ المواد المطلوبة' }
      }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'service_materials_saved',
      resourceType: 'services',
      resourceId: validated.service_id,
      newValues: {
        service_id: validated.service_id,
        service_name: service.name,
        materials_count: rows.length,
        rows: rows.map(r => ({ material_id: r.material_id, small: r.qty_small, medium: r.qty_medium, large: r.qty_large })),
      },
    })

    return { success: true as const }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false as const, error: err.issues[0]?.message || 'بيانات غير صحيحة' }
    }
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}