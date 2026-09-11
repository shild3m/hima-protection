'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaSearch,
 FaSpinner,
 FaBoxOpen,
} from 'react-icons/fa'

interface AuditLog {
 id: string
 user_id: string
 action: string
 resource_type: string
 resource_id: string | null
 old_values: any
 new_values: any
 ip_address: string | null
 created_at: string
}

export default function AuditLogsManager() {
 const [logs, setLogs] = useState<AuditLog[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [page, setPage] = useState(1)
 const [total, setTotal] = useState(0)
 const [pageSize] = useState(20)

 const loadLogs = useCallback(async (p: number) => {
 setLoading(true)
 try {
 const { getAuditLogs } = await import('@/app/actions/audit-logs')
 const result = await getAuditLogs(search || undefined, p, pageSize)
 if (result.success) {
 setLogs(result.data || [])
 setTotal(result.pagination?.total || 0)
 }
 } finally {
 setLoading(false)
 }
 }, [search, pageSize])

 useEffect(() => { loadLogs(page) }, [page, loadLogs])

 const totalPages = Math.ceil(total / pageSize)

 const actionBadge = (action: string) => {
 if (action.includes('create')) return <span className="px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] text-[10px] font-bold">إنشاء</span>
 if (action.includes('update')) return <span className="px-2 py-0.5 rounded-md bg-[#FFFBEB] text-[#D97706] text-[10px] font-bold">تعديل</span>
 if (action.includes('delete')) return <span className="px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#DC2626] text-[10px] font-bold">حذف</span>
 return <span className="px-2 py-0.5 rounded-md bg-[#F7F7F5] text-[#62666D] text-[10px] font-bold">{action}</span>
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="mb-6">
 <h1 className="text-2xl font-black text-[#111214]">سجل التدقيق</h1>
 <p className="text-[#62666D] text-sm mt-1">سجل العمليات على النظام</p>
 </div>

 <div className="mb-4">
 <div className="relative">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث في السجلات..."
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
 ) : logs.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا توجد سجلات</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">العملية</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">النوع</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">المعرّف</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">التاريخ</th>
 </tr>
 </thead>
 <tbody>
 {logs.map(log => (
 <tr key={log.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3">{actionBadge(log.action)}</td>
 <td className="px-4 py-3 text-[#111214] text-xs">{log.resource_type}</td>
 <td className="px-4 py-3 text-[#62666D] text-xs font-mono">
 {log.resource_id ? log.resource_id.substring(0, 8) + '...' : '—'}
 </td>
 <td className="px-4 py-3 text-[#62666D] text-xs">
 {new Date(log.created_at).toLocaleString('en-GB')}
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
