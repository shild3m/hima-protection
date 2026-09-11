'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch, FaEye, FaTimes, FaExclamationTriangle,
 FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle, FaPlus,
 FaTruck, FaCheck, FaBan,
} from 'react-icons/fa'

interface Supplier { id: string; name: string; is_active: boolean }
interface Material { id: string; name: string; sku: string; unit: string; current_stock: number; is_active: boolean }
interface PurchaseItem { id: string; material_id: string; quantity: number; unit_cost: number; total_cost: number; material: Material }
interface Purchase {
 id: string; supplier_id: string; status: string; total_amount: number;
 purchase_date: string; notes: string | null; created_at: string;
 supplier: { id: string; name: string } | null; items?: PurchaseItem[];
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
type Notification = { type: 'success' | 'error'; message: string } | null

const STATUS_MAP: Record<string, { label: string; color: string }> = {
 draft: { label: 'مسودة', color: 'text-[#D97706] bg-[#FFFBEB]' },
 received: { label: 'مستلم', color: 'text-[#059669] bg-[#ECFDF5]' },
 cancelled: { label: 'ملغي', color: 'text-[#DC2626] bg-[#FEF2F2]' },
}

export default function PurchasesManager() {
 const { hasPermission } = useAuth()
 const [purchases, setPurchases] = useState<Purchase[]>([])
 const [suppliers, setSuppliers] = useState<Supplier[]>([])
 const [materials, setMaterials] = useState<Material[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState('all')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null)
 const [viewLoading, setViewLoading] = useState(false)
 const [saving, setSaving] = useState(false)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canCreate = hasPermission('purchases', 'create')
  const canReceive = hasPermission('purchases', 'receive')
  const canUpdate = hasPermission('purchases', 'update')

  useEffect(() => {
    if (canCreate && window.location.search.includes('create=true')) {
      setForm({ supplier_id: '', purchase_date: new Date().toISOString().split('T')[0], notes: '', items: [{ material_id: '', quantity: 1, unit_cost: 0 }] })
      setShowForm(true)
    }
  }, [canCreate])

 const [form, setForm] = useState({
 supplier_id: '', purchase_date: new Date().toISOString().split('T')[0], notes: '',
 items: [{ material_id: '', quantity: 1, unit_cost: 0 }] as { material_id: string; quantity: number; unit_cost: number }[],
 })

 const loadPurchases = useCallback(async (s: string, st: string, p: number) => {
 setLoading(true)
 try {
 const { getPurchases } = await import('@/app/actions/purchases')
 const res = await getPurchases(s || undefined, st === 'all' ? undefined : st, p)
 if (res.success) { setPurchases(res.data); setPagination(res.pagination) }
 } finally { setLoading(false) }
 }, [])

 const loadFormData = useCallback(async () => {
 try {
 const { getSuppliers } = await import('@/app/actions/suppliers')
 const sRes = await getSuppliers(undefined, 1, 200)
 if (sRes.success) setSuppliers(sRes.data.filter((s: Supplier) => s.is_active))

 const { getMaterials } = await import('@/app/actions/materials')
 const mRes = await getMaterials(undefined, 1, 200)
 if (mRes.success) setMaterials(mRes.data.filter((m: Material) => m.is_active))
 } catch { /* ignore */ }
 }, [])

 useEffect(() => { loadPurchases('', 'all', 1); loadFormData() }, [loadPurchases, loadFormData])

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
 return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
 }, [search])

 useEffect(() => { loadPurchases(debouncedSearch, statusFilter, page) }, [debouncedSearch, statusFilter, page, loadPurchases])

 const openCreate = () => {
 setForm({ supplier_id: '', purchase_date: new Date().toISOString().split('T')[0], notes: '', items: [{ material_id: '', quantity: 1, unit_cost: 0 }] })
 setShowForm(true)
 }

 const addItem = () => setForm({ ...form, items: [...form.items, { material_id: '', quantity: 1, unit_cost: 0 }] })
 const removeItem = (idx: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
 const updateItem = (idx: number, field: string, value: string | number) => {
 const items = [...form.items]
 ;(items[idx] as Record<string, unknown>)[field] = value
 setForm({ ...form, items })
 }

 const handleCreate = async () => {
 setSaving(true); setNotification(null)
 try {
 const validItems = form.items.filter(i => i.material_id && i.quantity > 0 && i.unit_cost >= 0)
 if (!form.supplier_id) { setNotification({ type: 'error', message: 'اختر المورد' }); setSaving(false); return }
 if (validItems.length === 0) { setNotification({ type: 'error', message: 'أضف عنصر واحد على الأقل' }); setSaving(false); return }

 const { createPurchase } = await import('@/app/actions/purchases')
 const res = await createPurchase({
 supplier_id: form.supplier_id,
 purchase_date: form.purchase_date,
 notes: form.notes || null,
 items: validItems.map(i => ({ material_id: i.material_id, quantity: i.quantity, unit_cost: i.unit_cost })),
 })
 if (res.success) { setNotification({ type: 'success', message: 'تم إنشاء الشراء' }); setShowForm(false); loadPurchases(debouncedSearch, statusFilter, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 } finally { setSaving(false) }
 }

 const handleReceive = async (id: string) => {
 if (!confirm('هل أنت متأكد من استلام هذا الشراء؟ سيتم زيادة المخزون.')) return
 setNotification(null)
 try {
 const { receivePurchase } = await import('@/app/actions/purchases')
 const res = await receivePurchase(id)
 if (res.success) { setNotification({ type: 'success', message: 'تم استلام الشراء بنجاح' }); loadPurchases(debouncedSearch, statusFilter, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 } catch { setNotification({ type: 'error', message: 'حدث خطأ' }) }
 }

 const handleCancel = async (id: string) => {
 if (!confirm('هل أنت متأكد من إلغاء هذا الشراء؟')) return
 setNotification(null)
 try {
 const { cancelPurchase } = await import('@/app/actions/purchases')
 const res = await cancelPurchase(id)
 if (res.success) { setNotification({ type: 'success', message: 'تم إلغاء الشراء' }); loadPurchases(debouncedSearch, statusFilter, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 } catch { setNotification({ type: 'error', message: 'حدث خطأ' }) }
 }

 const calcTotal = form.items.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0)

 const openView = async (p: Purchase) => {
 setViewLoading(true)
 try {
 const { getPurchase } = await import('@/app/actions/purchases')
 const res = await getPurchase(p.id)
 if (res.success) setViewingPurchase(res.data)
 else setViewingPurchase(p)
 } catch { setViewingPurchase(p) }
 finally { setViewLoading(false) }
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] mb-1">المشتريات</h1>
 <p className="text-[#62666D] text-sm">إدارة مشتريات المواد</p>
 </div>
 {canCreate && (
 <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 <FaPlus className="text-xs" /> شراء جديد
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

 <div className="flex flex-col sm:flex-row gap-3 mb-4">
 <div className="relative flex-1">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)}
 className="w-full pr-10 pl-4 py-3 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-[16px] placeholder:text-[16px] placeholder:text-[#62666D] focus:outline-none focus:border-[#DC2626]" />
 </div>
 <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
 className="px-3 py-2.5 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="all">الكل</option>
 <option value="draft">مسودة</option>
 <option value="received">مستلم</option>
 <option value="cancelled">ملغي</option>
 </select>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-8 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : purchases.length === 0 ? (
 <div className="p-8 text-center"><FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" /><p className="text-[#62666D] text-sm">لا توجد مشتريات</p></div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">المورد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">التاريخ</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الإجمالي</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الإجراءات</th>
 </tr>
 </thead>
 <tbody>
 {purchases.map(p => {
 const st = STATUS_MAP[p.status] || { label: p.status, color: 'text-[#62666D] bg-[#F1F2F3]' }
 return (
 <tr key={p.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{p.supplier?.name || '—'}</td>
 <td className="px-4 py-3 text-[#111214]">{new Date(p.purchase_date).toLocaleDateString('en-GB')}</td>
 <td className="px-4 py-3 text-[#111214] font-bold">{p.total_amount.toFixed(2)}</td>
 <td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${st.color}`}>{st.label}</span></td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1">
 <button onClick={() => openView(p)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]" title="عرض"><FaEye className="text-xs" /></button>
 {canReceive && p.status === 'draft' && (
 <button onClick={() => handleReceive(p.id)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#059669] hover:text-[#059669]" title="استلام"><FaCheck className="text-xs" /></button>
 )}
 {canUpdate && p.status === 'draft' && (
 <button onClick={() => handleCancel(p.id)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#DC2626] hover:text-[#DC2626]" title="إلغاء"><FaBan className="text-xs" /></button>
 )}
 </div>
 </td>
 </tr>
 )
 })}
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
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214]">شراء جديد</h2>
 <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">المورد *</label>
 <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="">اختر المورد</option>
 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">التاريخ *</label>
 <input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 </div>

 <div>
 <div className="flex items-center justify-between mb-2">
 <label className="text-[#62666D] text-xs font-bold">العناصر</label>
 <button onClick={addItem} className="text-[#DC2626] hover:text-[#DC2626] text-xs font-bold"><FaPlus className="inline ml-1" /> إضافة</button>
 </div>
 <div className="space-y-2">
 {form.items.map((item, idx) => (
 <div key={idx} className="grid grid-cols-12 gap-2 items-end">
 <div className="col-span-5">
 {idx === 0 && <label className="block text-[#62666D] text-[10px] mb-1">المادة</label>}
 <select value={item.material_id} onChange={e => updateItem(idx, 'material_id', e.target.value)}
 className="w-full px-2 py-1.5 bg-white border border-[#E7E8EA] shadow-sm rounded-lg text-[#111214] text-xs focus:outline-none focus:border-[#DC2626]">
 <option value="">اختر</option>
 {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
 </select>
 </div>
 <div className="col-span-2">
 {idx === 0 && <label className="block text-[#62666D] text-[10px] mb-1">الكمية</label>}
 <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} min={1}
 className="w-full px-2 py-1.5 bg-white border border-[#E7E8EA] shadow-sm rounded-lg text-[#111214] text-xs focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div className="col-span-3">
 {idx === 0 && <label className="block text-[#62666D] text-[10px] mb-1">التكلفة</label>}
 <input type="number" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', Number(e.target.value))} min={0} step={0.01}
 className="w-full px-2 py-1.5 bg-white border border-[#E7E8EA] shadow-sm rounded-lg text-[#111214] text-xs focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div className="col-span-2 flex items-end">
 {form.items.length > 1 && (
 <button onClick={() => removeItem(idx)} className="p-1.5 text-[#DC2626] hover:text-[#DC2626]"><FaTimes className="text-xs" /></button>
 )}
 </div>
 </div>
 ))}
 </div>
 <div className="text-left mt-2 text-[#111214] text-sm font-bold">الإجمالي: {calcTotal.toFixed(2)}</div>
 </div>

 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">ملاحظات</label>
 <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626] resize-none" />
 </div>

 <div className="flex gap-3 pt-2">
 <button onClick={handleCreate} disabled={saving || !form.supplier_id || form.items.length === 0}
 className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 {saving ? <FaSpinner className="animate-spin inline" /> : 'إنشاء الشراء'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] rounded-xl text-sm font-bold transition-colors">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}

 {viewingPurchase && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={() => setViewingPurchase(null)} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214] flex items-center gap-2"><FaTruck className="text-[#DC2626]" /> تفاصيل الشراء</h2>
 <button onClick={() => setViewingPurchase(null)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 {viewLoading ? (
 <div className="p-6 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : (
 <div className="space-y-3 text-sm">
 <div className="flex justify-between"><span className="text-[#62666D]">المورد</span><span className="text-[#111214] font-bold">{viewingPurchase.supplier?.name || '—'}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">التاريخ</span><span className="text-[#111214]">{new Date(viewingPurchase.purchase_date).toLocaleDateString('en-GB')}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">الإجمالي</span><span className="text-[#111214] font-bold">{viewingPurchase.total_amount.toFixed(2)}</span></div>
 <div className="flex justify-between">
 <span className="text-[#62666D]">الحالة</span>
 <span className={`px-2 py-1 rounded-lg text-xs font-bold ${(STATUS_MAP[viewingPurchase.status] || { color: 'text-[#62666D] bg-[#F1F2F3]' }).color}`}>
 {(STATUS_MAP[viewingPurchase.status] || { label: viewingPurchase.status }).label}
 </span>
 </div>
 {viewingPurchase.items && viewingPurchase.items.length > 0 && (
 <div className="mt-3">
 <span className="text-[#62666D] text-xs font-bold">العناصر:</span>
 <div className="mt-2 space-y-1">
 {viewingPurchase.items.map(item => (
 <div key={item.id} className="flex justify-between bg-[#F7F7F5] rounded-lg px-3 py-2">
 <span className="text-[#111214]">{item.material?.name || item.material_id}</span>
 <span className="text-[#111214]">{item.quantity} × {item.unit_cost.toFixed(2)} = {item.total_cost.toFixed(2)}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )
}
