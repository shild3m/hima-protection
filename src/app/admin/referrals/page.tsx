import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ReferralsManager from '@/components/admin/ReferralsManager'

export default function AdminReferralsPage() {
  return (
    <AdminPageGuard resource="referrals" action="read">
      <ReferralsManager />
    </AdminPageGuard>
  )
}
