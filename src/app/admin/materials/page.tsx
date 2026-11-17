import AdminPageGuard from '@/components/admin/AdminPageGuard'
import MaterialsManager from '@/components/admin/MaterialsManager'
import { requireAuth } from '@/lib/auth'
import { getMaterials } from '@/app/actions/materials'

export default async function AdminMaterialsPage() {
  const user = await requireAuth()

  const canRead = user.permissions.includes('materials:read')
  const materialsResult = canRead ? await getMaterials(undefined, 1) : null

  return (
    <AdminPageGuard resource="materials" action="read">
      <MaterialsManager
        initialMaterials={materialsResult?.success ? materialsResult.data : undefined}
        initialPagination={materialsResult?.success ? materialsResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
