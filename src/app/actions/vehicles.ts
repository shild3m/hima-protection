'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

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

const VehicleSchema = z.object({
  customer_id: z.string().uuid('معرف العميل غير صحيح'),
  make: z.string().min(1, 'شركة الصنع مطلوبة').max(100),
  model: z.string().min(1, 'الموديل مطلوب').max(100),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  plate_number: z.string().max(20).optional().nullable(),
  // The serial number is the vehicle identity: mandatory, never duplicated.
  vin: z.string().trim().min(3, 'الرقم التسلسلي مطلوب').max(32, 'الرقم التسلسلي طويل (32 حرفاً كحد أقصى)'),
  notes: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().default(true),
  status: z.enum(['tentative', 'confirmed']).optional(),
})

type VehicleInput = z.infer<typeof VehicleSchema>

/** Serial numbers match only when case/spaces/dashes are ignored (same rule as the DB index). */
function normalizeSerial(value: string): string {
  return value.trim().replace(/[\s-]/g, '').toLowerCase()
}

type SerialMatch = { id: string; make: string; model: string; plate_number: string | null; vin: string }

/**
 * Finds the vehicle that already owns this serial number.
 * Uses the `vehicles_by_serial` helper (RLS respected), and falls back to a
 * local scan when the helper is not deployed yet.
 */
async function findVehicleBySerial(
  supabase: Awaited<ReturnType<typeof createClient>>,
  vin: string,
): Promise<SerialMatch | null> {
  const target = normalizeSerial(vin)
  if (!target) return null

  try {
    const { data, error } = await supabase.rpc('vehicles_by_serial', { p_serial: vin })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (row) return row as SerialMatch
    return null
  } catch {
    const { data } = await supabase
      .from('vehicles')
      .select('id, make, model, plate_number, vin')
      .limit(500)
    const row = (data || []).find((v) => normalizeSerial(String(v.vin || '')) === target)
    return (row as SerialMatch) || null
  }
}

export async function getVehicles(
  search?: string,
  page?: number,
  pageSize?: number,
  status: 'all' | 'tentative' | 'confirmed' = 'confirmed',
) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('vehicles')
      .select('*, customer:customers(id, full_name, phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // The list shows served (confirmed) vehicles by default; tentative ones
    // are the cars a booking registered while it was in service.
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (search && search.trim()) {
      const sanitized = sanitizeSearch(search)
      query = query.or(`make.ilike.%${sanitized}%,model.ilike.%${sanitized}%,plate_number.ilike.%${sanitized}%,vin.ilike.%${sanitized}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get vehicles error:', error)
      return { success: false as const, error: 'تعذر جلب المركبات' }
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

export async function getVehicle(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, customer:customers(id, full_name, phone, email)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return { success: false as const, error: 'المركبة غير موجودة' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

export async function createVehicle(input: VehicleInput) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:create')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const validated = VehicleSchema.parse(input)
    const supabase = await createClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', validated.customer_id)
      .maybeSingle()

    if (!customer) {
      return { success: false as const, error: 'العميل غير موجود' }
    }

    // Serial-number uniqueness: one serial = one vehicle, always.
    const clash = await findVehicleBySerial(supabase, validated.vin)
    if (clash) {
      return {
        success: false as const,
        error: `هذا الرقم التسلسلي مسجّل مسبقًا لسيارة: ${clash.make} ${clash.model}`,
      }
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        customer_id: validated.customer_id,
        make: validated.make.trim(),
        model: validated.model.trim(),
        size: validated.size,
        year: validated.year || null,
        color: validated.color || null,
        plate_number: validated.plate_number || null,
        vin: validated.vin.trim(),
        notes: validated.notes || null,
        is_active: validated.is_active,
        // A car added by hand on purpose enters the list straight away;
        // tentative is reserved for cars a booking created itself.
        status: validated.status ?? 'confirmed',
      })
      .select('*, customer:customers(id, full_name, phone)')
      .single()

    if (error) {
      console.error('Create vehicle error:', error)
      if (error.code === '23505') {
        return { success: false as const, error: 'هذا الرقم التسلسلي مسجّل لسيارة أخرى' }
      }
      return { success: false as const, error: 'تعذر إنشاء المركبة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'vehicle_created',
      resourceType: 'vehicles',
      resourceId: data.id,
      newValues: { make: data.make, model: data.model, customer_id: data.customer_id, is_active: data.is_active },
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('vehicles')
      .select('id, customer_id, make, model, size, year, color, plate_number, vin, notes, is_active, status, previous_plates')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المركبة غير موجودة' }
    }

    const validated = VehicleSchema.partial().parse(input)
    const updateData: Record<string, unknown> = {}

    if (validated.vin !== undefined) {
      const normalized = normalizeSerial(validated.vin)
      if (!normalized) {
        return { success: false as const, error: 'الرقم التسلسلي مطلوب' }
      }
      const clash = await findVehicleBySerial(supabase, validated.vin)
      if (clash && clash.id !== id) {
        return {
          success: false as const,
          error: `هذا الرقم التسلسلي مسجّل مسبقًا لسيارة: ${clash.make} ${clash.model}`,
        }
      }
    }


    if (validated.customer_id !== undefined) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', validated.customer_id)
        .maybeSingle()

      if (!customer) {
        return { success: false as const, error: 'العميل غير موجود' }
      }
      updateData.customer_id = validated.customer_id
    }
    if (validated.make !== undefined) updateData.make = validated.make.trim()
    if (validated.model !== undefined) updateData.model = validated.model.trim()
    if (validated.size !== undefined) updateData.size = validated.size
    if (validated.year !== undefined) updateData.year = validated.year || null
    if (validated.color !== undefined) updateData.color = validated.color || null
    if (validated.plate_number !== undefined) {
      const newPlate = validated.plate_number || null
      const oldPlate = (existing.plate_number as string | null) || null
      // The serial number never changes; the plate can. Keep the old plate in
      // the history instead of losing it.
      if (newPlate && oldPlate && newPlate !== oldPlate) {
        const history = Array.isArray(existing.previous_plates)
          ? [...(existing.previous_plates as string[])]
          : []
        if (!history.includes(oldPlate)) history.push(oldPlate)
        updateData.previous_plates = history
      }
      updateData.plate_number = newPlate
    }
    if (validated.vin !== undefined) updateData.vin = validated.vin.trim()
    if (validated.notes !== undefined) updateData.notes = validated.notes || null
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active

    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'لا توجد تغييرات للحفظ' }
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updateData)
      .eq('id', id)
      .select('*, customer:customers(id, full_name, phone)')
      .single()

    if (error) {
      console.error('Update vehicle error:', error)
      if (error.code === '23505') {
        return { success: false as const, error: 'هذا الرقم التسلسلي مسجّل لسيارة أخرى' }
      }
      return { success: false as const, error: 'تعذر تحديث المركبة' }
    }

    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}
    for (const key of Object.keys(updateData)) {
      if ((existing as Record<string, unknown>)[key] !== updateData[key]) {
        oldValues[key] = (existing as Record<string, unknown>)[key]
        newValues[key] = updateData[key]
      }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: 'vehicle_updated',
      resourceType: 'vehicles',
      resourceId: id,
      oldValues: Object.keys(oldValues).length > 0 ? oldValues : undefined,
      newValues: Object.keys(newValues).length > 0 ? newValues : undefined,
    })

    return { success: true as const, data }
  } catch (err) {
    return { success: false as const, error: sanitizeError(err) }
  }
}

export async function toggleVehicleStatus(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:update')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('vehicles')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return { success: false as const, error: 'المركبة غير موجودة' }
    }

    const newStatus = !existing.is_active

    const { data, error } = await supabase
      .from('vehicles')
      .update({ is_active: newStatus })
      .eq('id', id)
      .select('*, customer:customers(id, full_name, phone)')
      .single()

    if (error) {
      console.error('Toggle vehicle error:', error)
      return { success: false as const, error: 'تعذر تغيير حالة المركبة' }
    }

    await logAudit({
      userId: user.auth_user_id,
      action: newStatus ? 'vehicle_activated' : 'vehicle_deactivated',
      resourceType: 'vehicles',
      resourceId: id,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: newStatus },
    })

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

// ─────────────────────────────────────────────────────────────
// Service history of one vehicle (shown in the eye panel)
// ─────────────────────────────────────────────────────────────

export type VehicleHistoryRow = {
  booking_id: string
  reference: string
  status: string
  date: string
  services: { name: string; qty: number; total: number }[]
  amount: number
  paid_amount: number
  invoice_number: string | null
  warranty_label: string | null
  warranty_start: string | null
  warranty_end: string | null
  created_at: string
}

export type VehicleHistorySummary = {
  bookings: number
  completed: number
  total_amount: number
  total_paid: number
  warranty: { state: 'active' | 'expired' | 'none'; label: string; end: string | null }
}

const WARRANTY_UNIT = (years: number) =>
  years <= 0 ? 'بدون ضمان' : years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years} سنوات`

function yearsBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.round(ms / (365.25 * 24 * 60 * 60 * 1000))
}

function toIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function getVehicleServiceHistory(vehicleId: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('vehicles:read') && !user.permissions.includes('bookings:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, status, preferred_date, warranty_start_date, warranty_end_date, created_at,
        service_name_snapshot,
        service:services(id, name, base_price),
        booking_items(id, quantity, unit_price, total, service_name_snapshot, service:services(id, name)),
        invoices(id, invoice_number, status, total, paid_amount, created_at),
        booking_status_history(created_at, new_status)
      `)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Get vehicle service history error:', error)
      return { success: false as const, error: 'تعذر جلب سجل خدمات السيارة' }
    }

    type EmbeddedInvoice = { id: string; invoice_number: string; status: string; total: number; paid_amount: number; created_at?: string | null }
    type EmbeddedBooking = {
      id: string
      status: string
      preferred_date: string | null
      warranty_start_date: string | null
      warranty_end_date: string | null
      created_at: string
      service_name_snapshot?: string | null
      service?: { id: string; name: string; base_price: number | null } | null
      booking_items?: { quantity: number; total: number; service_name_snapshot?: string | null; service?: { name: string } | null }[] | null
      invoices?: EmbeddedInvoice[] | null
      booking_status_history?: { created_at: string; new_status: string }[] | null
    }

    const rows = (data || []) as unknown as EmbeddedBooking[]
    const today = new Date().toISOString().slice(0, 10)

    const mapped: VehicleHistoryRow[] = rows.map((b) => {
      const history = b.booking_status_history || []
      let date = b.preferred_date || b.created_at.slice(0, 10)
      let latest = ''
      for (const h of history) {
        if (h.new_status === 'completed' && h.created_at > latest) latest = h.created_at
      }
      if (latest) date = latest.slice(0, 10)

      // The live invoice carries the real charged amount; without one we fall
      // back to the current prices (main service + added items).
      const liveInvoice = (b.invoices || []).find(
        (i) => i.status !== 'cancelled' && i.status !== 'refunded',
      )

      const services = [
        ...(b.service
          ? [{
              name: b.service_name_snapshot || b.service.name || 'خدمة',
              qty: 1,
              total: Number(b.service.base_price || 0),
            }]
          : []),
        ...(b.booking_items || []).map((item) => ({
          name: item.service_name_snapshot || item.service?.name || 'خدمة إضافية',
          qty: Number(item.quantity || 1),
          total: Number(item.total || 0),
        })),
      ]

      const estimated = services.reduce((sum, s) => sum + s.total, 0)
      const amount = liveInvoice ? Number(liveInvoice.total) : estimated

      const warranty_label = b.warranty_start_date && b.warranty_end_date
        ? WARRANTY_UNIT(Math.max(yearsBetween(b.warranty_start_date, b.warranty_end_date), 0))
        : null

      return {
        booking_id: b.id,
        reference: liveInvoice?.invoice_number || b.id.slice(0, 8).toUpperCase(),
        status: b.status,
        date,
        services,
        amount,
        paid_amount: liveInvoice ? Number(liveInvoice.paid_amount || 0) : 0,
        invoice_number: liveInvoice?.invoice_number || null,
        warranty_label,
        warranty_start: b.warranty_start_date,
        warranty_end: b.warranty_end_date,
        created_at: b.created_at,
      }
    })

    const completed = mapped.filter((r) => r.status === 'completed')
    const ends = mapped
      .map((r) => r.warranty_end)
      .filter((e): e is string => !!e)
      .sort()

    const latestEnd = ends[ends.length - 1] || null
    const warranty: VehicleHistorySummary['warranty'] = latestEnd
      ? latestEnd >= today
        ? { state: 'active', label: `ساري حتى ${toIsoDate(latestEnd)}`, end: latestEnd }
        : { state: 'expired', label: `انتهى في ${toIsoDate(latestEnd)}`, end: latestEnd }
      : { state: 'none', label: 'لا يوجد ضمان مسجل', end: null }

    const summary: VehicleHistorySummary = {
      bookings: mapped.length,
      completed: completed.length,
      total_amount: mapped.reduce((sum, r) => sum + (r.status === 'cancelled' || r.status === 'no_show' ? 0 : r.amount), 0),
      total_paid: mapped.reduce((sum, r) => sum + (r.status === 'cancelled' || r.status === 'no_show' ? 0 : r.paid_amount), 0),
      warranty,
    }

    return { success: true as const, data: { rows: mapped, summary } }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
