import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ExpensesManager from '@/components/admin/ExpensesManager'

export default function AdminExpensesPage() {
  return (
    <AdminPageGuard resource="expenses" action="read">
      <ExpensesManager />
    </AdminPageGuard>
  )
}
