import AdminPageGuard from '@/components/admin/AdminPageGuard'
import InvoicesManager from '@/components/admin/InvoicesManager'
import { requireAuth } from '@/lib/auth'
import { getInvoices, getInvoiceStats } from '@/app/actions/invoices'

export default async function AdminInvoicesPage() {
  const user = await requireAuth()

  // Prefetch on the server so the table and counters paint with the page
  // instead of waiting for two client round trips after hydration.
  const canRead = user.permissions.includes('invoices:read')
  const [invoicesResult, statsResult] = canRead
    ? await Promise.all([getInvoices(undefined, 'all', 1), getInvoiceStats()])
    : [null, null]

  return (
    <AdminPageGuard resource="invoices" action="read">
      <InvoicesManager
        initialInvoices={invoicesResult?.success ? invoicesResult.data : undefined}
        initialPagination={invoicesResult?.success ? invoicesResult.pagination : undefined}
        initialStats={statsResult?.success ? statsResult.data : undefined}
      />
    </AdminPageGuard>
  )
}
