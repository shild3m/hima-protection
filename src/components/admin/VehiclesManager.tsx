'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { VehicleForm } from '@/components/admin/VehicleForm'
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
 FaHashtag,
 FaPalette,
 FaChevronRight,
 FaChevronLeft,
 FaTrash,
} from 'react-icons/fa'

interface Vehicle {
 id: string
 customer_id: string
 make: string
 model: string
 year: number | null
 color: string | null
 plate_number: string | null
 vin: string | null
 notes: string | null
 is_active: boolean
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

export default function VehiclesManager() {
 const { hasPermission } = useAuth()
 const [vehicles, setVehicles] = useState<Vehicle[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
 const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null)
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
 const result = await getVehicles(debouncedSearch, page)
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
 }, [debouncedSearch, page])

 useEffect(() => {
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
 <p className="font-bold">لا يوجد مركبات مسجلة بعد</p>
 <p className="text-xs text-[#62666D] mt-1">أضف مركبة جديدة من الزر أعلاه</p>
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
 </div>
 </div>
 </div>

 <div className="flex gap-1.5 sm:gap-2 shrink-0 mr-2 sm:mr-4">
 <button
 onClick={() => setViewingVehicle(viewingVehicle?.id === vehicle.id ? null : vehicle)}
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
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingVehicle(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaCar className="text-[#DC2626] text-sm" />
 تفاصيل المركبة
 </h3>
 <button onClick={() => setViewingVehicle(null)} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>
 <div className="space-y-3">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">العميل:</span>
 <span className="text-[#111214] font-bold">{viewingVehicle.customer?.full_name || '---'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">رقم جوال العميل:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingVehicle.customer?.phone || '---'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">شركة الصنع:</span>
 <span className="text-[#111214] font-bold">{viewingVehicle.make}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الموديل:</span>
 <span className="text-[#111214] font-bold">{viewingVehicle.model}</span>
 </div>
 {viewingVehicle.year && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">السنة:</span>
 <span className="text-[#111214] font-bold">{viewingVehicle.year}</span>
 </div>
 )}
 {viewingVehicle.color && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">اللون:</span>
 <span className="text-[#111214] font-bold">{viewingVehicle.color}</span>
 </div>
 )}
 {viewingVehicle.plate_number && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">رقم اللوحة:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingVehicle.plate_number}</span>
 </div>
 )}
 {viewingVehicle.vin && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">رقم الهيكل (VIN):</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingVehicle.vin}</span>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الحالة:</span>
 <span className={`font-bold ${viewingVehicle.is_active ? 'text-[#059669]' : 'text-[#62666D]'}`}>
 {viewingVehicle.is_active ? 'نشط' : 'معطّل'}
 </span>
 </div>
 {viewingVehicle.notes && (
 <div className="text-sm">
 <span className="text-[#62666D]">ملاحظات:</span>
 <p className="text-[#111214] mt-1">{viewingVehicle.notes}</p>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">تاريخ الإنشاء:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingVehicle.created_at).toLocaleDateString('en-GB')}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">آخر تحديث:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingVehicle.updated_at).toLocaleDateString('en-GB')}</span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
