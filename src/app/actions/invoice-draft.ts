'use server'

import { createClient } from '@/utils/supabase/server'
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
  try {
    const admin = getAdminClient()
    const supabase = await createClient()

    const { data: booking } = await admin
      .from('bookings')
      .select(`
        id, customer_id, vehicle_id, service_id, preferred_date, preferred_time, service_name_snapshot,
        service:services(id, name, base_price, duration_minutes),
        booking_items:booking_items(id, service_id, quantity, unit_price, service:services(name))
      `)
      .eq('id', bookingId)
      .maybeSingle()

    if (!booking) {
      return { success: false as const, error: 'الحجز غير موجود' }
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

    const { data: result, error } = await supabase.rpc('create_invoice', {
      p_customer_id: booking.customer_id,
      p_vehicle_id: booking.vehicle_id || null,
      p_booking_id: booking.id,
      p_discount: 0,
      p_tax_rate: 0,
      p_notes: `فاتورة تلقائية من الحجز`,
      p_items: items,
    })

    if (error || !result || !result.success || !result.invoice_id) {
      const errMsg = error?.message || JSON.stringify(result) || 'unknown'
      console.error('Auto invoice RPC error:', errMsg)
      return { success: false as const, error: `تعذر إنشاء الفاتورة: ${errMsg}` }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'invoice_created_auto',
      resourceType: 'invoices',
      resourceId: result.invoice_id,
      newValues: {
        booking_id: booking.id,
        customer_id: booking.customer_id,
        source: 'booking_in_progress',
      },
    })

    return {
      success: true as const,
      data: { id: result.invoice_id, invoice_number: result.invoice_number, status: 'draft' },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createInvoiceWithPayment(
  bookingId: string,
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online',
  paymentType: 'full' | 'deposit',
  depositAmount?: number,
) {
  const user = await requireAuth()

  const draft = await ensureDraftInvoiceForBooking(bookingId)
  if (!draft.success) return draft

  const invoiceId = draft.data!.id
  const admin = getAdminClient()
  const supabase = await createClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, total, paid_amount, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) {
    return { success: false as const, error: 'الفاتورة غير موجودة' }
  }

  const amount = paymentType === 'full' ? invoice.total : (depositAmount || 0)

  if (amount <= 0) {
    return { success: false as const, error: 'المبلغ يجب أن يكون أكبر من صفر' }
  }

  if (amount > invoice.total) {
    return { success: false as const, error: `المبلغ (${amount}) أكبر من إجمالي الفاتورة (${invoice.total})` }
  }

  const { error: insertErr } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_method: paymentMethod,
      created_by: user.auth_user_id,
    })

  if (insertErr) {
    console.error('Payment insert error:', insertErr)
    return { success: false as const, error: 'تعذر تسجيل الدفعة' }
  }

  const newPaid = invoice.paid_amount + amount
  const newStatus = newPaid >= invoice.total ? 'paid' : 'partially_paid'

  await admin
    .from('invoices')
    .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  await logAudit({
    userId: user.auth_user_id,
    action: 'payment_recorded_auto',
    resourceType: 'payments',
    resourceId: invoiceId,
    newValues: { amount, payment_method: paymentMethod, payment_type: paymentType, new_paid: newPaid, new_status: newStatus },
  })

  return { success: true as const, data: { invoice_id: invoiceId, paid_amount: newPaid, status: newStatus } }
}

export async function getInvoicePaidStatus(invoiceId: string) {
  await requireAuth()
  const admin = getAdminClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, total, paid_amount, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) {
    return { success: false as const, error: 'الفاتورة غير موجودة' }
  }

  return {
    success: true as const,
    data: {
      total: invoice.total,
      paid_amount: invoice.paid_amount,
      remaining: invoice.total - invoice.paid_amount,
      is_fully_paid: invoice.paid_amount >= invoice.total,
      status: invoice.status,
    },
  }
}

export async function recordRemainingPayment(
  invoiceId: string,
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online',
) {
  const user = await requireAuth()
  const admin = getAdminClient()
  const supabase = await createClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, total, paid_amount, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) {
    return { success: false as const, error: 'الفاتورة غير موجودة' }
  }

  const remaining = invoice.total - invoice.paid_amount
  if (remaining <= 0) {
    return { success: false as const, error: 'الفاتورة مدفوعة بالكامل' }
  }

  const { error: insertErr } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount: remaining,
      payment_method: paymentMethod,
      created_by: user.auth_user_id,
    })

  if (insertErr) {
    console.error('Remaining payment insert error:', insertErr)
    return { success: false as const, error: 'تعذر تسجيل الدفعة' }
  }

  await admin
    .from('invoices')
    .update({ paid_amount: invoice.total, status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  await logAudit({
    userId: user.auth_user_id,
    action: 'payment_recorded_remaining',
    resourceType: 'payments',
    resourceId: invoiceId,
    newValues: { amount: remaining, payment_method: paymentMethod, new_status: 'paid' },
  })

  return { success: true as const, data: { paid_amount: invoice.total, status: 'paid' } }
}
