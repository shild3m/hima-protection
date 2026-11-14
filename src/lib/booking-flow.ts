/**
 * Pure booking/payment flow rules.
 *
 * Kept framework-free so the same rules are used by the server actions and the
 * admin UI, and can be exercised directly in tests.
 */

/** Invoice statuses that still represent money owed / a live document. */
export const LIVE_INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid'] as const

export type LiveInvoiceStatus = (typeof LIVE_INVOICE_STATUSES)[number]

export interface InvoiceLike {
  status: string
  total: number
  paid_amount: number
  created_at?: string | null
}

export function isLiveInvoiceStatus(status: string | null | undefined): status is LiveInvoiceStatus {
  return !!status && (LIVE_INVOICE_STATUSES as readonly string[]).includes(status)
}

/**
 * Pick the invoice that should drive the booking UI: the newest live invoice,
 * otherwise the newest invoice of any status (refunded/cancelled history).
 */
export function pickLiveInvoice<T extends InvoiceLike>(invoices: T[] | null | undefined): T | null {
  if (!invoices || invoices.length === 0) return null
  const sorted = [...invoices].sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  )
  return sorted.find((invoice) => isLiveInvoiceStatus(invoice.status)) || sorted[0] || null
}

export function isFullyPaid(invoice: Pick<InvoiceLike, 'total' | 'paid_amount'>): boolean {
  return Number(invoice.paid_amount) >= Number(invoice.total)
}

export type BookingFlowDecision =
  | { type: 'apply_status' }
  | { type: 'complete_prompt' }
  | { type: 'invoice_prompt'; mode: 'new_to_progress' | 'completed' }
  | { type: 'payment_prompt'; completeAfterPayment: boolean }

/**
 * Decide what the admin UI should ask before a status change.
 *
 * - Moving to `in_progress` is a pre-service step: a live invoice is edited in
 *   place, and no live invoice falls back to the normal payment prompt so a new
 *   invoice can be created (including after a refund/cancel).
 * - Moving to `completed` asks for the remaining balance, then the completion
 *   warranty prompt, unless the live invoice is already fully paid.
 */
export function decideBookingFlow(input: {
  targetStatus: string
  linkedInvoice: InvoiceLike | null | undefined
}): BookingFlowDecision {
  const live = input.linkedInvoice && isLiveInvoiceStatus(input.linkedInvoice.status)
    ? input.linkedInvoice
    : null

  if (input.targetStatus === 'in_progress') {
    return live
      ? { type: 'invoice_prompt', mode: 'new_to_progress' }
      : { type: 'payment_prompt', completeAfterPayment: false }
  }

  if (input.targetStatus === 'completed') {
    if (!live) return { type: 'payment_prompt', completeAfterPayment: true }
    if (isFullyPaid(live)) return { type: 'complete_prompt' }
    return { type: 'invoice_prompt', mode: 'completed' }
  }

  return { type: 'apply_status' }
}

/** All booking statuses, in display order. */
export const BOOKING_STATUSES = ['new', 'contacted', 'in_progress', 'completed', 'cancelled'] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/**
 * Booking status transition rules — the single source of truth shared by the
 * server action and the admin UI so the two can never disagree.
 */
export const BOOKING_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'cancelled'],
  contacted: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}

/** Statuses a booking may move to under the normal rules. */
export function availableBookingStatuses(status: string, isSuperAdmin = false): string[] {
  // Super-admin: any status except the current one, but `completed` is terminal.
  if (isSuperAdmin && status !== 'completed') {
    return BOOKING_STATUSES.filter((s) => s !== status)
  }
  return BOOKING_TRANSITIONS[status] || []
}

export function isValidBookingTransition(from: string, to: string, isSuperAdmin = false): boolean {
  return availableBookingStatuses(from, isSuperAdmin).includes(to)
}

export type PaymentType = 'full' | 'deposit'

export type PaymentComputation =
  | { ok: true; amount: number; status: 'paid' | 'partially_paid' }
  | { ok: false; error: string }

/**
 * Compute the payment amount for an invoice reset/replacement.
 * A full payment always records the invoice total, never "total - paid".
 */
export function computeInvoicePayment(
  total: number,
  type: PaymentType,
  depositAmount?: number,
): PaymentComputation {
  const invoiceTotal = Number(total)
  const amount = type === 'full' ? invoiceTotal : Number(depositAmount || 0)

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'المبلغ يجب أن يكون أكبر من صفر' }
  }

  if (amount > invoiceTotal) {
    return {
      ok: false,
      error: `المبلغ (${amount}) أكبر من إجمالي الفاتورة (${invoiceTotal})`,
    }
  }

  return {
    ok: true,
    amount,
    status: amount >= invoiceTotal ? 'paid' : 'partially_paid',
  }
}
