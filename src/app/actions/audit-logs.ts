'use server'

import { requireAuth, requirePermission, getSupabaseAdmin } from '@/lib/auth'

export async function getAuditLogs(search?: string, page = 1, pageSize = 20) {
  try {
    await requirePermission('audit_logs', 'read')
    const admin = getSupabaseAdmin()
    let query = admin
      .from('audit_logs')
      .select('id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, created_at', { count: 'exact' })

    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[%_]/g, '')
      query = query.or(`action.ilike.%${sanitized}%,resource_type.ilike.%${sanitized}%`)
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Get audit logs error:', error)
      return { success: false, error: 'تعذر جلب سجلات التدقيق' }
    }
    return {
      success: true,
      data: data || [],
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    }
  } catch {
    return { success: false, error: 'حدث خطأ غير متوقع' }
  }
}
