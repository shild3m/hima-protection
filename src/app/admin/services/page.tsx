import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ServicesManager from '@/components/admin/ServicesManager'
import { getServices } from '@/app/actions/services'

export default async function AdminServicesPage() {
  const result = await getServices()
  const initialServices = result.success ? result.data : []

  return (
    <AdminPageGuard resource="services" action="read">
      <ServicesManager initialServices={initialServices} />
    </AdminPageGuard>
  )
}