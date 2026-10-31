'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch, FaEye, FaPen, FaTrash, FaTimes, FaExclamationTriangle,
 FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle, FaPlus,
 FaToggleOn, FaToggleOff, FaCubes, FaBarcode, FaWarehouse, FaTruck, FaMoneyBillWave, FaCalendarAlt,
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

export default function MaterialsManager({ initialMaterials, initialPagination, initialSuppliers }: {
 initialMaterials?: Material[]
 initialPagination?: Pagination
 initialSuppliers?: Supplier[]
} = {}) {
 const { hasPermission } = useAuth()
 const skipInitialMaterialsFetch = useRef(initialMaterials !== undefined)
 const skipInitialSuppliersFetch = useRef(initialSuppliers !== undefined)
 const [materials, setMaterials] = useState<Material[]>(initialMaterials ?? [])
 const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers ?? [])
 const [loading, setLoading] = useState(initialMaterials === undefined)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(initialPagination ?? null)
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
 const { getSupplierOptions } = await import('@/app/actions/suppliers')
 const res = await getSupplierOptions()
 if (res.success) setSuppliers(res.data)
 } catch { /* ignore */ }
 }, [])

 useEffect(() => {
   if (skipInitialSuppliersFetch.current) {
     skipInitialSuppliersFetch.current = false
     return
   }
   loadSuppliers()
 }, [loadSuppliers])

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
 return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
 }, [search])

 useEffect(() => {
   if (skipInitialMaterialsFetch.current) {
     skipInitialMaterialsFetch.current = false
     return
   }
   loadMaterials(debouncedSearch, page)
 }, [debouncedSearch, page, loadMaterials])

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
 className="w-full pr-10 pl-4 py-3 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-[16px] placeholder:text-[16px] placeholder:text-[#62666D] focus:outline-none focus:border-[#DC2626]" />
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
 <div
 role="presentation"
 className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
 onClick={() => setViewingMaterial(null)}
 >
 <div
 role="dialog"
 aria-modal="true"
 aria-label="تفاصيل المادة"
 className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
 onClick={e => e.stopPropagation()}
 >
 {/* Header */}
 <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E7E8EA] bg-white/95 backdrop-blur">
 <div className="flex items-center gap-3 min-w-0">
 <span className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center shrink-0">
 <FaCubes className="text-[#DC2626] text-sm" />
 </span>
 <div className="min-w-0">
 <h3 className="text-base font-bold text-[#111214] leading-tight">تفاصيل المادة</h3>
 <p className="text-[10px] text-[#9A9DA3] font-medium mt-0.5">بيانات المادة وحالة المخزون</p>
 </div>
 </div>
 <button
 onClick={() => setViewingMaterial(null)}
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
 <FaCubes className="text-[#DC2626] text-xl" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-x-2.5 gap-y-2 flex-wrap">
 <h4 className="text-lg font-black text-[#111214] truncate">{viewingMaterial.name}</h4>
 <span className={`inline-flex items-center gap-1.5 rounded-full border border-current/20 px-2.5 py-1 text-[10px] font-bold ${stockStatus(viewingMaterial).color}`}>
 <span className="w-1.5 h-1.5 rounded-full bg-current" />
 {stockStatus(viewingMaterial).label}
 </span>
 </div>
 <p className="text-[11px] text-[#62666D] font-medium mt-1">
 رمز المادة: <span className="font-bold text-[#4B4F55]" dir="ltr">{viewingMaterial.sku}</span>
 </p>
 </div>
 </div>

 {/* Stock overview */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <div className="flex items-center gap-2">
 <FaWarehouse className="text-[#7C3AED] text-[10px]" />
 <p className="text-[10px] font-bold text-[#9A9DA3]">المخزون الحالي</p>
 </div>
 <p className="text-base font-black text-[#111214] mt-1.5">{viewingMaterial.current_stock} <span className="text-[9px] font-bold text-[#9A9DA3]">{UNITS[viewingMaterial.unit] || viewingMaterial.unit}</span></p>
 </div>
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <p className="text-[10px] font-bold text-[#9A9DA3]">الحد الأدنى</p>
 <p className="text-base font-black text-[#111214] mt-1.5">{viewingMaterial.min_stock} <span className="text-[9px] font-bold text-[#9A9DA3]">{UNITS[viewingMaterial.unit] || viewingMaterial.unit}</span></p>
 </div>
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <p className="text-[10px] font-bold text-[#9A9DA3]">الحد الأقصى</p>
 <p className="text-base font-black text-[#111214] mt-1.5">{viewingMaterial.max_stock ?? '—'} {viewingMaterial.max_stock ? <span className="text-[9px] font-bold text-[#9A9DA3]">{UNITS[viewingMaterial.unit] || viewingMaterial.unit}</span> : null}</p>
 </div>
 <div className="rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <p className="text-[10px] font-bold text-[#9A9DA3]">تكلفة الوحدة</p>
 <p className="text-base font-black text-[#DC2626] mt-1.5">{viewingMaterial.cost_per_unit.toFixed(2)} <span className="text-[9px] font-bold text-[#9A9DA3]">ر.س</span></p>
 </div>
 </div>

 {/* Details */}
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">بيانات المادة</h5>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaBarcode className="text-[#2563EB] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">الرمز</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5" dir="ltr">{viewingMaterial.sku}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaBoxOpen className="text-[#7C3AED] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">وحدة القياس</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5">{UNITS[viewingMaterial.unit] || viewingMaterial.unit}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaTruck className="text-[#059669] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">المورد</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5">{viewingMaterial.supplier?.name || '—'}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 rounded-xl border border-[#E7E8EA] bg-[#FBFBFA] px-3.5 py-3">
 <span className="w-8 h-8 rounded-lg bg-white border border-[#E7E8EA] flex items-center justify-center shrink-0">
 <FaMoneyBillWave className="text-[#D97706] text-[11px]" />
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#9A9DA3]">تكلفة الوحدة</p>
 <p className="text-xs font-bold text-[#111214] truncate mt-0.5">{viewingMaterial.cost_per_unit.toFixed(2)} ر.س</p>
 </div>
 </div>
 </div>
 </div>

 {/* Notes */}
 {viewingMaterial.notes && (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-1 h-3.5 rounded-full bg-[#DC2626]" />
 <h5 className="text-xs font-bold text-[#111214]">ملاحظات</h5>
 </div>
 <p className="text-xs leading-relaxed text-[#4B4F55] bg-[#FBFBFA] border border-[#E7E8EA] rounded-xl px-3.5 py-3 whitespace-pre-wrap break-words">
 {viewingMaterial.notes}
 </p>
 </div>
 )}

 {/* Footer */}
 <div className="border-t border-[#E7E8EA] pt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[10px] font-medium text-[#9A9DA3]">
 <span className="flex items-center gap-1.5">
 <FaCalendarAlt className="text-[9px]" />
 تاريخ الإضافة: <span className="font-bold text-[#62666D]">{new Date(viewingMaterial.created_at).toLocaleDateString('en-GB')}</span>
 </span>
 <span>
 حالة المخزون: <span className={`font-bold ${stockStatus(viewingMaterial).color.split(' ')[0]}`}>{stockStatus(viewingMaterial).label}</span>
 </span>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
