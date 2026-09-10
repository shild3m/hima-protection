import AdminPageGuard from '@/components/admin/AdminPageGuard'
import BookingsManager from '@/components/admin/BookingsManager'

export default function AdminBookingsPage() {
  return (
    <AdminPageGuard resource="bookings" action="read">
      <BookingsManager />
    </AdminPageGuard>
  )
}
