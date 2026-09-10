import AdminPageGuard from '@/components/admin/AdminPageGuard'
import PurchasesManager from '@/components/admin/PurchasesManager'

export default function AdminPurchasesPage() {
  return (
    <AdminPageGuard resource="purchases" action="read">
      <PurchasesManager />
    </AdminPageGuard>
  )
}
