import AdminPageGuard from '@/components/admin/AdminPageGuard'
import NotificationsManager from '@/components/admin/NotificationsManager'

export default function AdminNotificationsPage() {
  return (
    <AdminPageGuard resource="notifications" action="read">
      <NotificationsManager />
    </AdminPageGuard>
  )
}
