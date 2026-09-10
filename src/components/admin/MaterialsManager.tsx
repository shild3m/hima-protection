'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch, FaEye, FaPen, FaTrash, FaTimes, FaExclamationTriangle,
 FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle, FaPlus,
 FaToggleOn, FaToggleOff, FaCubes,
} from 'react-icons/fa'

const UNITS: Record<string, string> = {
 meter: 'متر', piece: 'قطعة', roll: 'لفة', box: 'علبة', liter: 'لتر', ml: 'مل', bottle: 'زجاجة',
}

interface Material {
 id: string; name: string; sku: string; unit: string; current_stock: number;
 min_stock: number; max_stock: number | null; cost_per_unit: number;
 is_active: boolean; notes: string | null; supplier: { id: string; name: string } | null;
 created_at: string;
}

interface Supplier { id: string; name: string; is_active: boolean }

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }

type Notification = { type: 'success' | 'error'; message: string } | null

function stockStatus(m: Material): { label: string; color: string } {
 if (m.current_stock === 0) return { label: 'نفد', color: 'text-[#DC2626] bg-[#FEF2F2]' }
 if (m.current_stock <= m.min_stock) return { label: 'منخفض', color: 'text-[#D97706] bg-[#FFFBEB]' }
 return { label: 'متوفر', color: 'text-[#059669] bg-[#ECFDF5]' }
}

export default function MaterialsManager() {
 const { hasPermission } = useAuth()
 const [materials, setMaterials] = useState<Material[]>([])
 const [suppliers, setSuppliers] = useState<Supplier[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
 const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null)
 const [saving, setSaving] = useState(false)
 const [actionLoading, setActionLoading] = useState<string | null>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const canCreate = hasPermission('materials', 'create')
 const canUpdate = hasPermission('materials', 'update')
 const canDelete = hasPermission('materials', 'delete')

 const [form, setForm] = useState({
 name: '', sku: '', unit: 'piece', min_stock: 0, max_stock: '',
 cost_per_unit: 0, supplier_id: '', notes: '',
 })

 const loadMaterials = useCallback(async (s: string, p: number) => {
 setLoading(true)
 try {
 const { getMaterials } = await import('@/app/actions/materials')
 const res = await getMaterials(s || undefined, p)
 if (res.success) {
 setMaterials(res.data)
 setPagination(res.pagination)
 }
 } finally { setLoading(false) }
 }, [])

 const loadSuppliers = useCallback(async () => {
 try {
 const { getSuppliers } = await import('@/app/actions/suppliers')
 const res = await getSuppliers(undefined, 1, 200)
 if (res.success) setSuppliers(res.data.filter((s: Supplier) => s.is_active))
 } catch { /* ignore */ }
 }, [])

 useEffect(() => { loadMaterials('', 1); loadSuppliers() }, [loadMaterials, loadSuppliers])

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
 return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
 }, [search])

 useEffect(() => { loadMaterials(debouncedSearch, page) }, [debouncedSearch, page, loadMaterials])

 const openCreate = () => {
 setEditingMaterial(null)
 setForm({ name: '', sku: '', unit: 'piece', min_stock: 0, max_stock: '', cost_per_unit: 0, supplier_id: '', notes: '' })
 setShowForm(true)
 }

 const openEdit = (m: Material) => {
 setEditingMaterial(m)
 setForm({
 name: m.name, sku: m.sku, unit: m.unit, min_stock: m.min_stock,
 max_stock: m.max_stock?.toString() || '', cost_per_unit: m.cost_per_unit,
 supplier_id: m.supplier?.id || '', notes: m.notes || '',
 })
 setShowForm(true)
 }

 const handleSave = async () => {
 setSaving(true); setNotification(null)
 try {
 const payload = {
 ...form,
 unit: form.unit as 'meter' | 'liter' | 'ml' | 'piece' | 'roll' | 'box' | 'bottle',
 min_stock: Number(form.min_stock),
 max_stock: form.max_stock ? Number(form.max_stock) : null,
 cost_per_unit: Number(form.cost_per_unit),
 supplier_id: form.supplier_id || null,
 }
 if (editingMaterial) {
 const { updateMaterial } = await import('@/app/actions/materials')
 const res = await updateMaterial(editingMaterial.id, payload)
 if (res.success) { setNotification({ type: 'success', message: 'تم تحديث المادة' }); setShowForm(false); loadMaterials(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 } else {
 const { createMaterial } = await import('@/app/actions/materials')
 const res = await createMaterial(payload)
 if (res.success) { setNotification({ type: 'success', message: 'تم إنشاء المادة' }); setShowForm(false); loadMaterials(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 }
 } finally { setSaving(false) }
 }

 const handleToggleActive = async (id: string) => {
 const { toggleMaterialActive } = await import('@/app/actions/materials')
 const res = await toggleMaterialActive(id)
 if (res.success) { setNotification({ type: 'success', message: 'تم تحديث الحالة' }); loadMaterials(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 }

 const handleDeleteMaterial = async (id: string) => {
 if (!window.confirm('هل أنت متأكد من حذف هذا المادة؟ لا يمكن التراجع عن هذا الإجراء.')) return
 setActionLoading(id); setNotification(null)
 try {
 const { deleteMaterial } = await import('@/app/actions/materials')
 const res = await deleteMaterial(id)
 if (res.success) { setNotification({ type: 'success', message: 'تم حذف المادة' }); loadMaterials(debouncedSearch, page) }
 else setNotification({ type: 'error', message: res.error || 'حدث خطأ غير متوقع' })
 } finally { setActionLoading(null) }
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] mb-1">المواد</h1>
 <p className="text-[#62666D] text-sm">إدارة المواد والمخزون</p>
 </div>
 {canCreate && (
 <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 <FaPlus className="text-xs" /> إضافة مادة
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
 <input type="text" placeholder="بحث بالاسم أو الرمز..." value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full pr-10 pl-4 py-2.5 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm placeholder:text-[#62666D] focus:outline-none focus:border-[#DC2626]" />
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-8 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : materials.length === 0 ? (
 <div className="p-8 text-center"><FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" /><p className="text-[#62666D] text-sm">لا توجد مواد</p></div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">المادة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الرمز</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الوحدة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">المخزون</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الحد الأدنى</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">التكلفة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الإجراءات</th>
 </tr>
 </thead>
 <tbody>
 {materials.map(m => {
 const status = stockStatus(m)
 return (
 <tr key={m.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{m.name}</td>
 <td className="px-4 py-3 text-[#111214] font-mono text-xs">{m.sku}</td>
 <td className="px-4 py-3 text-[#111214]">{UNITS[m.unit] || m.unit}</td>
 <td className="px-4 py-3 text-[#111214] font-bold">{m.current_stock}</td>
 <td className="px-4 py-3 text-[#111214]">{m.min_stock}</td>
 <td className="px-4 py-3 text-[#111214]">{m.cost_per_unit.toFixed(2)}</td>
 <td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${status.color}`}>{status.label}</span></td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1">
 <button onClick={() => setViewingMaterial(m)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]" title="عرض"><FaEye className="text-xs" /></button>
 {canUpdate && <>
 <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]" title="تعديل"><FaPen className="text-xs" /></button>
 </>}
 {canDelete && (
 <button onClick={() => handleDeleteMaterial(m.id)} disabled={actionLoading === m.id}
 className="px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-1" title="حذف">
 {actionLoading === m.id ? <FaSpinner className="animate-spin text-xs" /> : <FaTrash className="text-xs" />} حذف
 </button>
 )}
 {canUpdate && <>
 <button onClick={() => handleToggleActive(m.id)} className={`p-1.5 rounded-lg hover:bg-[#F1F2F3] ${m.is_active ? 'text-[#059669]' : 'text-[#62666D]'}`} title={m.is_active ? 'تعطيل' : 'تفعيل'}>
 {m.is_active ? <FaToggleOn className="text-xs" /> : <FaToggleOff className="text-xs" />}
 </button>
 </>}
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
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214]">{editingMaterial ? 'تعديل مادة' : 'إضافة مادة'}</h2>
 <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 <div className="space-y-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">اسم المادة *</label>
 <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الرمز *</label>
 <input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الوحدة *</label>
 <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 {Object.entries(UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
 </select>
 </div>
 </div>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الحد الأدنى</label>
 <input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })} min={0}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الحد الأقصى</label>
 <input type="number" value={form.max_stock} onChange={e => setForm({ ...form, max_stock: e.target.value })} min={0}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">التكلفة</label>
 <input type="number" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: Number(e.target.value) })} min={0} step={0.01}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">المورد</label>
 <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="">بدون مورد</option>
 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">ملاحظات</label>
 <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626] resize-none" />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={handleSave} disabled={saving || !form.name || !form.sku}
 className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 {saving ? <FaSpinner className="animate-spin inline" /> : editingMaterial ? 'تحديث' : 'إضافة'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] rounded-xl text-sm font-bold transition-colors">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}

 {viewingMaterial && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={() => setViewingMaterial(null)} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214] flex items-center gap-2"><FaCubes className="text-[#DC2626]" /> تفاصيل المادة</h2>
 <button onClick={() => setViewingMaterial(null)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between"><span className="text-[#62666D]">الاسم</span><span className="text-[#111214] font-bold">{viewingMaterial.name}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">الرمز</span><span className="text-[#111214] font-mono">{viewingMaterial.sku}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">الوحدة</span><span className="text-[#111214]">{UNITS[viewingMaterial.unit] || viewingMaterial.unit}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">المخزون الحالي</span><span className="text-[#111214] font-bold">{viewingMaterial.current_stock}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">الحد الأدنى</span><span className="text-[#111214]">{viewingMaterial.min_stock}</span></div>
 {viewingMaterial.max_stock && <div className="flex justify-between"><span className="text-[#62666D]">الحد الأقصى</span><span className="text-[#111214]">{viewingMaterial.max_stock}</span></div>}
 <div className="flex justify-between"><span className="text-[#62666D]">التكلفة</span><span className="text-[#111214]">{viewingMaterial.cost_per_unit.toFixed(2)}</span></div>
 <div className="flex justify-between"><span className="text-[#62666D]">المورد</span><span className="text-[#111214]">{viewingMaterial.supplier?.name || '—'}</span></div>
 <div className="flex justify-between">
 <span className="text-[#62666D]">الحالة</span>
 <span className={`px-2 py-1 rounded-lg text-xs font-bold ${stockStatus(viewingMaterial).color}`}>{stockStatus(viewingMaterial).label}</span>
 </div>
 {viewingMaterial.notes && <div><span className="text-[#62666D]">ملاحظات</span><p className="text-[#111214] mt-1">{viewingMaterial.notes}</p></div>}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
