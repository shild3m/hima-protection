import AdminPageGuard from '@/components/admin/AdminPageGuard'
import PurchasesManager from '@/components/admin/PurchasesManager'
import { requireAuth } from '@/lib/auth'
import { getPurchases } from '@/app/actions/purchases'

export default async function AdminPurchasesPage() {
  const user = await requireAuth()

  // Server-side prefetch: the table renders with the first HTML response.
  const canRead = user.permissions.includes('purchases:read')
  const purchasesResult = canRead ? await getPurchases(undefined, undefined, 1) : null

  return (
    <AdminPageGuard resource="purchases" action="read">
      <PurchasesManager
        initialPurchases={purchasesResult?.success ? purchasesResult.data : undefined}
        initialPagination={purchasesResult?.success ? purchasesResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
