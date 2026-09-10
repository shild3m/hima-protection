import AdminPageGuard from '@/components/admin/AdminPageGuard'
import PaymentsManager from '@/components/admin/PaymentsManager'

export default function AdminPaymentsPage() {
  return (
    <AdminPageGuard resource="payments" action="read">
      <PaymentsManager />
    </AdminPageGuard>
  )
}
