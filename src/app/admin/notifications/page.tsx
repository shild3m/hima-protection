import AdminPageGuard from '@/components/admin/AdminPageGuard'
import NotificationsManager from '@/components/admin/NotificationsManager'
import { requireAuth } from '@/lib/auth'
import { getNotifications } from '@/app/actions/notifications'

export default async function AdminNotificationsPage() {
  const user = await requireAuth()

  // User-specific data: prefetched for this request only, never org-cached.
  const canRead = user.permissions.includes('notifications:read')
  const notificationsResult = canRead ? await getNotifications(1, 20) : null

  return (
    <AdminPageGuard resource="notifications" action="read">
      <NotificationsManager
        initialNotifications={notificationsResult?.success ? notificationsResult.data : undefined}
        initialTotal={notificationsResult?.success ? notificationsResult.pagination?.total : undefined}
      />
    </AdminPageGuard>
  )
}
