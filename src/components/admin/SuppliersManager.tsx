'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch, FaEye, FaPen, FaTrash, FaTimes, FaExclamationTriangle,
  FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle, FaPlus,
  FaToggleOn, FaToggleOff, FaTruck, FaPhone, FaEnvelope, FaMapMarkerAlt, FaCalendarAlt, FaShoppingCart,
} from 'react-icons/fa'

interface Supplier {
 id: string; name: string; phone: string | null; email: string | null;
 address: string | null; notes: string | null; is_active: boolean; created_at: string;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }

type Notification = { type: 'success' | 'error'; message: string } | null

export default function SuppliersManager({ initialSuppliers, initialPagination }: {
 initialSuppliers?: Supplier[]
 initialPagination?: Pagination
} = {}) {
 const { hasPermission } = useAuth()
 const skipInitialFetch = useRef(initialSuppliers !== undefined)
 const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers ?? [])
 const [loading, setLoading] = useState(initialSuppliers === undefined)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(initialPagination ?? null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
 const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
 const [supplierHistory, setSupplierHistory] = useState<{ total_purchases: number; total_spend: number; last_purchase: string | null } | null>(null)
 const [saving, setSaving] = useState(false)
 const [actionLoading, setActionLoading] = useState<string | null>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const canCreate = hasPermission('suppliers', 'create')
 const canUpdate = hasPermission('suppliers', 'update')
 const canDelete = hasPermission('suppliers', 'delete')

 const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' })

 const loadSuppliers = useCallback(async (s: string, p: number) => {
 setLoading(true)
 try {
 const { getSuppliers } = await import('@/app/actions/suppliers')
 const res = await getSuppliers(s || undefined, p)
 if (res.success) { setSuppliers(res.data); setPagination(res.pagination) }
 } finally { setLoading(false) }
 }, [])

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
 return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
 }, [search])

 useEffect(() => {
   if (skipInitialFetch.current) {
     skipInitialFetch.current = false
     return
   }
   loadSuppliers(debouncedSearch, page)
 }, [debouncedSearch, page, loadSuppliers])

 const openCreate = () => { setEditingSupplier(null); setForm({ name: '', phone: '', email: '', address: '', notes: '' }); setShowForm(true) }
 const openEdit = (s: Supplier) => { setEditingSupplier(s); setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' }); setShowForm(true) }

 const openView = async (s: Supplier) => {
 setViewingSupplier(s)
 setSupplierHistory(null)
 try {
 const { getSupplierPurchaseHistory } = await import('@/app/actions/purchases')
 const res = await getSupplierPurchaseHistory(s.id)
 if (res.success) setSupplierHistory(res.stats)
 } catch { /* ignore */ }
 }

 const handleSave = async () => {
 setSaving(true); setNotification(null)
 try {
 const payload = { ...form, phone: form.phone || null, email: form.email || null, address: form.address || null, notes: form.notes || null }
 if (editingSupplier) {
 const { updateSupplier } = await import('@/app/actions/suppliers')
 const res = await updateSupplier(editingSupplier.id, payload)
 if (res.success) { setNotification({ type: 'success', message: 'تم تحديث المورد' }); setShowForm(false); loadSuppliers(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error })
 } else {
 const { createSupplier } = await import('@/app/actions/suppliers')
 const res = await createSupplier(payload)
 if (res.success) { setNotification({ type: 'success', message: 'تم إنشاء المورد' }); setShowForm(false); loadSuppliers(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error })
 }
 } finally { setSaving(false) }
 }

 const handleToggleActive = async (id: string) => {
 const { toggleSupplierActive } = await import('@/app/actions/suppliers')
 const res = await toggleSupplierActive(id)
 if (res.success) { setNotification({ type: 'success', message: 'تم تحديث الحالة' }); loadSuppliers(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ' })
 }

 const handleDeleteSupplier = async (id: string) => {
 if (!window.confirm('هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.')) return
 setActionLoading(id); setNotification(null)
 try {
 const { deleteSupplier } = await import('@/app/actions/suppliers')
 const res = await deleteSupplier(id)
 if (res.success) { setNotification({ type: 'success', message: 'تم حذف المورد' }); loadSuppliers(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ' })
 } finally { setActionLoading(null) }
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] mb-1">الموردين</h1>
 <p className="text-[#62666D] text-sm">إدارة الموردين</p>
 </div>
 {canCreate && (
 <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 <FaPlus className="text-xs" /> إضافة مورد
 </button>
 )}
 </div>

 {notification && (
 <div className={`mb-4 p-3 rounded-xl text-sm font-bold ${notification.type === 'success' ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]' : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'}`}>
 {notification.type === 'success' ? <FaCheckCircle className="inline ml-2" /> : <FaExclamationTriangle className="inline ml-2" />}
 {notification.message}
 <button onClick={() => setNotification(null)} className="float-left"><FaTimes /></button>
 </div>
 )}

 <div className="mb-4 relative">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input type="text" placeholder="بحث بالاسم أو الجوال أو البريد..." value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full pr-10 pl-4 py-3 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-[16px] placeholder:text-[16px] placeholder:text-[#62666D] focus:outline-none focus:border-[#DC2626]" />
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-8 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : suppliers.length === 0 ? (
 <div className="p-8 text-center"><FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" /><p className="text-[#62666D] text-sm">لا يوجد موردين</p></div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">المورد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الجوال</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">البريد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الإجراءات</th>
 </tr>
 </thead>
 <tbody>
 {suppliers.map(s => (
 <tr key={s.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{s.name}</td>
 <td className="px-4 py-3 text-[#111214]">{s.phone || '—'}</td>
 <td className="px-4 py-3 text-[#111214]">{s.email || '—'}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded-lg text-xs font-bold ${s.is_active ? 'text-[#059669] bg-[#ECFDF5]' : 'text-[#62666D] bg-[#F1F2F3]'}`}>
 {s.is_active ? 'نشط' : 'غير نشط'}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1">
 <button onClick={() => openView(s)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]" title="عرض"><FaEye className="text-xs" /></button>
 {canUpdate && <>
 <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]" title="تعديل"><FaPen className="text-xs" /></button>
  <button onClick={() => handleToggleActive(s.id)} className={`p-1.5 rounded-lg hover:bg-[#F1F2F3] ${s.is_active ? 'text-[#059669]' : 'text-[#62666D]'}`} title={s.is_active ? 'تعطيل' : 'تفعيل'}>
  {s.is_active ? <FaToggleOn className="text-xs" /> : <FaToggleOff className="text-xs" />}
  </button>
  </>}
  {canDelete && <button onClick={() => handleDeleteSupplier(s.id)} disabled={actionLoading === s.id} className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] hover:text-[#9B1B30] disabled:opacity-30" title="حذف">
  {actionLoading === s.id ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />}
  </button>}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {pagination && pagination.totalPages > 1 && (
 <div className="flex items-center justify-between mt-4">
 <p className="text-[#62666D] text-xs">الصفحة {pagination.page} من {pagination.totalPages} ({pagination.total} نتيجة)</p>
 <div className="flex gap-2">
 <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
 className="p-2 rounded-lg bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] disabled:opacity-30"><FaChevronRight className="text-xs" /></button>
 <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
 className="p-2 rounded-lg bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] disabled:opacity-30"><FaChevronLeft className="text-xs" /></button>
 </div>
 </div>
 )}

 {showForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214]">{editingSupplier ? 'تعديل مورد' : 'إضافة مورد'}</h2>
 <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 <div className="space-y-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">اسم المورد *</label>
 <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الجوال</label>
 <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">البريد</label>
 <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">العنوان</label>
 <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">ملاحظات</label>
 <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626] resize-none" />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={handleSave} disabled={saving || !form.name}
 className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 {saving ? <FaSpinner className="animate-spin inline" /> : editingSupplier ? 'تحديث' : 'إضافة'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] rounded-xl text-sm font-bold transition-colors">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}

 {viewingSupplier && (
 <div
 role="presentation"
 className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
 onClick={() => { setViewingSupplier(null); setSupplierHistory(null) }}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-label="تفاصيل المورد"
 className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E7E8EA] bg-white/95 backdrop-blur">
 <div className="flex items-center gap-3 min-w-0">
 <span className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <FaTruck className="text-[#DC2626] text-sm" />
 </span>
 <div className="min-w-0">
 <h3 className="text-base font-bold text-[#111214] leading-tight">تفاصيل المورد</h3>
 <p className="text-[10px] text-[#9A9DA3] font-medium mt-0.5">بيانات المورد وسجل المشتريات</p>
 </div>
 </div>
 <button
 onClick={() => { setViewingSupplier(null); setSupplierHistory(null) }}
 aria-label="إغلاق"
 className="w-8 h-8 rounded-lg text-[#62666D] hover:text-[#111214] hover:bg-[#F1F2F3] flex items-center justify-center transition shrink-0"
 >
 <FaTimes className="text-sm" />
 </button>
 </div>

 <div className="px-5 sm:px-6 py-5 space-y-6">
 {/* Profile */}
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <span className="text-lg font-black text-[#DC2626]">
 {viewingSupplier.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}
 </span>
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-x-2.5 gap-y-2 flex-wrap">
 <h4 className="text-lg font-black text-[#111214] truncate">{viewingSupplier.name}</h4>
 <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
 viewingSupplier.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${viewingSupplier.is_active ? 'bg-[#059669]' : 'bg-[#9A9DA3]'}`} />
 {viewingSupplier.is_active ? 'نشط' : 'غير نشط'}
 </span>
 </div>
 <p className="text-[11px] text-[#62666D] font-medium mt-1">
 مورد منذ {new Date(viewingSupplier.created_at).toLocaleDateString('en-GB')}
 </p>
 </div>
 </div>

 {/* Contact */}
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">بيانات التواصل</h5>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaPhone className="text-[#059669] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">رقم الجوال</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingSupplier.phone || '—'}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaEnvelope className="text-[#2563EB] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">البريد الإلكتروني</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingSupplier.email || '—'}</p>
 </div>
 </div>

 <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaMapMarkerAlt className="text-[#DC2626] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">العنوان</p>
 <p className="text-xs font-bold text-[#111214] mt-0.5 break-words">{viewingSupplier.address || '—'}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Purchase summary */}
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#059669]" />
 <h5 className="text-xs font-bold text-[#111214]">ملخص المشتريات</h5>
 </div>
 {supplierHistory ? (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <div className="flex items-center gap-2">
 <FaShoppingCart className="text-[#7C3AED] text-[10px]" />
 <p className="text-[10px] font-bold text-[#9A9DA3]">عدد المشتريات</p>
 </div>
 <p className="text-base font-black text-[#111214] mt-1.5">{supplierHistory.total_purchases}</p>
 </div>
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <p className="text-[10px] font-bold text-[#9A9DA3]">إجمالي التكلفة</p>
 <p className="text-base font-black text-[#DC2626] mt-1.5">{supplierHistory.total_spend.toFixed(2)} <span className="text-[9px] font-bold text-[#9A9DA3]">ر.س</span></p>
 </div>
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <div className="flex items-center gap-2">
 <FaCalendarAlt className="text-[#7C3AED] text-[10px]" />
 <p className="text-[10px] font-bold text-[#9A9DA3]">آخر شراء</p>
 </div>
 <p className="text-xs font-black text-[#111214] mt-2">
 {supplierHistory.last_purchase ? new Date(supplierHistory.last_purchase).toLocaleDateString('en-GB') : '—'}
 </p>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
 {[0, 1, 2].map((i) => (
 <div key={i} className="h-[76px] rounded-xl bg-[#F7F7F5] border border-[#E7E8EA] animate-pulse" />
 ))}
 </div>
 )}
 </div>

 {/* Notes */}
 {viewingSupplier.notes && (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">ملاحظات</h5>
 </div>
 <p className="text-xs leading-relaxed text-[#4B4F55] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-3 whitespace-pre-wrap break-words">
 {viewingSupplier.notes}
 </p>
 </div>
 )}

 {/* Footer */}
 <div className="border-t border-[#E7E8EA] pt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[10px] font-medium text-[#9A9DA3]">
 <span className="flex items-center gap-1.5">
 <FaCalendarAlt className="text-[9px]" />
 تاريخ الإضافة: <span className="font-bold text-[#62666D]">{new Date(viewingSupplier.created_at).toLocaleDateString('en-GB')}</span>
 </span>
 <span>
 الحالة: <span className={`font-bold ${viewingSupplier.is_active ? 'text-[#059669]' : 'text-[#62666D]'}`}>{viewingSupplier.is_active ? 'نشط' : 'غير نشط'}</span>
 </span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
