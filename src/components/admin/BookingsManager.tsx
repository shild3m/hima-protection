'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaCalendarAlt,
 FaSearch,
 FaEye,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaCar,
 FaPhone,
 FaChevronRight,
 FaChevronLeft,
 FaSync,
 FaClock,
} from 'react-icons/fa'

interface Booking {
 id: string
 customer_id: string
 vehicle_id: string
 service_id: string
 status: string
 preferred_date: string | null
 preferred_time: string | null
 customer_notes: string | null
 admin_notes: string | null
 source: string | null
 created_at: string
 updated_at: string
 customer?: { id: string; full_name: string; phone: string }
 vehicle?: { id: string; make: string; model: string; year: number | null; plate_number: string | null }
 service?: { id: string; name: string; base_price: number }
}

interface BookingDetail extends Booking {
 customer?: { id: string; full_name: string; phone: string; email: string | null }
 vehicle?: { id: string; make: string; model: string; year: number | null; color: string | null; plate_number: string | null; vin: string | null }
 service?: { id: string; name: string; base_price: number; duration_minutes: number | null }
 status_history?: { id: string; old_status: string | null; new_status: string; changed_by: string | null; notes: string | null; created_at: string }[]
}

interface Pagination {
 page: number
 pageSize: number
 total: number
 totalPages: number
}

interface Stats {
 counts: Record<string, number>
 total: number
}

type Notification = { type: 'success' | 'error'; message: string } | null

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 new: { label: 'جديد', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
 contacted: { label: 'تم التواصل', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]' },
 confirmed: { label: 'مؤكد', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
 arrived: { label: 'وصل', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB] border-[#FDE68A]' },
 in_progress: { label: 'قيد التنفيذ', color: 'text-[#EA580C]', bg: 'bg-[#FFF7ED] border-orange-500/20' },
 completed: { label: 'مكتمل', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
 cancelled: { label: 'ملغي', color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' },
 no_show: { label: 'لم يحضر', color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2] border-[#FECACA]' },
}

const VALID_TRANSITIONS: Record<string, string[]> = {
 new: ['contacted', 'cancelled'],
 contacted: ['confirmed', 'cancelled'],
 confirmed: ['arrived', 'cancelled', 'no_show'],
 arrived: ['in_progress', 'cancelled'],
 in_progress: ['completed'],
 completed: [],
 cancelled: [],
 no_show: [],
}

export default function BookingsManager() {
 const { hasPermission } = useAuth()
 const [bookings, setBookings] = useState<Booking[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [stats, setStats] = useState<Stats | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [viewingBooking, setViewingBooking] = useState<BookingDetail | null>(null)
 const [loadingDetail, setLoadingDetail] = useState(false)
 const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const canUpdate = hasPermission('bookings', 'update')

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => {
 setDebouncedSearch(search)
 setPage(1)
 }, 300)
 return () => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 }
 }, [search])

 const fetchBookings = useCallback(async () => {
 try {
 setLoading(true)
 const { getBookings } = await import('@/app/actions/bookings')
 const result = await getBookings(debouncedSearch, statusFilter, page)
 if (result.success) {
 setBookings(result.data)
 if (result.pagination) {
 setPagination(result.pagination)
 }
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب الحجوزات' })
 } finally {
 setLoading(false)
 }
 }, [debouncedSearch, statusFilter, page])

 const fetchStats = useCallback(async () => {
 try {
 const { getBookingStats } = await import('@/app/actions/bookings')
 const result = await getBookingStats()
 if (result.success) {
 setStats(result.data)
 }
 } catch {
 }
 }, [])

 useEffect(() => {
 fetchBookings()
 }, [fetchBookings])

 useEffect(() => {
 fetchStats()
 }, [fetchStats])

 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const handleViewBooking = async (booking: Booking) => {
 setViewingBooking(booking as BookingDetail)
 setLoadingDetail(true)
 try {
 const { getBooking } = await import('@/app/actions/bookings')
 const result = await getBooking(booking.id)
 if (result.success) {
 setViewingBooking(result.data)
 }
 } catch {
 } finally {
 setLoadingDetail(false)
 }
 }

 const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
 setUpdatingStatus(bookingId)
 try {
 const { updateBookingStatus } = await import('@/app/actions/bookings')
 const result = await updateBookingStatus(bookingId, newStatus)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم تحديث حالة الحجز بنجاح' })
 fetchBookings()
 fetchStats()
 if (viewingBooking?.id === bookingId) {
 handleViewBooking({ id: bookingId } as Booking)
 }
 } else {
 setNotification({ type: 'error', message: result.error || 'حدث خطأ غير متوقع' })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setUpdatingStatus(null)
 }
 }

 const statusBadge = (status: string) => {
 const config = STATUS_CONFIG[status] || { label: status, color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' }
 return (
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${config.bg} ${config.color}`}>
 {config.label}
 </span>
 )
 }

 const totalPages = pagination?.totalPages || 1

 return (
 <div className="p-4 md:p-6 lg:p-8">
 {notification && (
 <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 animate-bounceIn ${
 notification.type === 'success'
 ? 'bg-[#ECFDF5] border-[#A7F3D0] text-green-300'
 : 'bg-[#FEF2F2] border-[#FECACA] text-red-300'
 }`}>
 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
 notification.type === 'success' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
 }`}>
 {notification.type === 'success' ? <FaSync /> : <FaExclamationTriangle />}
 </div>
 {notification.message}
 <button onClick={() => setNotification(null)} className="mr-4 opacity-60 hover:opacity-100 transition">
 <FaTimes className="text-xs" />
 </button>
 </div>
 )}

 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
 <FaCalendarAlt className="text-[#DC2626] text-sm" />
 </div>
 إدارة الحجوزات
 </h1>
 <p className="text-[#62666D] text-sm mt-1 mr-11">عرض وإدارة حجوزات العملاء</p>
 </div>
 </div>

 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
 {Object.entries(STATUS_CONFIG).map(([key, config]) => (
 <button
 key={key}
 onClick={() => { setStatusFilter(statusFilter === key ? 'all' : key); setPage(1) }}
 className={`p-3 rounded-xl border text-center transition-all ${
 statusFilter === key
 ? `${config.bg} ${config.color} border-current`
 : 'bg-[#F7F7F5] border-[#E7E8EA] text-[#62666D] hover:bg-[#F1F2F3]'
 }`}
 >
 <div className="text-lg font-black">{stats.counts[key] || 0}</div>
 <div className="text-[10px] font-bold">{config.label}</div>
 </button>
 ))}
 </div>
 )}

 <div className="mb-4">
 <div className="relative max-w-md">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو الجوال أو الماركة أو رقم اللوحة..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-2.5 text-[#111214] text-sm focus:outline-none focus:border-[#FECACA] placeholder:text-[#62666D]"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#111214] transition">
 <FaTimes className="text-xs" />
 </button>
 )}
 </div>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <div className="flex flex-col items-center gap-4">
 <div className="w-10 h-10 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 <span className="text-sm text-[#62666D]">جاري التحميل...</span>
 </div>
 </div>
 ) : bookings.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-[#62666D]">
 <div className="w-16 h-16 rounded-2xl bg-[#F7F7F5] border border-[#E7E8EA] flex items-center justify-center mb-4">
 <FaBoxOpen className="text-2xl text-[#62666D]" />
 </div>
 <p className="font-bold">لا توجد حجوزات</p>
 <p className="text-xs text-[#62666D] mt-1">لم يتم العثور على حجوزات تطابق البحث</p>
 </div>
 ) : (
 <>
 <div className="grid gap-3">
 {bookings.map((booking) => (
 <div
 key={booking.id}
 className="group bg-white border border-[#E7E8EA] hover:border-[#E7E8EA] rounded-xl p-3 sm:p-4 flex items-center justify-between transition-all duration-200"
 >
 <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
 <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border ${
 booking.status === 'completed'
 ? 'bg-[#ECFDF5] border-[#A7F3D0]'
 : booking.status === 'cancelled'
 ? 'bg-[#F1F2F3] border-[#E7E8EA]'
 : 'bg-[#FEF2F2] border-[#FECACA]'
 }`}>
 <FaCalendarAlt className={`text-[11px] sm:text-sm ${
 booking.status === 'completed' ? 'text-[#059669]' :
 booking.status === 'cancelled' ? 'text-[#62666D]' : 'text-[#DC2626]'
 }`} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h4 className="text-[#111214] font-bold text-xs sm:text-sm truncate">
 {booking.customer?.full_name || 'عميل'}
 </h4>
 {statusBadge(booking.status)}
 {booking.service && (
 <span className="text-[10px] text-[#62666D] hidden sm:inline">
 {booking.service.name}
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-[#62666D]">
 {booking.customer?.phone && (
 <span className="flex items-center gap-1">
 <FaPhone className="text-[#059669]/60 text-[10px]" />
 {booking.customer.phone}
 </span>
 )}
 {booking.vehicle && (
 <>
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1">
 <FaCar className="text-[#62666D] text-[10px]" />
 {booking.vehicle.make} {booking.vehicle.model}
 </span>
 </>
 )}
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1">
 <FaClock className="text-[#62666D] text-[10px]" />
 {new Date(booking.created_at).toLocaleDateString('ar-SA')}
 </span>
 </div>
 </div>
 </div>

 <div className="flex gap-1.5 sm:gap-2 shrink-0 mr-2 sm:mr-4">
 <button
 onClick={() => handleViewBooking(booking)}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaEye className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">عرض</span>
 </button>
 </div>
 </div>
 ))}
 </div>

 {pagination && pagination.total > 0 && (
 <div className="flex items-center justify-between mt-6 px-1">
 <span className="text-xs text-[#62666D]">
 {pagination.total} نتيجة — صفحة {pagination.page} من {pagination.totalPages}
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="px-3 py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
 >
 <FaChevronRight className="text-[10px]" />
 السابق
 </button>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page >= totalPages}
 className="px-3 py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
 >
 التالي
 <FaChevronLeft className="text-[10px]" />
 </button>
 </div>
 </div>
 )}
 </>
 )}

 {viewingBooking && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingBooking(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaCalendarAlt className="text-[#DC2626] text-sm" />
 تفاصيل الحجز
 </h3>
 <button onClick={() => setViewingBooking(null)} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>

 {loadingDetail ? (
 <div className="flex items-center justify-center py-8">
 <div className="w-8 h-8 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الحالة:</span>
 {statusBadge(viewingBooking.status)}
 </div>

 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">بيانات العميل</h4>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الاسم:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.customer?.full_name || '---'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الجوال:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.customer?.phone || '---'}</span>
 </div>
 {viewingBooking.customer?.email && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">البريد:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.customer.email}</span>
 </div>
 )}
 </div>
 </div>

 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">بيانات السيارة</h4>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">المركبة:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.vehicle?.make} {viewingBooking.vehicle?.model}</span>
 </div>
 {viewingBooking.vehicle?.year && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">السنة:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.vehicle.year}</span>
 </div>
 )}
 {viewingBooking.vehicle?.plate_number && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">رقم اللوحة:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.vehicle.plate_number}</span>
 </div>
 )}
 </div>
 </div>

 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">تفاصيل الحجز</h4>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الخدمة:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.service?.name || '---'}</span>
 </div>
 {viewingBooking.service?.base_price && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">السعر:</span>
 <span className="text-[#DC2626] font-bold">{viewingBooking.service.base_price.toLocaleString('ar-SA')} ر.س</span>
 </div>
 )}
 {viewingBooking.preferred_date && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">التاريخ المفضل:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingBooking.preferred_date).toLocaleDateString('ar-SA')}</span>
 </div>
 )}
 {viewingBooking.preferred_time && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الوقت المفضل:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.preferred_time}</span>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">المصدر:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.source === 'online' ? 'أونلاين' : viewingBooking.source || '---'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">تاريخ الإنشاء:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingBooking.created_at).toLocaleDateString('ar-SA')}</span>
 </div>
 {viewingBooking.customer_notes && (
 <div className="text-sm">
 <span className="text-[#62666D]">ملاحظات العميل:</span>
 <p className="text-[#111214] mt-1">{viewingBooking.customer_notes}</p>
 </div>
 )}
 </div>
 </div>

 {canUpdate && VALID_TRANSITIONS[viewingBooking.status]?.length > 0 && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">تحديث الحالة</h4>
 <div className="flex flex-wrap gap-2">
 {VALID_TRANSITIONS[viewingBooking.status].map((nextStatus) => {
 const config = STATUS_CONFIG[nextStatus]
 return (
 <button
 key={nextStatus}
 onClick={() => handleStatusUpdate(viewingBooking.id, nextStatus)}
 disabled={updatingStatus === viewingBooking.id}
 className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105 disabled:opacity-50 ${config.bg} ${config.color}`}
 >
 {updatingStatus === viewingBooking.id ? (
 <FaSpinner className="animate-spin inline" />
 ) : null}
 {' '}→ {config.label}
 </button>
 )
 })}
 </div>
 </div>
 )}

 {viewingBooking.status_history && viewingBooking.status_history.length > 0 && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">سجل التغييرات</h4>
 <div className="space-y-2">
 {viewingBooking.status_history.map((h) => (
 <div key={h.id} className="flex items-center gap-2 text-xs">
 <span className="text-[#62666D]">{new Date(h.created_at).toLocaleDateString('ar-SA')}</span>
 <span className="text-[#62666D]">→</span>
 {statusBadge(h.new_status)}
 {h.notes && <span className="text-[#62666D]">({h.notes})</span>}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )
}
