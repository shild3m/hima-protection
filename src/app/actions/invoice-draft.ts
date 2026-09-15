'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const ALLOWED_EXISTING_STATUSES = ['draft', 'issued', 'partially_paid', 'paid']

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function ensureDraftInvoiceForBooking(bookingId: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const admin = getAdminClient()

    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select(`
        id, customer_id, vehicle_id, service_id, preferred_date, preferred_time, service_name_snapshot,
        service:services(id, name, base_price, duration_minutes),
        booking_items:booking_items(id, service_id, quantity, unit_price, service:services(name))
      `)
      .eq('id', bookingId)
      .maybeSingle()

    if (bookingErr) {
      console.error('[ensureDraft] booking query error:', JSON.stringify(bookingErr))
      return { success: false as const, error: `خطأ في جلب الحجز: ${bookingErr.message}` }
    }

    if (!booking) {
      // Try simple query without joins to see if booking exists at all
      const { data: simpleBooking, error: simpleErr } = await admin
        .from('bookings')
        .select('id, status, service_id, service_name_snapshot, customer_id')
        .eq('id', bookingId)
        .maybeSingle()
      console.error('[ensureDraft] booking not found with joins, simple result:', JSON.stringify(simpleBooking), 'error:', JSON.stringify(simpleErr))
      return { success: false as const, error: `الحجز غير موجود (id: ${bookingId})` }
    }

    let service = Array.isArray(booking.service) ? booking.service?.[0] : booking.service

    // Fallback: if service_id is null (old bookings), look up by service_name_snapshot
    if (!service && booking.service_name_snapshot) {
      const { data: fallbackService } = await admin
        .from('services')
        .select('id, name, base_price, duration_minutes')
        .eq('name', booking.service_name_snapshot)
        .maybeSingle()
      if (fallbackService) service = fallbackService
    }

    // No duplicate: if a live invoice already exists for this booking, reuse it
    const { data: existing } = await admin
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('booking_id', bookingId)
      .in('status', ALLOWED_EXISTING_STATUSES)
      .maybeSingle()

    if (existing) {
      return { success: true as const, data: existing, reused: true }
    }

    const items: {
      service_id: string | null
      description: string
      quantity: number
      unit_price: number
      discount: number
      tax_rate: number
    }[] = []

    if (service) {
      items.push({
        service_id: booking.service_id,
        description: service.name,
        quantity: 1,
        unit_price: Number(service.base_price) || 0,
        discount: 0,
        tax_rate: 0,
      })
    }

    for (const item of booking.booking_items || []) {
      const itemService = Array.isArray(item.service) ? item.service?.[0] : item.service
      items.push({
        service_id: item.service_id || null,
        description: itemService?.name || 'خدمة إضافية',
        quantity: item.quantity || 1,
        unit_price: Number(item.unit_price) || 0,
        discount: 0,
        tax_rate: 0,
      })
    }

    if (items.length === 0) {
      return { success: false as const, error: 'لا توجد خدمات للحجز لإنشاء الفاتورة' }
    }

    const { data: result, error } = await admin.rpc('create_invoice', {
      p_customer_id: booking.customer_id,
      p_vehicle_id: booking.vehicle_id || null,
      p_booking_id: booking.id,
      p_discount: 0,
      p_tax_rate: 0,
      p_notes: `فاتورة تلقائية من الحجز`,
      p_items: items,
    })

    if (error || !result || !result.success || !result.data?.id) {
      console.error('Auto invoice RPC error:', error || result)
      return { success: false as const, error: 'تعذر إنشاء الفاتورة التلقائية' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'invoice_created_auto',
      resourceType: 'invoices',
      resourceId: result.data.id,
      newValues: {
        booking_id: booking.id,
        customer_id: booking.customer_id,
        source: 'booking_in_progress',
      },
    })

    return {
      success: true as const,
      data: { id: result.data.id, invoice_number: result.data.invoice_number, status: 'draft' },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}