import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import NotificationDropdown from '@/components/admin/NotificationDropdown'
import GlobalSearch from '@/components/admin/GlobalSearch'
import AdminProviders from '@/components/admin/AdminProviders'

export const metadata = {
  title: 'لوحة التحكم',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  if (user.role_name === 'dealer') {
    redirect('/dealer')
  }

  return (
    <AdminProviders serverUser={user}>
      <div className="min-h-screen bg-[#F7F7F5] flex" dir="rtl">
        <AdminSidebar
          userName={user.name}
          roleName={user.role_name}
          permissions={user.permissions}
        />
        <main className="flex-1 mr-0 lg:mr-64 min-h-screen">
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-[#E7E8EA] px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between">
            <GlobalSearch permissions={user.permissions} />
            <NotificationDropdown />
          </div>
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </AdminProviders>
  )
}
