import AdminPageGuard from '@/components/admin/AdminPageGuard'
import MaterialsManager from '@/components/admin/MaterialsManager'

export default function AdminMaterialsPage() {
  return (
    <AdminPageGuard resource="materials" action="read">
      <MaterialsManager />
    </AdminPageGuard>
  )
}
