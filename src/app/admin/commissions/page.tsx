import AdminPageGuard from '@/components/admin/AdminPageGuard'
import CommissionsManager from '@/components/admin/CommissionsManager'

export default function AdminCommissionsPage() {
  return (
    <AdminPageGuard resource="commissions" action="read">
      <CommissionsManager />
    </AdminPageGuard>
  )
}
