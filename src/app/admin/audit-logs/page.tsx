import AdminPageGuard from '@/components/admin/AdminPageGuard'
import AuditLogsManager from '@/components/admin/AuditLogsManager'
import { requireAuth } from '@/lib/auth'
import { getAuditLogs } from '@/app/actions/audit-logs'

export default async function AdminAuditLogsPage() {
  const user = await requireAuth()

  const canRead = user.permissions.includes('audit_logs:read')
  const logsResult = canRead ? await getAuditLogs(undefined, 1) : null

  return (
    <AdminPageGuard resource="audit_logs" action="read">
      <AuditLogsManager
        initialLogs={logsResult?.success ? logsResult.data : undefined}
        initialTotal={logsResult?.success ? logsResult.pagination?.total : undefined}
      />
    </AdminPageGuard>
  )
}
