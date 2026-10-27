import AdminPageGuard from '@/components/admin/AdminPageGuard'
import DealersManager from '@/components/admin/DealersManager'
import { requireAuth } from '@/lib/auth'
import { getDealers } from '@/app/actions/dealer'

export default async function AdminDealersPage() {
  const user = await requireAuth()

  // Server-side prefetch: the list renders with the first HTML response.
  const canRead = user.permissions.includes('dealers:read')
  const dealersResult = canRead ? await getDealers({}) : null

  return (
    <AdminPageGuard resource="dealers" action="read">
      <DealersManager initialDealers={dealersResult && 'data' in dealersResult ? dealersResult.data : undefined} />
    </AdminPageGuard>
  )
}
