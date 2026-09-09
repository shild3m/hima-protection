import { getSupabaseAdmin } from '@/lib/auth'

export interface AuditLogEntry {
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  newValues?: Record<string, unknown>
  oldValues?: Record<string, unknown>
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('audit_logs')
      .insert({
        user_id: entry.userId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        old_values: entry.oldValues || null,
        new_values: entry.newValues || null,
      })

    if (error) {
      console.error('Audit log error:', error)
    }
  } catch (err) {
    console.error('Audit log exception:', err)
  }
}
