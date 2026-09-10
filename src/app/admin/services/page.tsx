import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ServicesManager from '@/components/admin/ServicesManager'

export default function AdminServicesPage() {
  return (
    <AdminPageGuard resource="services" action="read">
      <ServicesManager />
    </AdminPageGuard>
  )
}
