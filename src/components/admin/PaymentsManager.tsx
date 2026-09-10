'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaMoneyBillWave,
 FaSearch,
 FaEye,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaUser,
 FaCalendarAlt,
 FaChevronRight,
 FaChevronLeft,
 FaCheckCircle,
 FaPlus,
} from 'react-icons/fa'

interface Payment {
 id: string
 invoice_id: string
 amount: number
 payment_method: string
 reference_number: string | null
 notes: string | null
 paid_at: string | null
 created_at: string
 invoice?: {
 id: string
 invoice_number: string
 total: number
 paid_amount: number
 status: string
 customer?: { id: string; full_name: string; phone: string }
 }
}

interface Pagination {
 page: number
 pageSize: number
 total: number
 totalPages: number
}

type Notification = { type: 'success' | 'error'; message: string } | null

const PAYMENT_METHOD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 cash: { label: 'نقدي', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
 card: { label: 'بطاقة', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
 bank_transfer: { label: 'تحويل بنكي', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]' },
 online: { label: 'أونلاين', color: 'text-[#0891B2]', bg: 'bg-[#ECFEFF] border-[#A5F3FC]' },
}

function formatCurrency(amount: number): string {
 return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export default function PaymentsManager() {
 const { hasPermission } = useAuth()
 const [payments, setPayments] = useState<Payment[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [viewingPayment, setViewingPayment] = useState<Payment | null>(null)
 const [loadingDetail, setLoadingDetail] = useState(false)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const totalPages = pagination?.totalPages || 1
 const canCreate = hasPermission('payments', 'create')
 const [showRecordPayment, setShowRecordPayment] = useState(false)
 const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; total: number; paid_amount: number; remaining: number; customer_name: string }[]>([])
 const [paymentForm, setPaymentForm] = useState({ invoice_id: '', amount: 0, payment_method: 'cash' as string, reference_number: '', notes: '' })
 const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({})
 const [paymentSubmitting, setPaymentSubmitting] = useState(false)

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

 const fetchPayments = useCallback(async () => {
 try {
 setLoading(true)
 const { getPayments } = await import('@/app/actions/payments')
 const result = await getPayments(debouncedSearch, page)
 if (result.success) {
 setPayments(result.data)
 if (result.pagination) setPagination(result.pagination)
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب المدفوعات' })
 } finally {
 setLoading(false)
 }
 }, [debouncedSearch, page])

 useEffect(() => { fetchPayments() }, [fetchPayments])
 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const handleViewPayment = async (payment: Payment) => {
 setViewingPayment(payment)
 setLoadingDetail(true)
 try {
 const { getPayment } = await import('@/app/actions/payments')
 const result = await getPayment(payment.id)
 if (result.success) setViewingPayment(result.data)
 } catch {} finally {
 setLoadingDetail(false)
 }
 }

 const handleOpenRecordPayment = async () => {
   setShowRecordPayment(true)
   if (invoices.length === 0) {
     try {
       const { getInvoices } = await import('@/app/actions/invoices')
       const res = await getInvoices(undefined, 'issued', 1, 500)
       if (res.success && res.data) {
         setInvoices(res.data.filter((i: { status: string; total: number; paid_amount: number }) => i.status !== 'cancelled' && i.status !== 'paid' && i.status !== 'refunded' && i.paid_amount < i.total).map((i: { id: string; invoice_number: string; total: number; paid_amount: number; customer?: { full_name: string } }) => ({
           id: i.id,
           invoice_number: i.invoice_number,
           total: i.total,
           paid_amount: i.paid_amount,
           remaining: i.total - i.paid_amount,
           customer_name: i.customer?.full_name || '---',
         })))
       }
     } catch {}
   }
 }

 const handleRecordPaymentSubmit = async () => {
   setPaymentErrors({})
   const errs: Record<string, string> = {}
   if (!paymentForm.invoice_id) errs.invoice_id = 'يرجى اختيار الفاتورة'
   if (!paymentForm.amount || paymentForm.amount <= 0) errs.amount = 'المبلغ يجب أن يكون أكبر من صفر'
   if (!paymentForm.payment_method) errs.payment_method = 'طريقة الدفع مطلوبة'
   if (Object.keys(errs).length > 0) { setPaymentErrors(errs); return }
   setPaymentSubmitting(true)
   try {
     const { recordPayment } = await import('@/app/actions/payments')
     const result = await recordPayment({
       invoice_id: paymentForm.invoice_id,
       amount: paymentForm.amount,
        payment_method: paymentForm.payment_method as 'cash' | 'card' | 'bank_transfer' | 'online',
       reference_number: paymentForm.reference_number || undefined,
       notes: paymentForm.notes || undefined,
     })
     if (result.success) {
       setNotification({ type: 'success', message: 'تم تسجيل الدفعة بنجاح' })
       setShowRecordPayment(false)
       setPaymentForm({ invoice_id: '', amount: 0, payment_method: 'cash', reference_number: '', notes: '' })
       fetchPayments()
     } else {
       setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
   } finally {
     setPaymentSubmitting(false)
   }
 }

 const methodBadge = (method: string) => {
 const c = PAYMENT_METHOD_CONFIG[method] || { label: method, color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' }
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

 <div className="flex items-center justify-between">
 <h1 className="text-2xl font-black text-[#111214] flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
 <FaMoneyBillWave className="text-[#059669] text-sm" />
 </div>
 المدفوعات
 </h1>
 {canCreate && (
 <button onClick={handleOpenRecordPayment} className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
 <FaPlus className="text-xs" />
 تسجيل دفعة
 </button>
 )}
 </div>

 <div className="relative flex-1">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث برقم الفاتورة أو اسم العميل أو الجوال أو المرجع..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-2.5 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 />
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <div className="w-10 h-10 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 </div>
 ) : payments.length === 0 ? (
 <div className="text-center py-16">
 <FaBoxOpen className="text-5xl text-[#62666D] mx-auto mb-4" />
 <p className="text-[#62666D] font-bold">لا توجد مدفوعات</p>
 </div>
 ) : (
 <>
 <div className="space-y-2 sm:space-y-3">
 {payments.map(payment => (
 <div key={payment.id} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3 sm:p-4 hover:border-[#FECACA] transition-all group">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1.5 flex-wrap">
 <FaMoneyBillWave className="text-[#059669] text-xs" />
 <span className="text-sm font-bold text-[#111214]">{formatCurrency(payment.amount)} ر.س</span>
 {methodBadge(payment.payment_method)}
 </div>
 <div className="flex items-center gap-3 text-xs text-[#62666D] flex-wrap">
 {payment.invoice && (
 <>
 <span className="flex items-center gap-1">
 فاتورة: {payment.invoice.invoice_number}
 </span>
 {payment.invoice.customer && (
 <span className="flex items-center gap-1">
 <FaUser className="text-[9px]" />
 {payment.invoice.customer.full_name}
 </span>
 )}
 </>
 )}
 </div>
 <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#62666D]">
 {payment.paid_at && (
 <span className="flex items-center gap-1">
 <FaCalendarAlt className="text-[8px]" />
 {new Date(payment.paid_at).toLocaleDateString('ar-SA')}
 </span>
 )}
 {payment.reference_number && (
 <span>مرجع: {payment.reference_number}</span>
 )}
 </div>
 </div>
 <button
 onClick={() => handleViewPayment(payment)}
 className="p-2 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] hover:text-[#111214] rounded-lg transition-all shrink-0"
 >
 <FaEye className="text-[10px]" />
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

 {viewingPayment && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingPayment(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaMoneyBillWave className="text-[#059669] text-sm" />
 تفاصيل الدفعة
 </h3>
 <button onClick={() => setViewingPayment(null)} className="text-[#62666D] hover:text-[#111214] transition">
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
 <span className="text-[#62666D]">المبلغ:</span>
 <span className="text-[#111214] font-bold text-lg">{formatCurrency(viewingPayment.amount)} ر.س</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">طريقة الدفع:</span>
 {methodBadge(viewingPayment.payment_method)}
 </div>
 {viewingPayment.reference_number && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">المرجع:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingPayment.reference_number}</span>
 </div>
 )}
 {viewingPayment.paid_at && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">تاريخ الدفع:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingPayment.paid_at).toLocaleDateString('ar-SA')}</span>
 </div>
 )}

 {viewingPayment.invoice && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-3">الفاتورة المرتبطة</h4>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-[#62666D]">رقم الفاتورة:</span>
 <span className="text-[#111214] font-bold">{viewingPayment.invoice.invoice_number}</span>
 </div>
 {viewingPayment.invoice.customer && (
 <div className="flex justify-between">
 <span className="text-[#62666D]">العميل:</span>
 <span className="text-[#111214] font-bold">{viewingPayment.invoice.customer.full_name}</span>
 </div>
 )}
 <div className="flex justify-between">
 <span className="text-[#62666D]">إجمالي الفاتورة:</span>
 <span className="text-[#111214] font-bold">{formatCurrency(viewingPayment.invoice.total)} ر.س</span>
 </div>
 <div className="flex justify-between">
 <span className="text-[#62666D]">المدفوع:</span>
 <span className="text-[#059669] font-bold">{formatCurrency(viewingPayment.invoice.paid_amount)} ر.س</span>
 </div>
 </div>
 </div>
 )}

 {viewingPayment.notes && (
 <div className="border-t border-[#E7E8EA] pt-4">
 <h4 className="text-xs font-bold text-[#62666D] mb-2">ملاحظات</h4>
 <p className="text-sm text-[#111214] bg-[#F7F7F5] rounded-lg p-3">{viewingPayment.notes}</p>
 </div>
 )}
 </div>
 )}
  </div>
  </div>
  )}

  {showRecordPayment && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowRecordPayment(false)}>
  <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
  <div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
  <FaMoneyBillWave className="text-[#059669] text-sm" />
  تسجيل دفعة
  </h3>
  <button onClick={() => setShowRecordPayment(false)} className="text-[#62666D] hover:text-[#111214] transition"><FaTimes /></button>
  </div>

  <div className="space-y-4">
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">الفاتورة *</label>
  <select value={paymentForm.invoice_id} onChange={e => {
    const inv = invoices.find(i => i.id === e.target.value)
    setPaymentForm(p => ({ ...p, invoice_id: e.target.value, amount: inv ? inv.remaining : p.amount }))
  }} className={`w-full bg-white border ${paymentErrors.invoice_id ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer`}>
  <option value="">اختر الفاتورة</option>
  {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name} (متبقي: {formatCurrency(i.remaining)} ر.س)</option>)}
  </select>
  {paymentErrors.invoice_id && <p className="text-[#DC2626] text-xs mt-1">{paymentErrors.invoice_id}</p>}
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">المبلغ *</label>
  <input type="number" min="0.01" step="0.01" value={paymentForm.amount || ''} onChange={e => setPaymentForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className={`w-full bg-white border ${paymentErrors.amount ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="0.00" dir="ltr" />
  {paymentErrors.amount && <p className="text-[#DC2626] text-xs mt-1">{paymentErrors.amount}</p>}
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">طريقة الدفع *</label>
  <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer">
  <option value="cash">نقدي</option>
  <option value="card">بطاقة</option>
  <option value="bank_transfer">تحويل بنكي</option>
  <option value="online">أونلاين</option>
  </select>
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">رقم المرجع</label>
  <input type="text" value={paymentForm.reference_number} onChange={e => setPaymentForm(p => ({ ...p, reference_number: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" placeholder="اختياري" />
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">ملاحظات</label>
  <textarea rows={2} value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="ملاحظات..." />
  </div>
  <div className="flex gap-3 pt-2">
  <button onClick={handleRecordPaymentSubmit} disabled={paymentSubmitting} className="flex-1 px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
  {paymentSubmitting ? <><FaSpinner className="animate-spin" /> جاري التسجيل...</> : 'تسجيل الدفعة'}
  </button>
  <button onClick={() => setShowRecordPayment(false)} className="px-4 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all">إلغاء</button>
  </div>
  </div>
  </div>
  </div>
  )}
  </div>
  )
}
