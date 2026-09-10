'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
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
  contacted: ['confirmed', 'cancelled'],
  confirmed: ['arrived', 'cancelled', 'no_show'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
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
  'new', 'contacted', 'confirmed', 'arrived',
  'in_progress', 'completed', 'cancelled', 'no_show',
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

    return { success: true as const, data: { ...data, status_history: history || [] } }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function updateBookingStatus(
  id: string,
  newStatus: string,
  notes?: string,
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

    const allowed = VALID_TRANSITIONS[existing.status] || []
    if (!allowed.includes(newStatus)) {
      return {
        success: false as const,
        error: `لا يمكن تغيير الحالة من "${existing.status}" إلى "${newStatus}"`,
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
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
      confirmed: { type: 'booking_confirmed', title: 'تم تأكيد الحجز', msg: `تم تأكيد الحجز ${id.slice(0, 8)}` },
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

export async function getBookingStats() {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const ALL_STATUSES = ['new', 'contacted', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'] as const
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

export async function adminCreateBooking(input: AdminBookingInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('bookings:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('bookings:create')
  if (!rl.ok) return { success: false as const, error: rl.error }

  if (!input.customerName || input.customerName.trim().length < 2) {
    return { success: false as const, error: 'اسم العميل مطلوب (حرفين على الأقل)' }
  }
  const normalizedPhone = normalizePhone(input.customerPhone)
  if (normalizedPhone.length < 5) {
    return { success: false as const, error: 'رقم الهاتف غير صحيح' }
  }
  if (!input.vehicleMake || input.vehicleMake.trim().length < 1) {
    return { success: false as const, error: 'ماركة السيارة مطلوبة' }
  }
  if (!input.vehicleModel || input.vehicleModel.trim().length < 1) {
    return { success: false as const, error: 'موديل السيارة مطلوب' }
  }
  if (!input.vehicleYear || input.vehicleYear < 1900 || input.vehicleYear > new Date().getFullYear() + 1) {
    return { success: false as const, error: 'سنة الصنع غير صحيحة' }
  }
  if (!input.serviceId) {
    return { success: false as const, error: 'يرجى اختيار الخدمة' }
  }
  if (!input.preferredDate) {
    return { success: false as const, error: 'التاريخ المفضل مطلوب' }
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(input.preferredDate)) {
    return { success: false as const, error: 'صيغة التاريخ غير صحيحة' }
  }
  if (!input.preferredTime) {
    return { success: false as const, error: 'الوقت المفضل مطلوب' }
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
