import AdminPageGuard from '@/components/admin/AdminPageGuard'
import CustomersManager from '@/components/admin/CustomersManager'
import { requireAuth } from '@/lib/auth'
import { getCustomers } from '@/app/actions/customers'

export default async function AdminCustomersPage() {
  const user = await requireAuth()

  // Server-side prefetch: the table renders with the first HTML response.
  const canRead = user.permissions.includes('customers:read')
  const customersResult = canRead ? await getCustomers(undefined, 1) : null

  return (
    <AdminPageGuard resource="customers" action="read">
      <CustomersManager
        initialCustomers={customersResult?.success ? customersResult.data : undefined}
        initialPagination={customersResult?.success ? customersResult.pagination : undefined}
      />
    </AdminPageGuard>
  )
}
