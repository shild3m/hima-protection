'use client'

import { useAuth } from '@/components/AuthProvider'

export default function CommissionsManager() {
  const { hasPermission } = useAuth()
  if (!hasPermission('commissions', 'read')) return null

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-[#111214]">العمولات</h1>
      <div className="bg-white border border-[#E7E8EA] rounded-2xl p-8 text-center">
        <p className="text-[#62666D] text-sm">إدارة العمولات متاحة من خلال صفحة الوكلاء أو قواعد العمولات.</p>
      </div>
    </div>
  )
}
