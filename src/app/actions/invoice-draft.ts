'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

import { LIVE_INVOICE_STATUSES, computeInvoicePayment } from '@/lib/booking-flow'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatInventoryIssueError(
  error: { message?: string } | null | undefined,
  result: Record<string, unknown> | null | undefined,
): string {
  const raw = error?.message || (typeof result?.error === 'string' ? result.error : '')
  const match = raw.match(/INSUFFICIENT_STOCK\|([^|]+)\|([0-9.]+)\|([0-9.]+)/i)
  if (match) {
    return `المخزون غير كافٍ لمادة ${match[1]} — المطلوب ${match[2]}، المتاح ${match[3]}`
  }
  return raw || 'تعذر إصدار الفاتورة'
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
      .in('status', LIVE_INVOICE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { success: true as const, data: existing, reused: true }
    }

    // New invoices are blocked for inactive customers. Existing invoices above
    // are still reused so old balances can be collected.
    const { data: customer } = await admin
      .from('customers')
      .select('is_active')
      .eq('id', booking.customer_id)
      .maybeSingle()

    if (customer && customer.is_active === false) {
      return { success: false as const, error: 'العميل معطّل — فعّله أولاً' }
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
      if (errMsg.includes('duplicate key') || errMsg.includes('invoices_booking_id_unique')) {
        return {
          success: false as const,
          error: 'تعذر إنشاء الفاتورة: توجد فاتورة سابقة لهذا الحجز (راجع migration 052)',
        }
      }
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
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online' | 'tabby' | 'tamara',
  paymentType: 'full' | 'deposit',
  depositAmount?: number,
) {
  const user = await requireAuth()
  const supabase = await createClient()

  const draft = await ensureDraftInvoiceForBooking(bookingId)
  if (!draft.success) return draft

  const invoiceId = draft.data!.id
  const admin = getAdminClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, total, paid_amount, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) {
    return { success: false as const, error: 'الفاتورة غير موجودة' }
  }

  const payment = computeInvoicePayment(invoice.total, paymentType, depositAmount)
  if (!payment.ok) {
    return { success: false as const, error: payment.error }
  }

  const amount = payment.amount
  const originalStatus = invoice.status
  const originalPaid = invoice.paid_amount

  // If invoice is still draft, issue it first
  if (invoice.status === 'draft') {
    const { data: issueResult, error: issueErr } = await supabase.rpc('issue_invoice_with_materials', {
      p_invoice_id: invoiceId,
    })

    if (issueErr || !issueResult?.success) {
      console.error('Invoice issue error:', issueErr)
      return {
        success: false as const,
        error: formatInventoryIssueError(issueErr, issueResult),
      }
    }
  }

  // Insert the replacement payment FIRST. The previous payments are only
  // deleted once the new one is safely stored, so a failed insert can never
  // wipe the existing payment history.
  const { data: inserted, error: insertErr } = await admin
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_method: paymentMethod,
      created_by: user.auth_user_id,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('Payment insert error:', insertErr)
    return { success: false as const, error: 'تعذر تسجيل الدفعة' }
  }

  // Put the invoice back exactly as it was if a later step fails.
  const restoreInvoice = async () => {
    const { error: delErr } = await admin.from('payments').delete().eq('id', inserted.id)
    if (delErr) console.error('Payment rollback error:', delErr)
    const { error: resErr } = await admin
      .from('invoices')
      .update({ status: originalStatus, paid_amount: originalPaid, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
    if (resErr) console.error('Invoice restore error:', resErr)
  }

  // A booking that was reset needs its invoice reset before a new status can
  // be written (paid/partially_paid are not allowed straight to partially_paid).
  if (originalStatus === 'paid' || originalStatus === 'partially_paid') {
    const { error: resetErr } = await admin
      .from('invoices')
      .update({ status: 'issued', paid_amount: 0, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)

    if (resetErr) {
      console.error('Invoice reset error:', resetErr)
      await restoreInvoice()
      return { success: false as const, error: `تعذر إعادة الفاتورة: ${resetErr.message}` }
    }
  }

  // issued → partially_paid or paid
  const newStatus = payment.status

  const { error: updateErr } = await admin
    .from('invoices')
    .update({ paid_amount: amount, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  if (updateErr) {
    console.error('Invoice update error:', updateErr)
    await restoreInvoice()
    return { success: false as const, error: `تعذر تحديث الفاتورة: ${updateErr.message}` }
  }

  // Everything succeeded — now drop the superseded payments (best effort).
  const { error: cleanupErr } = await admin
    .from('payments')
    .delete()
    .eq('invoice_id', invoiceId)
    .neq('id', inserted.id)
  if (cleanupErr) console.error('Old payments cleanup error:', cleanupErr)

  await logAudit({
    userId: user.auth_user_id,
    action: 'payment_recorded_auto',
    resourceType: 'payments',
    resourceId: invoiceId,
    newValues: { amount, payment_method: paymentMethod, payment_type: paymentType, new_paid: amount, new_status: newStatus },
  })

  return { success: true as const, data: { invoice_id: invoiceId, paid_amount: amount, status: newStatus } }
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

  const { data: firstPayment } = await admin
    .from('payments')
    .select('payment_method')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    success: true as const,
    data: {
      total: invoice.total,
      paid_amount: invoice.paid_amount,
      remaining: invoice.total - invoice.paid_amount,
      is_fully_paid: invoice.paid_amount >= invoice.total,
      status: invoice.status,
      payment_method: firstPayment?.payment_method || null,
    },
  }
}

export async function recordRemainingPayment(
  invoiceId: string,
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'online' | 'tabby' | 'tamara',
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

  if (invoice.status === 'cancelled' || invoice.status === 'refunded') {
    return { success: false as const, error: 'لا يمكن تسجيل دفعة لهذه الفاتورة' }
  }

  const remaining = invoice.total - invoice.paid_amount
  if (remaining <= 0) {
    return { success: false as const, error: 'الفاتورة مدفوعة بالكامل' }
  }

  // A draft invoice must be issued first so its service materials are deducted
  // exactly once before any payment is recorded against it.
  if (invoice.status === 'draft') {
    const { data: issueResult, error: issueErr } = await supabase.rpc('issue_invoice_with_materials', {
      p_invoice_id: invoiceId,
    })

    if (issueErr || !issueResult?.success) {
      console.error('Invoice issue error:', issueErr)
      return {
        success: false as const,
        error: formatInventoryIssueError(issueErr, issueResult),
      }
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount: remaining,
      payment_method: paymentMethod,
      created_by: user.auth_user_id,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('Remaining payment insert error:', insertErr)
    return { success: false as const, error: 'تعذر تسجيل الدفعة' }
  }

  const { error: updateErr } = await admin
    .from('invoices')
    .update({ paid_amount: invoice.total, status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  if (updateErr) {
    // Roll the payment back so the invoice never shows a paid_amount that does
    // not match its payment rows.
    console.error('Invoice update error:', updateErr)
    await admin.from('payments').delete().eq('id', inserted.id)
    return { success: false as const, error: `تعذر تحديث الفاتورة: ${updateErr.message}` }
  }

  await logAudit({
    userId: user.auth_user_id,
    action: 'payment_recorded_remaining',
    resourceType: 'payments',
    resourceId: invoiceId,
    newValues: { amount: remaining, payment_method: paymentMethod, new_status: 'paid' },
  })

  return { success: true as const, data: { paid_amount: invoice.total, status: 'paid' } }
}
