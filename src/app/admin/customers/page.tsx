import AdminPageGuard from '@/components/admin/AdminPageGuard'
import CustomersManager from '@/components/admin/CustomersManager'

export default function AdminCustomersPage() {
  return (
    <AdminPageGuard resource="customers" action="read">
      <CustomersManager />
    </AdminPageGuard>
  )
}
