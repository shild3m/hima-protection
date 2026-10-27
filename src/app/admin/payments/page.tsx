import AdminPageGuard from '@/components/admin/AdminPageGuard'
import PaymentsManager from '@/components/admin/PaymentsManager'
import { requireAuth } from '@/lib/auth'
import { getPayments } from '@/app/actions/payments'

export default async function AdminPaymentsPage() {
  const user = await requireAuth()

  // Server-side prefetch: the table renders with the first HTML response.
  const canRead = user.permissions.includes('payments:read')
  const paymentsResult = canRead ? await getPayments(undefined, 1) : null

  return (
    <AdminPageGuard resource="payments" action="read">
      <PaymentsManager
        initialPayments={paymentsResult?.success ? paymentsResult.data : undefined}
        initialPagination={paymentsResult?.success ? paymentsResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
