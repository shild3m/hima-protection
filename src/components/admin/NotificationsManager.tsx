'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaCheck,
 FaCheckDouble,
 FaSpinner,
 FaBoxOpen,
} from 'react-icons/fa'

interface Notification {
 id: string
 type: string
 title: string
 message: string | null
 reference_type: string | null
 reference_id: string | null
 is_read: boolean
 read_at: string | null
 created_at: string
}

export default function NotificationsManager() {
 const [notifications, setNotifications] = useState<Notification[]>([])
 const [loading, setLoading] = useState(true)
 const [page, setPage] = useState(1)
 const [total, setTotal] = useState(0)
 const [pageSize] = useState(20)

 const loadNotifications = useCallback(async (p: number) => {
 setLoading(true)
 try {
 const { getNotifications } = await import('@/app/actions/notifications')
 const res = await getNotifications(p, pageSize)
 if (res.success) {
 setNotifications(res.data)
 setTotal(res.pagination?.total || 0)
 }
 } finally {
 setLoading(false)
 }
 }, [pageSize])

 useEffect(() => { loadNotifications(page) }, [page, loadNotifications])

 const handleMarkRead = async (id: string) => {
 try {
 const { markNotificationRead } = await import('@/app/actions/notifications')
 await markNotificationRead(id)
 setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
 } catch { /* ignore */ }
 }

 const handleMarkAllRead = async () => {
 try {
 const { markAllNotificationsRead } = await import('@/app/actions/notifications')
 await markAllNotificationsRead()
 setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
 } catch { /* ignore */ }
 }

 const typeBadge = (type: string) => {
 const map: Record<string, string> = {
 booking_created: 'حجز جديد',
 booking_confirmed: 'تأكيد حجز',
 booking_cancelled: 'إلغاء حجز',
 service_completed: 'خدمة مكتملة',
 low_stock: 'مخزون منخفض',
 referral_created: 'إحالة جديدة',
 referral_redeemed: 'إحالة مُستخدمة',
 commission_approved: 'عمولة معتمدة',
 commission_paid: 'عمولة مدفوعة',
 invoice_issued: 'فاتورة صادرة',
 payment_received: 'دفعة مستلمة',
 }
 return map[type] || type
 }

 const totalPages = Math.ceil(total / pageSize)

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214]">الإشعارات</h1>
 <p className="text-[#62666D] text-sm mt-1">إدارة الإشعارات</p>
 </div>
 {notifications.some(n => !n.is_read) && (
 <button
 onClick={handleMarkAllRead}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-[#111214] text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
 >
 <FaCheckDouble className="text-[10px]" /> قراءة الكل
 </button>
 )}
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-12 text-center">
 <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">جاري التحميل...</p>
 </div>
 ) : notifications.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا توجد إشعارات</p>
 </div>
 ) : (
 <div className="divide-y divide-white/[0.04]">
 {notifications.map(n => (
 <div
 key={n.id}
 className={`px-6 py-4 hover:bg-[#F1F2F3] transition-colors ${
 !n.is_read ? 'bg-red-500/[0.03]' : ''
 }`}
 >
 <div className="flex items-start gap-4">
 <div className="mt-1">
 {!n.is_read ? (
 <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
 ) : (
 <div className="w-2.5 h-2.5 rounded-full bg-[#E7E8EA]" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <p className={`text-sm font-bold ${!n.is_read ? 'text-[#111214]' : 'text-[#111214]'}`}>
 {n.title}
 </p>
 <span className="px-2 py-0.5 rounded-md bg-[#F7F7F5] text-[#62666D] text-[10px] font-bold">
 {typeBadge(n.type)}
 </span>
 </div>
 {n.message && (
 <p className="text-[#62666D] text-xs mb-1">{n.message}</p>
 )}
 <p className="text-[#62666D] text-[10px]">
 {new Date(n.created_at).toLocaleString('en-GB')}
 </p>
 </div>
 {!n.is_read && (
 <button
 onClick={() => handleMarkRead(n.id)}
 className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#059669]"
 title="تم القراءة"
 >
 <FaCheck className="text-xs" />
 </button>
 )}
 </div>
 </div>
 ))}
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
