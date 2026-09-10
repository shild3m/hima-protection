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
  new: { label: 'ط¬ط¯ظٹط¯', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
  contacted: { label: 'طھظ… ط§ظ„طھظˆط§طµظ„', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]' },
  in_progress: { label: 'ظ‚ظٹط¯ ط§ظ„طھظ†ظپظٹط°', color: 'text-[#EA580C]', bg: 'bg-[#FFF7ED] border-orange-500/20' },
  completed: { label: 'ظ…ظƒطھظ…ظ„', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]' },
  cancelled: { label: 'ظ…ظ„ط؛ظٹ', color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' },
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

  const canUpdate = hasPermission('bookings', 'update')
  const canCreate = hasPermission('bookings', 'create')
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
 setNotification({ type: 'error', message: 'طھط¹ط°ط± ط¬ظ„ط¨ ط§ظ„ط­ط¬ظˆط²ط§طھ' })
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
  setNotification({ type: 'success', message: 'طھظ… طھط­ط¯ظٹط« ط­ط§ظ„ط© ط§ظ„ط­ط¬ط² ط¨ظ†ط¬ط§ط­' })
  fetchBookings()
  fetchStats()
  if (viewingBooking?.id === bookingId) {
  handleViewBooking({ id: bookingId } as Booking)
  }
  } else {
  setNotification({ type: 'error', message: result.error || 'ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹' })
  }
  } catch {
  setNotification({ type: 'error', message: 'ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹' })
  } finally {
  setUpdatingStatus(null)
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
       setNotification({ type: 'success', message: 'طھظ… ط­ط°ظپ ط§ظ„ط­ط¬ط² ط¨ظ†ط¬ط§ط­' })
       setDeleteTarget(null)
       setDeleteToken('')
       fetchBookings()
       fetchStats()
     } else {
       setDeleteError(result.error || 'ط­ط¯ط« ط®ط·ط£')
     }
   } catch {
     setDeleteError('ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹')
   } finally {
     setDeleteLoading(false)
   }
 }

 const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

 const handleCreateBookingSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setCreateErrors({})
  const errs: Record<string, string> = {}
  if (!createFormData.customerName.trim() || createFormData.customerName.trim().length < 2) errs.customerName = 'ط§ط³ظ… ط§ظ„ط¹ظ…ظٹظ„ ظ…ط·ظ„ظˆط¨ (ط­ط±ظپظٹظ† ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„)'
  if (!createFormData.customerPhone.trim() || createFormData.customerPhone.trim().length < 5) errs.customerPhone = 'ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ ظ…ط·ظ„ظˆط¨'
  if (!createFormData.vehicleMake.trim()) errs.vehicleMake = 'ظ…ط§ط±ظƒط© ط§ظ„ط³ظٹط§ط±ط© ظ…ط·ظ„ظˆط¨ط©'
  if (!createFormData.vehicleModel.trim()) errs.vehicleModel = 'ظ…ظˆط¯ظٹظ„ ط§ظ„ط³ظٹط§ط±ط© ظ…ط·ظ„ظˆط¨'
  const yr = parseInt(createFormData.vehicleYear)
  if (!createFormData.vehicleYear || yr < 1900 || yr > new Date().getFullYear() + 1) errs.vehicleYear = 'ط³ظ†ط© ط§ظ„طµظ†ط¹ ط؛ظٹط± طµط­ظٹط­ط©'
  if (!createFormData.serviceId) errs.serviceId = 'ظٹط±ط¬ظ‰ ط§ط®طھظٹط§ط± ط§ظ„ط®ط¯ظ…ط©'
  if (!createFormData.preferredDate) errs.preferredDate = 'ط§ظ„طھط§ط±ظٹط® ط§ظ„ظ…ظپط¶ظ„ ظ…ط·ظ„ظˆط¨'
  if (!createFormData.preferredTime) errs.preferredTime = 'ط§ظ„ظˆظ‚طھ ط§ظ„ظ…ظپط¶ظ„ ظ…ط·ظ„ظˆط¨'
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
  setCreateNotification({ type: 'success', message: 'طھظ… ط¥ظ†ط´ط§ط، ط§ظ„ط­ط¬ط² ط¨ظ†ط¬ط§ط­' })
  setShowCreateForm(false)
  setCreateFormData({ customerName: '', customerPhone: '', customerEmail: '', vehicleMake: '', vehicleModel: '', vehicleYear: new Date().getFullYear().toString(), vehicleColor: '', vehiclePlate: '', serviceId: '', preferredDate: '', preferredTime: '', notes: '' })
  fetchBookings()
  fetchStats()
  } else {
  setCreateNotification({ type: 'error', message: result.error || 'ط­ط¯ط« ط®ط·ط£' })
  }
  } catch {
  setCreateNotification({ type: 'error', message: 'ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹' })
  } finally {
  setCreateSubmitting(false)
  }
 }

const statusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-[#62666D]', bg: 'bg-[#F1F2F3] border-[#E7E8EA]' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${config.bg} ${config.color}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
      {config.label}
    </span>
  )
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
 <h1 className="text-xl md:text-2xl font-black text-[#111214]">ط¥ط¯ط§ط±ط© ط§ظ„ط­ط¬ظˆط²ط§طھ</h1>
 <p className="text-[#62666D] text-xs md:text-sm mt-0.5 font-medium">ط¹ط±ط¶ ظˆط¥ط¯ط§ط±ط© ط­ط¬ظˆط²ط§طھ ط§ظ„ط¹ظ…ظ„ط§ط،</p>
 </div>
 </div>
 {canCreate && (
 <button
 onClick={() => setShowCreateForm(true)}
 className="px-5 py-2.5 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] hover:from-[#9B1B30] hover:to-[#7A1526] text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-red-500/25 hover:shadow-red-500/30 flex items-center justify-center gap-2"
 >
 <FaPlus className="text-xs" />
 ط­ط¬ط² ط¬ط¯ظٹط¯
 </button>
 )}
 </div>

 {/* ===== Stats ===== */}
 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
 {Object.entries(STATUS_CONFIG).map(([key, config]) => {
 const meta = STATUS_META[key] || STATUS_META.new
 const active = statusFilter === key
 return (
 <button
 key={key}
 onClick={() => { setStatusFilter(active ? 'all' : key); setPage(1) }}
 className={`relative overflow-hidden rounded-2xl p-4 border-2 text-right transition-all duration-200 ${
 active
 ? `${config.bg} ${config.color} border-current shadow-lg`
 : 'bg-white border-[#E7E8EA] hover:border-[#D4D6DA] hover:shadow-md hover:shadow-black/[0.03]'
 }`}
 >
 <div className="flex items-start justify-between gap-2">
 <div>
 <div className="text-2xl font-black leading-none">{stats.counts[key] || 0}</div>
 <div className={`text-xs font-black mt-2 ${active ? config.color : 'text-[#62666D]'}`}>{config.label}</div>
 </div>
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-opacity duration-200 ${meta.iconBg} ${meta.iconColor} ${active ? 'opacity-100' : 'opacity-50'}`}>
 {meta.icon}
 </div>
 </div>
 {active && (
 <div className="absolute bottom-0 right-0 left-0 h-0.5 bg-current opacity-40"></div>
 )}
 </button>
 )
 })}
 </div>
 )}

 {/* ===== Search ===== */}
 <div className="relative max-w-md">
 <FaSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="ط¨ط­ط« ط¨ط§ظ„ط§ط³ظ… ط£ظˆ ط§ظ„ط¬ظˆط§ظ„ ط£ظˆ ط§ظ„ظ…ط§ط±ظƒط© ط£ظˆ ط±ظ‚ظ… ط§ظ„ظ„ظˆط­ط©..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm shadow-black/[0.02] rounded-2xl pr-11 pl-10 py-3 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all placeholder:text-[#62666D]"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#111214] transition">
 <FaTimes className="text-xs" />
 </button>
 )}
 </div>

 {/* ===== List ===== */}
 {loading ? (
 <div className="flex items-center justify-center py-24">
 <div className="flex flex-col items-center gap-4">
 <div className="w-11 h-11 border-[3px] border-[#FECACA] border-t-[#DC2626] rounded-full animate-spin shadow-sm"></div>
 <span className="text-sm text-[#62666D] font-medium">ط¬ط§ط±ظٹ طھط­ظ…ظٹظ„ ط§ظ„ط­ط¬ظˆط²ط§طھ...</span>
 </div>
 </div>
 ) : bookings.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-[#62666D]">
 <div className="w-20 h-20 rounded-3xl bg-white border border-[#E7E8EA] shadow-sm flex items-center justify-center mb-5">
 <FaBoxOpen className="text-3xl text-[#D4D6DA]" />
 </div>
 <p className="font-bold text-[#111214]">ظ„ط§ طھظˆط¬ط¯ ط­ط¬ظˆط²ط§طھ</p>
 <p className="text-xs text-[#62666D] mt-1">ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط­ط¬ظˆط²ط§طھ طھط·ط§ط¨ظ‚ ط§ظ„ط¨ط­ط« ط§ظ„ط­ط§ظ„ظٹ</p>
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
 <h4 className="text-sm font-black text-[#111214] truncate">
 {booking.customer?.full_name || 'ط¹ظ…ظٹظ„'}
 </h4>
 {statusBadge(booking.status)}
 </div>
 <div className="flex items-center gap-x-3 gap-y-1 mt-2 text-xs text-[#62666D] font-semibold flex-wrap">
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
 {new Date(booking.created_at).toLocaleDateString('ar-SA')}
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
 <span className="hidden sm:inline">طھط؛ظٹظٹط±</span>
 <FaChevronDown className={`text-[8px] transition-transform duration-200 ${activeStatusDropdown === booking.id ? 'rotate-180' : ''}`} />
 </button>
 {activeStatusDropdown === booking.id && (
 <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-[#E7E8EA] rounded-2xl shadow-2xl shadow-black/10 min-w-[190px] py-1.5 animate-fadeIn overflow-hidden">
 <div className="px-3.5 py-2 text-[10px] font-bold text-[#62666D] bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-1.5">
 <FaExchangeAlt className="text-[9px]" />
 طھط؛ظٹظٹط± ط§ظ„ط­ط§ظ„ط© ط¥ظ„ظ‰
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
 title="ط¹ط±ط¶ ط§ظ„طھظپط§طµظٹظ„"
 className="w-9 h-9 rounded-xl bg-[#F7F7F5] hover:bg-[#DC2626] hover:text-white border border-[#E7E8EA] text-[#111214] transition-all duration-200 flex items-center justify-center"
 >
 <FaEye className="text-[13px]" />
 </button>
 {isSuperAdmin && (
 <button
 onClick={() => { setDeleteTarget(booking); setDeleteError('') }}
 title="ط­ط°ظپ ط§ظ„ط­ط¬ط²"
 className="w-9 h-9 rounded-xl bg-[#FEF2F2] hover:bg-[#DC2626] hover:text-white border border-[#FECACA] text-[#DC2626] transition-all duration-200 flex items-center justify-center"
 >
 <FaTrash className="text-[13px]" />
 </button>
 )}
 </div>
 </div>
 </div>
 )
 })}
 </div>

 {/* ===== Pagination ===== */}
 {pagination && pagination.total > 0 && (
 <div className="flex items-center justify-between mt-4 px-1 gap-3">
 <span className="text-xs text-[#62666D] font-semibold">
 <span className="font-black text-[#111214]">{pagination.total}</span> ظ†طھظٹط¬ط© â€” طµظپط­ط© <span className="font-black text-[#111214]">{pagination.page}</span> ظ…ظ† {pagination.totalPages}
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="h-9 px-4 bg-white hover:bg-[#111214] hover:text-white border border-[#E7E8EA] text-[#111214] rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#111214] flex items-center gap-1.5"
 >
 <FaChevronRight className="text-[10px]" />
 ط§ظ„ط³ط§ط¨ظ‚
 </button>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page >= totalPages}
 className="h-9 px-4 bg-white hover:bg-[#111214] hover:text-white border border-[#E7E8EA] text-[#111214] rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#111214] flex items-center gap-1.5"
 >
 ط§ظ„طھط§ظ„ظٹ
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
 <h3 className="font-bold text-[#111214]">طھظپط§طµظٹظ„ ط§ظ„ط­ط¬ط²</h3>
 <p className="text-xs text-[#62666D] mt-0.5">{viewingBooking.customer?.full_name || 'ط¹ظ…ظٹظ„'}</p>
 </div>
 </div>
 <div className="flex items-center gap-1">
 {isSuperAdmin && (
 <button
 onClick={() => { setDeleteTarget(viewingBooking); setDeleteError('') }}
 className="text-[#DC2626] hover:bg-[#FEF2F2] p-2.5 rounded-xl transition-all"
 title="ط­ط°ظپ ط§ظ„ط­ط¬ط²"
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
 {/* Status bar */}
 <div className="px-5 sm:px-6 py-4 bg-gradient-to-l from-[#FBFBFA] to-white border-b border-[#E7E8EA] flex items-center justify-between gap-3 flex-wrap">
 <span className="text-xs font-bold text-[#62666D] flex items-center gap-1.5">
 <FaInfoCircle className="text-[#DC2626]/60" />
 ط§ظ„ط­ط§ظ„ط© ط§ظ„ط­ط§ظ„ظٹط©
 </span>
 <div className="flex items-center gap-2">
 {statusBadge(viewingBooking.status)}
 {canUpdate && getAvailableStatuses(viewingBooking as unknown as Booking).length > 0 && (
 <div className="relative" data-status-dropdown>
 <button
 type="button"
 onClick={() => setActiveStatusDropdown(activeStatusDropdown === viewingBooking.id ? null : viewingBooking.id)}
 className="h-8 px-2.5 bg-white hover:bg-[#F7F7F5] border border-[#E7E8EA] text-[#111214] rounded-lg text-[10px] font-bold transition-all duration-200 flex items-center gap-1.5"
 >
 <FaExchangeAlt className="text-[9px]" />
 <FaChevronDown className={`text-[8px] transition-transform duration-200 ${activeStatusDropdown === viewingBooking.id ? 'rotate-180' : ''}`} />
 </button>
 {activeStatusDropdown === viewingBooking.id && (
 <div className="absolute top-full left-0 mt-2 z-50 bg-white border border-[#E7E8EA] rounded-2xl shadow-2xl shadow-black/10 min-w-[190px] py-1.5 animate-fadeIn overflow-hidden">
 <div className="px-3.5 py-2 text-[10px] font-bold text-[#62666D] bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-1.5">
 <FaExchangeAlt className="text-[9px]" />
 طھط؛ظٹظٹط± ط§ظ„ط­ط§ظ„ط© ط¥ظ„ظ‰
 </div>
 {getAvailableStatuses(viewingBooking as unknown as Booking).map((nextStatus) => {
 const cfg = STATUS_CONFIG[nextStatus]
 return (
 <button
 key={nextStatus}
 onClick={() => { setActiveStatusDropdown(null); handleStatusUpdate(viewingBooking.id, nextStatus) }}
 disabled={updatingStatus === viewingBooking.id}
 className={`w-full text-right px-3.5 py-2.5 text-xs font-bold flex items-center gap-2.5 hover:bg-[#F7F7F5] transition-all disabled:opacity-50 ${cfg.color}`}
 >
 <span className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0"></span>
 {cfg.label}
 {updatingStatus === viewingBooking.id && <FaSpinner className="animate-spin mr-auto text-[10px]" />}
 </button>
 )
 })}
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Sections */}
 <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaUser className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظ…ظٹظ„</h4>
 </div>
 <div className="px-4 py-3 space-y-2.5">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ط§ط³ظ…:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.customer?.full_name || '---'}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ط¬ظˆط§ظ„:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.customer?.phone || '---'}</span>
 </div>
 {viewingBooking.customer?.email && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ط¨ط±ظٹط¯:</span>
 <span className="text-[#111214] font-bold break-all" dir="ltr">{viewingBooking.customer.email}</span>
 </div>
 )}
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCar className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">ط¨ظٹط§ظ†ط§طھ ط§ظ„ط³ظٹط§ط±ط©</h4>
 </div>
 <div className="px-4 py-3 space-y-2.5">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ظ…ط±ظƒط¨ط©:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.vehicle?.make} {viewingBooking.vehicle?.model}</span>
 </div>
 {viewingBooking.vehicle?.year && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ط³ظ†ط©:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.vehicle.year}</span>
 </div>
 )}
 {viewingBooking.vehicle?.plate_number && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط±ظ‚ظ… ط§ظ„ظ„ظˆط­ط©:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.vehicle.plate_number}</span>
 </div>
 )}
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCalendarAlt className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">طھظپط§طµظٹظ„ ط§ظ„ط­ط¬ط²</h4>
 </div>
 <div className="px-4 py-3 space-y-2.5">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ط®ط¯ظ…ط©:</span>
 <span className="text-[#111214] font-bold">{viewingBooking.service?.name || '---'}</span>
 </div>
 {viewingBooking.service?.base_price && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ط³ط¹ط±:</span>
 <span className="text-[#DC2626] font-bold">{viewingBooking.service.base_price.toLocaleString('ar-SA')} ط±.ط³</span>
 </div>
 )}
 {viewingBooking.preferred_date && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„طھط§ط±ظٹط® ط§ظ„ظ…ظپط¶ظ„:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingBooking.preferred_date).toLocaleDateString('ar-SA')}</span>
 </div>
 )}
 {viewingBooking.preferred_time && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ظˆظ‚طھ ط§ظ„ظ…ظپط¶ظ„:</span>
 <span className="text-[#111214] font-bold" dir="ltr">{viewingBooking.preferred_time}</span>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">ط§ظ„ظ…طµط¯ط±:</span>
 <span className="text-[#111214] font-bold flex items-center gap-1.5">
 <FaUserTag className="text-[#62666D] text-[10px]" />
 {viewingBooking.source === 'online' ? 'ط£ظˆظ†ظ„ط§ظٹظ†' : viewingBooking.source || '---'}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">طھط§ط±ظٹط® ط§ظ„ط¥ظ†ط´ط§ط،:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingBooking.created_at).toLocaleDateString('ar-SA')}</span>
 </div>
 {viewingBooking.customer_notes && (
 <div className="text-sm pt-1 border-t border-[#F1F2F3]">
 <span className="text-[#62666D]">ظ…ظ„ط§ط­ط¸ط§طھ ط§ظ„ط¹ظ…ظٹظ„:</span>
 <p className="text-[#111214] mt-1.5 bg-[#FBFBFA] border border-[#F1F2F3] rounded-xl p-3 text-xs leading-relaxed">{viewingBooking.customer_notes}</p>
 </div>
 )}
 </div>
 </div>

 {canUpdate && VALID_TRANSITIONS[viewingBooking.status]?.length > 0 && (
 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaExchangeAlt className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">طھط­ط¯ظٹط« ط§ظ„ط­ط§ظ„ط©</h4>
 </div>
 <div className="px-4 py-3.5 flex flex-wrap gap-2">
 {VALID_TRANSITIONS[viewingBooking.status].map((nextStatus) => {
 const config = STATUS_CONFIG[nextStatus]
 return (
 <button
 key={nextStatus}
 onClick={() => handleStatusUpdate(viewingBooking.id, nextStatus)}
 disabled={updatingStatus === viewingBooking.id}
 className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 ${config.bg} ${config.color}`}
 >
 {updatingStatus === viewingBooking.id ? (
 <FaSpinner className="animate-spin inline" />
 ) : null}
 {' '}â†’ {config.label}
 </button>
 )
 })}
 </div>
 </div>
 )}

 {canUpdate && isSuperAdmin && viewingBooking.status === 'cancelled' && (
 <div className="rounded-2xl border border-[#A7F3D0] bg-[#ECFDF5]/50 overflow-hidden">
 <div className="px-4 py-3.5">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <span className="text-xs font-bold text-[#059669]">ط§ط³طھط±ط¬ط§ط¹ ط§ظ„ط­ط¬ط² ظ…ظ† ط§ظ„ط¥ظ„ط؛ط§ط،</span>
 <button
 onClick={() => handleStatusUpdate(viewingBooking.id, cancelRevertTarget(viewingBooking))}
 disabled={updatingStatus === viewingBooking.id}
 className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 hover:scale-105 disabled:opacity-50 bg-white border-[#A7F3D0] text-[#059669] shadow-sm"
 >
 {updatingStatus === viewingBooking.id ? <FaSpinner className="animate-spin inline" /> : null}
 {' '}ط¥ظ„ط؛ط§ط، ط§ظ„ط¥ظ„ط؛ط§ط، â€” {STATUS_CONFIG[cancelRevertTarget(viewingBooking)]?.label || 'ط¬ط¯ظٹط¯'}
 </button>
 </div>
 <p className="text-[10px] text-[#059669]/80 mt-2">ظ…طھط§ط­ ظ„ظ„ط³ظˆط¨ط± ط£ط¯ظ…ظ† ظپظ‚ط·طŒ ظˆظٹظڈط±ط¬ظگط¹ ط§ظ„ط­ط¬ط² ظ„ظ„ط­ط§ظ„ط© ط§ظ„طھظٹ ظƒط§ظ†طھ ظ‚ط¨ظ„ ط§ظ„ط¥ظ„ط؛ط§ط،.</p>
 </div>
 </div>
 )}

 {viewingBooking.status_history && viewingBooking.status_history.length > 0 && (
 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaHistory className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">ط³ط¬ظ„ ط§ظ„طھط؛ظٹظٹط±ط§طھ</h4>
 </div>
 <div className="px-4 py-3.5 space-y-2.5">
 {viewingBooking.status_history.map((h) => (
 <div key={h.id} className="flex items-center gap-2.5 text-xs bg-[#FBFBFA] border border-[#F1F2F3] rounded-xl px-3 py-2 flex-wrap">
 <span className="text-[#62666D] font-medium">{new Date(h.created_at).toLocaleDateString('ar-SA')}</span>
 <span className="text-[#62666D]">â†’</span>
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
 <h3 className="font-bold text-[#111214]">ط­ط¬ط² ط¬ط¯ظٹط¯</h3>
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
 <h4 className="text-xs font-bold text-[#111214]">ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¹ظ…ظٹظ„</h4>
 </div>
 <div className="px-4 py-4 space-y-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ط³ظ… ط§ظ„ط¹ظ…ظٹظ„ *</label>
 <input type="text" value={createFormData.customerName} onChange={e => setCreateFormData(p => ({ ...p, customerName: e.target.value }))} className={`w-full bg-white border ${createErrors.customerName ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all`} placeholder="ط§ظ„ط§ط³ظ… ط§ظ„ظƒط§ظ…ظ„" />
 {createErrors.customerName && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.customerName}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ *</label>
 <input type="tel" value={createFormData.customerPhone} onChange={e => setCreateFormData(p => ({ ...p, customerPhone: e.target.value }))} className={`w-full bg-white border ${createErrors.customerPhone ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all`} placeholder="05XXXXXXXX" dir="ltr" />
 {createErrors.customerPhone && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.customerPhone}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ (ط§ط®طھظٹط§ط±ظٹ)</label>
 <input type="email" value={createFormData.customerEmail} onChange={e => setCreateFormData(p => ({ ...p, customerEmail: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all" placeholder="email@example.com" dir="ltr" />
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCar className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">ط¨ظٹط§ظ†ط§طھ ط§ظ„ط³ظٹط§ط±ط©</h4>
 </div>
 <div className="px-4 py-4 grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„ظ…ط§ط±ظƒط© *</label>
 <input type="text" value={createFormData.vehicleMake} onChange={e => setCreateFormData(p => ({ ...p, vehicleMake: e.target.value }))} className={`w-full bg-white border ${createErrors.vehicleMake ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all`} placeholder="ظ…ط«ط§ظ„: طھظˆظٹظˆطھط§" />
 {createErrors.vehicleMake && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.vehicleMake}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„ظ…ظˆط¯ظٹظ„ *</label>
 <input type="text" value={createFormData.vehicleModel} onChange={e => setCreateFormData(p => ({ ...p, vehicleModel: e.target.value }))} className={`w-full bg-white border ${createErrors.vehicleModel ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all`} placeholder="ظ…ط«ط§ظ„: ظƒط§ظ…ط±ظٹ" />
 {createErrors.vehicleModel && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.vehicleModel}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط³ظ†ط© ط§ظ„طµظ†ط¹ *</label>
 <input type="number" value={createFormData.vehicleYear} onChange={e => setCreateFormData(p => ({ ...p, vehicleYear: e.target.value }))} min="1900" max={new Date().getFullYear() + 1} className={`w-full bg-white border ${createErrors.vehicleYear ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all`} dir="ltr" />
 {createErrors.vehicleYear && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.vehicleYear}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„ظ„ظˆظ†</label>
 <input type="text" value={createFormData.vehicleColor} onChange={e => setCreateFormData(p => ({ ...p, vehicleColor: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all" placeholder="ظ…ط«ط§ظ„: ط£ط¨ظٹط¶" />
 </div>
 <div className="col-span-2">
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط±ظ‚ظ… ط§ظ„ظ„ظˆط­ط©</label>
 <input type="text" value={createFormData.vehiclePlate} onChange={e => setCreateFormData(p => ({ ...p, vehiclePlate: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all" placeholder="ظ…ط«ط§ظ„: ط£ ط¨ ط¬ 1234" />
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA] flex items-center gap-2">
 <FaCalendarAlt className="text-[#DC2626] text-xs" />
 <h4 className="text-xs font-bold text-[#111214]">ط§ظ„ط®ط¯ظ…ط© ظˆط§ظ„ظ…ظˆط¹ط¯</h4>
 </div>
 <div className="px-4 py-4 space-y-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„ط®ط¯ظ…ط© *</label>
 <select value={createFormData.serviceId} onChange={e => setCreateFormData(p => ({ ...p, serviceId: e.target.value }))} className={`w-full bg-white border ${createErrors.serviceId ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none appearance-none cursor-pointer transition-all`}>
 <option value="">ط§ط®طھط± ط§ظ„ط®ط¯ظ…ط©</option>
 {services.map(s => <option key={s.id} value={s.id}>{s.name}{s.base_price ? ` â€” ${s.base_price.toLocaleString('ar-SA')} ط±.ط³` : ''}</option>)}
 </select>
 {createErrors.serviceId && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.serviceId}</p>}
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„طھط§ط±ظٹط® ط§ظ„ظ…ظپط¶ظ„ *</label>
 <input type="date" value={createFormData.preferredDate} onChange={e => setCreateFormData(p => ({ ...p, preferredDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} className={`w-full bg-white border ${createErrors.preferredDate ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none transition-all`} />
 {createErrors.preferredDate && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.preferredDate}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط§ظ„ظˆظ‚طھ ط§ظ„ظ…ظپط¶ظ„ *</label>
 <select value={createFormData.preferredTime} onChange={e => setCreateFormData(p => ({ ...p, preferredTime: e.target.value }))} className={`w-full bg-white border ${createErrors.preferredTime ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none appearance-none cursor-pointer transition-all`}>
 <option value="">ط§ط®طھط± ط§ظ„ظˆظ‚طھ</option>
 {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 {createErrors.preferredTime && <p className="text-[#DC2626] text-xs mt-1.5">{createErrors.preferredTime}</p>}
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-2xl border border-[#E7E8EA] overflow-hidden">
 <div className="px-4 py-2.5 bg-[#FBFBFA] border-b border-[#E7E8EA]">
 <label className="text-xs font-bold text-[#111214] block">ظ…ظ„ط§ط­ط¸ط§طھ</label>
 </div>
 <div className="px-4 py-4">
 <textarea rows={2} value={createFormData.notes} onChange={e => setCreateFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] transition-all resize-none" placeholder="ظ…ظ„ط§ط­ط¸ط§طھ ط¥ط¶ط§ظپظٹط©..." />
 </div>
 </div>

 <div className="flex gap-3 pt-2">
 <button type="submit" disabled={createSubmitting} className="flex-1 px-4 py-3 bg-gradient-to-br from-[#DC2626] to-[#9B1B30] hover:from-[#9B1B30] hover:to-[#7A1526] text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
 {createSubmitting ? <><FaSpinner className="animate-spin" /> ط¬ط§ط±ظٹ ط§ظ„ط¥ظ†ط´ط§ط،...</> : 'ط¥ظ†ط´ط§ط، ط§ظ„ط­ط¬ط²'}
 </button>
 <button type="button" onClick={() => setShowCreateForm(false)} className="px-5 py-3 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all duration-200">
 ط¥ظ„ط؛ط§ط،
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
 <h3 className="text-base font-black text-[#111214]">طھط£ظƒظٹط¯ ط§ظ„ط­ط°ظپ</h3>
 <p className="text-xs text-[#62666D] mt-0.5">ظ„ط§ ظٹظ…ظƒظ† ط§ظ„طھط±ط§ط¬ط¹ ط¹ظ† ظ‡ط°ط§ ط§ظ„ط¥ط¬ط±ط§ط،</p>
 </div>
 </div>

 <div className="px-6 mb-4">
 <div className="p-3.5 bg-[#FEF2F2] rounded-2xl border border-[#FECACA] flex items-center gap-2.5">
 <FaExclamationTriangle className="text-[#DC2626] shrink-0" />
 <div>
 <p className="text-xs text-[#DC2626] font-bold">ط§ظ„ط¹ظ…ظٹظ„: {deleteTarget.customer?.full_name || '---'}</p>
 <p className="text-[10px] text-[#DC2626]/70 mt-0.5">{deleteTarget.vehicle?.make} {deleteTarget.vehicle?.model}</p>
 </div>
 </div>
 </div>

 <div className="px-6 mb-3">
 <label className="text-xs font-bold text-[#62666D] mb-1.5 block">ط£ط¯ط®ظ„ ط±ظ…ط² ط§ظ„ط­ط°ظپ ط§ظ„ط³ط±ظٹ</label>
 <input
 type="password"
 value={deleteToken}
 onChange={e => { setDeleteToken(e.target.value); setDeleteError('') }}
 className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3.5 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-red-500/10 transition-all"
 placeholder="ط§ظ„ط±ظ…ط² ط§ظ„ط³ط±ظٹ..."
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
 {deleteLoading ? <><FaSpinner className="animate-spin" /> ط¬ط§ط±ظٹ ط§ظ„ط­ط°ظپ...</> : 'ط­ط°ظپ ظ†ظ‡ط§ط¦ظٹط§ظ‹'}
 </button>
 <button
 onClick={() => { setDeleteTarget(null); setDeleteToken(''); setDeleteError('') }}
 className="px-5 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all duration-200"
 >
 ط¥ظ„ط؛ط§ط،
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}