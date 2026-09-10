import AdminPageGuard from '@/components/admin/AdminPageGuard'
import CommissionRulesManager from '@/components/admin/CommissionRulesManager'

export default function AdminCommissionRulesPage() {
  return (
    <AdminPageGuard resource="commission_rules" action="read">
      <CommissionRulesManager />
    </AdminPageGuard>
  )
}
