import AdminPageGuard from '@/components/admin/AdminPageGuard'
import SettingsManager from '@/components/admin/SettingsManager'

export default function AdminSettingsPage() {
  return (
    <AdminPageGuard resource="settings" action="read">
      <SettingsManager />
    </AdminPageGuard>
  )
}
