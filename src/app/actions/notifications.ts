'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth, requirePermission } from '@/lib/auth'
import type { Notification, NotificationType } from '@/lib/types'

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'بيانات غير صحيحة'
  }
  return 'حدث خطأ غير متوقع'
}

function validatePage(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return 1
  return Math.floor(num)
}

function validatePageSize(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 1) return PAGE_SIZE
  return Math.min(Math.floor(num), MAX_PAGE_SIZE)
}

// ============================================================
// getNotifications: Paginated list for authenticated user
// ============================================================
export async function getNotifications(
  page?: number,
  pageSize?: number,
  unreadOnly?: boolean,
) {
  const user = await requireAuth()
  if (!user.permissions.includes('notifications:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  const currentPage = validatePage(page)
  const size = validatePageSize(pageSize)
  const from = (currentPage - 1) * size
  const to = from + size - 1

  try {
    const supabase = await createClient()
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.auth_user_id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error, count } = await query

    if (error) {
      return { success: false as const, error: 'تعذر جلب الإشعارات' }
    }

    return {
      success: true as const,
      data: (data || []) as Notification[],
      pagination: {
        page: currentPage,
        pageSize: size,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / size),
      },
    }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// getUnreadCount: Efficient count for bell badge
// ============================================================
export async function getUnreadCount() {
  const user = await requireAuth()
  if (!user.permissions.includes('notifications:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.auth_user_id)
      .eq('is_read', false)

    if (error) {
      return { success: false as const, error: 'تعذر جلب العدد' }
    }

    return { success: true as const, count: count || 0 }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// markNotificationRead: Mark single as read (scoped to user)
// ============================================================
export async function markNotificationRead(id: string) {
  const user = await requireAuth()
  if (!user.permissions.includes('notifications:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  if (!id || typeof id !== 'string') {
    return { success: false as const, error: 'معرف الإشعار غير صحيح' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.auth_user_id)
      .eq('is_read', false)
      .select('id')
      .single()

    if (error || !data) {
      return { success: false as const, error: 'الإشعار غير موجود أو مقروء بالفعل' }
    }

    return { success: true as const }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// markAllNotificationsRead: Mark all user's as read
// ============================================================
export async function markAllNotificationsRead() {
  const user = await requireAuth()
  if (!user.permissions.includes('notifications:read')) {
    return { success: false as const, error: 'غير مصرح' }
  }

  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.auth_user_id)
      .eq('is_read', false)

    if (error) {
      return { success: false as const, error: 'تعذر تحديث الإشعارات' }
    }

    return { success: true as const, count: count || 0 }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// createNotification: Internal helper for business logic
// Uses SECURITY DEFINER RPC for atomic idempotent insert
// ============================================================
export async function createNotification(
  userId: string,
  type: NotificationType | string,
  title: string,
  message?: string,
  referenceType?: string,
  referenceId?: string,
) {
  await requirePermission('notifications', 'manage')

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_notification' as never, {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message || null,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    } as never)

    if (error) {
      return { success: false as const, error: 'تعذر إنشاء الإشعار' }
    }

    return { success: true as const, data }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}

// ============================================================
// createNotificationsForRole: Broadcast to role by permission
// ============================================================
export async function createNotificationsForRole(
  resource: string,
  action: string,
  type: NotificationType | string,
  title: string,
  message?: string,
  referenceType?: string,
  referenceId?: string,
) {
  await requirePermission('notifications', 'manage')

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_notifications_for_role' as never, {
      p_resource: resource,
      p_action: action,
      p_type: type,
      p_title: title,
      p_message: message || null,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    } as never)

    if (error) {
      return { success: false as const, error: 'تعذر إنشاء الإشعارات' }
    }

    return { success: true as const, count: data as number }
  } catch {
    return { success: false as const, error: 'حدث خطأ غير متوقع' }
  }
}
