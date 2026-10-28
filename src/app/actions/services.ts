'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { requireAuth, getSupabaseAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { CACHE_TAGS, getServicesListCached } from '@/lib/data-cache'

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

const SERVICE_IMAGE_BUCKET = 'service-images'
const SERVICE_IMAGE_PATH_MARKER = `/storage/v1/object/public/${SERVICE_IMAGE_BUCKET}/`
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function hasValidImageSignature(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    case 'image/png':
      return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    case 'image/gif':
      return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
    case 'image/webp':
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      )
    default:
      return false
  }
}

async function removeServiceImageFile(url: string | null | undefined) {
  if (!url) return
  const index = url.indexOf(SERVICE_IMAGE_PATH_MARKER)
  if (index === -1) return

  try {
    const path = decodeURIComponent(url.slice(index + SERVICE_IMAGE_PATH_MARKER.length).split('?')[0])
    if (!path) return
    await getSupabaseAdmin().storage.from(SERVICE_IMAGE_BUCKET).remove([path])
  } catch {
    // Non-fatal: the database row is already saved, an orphan file is harmless.
  }
}

function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'بيانات غير صحيحة'
  }
  return 'حدث خطأ غير متوقع'
}

export async function uploadServiceImage(formData: FormData) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:create') && !user.permissions.includes('services:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { success: false as const, error: 'اختر صورة أولاً' }
    }

    const extension = IMAGE_EXTENSIONS[file.type]
    if (!extension) {
      return { success: false as const, error: 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP أو GIF' }
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { success: false as const, error: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!hasValidImageSignature(bytes, file.type)) {
      return { success: false as const, error: 'الملف المرفوع ليس صورة صحيحة' }
    }

    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
    const { error } = await getSupabaseAdmin()
      .storage.from(SERVICE_IMAGE_BUCKET)
      .upload(path, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false })

    if (error) {
      console.error('Upload service image error:', error)
      return { success: false as const, error: 'تعذر رفع الصورة' }
    }

    const { data } = getSupabaseAdmin().storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(path)
    return { success: true as const, url: data.publicUrl }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getServices(search?: string, archived = false) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const res = await getServicesListCached(search?.trim() || '', archived)

    if (!res.ok) {
      return { success: false as const, error: res.error }
    }

    return { success: true as const, data: res.data }
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

    updateTag(CACHE_TAGS.services)
    updateTag(CACHE_TAGS.publicServices)

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
      .select('id, image_url')
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

    if (validated.image_url !== undefined && existing.image_url && existing.image_url !== data.image_url) {
      await removeServiceImageFile(existing.image_url)
    }

    updateTag(CACHE_TAGS.services)
    updateTag(CACHE_TAGS.publicServices)

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

    updateTag(CACHE_TAGS.services)
    updateTag(CACHE_TAGS.publicServices)

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

    // Soft delete: hide the service everywhere while keeping every related
    // booking, invoice, commission, and report row untouched.
    const { error } = await getSupabaseAdmin()
      .from('services')
      .update({ archived_at: new Date().toISOString(), is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Archive service error:', error)
      return {
        success: false as const,
        error: error.message?.includes('archived_at')
          ? 'ميزة الأرشفة غير مفعّلة بعد في قاعدة البيانات. طبّق التحديث 046_service_archiving.sql ثم أعد المحاولة.'
          : 'تعذر أرشفة الخدمة',
      }
    }

    await logAudit({ userId: user.staff_id, action: 'delete', resourceType: 'service', resourceId: id })

    updateTag(CACHE_TAGS.services)
    updateTag(CACHE_TAGS.publicServices)

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function restoreService(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('services:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('services')
      .update({ archived_at: null })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Restore service error:', error)
      return { success: false as const, error: 'تعذر استرجاع الخدمة' }
    }

    if (!data) {
      return { success: false as const, error: 'الخدمة غير موجودة' }
    }

    await logAudit({ userId: user.staff_id, action: 'restore', resourceType: 'service', resourceId: id })

    updateTag(CACHE_TAGS.services)
    updateTag(CACHE_TAGS.publicServices)

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
