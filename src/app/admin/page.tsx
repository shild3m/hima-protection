import dynamic from 'next/dynamic'
import { requireAuth } from '@/lib/auth'
import QuickActions from '@/components/admin/QuickActions'

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">لوحة التحكم</h1>
        <p className="page-subtitle">مرحباً {user.name} — {user.role_name}</p>
      </div>

      <DashboardKPI permissions={user.permissions} />

      <div className="mt-6">
        <QuickActions permissions={user.permissions} />
      </div>

      <div className="mt-6">
        <DashboardCharts permissions={user.permissions} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity />
      </div>
    </div>
  )
}
