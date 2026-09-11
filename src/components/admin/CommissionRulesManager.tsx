'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaExchangeAlt,
 FaSpinner,
 FaBoxOpen,
 FaPlus,
 FaPen,
 FaTimes,
 FaCheckCircle,
 FaExclamationTriangle,
 FaToggleOn,
 FaToggleOff,
 FaPercent,
 FaDollarSign,
} from 'react-icons/fa'

interface CommissionRule {
 id: string
 name: string
 calculation_type: string
 rate_value: number
 dealer_id: string | null
 service_id: string | null
 priority: number
 is_active: boolean
 notes: string | null
 created_at: string
 dealer?: { business_name: string }
 service?: { name: string }
}

interface Pagination {
 page: number
 total: number
 totalPages: number
}

type Notification = { type: 'success' | 'error'; message: string } | null

export default function CommissionRulesManager() {
 const { hasPermission } = useAuth()
 const [rules, setRules] = useState<CommissionRule[]>([])
 const [loading, setLoading] = useState(true)
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingRule, setEditingRule] = useState<CommissionRule | null>(null)
 const [dealers, setDealers] = useState<{ id: string; business_name: string }[]>([])
 const [services, setServices] = useState<{ id: string; name: string }[]>([])
 const [formData, setFormData] = useState({
   name: '',
   calculation_type: 'percentage' as 'fixed' | 'percentage',
   rate_value: 0,
   dealer_id: '',
   service_id: '',
   priority: 0,
   notes: '',
 })
 const [formErrors, setFormErrors] = useState<Record<string, string>>({})
 const [formSubmitting, setFormSubmitting] = useState(false)
 const [actionLoading, setActionLoading] = useState<string | null>(null)

 const canCreate = hasPermission('commission_rules', 'create')
 const canUpdate = hasPermission('commission_rules', 'update')

 const fetchRules = useCallback(async () => {
   try {
     setLoading(true)
     const { getCommissionRules } = await import('@/app/actions/commission')
     const result = await getCommissionRules({}, page)
     if (result.data) {
       setRules(result.data)
       setPagination({ page: result.page, total: result.total, totalPages: result.total_pages })
     }
   } catch {
   } finally {
     setLoading(false)
   }
 }, [page])

 useEffect(() => { fetchRules() }, [fetchRules])

 useEffect(() => {
   if (!notification) return
   const t = setTimeout(() => setNotification(null), 4000)
   return () => clearTimeout(t)
 }, [notification])

 const loadDropdownData = async () => {
   if (dealers.length === 0) {
     try {
       const { getDealers } = await import('@/app/actions/dealer')
       const res = await getDealers()
       if ('data' in res) setDealers((res.data || []).map((d: { id: string; business_name: string }) => ({ id: d.id, business_name: d.business_name })))
     } catch {}
   }
   if (services.length === 0) {
     try {
       const { getServices } = await import('@/app/actions/services')
       const res = await getServices()
       if (res.success) setServices(res.data || [])
     } catch {}
   }
 }

 const handleOpenForm = async (rule?: CommissionRule) => {
   await loadDropdownData()
   if (rule) {
     setEditingRule(rule)
     setFormData({
       name: rule.name,
       calculation_type: rule.calculation_type as 'fixed' | 'percentage',
       rate_value: rule.rate_value,
       dealer_id: rule.dealer_id || '',
       service_id: rule.service_id || '',
       priority: rule.priority,
       notes: rule.notes || '',
     })
   } else {
     setEditingRule(null)
     setFormData({ name: '', calculation_type: 'percentage', rate_value: 0, dealer_id: '', service_id: '', priority: 0, notes: '' })
   }
   setFormErrors({})
   setShowForm(true)
 }

 const handleFormSubmit = async (e: React.FormEvent) => {
   e.preventDefault()
   setFormErrors({})
   const errs: Record<string, string> = {}
   if (!formData.name.trim() || formData.name.trim().length < 2) errs.name = 'اسم القاعدة مطلوب'
   if (formData.rate_value < 0) errs.rate_value = 'قيمة العمولة يجب أن تكون موجبة'
   if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
   setFormSubmitting(true)
   try {
     if (editingRule) {
       const { updateCommissionRule } = await import('@/app/actions/commission')
       const result = await updateCommissionRule(editingRule.id, {
         name: formData.name.trim(),
         calculation_type: formData.calculation_type,
         rate_value: formData.rate_value,
         priority: formData.priority,
         notes: formData.notes.trim() || undefined,
       })
       if (result.success) {
         setNotification({ type: 'success', message: 'تم تحديث القاعدة بنجاح' })
         setShowForm(false)
         fetchRules()
       } else {
         setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
       }
     } else {
       const { createCommissionRule } = await import('@/app/actions/commission')
       const result = await createCommissionRule({
         name: formData.name.trim(),
         calculation_type: formData.calculation_type,
         rate_value: formData.rate_value,
         dealer_id: formData.dealer_id || undefined,
         service_id: formData.service_id || undefined,
         priority: formData.priority,
         notes: formData.notes.trim() || undefined,
       })
       if (result.success) {
         setNotification({ type: 'success', message: 'تم إنشاء القاعدة بنجاح' })
         setShowForm(false)
         fetchRules()
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

 const handleToggleActive = async (rule: CommissionRule) => {
   setActionLoading(rule.id)
   try {
     const { updateCommissionRule } = await import('@/app/actions/commission')
     const result = await updateCommissionRule(rule.id, { is_active: !rule.is_active })
     if (result.success) {
       setNotification({ type: 'success', message: rule.is_active ? 'تم تعطيل القاعدة' : 'تم تفعيل القاعدة' })
       fetchRules()
     } else {
       setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
   } finally {
     setActionLoading(null)
   }
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
 <h1 className="text-2xl font-black text-[#111214]">قواعد العمولات</h1>
 <p className="text-[#62666D] text-sm mt-1">إدارة قواعد حساب العمولات</p>
 </div>
 {canCreate && (
 <button onClick={() => handleOpenForm()} className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
 <FaPlus className="text-xs" />
 قاعدة جديدة
 </button>
 )}
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-12 text-center">
 <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">جاري التحميل...</p>
 </div>
 ) : rules.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا توجد قواعد عمولات</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الاسم</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">النوع</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">القيمة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الوكيل</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الخدمة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الأولوية</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">إجراءات</th>
 </tr>
 </thead>
 <tbody>
 {rules.map(rule => (
 <tr key={rule.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{rule.name}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
 rule.calculation_type === 'percentage' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#ECFDF5] text-[#059669]'
 }`}>
 {rule.calculation_type === 'percentage' ? <FaPercent className="text-[8px]" /> : <FaDollarSign className="text-[8px]" />}
 {rule.calculation_type === 'percentage' ? 'نسبة' : 'ثابت'}
 </span>
 </td>
 <td className="px-4 py-3 text-[#111214] font-bold">
 {rule.calculation_type === 'percentage' ? `${rule.rate_value}%` : `${rule.rate_value.toLocaleString('en-GB')} ر.س`}
 </td>
 <td className="px-4 py-3 text-[#62666D]">{rule.dealer?.business_name || 'جميع الوكلاء'}</td>
 <td className="px-4 py-3 text-[#62666D]">{rule.service?.name || 'جميع الخدمات'}</td>
 <td className="px-4 py-3 text-[#62666D]">{rule.priority}</td>
 <td className="px-4 py-3">
 <button onClick={() => handleToggleActive(rule)} disabled={actionLoading === rule.id || !canUpdate} className="disabled:opacity-50">
 {actionLoading === rule.id ? <FaSpinner className="animate-spin text-xs" /> : rule.is_active ? <FaToggleOn className="text-[#059669] text-lg" /> : <FaToggleOff className="text-[#62666D] text-lg" />}
 </button>
 </td>
 <td className="px-4 py-3">
 {canUpdate && (
 <button onClick={() => handleOpenForm(rule)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]">
 <FaPen className="text-xs" />
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {pagination && pagination.totalPages > 1 && (
 <div className="flex items-center justify-center gap-2 mt-4">
 <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-[#F7F7F5] text-[#62666D] text-xs font-bold disabled:opacity-30">السابق</button>
 <span className="text-[#62666D] text-xs">{page} / {pagination.totalPages}</span>
 <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="px-3 py-1.5 rounded-lg bg-[#F7F7F5] text-[#62666D] text-xs font-bold disabled:opacity-30">التالي</button>
 </div>
 )}

 {showForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
 <h3 className="text-[#111214] font-black">{editingRule ? 'تعديل القاعدة' : 'قاعدة جديدة'}</h3>
 <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes className="text-sm" /></button>
 </div>
 <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">اسم القاعدة *</label>
 <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={`w-full bg-white border ${formErrors.name ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="اسم القاعدة" />
 {formErrors.name && <p className="text-[#DC2626] text-xs mt-1">{formErrors.name}</p>}
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">نوع الحساب</label>
 <select value={formData.calculation_type} onChange={e => setFormData(p => ({ ...p, calculation_type: e.target.value as 'fixed' | 'percentage' }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer">
 <option value="percentage">نسبة مئوية</option>
 <option value="fixed">مبلغ ثابت</option>
 </select>
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">قيمة العمولة *</label>
 <input type="number" min="0" step="0.01" value={formData.rate_value} onChange={e => setFormData(p => ({ ...p, rate_value: parseFloat(e.target.value) || 0 }))} className={`w-full bg-white border ${formErrors.rate_value ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} dir="ltr" />
 {formErrors.rate_value && <p className="text-[#DC2626] text-xs mt-1">{formErrors.rate_value}</p>}
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الوكيل</label>
 <select value={formData.dealer_id} onChange={e => setFormData(p => ({ ...p, dealer_id: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer">
 <option value="">جميع الوكلاء</option>
 {dealers.map(d => <option key={d.id} value={d.id}>{d.business_name}</option>)}
 </select>
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الخدمة</label>
 <select value={formData.service_id} onChange={e => setFormData(p => ({ ...p, service_id: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer">
 <option value="">جميع الخدمات</option>
 {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الأولوية</label>
 <input type="number" value={formData.priority} onChange={e => setFormData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" dir="ltr" />
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">ملاحظات</label>
 <textarea rows={2} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] resize-none" placeholder="ملاحظات..." />
 </div>
 <div className="flex gap-3 pt-2">
 <button type="submit" disabled={formSubmitting} className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
 {formSubmitting ? <><FaSpinner className="animate-spin" /> جاري الحفظ...</> : editingRule ? 'تحديث' : 'إضافة'}
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
