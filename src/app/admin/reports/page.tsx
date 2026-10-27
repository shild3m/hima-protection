import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ReportsManager from '@/components/admin/ReportsManager'
import { requireAuth } from '@/lib/auth'
import { getBookingStats } from '@/app/actions/bookings'
import { getInvoiceStats } from '@/app/actions/invoices'

export default async function AdminReportsPage() {
  const user = await requireAuth()

  // Both counters are HEAD count queries, prefetched in parallel so the report
  // paints with the page instead of after two client round trips.
  const canBookings = user.permissions.includes('bookings:read')
  const canInvoices = user.permissions.includes('invoices:read')

  const [bookingsResult, invoicesResult] = await Promise.all([
    canBookings ? getBookingStats() : null,
    canInvoices ? getInvoiceStats() : null,
  ])

  return (
    <AdminPageGuard resource="reports" action="read">
      <ReportsManager
        initialBookingStats={bookingsResult?.success ? bookingsResult.data : undefined}
        initialInvoiceStats={invoicesResult?.success ? invoicesResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
