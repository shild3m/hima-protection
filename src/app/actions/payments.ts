'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin, requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { createNotificationsForRole } from '@/app/actions/notifications'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

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

const PaymentSchema = z.object({
  invoice_id: z.string().uuid('معرف الفاتورة غير صحيح'),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'online'], {
    message: 'طريقة الدفع غير صحيحة',
  }),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
})

type PaymentInput = z.infer<typeof PaymentSchema>

export async function recordPayment(input: PaymentInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('payments:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('payments:create')
  if (!rl.ok) return { success: false as const, error: rl.error }

  const supabase = await createClient()
  const validated = PaymentSchema.parse(input)

  const { data, error } = await supabase.rpc('record_payment', {
    p_invoice_id: validated.invoice_id,
    p_amount: validated.amount,
    p_payment_method: validated.payment_method,
    p_reference_number: validated.reference_number || null,
    p_notes: validated.notes || null,
    p_idempotency_key: validated.idempotency_key || null,
  })

  if (error) {
    console.error('Record payment error:', error)
    return { success: false as const, error: 'تعذر تسجيل الدفعة' }
  }

  if (data && typeof data === 'object' && 'success' in data) {
    if (data.success) {
      await logAudit({
        userId: user.auth_user_id,
        action: 'payment_recorded',
        resourceType: 'payments',
        resourceId: data.payment_id as string,
        newValues: {
          invoice_id: validated.invoice_id,
          amount: validated.amount,
          method: validated.payment_method,
        },
      })
      createNotificationsForRole('payments', 'read', 'payment_received', 'دفعة جديدة', `تم تسجيل دفعة بقيمة ${validated.amount}`, 'payments', data.payment_id as string).catch(() => {});
      return { success: true as const, data }
    } else {
      return { success: false as const, error: (data as Record<string, unknown>).error as string || 'تعذر تسجيل الدفعة' }
    }
  }

  return { success: false as const, error: 'حدث خطأ غير متوقع' }
}

export async function getPayments(
  search?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('payments:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('payments')
      .select(`
        *,
        invoice:invoices(id, invoice_number, customer_id, total, paid_amount, status,
          customer:customers(id, full_name, phone))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`
        invoice.invoice_number.ilike.%${sanitized}%,
        invoice.customer.full_name.ilike.%${sanitized}%,
        invoice.customer.phone.ilike.%${sanitized}%,
        reference_number.ilike.%${sanitized}%
      `)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get payments error:', error)
      return { success: false as const, error: 'تعذر جلب المدفوعات' }
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

export async function getPayment(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('payments:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        invoice:invoices(id, invoice_number, total, paid_amount, status,
          customer:customers(id, full_name, phone),
          vehicle:vehicles(id, make, model, plate_number))
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'الدفعة غير موجودة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
