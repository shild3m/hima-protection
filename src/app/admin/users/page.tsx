import AdminPageGuard from '@/components/admin/AdminPageGuard'
import StaffManager from '@/components/admin/UsersManager'

export default function AdminUsersPage() {
  return (
    <AdminPageGuard resource="staff" action="read">
      <StaffManager />
    </AdminPageGuard>
  )
}
