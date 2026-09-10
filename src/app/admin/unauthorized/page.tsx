'use client'

import Link from 'next/link'
import { FaExclamationTriangle, FaArrowRight } from 'react-icons/fa'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-4">
      <div className="bg-white border border-[#E7E8EA] rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto mb-6">
          <FaExclamationTriangle className="text-[#DC2626] text-2xl" />
        </div>
        <h1 className="text-2xl font-black text-[#111214] mb-2">غير مصرح</h1>
        <p className="text-[#62666D] text-sm mb-6">
          ليس لديك الصلاحية الكافية للوصول إلى هذه الصفحة. يرجى التواصل مع المدير للحصول على الصلاحيات المطلوبة.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all"
        >
          <FaArrowRight className="text-xs" />
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  )
}
