import AdminPageGuard from '@/components/admin/AdminPageGuard'
import RolesManager from '@/components/admin/RolesManager'
import { requireAuth } from '@/lib/auth'
import { getRoles, getAllPermissions } from '@/app/actions/roles'

export default async function AdminRolesPage() {
  const user = await requireAuth()

  const canManage = user.permissions.includes('roles:manage')
  const [rolesResult, permsResult] = canManage
    ? await Promise.all([getRoles(), getAllPermissions()])
    : [null, null]

  return (
    <AdminPageGuard resource="roles" action="manage">
      <RolesManager
        initialRoles={rolesResult?.success ? rolesResult.data : undefined}
        initialPermissions={permsResult?.success ? permsResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
