'use server'

import { requireAuth, requirePermission, getSupabaseAdmin } from '@/lib/auth'

// ============================================================
// AUTHORIZATION HELPER
// ============================================================
async function resolveUser() {
  const user = await requireAuth()
  return user
}

function hasPerm(userPerms: string[], perm: string): boolean {
  return userPerms.includes(perm)
}

// ============================================================
// DATE VALIDATION
// ============================================================
function validateDateRange(from: string, to: string): { valid: boolean; error?: string } {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { valid: false, error: 'Invalid date format' }
  }
  if (fromDate > toDate) {
    return { valid: false, error: 'from date must be before to date' }
  }
  const maxDays = 366
  const diffMs = toDate.getTime() - fromDate.getTime()
  if (diffMs > maxDays * 86400000) {
    return { valid: false, error: `Date range exceeds ${maxDays} days` }
  }
  return { valid: true }
}

// ============================================================
// TYPES
// ============================================================
export interface DashboardKPIs {
  bookingsToday: number
  bookingsByStatus: Record<string, number>
  newCustomers: number
  carsInService: number
  completedServices: number
  revenue: number
  pendingPayments: number
  pendingPaymentsCount: number
  totalReferrals: number
  pendingCommissions: number
  lowStock: number
}

export interface RevenueChartData {
  labels: string[]
  values: number[]
}

export interface BookingsChartData {
  labels: string[]
  values: number[]
}

export interface ServicesChartData {
  labels: string[]
  values: number[]
}

export interface DealerPerformanceData {
  names: string[]
  referralCounts: number[]
  commissionAmounts: number[]
}

export interface InventoryChartData {
  names: string[]
  currentStock: number[]
  minStock: number[]
}

export interface RecentActivityItem {
  id: string
  type: 'booking' | 'payment' | 'referral' | 'customer' | 'invoice'
  title: string
  description: string
  timestamp: string
  icon: string
}

// ============================================================
// RPC HELPER
// Attempts server-side aggregation via RPC.
// Falls back to bounded JS aggregation if RPC unavailable.
// ============================================================
async function tryRpc<T>(
  admin: ReturnType<typeof getSupabaseAdmin>,
  fnName: string,
  params: Record<string, unknown>,
  fallback: () => Promise<T>
): Promise<T> {
  try {
    const { data, error } = await admin.rpc(fnName as never, params as never)
    if (error) throw error
    return data as T
  } catch {
    return fallback()
  }
}

// ============================================================
// 1. getDashboardKPIs
// ============================================================
export async function getDashboardKPIs(): Promise<{
  success: boolean
  data?: DashboardKPIs
  error?: string
}> {
  try {
    const user = await resolveUser()
    const perms = user.permissions
    const admin = getSupabaseAdmin()

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const kpis: DashboardKPIs = {
      bookingsToday: 0,
      bookingsByStatus: {},
      newCustomers: 0,
      carsInService: 0,
      completedServices: 0,
      revenue: 0,
      pendingPayments: 0,
      pendingPaymentsCount: 0,
      totalReferrals: 0,
      pendingCommissions: 0,
      lowStock: 0,
    }

    const queries: Promise<void>[] = []

    // --- BOOKINGS: AGGREGATE via head:true count + status GROUP BY ---
    if (hasPerm(perms, 'bookings:read')) {
      queries.push(
        (async () => {
          const [todayCountResult, statusResult, inServiceResult, completedResult] = await Promise.all([
            admin
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', todayStr),
            tryRpc(
              admin,
              'dashboard_bookings_by_status',
              { p_date: todayStr },
              async () => {
                const { data: statuses } = await admin
                  .from('bookings')
                  .select('status')
                  .gte('created_at', todayStr)
                  .lte('created_at', todayStr + 'T23:59:59.999Z')
                const byStatus: Record<string, number> = {}
                if (statuses) {
                  for (const s of statuses) {
                    byStatus[s.status] = (byStatus[s.status] || 0) + 1
                  }
                }
                return byStatus
              }
            ),
            admin
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'in_progress'),
            admin
              .from('bookings')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'completed')
              .gte('created_at', todayStr),
          ])

          kpis.bookingsToday = todayCountResult.count || 0
          kpis.bookingsByStatus = statusResult
          kpis.carsInService = inServiceResult.count || 0
          kpis.completedServices = completedResult.count || 0
        })()
      )
    }

    // --- CUSTOMERS: AGGREGATE via head:true count ---
    if (hasPerm(perms, 'customers:read')) {
      queries.push(
        (async () => {
          const { count } = await admin
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', weekStart)
          kpis.newCustomers = count || 0
        })()
      )
    }

    // --- REVENUE + PENDING: SUM via RPC, bounded fallback ---
    if (hasPerm(perms, 'invoices:read') || hasPerm(perms, 'payments:read')) {
      queries.push(
        (async () => {
          // Revenue: AGGREGATE via RPC (server-side SUM), bounded fallback
          kpis.revenue = await tryRpc(
            admin,
            'dashboard_revenue_month',
            { p_month_start: monthStart },
            async () => {
              const { data } = await admin
                .from('invoices')
                .select('paid_amount')
                .in('status', ['paid', 'partially_paid'])
                .gte('updated_at', monthStart)
                .lte('updated_at', new Date().toISOString())
              return data
                ? data.reduce((sum: number, inv: { paid_amount?: number }) => sum + (inv.paid_amount || 0), 0)
                : 0
            }
          )

          // Pending payments: AGGREGATE via RPC, bounded fallback
          const pendingResult = await tryRpc(
            admin,
            'dashboard_pending_payments',
            {},
            async () => {
              const { data } = await admin
                .from('invoices')
                .select('total, paid_amount')
                .in('status', ['issued', 'partially_paid'])
                .order('created_at', { ascending: false })
                .limit(500)
              if (!data) return { pending_total: 0, pending_count: 0 }
              return {
                pending_total: data.reduce(
                  (sum: number, inv: { total: number; paid_amount?: number }) =>
                    sum + (inv.total - (inv.paid_amount || 0)), 0
                ),
                pending_count: data.length,
              }
            }
          )
          if (typeof pendingResult === 'object' && pendingResult !== null) {
            const pr = pendingResult as { pending_total: number; pending_count: number }
            kpis.pendingPayments = Number(pr.pending_total) || 0
            kpis.pendingPaymentsCount = Number(pr.pending_count) || 0
          }
        })()
      )
    }

    // --- REFERRALS: AGGREGATE via head:true count ---
    if (hasPerm(perms, 'referrals:read')) {
      queries.push(
        (async () => {
          const { count } = await admin
            .from('referrals')
            .select('id', { count: 'exact', head: true })
          kpis.totalReferrals = count || 0
        })()
      )
    }

    // --- COMMISSIONS: SUM via RPC, bounded fallback ---
    if (hasPerm(perms, 'commissions:read')) {
      queries.push(
        (async () => {
          kpis.pendingCommissions = await tryRpc(
            admin,
            'dashboard_pending_commissions',
            {},
            async () => {
              const { data } = await admin
                .from('commissions')
                .select('calculated_amount')
                .eq('status', 'pending')
                .limit(500)
              return data
                ? data.reduce(
                    (sum: number, c: { calculated_amount?: number }) => sum + (c.calculated_amount || 0), 0
                  )
                : 0
            }
          )
        })()
      )
    }

    // --- LOW STOCK: AGGREGATE via RPC, bounded count fallback ---
    if (hasPerm(perms, 'materials:read')) {
      queries.push(
        (async () => {
          kpis.lowStock = await tryRpc(
            admin,
            'dashboard_low_stock_count',
            {},
            async () => {
              const { count } = await admin
                .from('materials')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true)
                .lte('current_stock', 0)
                .or('current_stock.lte.min_stock')
              return count || 0
            }
          )
        })()
      )
    }

    await Promise.all(queries)

    return { success: true, data: kpis }
  } catch (e) {
    const err = e as Error
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// 2. getRevenueChartData
// GROUP BY day via RPC, bounded fallback with date range
// ============================================================
export async function getRevenueChartData(
  from: string,
  to: string
): Promise<{ success: boolean; data?: RevenueChartData; error?: string }> {
  try {
    await requirePermission('invoices', 'read')

    const dv = validateDateRange(from, to)
    if (!dv.valid) return { success: false, error: dv.error }

    const admin = getSupabaseAdmin()

    const dayMap = await tryRpc(
      admin,
      'dashboard_revenue_chart',
      { p_from: from, p_to: to },
      async () => {
        const { data } = await admin
          .from('invoices')
          .select('paid_amount, updated_at')
          .in('status', ['paid', 'partially_paid'])
          .gte('updated_at', from)
          .lte('updated_at', to + 'T23:59:59.999Z')

        const daily: Record<string, number> = {}
        const start = new Date(from)
        const end = new Date(to)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          daily[d.toISOString().split('T')[0]] = 0
        }
        if (data) {
          for (const inv of data) {
            const day = inv.updated_at.split('T')[0]
            if (day in daily) {
              daily[day] += inv.paid_amount || 0
            }
          }
        }
        return Object.entries(daily).map(([day, total]) => ({ day, total }))
      }
    )

    const daily: Record<number, number> = {}
    const start = new Date(from)
    const end = new Date(to)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      daily[d.getTime()] = 0
    }

    if (Array.isArray(dayMap)) {
      for (const row of dayMap) {
        const dayMs = new Date(row.day).getTime()
        if (dayMs in daily) {
          daily[dayMs] = Number(row.total) || 0
        }
      }
    }

    const labels = Object.keys(daily).sort().map(k => new Date(Number(k)).toISOString().split('T')[0])
    const values = labels.map(l => daily[new Date(l).getTime()] || 0)

    return { success: true, data: { labels, values } }
  } catch (e) {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// 3. getBookingsChartData
// GROUP BY status via RPC, bounded fallback
// ============================================================
export async function getBookingsChartData(
  from: string,
  to: string
): Promise<{ success: boolean; data?: BookingsChartData; error?: string }> {
  try {
    await requirePermission('bookings', 'read')

    const dv = validateDateRange(from, to)
    if (!dv.valid) return { success: false, error: dv.error }

    const admin = getSupabaseAdmin()

    const statusLabels: Record<string, string> = {
      new: 'جديد',
      contacted: 'تم التواصل',
      confirmed: 'مؤكد',
      arrived: 'وصل',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      no_show: 'لم يحضر',
    }

    const statusCounts = await tryRpc(
      admin,
      'dashboard_bookings_chart',
      { p_from: from, p_to: to },
      async () => {
        const { data } = await admin
          .from('bookings')
          .select('status')
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59.999Z')
        const counts: Record<string, number> = {}
        if (data) {
          for (const b of data) {
            counts[b.status] = (counts[b.status] || 0) + 1
          }
        }
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => ({ status, count }))
      }
    )

    if (Array.isArray(statusCounts)) {
      return {
        success: true,
        data: {
          labels: statusCounts.map((r: { status: string }) => statusLabels[r.status] || r.status),
          values: statusCounts.map((r: { count: number }) => Number(r.count)),
        },
      }
    }

    const counts = statusCounts as Record<string, number>
    return {
      success: true,
      data: {
        labels: Object.keys(counts).map(k => statusLabels[k] || k),
        values: Object.values(counts),
      },
    }
  } catch (e) {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// 4. getServicesChartData
// GROUP BY service via RPC, bounded fallback
// ============================================================
export async function getServicesChartData(
  from: string,
  to: string
): Promise<{ success: boolean; data?: ServicesChartData; error?: string }> {
  try {
    await requirePermission('bookings', 'read')

    const dv = validateDateRange(from, to)
    if (!dv.valid) return { success: false, error: dv.error }

    const admin = getSupabaseAdmin()

    const serviceCounts = await tryRpc(
      admin,
      'dashboard_services_chart',
      { p_from: from, p_to: to },
      async () => {
        const { data } = await admin
          .from('bookings')
          .select('service_id, services(name)')
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59.999Z')
          .eq('status', 'completed')
        const counts: Record<string, number> = {}
        if (data) {
          for (const b of data) {
            const svcArr = b.services as unknown as { name: string }[] | null
            const name = svcArr?.[0]?.name || 'غير معروف'
            counts[name] = (counts[name] || 0) + 1
          }
        }
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ service_name: name, count }))
      }
    )

    if (Array.isArray(serviceCounts)) {
      return {
        success: true,
        data: {
          labels: serviceCounts.map((r: { service_name: string }) => r.service_name),
          values: serviceCounts.map((r: { count: number }) => Number(r.count)),
        },
      }
    }

    const counts = serviceCounts as Record<string, number>
    return { success: true, data: { labels: Object.keys(counts), values: Object.values(counts) } }
  } catch (e) {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// 5. getDealerPerformanceData
// GROUP BY dealer via RPC, bounded fallback
// ============================================================
export async function getDealerPerformanceData(): Promise<{
  success: boolean
  data?: DealerPerformanceData
  error?: string
}> {
  try {
    await requirePermission('dealers', 'read')

    const admin = getSupabaseAdmin()

    const perf = await tryRpc(
      admin,
      'dashboard_dealer_performance',
      {},
      async () => {
        const { data: dealers } = await admin
          .from('dealers')
          .select('id, business_name')
          .eq('is_active', true)
          .limit(10)

        if (!dealers || dealers.length === 0) {
          return { names: [], referralCounts: [], commissionAmounts: [] }
        }

        const dealerIds = dealers.map(d => d.id)

        const [refResult, commResult] = await Promise.all([
          admin.from('referrals').select('dealer_id').in('dealer_id', dealerIds),
          admin.from('commissions').select('dealer_id, calculated_amount').in('dealer_id', dealerIds),
        ])

        const referralCounts: Record<string, number> = {}
        const commissionSums: Record<string, number> = {}

        if (refResult.data) {
          for (const r of refResult.data) {
            referralCounts[r.dealer_id] = (referralCounts[r.dealer_id] || 0) + 1
          }
        }
        if (commResult.data) {
          for (const c of commResult.data) {
            commissionSums[c.dealer_id] = (commissionSums[c.dealer_id] || 0) + (c.calculated_amount || 0)
          }
        }

        return {
          names: dealers.map(d => d.business_name),
          referralCounts: dealers.map(d => referralCounts[d.id] || 0),
          commissionAmounts: dealers.map(d => commissionSums[d.id] || 0),
        }
      }
    )

    if (perf && typeof perf === 'object' && 'names' in perf) {
      return { success: true, data: perf as DealerPerformanceData }
    }

    if (Array.isArray(perf)) {
      const arr = perf as Array<{ dealer_name: string; referral_count: number; commission_sum: number }>
      return {
        success: true,
        data: {
          names: arr.map(r => r.dealer_name),
          referralCounts: arr.map(r => Number(r.referral_count)),
          commissionAmounts: arr.map(r => Number(r.commission_sum)),
        },
      }
    }

    return { success: true, data: { names: [], referralCounts: [], commissionAmounts: [] } }
  } catch (e) {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// 6. getInventoryChartData
// BOUNDED: .limit(15), ordered by stock ascending
// ============================================================
export async function getInventoryChartData(): Promise<{
  success: boolean
  data?: InventoryChartData
  error?: string
}> {
  try {
    await requirePermission('materials', 'read')

    const admin = getSupabaseAdmin()
    const { data: materials } = await admin
      .from('materials')
      .select('name, current_stock, min_stock')
      .eq('is_active', true)
      .order('current_stock', { ascending: true })
      .limit(15)

    if (!materials || materials.length === 0) {
      return { success: true, data: { names: [], currentStock: [], minStock: [] } }
    }

    return {
      success: true,
      data: {
        names: materials.map(m => m.name),
        currentStock: materials.map(m => m.current_stock),
        minStock: materials.map(m => m.min_stock),
      },
    }
  } catch (e) {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// 7. getRecentActivity
// PAGINATED: each sub-query uses .limit(5), merged and sliced
// ============================================================
export async function getRecentActivity(
  limit = 10
): Promise<{ success: boolean; data?: RecentActivityItem[]; error?: string }> {
  try {
    const user = await resolveUser()
    const perms = user.permissions
    const admin = getSupabaseAdmin()
    const items: RecentActivityItem[] = []

    const canBookings = hasPerm(perms, 'bookings:read')
    const canPayments = hasPerm(perms, 'payments:read')
    const canReferrals = hasPerm(perms, 'referrals:read')
    const canCustomers = hasPerm(perms, 'customers:read')

    const queries: Promise<void>[] = []

    if (canBookings) {
      queries.push(
        (async () => {
          const { data } = await admin
            .from('bookings')
            .select('id, status, created_at, customer_id, customers(full_name), vehicles(make, model)')
            .order('created_at', { ascending: false })
            .limit(5)
          if (data) {
            for (const b of data) {
              const custArr = b.customers as unknown as { full_name: string }[] | null
              const customerName = custArr?.[0]?.full_name || 'عميل'
              const vehArr = b.vehicles as unknown as { make: string; model: string }[] | null
              const vehicleInfo = vehArr?.[0]
              const vehicleStr = vehicleInfo ? ` (${vehicleInfo.make} ${vehicleInfo.model})` : ''
              const statusMap: Record<string, string> = {
                new: 'حجز جديد',
                confirmed: 'تأكيد حجز',
                in_progress: 'جاري التنفيذ',
                completed: 'اكتمل الخدمة',
                cancelled: 'إلغاء حجز',
              }
              items.push({
                id: b.id,
                type: 'booking',
                title: statusMap[b.status] || b.status,
                description: `${customerName}${vehicleStr}`,
                timestamp: b.created_at,
                icon: 'calendar',
              })
            }
          }
        })()
      )
    }

    if (canPayments) {
      queries.push(
        (async () => {
          const { data } = await admin
            .from('payments')
            .select('id, amount, payment_method, created_at, invoices(invoice_number, customers(full_name))')
            .order('created_at', { ascending: false })
            .limit(5)
          if (data) {
            for (const p of data) {
              const invArr = p.invoices as unknown as { invoice_number: string; customers: { full_name: string }[] }[] | null
              const invoice = invArr?.[0]
              items.push({
                id: p.id,
                type: 'payment',
                title: `دفعة ${p.amount.toLocaleString('en-GB')} ر.س`,
                description: invoice ? `فاتورة ${invoice.invoice_number} — ${invoice.customers?.[0]?.full_name || ''}` : '',
                timestamp: p.created_at,
                icon: 'money',
              })
            }
          }
        })()
      )
    }

    if (canReferrals) {
      queries.push(
        (async () => {
          const { data } = await admin
            .from('referrals')
            .select('id, customer_name, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5)
          if (data) {
            for (const r of data) {
              items.push({
                id: r.id,
                type: 'referral',
                title: 'إحالة جديدة',
                description: r.customer_name,
                timestamp: r.created_at,
                icon: 'handshake',
              })
            }
          }
        })()
      )
    }

    if (canCustomers) {
      queries.push(
        (async () => {
          const { data } = await admin
            .from('customers')
            .select('id, full_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5)
          if (data) {
            for (const c of data) {
              items.push({
                id: c.id,
                type: 'customer',
                title: 'عميل جديد',
                description: c.full_name,
                timestamp: c.created_at,
                icon: 'user',
              })
            }
          }
        })()
      )
    }

    await Promise.all(queries)

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { success: true, data: items.slice(0, limit) }
  } catch (e) {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}
