'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { CustomerForm } from '@/components/admin/CustomerForm'
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
 walk_in: { label: 'حضور مباشر', icon: <FaWalking className="text-[9px]" />, class: 'bg-[#EFF6FF] text-blue-300 border-[#BFDBFE]' },
 referral: { label: 'إحالة', icon: <FaShareAlt className="text-[9px]" />, class: 'bg-[#FAF5FF] text-purple-300 border-[#DDD6FE]' },
 online: { label: 'أونلاين', icon: <FaGlobe className="text-[9px]" />, class: 'bg-[#ECFDF5] text-emerald-300 border-[#A7F3D0]' },
 social: { label: 'تواصل اجتماعي', icon: <FaHeadset className="text-[9px]" />, class: 'bg-[#FFFBEB] text-amber-300 border-[#FDE68A]' },
 phone: { label: 'هاتف', icon: <FaPhone className="text-[9px]" />, class: 'bg-[#ECFEFF] text-cyan-300 border-[#A5F3FC]' },
}

export default function CustomersManager() {
 const { hasPermission } = useAuth()
 const [customers, setCustomers] = useState<Customer[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
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
 {new Date(customer.created_at).toLocaleDateString('ar-SA')}
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
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => { setViewingCustomer(null); setCustomerVehicles([]) }}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaUsers className="text-[#DC2626] text-sm" />
 تفاصيل العميل
 </h3>
 <button onClick={() => { setViewingCustomer(null); setCustomerVehicles([]) }} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>
 <div className="space-y-3 mb-6">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الاسم:</span>
 <span className="text-[#111214] font-bold">{viewingCustomer.full_name}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">رقم الجوال:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingCustomer.phone}</span>
 </div>
 {viewingCustomer.email && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">البريد الإلكتروني:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingCustomer.email}</span>
 </div>
 )}
 {viewingCustomer.source && (
 <div className="flex justify-between text-sm items-center">
 <span className="text-[#62666D]">المصدر:</span>
 {sourceBadge(viewingCustomer.source)}
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الحالة:</span>
 <span className={`font-bold ${viewingCustomer.is_active ? 'text-[#059669]' : 'text-[#62666D]'}`}>
 {viewingCustomer.is_active ? 'نشط' : 'معطّل'}
 </span>
 </div>
 {viewingCustomer.notes && (
 <div className="text-sm">
 <span className="text-[#62666D]">ملاحظات:</span>
 <p className="text-[#111214] mt-1">{viewingCustomer.notes}</p>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">تاريخ الإنشاء:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingCustomer.created_at).toLocaleDateString('ar-SA')}</span>
 </div>
 </div>

 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-sm font-bold text-[#111214] flex items-center gap-2 mb-3">
 <FaCar className="text-[#DC2626] text-xs" />
 المركبات
 </h4>
 {loadingVehicles ? (
 <div className="flex items-center justify-center py-6">
 <div className="w-8 h-8 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 </div>
 ) : customerVehicles.length === 0 ? (
 <p className="text-[#62666D] text-xs text-center py-4">لا توجد مركبات مسجلة لهذا العميل</p>
 ) : (
 <div className="space-y-2">
 {customerVehicles.map((v) => (
 <div key={v.id} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
 <FaCar className="text-[#62666D] text-[10px]" />
 </div>
 <div>
 <p className="text-[#111214] text-xs font-bold">{v.make} {v.model}</p>
 <div className="flex items-center gap-2 text-[10px] text-[#62666D]">
 {v.year && <span>{v.year}</span>}
 {v.color && <><span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span><span>{v.color}</span></>}
 {v.plate_number && <><span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span><span dir="ltr">{v.plate_number}</span></>}
 </div>
 </div>
 </div>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
 v.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 {v.is_active ? 'نشط' : 'معطّل'}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
