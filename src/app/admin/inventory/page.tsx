import AdminPageGuard from '@/components/admin/AdminPageGuard'
import InventoryManager from '@/components/admin/InventoryManager'

export default function AdminInventoryPage() {
  return (
    <AdminPageGuard resource="inventory" action="read">
      <InventoryManager />
    </AdminPageGuard>
  )
}
