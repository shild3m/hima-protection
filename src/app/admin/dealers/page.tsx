import AdminPageGuard from '@/components/admin/AdminPageGuard'
import DealersManager from '@/components/admin/DealersManager'

export default function AdminDealersPage() {
  return (
    <AdminPageGuard resource="dealers" action="read">
      <DealersManager />
    </AdminPageGuard>
  )
}
