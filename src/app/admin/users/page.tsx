import AdminPageGuard from '@/components/admin/AdminPageGuard'
import StaffManager from '@/components/admin/UsersManager'
import { requireAuth } from '@/lib/auth'
import { getStaff } from '@/app/actions/staff'

export default async function AdminUsersPage() {
  const user = await requireAuth()

  const canRead = user.permissions.includes('staff:read')
  const staffResult = canRead ? await getStaff(undefined, 1) : null

  return (
    <AdminPageGuard resource="staff" action="read">
      <StaffManager
        initialStaff={staffResult?.success ? staffResult.data : undefined}
        initialTotal={staffResult?.success ? staffResult.pagination?.total : undefined}
      />
    </AdminPageGuard>
  )
}
