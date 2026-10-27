import AdminPageGuard from '@/components/admin/AdminPageGuard'
import MaterialsManager from '@/components/admin/MaterialsManager'
import { requireAuth } from '@/lib/auth'
import { getMaterials } from '@/app/actions/materials'
import { getSupplierOptions } from '@/app/actions/suppliers'

export default async function AdminMaterialsPage() {
  const user = await requireAuth()

  // Both loaders are cached (materials/suppliers tags), so this prefetch is
  // usually served from the Next data cache with no Supabase round trip.
  const canRead = user.permissions.includes('materials:read')
  const [materialsResult, suppliersResult] = canRead
    ? await Promise.all([getMaterials(undefined, 1), getSupplierOptions()])
    : [null, null]

  return (
    <AdminPageGuard resource="materials" action="read">
      <MaterialsManager
        initialMaterials={materialsResult?.success ? materialsResult.data : undefined}
        initialPagination={materialsResult?.success ? materialsResult.pagination : undefined}
        initialSuppliers={suppliersResult?.success ? suppliersResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
