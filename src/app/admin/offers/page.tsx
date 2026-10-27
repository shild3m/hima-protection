import AdminPageGuard from '@/components/admin/AdminPageGuard'
import OffersManager from '@/components/admin/OffersManager'
import { requireAuth } from '@/lib/auth'
import { getOffers } from '@/app/actions/offer'

export default async function AdminOffersPage() {
  const user = await requireAuth()

  const canRead = user.permissions.includes('offers:read')
  const offersResult = canRead ? await getOffers({}, 1) : null

  return (
    <AdminPageGuard resource="offers" action="read">
      <OffersManager
        initialOffers={offersResult?.data}
        initialPagination={offersResult ? {
          page: offersResult.page,
          pageSize: offersResult.per_page,
          total: offersResult.total,
          totalPages: offersResult.total_pages,
        } : undefined}
      />
    </AdminPageGuard>
  )
}
