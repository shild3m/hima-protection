'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch, FaEye, FaPen, FaTrash, FaTimes, FaExclamationTriangle,
  FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle, FaPlus,
  FaToggleOn, FaToggleOff, FaTruck,
} from 'react-icons/fa'

interface Supplier {
 id: string; name: string; phone: string | null; email: string | null;
 address: string | null; notes: string | null; is_active: boolean; created_at: string;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }

type Notification = { type: 'success' | 'error'; message: string } | null

export default function SuppliersManager() {
 const { hasPermission } = useAuth()
 const [suppliers, setSuppliers] = useState<Supplier[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
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

 useEffect(() => { loadSuppliers('', 1) }, [loadSuppliers])

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
 return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
 }, [search])

 useEffect(() => { loadSuppliers(debouncedSearch, page) }, [debouncedSearch, page, loadSuppliers])

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
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={() => setViewingSupplier(null)} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214] flex items-center gap-2"><FaTruck className="text-[#DC2626]" /> تفاصيل المورد</h2>
 <button onClick={() => setViewingSupplier(null)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between"><span className="text-[#62666D]">الاسم</span><span className="text-[#111214] font-bold">{viewingSupplier.name}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">الجوال</span><span className="text-[#111214]">{viewingSupplier.phone || '—'}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">البريد</span><span className="text-[#111214]">{viewingSupplier.email || '—'}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">العنوان</span><span className="text-[#111214]">{viewingSupplier.address || '—'}</span></div>
 <div className="flex justify-between">
 <span className="text-[#62666D]">الحالة</span>
 <span className={`px-2 py-1 rounded-lg text-xs font-bold ${viewingSupplier.is_active ? 'text-[#059669] bg-[#ECFDF5]' : 'text-[#62666D] bg-[#F1F2F3]'}`}>
 {viewingSupplier.is_active ? 'نشط' : 'غير نشط'}
 </span>
 </div>
 {viewingSupplier.notes && <div><span className="text-[#62666D]">ملاحظات</span><p className="text-[#111214] mt-1">{viewingSupplier.notes}</p></div>}
 {supplierHistory && (
 <div className="mt-3 pt-3 border-t border-[#E7E8EA]">
 <span className="text-[#62666D] text-xs font-bold">ملخص المشتريات:</span>
 <div className="mt-2 grid grid-cols-2 gap-3">
 <div className="bg-[#F7F7F5] rounded-lg px-3 py-2 text-center">
 <div className="text-[#111214] font-bold text-lg">{supplierHistory.total_purchases}</div>
 <div className="text-[#62666D] text-xs">مشتريات</div>
 </div>
 <div className="bg-[#F7F7F5] rounded-lg px-3 py-2 text-center">
 <div className="text-[#111214] font-bold text-lg">{supplierHistory.total_spend.toFixed(2)}</div>
 <div className="text-[#62666D] text-xs">إجمالي التكلفة</div>
 </div>
 </div>
 {supplierHistory.last_purchase && (
 <p className="text-[#62666D] text-xs mt-2">آخر شراء: {new Date(supplierHistory.last_purchase).toLocaleDateString('ar-SA')}</p>
 )}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
