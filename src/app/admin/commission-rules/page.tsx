import AdminPageGuard from '@/components/admin/AdminPageGuard'
import CommissionRulesManager from '@/components/admin/CommissionRulesManager'
import { requireAuth } from '@/lib/auth'
import { getCommissionRules } from '@/app/actions/commission'

export default async function AdminCommissionRulesPage() {
  const user = await requireAuth()

  const canRead = user.permissions.includes('commissions:read')
  const rulesResult = canRead ? await getCommissionRules({}, 1) : null

  return (
    <AdminPageGuard resource="commissions" action="read">
      <CommissionRulesManager
        initialRules={rulesResult?.data}
        initialPagination={rulesResult ? {
          page: rulesResult.page,
          total: rulesResult.total,
          totalPages: rulesResult.total_pages,
        } : undefined}
      />
    </AdminPageGuard>
  )
}
