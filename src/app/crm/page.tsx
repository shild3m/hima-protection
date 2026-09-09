import Link from "next/link";

export default function CrmDashboard() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-black mb-8">لوحة التحكم</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/crm/customers"
          className="card-light rounded-2xl p-8 hover:border-[#C4121A] transition-colors"
        >
          <h2 className="text-2xl font-bold mb-2">العملاء</h2>
          <p className="text-[#62666D]">إدارة بيانات العملاء والملاحظات</p>
        </Link>
        <Link
          href="/crm/vehicles"
          className="card-light rounded-2xl p-8 hover:border-[#C4121A] transition-colors"
        >
          <h2 className="text-2xl font-bold mb-2">السيارات</h2>
          <p className="text-[#62666D]">إدارة سيارات العملاء والتاريخ</p>
        </Link>
      </div>
    </div>
  );
}
