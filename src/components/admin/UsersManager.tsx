'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaSearch,
 FaSpinner,
 FaBoxOpen,
 FaToggleOn,
 FaToggleOff,
} from 'react-icons/fa'

interface Staff {
 id: string
 email: string
 full_name: string
 phone: string | null
 role: string
 role_id: string
 is_active: boolean
 created_at: string
}

export default function UsersManager() {
 const [staff, setStaff] = useState<Staff[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [page, setPage] = useState(1)
 const [total, setTotal] = useState(0)
 const [pageSize] = useState(20)

 const loadStaff = useCallback(async (p: number) => {
 setLoading(true)
 try {
 const { getStaff } = await import('@/app/actions/staff')
 const result = await getStaff(search || undefined, p, pageSize)
 if (result.success) {
 setStaff(result.data || [])
 setTotal(result.pagination?.total || 0)
 }
 } finally {
 setLoading(false)
 }
 }, [search, pageSize])

 useEffect(() => { loadStaff(page) }, [page, loadStaff])

 const totalPages = Math.ceil(total / pageSize)

 const roleBadge = (role: string) => {
 const map: Record<string, string> = {
 super_admin: 'bg-[#FEF2F2] text-[#DC2626]',
 admin: 'bg-[#FFFBEB] text-[#D97706]',
 receptionist: 'bg-[#EFF6FF] text-[#2563EB]',
 inventory_manager: 'bg-[#FAF5FF] text-[#7C3AED]',
 technician: 'bg-[#ECFDF5] text-[#059669]',
 accountant: 'bg-[#ECFEFF] text-[#0891B2]',
 }
 const cls = map[role] || 'bg-[#F1F2F3] text-[#62666D]'
 return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cls}`}>{role}</span>
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="mb-6">
 <h1 className="text-2xl font-black text-[#111214]">المستخدمين</h1>
 <p className="text-[#62666D] text-sm mt-1">إدارة الموظفين والصلاحيات</p>
 </div>

 <div className="mb-4">
 <div className="relative">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو البريد أو الهاتف..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl py-2.5 pr-10 pl-4 text-[#111214] text-sm placeholder-slate-500 focus:outline-none focus:border-[#DC2626]"
 />
 </div>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-12 text-center">
 <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">جاري التحميل...</p>
 </div>
 ) : staff.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا يوجد موظفين</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الاسم</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">البريد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الدور</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">تاريخ الإنشاء</th>
 </tr>
 </thead>
 <tbody>
 {staff.map(s => (
 <tr key={s.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{s.full_name || s.email}</td>
 <td className="px-4 py-3 text-[#111214]">{s.email}</td>
 <td className="px-4 py-3">{roleBadge(s.role)}</td>
 <td className="px-4 py-3">
 {s.is_active ? (
 <FaToggleOn className="text-[#059669] text-lg" />
 ) : (
 <FaToggleOff className="text-[#62666D] text-lg" />
 )}
 </td>
 <td className="px-4 py-3 text-[#62666D] text-xs">
 {new Date(s.created_at).toLocaleDateString('ar-SA')}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {totalPages > 1 && (
 <div className="flex items-center justify-center gap-2 mt-4">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page === 1}
 className="px-3 py-1.5 rounded-lg bg-[#F7F7F5] text-[#62666D] text-xs font-bold disabled:opacity-30"
 >
 السابق
 </button>
 <span className="text-[#62666D] text-xs">{page} / {totalPages}</span>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="px-3 py-1.5 rounded-lg bg-[#F7F7F5] text-[#62666D] text-xs font-bold disabled:opacity-30"
 >
 التالي
 </button>
 </div>
 )}
 </div>
 )
}
