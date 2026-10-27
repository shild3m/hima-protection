import AdminPageGuard from '@/components/admin/AdminPageGuard'
import BookingsManager from '@/components/admin/BookingsManager'
import { requireAuth } from '@/lib/auth'
import { getBookings, getBookingStats } from '@/app/actions/bookings'

export default async function AdminBookingsPage() {
  const user = await requireAuth()

  // Prefetch only when the user actually has access, otherwise the actions
  // would just return an error (or the guard would redirect).
  const canRead = user.permissions.includes('bookings:read')

  const [bookingsResult, statsResult] = canRead
    ? await Promise.all([getBookings(undefined, 'all', 1), getBookingStats()])
    : [null, null]

  return (
    <AdminPageGuard resource="bookings" action="read">
      <BookingsManager
        initialBookings={bookingsResult?.success ? bookingsResult.data : undefined}
        initialPagination={bookingsResult?.success ? bookingsResult.pagination : undefined}
        initialStats={statsResult?.success ? statsResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
