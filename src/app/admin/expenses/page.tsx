import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ExpensesManager from '@/components/admin/ExpensesManager'
import { requireAuth } from '@/lib/auth'
import { getExpenses } from '@/app/actions/expenses'

export default async function AdminExpensesPage() {
  const user = await requireAuth()

  // Server-side prefetch: the table renders with the first HTML response.
  const canRead = user.permissions.includes('expenses:read')
  const expensesResult = canRead ? await getExpenses(undefined, 1) : null

  return (
    <AdminPageGuard resource="expenses" action="read">
      <ExpensesManager
        initialExpenses={expensesResult?.success ? expensesResult.data : undefined}
        initialPagination={expensesResult?.success ? expensesResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
