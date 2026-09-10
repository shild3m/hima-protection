import AdminPageGuard from '@/components/admin/AdminPageGuard'
import VehiclesManager from '@/components/admin/VehiclesManager'

export default function AdminVehiclesPage() {
  return (
    <AdminPageGuard resource="vehicles" action="read">
      <VehiclesManager />
    </AdminPageGuard>
  )
}
