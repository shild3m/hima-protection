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
 FaCheck,
 FaShieldAlt,
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
 const { hasPermission, staffInfo } = useAuth()
 const skipInitialFetch = useRef(initialCustomers !== undefined)
 const [customers, setCustomers] = useState<Customer[]>(initialCustomers ?? [])
 const [loading, setLoading] = useState(initialCustomers === undefined)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
 const [pagination, setPagination] = useState<Pagination | null>(initialPagination ?? null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
 const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
 const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([])
 const [loadingVehicles, setLoadingVehicles] = useState(false)
 const [toggleTarget, setToggleTarget] = useState<Customer | null>(null)
 const [toggleLoading, setToggleLoading] = useState(false)
 const [toggleError, setToggleError] = useState('')
 const [deleteTargets, setDeleteTargets] = useState<Customer[]>([])
 const [selectedIds, setSelectedIds] = useState<string[]>([])
 const [deleteCode, setDeleteCode] = useState('')
 const [deleteError, setDeleteError] = useState('')
 const [deleteLoading, setDeleteLoading] = useState(false)
 const [deleteConfirmed, setDeleteConfirmed] = useState(false)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canCreate = hasPermission('customers', 'create')
  const canUpdate = hasPermission('customers', 'update')
  const canDelete = hasPermission('customers', 'delete')
  const isSuperAdmin = staffInfo?.role === 'super_admin'

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
 const result = await getCustomers(
   debouncedSearch,
   page,
   undefined,
   statusFilter === 'all' ? undefined : statusFilter
 )
 if (result.success) {
 setCustomers(result.data)
 setSelectedIds([])
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
 }, [debouncedSearch, page, statusFilter])

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

 const handleConfirmToggle = async () => {
 if (!toggleTarget) return
 setToggleLoading(true)
 setToggleError('')
 try {
 const { toggleCustomerStatus } = await import('@/app/actions/customers')
 const result = await toggleCustomerStatus(toggleTarget.id)
 if (result.success) {
 setNotification({
 type: 'success',
 message: toggleTarget.is_active ? 'تم تعطيل العميل بنجاح' : 'تم تفعيل العميل بنجاح',
 })
 setToggleTarget(null)
 fetchCustomers()
 } else {
 setToggleError(result.error || 'تعذر تغيير حالة العميل. حاول مرة أخرى.')
 }
 } catch {
 setToggleError('تعذر تغيير حالة العميل. حاول مرة أخرى.')
 } finally {
 setToggleLoading(false)
 }
 }

 const openDeleteCustomer = (customer: Customer) => {
 setDeleteTargets([customer])
 setDeleteCode('')
 setDeleteError('')
 setDeleteConfirmed(false)
 }

 const openBulkDelete = () => {
 if (!isSuperAdmin) {
 setNotification({ type: 'error', message: 'لا تملك صلاحية حذف' })
 return
 }
 const targets = customers.filter((customer) => selectedIds.includes(customer.id))
 if (targets.length === 0) return
 setDeleteTargets(targets)
 setDeleteCode('')
 setDeleteError('')
 setDeleteConfirmed(false)
 }

 const closeDeleteCustomer = () => {
 if (deleteLoading) return
 setDeleteTargets([])
 setDeleteCode('')
 setDeleteError('')
 setDeleteConfirmed(false)
 }

 const handleDeleteCustomer = async () => {
 if (deleteTargets.length === 0) return
 if (!deleteCode.trim()) {
 setDeleteError('يرجى إدخال الرمز الخاص')
 return
 }
 if (!deleteConfirmed) {
 setDeleteError('يرجى تأكيد الحذف أولًا')
 return
 }
 setDeleteLoading(true)
 setDeleteError('')
 try {
 const { sha256 } = await import('@/lib/crypto')
 const { deleteCustomerSecure } = await import('@/app/actions/customers')
 const tokenHash = await sha256(deleteCode.trim())
 const deleted = { vehicles: 0, bookings: 0, invoices: 0, payments: 0 }
 let keptVehicles = 0
 let failedMessage = ''
 for (const target of deleteTargets) {
 const result = await deleteCustomerSecure(target.id, tokenHash)
 if (!result.success) {
 failedMessage = deleteTargets.length > 1
 ? `تعذر حذف «${target.full_name}»: ${result.error || 'حدث خطأ'}`
 : (result.error || 'حدث خطأ')
 break
 }
 deleted.vehicles += result.deleted.vehicles
 deleted.bookings += result.deleted.bookings
 deleted.invoices += result.deleted.invoices
 deleted.payments += result.deleted.payments
 keptVehicles += result.keptVehicles || 0
 }
 if (failedMessage) {
 setDeleteError(failedMessage)
 fetchCustomers()
 return
 }
 setNotification({
 type: 'success',
 message: `${deleteTargets.length > 1 ? `تم حذف ${deleteTargets.length} عميل نهائيًا` : 'تم حذف العميل نهائيًا'} — ${deleted.bookings} حجز، ${deleted.invoices} فاتورة، ${deleted.payments} دفعة، ${deleted.vehicles} مركبة${keptVehicles > 0 ? ` — تم الاحتفاظ بـ ${keptVehicles} مركبة مرتبطة بعملاء آخرين` : ''}`,
 })
 setDeleteTargets([])
 setDeleteCode('')
 setDeleteError('')
 setDeleteConfirmed(false)
 fetchCustomers()
 } catch {
 setDeleteError('حدث خطأ غير متوقع')
 } finally {
 setDeleteLoading(false)
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
 const allSelected = customers.length > 0 && customers.every((customer) => selectedIds.includes(customer.id))

 const toggleSelected = (id: string) => {
 setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
 }

 const toggleSelectAll = () => {
 setSelectedIds(allSelected ? [] : customers.map((customer) => customer.id))
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 {notification && (
 <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 animate-bounceIn ${
 notification.type === 'success'
 ? 'bg-[#ECFDF5] border-[#A7F3D0] text-emerald-700'
 : 'bg-[#FEF2F2] border-[#FECACA] text-red-700'
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

 <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
 <div className="relative max-w-md flex-1">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو رقم الجوال..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-3 text-[#111214] text-[16px] focus:outline-none focus:border-[#FECACA] placeholder:text-[16px] placeholder:text-[#62666D]"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#111214] transition" aria-label="مسح البحث">
 <FaTimes className="text-xs" />
 </button>
 )}
 </div>
 <div className="flex items-center gap-1.5 flex-wrap">
 {([
   { key: 'all', label: 'الكل' },
   { key: 'active', label: 'نشط' },
   { key: 'inactive', label: 'معطّل' },
 ] as const).map((item) => (
 <button
 key={item.key}
 onClick={() => { setStatusFilter(item.key); setPage(1) }}
 className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
 statusFilter === item.key
 ? 'bg-[#111214] text-white border-[#111214] shadow-sm'
 : 'bg-white text-[#62666D] border-[#E7E8EA] hover:text-[#111214] hover:border-[#D4D6DA]'
 }`}
 >
 {item.label}
 </button>
 ))}
 </div>
 </div>

 {canDelete && customers.length > 0 && (
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5">
 <label className="flex items-center gap-2 text-xs font-bold text-[#4B4F55] cursor-pointer select-none">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={toggleSelectAll}
 className="w-4 h-4 accent-[#DC2626] cursor-pointer"
 />
 تحديد الكل ({customers.length})
 </label>
 {selectedIds.length > 0 && (
 <div className="flex items-center gap-2.5">
 <span className="text-xs font-bold text-[#62666D]">{selectedIds.length} محدد</span>
 <button
 onClick={openBulkDelete}
 className="px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
 >
 <FaTrash className="text-[10px]" />
 حذف المحدد
 </button>
 </div>
 )}
 </div>
 )}

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
 {canDelete && (
 <input
 type="checkbox"
 checked={selectedIds.includes(customer.id)}
 onChange={() => toggleSelected(customer.id)}
 aria-label={`تحديد ${customer.full_name}`}
 className="w-4 h-4 accent-[#DC2626] shrink-0 cursor-pointer"
 />
 )}
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
 {canDelete && (
 <button
 onClick={() => {
 if (!isSuperAdmin) {
 setNotification({ type: 'error', message: 'لا تملك صلاحية حذف' })
 return
 }
 openDeleteCustomer(customer)
 }}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 hover:scale-105"
 title="حذف"
 aria-label={`حذف ${customer.full_name}`}
 >
 <FaTrash className="text-[9px] sm:text-[10px]" />
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
 onClick={() => { setToggleError(''); setToggleTarget(customer) }}
 className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1 ${
 customer.is_active
 ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] text-amber-700'
 : 'bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-emerald-700'
 }`}
 title={customer.is_active ? 'تعطيل العميل' : 'تفعيل العميل'}
 >
 {customer.is_active ? (
 <FaTimes className="text-[9px] sm:text-[10px]" />
 ) : (
 <FaCheck className="text-[9px] sm:text-[10px]" />
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

  {/* Toggle status confirmation */}
  {toggleTarget && (
  <div
  role="presentation"
  className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
  onClick={() => { if (!toggleLoading) setToggleTarget(null) }}
  >
  <div
  role="dialog"
  aria-modal="true"
  aria-label={toggleTarget.is_active ? 'تعطيل العميل' : 'تفعيل العميل'}
  className={`bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border-t-4 ${toggleTarget.is_active ? 'border-t-[#D97706]' : 'border-t-[#059669]'}`}
  onClick={e => e.stopPropagation()}
  >
  <div className="px-5 pt-5 pb-3 flex items-center gap-3">
  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${toggleTarget.is_active ? 'bg-[#FFFBEB] text-[#B45309]' : 'bg-[#ECFDF5] text-[#059669]'}`}>
  {toggleTarget.is_active ? <FaTimes /> : <FaCheck />}
  </span>
  <div className="min-w-0">
  <h3 className="text-base font-black text-[#111214]">{toggleTarget.is_active ? 'تعطيل العميل' : 'تفعيل العميل'}</h3>
  <p className="text-[11px] text-[#62666D] font-medium truncate mt-0.5">{toggleTarget.full_name}</p>
  </div>
  </div>
  <div className="px-5 pb-4">
  <p className="text-xs leading-relaxed text-[#4B4F55] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-3">
  {toggleTarget.is_active
  ? 'سيتم تعطيل العميل ومنعه من إنشاء حجوزات أو فواتير جديدة. تبقى الحجوزات والفواتير والمدفوعات السابقة كما هي.'
  : 'سيتمكن العميل من إنشاء حجوزات وفواتير جديدة مرة أخرى.'}
  </p>
  {toggleError && (
  <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 text-xs font-bold text-[#B91C1C]">
  <FaExclamationTriangle className="text-[10px] mt-0.5 shrink-0" />
  <span>{toggleError}</span>
  </div>
  )}
  </div>
  <div className="px-5 pb-5 flex gap-2.5">
  <button
  onClick={handleConfirmToggle}
  disabled={toggleLoading}
  className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
  toggleTarget.is_active ? 'bg-[#D97706] hover:bg-[#B45309]' : 'bg-[#059669] hover:bg-[#047857]'
  }`}
  >
  {toggleLoading ? <><FaSpinner className="animate-spin" /> جاري التنفيذ...</> : toggleTarget.is_active ? 'تعطيل' : 'تفعيل'}
  </button>
  <button
  onClick={() => { setToggleTarget(null); setToggleError('') }}
  disabled={toggleLoading}
  className="px-5 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all disabled:opacity-50"
  >
  إلغاء
  </button>
  </div>
  </div>
  </div>
  )}

  {/* Super-admin delete */}
  {deleteTargets.length > 0 && isSuperAdmin && (
  <div
  role="presentation"
  className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
  onClick={closeDeleteCustomer}
  >
  <div
  role="dialog"
  aria-modal="true"
  aria-label="حذف العميل"
  className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto border-t-4 border-t-[#DC2626]"
  onClick={e => e.stopPropagation()}
  >
  <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E7E8EA] bg-white/95 backdrop-blur">
  <div className="flex items-center gap-3 min-w-0">
  <span className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
  <FaTrash className="text-[#DC2626] text-sm" />
  </span>
  <div className="min-w-0">
  <h3 className="text-base font-bold text-[#111214] leading-tight">{deleteTargets.length > 1 ? 'حذف العملاء المحددين' : 'حذف العميل'}</h3>
  <p className="text-[10px] text-[#9A9DA3] font-medium mt-0.5">يتطلب الرمز الخاص للتأكيد</p>
  </div>
  </div>
  <button onClick={closeDeleteCustomer} disabled={deleteLoading} aria-label="إغلاق" className="w-8 h-8 rounded-lg text-[#62666D] hover:text-[#111214] hover:bg-[#F1F2F3] flex items-center justify-center transition shrink-0 disabled:opacity-40">
  <FaTimes className="text-sm" />
  </button>
  </div>

  <div className="px-5 py-4 space-y-4">
  <div className="flex items-center gap-3 rounded-xl bg-[#FBFBFA] border border-[#E7E8EA] px-3.5 py-3">
  <span className="w-9 h-9 rounded-xl bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
  <FaUsers className="text-[#DC2626] text-xs" />
  </span>
  <div className="min-w-0">
  {deleteTargets.length === 1 ? (
  <>
  <p className="text-sm font-bold text-[#111214] truncate">{deleteTargets[0].full_name}</p>
  <p className="text-[11px] text-[#62666D] mt-0.5" dir="ltr">{deleteTargets[0].phone}</p>
  </>
  ) : (
  <>
  <p className="text-sm font-bold text-[#111214]">{deleteTargets.length} عملاء محددين</p>
  <p className="text-[11px] text-[#62666D] mt-0.5 truncate">
  {deleteTargets.slice(0, 3).map((customer) => customer.full_name).join('، ')}
  {deleteTargets.length > 3 ? ` و${deleteTargets.length - 3} آخرين` : ''}
  </p>
  </>
  )}
  </div>
  </div>

  <div className="flex items-start gap-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-3.5 text-xs font-bold leading-relaxed text-[#B91C1C]">
  <FaExclamationTriangle className="text-sm mt-0.5 shrink-0" />
  <span>{deleteTargets.length > 1
  ? `سيتم حذف جميع ما يتعلق بهؤلاء العملاء (${deleteTargets.length}) نهائيًا من النظام، ولا يمكن التراجع عنه.`
  : 'سيتم حذف جميع ما يتعلق بهذا العميل نهائيًا من النظام، ولا يمكن التراجع عنه.'}</span>
  </div>

  <label className="flex items-start gap-2.5 rounded-xl border border-[#E7E8EA] bg-white px-3.5 py-3 cursor-pointer">
  <input
  type="checkbox"
  checked={deleteConfirmed}
  onChange={e => { setDeleteConfirmed(e.target.checked); setDeleteError('') }}
  className="mt-0.5 accent-[#DC2626]"
  />
  <span className="text-[11px] font-bold text-[#4B4F55] leading-relaxed">{deleteTargets.length > 1 ? 'نعم، احذف العملاء المحددين وجميع سجلاتهم نهائيًا.' : 'نعم، احذف العميل وجميع سجلاته نهائيًا.'}</span>
  </label>

  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1.5 flex items-center gap-1.5">
  <FaShieldAlt className="text-[#DC2626] text-[10px]" />
  الرمز الخاص *
  </label>
  <input
  type="password"
  value={deleteCode}
  onChange={e => {
  const raw = e.target.value
  const englishOnly = raw.replace(/[^\x20-\x7E]/g, '')
  setDeleteCode(englishOnly)
  setDeleteError(raw !== englishOnly ? 'الرمز الخاص بالإنجليزية فقط' : '')
  }}
  onKeyDown={e => { if (e.key === 'Enter') handleDeleteCustomer() }}
  placeholder="أدخل الرمز الخاص..."
  autoComplete="new-password"
  dir="ltr"
  className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] text-right focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all"
  />
  <p className="text-[10px] text-[#9A9DA3] mt-1.5">استخدم الحروف الإنجليزية والأرقام فقط.</p>
  {deleteError && <p className="text-xs text-[#DC2626] mt-2 font-bold">{deleteError}</p>}
  </div>
  </div>

  <div className="sticky bottom-0 z-10 px-5 py-4 border-t border-[#E7E8EA] bg-white/95 backdrop-blur flex gap-2.5">
  <button
  onClick={handleDeleteCustomer}
  disabled={!deleteCode.trim() || deleteLoading || !deleteConfirmed}
  className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] hover:from-[#9B1B30] hover:to-[#7A1526] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
  >
  {deleteLoading ? <><FaSpinner className="animate-spin" /> جاري التنفيذ...</> : 'حذف نهائي'}
  </button>
  <button
  onClick={closeDeleteCustomer}
  disabled={deleteLoading}
  className="px-5 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all disabled:opacity-50"
  >
  إلغاء
  </button>
  </div>
  </div>
  </div>
  )}
 </div>
 )
}
