import AdminPageGuard from '@/components/admin/AdminPageGuard'
import OffersManager from '@/components/admin/OffersManager'

export default function AdminOffersPage() {
  return (
    <AdminPageGuard resource="offers" action="read">
      <OffersManager />
    </AdminPageGuard>
  )
}
