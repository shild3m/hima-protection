import AdminPageGuard from '@/components/admin/AdminPageGuard'
import SuppliersManager from '@/components/admin/SuppliersManager'

export default function AdminSuppliersPage() {
  return (
    <AdminPageGuard resource="suppliers" action="read">
      <SuppliersManager />
    </AdminPageGuard>
  )
}
