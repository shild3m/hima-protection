import AdminPageGuard from '@/components/admin/AdminPageGuard'
import VehiclesManager from '@/components/admin/VehiclesManager'
import { requireAuth } from '@/lib/auth'
import { getVehicles } from '@/app/actions/vehicles'

export default async function AdminVehiclesPage() {
  const user = await requireAuth()

  // Server-side prefetch: the table renders with the first HTML response.
  const canRead = user.permissions.includes('vehicles:read')
  const vehiclesResult = canRead ? await getVehicles(undefined, 1) : null

  return (
    <AdminPageGuard resource="vehicles" action="read">
      <VehiclesManager
        initialVehicles={vehiclesResult?.success ? vehiclesResult.data : undefined}
        initialPagination={vehiclesResult?.success ? vehiclesResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
