import AdminPageGuard from '@/components/admin/AdminPageGuard'
import RolesManager from '@/components/admin/RolesManager'

export default function AdminRolesPage() {
  return (
    <AdminPageGuard resource="roles" action="manage">
      <RolesManager />
    </AdminPageGuard>
  )
}
