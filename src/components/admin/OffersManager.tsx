'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
  FaSearch,
  FaTimes,
  FaSpinner,
  FaBoxOpen,
  FaPlus,
  FaPen,
  FaTrash,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTag,
  FaPercent,
  FaGift,
  FaDollarSign,
  FaCalendarAlt,
} from 'react-icons/fa'

interface Offer {
  id: string
  title: string
  description: string | null
  offer_type: string
  value: number | null
  service_id: string | null
  dealer_id: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  created_at: string
  service?: { id: string; name: string }
  dealer?: { id: string; business_name: string }
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const OFFER_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  fixed_discount: { label: 'خصم ثابت', color: 'text-[#059669]', bg: 'bg-[#ECFDF5] border-[#A7F3D0]', icon: <FaDollarSign className="text-xs" /> },
  percentage_discount: { label: 'خصم نسبة', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF] border-[#BFDBFE]', icon: <FaPercent className="text-xs" /> },
  free_service: { label: 'خدمة مجانية', color: 'text-[#7C3AED]', bg: 'bg-[#FAF5FF] border-[#DDD6FE]', icon: <FaGift className="text-xs" /> },
  special_price: { label: 'سعر خاص', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB] border-[#FDE68A]', icon: <FaTag className="text-xs" /> },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export default function OffersManager() {
  const { hasPermission } = useAuth()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canCreate = hasPermission('offers', 'create')
  const canUpdate = hasPermission('offers', 'update')
  const canDelete = hasPermission('offers', 'delete')

  const [showForm, setShowForm] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    offer_type: 'fixed_discount' as string,
    value: '',
    start_date: '',
    end_date: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSubmitting, setFormSubmitting] = useState(false)

  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 4000)
    return () => clearTimeout(t)
  }, [notification])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    try {
      const { getOffers } = await import('@/app/actions/offer')
      const result = await getOffers({
        search: debouncedSearch || undefined,
        offer_type: typeFilter !== 'all' ? typeFilter as 'fixed_discount' | 'percentage_discount' | 'free_service' | 'special_price' : undefined,
      }, page)
      setOffers(result.data || [])
      setPagination({ page: result.page, pageSize: result.per_page, total: result.total, totalPages: result.total_pages })
    } catch {
      setNotification({ type: 'error', message: 'تعذر جلب العروض' })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, typeFilter, page])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  const handleOpenForm = (offer?: Offer) => {
    if (offer) {
      setEditingOffer(offer)
      setFormData({
        title: offer.title,
        description: offer.description || '',
        offer_type: offer.offer_type,
        value: offer.value?.toString() || '',
        start_date: offer.start_date ? offer.start_date.slice(0, 10) : '',
        end_date: offer.end_date ? offer.end_date.slice(0, 10) : '',
      })
    } else {
      setEditingOffer(null)
      setFormData({ title: '', description: '', offer_type: 'fixed_discount', value: '', start_date: '', end_date: '' })
    }
    setFormErrors({})
    setShowForm(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors({})
    const errs: Record<string, string> = {}
    if (!formData.title.trim() || formData.title.trim().length < 2) errs.title = 'عنوان العرض مطلوب'
    if ((formData.offer_type === 'fixed_discount' || formData.offer_type === 'percentage_discount') && (!formData.value || parseFloat(formData.value) <= 0)) errs.value = 'قيمة العرض مطلوبة'
    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) errs.end_date = 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية'
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setFormSubmitting(true)
    try {
      if (editingOffer) {
        const { updateOffer } = await import('@/app/actions/offer')
        const result = await updateOffer(editingOffer.id, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          offer_type: formData.offer_type as 'fixed_discount' | 'percentage_discount' | 'free_service' | 'special_price',
          value: formData.value ? parseFloat(formData.value) : undefined,
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined,
        })
        if (result.success) {
          setNotification({ type: 'success', message: 'تم تحديث العرض بنجاح' })
          setShowForm(false)
          fetchOffers()
        } else {
          setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
        }
      } else {
        const { createOffer } = await import('@/app/actions/offer')
        const result = await createOffer({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          offer_type: formData.offer_type as 'fixed_discount' | 'percentage_discount' | 'free_service' | 'special_price',
          value: formData.value ? parseFloat(formData.value) : undefined,
          start_date: formData.start_date || undefined,
          end_date: formData.end_date || undefined,
        })
        if (result.success) {
          setNotification({ type: 'success', message: 'تم إنشاء العرض بنجاح' })
          setShowForm(false)
          fetchOffers()
        } else {
          setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
        }
      }
    } catch {
      setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeleteOffer = async (offer: Offer) => {
    if (!confirm(`هل أنت متأكد من حذف "${offer.title}"؟`)) return
    setActionLoading(offer.id)
    try {
      const { deleteOffer } = await import('@/app/actions/offer')
      const result = await deleteOffer(offer.id)
      if (result.success) {
        setNotification({ type: 'success', message: 'تم حذف العرض بنجاح' })
        fetchOffers()
      } else {
        setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
      }
    } catch {
      setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
    } finally {
      setActionLoading(null)
    }
  }

  const typeBadge = (type: string) => {
    const c = OFFER_TYPE_CONFIG[type] || OFFER_TYPE_CONFIG.fixed_discount
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${c.bg} ${c.color}`}>
        {c.icon} {c.label}
      </span>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {notification && (
        <div className={`p-3 rounded-xl border text-sm font-bold mb-4 ${
          notification.type === 'success' ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
        }`}>
          {notification.type === 'success' ? <FaCheckCircle className="inline ml-2" /> : <FaExclamationTriangle className="inline ml-2" />}
          {notification.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#111214] flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
              <FaTag className="text-[#2563EB] text-sm" />
            </div>
            العروض
          </h1>
          <p className="text-[#62666D] text-sm mt-1">إدارة عروض الشركة</p>
        </div>
        {canCreate && (
          <button onClick={() => handleOpenForm()} className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            <FaPlus className="text-xs" />
            عرض جديد
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
          <input
            type="text"
            placeholder="بحث في العروض..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl py-2.5 pr-10 pl-4 text-[#111214] text-sm placeholder-slate-500 focus:outline-none focus:border-[#DC2626]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl px-4 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer"
        >
          <option value="all">جميع الأنواع</option>
          {Object.entries(OFFER_TYPE_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
            <p className="text-[#62666D] text-sm">جاري التحميل...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center">
            <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
            <p className="text-[#62666D] text-sm">لا توجد عروض</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E8EA]">
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">العنوان</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">النوع</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">القيمة</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الحالة</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">التاريخ</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {offers.map(offer => (
                  <tr key={offer.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
                    <td className="px-4 py-3">
                      <p className="text-[#111214] font-bold">{offer.title}</p>
                      {offer.description && <p className="text-[#62666D] text-xs mt-0.5 truncate max-w-[200px]">{offer.description}</p>}
                    </td>
                    <td className="px-4 py-3">{typeBadge(offer.offer_type)}</td>
                    <td className="px-4 py-3 text-[#111214] font-bold text-xs">
                      {offer.value != null ? (
                        offer.offer_type === 'percentage_discount' ? `${offer.value}%` : `${formatCurrency(offer.value)} ر.س`
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${offer.is_active ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#F1F2F3] text-[#62666D]'}`}>
                        {offer.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#62666D] text-xs">
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt className="text-[9px]" />
                        {new Date(offer.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canUpdate && (
                          <button onClick={() => handleOpenForm(offer)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]">
                            <FaPen className="text-xs" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDeleteOffer(offer)} disabled={actionLoading === offer.id} className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#62666D] hover:text-[#DC2626] disabled:opacity-50">
                            {actionLoading === offer.id ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-[#62666D]">
            {pagination.total} نتيجة — صفحة {pagination.page} من {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all disabled:opacity-30"
            >
              السابق
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all disabled:opacity-30"
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
              <h3 className="text-[#111214] font-black">{editingOffer ? 'تعديل العرض' : 'عرض جديد'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes className="text-sm" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">عنوان العرض *</label>
                <input type="text" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className={`w-full bg-white border ${formErrors.title ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="عنوان العرض" />
                {formErrors.title && <p className="text-[#DC2626] text-xs mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">الوصف</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="وصف العرض..." />
              </div>
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">نوع العرض *</label>
                <select value={formData.offer_type} onChange={e => setFormData(p => ({ ...p, offer_type: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer">
                  {Object.entries(OFFER_TYPE_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              {(formData.offer_type === 'fixed_discount' || formData.offer_type === 'percentage_discount') && (
                <div>
                  <label className="text-xs font-bold text-[#62666D] mb-1 block">
                    القيمة * {formData.offer_type === 'percentage_discount' ? '(%)' : '(ر.س)'}
                  </label>
                  <input type="number" min="0" step="0.01" value={formData.value} onChange={e => setFormData(p => ({ ...p, value: e.target.value }))} className={`w-full bg-white border ${formErrors.value ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="0" dir="ltr" />
                  {formErrors.value && <p className="text-[#DC2626] text-xs mt-1">{formErrors.value}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#62666D] mb-1 block">تاريخ البداية</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#62666D] mb-1 block">تاريخ الانتهاء</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))} className={`w-full bg-white border ${formErrors.end_date ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} dir="ltr" />
                  {formErrors.end_date && <p className="text-[#DC2626] text-xs mt-1">{formErrors.end_date}</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={formSubmitting} className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {formSubmitting ? <><FaSpinner className="animate-spin" /> جاري الحفظ...</> : editingOffer ? 'تحديث' : 'إضافة'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
