import ExpensesManager from '@/components/admin/ExpensesManager'

export default function AdminExpensesPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-black text-white mb-1">المصروفات</h1>
      <p className="text-[#62666D] text-sm">إدارة المصروفات اليومية</p>
      <div className="mt-6">
        <ExpensesManager />
      </div>
    </div>
  )
}
