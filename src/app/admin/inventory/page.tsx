import AdminPageGuard from '@/components/admin/AdminPageGuard'
import InventoryManager from '@/components/admin/InventoryManager'
import { requireAuth } from '@/lib/auth'
import { getStockMovements } from '@/app/actions/inventory'
import { getMaterialOptions } from '@/app/actions/materials'

export default async function AdminInventoryPage() {
  const user = await requireAuth()

  // Movements and the material filter list are prefetched together so the page
  // paints with data instead of firing two actions after hydration.
  const canRead = user.permissions.includes('inventory:read')
  const [movementsResult, materialsResult] = canRead
    ? await Promise.all([getStockMovements(undefined, undefined, 1), getMaterialOptions()])
    : [null, null]

  return (
    <AdminPageGuard resource="inventory" action="read">
      <InventoryManager
        initialMovements={movementsResult?.success ? movementsResult.data : undefined}
        initialPagination={movementsResult?.success ? movementsResult.pagination : undefined}
        initialMaterials={materialsResult?.success ? materialsResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
