import dynamic from 'next/dynamic'
import { requireAuth } from '@/lib/auth'
import QuickActions from '@/components/admin/QuickActions'
import {
  getDashboardKPIs,
  getRecentActivity,
  getRevenueChartData,
  getBookingsChartData,
  getServicesChartData,
  getDealerPerformanceData,
  getInventoryChartData,
} from '@/app/actions/dashboard'

const DashboardKPI = dynamic(() => import('@/components/admin/DashboardKPI'), {
  loading: () => <div className="animate-pulse bg-[#E7E8EA] rounded-2xl h-48 mb-6" />,
})
const DashboardCharts = dynamic(() => import('@/components/admin/DashboardCharts'), {
  loading: () => <div className="animate-pulse bg-[#E7E8EA] rounded-2xl h-80 mb-6" />,
})
const RecentActivity = dynamic(() => import('@/components/admin/RecentActivity'), {
  loading: () => <div className="animate-pulse bg-[#E7E8EA] rounded-2xl h-64" />,
})

export default async function AdminDashboardPage() {
  const user = await requireAuth()
  const perms = user.permissions
  const can = (perm: string) => perms.includes(perm)

  // Same default range as DashboardCharts (index 1 = last 30 days), computed
  // on the server so the first paint already has data.
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  // Each chart action enforces its own permission with requirePermission(),
  // which redirects. Only prefetch what the user is actually allowed to see.
  const [kpisRes, activityRes, revenueRes, bookingsChartRes, servicesChartRes, dealerRes, inventoryRes] =
    await Promise.all([
      getDashboardKPIs(),
      getRecentActivity(10),
      can('invoices:read') ? getRevenueChartData(from, to) : null,
      can('bookings:read') ? getBookingsChartData(from, to) : null,
      can('bookings:read') ? getServicesChartData(from, to) : null,
      can('dealers:read') ? getDealerPerformanceData() : null,
      can('materials:read') ? getInventoryChartData() : null,
    ])

  const initialBundle = {
    revenue: revenueRes?.success ? revenueRes.data! : null,
    bookings: bookingsChartRes?.success ? bookingsChartRes.data! : null,
    services: servicesChartRes?.success ? servicesChartRes.data! : null,
    dealerPerf: dealerRes?.success ? dealerRes.data! : null,
    inventory: inventoryRes?.success ? inventoryRes.data! : null,
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">لوحة التحكم</h1>
        <p className="page-subtitle">مرحباً {user.name} — {user.role_name}</p>
      </div>

      <DashboardKPI permissions={perms} initialKPIs={kpisRes.success ? kpisRes.data : undefined} />

      <div className="mt-6">
        <QuickActions permissions={perms} />
      </div>

      <div className="mt-6">
        <DashboardCharts permissions={perms} initialBundle={initialBundle} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity initialData={activityRes.success ? activityRes.data : undefined} />
      </div>
    </div>
  )
}
