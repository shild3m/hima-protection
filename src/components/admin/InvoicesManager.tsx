'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaFileInvoiceDollar,
 FaSearch,
 FaEye,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaUser,
 FaCar,
 FaCalendarAlt,
 FaChevronRight,
 FaChevronLeft,
  FaCheckCircle,
  FaBan,
  FaPlus,
  FaTrash,
  FaPen,
  FaUndo,
  FaMoneyBill,
} from 'react-icons/fa'

interface Invoice {
 id: string
 invoice_number: string
 customer_id: string
 vehicle_id: string | null
 booking_id: string | null
 subtotal: number
 discount: number
 tax_rate: number
 tax_amount: number
 total: number
 paid_amount: number
 status: string
 issued_at: string | null
 cancelled_at: string | null
 notes: string | null
 created_at: string
 customer?: { id: string; full_name: string; phone: string }
 vehicle?: { id: string; make: string; model: string; plate_number: string | null }
}

interface InvoiceDetail extends Invoice {
 customer?: { id: string; full_name: string; phone: string; email: string | null }
 vehicle?: { id: string; make: string; model: string; year: number | null; plate_number: string | null }
 items?: { id: string; description: string; quantity: number; unit_price: number; discount: number; tax_rate: number; total: number; service?: { id: string; name: string } }[]
 payments?: { id: string; amount: number; payment_method: string; reference_number: string | null; notes: string | null; paid_at: string | null; created_at: string }[]
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
 draft: { label: 'مسودة', color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' },
 issued: { label: 'صادرة', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
 partially_paid: { label: 'مدفوعة جزئياً', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB] border-[#FDE68A]' },
 paid: { label: 'مدفوعة', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
 cancelled: { label: 'ملغاة', color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2] border-[#FECACA]' },
 refunded: { label: 'مسترجعة', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]' },
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
 cash: 'نقدي',
 card: 'بطاقة',
 bank_transfer: 'تحويل بنكي',
 online: 'أونلاين',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
 draft: ['issued', 'cancelled'],
 issued: ['partially_paid', 'paid', 'cancelled'],
 partially_paid: ['paid', 'cancelled'],
 paid: [],
 cancelled: [],
 refunded: [],
}

function formatCurrency(amount: number): string {
 return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export default function InvoicesManager() {
 const { hasPermission } = useAuth()
 const [invoices, setInvoices] = useState<Invoice[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [stats, setStats] = useState<Stats | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [viewingInvoice, setViewingInvoice] = useState<InvoiceDetail | null>(null)
 const [loadingDetail, setLoadingDetail] = useState(false)
 const [actionLoading, setActionLoading] = useState<string | null>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const canUpdate = hasPermission('invoices', 'update')
 const canCreate = hasPermission('invoices', 'create')
 const totalPages = pagination?.totalPages || 1
 const [showCreateForm, setShowCreateForm] = useState(false)
 const [customers, setCustomers] = useState<{ id: string; full_name: string; phone: string }[]>([])
 const [services, setServices] = useState<{ id: string; name: string; base_price: number }[]>([])
 const [createFormData, setCreateFormData] = useState({
   customer_id: '',
   vehicle_id: '',
   notes: '',
   discount: 0,
   tax_rate: 0,
   items: [{ description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, service_id: '' }] as { description: string; quantity: number; unit_price: number; discount: number; tax_rate: number; service_id: string }[],
 })
 const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
 const [createSubmitting, setCreateSubmitting] = useState(false)

 const [editingInvoice, setEditingInvoice] = useState<InvoiceDetail | null>(null)
 const [editFormData, setEditFormData] = useState({ discount: 0, tax_rate: 0, notes: '' })
 const [editItems, setEditItems] = useState<{ description: string; quantity: number; unit_price: number; discount: number; tax_rate: number; service_id: string }[]>([])
 const [editSubmitting, setEditSubmitting] = useState(false)

 const [showRefundModal, setShowRefundModal] = useState(false)
 const [refundInvoiceId, setRefundInvoiceId] = useState('')
 const [refundReason, setRefundReason] = useState('')
 const [refundSubmitting, setRefundSubmitting] = useState(false)

 useEffect(() => {
   if (canCreate && window.location.search.includes('create=true')) {
     setShowCreateForm(true)
   }
 }, [canCreate])

 useEffect(() => {
   if (showCreateForm && customers.length === 0) {
     import('@/app/actions/customers').then(({ getCustomers }) => {
       getCustomers(undefined, 1, 500).then(res => {
         if (res.success && res.data) setCustomers(res.data.map((c: { id: string; full_name: string; phone: string }) => ({ id: c.id, full_name: c.full_name, phone: c.phone })))
       })
     })
     import('@/app/actions/services').then(({ getServices }) => {
       getServices().then(res => {
         if (res.success) setServices(res.data || [])
       })
     })
   }
 }, [showCreateForm, customers.length])

 const handleCreateInvoice = async () => {
   setCreateErrors({})
   const errs: Record<string, string> = {}
   if (!createFormData.customer_id) errs.customer_id = 'يرجى اختيار العميل'
   if (createFormData.items.length === 0) errs.items = 'يجب إضافة عنصر واحد على الأقل'
   const validItems = createFormData.items.filter(i => i.description.trim())
   if (validItems.length === 0) errs.items = 'يجب إضافة عنصر واحد على الأقل مع وصف'
   if (Object.keys(errs).length > 0) { setCreateErrors(errs); return }
   setCreateSubmitting(true)
   try {
     const { createInvoice } = await import('@/app/actions/invoices')
     const result = await createInvoice({
       customer_id: createFormData.customer_id,
       vehicle_id: createFormData.vehicle_id || null,
       booking_id: null,
       discount: createFormData.discount,
       tax_rate: createFormData.tax_rate,
       notes: createFormData.notes || null,
       items: validItems.map(i => ({
         service_id: i.service_id || null,
         description: i.description,
         quantity: i.quantity,
         unit_price: i.unit_price,
         discount: i.discount,
         tax_rate: i.tax_rate,
       })),
     })
     if (result.success) {
       setNotification({ type: 'success', message: 'تم إنشاء الفاتورة بنجاح' })
       setShowCreateForm(false)
       setCreateFormData({ customer_id: '', vehicle_id: '', notes: '', discount: 0, tax_rate: 0, items: [{ description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, service_id: '' }] })
       fetchInvoices()
       fetchStats()
     } else {
       setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
   } finally {
     setCreateSubmitting(false)
   }
 }

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

 const fetchInvoices = useCallback(async () => {
 try {
 setLoading(true)
 const { getInvoices } = await import('@/app/actions/invoices')
 const result = await getInvoices(debouncedSearch, statusFilter, page)
 if (result.success) {
 setInvoices(result.data)
 if (result.pagination) setPagination(result.pagination)
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب الفواتير' })
 } finally {
 setLoading(false)
 }
 }, [debouncedSearch, statusFilter, page])

 const fetchStats = useCallback(async () => {
 try {
 const { getInvoiceStats } = await import('@/app/actions/invoices')
 const result = await getInvoiceStats()
 if (result.success) setStats(result.data)
 } catch {}
 }, [])

 useEffect(() => { fetchInvoices() }, [fetchInvoices])
 useEffect(() => { fetchStats() }, [fetchStats])
 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const handleViewInvoice = async (invoice: Invoice) => {
 setViewingInvoice(invoice as InvoiceDetail)
 setLoadingDetail(true)
 try {
 const { getInvoice } = await import('@/app/actions/invoices')
 const result = await getInvoice(invoice.id)
 if (result.success) setViewingInvoice(result.data)
 } catch {} finally {
 setLoadingDetail(false)
 }
 }

 const handleIssueInvoice = async (id: string) => {
 setActionLoading(id)
 try {
 const { issueInvoice } = await import('@/app/actions/invoices')
 const result = await issueInvoice(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم إصدار الفاتورة بنجاح' })
 fetchInvoices()
 fetchStats()
 } else {
 setNotification({ type: 'error', message: result.error || 'حدث خطأ غير متوقع' })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setActionLoading(null)
 }
 }

 const handleCancelInvoice = async (id: string) => {
 setActionLoading(id)
 try {
 const { cancelInvoice } = await import('@/app/actions/invoices')
 const result = await cancelInvoice(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم إلغاء الفاتورة بنجاح' })
 fetchInvoices()
 fetchStats()
 } else {
 setNotification({ type: 'error', message: result.error || 'حدث خطأ غير متوقع' })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setActionLoading(null)
 }
 }

 const handleOpenEdit = async (invoice: Invoice) => {
   setActionLoading(invoice.id)
   try {
     const { getInvoice } = await import('@/app/actions/invoices')
     const result = await getInvoice(invoice.id)
     if (result.success && result.data) {
       const detail = result.data as InvoiceDetail
       setEditingInvoice(detail)
       setEditFormData({ discount: detail.discount || 0, tax_rate: detail.tax_rate || 0, notes: detail.notes || '' })
       setEditItems(detail.items?.map(i => ({
         description: i.description,
         quantity: i.quantity,
         unit_price: i.unit_price,
         discount: i.discount || 0,
         tax_rate: i.tax_rate || 0,
         service_id: i.service?.id || '',
       })) || [])
     } else {
       setNotification({ type: 'error', message: 'تعذر جلب تفاصيل الفاتورة' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ' })
   } finally {
     setActionLoading(null)
   }
 }

 const handleEditSubmit = async () => {
   if (!editingInvoice) return
   const validItems = editItems.filter(i => i.description.trim())
   if (validItems.length === 0) {
     setNotification({ type: 'error', message: 'يجب أن تحتوي الفاتورة على عنصر واحد على الأقل' })
     return
   }
   setEditSubmitting(true)
   try {
     const { updateInvoice } = await import('@/app/actions/invoices')
     const result = await updateInvoice(editingInvoice.id, {
       discount: editFormData.discount,
       tax_rate: editFormData.tax_rate,
       notes: editFormData.notes || undefined,
       items: validItems.map(i => ({
         service_id: i.service_id || null,
         description: i.description,
         quantity: i.quantity,
         unit_price: i.unit_price,
         discount: i.discount,
         tax_rate: i.tax_rate,
       })),
     })
     if (result.success) {
       setNotification({ type: 'success', message: 'تم تحديث الفاتورة بنجاح' })
       setEditingInvoice(null)
       fetchInvoices()
     } else {
       setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
   } finally {
     setEditSubmitting(false)
   }
 }

 const handleOpenRefund = (invoiceId: string) => {
   setRefundInvoiceId(invoiceId)
   setRefundReason('')
   setShowRefundModal(true)
 }

 const handleRefundSubmit = async () => {
   if (!refundInvoiceId) return
   setRefundSubmitting(true)
   try {
     const { refundInvoice } = await import('@/app/actions/invoices')
     const result = await refundInvoice(refundInvoiceId, refundReason || undefined)
     if (result.success) {
       setNotification({ type: 'success', message: 'تم استرجاع الفاتورة بنجاح' })
       setShowRefundModal(false)
       fetchInvoices()
       fetchStats()
     } else {
       setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
   } finally {
     setRefundSubmitting(false)
   }
 }

 const statusBadge = (status: string) => {
 const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft
 return (
 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold border ${c.bg} ${c.color}`}>
 {c.label}
 </span>
 )
 }

 return (
 <div className="space-y-4 sm:space-y-6">
 {notification && (
 <div className={`p-3 rounded-xl border text-sm font-bold ${
 notification.type === 'success'
 ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
 : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
 }`}>
 {notification.type === 'success' ? <FaCheckCircle className="inline ml-2" /> : <FaExclamationTriangle className="inline ml-2" />}
 {notification.message}
 </div>
 )}

 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
 {(['draft', 'issued', 'partially_paid', 'paid', 'cancelled', 'refunded'] as const).map(s => (
 <div key={s} className={`p-3 rounded-xl border ${STATUS_CONFIG[s].bg} text-center`}>
 <div className={`text-lg sm:text-xl font-bold ${STATUS_CONFIG[s].color}`}>{stats.counts[s] || 0}</div>
 <div className="text-[10px] text-[#62666D] font-bold">{STATUS_CONFIG[s].label}</div>
 </div>
 ))}
 </div>
 )}

 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h1 className="text-2xl font-black text-[#111214] flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
 <FaFileInvoiceDollar className="text-[#DC2626] text-sm" />
 </div>
 إدارة الفواتير
 </h1>
 </div>
 {canCreate && (
 <button onClick={() => setShowCreateForm(true)} className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
 <FaPlus className="text-xs" />
 فاتورة جديدة
 </button>
 )}
 </div>

 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث برقم الفاتورة أو اسم العميل أو الجوال..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-2.5 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 />
 </div>
 <select
 value={statusFilter}
 onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
 className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl px-4 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition appearance-none cursor-pointer"
 >
 <option value="all">جميع الحالات</option>
 {Object.entries(STATUS_CONFIG).map(([key, val]) => (
 <option key={key} value={key}>{val.label}</option>
 ))}
 </select>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <div className="w-10 h-10 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 </div>
 ) : invoices.length === 0 ? (
 <div className="text-center py-16">
 <FaBoxOpen className="text-5xl text-[#62666D] mx-auto mb-4" />
 <p className="text-[#62666D] font-bold">لا توجد فواتير</p>
 </div>
 ) : (
 <>
 <div className="space-y-2 sm:space-y-3">
 {invoices.map(invoice => (
 <div key={invoice.id} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3 sm:p-4 hover:border-[#FECACA] transition-all group">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1.5 flex-wrap">
 <FaFileInvoiceDollar className="text-[#DC2626] text-xs" />
 <span className="text-sm font-bold text-[#111214]">{invoice.invoice_number}</span>
 {statusBadge(invoice.status)}
 </div>
 <div className="flex items-center gap-3 text-xs text-[#62666D] flex-wrap">
 {invoice.customer && (
 <span className="flex items-center gap-1">
 <FaUser className="text-[9px]" />
 {invoice.customer.full_name}
 </span>
 )}
 {invoice.vehicle && (
 <span className="flex items-center gap-1">
 <FaCar className="text-[9px]" />
 {invoice.vehicle.make} {invoice.vehicle.model}
 </span>
 )}
 </div>
 <div className="flex items-center gap-4 mt-2 text-xs">
 <span className="text-[#111214] font-bold">{formatCurrency(invoice.total)} ر.س</span>
 {invoice.paid_amount > 0 && (
 <span className="text-[#059669]">مدفوع: {formatCurrency(invoice.paid_amount)} ر.س</span>
 )}
 {invoice.paid_amount < invoice.total && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
 <span className="text-[#D97706]">متبقي: {formatCurrency(invoice.total - invoice.paid_amount)} ر.س</span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {invoice.status === 'draft' && canUpdate && (
 <>
   <button
     onClick={() => handleOpenEdit(invoice)}
     disabled={actionLoading === invoice.id}
     className="px-3 py-1.5 bg-[#EFF6FF] hover:bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1"
   >
     <FaPen className="text-[9px]" />
     تعديل
   </button>
   <button
     onClick={() => handleIssueInvoice(invoice.id)}
     disabled={actionLoading === invoice.id}
     className="px-3 py-1.5 bg-[#ECFDF5] hover:bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1"
   >
     {actionLoading === invoice.id ? <FaSpinner className="animate-spin text-[9px]" /> : <FaCheckCircle className="text-[9px]" />}
     إصدار
   </button>
 </>
 )}
 {(invoice.status === 'draft' || invoice.status === 'issued') && invoice.paid_amount === 0 && canUpdate && (
 <button
   onClick={() => handleCancelInvoice(invoice.id)}
   disabled={actionLoading === invoice.id}
   className="px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1"
 >
   <FaBan className="text-[9px]" />
   إلغاء
 </button>
 )}
 {(invoice.status === 'paid' || invoice.status === 'partially_paid') && canUpdate && (
 <button
   onClick={() => handleOpenRefund(invoice.id)}
   disabled={actionLoading === invoice.id}
   className="px-3 py-1.5 bg-[#FAF5FF] hover:bg-[#FAF5FF] border border-[#DDD6FE] text-[#7C3AED] rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1"
 >
   <FaUndo className="text-[9px]" />
   استرجاع
 </button>
 )}
 <button
   onClick={() => handleViewInvoice(invoice)}
   className="p-2 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] hover:text-[#111214] rounded-lg transition-all"
 >
   <FaEye className="text-[10px]" />
 </button>
 </div>
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

 {viewingInvoice && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingInvoice(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaFileInvoiceDollar className="text-[#DC2626] text-sm" />
 تفاصيل الفاتورة
 </h3>
 <button onClick={() => setViewingInvoice(null)} className="text-[#62666D] hover:text-[#111214] transition">
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
 <span className="text-[#62666D]">رقم الفاتورة:</span>
 <span className="text-[#111214] font-bold">{viewingInvoice.invoice_number}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الحالة:</span>
 {statusBadge(viewingInvoice.status)}
 </div>

 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">بيانات العميل</h4>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الاسم:</span>
 <span className="text-[#111214] font-bold">{viewingInvoice.customer?.full_name || '---'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الجوال:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingInvoice.customer?.phone || '---'}</span>
 </div>
 </div>
 </div>

 {viewingInvoice.vehicle && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">المركبة</h4>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الماركة:</span>
 <span className="text-[#111214] font-bold">{viewingInvoice.vehicle.make} {viewingInvoice.vehicle.model}</span>
 </div>
 {viewingInvoice.vehicle.plate_number && (
 <div className="flex justify-between text-sm mt-1">
 <span className="text-[#62666D]"> اللوحة:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingInvoice.vehicle.plate_number}</span>
 </div>
 )}
 </div>
 )}

 {viewingInvoice.items && viewingInvoice.items.length > 0 && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">العناصر</h4>
 <div className="space-y-2">
 {viewingInvoice.items.map((item, idx) => (
 <div key={idx} className="bg-[#F7F7F5] rounded-lg p-2.5 text-xs">
 <div className="flex justify-between">
 <span className="text-[#111214] font-bold">{item.description}</span>
 <span className="text-[#111214] font-bold">{formatCurrency(item.total)} ر.س</span>
 </div>
 <div className="text-[#62666D] mt-1">
 الكمية: {item.quantity} × {formatCurrency(item.unit_price)} ر.س
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">المبالغ</h4>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-[#62666D]">المجموع الفرعي:</span>
 <span className="text-[#111214]">{formatCurrency(viewingInvoice.subtotal)} ر.س</span>
 </div>
 {viewingInvoice.discount > 0 && (
 <div className="flex justify-between">
 <span className="text-[#62666D]">الخصم:</span>
 <span className="text-[#DC2626]">-{formatCurrency(viewingInvoice.discount)} ر.س</span>
 </div>
 )}
 {viewingInvoice.tax_rate > 0 && (
 <div className="flex justify-between">
 <span className="text-[#62666D]">الضريبة ({viewingInvoice.tax_rate}%):</span>
 <span className="text-[#111214]">{formatCurrency(viewingInvoice.tax_amount)} ر.س</span>
 </div>
 )}
 <div className="flex justify-between font-bold text-base border-t border-[#E7E8EA] pt-2">
 <span className="text-[#111214]">الإجمالي:</span>
 <span className="text-[#DC2626]">{formatCurrency(viewingInvoice.total)} ر.س</span>
 </div>
 <div className="flex justify-between">
 <span className="text-[#62666D]">المدفوع:</span>
 <span className="text-[#059669]">{formatCurrency(viewingInvoice.paid_amount)} ر.س</span>
 </div>
 {viewingInvoice.total - viewingInvoice.paid_amount > 0 && (
 <div className="flex justify-between">
 <span className="text-[#62666D]">المتبقي:</span>
 <span className="text-[#D97706]">{formatCurrency(viewingInvoice.total - viewingInvoice.paid_amount)} ر.س</span>
 </div>
 )}
 </div>
 </div>

 {viewingInvoice.payments && viewingInvoice.payments.length > 0 && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">سجل الدفعات</h4>
 <div className="space-y-2">
 {viewingInvoice.payments.map((payment, idx) => (
 <div key={idx} className="bg-[#F7F7F5] rounded-lg p-2.5 text-xs flex justify-between items-center">
 <div>
 <span className="text-[#111214] font-bold">{formatCurrency(payment.amount)} ر.س</span>
 <span className="text-[#62666D] mr-2">({PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method})</span>
 </div>
 <span className="text-[#62666D]">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-GB') : '---'}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {viewingInvoice.total - viewingInvoice.paid_amount > 0 && viewingInvoice.status !== 'cancelled' && viewingInvoice.status !== 'refunded' && canUpdate && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <a href="/admin/payments" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition-all" onClick={() => setViewingInvoice(null)}>
 <FaMoneyBill className="text-[10px]" />
 تسجيل دفعة ({formatCurrency(viewingInvoice.total - viewingInvoice.paid_amount)} ر.س متبقي)
 </a>
 </div>
 )}

 {viewingInvoice.notes && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-2">ملاحظات</h4>
 <p className="text-sm text-[#111214] bg-[#F7F7F5] rounded-lg p-3">{viewingInvoice.notes}</p>
 </div>
 )}
  </div>
   )}
   </div>
   </div>
   )}

   {showCreateForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowCreateForm(false)}>
  <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
  <div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
  <FaFileInvoiceDollar className="text-[#DC2626] text-sm" />
  فاتورة جديدة
  </h3>
  <button onClick={() => setShowCreateForm(false)} className="text-[#62666D] hover:text-[#111214] transition"><FaTimes /></button>
  </div>

  <div className="space-y-4">
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">العميل *</label>
  <select value={createFormData.customer_id} onChange={e => setCreateFormData(p => ({ ...p, customer_id: e.target.value }))} className={`w-full bg-white border ${createErrors.customer_id ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer`}>
  <option value="">اختر العميل</option>
  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>)}
  </select>
  {createErrors.customer_id && <p className="text-[#DC2626] text-xs mt-1">{createErrors.customer_id}</p>}
  </div>

  <div className="border-t border-[#E7E8EA] pt-4">
  <div className="flex items-center justify-between mb-3">
  <h4 className="text-sm font-bold text-[#111214]">عناصر الفاتورة</h4>
  {createErrors.items && <p className="text-[#DC2626] text-xs">{createErrors.items}</p>}
  </div>
  {createFormData.items.map((item, idx) => (
  <div key={idx} className="bg-[#F7F7F5] rounded-xl p-3 mb-3 space-y-2">
  <div className="flex items-center justify-between">
  <span className="text-xs font-bold text-[#62666D]">عنصر {idx + 1}</span>
  {createFormData.items.length > 1 && (
  <button type="button" onClick={() => setCreateFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} className="text-[#DC2626] hover:text-[#9B1B30]"><FaTrash className="text-xs" /></button>
  )}
  </div>
  <div>
  <label className="text-[10px] font-bold text-[#62666D] mb-0.5 block">الوصف *</label>
  <input type="text" value={item.description} onChange={e => { const items = [...createFormData.items]; items[idx].description = e.target.value; setCreateFormData(p => ({ ...p, items })) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626]" placeholder="وصف العنصر" />
  </div>
  <div className="grid grid-cols-3 gap-2">
  <div>
  <label className="text-[10px] font-bold text-[#62666D] mb-0.5 block">الكمية</label>
  <input type="number" min="1" value={item.quantity} onChange={e => { const items = [...createFormData.items]; items[idx].quantity = parseInt(e.target.value) || 1; setCreateFormData(p => ({ ...p, items })) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
  </div>
  <div>
  <label className="text-[10px] font-bold text-[#62666D] mb-0.5 block">سعر الوحدة</label>
  <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => { const items = [...createFormData.items]; items[idx].unit_price = parseFloat(e.target.value) || 0; setCreateFormData(p => ({ ...p, items })) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
  </div>
  <div>
  <label className="text-[10px] font-bold text-[#62666D] mb-0.5 block">خدمة مرفقة</label>
  <select value={item.service_id} onChange={e => { const items = [...createFormData.items]; items[idx].service_id = e.target.value; setCreateFormData(p => ({ ...p, items })) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer">
  <option value="">بدون</option>
  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
  </select>
  </div>
  </div>
  </div>
  ))}
  <button type="button" onClick={() => setCreateFormData(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, service_id: '' }] }))} className="w-full py-2 border border-dashed border-[#E7E8EA] rounded-xl text-xs font-bold text-[#62666D] hover:bg-[#F7F7F5] transition flex items-center justify-center gap-1">
  <FaPlus className="text-[10px]" /> إضافة عنصر
  </button>
  </div>

  <div className="grid grid-cols-2 gap-3">
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">الخصم</label>
  <input type="number" min="0" step="0.01" value={createFormData.discount} onChange={e => setCreateFormData(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">نسبة الضريبة (%)</label>
  <input type="number" min="0" max="100" step="0.01" value={createFormData.tax_rate} onChange={e => setCreateFormData(p => ({ ...p, tax_rate: parseFloat(e.target.value) || 0 }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
  </div>
  </div>

  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">ملاحظات</label>
  <textarea rows={2} value={createFormData.notes} onChange={e => setCreateFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="ملاحظات..." />
  </div>

  <div className="flex gap-3 pt-2">
  <button onClick={handleCreateInvoice} disabled={createSubmitting} className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
  {createSubmitting ? <><FaSpinner className="animate-spin" /> جاري الإنشاء...</> : 'إنشاء الفاتورة'}
  </button>
  <button onClick={() => setShowCreateForm(false)} className="px-4 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all">إلغاء</button>
  </div>
  </div>
  </div>
 </div>
 )}

 {editingInvoice && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setEditingInvoice(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaPen className="text-[#2563EB] text-sm" />
 تعديل الفاتورة — {editingInvoice.invoice_number}
 </h3>
 <button onClick={() => setEditingInvoice(null)} className="text-[#62666D] hover:text-[#111214] transition"><FaTimes /></button>
 </div>

 <div className="space-y-4">
 {editItems.map((item, idx) => (
 <div key={idx} className="bg-[#F7F7F5] rounded-xl p-3 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-bold text-[#62666D]">عنصر {idx + 1}</span>
 {editItems.length > 1 && (
 <button type="button" onClick={() => setEditItems(p => p.filter((_, i) => i !== idx))} className="text-[#DC2626] hover:text-[#9B1B30]"><FaTrash className="text-xs" /></button>
 )}
 </div>
 <input type="text" value={item.description} onChange={e => { const items = [...editItems]; items[idx].description = e.target.value; setEditItems(items) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626]" placeholder="وصف العنصر" />
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="text-[10px] font-bold text-[#62666D] mb-0.5 block">الكمية</label>
 <input type="number" min="1" value={item.quantity} onChange={e => { const items = [...editItems]; items[idx].quantity = parseInt(e.target.value) || 1; setEditItems(items) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
 </div>
 <div>
 <label className="text-[10px] font-bold text-[#62666D] mb-0.5 block">سعر الوحدة</label>
 <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => { const items = [...editItems]; items[idx].unit_price = parseFloat(e.target.value) || 0; setEditItems(items) }} className="w-full bg-white border border-[#E7E8EA] rounded-lg px-2.5 py-2 text-xs text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
 </div>
 </div>
 </div>
 ))}
 <button type="button" onClick={() => setEditItems(p => [...p, { description: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, service_id: '' }])} className="w-full py-2 border border-dashed border-[#E7E8EA] rounded-xl text-xs font-bold text-[#62666D] hover:bg-[#F7F7F5] transition flex items-center justify-center gap-1">
 <FaPlus className="text-[10px]" /> إضافة عنصر
 </button>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الخصم</label>
 <input type="number" min="0" step="0.01" value={editFormData.discount} onChange={e => setEditFormData(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">نسبة الضريبة (%)</label>
 <input type="number" min="0" max="100" step="0.01" value={editFormData.tax_rate} onChange={e => setEditFormData(p => ({ ...p, tax_rate: parseFloat(e.target.value) || 0 }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
 </div>
 </div>

 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">ملاحظات</label>
 <textarea rows={2} value={editFormData.notes} onChange={e => setEditFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="ملاحظات..." />
 </div>

 <div className="flex gap-3 pt-2">
 <button onClick={handleEditSubmit} disabled={editSubmitting} className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
 {editSubmitting ? <><FaSpinner className="animate-spin" /> جاري الحفظ...</> : 'حفظ التعديلات'}
 </button>
 <button onClick={() => setEditingInvoice(null)} className="px-4 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}

 {showRefundModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowRefundModal(false)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaUndo className="text-[#7C3AED] text-sm" />
 استرجاع الفاتورة
 </h3>
 <button onClick={() => setShowRefundModal(false)} className="text-[#62666D] hover:text-[#111214] transition"><FaTimes /></button>
 </div>
 <div className="space-y-4">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">سبب الاسترجاع</label>
 <textarea rows={3} value={refundReason} onChange={e => setRefundReason(e.target.value)} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="سبب الاسترجاع (اختياري)..." />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={handleRefundSubmit} disabled={refundSubmitting} className="flex-1 px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
 {refundSubmitting ? <><FaSpinner className="animate-spin" /> جاري الاسترجاع...</> : 'تأكيد الاسترجاع'}
 </button>
 <button onClick={() => setShowRefundModal(false)} className="px-4 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
