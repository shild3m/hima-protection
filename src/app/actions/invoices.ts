'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { createNotificationsForRole } from '@/app/actions/notifications'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

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

const InvoiceItemSchema = z.object({
  service_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'وصف العنصر مطلوب').max(500),
  quantity: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unit_price: z.number().min(0, 'سعر الوحدة غير صحيح'),
  discount: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(100).default(0),
})

const InvoiceSchema = z.object({
  customer_id: z.string().uuid('معرف العميل غير صحيح'),
  vehicle_id: z.string().uuid().optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  discount: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(100).default(0),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(InvoiceItemSchema).min(1, 'يجب إضافة عنصر واحد على الأقل'),
})

type InvoiceInput = z.infer<typeof InvoiceSchema>

export async function getInvoices(
  search?: string,
  status?: string,
  page?: number,
  pageSize?: number,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(id, full_name, phone),
        vehicle:vehicles(id, make, model, plate_number),
        booking:bookings(id, status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`
        invoice_number.ilike.%${sanitized}%,
        customer.full_name.ilike.%${sanitized}%,
        customer.phone.ilike.%${sanitized}%
      `)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get invoices error:', error)
      return { success: false as const, error: 'تعذر جلب الفواتير' }
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

export async function getInvoice(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const [{ data, error }, itemsResult, paymentsResult] = await Promise.all([
      supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, full_name, phone, email),
          vehicle:vehicles(id, make, model, year, plate_number),
          booking:bookings(id, status, preferred_date)
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('invoice_items')
        .select('*, service:services(id, name)')
        .eq('invoice_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('id, amount, payment_method, paid_at, notes, created_at')
        .eq('invoice_id', id)
        .order('paid_at', { ascending: true }),
    ])

    if (error || !data) {
      return { success: false as const, error: 'الفاتورة غير موجودة' }
    }

    return {
      success: true as const,
      data: { ...data, items: itemsResult.data || [], payments: paymentsResult.data || [] },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createInvoice(input: InvoiceInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('invoices:create')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const validated = InvoiceSchema.parse(input)
    const supabase = await createClient()

    const items = validated.items.map(item => ({
      service_id: item.service_id || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount,
      tax_rate: item.tax_rate,
    }))

    const { data, error } = await supabase.rpc('create_invoice', {
      p_customer_id: validated.customer_id,
      p_vehicle_id: validated.vehicle_id || null,
      p_booking_id: validated.booking_id || null,
      p_discount: validated.discount,
      p_tax_rate: validated.tax_rate,
      p_notes: validated.notes || null,
      p_items: items,
    })

    if (error) {
      console.error('Create invoice RPC error:', error)
      return { success: false as const, error: 'تعذر إنشاء الفاتورة' }
    }

    if (!data || !data.success) {
      return { success: false as const, error: data?.error || 'تعذر إنشاء الفاتورة' }
    }

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function issueInvoice(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('invoices:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الفاتورة غير موجودة' }
    }

    if (existing.status !== 'draft') {
      return { success: false as const, error: 'يمكن إصدار الفواتير المسودة فقط' }
    }

    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'issued', issued_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Issue invoice error:', error)
      return { success: false as const, error: 'تعذر إصدار الفاتورة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'invoice_issued',
      resourceType: 'invoices',
      resourceId: id,
    })

    createNotificationsForRole('invoices', 'read', 'invoice_issued', 'فاتورة جديدة', `تم إصدار فاتورة ${data.invoice_number || id.slice(0, 8)}`, 'invoices', id).catch(() => {});

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function cancelInvoice(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('invoices:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('invoices')
      .select('id, status, paid_amount')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'الفاتورة غير موجودة' }
    }

    if (existing.status === 'paid' || existing.status === 'cancelled') {
      return { success: false as const, error: 'لا يمكن إلغاء هذه الفاتورة' }
    }

    if (existing.paid_amount > 0) {
      return { success: false as const, error: 'لا يمكن إلغاء فاتورة مدفوعة جزئيًا' }
    }

    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.auth_user_id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Cancel invoice error:', error)
      return { success: false as const, error: 'تعذر إلغاء الفاتورة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'invoice_cancelled',
      resourceType: 'invoices',
      resourceId: id,
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function updateInvoice(id: string, input: Partial<InvoiceInput>) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('invoices:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    let items: { service_id: string | null; description: string; quantity: number; unit_price: number; discount: number; tax_rate: number }[] | undefined
    if (input.items) {
      items = input.items.map(item => ({
        service_id: item.service_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        tax_rate: item.tax_rate,
      }))
    }

    const { data, error } = await supabase.rpc('update_invoice', {
      p_invoice_id: id,
      p_discount: input.discount ?? null,
      p_tax_rate: input.tax_rate ?? null,
      p_notes: input.notes ?? null,
      p_items: items ?? null,
    })

    if (error) {
      console.error('Update invoice RPC error:', error)
      return { success: false as const, error: 'تعذر تحديث الفاتورة' }
    }

    if (!data || !data.success) {
      return { success: false as const, error: data?.error || 'تعذر تحديث الفاتورة' }
    }

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function refundInvoice(id: string, reason?: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const rl = await checkRateLimit('invoices:update')
  if (!rl.ok) return { success: false as const, error: rl.error }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('refund_invoice', {
      p_invoice_id: id,
      p_reason: reason || null,
    })

    if (error) {
      console.error('Refund invoice error:', error)
      return { success: false as const, error: 'تعذر استرجاع الفاتورة' }
    }

    if (!data || typeof data !== 'object' || !('success' in data)) {
      return { success: false as const, error: 'تعذر استرجاع الفاتورة' }
    }

    if (!(data as Record<string, unknown>).success) {
      return { success: false as const, error: (data as Record<string, unknown>).error as string || 'تعذر استرجاع الفاتورة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function getInvoiceStats() {
  const user = await requireAuth()
  if (!user.permissions.includes('invoices:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('invoices')
      .select('status')

    if (error) {
      console.error('Get invoice stats error:', error)
      return { success: false as const, error: 'تعذر جلب إحصائيات الفواتير' }
    }

    const counts: Record<string, number> = {}
    for (const status of ['draft', 'issued', 'partially_paid', 'paid', 'cancelled', 'refunded']) {
      counts[status] = 0
    }
    for (const row of data || []) {
      if (row.status in counts) {
        counts[row.status]++
      }
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
