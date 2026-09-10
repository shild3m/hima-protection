import AdminPageGuard from '@/components/admin/AdminPageGuard'
import ReportsManager from '@/components/admin/ReportsManager'

export default function AdminReportsPage() {
  return (
    <AdminPageGuard resource="reports" action="read">
      <ReportsManager />
    </AdminPageGuard>
  )
}
