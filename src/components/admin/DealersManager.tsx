'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
  FaSearch,
  FaEye,
  FaTimes,
  FaSpinner,
  FaBoxOpen,
  FaPlus,
  FaPen,
  FaTrash,
  FaCheckCircle,
  FaExclamationTriangle,
  FaToggleOn,
  FaToggleOff,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaBuilding,
} from 'react-icons/fa'

interface Dealer {
  id: string
  business_name: string
  phone: string
  email: string | null
  status: string
  is_active: boolean
  referral_count?: number
  created_at: string
}

interface Referral {
  id: string
  referral_code: string
  customer_name: string
  customer_phone: string
  status: string
  dealer_id: string
  created_at: string
}

export default function DealersManager() {
  const { hasPermission } = useAuth()
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [dealerReferrals, setDealerReferrals] = useState<Referral[]>([])
  const [loadingReferrals, setLoadingReferrals] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null)
  const [formData, setFormData] = useState({ business_name: '', phone: '', email: '', address: '', notes: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canCreate = hasPermission('dealers', 'create')
  const canUpdate = hasPermission('dealers', 'update')
  const canDelete = hasPermission('dealers', 'delete')

  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 4000)
    return () => clearTimeout(t)
  }, [notification])

  const loadDealers = useCallback(async () => {
    setLoading(true)
    try {
      const { getDealers } = await import('@/app/actions/dealer')
      const result = await getDealers({ search: search || undefined })
      if ('data' in result) setDealers(result.data || [])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { loadDealers() }, [loadDealers])

  const loadDealerReferrals = async (dealerId: string) => {
    setLoadingReferrals(true)
    try {
      const { getReferrals } = await import('@/app/actions/referral')
      const result = await getReferrals({ dealer_id: dealerId })
      if ('data' in result) setDealerReferrals(result.data || [])
    } finally {
      setLoadingReferrals(false)
    }
  }

  const handleOpenForm = (dealer?: Dealer) => {
    if (dealer) {
      setEditingDealer(dealer)
      setFormData({ business_name: dealer.business_name, phone: dealer.phone, email: dealer.email || '', address: (dealer as Dealer & { address?: string }).address || '', notes: (dealer as Dealer & { notes?: string }).notes || '' })
    } else {
      setEditingDealer(null)
      setFormData({ business_name: '', phone: '', email: '', address: '', notes: '' })
    }
    setFormErrors({})
    setShowForm(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors({})
    const errs: Record<string, string> = {}
    if (!formData.business_name.trim() || formData.business_name.trim().length < 2) errs.business_name = 'اسم النشاط مطلوب'
    if (!formData.phone.trim() || formData.phone.trim().length < 5) errs.phone = 'رقم الهاتف مطلوب'
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setFormSubmitting(true)
    try {
      if (editingDealer) {
        const { updateDealer } = await import('@/app/actions/dealer')
        const result = await updateDealer(editingDealer.id, { business_name: formData.business_name.trim(), phone: formData.phone.trim(), email: formData.email.trim() || undefined, address: formData.address.trim() || undefined, notes: formData.notes.trim() || undefined })
        if (result.success) {
          setNotification({ type: 'success', message: 'تم تحديث الوكيل بنجاح' })
          setShowForm(false)
          loadDealers()
        } else {
          setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
        }
      } else {
        const { createDealer } = await import('@/app/actions/dealer')
        const result = await createDealer({ business_name: formData.business_name.trim(), phone: formData.phone.trim(), email: formData.email.trim() || undefined, address: formData.address.trim() || undefined, notes: formData.notes.trim() || undefined })
        if (result.success) {
          setNotification({ type: 'success', message: 'تم إنشاء الوكيل بنجاح' })
          setShowForm(false)
          loadDealers()
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

  const handleToggleDealer = async (dealer: Dealer) => {
    setActionLoading(dealer.id)
    try {
      if (dealer.is_active) {
        const { softDeleteDealer } = await import('@/app/actions/dealer')
        const result = await softDeleteDealer(dealer.id)
        if (result.success) {
          setNotification({ type: 'success', message: 'تم تعطيل الوكيل' })
          loadDealers()
        } else {
          setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
        }
      } else {
        const { activateDealer } = await import('@/app/actions/dealer')
        const result = await activateDealer(dealer.id)
        if (result.success) {
          setNotification({ type: 'success', message: 'تم تفعيل الوكيل' })
          loadDealers()
        } else {
          setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
        }
      }
    } catch {
      setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer)
    loadDealerReferrals(dealer.id)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      active: { bg: 'bg-[#ECFDF5] text-[#059669]', label: 'نشط' },
      inactive: { bg: 'bg-[#F1F2F3] text-[#62666D]', label: 'غير نشط' },
      suspended: { bg: 'bg-[#FEF2F2] text-[#DC2626]', label: 'معلق' },
    }
    const s = map[status] || map.active
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg}`}>{s.label}</span>
    )
  }

  const referralStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      created: 'bg-[#EFF6FF] text-[#2563EB]',
      contacted: 'bg-[#FFFBEB] text-[#D97706]',
      redeemed: 'bg-[#ECFDF5] text-[#059669]',
      completed: 'bg-[#ECFDF5] text-[#059669]',
      cancelled: 'bg-[#FEF2F2] text-[#DC2626]',
      expired: 'bg-[#F1F2F3] text-[#62666D]',
    }
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${map[status] || map.created}`}>{status}</span>
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
          <h1 className="text-2xl font-black text-[#111214]">الوكلاء</h1>
          <p className="text-[#62666D] text-sm mt-1">إدارة الوكلاء والإحالات</p>
        </div>
        {canCreate && (
          <button onClick={() => handleOpenForm()} className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            <FaPlus className="text-xs" />
            وكيل جديد
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl py-2.5 pr-10 pl-4 text-[#111214] text-sm placeholder-slate-500 focus:outline-none focus:border-[#DC2626]"
          />
        </div>
      </div>

      <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
            <p className="text-[#62666D] text-sm">جاري التحميل...</p>
          </div>
        ) : dealers.length === 0 ? (
          <div className="p-12 text-center">
            <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
            <p className="text-[#62666D] text-sm">لا يوجد وكلاء</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E8EA]">
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الاسم</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الهاتف</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الحالة</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الإحالات</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">تاريخ الإنشاء</th>
                  <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map(dealer => (
                  <tr key={dealer.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
                    <td className="px-4 py-3 text-[#111214] font-bold">{dealer.business_name}</td>
                    <td className="px-4 py-3 text-[#111214]">{dealer.phone}</td>
                    <td className="px-4 py-3">{statusBadge(dealer.status)}</td>
                    <td className="px-4 py-3 text-[#111214]">{dealer.referral_count || 0}</td>
                    <td className="px-4 py-3 text-[#62666D] text-xs">
                      {new Date(dealer.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleViewDealer(dealer)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]"><FaEye className="text-xs" /></button>
                        {canUpdate && <button onClick={() => handleOpenForm(dealer)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]"><FaPen className="text-xs" /></button>}
                        {canDelete && (
                          <button onClick={() => handleToggleDealer(dealer)} disabled={actionLoading === dealer.id} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] disabled:opacity-50">
                            {actionLoading === dealer.id ? <FaSpinner className="animate-spin text-xs" /> : dealer.is_active ? <FaToggleOn className="text-[#059669] text-sm" /> : <FaToggleOff className="text-[#DC2626] text-sm" />}
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

      {selectedDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
              <h3 className="text-[#111214] font-black">{selectedDealer.business_name}</h3>
              <button onClick={() => setSelectedDealer(null)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]">
                <FaTimes className="text-sm" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[#62666D] text-xs mb-1">الهاتف</p>
                  <p className="text-[#111214] text-sm font-bold">{selectedDealer.phone}</p>
                </div>
                <div>
                  <p className="text-[#62666D] text-xs mb-1">البريد الإلكتروني</p>
                  <p className="text-[#111214] text-sm font-bold">{selectedDealer.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[#62666D] text-xs mb-1">الحالة</p>
                  {statusBadge(selectedDealer.status)}
                </div>
                <div>
                  <p className="text-[#62666D] text-xs mb-1">الإحالات</p>
                  <p className="text-[#111214] text-sm font-bold">{selectedDealer.referral_count || 0}</p>
                </div>
              </div>

              <h4 className="text-[#111214] font-black text-sm mb-3">الإحالات الأخيرة</h4>
              {loadingReferrals ? (
                <FaSpinner className="animate-spin text-[#DC2626] mx-auto" />
              ) : dealerReferrals.length === 0 ? (
                <p className="text-[#62666D] text-sm text-center py-4">لا توجد إحالات</p>
              ) : (
                <div className="space-y-2">
                  {dealerReferrals.map(r => (
                    <div key={r.id} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-[#111214] text-sm font-bold">{r.customer_name}</p>
                        <p className="text-[#62666D] text-xs">{r.customer_phone}</p>
                      </div>
                      {referralStatusBadge(r.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
              <h3 className="text-[#111214] font-black">{editingDealer ? 'تعديل الوكيل' : 'وكيل جديد'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes className="text-sm" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">اسم النشاط *</label>
                <input type="text" value={formData.business_name} onChange={e => setFormData(p => ({ ...p, business_name: e.target.value }))} className={`w-full bg-white border ${formErrors.business_name ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="اسم النشاط التجاري" />
                {formErrors.business_name && <p className="text-[#DC2626] text-xs mt-1">{formErrors.business_name}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">رقم الهاتف *</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className={`w-full bg-white border ${formErrors.phone ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="05XXXXXXXX" dir="ltr" />
                {formErrors.phone && <p className="text-[#DC2626] text-xs mt-1">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">البريد الإلكتروني</label>
                <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" placeholder="email@example.com" dir="ltr" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">العنوان</label>
                <input type="text" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" placeholder="العنوان" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#62666D] mb-1 block">ملاحظات</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="ملاحظات..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={formSubmitting} className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {formSubmitting ? <><FaSpinner className="animate-spin" /> جاري الحفظ...</> : editingDealer ? 'تحديث' : 'إضافة'}
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
