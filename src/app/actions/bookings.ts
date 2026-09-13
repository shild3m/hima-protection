'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { createNotificationsForRole } from '@/app/actions/notifications'

export interface AdminBookingInput {
  customerName: string
  customerPhone: string
  customerEmail?: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: number
  vehicleColor?: string
  vehiclePlate?: string
  serviceId: string
  preferredDate: string
  preferredTime: string
  notes?: string
}

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'cancelled'],
  contacted: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}

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

const StatusSchema = z.enum([
  'new', 'contacted', 'in_progress', 'completed', 'cancelled',
])

export async function getBookings(
  search?: string,
  status?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, full_name, phone),
        vehicle:vehicles(id, make, model, year, plate_number),
        service:services(id, name, base_price)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`
        customer.full_name.ilike.%${sanitized}%,
        customer.phone.ilike.%${sanitized}%,
        vehicle.make.ilike.%${sanitized}%,
        vehicle.model.ilike.%${sanitized}%,
        vehicle.plate_number.ilike.%${sanitized}%,
        service.name.ilike.%${sanitized}%
      `)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get bookings error:', error)
      return { success: false as const, error: 'تعذر جلب الحجوزات' }
    }

    const rows = data || []
    const createdByIds = [...new Set(rows.map(b => (b.created_by as string | null)).filter(Boolean))] as string[]
    let creatorNames: Record<string, string> = {}
    if (createdByIds.length > 0) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: staffRows } = await admin
        .from('staff')
        .select('user_id, full_name')
        .in('user_id', createdByIds)
      if (staffRows) {
        creatorNames = Object.fromEntries(staffRows.map(s => [s.user_id, s.full_name]))
      }
    }

    const mapped = rows.map((b) => {
      return {
        ...b,
        created_by_name: b.created_by ? creatorNames[b.created_by] || null : null,
        linked_invoice: null,
      }
    })

    const completedIds = mapped.filter(b => b.status === 'completed' && b.id).map(b => b.id as string)
    if (completedIds.length > 0) {
      const { data: hist } = await supabase
        .from('booking_status_history')
        .select('booking_id, created_at')
        .in('booking_id', completedIds)
        .eq('new_status', 'completed')
      if (hist && hist.length > 0) {
        const completedAt = new Map<string, string>()
        for (const h of hist) {
          const bid = h.booking_id as string
          const t = h.created_at as string
          if (!completedAt.has(bid) || t > completedAt.get(bid)!) {
            completedAt.set(bid, t)
          }
        }
        for (const b of mapped) {
          if (b.status === 'completed' && completedAt.has(b.id as string)) {
            b.service_date = (completedAt.get(b.id as string) as string).slice(0, 10)
          }
        }
      }
    }

    if (rows.length > 0) {
      const ids = rows.map(b => b.id as string)
      const { data: invData, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, booking_id')
        .in('booking_id', ids)
      if (invErr) {
        console.error('Get bookings invoice lookup error:', invErr)
      } else if (invData) {
        const invByBooking = new Map(invData.map(iv => [iv.booking_id as string, iv]))
        return {
          success: true as const,
          data: mapped.map(b => {
            const iv = invByBooking.get(b.id as string)
            return { ...b, linked_invoice: iv ? { id: iv.id, invoice_number: iv.invoice_number, status: iv.status } : null }
          }),
          pagination: {
            page: currentPage,
            pageSize: size,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / size),
          },
        }
      }
    }

    return {
      success: true as const,
      data: mapped,
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

export async function getBooking(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, full_name, phone, email),
        vehicle:vehicles(id, make, model, year, color, plate_number, vin),
        service:services(id, name, base_price, duration_minutes),
        booking_items(*, service:services(id, name, base_price))
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'الحجز غير موجود' }
    }

    const { data: history } = await supabase
      .from('booking_status_history')
      .select('*')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })

    const historyRows = history || []
    const changedByIds = [...new Set([
      ...historyRows.map(h => h.changed_by).filter(Boolean),
      data.created_by,
    ].filter(Boolean))] as string[]
    let staffNames: Record<string, string> = {}
    if (changedByIds.length > 0) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: staffRows } = await admin
        .from('staff')
        .select('user_id, full_name')
        .in('user_id', changedByIds)
      if (staffRows) {
        staffNames = Object.fromEntries(staffRows.map(s => [s.user_id, s.full_name]))
      }
    }
    const enrichedHistory = historyRows.map(h => ({
      ...h,
      changed_by_name: h.changed_by ? staffNames[h.changed_by] || null : null,
    }))

    const { data: linkedInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total, paid_amount, created_at')
      .eq('booking_id', id)
      .maybeSingle()

    return { success: true as const, data: { ...data, status_history: enrichedHistory, created_by_name: data.created_by ? staffNames[data.created_by] || null : null, linked_invoice: linkedInvoice || null } }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function updateBookingStatus(
  id: string,
  newStatus: string,
  notes?: string,
  warrantyInput?: { years?: number; noWarranty?: boolean },
) {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('bookings:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  const statusResult = StatusSchema.safeParse(newStatus)
  if (!statusResult.success) {
    return { success: false as const, error: 'حالة الحجز غير صحيحة' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الحجز غير موجود' }
    }

    let allowed = VALID_TRANSITIONS[existing.status] || []

    // Super-admin: bypass normal transition rules — can change to any
    // non-completed status from any status (except completed is terminal).
    if (user.role_name === 'super_admin' && existing.status !== 'completed') {
      const ALL = ['new', 'contacted', 'in_progress', 'completed', 'cancelled']
      allowed = ALL.filter(s => s !== existing.status)
    }

    if (!allowed.includes(newStatus)) {
      return {
        success: false as const,
        error: `لا يمكن تغيير الحالة من "${existing.status}" إلى "${newStatus}"`,
      }
    }

    const updatePayload: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'completed' && warrantyInput) {
      if (warrantyInput.years && warrantyInput.years >= 1 && warrantyInput.years <= 10) {
        const start = todayIso()
        updatePayload.warranty_start_date = start
        updatePayload.warranty_end_date = addYears(start, warrantyInput.years)
      } else if (warrantyInput.noWarranty) {
        updatePayload.warranty_start_date = null
        updatePayload.warranty_end_date = null
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', id)
      .eq('status', existing.status)
      .select()
      .single()

    if (error) {
      console.error('Update booking status error:', error)
      return { success: false as const, error: 'تعذر تحديث حالة الحجز' }
    }

    if (!data) {
      return { success: false as const, error: 'الحجز غير موجود أو تغيرت الحالة منذ قرائتها' }
    }

    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: id,
        old_status: existing.status,
        new_status: newStatus,
        changed_by: user.auth_user_id,
        notes: notes || null,
      })

    await logAudit({
      userId: user.auth_user_id,
      action: 'booking_status_changed',
      resourceType: 'bookings',
      resourceId: id,
      oldValues: { status: existing.status },
      newValues: { status: newStatus },
    })

    const STATUS_NOTIFICATIONS: Record<string, { type: string; title: string; msg: string }> = {
      cancelled: { type: 'booking_cancelled', title: 'تم إلغاء الحجز', msg: `تم إلغاء الحجز ${id.slice(0, 8)}` },
      completed: { type: 'service_completed', title: 'اكتملت الخدمة', msg: `اكتملت خدمة الحجز ${id.slice(0, 8)}` },
    }
    const notif = STATUS_NOTIFICATIONS[newStatus]
    if (notif) {
      createNotificationsForRole('bookings', 'read', notif.type, notif.title, notif.msg, 'bookings', id).catch(() => {})
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function updateBookingWarranty(
  id: string,
  warrantyStart: string | null,
  warrantyEnd: string | null,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:manage')) {
    return { success: false as const, error: 'غير مصرح' }
  }
  const rl = await checkRateLimit('bookings:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الحجز غير موجود' }
    }
    if (existing.status !== 'completed') {
      return { success: false as const, error: 'الضمان يُضاف فقط للحجوزات المكتملة' }
    }

    const start = warrantyStart && warrantyStart.trim() ? warrantyStart.trim() : null
    const end = warrantyEnd && warrantyEnd.trim() ? warrantyEnd.trim() : null

    if (end) {
      const endMs = new Date(end + 'T00:00:00').getTime()
      const startMs = start ? new Date(start + 'T00:00:00').getTime() : NaN
      if (Number.isNaN(endMs)) {
        return { success: false as const, error: 'تاريخ نهاية الضمان غير صحيح' }
      }
      if (!start || Number.isNaN(startMs) || startMs > endMs) {
        return { success: false as const, error: 'تاريخ بداية الضمان يجب أن يكون قبل تاريخ النهاية' }
      }
    } else if (start) {
      const startMs = new Date(start + 'T00:00:00').getTime()
      if (Number.isNaN(startMs)) {
        return { success: false as const, error: 'تاريخ بداية الضمان غير صحيح' }
      }
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await admin
      .from('bookings')
      .update({ warranty_start_date: start, warranty_end_date: end })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update booking warranty error:', error)
      return { success: false as const, error: 'تعذر تحديث الضمان' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'booking_warranty_updated',
      resourceType: 'bookings',
      resourceId: id,
      newValues: { warranty_start_date: start, warranty_end_date: end },
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getBookingStats() {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const ALL_STATUSES = ['new', 'contacted', 'in_progress', 'completed', 'cancelled'] as const
    const counts: Record<string, number> = {}
    for (const s of ALL_STATUSES) counts[s] = 0

    const { data, error } = await supabase
      .from('bookings')
      .select('status')

    if (error) {
      console.error('Get booking stats error:', error)
      return { success: false as const, error: 'تعذر جلب إحصائيات الحجوزات' }
    }

    for (const row of data || []) {
      if (row.status in counts) counts[row.status]++
    }

    const total = data?.length || 0

    return {
      success: true as const,
      data: { counts, total },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addYears(iso: string, years: number): string {
  const [y, m, dd] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, dd))
  date.setUTCFullYear(date.getUTCFullYear() + years)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export async function adminCreateBooking(input: AdminBookingInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('bookings:create')
  if (!rl.ok) return { success: false as const, error: rl.error }

  const fieldErrors: Record<string, string> = {}
  if (!input.customerName || input.customerName.trim().length < 2) {
    fieldErrors.customerName = 'اسم العميل مطلوب (حرفين على الأقل)'
  }
  const normalizedPhone = normalizePhone(input.customerPhone || '')
  if (!normalizedPhone) {
    fieldErrors.customerPhone = 'رقم الجوال مطلوب'
  } else if (normalizedPhone.length !== 10) {
    fieldErrors.customerPhone = 'رقم الجوال يجب أن يتكون من 10 أرقام'
  }
  if (!input.vehicleMake || input.vehicleMake.trim().length < 1) {
    fieldErrors.vehicleMake = 'اسم السيارة مطلوب'
  }
  if (!input.vehicleModel || input.vehicleModel.trim().length < 1) {
    fieldErrors.vehicleModel = 'حجم السيارة مطلوب'
  }
  if (!input.vehicleYear || input.vehicleYear < 1900 || input.vehicleYear > new Date().getFullYear() + 1) {
    fieldErrors.vehicleYear = 'سنة الصنع غير صحيحة'
  }
  if (!input.serviceId) {
    fieldErrors.serviceId = 'يرجى اختيار الخدمة'
  }
  if (!input.preferredDate) {
    fieldErrors.preferredDate = 'التاريخ المفضل مطلوب'
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (input.preferredDate && !dateRegex.test(input.preferredDate)) {
    fieldErrors.preferredDate = 'صيغة التاريخ غير صحيحة'
  }
  if (!input.preferredTime) {
    fieldErrors.preferredTime = 'الوقت المفضل مطلوب'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false as const, message: 'أكمل الحقول المطلوبة بشكل صحيح', fieldErrors }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_booking', {
      p_customer_name: input.customerName.trim(),
      p_customer_phone: normalizedPhone,
      p_customer_email: input.customerEmail?.trim() || null,
      p_vehicle_make: input.vehicleMake.trim(),
      p_vehicle_model: input.vehicleModel.trim(),
      p_vehicle_year: input.vehicleYear,
      p_vehicle_color: input.vehicleColor?.trim() || null,
      p_vehicle_plate: input.vehiclePlate?.trim() || null,
      p_service_id: input.serviceId,
      p_preferred_date: input.preferredDate,
      p_preferred_time: input.preferredTime,
      p_notes: input.notes?.trim() || null,
      p_idempotency_key: null,
    })

    if (error) {
      console.error('Admin create booking RPC error:', error)
      return { success: false as const, error: 'حدث خطأ أثناء إنشاء الحجز' }
    }

    if (!data) {
      return { success: false as const, error: 'حدث خطأ غير متوقع' }
    }

    const result = data as {
      success: boolean
      booking_id?: string
      error?: string
      message?: string
    }

    if (!result.success) {
      return { success: false as const, error: result.error || 'حدث خطأ' }
    }

    if (result.booking_id) {
      const { data: svc } = await supabase
        .from('services')
        .select('name')
        .eq('id', input.serviceId)
        .maybeSingle()
      if (svc?.name) {
        await supabase
          .from('bookings')
          .update({ service_name_snapshot: svc.name })
          .eq('id', result.booking_id)
      }

      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: staffRow } = await admin
        .from('staff')
        .select('full_name')
        .eq('user_id', user.auth_user_id)
        .maybeSingle()
      const creatorName = staffRow?.full_name || user.email || user.name
      await admin
        .from('bookings')
        .update({ created_by: user.auth_user_id, created_by_name: creatorName })
        .eq('id', result.booking_id)
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'admin_booking_created',
      resourceType: 'bookings',
      resourceId: result.booking_id || '',
      newValues: { customer_name: input.customerName.trim(), service_id: input.serviceId },
    })

    createNotificationsForRole('bookings', 'read', 'new_booking', 'حجز جديد', `تم إنشاء حجز جديد بواسطة الأدمن`, 'bookings', result.booking_id || '').catch(() => {})

    return { success: true as const, bookingId: result.booking_id }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function deleteBooking(id: string, tokenHash: string) {
  const user = await requireAuth()
  if (user.role_name !== 'super_admin') {
    return { success: false as const, error: 'غير مصرح — السوبر أدمن فقط' }
  }

  try {
    const supabase = await createClient()

    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'booking_delete_secret')
      .maybeSingle()

    if (!setting?.value || tokenHash !== setting.value) {
      return { success: false as const, error: 'رمز الحذف غير صحيح' }
    }

    const rl = await checkRateLimit('bookings:delete')
    if (!rl.ok) return { success: false as const, error: rl.error }

    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الحجز غير موجود' }
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await admin.from('booking_status_history').delete().eq('booking_id', id)
    await admin.from('notifications').delete().eq('resource_id', id).eq('resource_type', 'bookings')

    const { error } = await admin.from('bookings').delete().eq('id', id)

    if (error) {
      console.error('Delete booking error:', error)
      return { success: false as const, error: 'تعذر حذف الحجز' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'admin_booking_deleted',
      resourceType: 'bookings',
      resourceId: id,
      oldValues: { status: existing.status },
    })

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getDeleteTokenHash() {
  const user = await requireAuth()
  if (user.role_name !== 'super_admin') {
    return { success: false as const, error: 'غير مصرح' }
  }
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'booking_delete_secret')
      .maybeSingle()
    return { success: true as const, hash: data?.value || null }
  } catch {
    return { success: false as const, error: 'حدث خطأ' }
  }
}

export async function setDeleteToken(currentTokenHash: string, newTokenHash: string) {
  const user = await requireAuth()
  if (user.role_name !== 'super_admin') {
    return { success: false as const, error: 'غير مصرح' }
  }
  if (!currentTokenHash || currentTokenHash.length < 8) {
    return { success: false as const, error: 'يرجى إدخال الرمز الحالي' }
  }
  if (!newTokenHash || newTokenHash.length < 8) {
    return { success: false as const, error: 'الرمز الجديد غير صالح' }
  }
  if (currentTokenHash === newTokenHash) {
    return { success: false as const, error: 'الرمز الجديد مطابق للقديم' }
  }
  try {
    const supabase = await createClient()

    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'booking_delete_secret')
      .maybeSingle()

    if (!setting?.value || currentTokenHash !== setting.value) {
      return { success: false as const, error: 'الرمز الحالي غير صحيح' }
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'booking_delete_secret', value: newTokenHash, updated_at: new Date().toISOString(), updated_by: user.auth_user_id })
    if (error) {
      return { success: false as const, error: 'تعذر حفظ الرمز' }
    }
    await logAudit({
      userId: user.auth_user_id,
      action: 'admin_delete_token_changed',
      resourceType: 'system_settings',
      resourceId: 'booking_delete_secret',
    })
    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ' }
  }
}
