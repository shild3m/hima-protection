import AdminPageGuard from '@/components/admin/AdminPageGuard'
import InvoicesManager from '@/components/admin/InvoicesManager'

export default function AdminInvoicesPage() {
  return (
    <AdminPageGuard resource="invoices" action="read">
      <InvoicesManager />
    </AdminPageGuard>
  )
}
