import AdminPageGuard from '@/components/admin/AdminPageGuard'
import InventoryManager from '@/components/admin/InventoryManager'
import { requireAuth } from '@/lib/auth'
import { getInventoryAvailability, getLatestStockMovements } from '@/app/actions/inventory'
import { getMaterialOptions } from '@/app/actions/materials'

export default async function AdminInventoryPage() {
  const user = await requireAuth()

  // One row per material is painted from the server so the page does not flash
  // an empty table before the availability and latest-movement actions return.
  const canRead = user.permissions.includes('inventory:read')
  const [materialsResult, availabilityResult, latestResult] = canRead
    ? await Promise.all([
      getMaterialOptions(),
      getInventoryAvailability(),
      getLatestStockMovements(),
    ])
    : [null, null, null]

  return (
    <AdminPageGuard resource="inventory" action="read">
      <InventoryManager
        initialMaterials={materialsResult?.success ? materialsResult.data : undefined}
        initialAvailability={availabilityResult?.success ? availabilityResult.data : undefined}
        initialLatestMovements={latestResult?.success ? latestResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
