import AdminPageGuard from '@/components/admin/AdminPageGuard'
import AuditLogsManager from '@/components/admin/AuditLogsManager'

export default function AdminAuditLogsPage() {
  return (
    <AdminPageGuard resource="audit_logs" action="read">
      <AuditLogsManager />
    </AdminPageGuard>
  )
}
