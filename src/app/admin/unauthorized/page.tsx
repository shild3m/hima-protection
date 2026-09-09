import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-4" dir="rtl">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#111214] mb-4">غير مصرح</h1>
        <p className="text-[#62666D] mb-8">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
        <Link
          href="/"
          className="btn-primary btn-md"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  )
}
