'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { CustomerForm } from '@/components/admin/CustomerForm'
import SaudiPlate from '@/components/ui/SaudiPlate'
import {
 FaUsers,
 FaSearch,
 FaPlus,
 FaPen,
 FaEye,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaCar,
 FaPhone,
 FaEnvelope,
 FaCalendarAlt,
 FaGlobe,
 FaShareAlt,
 FaWalking,
 FaHeadset,
 FaChevronRight,
 FaChevronLeft,
 FaTrash,
} from 'react-icons/fa'

interface Customer {
 id: string
 full_name: string
 phone: string
 email: string | null
 source: string | null
 referred_by_dealer_id: string | null
 notes: string | null
 is_active: boolean
 created_at: string
 updated_at: string
}

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
}

interface Pagination {
 page: number
 pageSize: number
 total: number
 totalPages: number
}

type Notification = { type: 'success' | 'error'; message: string } | null

const sourceConfig: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
 walk_in: { label: 'حضور مباشر', icon: <FaWalking className="text-[9px]" />, class: 'bg-[#EFF6FF] text-blue-700 border-[#BFDBFE]' },
 referral: { label: 'إحالة', icon: <FaShareAlt className="text-[9px]" />, class: 'bg-[#FAF5FF] text-purple-700 border-[#DDD6FE]' },
 online: { label: 'أونلاين', icon: <FaGlobe className="text-[9px]" />, class: 'bg-[#ECFDF5] text-emerald-700 border-[#A7F3D0]' },
 social: { label: 'تواصل اجتماعي', icon: <FaHeadset className="text-[9px]" />, class: 'bg-[#FFFBEB] text-amber-700 border-[#FDE68A]' },
 phone: { label: 'هاتف', icon: <FaPhone className="text-[9px]" />, class: 'bg-[#ECFEFF] text-cyan-700 border-[#A5F3FC]' },
}

export default function CustomersManager({ initialCustomers, initialPagination }: {
 initialCustomers?: Customer[]
 initialPagination?: Pagination
} = {}) {
 const { hasPermission } = useAuth()
 const skipInitialFetch = useRef(initialCustomers !== undefined)
 const [customers, setCustomers] = useState<Customer[]>(initialCustomers ?? [])
 const [loading, setLoading] = useState(initialCustomers === undefined)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(initialPagination ?? null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
 const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
 const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([])
 const [loadingVehicles, setLoadingVehicles] = useState(false)
 const [togglingId, setTogglingId] = useState<string | null>(null)
 const [actionLoading, setActionLoading] = useState<string | null>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canCreate = hasPermission('customers', 'create')
  const canUpdate = hasPermission('customers', 'update')

  useEffect(() => {
    if (canCreate && window.location.search.includes('create=true')) {
      setShowForm(true)
    }
  }, [canCreate])

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

 const fetchCustomers = useCallback(async () => {
 try {
 setLoading(true)
 const { getCustomers } = await import('@/app/actions/customers')
 const result = await getCustomers(debouncedSearch, page)
 if (result.success) {
 setCustomers(result.data)
 if (result.pagination) {
 setPagination(result.pagination)
 }
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب العملاء' })
 } finally {
 setLoading(false)
 }
 }, [debouncedSearch, page])

 useEffect(() => {
 if (skipInitialFetch.current) {
   skipInitialFetch.current = false
   return
 }
 fetchCustomers()
 }, [fetchCustomers])

 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const handleToggle = async (id: string) => {
 setTogglingId(id)
 try {
 const { toggleCustomerStatus } = await import('@/app/actions/customers')
 const result = await toggleCustomerStatus(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم تغيير الحالة بنجاح' })
 fetchCustomers()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
  } finally {
    setTogglingId(null)
  }
  }

  const handleDeleteCustomer = async (id: string) => {
  if (!window.confirm('هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')) return
  setActionLoading(id)
  try {
    const { softDeleteCustomer } = await import('@/app/actions/crm')
    const result = await softDeleteCustomer(id)
    if (result.success) {
    setNotification({ type: 'success', message: 'تم حذف العميل بنجاح' })
    fetchCustomers()
    } else {
    setNotification({ type: 'error', message: result.error || 'حدث خطأ غير متوقع' })
    }
  } catch {
    setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
  } finally {
    setActionLoading(null)
  }
  }

 const handleViewCustomer = async (customer: Customer) => {
 setViewingCustomer(customer)
 setLoadingVehicles(true)
 setCustomerVehicles([])
 try {
 const { getCustomerVehicles } = await import('@/app/actions/customers')
 const result = await getCustomerVehicles(customer.id)
 if (result.success) {
 setCustomerVehicles(result.data)
 }
 } catch {
 } finally {
 setLoadingVehicles(false)
 }
 }

 const sourceBadge = (source: string | null) => {
 if (!source) return null
 const c = sourceConfig[source]
 if (!c) return null
 return (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${c.class}`}>
 {c.icon}
 {c.label}
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
 <FaUsers className="text-[#DC2626] text-sm" />
 </div>
 إدارة العملاء
 </h1>
 <p className="text-[#62666D] text-sm mt-1 mr-11">إضافة وتعديل وإدارة بيانات العملاء</p>
 </div>
 {canCreate && (
 <button
 onClick={() => { setShowForm(!showForm); setEditingCustomer(null) }}
 className={`font-bold text-sm transition-all rounded-xl px-5 py-2.5 flex items-center gap-2 ${
 showForm || editingCustomer
 ? 'bg-white/[0.05] text-[#111214] hover:bg-[#F1F2F3] border border-[#E7E8EA]'
 : 'bg-gradient-to-l from-red-600 to-red-700 text-white hover:shadow-lg hover:shadow-red-900/20 border-0'
 }`}
 >
 {showForm || editingCustomer ? <FaTimes className="text-xs" /> : <FaPlus className="text-xs" />}
 {showForm || editingCustomer ? 'إلغاء' : 'إضافة عميل جديد'}
 </button>
 )}
 </div>

 {(showForm || editingCustomer) && (
 <div className="mb-6 animate-fadeIn">
 <CustomerForm
 key={editingCustomer?.id || 'new'}
 initialData={editingCustomer}
 onCancel={() => { setEditingCustomer(null); setShowForm(false) }}
 onSaved={() => { setEditingCustomer(null); setShowForm(false); fetchCustomers(); setNotification({ type: 'success', message: editingCustomer ? 'تم تحديث العميل بنجاح' : 'تم إنشاء العميل بنجاح' }) }}
 />
 </div>
 )}

 <div className="mb-4">
 <div className="relative max-w-md">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو رقم الجوال..."
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
 ) : customers.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-[#62666D]">
 <div className="w-16 h-16 rounded-2xl bg-[#F7F7F5] border border-[#E7E8EA] flex items-center justify-center mb-4">
 <FaBoxOpen className="text-2xl text-[#62666D]" />
 </div>
 <p className="font-bold">لا يوجد عملاء مسجلين بعد</p>
 <p className="text-xs text-[#62666D] mt-1">أضف عميل جديد من الزر أعلاه</p>
 </div>
 ) : (
 <>
 <div className="grid gap-3">
 {customers.map((customer) => (
 <div
 key={customer.id}
 className="group bg-white border border-[#E7E8EA] hover:border-[#E7E8EA] rounded-xl p-3 sm:p-4 flex items-center justify-between transition-all duration-200"
 >
 <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
 <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border ${
 customer.is_active
 ? 'bg-[#FEF2F2] border-[#FECACA]'
 : 'bg-[#F7F7F5] border-[#E7E8EA]'
 }`}>
 <FaUsers className={`text-[11px] sm:text-sm ${customer.is_active ? 'text-[#DC2626]' : 'text-[#62666D]'}`} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <h4 className="text-[#111214] font-bold text-xs sm:text-sm truncate">{customer.full_name}</h4>
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
 customer.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 {customer.is_active ? 'نشط' : 'معطّل'}
 </span>
 {sourceBadge(customer.source)}
 </div>
 <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-[#62666D]">
 <span className="flex items-center gap-1">
 <FaPhone className="text-[#059669]/60 text-[10px]" />
 {customer.phone}
 </span>
 {customer.email && (
 <>
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1 truncate max-w-[180px]">
 <FaEnvelope className="text-[#2563EB]/60 text-[10px]" />
 {customer.email}
 </span>
 </>
 )}
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1">
 <FaCalendarAlt className="text-[#7C3AED]/60 text-[10px]" />
 {new Date(customer.created_at).toLocaleDateString('en-GB')}
 </span>
 </div>
 </div>
 </div>

 <div className="flex gap-1.5 sm:gap-2 shrink-0 mr-2 sm:mr-4">
 {canUpdate && (
 <>
 <button
 onClick={() => { setEditingCustomer(customer); setShowForm(false) }}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#EFF6FF] hover:bg-blue-500/20 border border-[#BFDBFE] text-blue-300 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaPen className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">تعديل</span>
 </button>
 </>
 )}
 {hasPermission('customers', 'delete') && (
 <button
 onClick={() => handleDeleteCustomer(customer.id)}
 disabled={actionLoading === customer.id}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#FEF2F2] hover:bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-lg text-[10px] sm:text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1 hover:scale-105"
 >
 {actionLoading === customer.id ? (
 <FaSpinner className="text-[9px] sm:text-[10px] animate-spin" />
 ) : (
 <FaTrash className="text-[9px] sm:text-[10px]" />
 )}
 <span className="hidden sm:inline">حذف</span>
 </button>
 )}
 <button
 onClick={() => handleViewCustomer(viewingCustomer?.id === customer.id ? null as any : customer)}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaEye className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">عرض</span>
 </button>
 {canUpdate && (
 <button
 onClick={() => handleToggle(customer.id)}
 disabled={togglingId === customer.id}
 className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1 disabled:opacity-50 ${
 customer.is_active
 ? 'bg-[#FFFBEB] hover:bg-[#FFFBEB] border border-[#FDE68A] text-amber-300'
 : 'bg-[#ECFDF5] hover:bg-[#ECFDF5] border border-[#A7F3D0] text-green-300'
 }`}
 >
 {togglingId === customer.id ? (
 <FaSpinner className="text-[9px] sm:text-[10px] animate-spin" />
 ) : customer.is_active ? (
 <FaTimes className="text-[9px] sm:text-[10px]" />
 ) : (
 <FaEye className="text-[9px] sm:text-[10px]" />
 )}
 <span className="hidden sm:inline">{customer.is_active ? 'تعطيل' : 'تفعيل'}</span>
 </button>
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

 {viewingCustomer && (
 <div
 role="presentation"
 className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
 onClick={() => { setViewingCustomer(null); setCustomerVehicles([]) }}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-label="تفاصيل العميل"
 className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E7E8EA] bg-white/95 backdrop-blur">
 <div className="flex items-center gap-3 min-w-0">
 <span className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <FaUsers className="text-[#DC2626] text-sm" />
 </span>
 <div className="min-w-0">
 <h3 className="text-base font-bold text-[#111214] leading-tight">تفاصيل العميل</h3>
 <p className="text-[10px] text-[#9A9DA3] font-medium mt-0.5">بيانات العميل والمركبات المسجلة</p>
 </div>
 </div>
 <button
 onClick={() => { setViewingCustomer(null); setCustomerVehicles([]) }}
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
 <span className="text-lg font-black text-[#DC2626]">
 {viewingCustomer.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}
 </span>
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-x-2.5 gap-y-2 flex-wrap">
 <h4 className="text-lg font-black text-[#111214] truncate">{viewingCustomer.full_name}</h4>
 <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
 viewingCustomer.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${viewingCustomer.is_active ? 'bg-[#059669]' : 'bg-[#9A9DA3]'}`} />
 {viewingCustomer.is_active ? 'نشط' : 'معطّل'}
 </span>
 </div>
 <p className="text-[11px] text-[#62666D] font-medium mt-1">
 عميل منذ {new Date(viewingCustomer.created_at).toLocaleDateString('en-GB')}
 </p>
 </div>
 </div>

 {!viewingCustomer.is_active && (
 <div className="flex items-start gap-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-3 text-[11px] font-bold text-[#B45309]">
 <FaExclamationTriangle className="text-[10px] mt-0.5 shrink-0" />
 <span>العميل معطّل — لن يتم إنشاء حجوزات أو فواتير جديدة له حتى يتم تفعيله.</span>
 </div>
 )}

 {/* Contact info */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaPhone className="text-[#059669] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">رقم الجوال</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingCustomer.phone}</p>
 </div>
 </div>

 {viewingCustomer.email && (
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaEnvelope className="text-[#2563EB] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">البريد الإلكتروني</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingCustomer.email}</p>
 </div>
 </div>
 )}

 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaCalendarAlt className="text-[#7C3AED] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">تاريخ التسجيل</p>
 <p className="text-xs font-bold text-[#111214] mt-0.5">{new Date(viewingCustomer.created_at).toLocaleDateString('en-GB')}</p>
 </div>
 </div>

 {viewingCustomer.source && sourceConfig[viewingCustomer.source] && (
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaGlobe className="text-[#7C3AED] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">المصدر</p>
 <div className="mt-1">{sourceBadge(viewingCustomer.source)}</div>
 </div>
 </div>
 )}
 </div>

 {viewingCustomer.notes && (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">ملاحظات</h5>
 </div>
 <p className="text-xs leading-relaxed text-[#4B4F55] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-3 whitespace-pre-wrap break-words">
 {viewingCustomer.notes}
 </p>
 </div>
 )}

 {/* Vehicles */}
 <div className="border-t border-[#E7E8EA] pt-5">
 <div className="flex items-center justify-between gap-2 mb-3">
 <h4 className="text-sm font-bold text-[#111214] flex items-center gap-2.5">
 <span className="w-8 h-8 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center">
 <FaCar className="text-[#DC2626] text-xs" />
 </span>
 المركبات المسجلة
 </h4>
 {!loadingVehicles && customerVehicles.length > 0 && (
 <span className="inline-flex items-center rounded-full bg-[#F7F7F5] border border-[#E7E8EA] px-2.5 py-1 text-[10px] font-bold text-[#62666D]">
 {customerVehicles.length === 1 ? 'مركبة واحدة' : customerVehicles.length === 2 ? 'مركبتان' : `${customerVehicles.length} ${customerVehicles.length <= 10 ? 'مركبات' : 'مركبة'}`}
 </span>
 )}
 </div>
 {loadingVehicles ? (
 <div className="space-y-2.5">
 {[0, 1].map((i) => (
 <div key={i} className="h-[120px] rounded-xl bg-[#F7F7F5] border border-[#E7E8EA] animate-pulse" />
 ))}
 </div>
 ) : customerVehicles.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-8 bg-[#FBFBFA] border border-dashed border-[#E7E8EA] rounded-xl">
 <div className="w-10 h-10 rounded-full bg-white border border-[#E7E8EA] flex items-center justify-center mb-2">
 <FaCar className="text-[#D4D6DA] text-sm" />
 </div>
 <p className="text-xs font-bold text-[#62666D]">لا توجد مركبات مسجلة</p>
 <p className="text-[10px] text-[#9A9DA3] mt-0.5">ستظهر هنا مركبات العميل بعد تسجيلها</p>
 </div>
 ) : (
 <div className="space-y-2.5">
 {customerVehicles.map((v) => (
 <div key={v.id} className="bg-[#FBFBFA] hover:bg-white border border-[#E7E8EA] hover:border-[#D4D6DA] hover:shadow-sm rounded-xl p-3.5 transition-all duration-200">
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-start gap-3 min-w-0 flex-1">
 <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <FaCar className="text-[#DC2626] text-sm" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-x-2.5 gap-y-2 flex-wrap">
 <p className="text-[#111214] text-sm font-black truncate">
 {[v.make, v.model].filter(Boolean).join(' ') || 'مركبة بدون اسم'}
 </p>
 {v.year && (
 <span className="inline-flex items-center rounded-md bg-white border border-[#E7E8EA] px-1.5 py-0.5 text-[10px] font-bold text-[#4B4F55]">
 موديل {v.year}
 </span>
 )}
 {v.color && (
 <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-[#E7E8EA] px-1.5 py-0.5 text-[10px] font-bold text-[#4B4F55]">
 <span className="w-1.5 h-1.5 rounded-full bg-[#D4D6DA] border border-black/10" />
 {v.color}
 </span>
 )}
 </div>
 </div>
 </div>
 <span className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
 v.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 {v.is_active ? 'نشطة' : 'معطّلة'}
 </span>
 </div>
 {v.plate_number && (
 <div className="mt-3 flex justify-center">
 <SaudiPlate plate={v.plate_number} />
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
