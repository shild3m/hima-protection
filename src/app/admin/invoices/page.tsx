import InvoicesManager from '@/components/admin/InvoicesManager'

export default function AdminInvoicesPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-black text-white mb-1">الفواتير</h1>
      <p className="text-[#62666D] text-sm">إنشاء وإدارة الفواتير</p>
      <div className="mt-6">
        <InvoicesManager />
      </div>
    </div>
  )
}
