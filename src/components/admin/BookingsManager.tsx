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
 FaChevronDown,
 FaSync,
 FaClock,
 FaPlus,
 FaUser,
 FaTrash,
 FaExchangeAlt,
 FaCalendarPlus,
 FaCheckCircle,
 FaBan,
 FaWrench,
 FaHistory,
 FaInfoCircle,
 FaUserTag,
 FaFileInvoiceDollar,
FaShieldAlt,
 FaEdit,
 FaCheck,
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
 linked_invoice?: { id: string; invoice_number: string; status: string } | null
}

interface BookingDetail extends Booking {
 customer?: { id: string; full_name: string; phone: string; email: string | null }
 vehicle?: { id: string; make: string; model: string; year: number | null; color: string | null; plate_number: string | null; vin: string | null }
 service?: { id: string; name: string; base_price: number; duration_minutes: number | null }
 status_history?: { id: string; old_status: string | null; new_status: string; changed_by: string | null; changed_by_name: string | null; notes: string | null; created_at: string }[]
 booking_items?: { id: string; service_id: string; quantity: number; unit_price: number; total: number; service?: { id: string; name: string; base_price: number } }[]
 linked_invoice?: { id: string; invoice_number: string; status: string; total: number; paid_amount: number; created_at: string } | null
 warranty_start_date?: string | null
 warranty_end_date?: string | null
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

const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WEEKDAY_HEADERS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const toArabicDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة']
const hijriIntl = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric', day: 'numeric' })
const toHijri = (iso: string) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const parts = hijriIntl.formatToParts(new Date(y, m - 1, d))
  const num = (t: string) => Number(parts.find(p => p.type === t)?.value || 0)
  return { y: num('year'), m: num('month'), d: num('day') }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'جديد', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
  contacted: { label: 'تم التواصل', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]' },
  in_progress: { label: 'قيد التنفيذ', color: 'text-[#EA580C]', bg: 'bg-[#FFF7ED] border-orange-500/20' },
  completed: { label: 'مكتمل', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
  cancelled: { label: 'ملغي', color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' },
}

const STATUS_META: Record<string, { icon: React.ReactNode; iconBg: string; iconColor: string }> = {
  new: { icon: <FaClock />, iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#2563EB]' },
  contacted: { icon: <FaPhone />, iconBg: 'bg-[#FAF5FF]', iconColor: 'text-[#7C3AED]' },
  in_progress: { icon: <FaWrench />, iconBg: 'bg-[#FFF7ED]', iconColor: 'text-[#EA580C]' },
  completed: { icon: <FaCheckCircle />, iconBg: 'bg-[#ECFDF5]', iconColor: 'text-[#059669]' },
  cancelled: { icon: <FaBan />, iconBg: 'bg-[#F6F6F6]', iconColor: 'text-[#62666D]' },
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'cancelled'],
  contacted: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'مسودة', color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' },
  issued: { label: 'صادرة', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
  partially_paid: { label: 'مدفوعة جزئياً', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB] border-[#FDE68A]' },
  paid: { label: 'مدفوعة', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
  cancelled: { label: 'ملغاة', color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2] border-[#FECACA]' },
  refunded: { label: 'مسترجعة', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]' },
}

export default function BookingsManager() {
  const { hasPermission, staffInfo } = useAuth()
  const isSuperAdmin = staffInfo?.role === 'super_admin'
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

const [activeStatusDropdown, setActiveStatusDropdown] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null)
  const [deleteToken, setDeleteToken] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
 const [warrantyStart, setWarrantyStart] = useState('')
 const [warrantyEnd, setWarrantyEnd] = useState('')
 const [warrantyYears, setWarrantyYears] = useState(1)
 const [warrantyEditing, setWarrantyEditing] = useState(false)
 const [savingWarranty, setSavingWarranty] = useState(false)
 const [calYear, setCalYear] = useState(new Date().getFullYear())
 const [calMonth, setCalMonth] = useState(new Date().getMonth())
 const [calMode, setCalMode] = useState<'miladi' | 'hijri'>('miladi')
 const [invoiceView, setInvoiceView] = useState<{ loading: boolean; data: { id: string; invoice_number: string; status: string; total: number; paid_amount: number; created_at: string; items?: { id: string; description: string; quantity: number; unit_price: number; total: number; service?: { id: string; name: string } }[]; payments?: { id: string; amount: number; payment_method: string | null; paid_at: string | null }[] } | null }>({ loading: false, data: null })

 const canUpdate = hasPermission('bookings', 'update')
 const canCreate = hasPermission('bookings', 'create')
 const canManage = hasPermission('bookings', 'manage')
 const [showCreateForm, setShowCreateForm] = useState(false)
 const [services, setServices] = useState<{ id: string; name: string; base_price: number }[]>([])
 const [createFormData, setCreateFormData] = useState({
   customerName: '',
   customerPhone: '',
   customerEmail: '',
   vehicleMake: '',
   vehicleModel: '',
   vehicleYear: new Date().getFullYear().toString(),
   vehicleColor: '',
   vehiclePlate: '',
   serviceId: '',
   preferredDate: '',
   preferredTime: '',
   notes: '',
 })
 const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
 const [createSubmitting, setCreateSubmitting] = useState(false)
 const [createNotification, setCreateNotification] = useState<Notification>(null)

 useEffect(() => {
   if (canCreate && window.location.search.includes('create=true')) {
     setShowCreateForm(true)
   }
 }, [canCreate])

 useEffect(() => {
   if (showCreateForm && services.length === 0) {
     import('@/app/actions/services').then(({ getServices }) => {
       getServices().then(res => {
         if (res.success) setServices(res.data || [])
       })
     })
   }
 }, [showCreateForm, services.length])

 useEffect(() => {
   if (!createNotification) return
   const t = setTimeout(() => setCreateNotification(null), 4000)
   return () => clearTimeout(t)
 }, [createNotification])

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

  const getAvailableStatuses = (booking: Booking): string[] => {
    if (isSuperAdmin && booking.status !== 'completed') {
      return Object.keys(STATUS_CONFIG).filter(s => s !== booking.status)
    }
    if (!canUpdate) return []
    return VALID_TRANSITIONS[booking.status] || []
  }

  useEffect(() => {
    if (!activeStatusDropdown) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest('[data-status-dropdown]')) {
        setActiveStatusDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeStatusDropdown])

  const handleViewBooking = async (booking: Booking) => {
 setViewingBooking(booking as BookingDetail)
 setWarrantyEditing(false)
 setInvoiceView({ loading: false, data: null })
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

 const handleSaveWarranty = async () => {
  if (!viewingBooking) return
  setSavingWarranty(true)
  try {
  const { updateBookingWarranty } = await import('@/app/actions/bookings')
  const result = await updateBookingWarranty(viewingBooking.id, warrantyStart || null, warrantyEnd || null)
  if (result.success) {
  setNotification({ type: 'success', message: 'تم حفظ الضمان بنجاح' })
  setViewingBooking(prev => prev ? { ...prev, warranty_start_date: warrantyStart || null, warranty_end_date: warrantyEnd || null } : prev)
  setWarrantyEditing(false)
  } else {
  setNotification({ type: 'error', message: result.error || 'حدث خطأ غير متوقع' })
  }
  } catch {
  setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
  } finally {
  setSavingWarranty(false)
  }
 }

 const computeWarrantyEnd = (start: string, years: number) => {
  if (!start || !years || years <= 0) return ''
  const [y, m, d] = start.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCFullYear(date.getUTCFullYear() + years)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

const yearsFromDates = (start: string, end: string) => {
  if (!start || !end) return 1
  const s = Date.parse(start)
  const e = Date.parse(end)
  const years = Math.max(1, Math.round((e - s) / (365.25 * 24 * 3600 * 1000)))
  return Math.min(10, years)
}

const handleWarrantyStartChange = (v: string) => {
  setWarrantyStart(v)
  setWarrantyEnd(computeWarrantyEnd(v, warrantyYears))
}

const handleWarrantyYearsChange = (y: number) => {
  setWarrantyYears(y)
  setWarrantyEnd(computeWarrantyEnd(warrantyStart, y))
}

 const moveCal = (delta: number) => {
  const d = new Date(calYear, calMonth + delta, 1)
  setCalYear(d.getFullYear())
  setCalMonth(d.getMonth())
 }

 useEffect(() => {
  if (warrantyEditing && warrantyStart) {
   const d = new Date(warrantyStart + 'T00:00:00')
   setCalYear(d.getFullYear())
   setCalMonth(d.getMonth())
  }
 }, [warrantyEditing])

 const calDays: (string | null)[] = (() => {
  const first = new Date(calYear, calMonth, 1)
  const offset = first.getDay()
  const total = new Date(calYear, calMonth + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(`${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  return cells
 })()

 const now = new Date()
 const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

 const calFirstIso = calDays.find(Boolean) || ''
 const formatStartDisplay = (iso: string) => {
  if (!iso) return 'اختر التاريخ'
  if (calMode === 'hijri') {
   const h = toHijri(iso)
   return h ? `${h.d}/${h.m}/${h.y} هـ` : toArabicDate(iso)
  }
  return toArabicDate(iso)
 }

 const formatEndDisplay = (iso: string) => {
  if (!iso) return '—'
  if (calMode === 'hijri') {
   const h = toHijri(iso)
   return h ? `${h.d}/${h.m}/${h.y} هـ` : toArabicDate(iso)
  }
  return toArabicDate(iso)
 }

 const handleOpenInvoice = async (invoiceIdArg?: string) => {
 const id = invoiceIdArg || viewingBooking?.linked_invoice?.id
 if (!id) return
 setInvoiceView({ loading: true, data: null })
 try {
 const { getInvoice } = await import('@/app/actions/invoices')
 const result = await getInvoice(id)
 if (result.success) {
 setInvoiceView({ loading: false, data: result.data })
 } else {
 setInvoiceView({ loading: false, data: null })
 setNotification({ type: 'error', message: result.error || 'تعذر جلب الفاتورة' })
 }
 } catch {
 setInvoiceView({ loading: false, data: null })
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 }
 }

 const handleDeleteBooking = async () => {
   if (!deleteTarget) return
   setDeleteLoading(true)
   setDeleteError('')
   try {
     const { sha256 } = await import('@/lib/crypto')
     const { deleteBooking } = await import('@/app/actions/bookings')
     const tokenHash = await sha256(deleteToken)
     const result = await deleteBooking(deleteTarget.id, tokenHash)
     if (result.success) {
       setNotification({ type: 'success', message: 'تم حذف الحجز بنجاح' })
       setDeleteTarget(null)
       setDeleteToken('')
       fetchBookings()
       fetchStats()
     } else {
       setDeleteError(result.error || 'حدث خطأ')
     }
   } catch {
     setDeleteError('حدث خطأ غير متوقع')
   } finally {
     setDeleteLoading(false)
   }
 }

 const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

 const handleCreateBookingSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setCreateErrors({})
  const errs: Record<string, string> = {}
  if (!createFormData.customerName.trim() || createFormData.customerName.trim().length < 2) errs.customerName = 'اسم العميل مطلوب (حرفين على الأقل)'
  if (!createFormData.customerPhone.trim() || createFormData.customerPhone.trim().length < 5) errs.customerPhone = 'رقم الهاتف مطلوب'
  if (!createFormData.vehicleMake.trim()) errs.vehicleMake = 'ماركة السيارة مطلوبة'
  if (!createFormData.vehicleModel.trim()) errs.vehicleModel = 'موديل السيارة مطلوب'
  const yr = parseInt(createFormData.vehicleYear)
  if (!createFormData.vehicleYear || yr < 1900 || yr > new Date().getFullYear() + 1) errs.vehicleYear = 'سنة الصنع غير صحيحة'
  if (!createFormData.serviceId) errs.serviceId = 'يرجى اختيار الخدمة'
  if (!createFormData.preferredDate) errs.preferredDate = 'التاريخ المفضل مطلوب'
  if (!createFormData.preferredTime) errs.preferredTime = 'الوقت المفضل مطلوب'
  if (Object.keys(errs).length > 0) { setCreateErrors(errs); return }
  setCreateSubmitting(true)
  try {
  const { adminCreateBooking } = await import('@/app/actions/bookings')
  const result = await adminCreateBooking({
  customerName: createFormData.customerName.trim(),
  customerPhone: createFormData.customerPhone.trim(),
  customerEmail: createFormData.customerEmail.trim() || undefined,
  vehicleMake: createFormData.vehicleMake.trim(),
  vehicleModel: createFormData.vehicleModel.trim(),
  vehicleYear: parseInt(createFormData.vehicleYear),
  vehicleColor: createFormData.vehicleColor.trim() || undefined,
  vehiclePlate: createFormData.vehiclePlate.trim() || undefined,
  serviceId: createFormData.serviceId,
  preferredDate: createFormData.preferredDate,
  preferredTime: createFormData.preferredTime,
  notes: createFormData.notes.trim() || undefined,
  })
  if (result.success) {
  setCreateNotification({ type: 'success', message: 'تم إنشاء الحجز بنجاح' })
  setShowCreateForm(false)
  setCreateFormData({ customerName: '', customerPhone: '', customerEmail: '', vehicleMake: '', vehicleModel: '', vehicleYear: new Date().getFullYear().toString(), vehicleColor: '', vehiclePlate: '', serviceId: '', preferredDate: '', preferredTime: '', notes: '' })
  fetchBookings()
  fetchStats()
  } else {
  setCreateNotification({ type: 'error', message: result.error || 'حدث خطأ' })
  }
  } catch {
  setCreateNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
  } finally {
  setCreateSubmitting(false)
  }
 }

const statusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${config.bg} ${config.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {config.label}
    </span>
  )
  }

const statusIcon = (status: string) => {
  switch (status) {
    case 'new': return <FaClock className="text-current" />
    case 'contacted': return <FaPhone className="text-current" />
    case 'in_progress': return <FaWrench className="text-current" />
    case 'completed': return <FaCheckCircle className="text-current" />
    case 'cancelled': return <FaBan className="text-current" />
    default: return <FaInfoCircle className="text-current" />
  }
}

  const TERMINAL_STATUSES = ['completed', 'cancelled']

  // Revert target for an accidentally cancelled booking: the status it was
  // cancelled from (matching the server rule in updateBookingStatus), else 'new'.
  const cancelRevertTarget = (booking: Booking | BookingDetail): string => {
  if (booking.status !== 'cancelled') return 'new'
  const history = (booking as BookingDetail).status_history
  if (!history?.length) return 'new'
  const lastCancel = [...history].reverse().find(h => h.new_status === 'cancelled')
  const prev = lastCancel?.old_status
  return prev && !TERMINAL_STATUSES.includes(prev) ? prev : 'new'
  }

 const totalPages = pagination?.totalPages || 1

 return (
 <div className="space-y-6">
 {notification && (
 <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl shadow-2xl border font-bold text-sm flex items-center gap-3 animate-bounceIn ${
 notification.type === 'success'
 ? 'bg-white border-[#A7F3D0] text-[#059669]'
 : 'bg-white border-[#FECACA] text-[#DC2626]'
 }`}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
 notification.type === 'success' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
 }`}>
 {notification.type === 'success' ? <FaSync /> : <FaExclamationTriangle />}
 </div>
 {notification.message}
 <button onClick={() => setNotification(null)} className="mr-2 opacity-50 hover:opacity-100 transition">
 <FaTimes className="text-xs" />
 </button>
 </div>
 )}

 {/* ===== Header ===== */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3.5">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#9B1B30] flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
 <FaCalendarAlt className="text-white text-lg" />
 </div>
 <div>
<h1 className="text-2xl md:text-3xl font-black text-[#111214]">إدارة الحجوزات</h1>
  <p className="text-[#62666D] text-sm md:text-base mt-1 font-medium">عرض وإدارة حجوزات العملاء</p>
 </div>
 </div>
 {canCreate && (
 <button
 onClick={() => setShowCreateForm(true)}
 className="px-5 py-2.5 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] hover:from-[#9B1B30] hover:to-[#7A1526] text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-red-500/25 hover:shadow-red-500/30 flex items-center justify-center gap-2"
 >
 <FaPlus className="text-xs" />
 حجز جديد
 </button>
 )}
 </div>

 {/* ===== Stats ===== */}
 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
 {Object.entries(STATUS_CONFIG).map(([key, config]) => {
 const meta = STATUS_META[key] || STATUS_META.new
 const active = statusFilter === key
 return (
 <button
 key={key}
 onClick={() => { setStatusFilter(active ? 'all' : key); setPage(1) }}
 className={`group relative overflow-hidden rounded-2xl p-5 border-2 text-right transition-all duration-200 ${
 active
 ? `${config.bg} ${config.color} border-current shadow-lg shadow-black/[0.06] -translate-y-0.5`
 : 'bg-white border-[#E7E8EA] hover:border-[#D4D6DA] hover:shadow-lg hover:shadow-black/[0.05] hover:-translate-y-0.5'
 }`}
 >
 {active && (
 <div className="absolute top-0 right-0 left-0 h-1 bg-current opacity-70"></div>
 )}
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className={`text-3xl sm:text-[34px] font-black leading-none tracking-tight ${active ? config.color : 'text-[#62666D]'}`}>{stats.counts[key] || 0}</div>
 <div className={`text-sm sm:text-[15px] font-black mt-3 ${active ? config.color : 'text-[#62666D]'}`}>{config.label}</div>
 </div>
 <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all duration-200 ${meta.iconBg} ${meta.iconColor} ${active ? 'opacity-100 scale-105' : 'opacity-60 group-hover:opacity-100 group-hover:scale-105'}`}>
 {meta.icon}
 </div>
 </div>
 </button>
 )
 })}
 </div>
 )}

{/* ===== Search ===== */}
<div className="relative max-w-xl w-full">
  <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-[#62666D] text-base" />
  <input
  type="text"
  placeholder="بحث بالاسم أو الجوال أو الماركة أو رقم اللوحة..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="w-full bg-white border border-[#E7E8EA] shadow-sm shadow-black/[0.02] rounded-2xl pr-11 pl-11 py-4 text-[17px] font-semibold text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all placeholder:text-[17px] placeholder:text-[#62666D] placeholder:font-medium"
  />
  {search && (
  <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#111214] transition">
  <FaTimes className="text-sm" />
  </button>
  )}
  </div>

 {/* ===== List ===== */}
 {loading ? (
 <div className="flex items-center justify-center py-24">
 <div className="flex flex-col items-center gap-4">
 <div className="w-11 h-11 border-[3px] border-[#FECACA] border-t-[#DC2626] rounded-full animate-spin shadow-sm"></div>
 <span className="text-sm text-[#62666D] font-medium">جاري تحميل الحجوزات...</span>
 </div>
 </div>
 ) : bookings.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-[#62666D]">
 <div className="w-20 h-20 rounded-3xl bg-white border border-[#E7E8EA] shadow-sm flex items-center justify-center mb-5">
 <FaBoxOpen className="text-3xl text-[#D4D6DA]" />
 </div>
 <p className="font-bold text-[#111214]">لا توجد حجوزات</p>
 <p className="text-xs text-[#62666D] mt-1">لم يتم العثور على حجوزات تطابق البحث الحالي</p>
 </div>
 ) : (
 <>
 <div className="grid gap-3">
 {bookings.map((booking) => {
 const meta = STATUS_META[booking.status] || STATUS_META.new
 return (
 <div
 key={booking.id}
 className="group relative bg-white rounded-2xl border border-[#E7E8EA] hover:border-[#D4D6DA] hover:shadow-lg hover:shadow-black/[0.04] p-4 transition-all duration-200"
 >
 <div className="flex items-center gap-4">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-black/[0.04] ${meta.iconBg} ${meta.iconColor} group-hover:scale-105 transition-transform duration-200`}>
 {meta.icon}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h4 className="text-[17px] font-bold text-[#111214] truncate">
 {booking.customer?.full_name || 'عميل'}
 </h4>
 {statusBadge(booking.status)}
 </div>
 <div className="flex items-center gap-x-3 gap-y-1 mt-2 text-[14px] text-[#62666D] font-semibold flex-wrap">
 {booking.customer?.phone && (
 <span className="flex items-center gap-1.5 font-bold" dir="ltr">
 <FaPhone className="text-[#059669] text-[10px]" />
 {booking.customer.phone}
 </span>
 )}
 {booking.vehicle && (
 <span className="flex items-center gap-1.5 font-bold">
 <FaCar className="text-[#62666D] text-[10px]" />
 {booking.vehicle.make} {booking.vehicle.model}
 </span>
 )}
 {booking.service && (
 <span className="flex items-center gap-1.5 font-bold">
 <FaWrench className="text-[#62666D] text-[10px]" />
 {booking.service.name}
 </span>
 )}
 <span className="flex items-center gap-1.5 font-bold">
 <FaClock className="text-[#62666D] text-[10px]" />
 {new Date(booking.created_at).toLocaleDateString('en-GB')}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 {canUpdate && getAvailableStatuses(booking).length > 0 && (
 <div className="relative" data-status-dropdown>
 <button
 type="button"
 onClick={() => setActiveStatusDropdown(activeStatusDropdown === booking.id ? null : booking.id)}
 className="h-9 px-3 bg-[#F7F7F5] hover:bg-[#111214] hover:text-white border border-[#E7E8EA] text-[#111214] rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
 >
 <FaExchangeAlt className="text-[10px]" />
 <span className="hidden sm:inline">تغيير</span>
 <FaChevronDown className={`text-[8px] transition-transform duration-200 ${activeStatusDropdown === booking.id ? 'rotate-180' : ''}`} />
 </button>
 {activeStatusDropdown === booking.id && (
 <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-[#E7E8EA] rounded-2xl shadow-2xl shadow-black/10 min-w-[190px] py-1.5 animate-fadeIn overflow-hidden">
 <div className="px-3.5 py-2 text-[10px] font-bold text-[#62666D] bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-1.5">
 <FaExchangeAlt className="text-[9px]" />
 تغيير الحالة إلى
 </div>
 {getAvailableStatuses(booking).map((nextStatus) => {
 const cfg = STATUS_CONFIG[nextStatus]
 return (
 <button
 key={nextStatus}
 onClick={() => { setActiveStatusDropdown(null); handleStatusUpdate(booking.id, nextStatus) }}
 disabled={updatingStatus === booking.id}
 className={`w-full text-right px-3.5 py-2.5 text-xs font-bold flex items-center gap-2.5 hover:bg-[#F7F7F5] transition-all disabled:opacity-50 ${cfg.color}`}
 >
 <span className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0"></span>
 {cfg.label}
 {updatingStatus === booking.id && <FaSpinner className="animate-spin mr-auto text-[10px]" />}
 </button>
 )
 })}
 </div>
 )}
 </div>
 )}
 <button
 onClick={() => handleViewBooking(booking)}
 title="عرض التفاصيل"
 className="w-9 h-9 rounded-xl bg-[#F7F7F5] hover:bg-[#DC2626] hover:text-white border border-[#E7E8EA] text-[#111214] transition-all duration-200 flex items-center justify-center"
 >
 <FaEye className="text-[13px]" />
 </button>
 {isSuperAdmin && (
 <button
 onClick={() => { setDeleteTarget(booking); setDeleteError('') }}
 title="حذف الحجز"
 className="w-9 h-9 rounded-xl bg-[#FEF2F2] hover:bg-[#DC2626] hover:text-white border border-[#FECACA] text-[#DC2626] transition-all duration-200 flex items-center justify-center"
 >
<FaTrash className="text-[13px]" />
  </button>
  )}
  </div>
  </div>

  {booking.status === 'completed' && (
  <div className="mt-3 pt-3 border-t border-[#F1F2F3] flex items-center justify-between gap-3 flex-wrap">
  <div className="flex items-center gap-2 flex-wrap">
  <span className="text-[#4B4F55] font-bold text-sm flex items-center gap-1.5"><FaCheckCircle className="text-[#059669] text-xs" /> الخدمة:</span>
  <span className="text-[#111214] font-bold text-sm">{booking.service?.name || '---'}</span>
  {typeof booking.service?.base_price === 'number' && (
  <span className="text-[#DC2626] font-black text-sm" dir="ltr">{booking.service.base_price.toLocaleString('en-US')} ر.س</span>
  )}
  <span className="text-[#62666D] text-xs font-semibold flex items-center gap-1">
  <FaClock className="text-[#059669] text-[10px]" />
  {new Date(booking.preferred_date || booking.created_at.slice(0, 10)).toLocaleDateString('en-GB')}
  </span>
  </div>
  {booking.linked_invoice && (
  <button
  onClick={() => handleOpenInvoice(booking.linked_invoice?.id)}
  className="flex items-center gap-1.5 text-xs font-bold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-3 py-1.5 hover:bg-[#DBEAFE] transition-all shrink-0"
  >
  <FaFileInvoiceDollar className="text-[11px]" />
  عرض الفاتورة
  </button>
  )}
  </div>
  )}
  </div>
  )
  })}
  </div>

 {/* ===== Pagination ===== */}
 {pagination && pagination.total > 0 && (
 <div className="flex items-center justify-between mt-4 px-1 gap-3">
 <span className="text-xs text-[#62666D] font-semibold">
 <span className="font-black text-[#111214]">{pagination.total}</span> نتيجة — صفحة <span className="font-black text-[#111214]">{pagination.page}</span> من {pagination.totalPages}
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="h-9 px-4 bg-white hover:bg-[#111214] hover:text-white border border-[#E7E8EA] text-[#111214] rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#111214] flex items-center gap-1.5"
 >
 <FaChevronRight className="text-[10px]" />
 السابق
 </button>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page >= totalPages}
 className="h-9 px-4 bg-white hover:bg-[#111214] hover:text-white border border-[#E7E8EA] text-[#111214] rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#111214] flex items-center gap-1.5"
 >
 التالي
 <FaChevronLeft className="text-[10px]" />
 </button>
 </div>
 </div>
 )}
 </>
 )}

 {/* ===== Detail Modal ===== */}
 {viewingBooking && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingBooking(null)}>
 <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

 <div className="sticky top-0 z-10 bg-white border-b border-[#E7E8EA] px-5 sm:px-6 py-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#9B1B30] flex items-center justify-center shrink-0">
 <FaCalendarAlt className="text-white" />
 </div>
 <div>
 <h3 className="font-bold text-[#111214]">تفاصيل الحجز</h3>
 <p className="text-xs text-[#62666D] mt-0.5">{viewingBooking.customer?.full_name || 'عميل'}</p>
 </div>
 </div>
 <div className="flex items-center gap-1">
 {isSuperAdmin && (
 <button
 onClick={() => { setDeleteTarget(viewingBooking); setDeleteError('') }}
 className="text-[#DC2626] hover:bg-[#FEF2F2] p-2.5 rounded-xl transition-all"
 title="حذف الحجز"
 >
 <FaTrash className="text-sm" />
 </button>
 )}
 <button onClick={() => setViewingBooking(null)} className="text-[#62666D] hover:text-[#111214] hover:bg-[#F7F7F5] p-2.5 rounded-xl transition-all">
 <FaTimes className="text-sm" />
 </button>
 </div>
 </div>

{loadingDetail ? (
  <div className="flex items-center justify-center py-24">
  <div className="w-9 h-9 border-[3px] border-[#FECACA] border-t-[#DC2626] rounded-full animate-spin"></div>
  </div>
  ) : (
  <>
  {/* حالة الحجز */}
  <div className="px-5 sm:px-6 pt-5">
  <div className={`rounded-2xl border-2 ${STATUS_CONFIG[viewingBooking.status]?.bg || 'bg-[#F1F2F3] border-[#E7E8EA]'} ${STATUS_CONFIG[viewingBooking.status]?.color || 'text-[#62666D]'} px-4 py-4 flex items-center justify-between gap-3 shadow-sm`}>
  <div>
  <p className="text-[11px] font-bold tracking-wide opacity-70">حالة الحجز</p>
  <p className="text-xl font-black mt-1.5 flex items-center gap-2.5">
  <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse"></span>
  {STATUS_CONFIG[viewingBooking.status]?.label || viewingBooking.status}
  </p>
  </div>
  <div className="w-12 h-12 rounded-2xl bg-white/70 border border-current/20 flex items-center justify-center text-2xl shadow-sm">
  {statusIcon(viewingBooking.status)}
  </div>
  </div>
  </div>

  {/* Sections */}
 <div className="flex-1 min-h-0 px-5 sm:px-6 py-5 space-y-4 overflow-y-auto overscroll-contain">
 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaUser className="text-[#DC2626] text-xs" />
 <h4 className="text-sm font-bold text-[#111214]">بيانات العميل</h4>
 </div>
 <div className="px-4 py-3 space-y-2.5">
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">الاسم:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.customer?.full_name || '---'}</span>
 </div>
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">الجوال:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.customer?.phone || '---'}</span>
 </div>
 {viewingBooking.customer?.email && (
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">البريد:</span>
 <span className="text-[#111214] font-bold break-all" dir="ltr">{viewingBooking.customer.email}</span>
 </div>
 )}
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCar className="text-[#DC2626] text-xs" />
 <h4 className="text-sm font-bold text-[#111214]">بيانات السيارة</h4>
 </div>
 <div className="px-4 py-3 space-y-2.5">
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">المركبة:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.vehicle?.make} {viewingBooking.vehicle?.model}</span>
 </div>
 {viewingBooking.vehicle?.year && (
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">السنة:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.vehicle.year}</span>
 </div>
 )}
 {viewingBooking.vehicle?.plate_number && (
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">رقم اللوحة:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.vehicle.plate_number}</span>
 </div>
 )}
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCalendarAlt className="text-[#DC2626] text-xs" />
 <h4 className="text-sm font-bold text-[#111214]">تفاصيل الحجز</h4>
 </div>
 <div className="px-4 py-3 space-y-2.5">
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">الخدمة:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.service?.name || '---'}</span>
 </div>
 {viewingBooking.service?.base_price && (
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">السعر:</span>
 <span className="text-[#DC2626] font-bold" dir="ltr">{viewingBooking.service.base_price.toLocaleString('en-US')} ر.س</span>
 </div>
 )}
 {viewingBooking.preferred_date && (
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">التاريخ المفضل:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingBooking.preferred_date).toLocaleDateString('en-GB')}</span>
 </div>
 )}
 {viewingBooking.preferred_time && (
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">الوقت المفضل:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.preferred_time}</span>
 </div>
 )}
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">المصدر:</span>
 <span className="text-[#111214] font-bold flex items-center gap-1.5">
 <FaUserTag className="text-[#62666D] text-[10px]" />
 {viewingBooking.source === 'online' ? 'أونلاين' : viewingBooking.source || '---'}
 </span>
 </div>
 <div className="flex justify-between text-[16px]">
 <span className="text-[#4B4F55] font-bold">تاريخ الإنشاء:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingBooking.created_at).toLocaleDateString('en-GB')}</span>
 </div>
 {viewingBooking.customer_notes && (
 <div className="text-sm pt-1 border-t border-[#F1F2F3]">
 <span className="text-[#4B4F55] font-bold">ملاحظات العميل:</span>
 <p className="text-[#111214] mt-1.5 bg-[#FBFBFA] border border-[#F1F2F3] rounded-xl p-3 text-sm leading-relaxed">{viewingBooking.customer_notes}</p>
 </div>
 )}
 </div>
 </div>

{canUpdate && isSuperAdmin && viewingBooking.status === 'cancelled' && (
 <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/50 overflow-hidden">
 <div className="px-4 py-3.5">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <span className="text-xs font-bold text-[#059669]">استرجاع الحجز</span>
 <button
 onClick={() => handleStatusUpdate(viewingBooking.id, cancelRevertTarget(viewingBooking))}
 disabled={updatingStatus === viewingBooking.id}
 className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 disabled:opacity-50 bg-white border-[#A7F3D0] text-[#059669] shadow-sm"
 >
 {updatingStatus === viewingBooking.id ? <FaSpinner className="animate-spin inline" /> : null}
 {' '}إلغاء الإلغاء — {STATUS_CONFIG[cancelRevertTarget(viewingBooking)]?.label || 'جديد'}
 </button>
 </div>
<p className="text-[10px] text-[#059669]/80 mt-2">متاح للسوبر أدمن فقط، ويُرجِع الحجز للحالة التي كانت قبل الإلغاء.</p>
  </div>
  </div>
  )}

  {viewingBooking.status === 'completed' && (
  <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
  <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center justify-between gap-2">
  <div className="flex items-center gap-2">
  <FaCheckCircle className="text-[#059669] text-xs" />
  <h4 className="text-sm font-bold text-[#111214]">الخدمات المقدمة</h4>
  </div>
  {viewingBooking.linked_invoice && (
  <button onClick={() => handleOpenInvoice()} className="flex items-center gap-1.5 text-xs font-bold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg px-2.5 py-1.5 hover:bg-[#DBEAFE] transition-all">
  <FaFileInvoiceDollar className="text-[11px]" />
  عرض الفاتورة
  </button>
  )}
  </div>
  <div className="px-4 py-3 space-y-2.5">
  {[
  ...(viewingBooking.service ? [{ key: 'main', name: viewingBooking.service.name, price: viewingBooking.service.base_price, total: viewingBooking.service.base_price, qty: 1 }] : []),
  ...(viewingBooking.booking_items || []).map(i => ({ key: i.id, name: i.service?.name || 'خدمة إضافية', price: Number(i.unit_price), total: Number(i.total), qty: Number(i.quantity) })),
  ].map(s => (
  <div key={s.key} className="flex items-center justify-between gap-2 text-[14px] bg-[#FBFBFA] border border-[#F1F2F3] rounded-xl px-3 py-2.5">
  <div className="flex items-center gap-2 min-w-0">
  <FaWrench className="text-[#059669] text-[11px] shrink-0" />
  <span className="text-[#111214] font-bold truncate">{s.name}</span>
  {s.qty > 1 && <span className="text-[#62666D] text-xs font-bold shrink-0">× {s.qty}</span>}
  </div>
  <span className="text-[#DC2626] font-bold shrink-0" dir="ltr">{s.total.toLocaleString('en-US')} ر.س</span>
  </div>
  ))}
  <div className="flex justify-between text-[16px] px-1">
  <span className="text-[#4B4F55] font-bold">تاريخ الخدمة:</span>
  <span className="text-[#111214] font-bold">{new Date(viewingBooking.preferred_date || viewingBooking.created_at.slice(0, 10)).toLocaleDateString('en-GB')}</span>
  </div>

  <div className="border-t border-[#F1F2F3] pt-3">
  <div className="flex items-center justify-between gap-2 px-1">
  <span className="text-[#4B4F55] font-bold flex items-center gap-1.5"><FaShieldAlt className="text-[#059669]" /> الضمان:</span>
  {canManage && (
  <button onClick={() => { setWarrantyStart(viewingBooking.warranty_start_date || ''); setWarrantyEnd(viewingBooking.warranty_end_date || ''); setWarrantyYears(yearsFromDates(viewingBooking.warranty_start_date || '', viewingBooking.warranty_end_date || '')); setWarrantyEditing(v => !v) }} className="text-xs font-bold text-[#2563EB] flex items-center gap-1 hover:text-[#1D4ED8] transition-all">
  <FaEdit /> {warrantyEditing ? 'إغلاق' : 'تعديل'}
  </button>
  )}
  </div>

  {warrantyEditing ? (
  <div className="mt-2.5 space-y-3">
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block text-center">بداية الضمان</label>
  <div className="flex justify-center">
  <div className="w-[270px] bg-white border border-[#E7E8EA] rounded-2xl shadow-md p-3">
  <div className="flex items-center p-0.5 bg-[#F7F7F5] rounded-[10px] mb-2">
  <button type="button" onClick={() => setCalMode('miladi')} className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${calMode === 'miladi' ? 'bg-white text-[#DC2626] shadow-sm border border-[#E7E8EA]' : 'text-[#62666D]'}`}>ميلادي</button>
  <button type="button" onClick={() => setCalMode('hijri')} className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${calMode === 'hijri' ? 'bg-white text-[#DC2626] shadow-sm border border-[#E7E8EA]' : 'text-[#62666D]'}`}>هجري</button>
  </div>
  <div className="flex items-center justify-between mb-2">
  <button type="button" onClick={() => moveCal(-1)} title="الشهر السابق" className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#DC2626] hover:border-[#FECACA] transition-all">
  <FaChevronRight className="text-[10px]" />
  </button>
  <span className="text-[13px] font-black text-[#111214]">{calMode === 'hijri'
    ? (() => {
      const h = toHijri(calFirstIso)
      return h ? `${HIJRI_MONTHS[h.m - 1]} ${h.y} هـ` : `${ARABIC_MONTHS[calMonth]} ${calYear}`
    })()
    : `${ARABIC_MONTHS[calMonth]} ${calYear}`}</span>
  <button type="button" onClick={() => moveCal(1)} title="الشهر التالي" className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#DC2626] hover:border-[#FECACA] transition-all">
  <FaChevronLeft className="text-[10px]" />
  </button>
  </div>
  <div className="grid grid-cols-7 gap-0.5 text-center">
  {WEEKDAY_HEADERS.map((w, i) => (
  <span key={i} className="text-[9px] font-black text-[#9CA1A6] py-1">{w}</span>
  ))}
  {calDays.map((iso, i) => {
    if (!iso) return <span key={`e${i}`} />
    const isSel = iso === warrantyStart
    const isToday = iso === todayIso
    const hijriCell = calMode === 'hijri' ? toHijri(iso) : null
    const dayNum = hijriCell ? hijriCell.d : Number(iso.split('-')[2])
    return (
    <button key={iso} type="button" onClick={() => handleWarrantyStartChange(iso)} className="p-0.5">
    <div className={`w-8 h-8 mx-auto flex flex-col items-center justify-center rounded-full text-xs font-bold transition-all ${isSel ? 'bg-gradient-to-br from-[#DC2626] to-[#9B1B30] text-white shadow-md shadow-red-500/25' : isToday ? 'text-[#DC2626] ring-1 ring-[#FECACA] bg-[#FFF1F2]' : 'text-[#111214] hover:bg-[#FEE2E2] hover:text-[#DC2626]'}`}>
    <span className="leading-none pt-1">{dayNum}</span>
    {isToday && <span className={`leading-none mt-0.5 text-[7px] font-black ${isSel ? 'text-white' : 'text-[#DC2626]'}`}>اليوم</span>}
    </div>
    </button>
    )
  })}
  </div>
  </div>
  </div>
  <p className="text-center mt-2 text-sm font-black text-[#111214]">{warrantyStart ? formatStartDisplay(warrantyStart) : 'لم يُحدَّد بعد'}</p>
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block text-center">مدة الضمان</label>
  <div className="flex items-center justify-center gap-1 bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-2 pt-3 pb-8">
  <button type="button" onClick={() => handleWarrantyYearsChange(Math.max(1, warrantyYears - 1))} disabled={warrantyYears <= 1} title="السنة السابقة" className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#E7E8EA] text-[#62666D] shadow-sm hover:text-[#DC2626] disabled:opacity-25 transition-all">
  <FaChevronRight className="text-[10px]" />
  </button>
  {[-2, -1, 0, 1, 2].map(offset => {
    const val = warrantyYears + offset
    if (val < 1 || val > 10) return null
    const dist = Math.abs(offset)
    return (
    <button
    key={val}
    type="button"
    onClick={() => handleWarrantyYearsChange(val)}
    className={`relative flex flex-col items-center justify-center rounded-full transition-all duration-300 ${dist === 0 ? 'w-16 h-16 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] text-white shadow-lg shadow-red-500/30 scale-110' : dist === 1 ? 'w-10 h-10 text-[#4B4F55] opacity-60' : 'w-8 h-8 text-[#9CA1A6] opacity-25'}`}
    >
    <span className={dist === 0 ? 'text-xl font-black leading-none' : 'text-xs font-bold leading-none'}>{val}</span>
    </button>
    )
  })}
  <button type="button" onClick={() => handleWarrantyYearsChange(Math.min(10, warrantyYears + 1))} disabled={warrantyYears >= 10} title="السنة التالية" className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#E7E8EA] text-[#62666D] shadow-sm hover:text-[#DC2626] disabled:opacity-25 transition-all">
  <FaChevronLeft className="text-[10px]" />
  </button>
  </div>
  <p className="text-center mt-1 text-sm font-black text-[#DC2626]">{warrantyYears} {warrantyYears === 1 ? 'سنة' : warrantyYears === 2 ? 'سنتان' : 'سنوات'}</p>
  </div>
  <div>
  <label className="text-xs font-bold text-[#62666D] mb-1 block">نهاية الضمان</label>
  <div className="w-full bg-[#F7F7F5] border border-[#E7E8EA] rounded-xl px-3 py-2.5 flex items-center justify-between select-none">
  <span className="flex items-center gap-2 text-sm text-[#111214] font-bold">
  <FaCalendarAlt className="text-[#DC2626]/70 text-xs" />
  {formatEndDisplay(warrantyEnd)}
  </span>
  <span className="flex items-center gap-1 text-[10px] font-bold text-[#62666D]"><FaCheck className="text-[#059669] text-[9px]" /> تلقائياً</span>
  </div>
  </div>
  <div className="flex gap-2">
  <button onClick={handleSaveWarranty} disabled={savingWarranty} className="flex-1 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] text-white rounded-xl px-3 py-2 text-sm font-bold flex items-center justify-center gap-2 hover:from-[#9B1B30] hover:to-[#7A1526] disabled:opacity-60 transition-all">
  {savingWarranty ? <FaSpinner className="animate-spin" /> : <FaCheck />} حفظ الضمان
  </button>
  <button onClick={() => setWarrantyEditing(false)} className="px-3 py-2 rounded-xl text-sm font-bold border border-[#E7E8EA] text-[#62666D] hover:bg-[#F7F7F5] transition-all">إلغاء</button>
  </div>
  </div>
  ) : (
  <div className="mt-1.5 px-1">
  {viewingBooking.warranty_start_date && viewingBooking.warranty_end_date ? (
  <span className="text-[#111214] font-bold text-[15px]">
  من {new Date(viewingBooking.warranty_start_date).toLocaleDateString('en-GB')} إلى {new Date(viewingBooking.warranty_end_date).toLocaleDateString('en-GB')}
  </span>
  ) : (
  <span className="text-[#62666D] text-sm font-medium">لا يوجد ضمان مسجل لهذا الحجز{canManage ? ' — اضغط تعديل لإضافته' : ''}</span>
  )}
  </div>
  )}
  </div>
  </div>
  </div>
  )}

  {viewingBooking.status_history && viewingBooking.status_history.length > 0 && (
 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaHistory className="text-[#DC2626] text-xs" />
 <h4 className="text-sm font-bold text-[#111214]">سجل الحالة</h4>
 </div>
 <div className="px-4 py-3.5 space-y-2.5">
 {viewingBooking.status_history.map((h) => (
 <div key={h.id} className="flex items-center gap-2.5 text-sm bg-[#FBFBFA] border border-[#F1F2F3] rounded-xl px-3 py-2 flex-wrap">
 <span className="font-bold text-[#111214]">{h.changed_by_name || 'النظام'}</span>
 <span className="text-[#9CA1A6]">•</span>
 <span className="text-[#62666D] font-medium">{new Date(h.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
 <span className="text-[#62666D]">→</span>
 {statusBadge(h.new_status)}
 {h.notes && <span className="text-[#62666D]">({h.notes})</span>}
</div>
   ))}
   </div>
   </div>
   )}
   </div>
   </>
   )}
   </div>
   </div>
   )}

   {/* ===== Create Modal ===== */}
 {showCreateForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setShowCreateForm(false)}>
 <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
 <div className="sticky top-0 z-10 bg-white border-b border-[#E7E8EA] px-6 py-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#9B1B30] flex items-center justify-center shrink-0">
 <FaCalendarPlus className="text-white" />
 </div>
 <h3 className="font-bold text-[#111214]">حجز جديد</h3>
 </div>
 <button onClick={() => setShowCreateForm(false)} className="text-[#62666D] hover:text-[#111214] hover:bg-[#F7F7F5] p-2.5 rounded-xl transition-all">
 <FaTimes className="text-sm" />
 </button>
 </div>

 <div className="px-6 py-5">
 {createNotification && (
 <div className={`p-3.5 rounded-2xl border text-sm font-bold mb-4 flex items-center gap-2 ${
 createNotification.type === 'success' ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
 }`}>
 {createNotification.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
 {createNotification.message}
 </div>
 )}

 <form onSubmit={handleCreateBookingSubmit} className="space-y-4">
 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaUser className="text-[#DC2626] text-xs" />
 <h4 className="text-sm font-bold text-[#111214]">بيانات العميل</h4>
 </div>
 <div className="px-4 py-4 space-y-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">اسم العميل *</label>
 <input type="text" value={createFormData.customerName} onChange={e => setCreateFormData(p => ({ ...p, customerName: e.target.value }))} className={`w-full bg-white border ${createErrors.customerName ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all`} placeholder="الاسم الكامل" />
 {createErrors.customerName && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.customerName}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">رقم الهاتف *</label>
 <input type="tel" value={createFormData.customerPhone} onChange={e => setCreateFormData(p => ({ ...p, customerPhone: e.target.value }))} className={`w-full bg-white border ${createErrors.customerPhone ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all`} placeholder="05XXXXXXXX" dir="ltr" />
 {createErrors.customerPhone && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.customerPhone}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">البريد الإلكتروني (اختياري)</label>
 <input type="email" value={createFormData.customerEmail} onChange={e => setCreateFormData(p => ({ ...p, customerEmail: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all" placeholder="email@example.com" dir="ltr" />
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCar className="text-[#DC2626] text-xs" />
 <h4 className="text-sm font-bold text-[#111214]">بيانات السيارة</h4>
 </div>
 <div className="px-4 py-4 grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">الماركة *</label>
 <input type="text" value={createFormData.vehicleMake} onChange={e => setCreateFormData(p => ({ ...p, vehicleMake: e.target.value }))} className={`w-full bg-white border ${createErrors.vehicleMake ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all`} placeholder="مثال: تويوتا" />
 {createErrors.vehicleMake && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.vehicleMake}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">الموديل *</label>
 <input type="text" value={createFormData.vehicleModel} onChange={e => setCreateFormData(p => ({ ...p, vehicleModel: e.target.value }))} className={`w-full bg-white border ${createErrors.vehicleModel ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all`} placeholder="مثال: كامري" />
 {createErrors.vehicleModel && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.vehicleModel}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">سنة الصنع *</label>
 <input type="number" value={createFormData.vehicleYear} onChange={e => setCreateFormData(p => ({ ...p, vehicleYear: e.target.value }))} min="1900" max={new Date().getFullYear() + 1} className={`w-full bg-white border ${createErrors.vehicleYear ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all`} dir="ltr" />
 {createErrors.vehicleYear && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.vehicleYear}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">اللون</label>
 <input type="text" value={createFormData.vehicleColor} onChange={e => setCreateFormData(p => ({ ...p, vehicleColor: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all" placeholder="مثال: أبيض" />
 </div>
 <div className="col-span-2">
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">رقم اللوحة</label>
 <input type="text" value={createFormData.vehiclePlate} onChange={e => setCreateFormData(p => ({ ...p, vehiclePlate: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all" placeholder="مثال: أ ب ج 1234" />
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCalendarAlt className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">الخدمة والموعد</h4>
 </div>
 <div className="px-4 py-4 space-y-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">الخدمة *</label>
 <select value={createFormData.serviceId} onChange={e => setCreateFormData(p => ({ ...p, serviceId: e.target.value }))} className={`w-full bg-white border ${createErrors.serviceId ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none appearance-none cursor-pointer transition-all`}>
 <option value="">اختر الخدمة</option>
 {services.map(s => <option key={s.id} value={s.id}>{s.name}{s.base_price ? ` — ${s.base_price.toLocaleString('en-GB')} ر.س` : ''}</option>)}
 </select>
 {createErrors.serviceId && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.serviceId}</p>}
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">التاريخ المفضل *</label>
 <input type="date" value={createFormData.preferredDate} onChange={e => setCreateFormData(p => ({ ...p, preferredDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} className={`w-full bg-white border ${createErrors.preferredDate ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none transition-all`} />
 {createErrors.preferredDate && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.preferredDate}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">الوقت المفضل *</label>
 <select value={createFormData.preferredTime} onChange={e => setCreateFormData(p => ({ ...p, preferredTime: e.target.value }))} className={`w-full bg-white border ${createErrors.preferredTime ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none appearance-none cursor-pointer transition-all`}>
 <option value="">اختر الوقت</option>
 {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 {createErrors.preferredTime && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.preferredTime}</p>}
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA]">
 <label className="text-xs font-bold text-[#111214] block">ملاحظات</label>
 </div>
 <div className="px-4 py-4">
 <textarea rows={2} value={createFormData.notes} onChange={e => setCreateFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all resize-none" placeholder="ملاحظات إضافية..." />
 </div>
 </div>

 <div className="flex gap-3 pt-2">
 <button type="submit" disabled={createSubmitting} className="flex-1 px-4 py-3 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] hover:from-[#9B1B30] hover:to-[#7A1526] text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
 {createSubmitting ? <><FaSpinner className="animate-spin" /> جاري الإنشاء...</> : 'إنشاء الحجز'}
 </button>
 <button type="button" onClick={() => setShowCreateForm(false)} className="px-5 py-3 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all duration-200">
 إلغاء
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 )}

 {/* ===== Delete Modal ===== */}
 {deleteTarget && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => { setDeleteTarget(null); setDeleteToken(''); setDeleteError('') }}>
 <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border-t-4 border-t-[#DC2626]" onClick={e => e.stopPropagation()}>
 <div className="px-6 pt-6 pb-4 flex items-center gap-3.5">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#9B1B30] flex items-center justify-center shrink-0 shadow-lg shadow-red-500/25">
 <FaTrash className="text-white" />
 </div>
 <div>
 <h3 className="text-base font-black text-[#111214]">تأكيد الحذف</h3>
 <p className="text-xs text-[#62666D] mt-0.5">لا يمكن التراجع عن هذا الإجراء</p>
 </div>
 </div>

 <div className="px-6 mb-4">
 <div className="p-3.5 bg-[#FEF2F2] rounded-2xl border border-[#FECACA] flex items-center gap-2.5">
 <FaExclamationTriangle className="text-[#DC2626] shrink-0" />
 <div>
 <p className="text-xs text-[#DC2626] font-bold">العميل: {deleteTarget.customer?.full_name || '---'}</p>
 <p className="text-[10px] text-[#DC2626]/70 mt-0.5">{deleteTarget.vehicle?.make} {deleteTarget.vehicle?.model}</p>
 </div>
 </div>
 </div>

 <div className="px-6 mb-3">
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">أدخل الرمز الخاص</label>
 <input
type="password"
   value={deleteToken}
   onChange={e => { setDeleteToken(e.target.value); setDeleteError('') }}
   className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] text-right focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all"
 placeholder="الرمز الخاص..."
 autoFocus
 onKeyDown={e => { if (e.key === 'Enter' && deleteToken.trim()) handleDeleteBooking() }}
 dir="ltr"
 />
 {deleteError && <p className="text-xs text-[#DC2626] mt-2 font-bold">{deleteError}</p>}
 </div>

 <div className="px-6 pb-6 pt-2 flex gap-3">
 <button
 onClick={handleDeleteBooking}
 disabled={!deleteToken.trim() || deleteLoading}
 className="flex-1 px-4 py-2.5 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] hover:from-[#9B1B30] hover:to-[#7A1526] text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-red-500/25 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
 >
 {deleteLoading ? <><FaSpinner className="animate-spin" /> جاري الحذف...</> : 'حذف نهائياً'}
 </button>
 <button
 onClick={() => { setDeleteTarget(null); setDeleteToken(''); setDeleteError('') }}
 className="px-5 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all duration-200"
 >
 إلغاء
 </button>
 </div>
 </div>
</div>
  )}
  
  {(invoiceView.loading || invoiceView.data) && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setInvoiceView({ loading: false, data: null })}>
  <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
  <div className="px-5 pt-5 pb-4 border-b border-[#F1F2F3] flex items-center justify-between gap-2">
  <h3 className="text-base font-bold text-[#111214] flex items-center gap-2">
  <FaFileInvoiceDollar className="text-[#2563EB] text-sm" />
  الفاتورة {invoiceView.data?.invoice_number || ''}
  </h3>
  <button onClick={() => setInvoiceView({ loading: false, data: null })} className="text-[#62666D] hover:text-[#111214] p-1.5 rounded-lg hover:bg-[#F7F7F5] transition-all">
  <FaTimes className="text-sm" />
  </button>
  </div>
  {invoiceView.loading ? (
  <div className="flex items-center justify-center py-12">
  <FaSpinner className="animate-spin text-[#DC2626]" />
  </div>
  ) : invoiceView.data ? (
  <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
  {invoiceView.data.status && (
  <div className="flex items-center justify-between">
  <span className="text-xs font-bold text-[#62666D]">حالة الفاتورة</span>
  <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${INVOICE_STATUS_CONFIG[invoiceView.data.status]?.bg || 'bg-[#F1F2F3] border-[#E7E8EA]'} ${INVOICE_STATUS_CONFIG[invoiceView.data.status]?.color || 'text-[#62666D]'}`}>
  {INVOICE_STATUS_CONFIG[invoiceView.data.status]?.label || invoiceView.data.status}
  </span>
  </div>
  )}
  <div>
  <p className="text-xs font-bold text-[#62666D] mb-1.5">البنود</p>
  <div className="space-y-1.5">
  {(invoiceView.data.items || []).map(it => (
  <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
  <span className="text-[#62666D] font-semibold min-w-0 truncate">{it.service?.name || it.description}{it.quantity > 1 ? ` × ${it.quantity}` : ''}</span>
  <span className="text-[#111214] font-bold shrink-0" dir="ltr">{it.total.toLocaleString('en-US')} ر.س</span>
  </div>
  ))}
  </div>
  </div>
  <div className="border-t border-[#E7E8EA] pt-3 space-y-1.5">
  <div className="flex items-center justify-between text-sm">
  <span className="text-[#62666D] font-semibold">الإجمالي</span>
  <span className="text-[#DC2626] font-black" dir="ltr">{invoiceView.data.total.toLocaleString('en-US')} ر.س</span>
  </div>
  {typeof invoiceView.data.paid_amount === 'number' && invoiceView.data.paid_amount > 0 && (
  <div className="flex items-center justify-between text-sm">
  <span className="text-[#62666D] font-semibold">المدفوع</span>
  <span className="text-[#059669] font-black" dir="ltr">{invoiceView.data.paid_amount.toLocaleString('en-US')} ر.س</span>
  </div>
  )}
  </div>
  </div>
  ) : null}
  </div>
  </div>
  )}
  </div>
  )
}