import AdminPageGuard from '@/components/admin/AdminPageGuard'
import SuppliersManager from '@/components/admin/SuppliersManager'
import { requireAuth } from '@/lib/auth'
import { getSuppliers } from '@/app/actions/suppliers'

export default async function AdminSuppliersPage() {
  const user = await requireAuth()

  // Prefetch is served from the suppliers cache tag in most navigations.
  const canRead = user.permissions.includes('suppliers:read')
  const suppliersResult = canRead ? await getSuppliers(undefined, 1) : null

  return (
    <AdminPageGuard resource="suppliers" action="read">
      <SuppliersManager
        initialSuppliers={suppliersResult?.success ? suppliersResult.data : undefined}
        initialPagination={suppliersResult?.success ? suppliersResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
