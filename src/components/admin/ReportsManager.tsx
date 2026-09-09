'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaSpinner,
 FaCalendarCheck,
 FaFileInvoiceDollar,
} from 'react-icons/fa'

interface BookingStats {
 counts: Record<string, number>
 total: number
}

interface InvoiceStats {
 counts: Record<string, number>
 total: number
}

export default function ReportsManager() {
 const [bookingStats, setBookingStats] = useState<BookingStats | null>(null)
 const [invoiceStats, setInvoiceStats] = useState<InvoiceStats | null>(null)
 const [loading, setLoading] = useState(true)

 const loadStats = useCallback(async () => {
 setLoading(true)
 try {
 const [{ getBookingStats }, { getInvoiceStats }] = await Promise.all([
 import('@/app/actions/bookings'),
 import('@/app/actions/invoices'),
 ])
 const [bookingsRes, invoicesRes] = await Promise.all([
 getBookingStats(),
 getInvoiceStats(),
 ])
 if (bookingsRes.success) setBookingStats(bookingsRes.data)
 if (invoicesRes.success) setInvoiceStats(invoicesRes.data)
 } finally {
 setLoading(false)
 }
 }, [])

 useEffect(() => { loadStats() }, [loadStats])

 const statusLabels: Record<string, string> = {
 new: 'جديد',
 contacted: 'تم التواصل',
 confirmed: 'مؤكد',
 arrived: 'وصل',
 in_progress: 'قيد التنفيذ',
 completed: 'مكتمل',
 cancelled: 'ملغي',
 no_show: 'لم يحضر',
 draft: 'مسودة',
 issued: 'صادرة',
 partially_paid: 'مدفوع جزئياً',
 paid: 'مدفوعة',
 refunded: 'مستردة',
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="mb-6">
 <h1 className="text-2xl font-black text-[#111214]">التقارير</h1>
 <p className="text-[#62666D] text-sm mt-1">نظرة عامة على أداء النظام</p>
 </div>

 {loading ? (
 <div className="p-12 text-center">
 <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">جاري تحميل التقارير...</p>
 </div>
 ) : (
 <div className="space-y-6">
 {bookingStats && (
 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center text-[#059669]">
 <FaCalendarCheck className="text-sm" />
 </div>
 <div>
 <h2 className="text-[#111214] font-black">الحجوزات</h2>
 <p className="text-[#62666D] text-xs">{bookingStats.total} إجمالي</p>
 </div>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {Object.entries(bookingStats.counts).map(([status, count]) => (
 <div key={status} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3">
 <p className="text-[#62666D] text-[10px] mb-1">{statusLabels[status] || status}</p>
 <p className="text-[#111214] text-lg font-black">{count}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {invoiceStats && (
 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-[#D97706]">
 <FaFileInvoiceDollar className="text-sm" />
 </div>
 <div>
 <h2 className="text-[#111214] font-black">الفواتير</h2>
 <p className="text-[#62666D] text-xs">{invoiceStats.total} إجمالي</p>
 </div>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {Object.entries(invoiceStats.counts).map(([status, count]) => (
 <div key={status} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3">
 <p className="text-[#62666D] text-[10px] mb-1">{statusLabels[status] || status}</p>
 <p className="text-[#111214] text-lg font-black">{count}</p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )
}
