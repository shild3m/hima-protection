'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { VehicleForm } from '@/components/admin/VehicleForm'
import type { VehicleHistoryRow, VehicleHistorySummary } from '@/app/actions/vehicles'
import SaudiPlate from '@/components/ui/SaudiPlate'
import {
 FaCar,
 FaSearch,
 FaPlus,
 FaPen,
 FaEye,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaUser,
 FaPhone,
 FaCalendarAlt,
 FaHashtag,
 FaPalette,
 FaChevronRight,
 FaChevronLeft,
 FaTrash,
 FaHistory,
} from 'react-icons/fa'

interface Vehicle {
id: string
  customer_id: string
  make: string
  model: string
  size: string
  year: number | null
 color: string | null
 plate_number: string | null
 vin: string | null
 notes: string | null
 is_active: boolean
 status: 'tentative' | 'confirmed'
 previous_plates?: string[] | null
 created_at: string
 updated_at: string
 customer?: {
 id: string
 full_name: string
 phone: string
 }
}

interface Pagination {
 page: number
 pageSize: number
 total: number
 totalPages: number
}

type Notification = { type: 'success' | 'error'; message: string } | null

const BOOKING_STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  confirmed: 'مؤكد',
  arrived: 'وصل',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
}

const fmtIso = (iso?: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'

export default function VehiclesManager({ initialVehicles, initialPagination }: {
 initialVehicles?: Vehicle[]
 initialPagination?: Pagination
} = {}) {
 const { hasPermission } = useAuth()
 const skipInitialFetch = useRef(initialVehicles !== undefined)
 const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles ?? [])
 const [loading, setLoading] = useState(initialVehicles === undefined)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState<'all' | 'tentative' | 'confirmed'>('confirmed')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(initialPagination ?? null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
 const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
 const [vehicleHistory, setVehicleHistory] = useState<{ rows: VehicleHistoryRow[]; summary: VehicleHistorySummary } | null>(null)
 const [historyLoading, setHistoryLoading] = useState(false)
 const [historyError, setHistoryError] = useState('')
 const [togglingId, setTogglingId] = useState<string | null>(null)
 const [actionLoading, setActionLoading] = useState<string | null>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const canCreate = hasPermission('vehicles', 'create')
 const canUpdate = hasPermission('vehicles', 'update')

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

 const fetchVehicles = useCallback(async () => {
 try {
 setLoading(true)
 const { getVehicles } = await import('@/app/actions/vehicles')
 const result = await getVehicles(debouncedSearch, page, undefined, statusFilter)
 if (result.success) {
 setVehicles(result.data)
 if (result.pagination) {
 setPagination(result.pagination)
 }
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب المركبات' })
 } finally {
 setLoading(false)
 }
 }, [debouncedSearch, page, statusFilter])

 useEffect(() => {
 if (skipInitialFetch.current) {
   skipInitialFetch.current = false
   return
 }
 fetchVehicles()
 }, [fetchVehicles])

 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const handleToggle = async (id: string) => {
 setTogglingId(id)
 try {
 const { toggleVehicleStatus } = await import('@/app/actions/vehicles')
 const result = await toggleVehicleStatus(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم تغيير الحالة بنجاح' })
 fetchVehicles()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setTogglingId(null)
 }
 }

 const handleDeleteVehicle = async (id: string) => {
 if (!window.confirm('هل أنت متأكد من حذف هذه المركبة؟ لا يمكن التراجع عن هذا الإجراء.')) return
 setActionLoading(id)
 try {
 const { softDeleteVehicle } = await import('@/app/actions/crm')
 const result = await softDeleteVehicle(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم حذف المركبة بنجاح' })
 fetchVehicles()
 } else {
 setNotification({ type: 'error', message: result.error || 'حدث خطأ غير متوقع' })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setActionLoading(null)
 }
 }

 // Service history loads whenever a vehicle panel (the eye) is opened.
 // Loading/clearing happens in the click handler (not in the effect) so the
 // effect only starts the fetch and writes state from its async callbacks.
 useEffect(() => {
   const vehicleId = viewingVehicle?.id
   if (!vehicleId) return
   let cancelled = false
   ;(async () => {
     try {
       const { getVehicleServiceHistory } = await import('@/app/actions/vehicles')
       const res = await getVehicleServiceHistory(vehicleId)
       if (cancelled) return
       if (res.success) setVehicleHistory(res.data)
       else setHistoryError(res.error)
     } catch {
       if (!cancelled) setHistoryError('تعذر جلب سجل الخدمات')
     } finally {
       if (!cancelled) setHistoryLoading(false)
     }
   })()
   return () => { cancelled = true }
 }, [viewingVehicle?.id])

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
 {notification.type === 'success' ? <FaSpinner /> : <FaExclamationTriangle />}
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
 <FaCar className="text-[#DC2626] text-sm" />
 </div>
 إدارة المركبات
 </h1>
 <p className="text-[#62666D] text-sm mt-1 mr-11">إضافة وتعديل وإدارة مركبات العملاء</p>
 </div>
 {canCreate && (
 <button
 onClick={() => { setShowForm(!showForm); setEditingVehicle(null) }}
 className={`font-bold text-sm transition-all rounded-xl px-5 py-2.5 flex items-center gap-2 ${
 showForm || editingVehicle
 ? 'bg-white/[0.05] text-[#111214] hover:bg-[#F1F2F3] border border-[#E7E8EA]'
 : 'bg-gradient-to-l from-red-600 to-red-700 text-white hover:shadow-lg hover:shadow-red-900/20 border-0'
 }`}
 >
 {showForm || editingVehicle ? <FaTimes className="text-xs" /> : <FaPlus className="text-xs" />}
 {showForm || editingVehicle ? 'إلغاء' : 'إضافة مركبة جديدة'}
 </button>
 )}
 </div>

 {(showForm || editingVehicle) && (
 <div className="mb-6 animate-fadeIn">
 <VehicleForm
 key={editingVehicle?.id || 'new'}
 initialData={editingVehicle}
 onCancel={() => { setEditingVehicle(null); setShowForm(false) }}
 onSaved={() => { setEditingVehicle(null); setShowForm(false); fetchVehicles(); setNotification({ type: 'success', message: editingVehicle ? 'تم تحديث المركبة بنجاح' : 'تم إنشاء المركبة بنجاح' }) }}
 />
 </div>
 )}

 <div className="mb-4">
 <div className="relative max-w-md">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالماركة أو الموديل أو رقم اللوحة..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-3 text-[#111214] text-[16px] focus:outline-none focus:border-[#FECACA] placeholder:text-[16px] placeholder:text-[#62666D]"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#111214] transition">
 <FaTimes className="text-xs" />
 </button>
 )}
 </div>
 </div>

 <div className="mb-4 flex flex-wrap items-center gap-2">
   {([
     { id: 'confirmed', label: 'المؤكدة', hint: 'السيارات التي خُدمت فعليًا' },
     { id: 'tentative', label: 'المؤقتة', hint: 'سُجّلت بحجز ما زال قيد التنفيذ' },
     { id: 'all', label: 'الكل', hint: 'كل السيارات' },
   ] as const).map(filter => (
     <button
       key={filter.id}
       title={filter.hint}
       onClick={() => { setStatusFilter(filter.id); setPage(1) }}
       className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
         statusFilter === filter.id
           ? 'bg-[#111214] text-white border-[#111214]'
           : 'bg-white text-[#62666D] border-[#E7E8EA] hover:border-[#111214] hover:text-[#111214]'
       }`}
     >
       {filter.label}
     </button>
   ))}
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <div className="flex flex-col items-center gap-4">
 <div className="w-10 h-10 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 <span className="text-sm text-[#62666D]">جاري التحميل...</span>
 </div>
 </div>
 ) : vehicles.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-[#62666D]">
 <div className="w-16 h-16 rounded-2xl bg-[#F7F7F5] border border-[#E7E8EA] flex items-center justify-center mb-4">
 <FaBoxOpen className="text-2xl text-[#62666D]" />
 </div>
 <p className="font-bold">
   {statusFilter === 'tentative'
     ? 'لا توجد سيارات مؤقتة'
     : statusFilter === 'confirmed'
       ? 'لا توجد سيارات مؤكدة بعد'
       : 'لا يوجد مركبات مسجلة بعد'}
 </p>
 <p className="text-xs text-[#62666D] mt-1">
   {statusFilter === 'confirmed'
     ? 'تصير السيارة مؤكدة عند اكتمال حجزها'
     : 'أضف مركبة جديدة من الزر أعلاه'}
 </p>
 </div>
 ) : (
 <>
 <div className="grid gap-3">
 {vehicles.map((vehicle) => (
 <div
 key={vehicle.id}
 className="group bg-white border border-[#E7E8EA] hover:border-[#E7E8EA] rounded-xl p-3 sm:p-4 flex items-center justify-between transition-all duration-200"
 >
 <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
 <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border ${
 vehicle.is_active
 ? 'bg-[#FEF2F2] border-[#FECACA]'
 : 'bg-[#F7F7F5] border-[#E7E8EA]'
 }`}>
 <FaCar className={`text-[11px] sm:text-sm ${vehicle.is_active ? 'text-[#DC2626]' : 'text-[#62666D]'}`} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h4 className="text-[#111214] font-bold text-xs sm:text-sm truncate">
 {vehicle.make} {vehicle.model}
 </h4>
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
 vehicle.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 {vehicle.is_active ? 'نشط' : 'معطّل'}
 </span>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
   vehicle.status === 'tentative'
     ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
     : 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
 }`}>
 {vehicle.status === 'tentative' ? 'مؤقتة' : 'مؤكدة'}
 </span>
 </div>
 <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-[#62666D]">
 {vehicle.year && (
 <span className="flex items-center gap-1">
 <FaHashtag className="text-[#62666D] text-[10px]" />
 {vehicle.year}
 </span>
 )}
 {vehicle.color && (
 <>
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1">
 <FaPalette className="text-[#62666D] text-[10px]" />
 {vehicle.color}
 </span>
 </>
 )}
 {vehicle.plate_number && (
 <>
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1" dir="ltr">
 {vehicle.plate_number}
 </span>
 </>
 )}
{vehicle.customer && (
  <>
  <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
  <span className="flex items-center gap-1">
  <FaUser className="text-[#62666D] text-[10px]" />
  {vehicle.customer.full_name}
  </span>
  </>
  )}
  <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
  vehicle.size === 'small'
  ? 'bg-[#EFF6FF] border-[#BFDBFE] text-blue-300'
  : vehicle.size === 'large'
  ? 'bg-[#FFF7ED] border-[#FDBA74] text-orange-300'
  : 'bg-[#ECFDF5] border-[#A7F3D0] text-green-300'
  }`}>
  {vehicle.size === 'small' ? 'صغير' : vehicle.size === 'large' ? 'كبير' : 'متوسط'}
  </span>
  </div>
 </div>
 </div>

 <div className="flex gap-1.5 sm:gap-2 shrink-0 mr-2 sm:mr-4">
 <button
 onClick={() => {
   const opening = viewingVehicle?.id !== vehicle.id
   setViewingVehicle(opening ? vehicle : null)
   setVehicleHistory(null)
   setHistoryError('')
   setHistoryLoading(opening)
 }}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaEye className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">عرض</span>
 </button>
 {canUpdate && (
 <>
 <button
 onClick={() => { setEditingVehicle(vehicle); setShowForm(false) }}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#EFF6FF] hover:bg-blue-500/20 border border-[#BFDBFE] text-blue-300 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaPen className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">تعديل</span>
 </button>
 {hasPermission('vehicles', 'delete') && (
 <button
 onClick={() => handleDeleteVehicle(vehicle.id)}
 disabled={actionLoading === vehicle.id}
 className="px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1"
 >
 {actionLoading === vehicle.id ? (
 <FaSpinner className="text-[10px] animate-spin" />
 ) : (
 <FaTrash className="text-[10px]" />
 )}
 </button>
 )}
 <button
 onClick={() => handleToggle(vehicle.id)}
 disabled={togglingId === vehicle.id}
 className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1 disabled:opacity-50 ${
 vehicle.is_active
 ? 'bg-[#FFFBEB] hover:bg-[#FFFBEB] border border-[#FDE68A] text-amber-300'
 : 'bg-[#ECFDF5] hover:bg-[#ECFDF5] border border-[#A7F3D0] text-green-300'
 }`}
 >
 {togglingId === vehicle.id ? (
 <FaSpinner className="text-[9px] sm:text-[10px] animate-spin" />
 ) : vehicle.is_active ? (
 <FaTimes className="text-[9px] sm:text-[10px]" />
 ) : (
 <FaEye className="text-[9px] sm:text-[10px]" />
 )}
 <span className="hidden sm:inline">{vehicle.is_active ? 'تعطيل' : 'تفعيل'}</span>
 </button>
 </>
 )}
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

 {viewingVehicle && (
 <div
 role="presentation"
 className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
 onClick={() => setViewingVehicle(null)}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-label="تفاصيل المركبة"
 className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E7E8EA] bg-white/95 backdrop-blur">
 <div className="flex items-center gap-3 min-w-0">
 <span className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <FaCar className="text-[#DC2626] text-sm" />
 </span>
 <div className="min-w-0">
 <h3 className="text-base font-bold text-[#111214] leading-tight">تفاصيل المركبة</h3>
 <p className="text-[10px] text-[#9A9DA3] font-medium mt-0.5">بيانات المركبة ومالكها</p>
 </div>
 </div>
 <button
 onClick={() => setViewingVehicle(null)}
 aria-label="إغلاق"
 className="w-8 h-8 rounded-lg text-[#62666D] hover:text-[#111214] hover:bg-[#F1F2F3] flex items-center justify-center transition shrink-0"
 >
 <FaTimes className="text-sm" />
 </button>
 </div>

 {/* Content */}
 <div className="px-5 sm:px-6 py-5 space-y-6">
 {/* Profile */}
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <FaCar className="text-[#DC2626] text-xl" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-x-2.5 gap-y-2 flex-wrap">
 <h4 className="text-lg font-black text-[#111214] truncate">
 {[viewingVehicle.make, viewingVehicle.model].filter(Boolean).join(' ') || 'مركبة بدون اسم'}
 </h4>
 <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
 viewingVehicle.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${viewingVehicle.is_active ? 'bg-[#059669]' : 'bg-[#9A9DA3]'}`} />
 {viewingVehicle.is_active ? 'نشطة' : 'معطّلة'}
 </span>
 </div>
 <p className="text-[11px] text-[#62666D] font-medium mt-1">
 مسجلة منذ {new Date(viewingVehicle.created_at).toLocaleDateString('en-GB')}
 </p>
 </div>
 </div>

 {!viewingVehicle.is_active && (
 <div className="flex items-start gap-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-3 text-[11px] font-bold text-[#B45309]">
 <FaExclamationTriangle className="text-[10px] mt-0.5 shrink-0" />
 <span>هذه المركبة معطّلة حاليًا.</span>
 </div>
 )}

 {/* Plate */}
 {viewingVehicle.plate_number && (
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-4 py-4">
 <p className="text-[10px] font-bold text-[#9A9DA3] mb-3 text-center">رقم اللوحة</p>
 <div className="flex justify-center">
 <SaudiPlate plate={viewingVehicle.plate_number} />
 </div>
 {(viewingVehicle.previous_plates || []).length > 0 && (
 <p className="text-[10px] font-bold text-[#9A9DA3] text-center mt-3" dir="rtl">
 لوحات سابقة: <span className="text-[#62666D]" dir="ltr">{(viewingVehicle.previous_plates || []).join(' · ')}</span>
 </p>
 )}
 </div>
 )}

 {/* Owner and specs */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaUser className="text-[#7C3AED] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">العميل</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5">{viewingVehicle.customer?.full_name || '---'}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaPhone className="text-[#059669] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">رقم جوال العميل</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingVehicle.customer?.phone || '---'}</p>
 </div>
 </div>

 {viewingVehicle.year && (
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaCalendarAlt className="text-[#7C3AED] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">السنة</p>
 <p className="text-xs font-bold text-[#111214] mt-0.5">{viewingVehicle.year}</p>
 </div>
 </div>
 )}

 {viewingVehicle.color && (
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaPalette className="text-[#2563EB] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">اللون</p>
 <p className="text-xs font-bold text-[#111214] mt-0.5">{viewingVehicle.color}</p>
 </div>
 </div>
 )}

 {viewingVehicle.vin && (
 <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaHashtag className="text-[#B45309] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">الرقم التسلسلي</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingVehicle.vin}</p>
 </div>
 </div>
 )}
 </div>

 {/* Service history */}
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">سجل الخدمات</h5>
 <FaHistory className="text-[10px] text-[#9A9DA3]" />
 </div>

 {historyLoading ? (
 <div className="flex items-center gap-2 text-[11px] font-bold text-[#62666D] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-4">
 <FaSpinner className="animate-spin text-[#DC2626]" />
 جاري تحميل السجل...
 </div>
 ) : historyError ? (
 <div className="text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-3">
 {historyError}
 </div>
 ) : !vehicleHistory || vehicleHistory.rows.length === 0 ? (
 <div className="text-[11px] font-bold text-[#62666D] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-4">
 لا توجد خدمات مسجلة على هذه السيارة بعد
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3 py-2.5">
 <p className="text-[10px] font-bold text-[#9A9DA3]">الخدمات</p>
 <p className="text-sm font-black text-[#111214] mt-0.5">
 {vehicleHistory.summary.completed} مكتملة
 <span className="text-[10px] font-bold text-[#9A9DA3]"> من {vehicleHistory.summary.bookings}</span>
 </p>
 </div>
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3 py-2.5">
 <p className="text-[10px] font-bold text-[#9A9DA3]">إجمالي / المدفوع</p>
 <p className="text-sm font-black text-[#111214] mt-0.5" dir="ltr">
 {vehicleHistory.summary.total_amount.toLocaleString('en-US')} / {vehicleHistory.summary.total_paid.toLocaleString('en-US')} ر.س
 </p>
 </div>
 <div className={`rounded-xl border px-3 py-2.5 ${
 vehicleHistory.summary.warranty.state === 'active'
 ? 'bg-[#ECFDF5] border-[#A7F3D0]'
 : vehicleHistory.summary.warranty.state === 'expired'
 ? 'bg-[#F7F7F5] border-[#E7E8EA]'
 : 'bg-[#FFFBEB] border-[#FDE68A]'
 }`}>
 <p className="text-[10px] font-bold text-[#9A9DA3]">الضمان</p>
 <p className={`text-xs font-black mt-0.5 ${
 vehicleHistory.summary.warranty.state === 'active' ? 'text-[#059669]' : 'text-[#62666D]'
 }`}>
 {vehicleHistory.summary.warranty.label}
 </p>
 </div>
 </div>

 <div className="space-y-2.5">
 {vehicleHistory.rows.map(row => (
 <div key={row.booking_id} className="rounded-xl border border-[#E7E8EA] bg-white px-3.5 py-3">
 <div className="flex items-center justify-between gap-2 mb-2">
 <span className="text-[11px] font-black text-[#2563EB]" dir="ltr">#{row.reference}</span>
 <div className="flex items-center gap-2">
 <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
 row.status === 'completed'
 ? 'text-[#059669] bg-[#ECFDF5] border-[#A7F3D0]'
 : row.status === 'cancelled' || row.status === 'no_show'
 ? 'text-[#62666D] bg-[#F7F7F5] border-[#E7E8EA]'
 : 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]'
 }`}>
 {BOOKING_STATUS_LABELS[row.status] || row.status}
 </span>
 <span className="text-[10px] font-bold text-[#62666D]">{fmtIso(row.date)}</span>
 </div>
 </div>

 <ul className="space-y-1">
 {row.services.map((s, idx) => (
 <li key={idx} className="flex items-center justify-between gap-2 text-[11px]">
 <span className="text-[#4B4F55] font-bold truncate">
 {s.name}{s.qty > 1 ? ` ×${s.qty}` : ''}
 </span>
 <span className="text-[#111214] font-black shrink-0" dir="ltr">
 {s.total.toLocaleString('en-US')} ر.س
 </span>
 </li>
 ))}
 </ul>

 <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#F1F2F3]">
 <span className="text-[10px] font-bold text-[#9A9DA3]">
 {row.invoice_number ? `فاتورة ${row.invoice_number}` : 'بدون فاتورة'}
 </span>
 <span className="text-[11px] font-black text-[#111214]" dir="ltr">
 {row.amount.toLocaleString('en-US')} ر.س
 </span>
 </div>

 {row.warranty_start && row.warranty_end && (
 <p className="text-[10px] font-bold text-[#059669] mt-1.5">
 ضمان {row.warranty_label} — من {fmtIso(row.warranty_start)} إلى {fmtIso(row.warranty_end)}
 </p>
 )}
 </div>
 ))}
 </div>
 </>
 )}
 </div>

 {viewingVehicle.notes && (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">ملاحظات</h5>
 </div>
 <p className="text-xs leading-relaxed text-[#4B4F55] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-3 whitespace-pre-wrap break-words">
 {viewingVehicle.notes}
 </p>
 </div>
 )}

 {/* Dates */}
 <div className="border-t border-[#E7E8EA] pt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[10px] font-medium text-[#9A9DA3]">
 <span>
 تاريخ الإنشاء: <span className="font-bold text-[#62666D]">{new Date(viewingVehicle.created_at).toLocaleDateString('en-GB')}</span>
 </span>
 <span>
 آخر تحديث: <span className="font-bold text-[#62666D]">{new Date(viewingVehicle.updated_at).toLocaleDateString('en-GB')}</span>
 </span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
