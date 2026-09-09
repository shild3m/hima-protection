import PaymentsManager from '@/components/admin/PaymentsManager'

export default function AdminPaymentsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-black text-white mb-1">المدفوعات</h1>
      <p className="text-[#62666D] text-sm">عرض وتسجيل المدفوعات</p>
      <div className="mt-6">
        <PaymentsManager />
      </div>
    </div>
  )
}
