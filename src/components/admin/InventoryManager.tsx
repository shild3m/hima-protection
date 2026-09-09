'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch, FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle,
 FaExclamationTriangle, FaTimes, FaArrowUp, FaArrowDown, FaExchangeAlt,
 FaTools, FaTrash, FaUndo, FaFlask,
} from 'react-icons/fa'

interface Material { id: string; name: string; sku: string; unit: string; current_stock: number; min_stock: number; is_active: boolean }
interface StockMovement {
 id: string; material_id: string; quantity: number; type: string; notes: string | null;
 created_at: string; created_by: string | null;
 material: { id: string; name: string; sku: string; unit: string; current_stock: number } | null;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
type Notification = { type: 'success' | 'error'; message: string } | null

const TYPE_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
 purchase: { label: 'شراء', color: 'text-[#059669] bg-[#ECFDF5]', icon: <FaArrowDown className="text-xs" /> },
 usage: { label: 'استهلاك', color: 'text-[#2563EB] bg-[#EFF6FF]', icon: <FaArrowUp className="text-xs" /> },
 waste: { label: 'هدر', color: 'text-[#DC2626] bg-[#FEF2F2]', icon: <FaTrash className="text-xs" /> },
 adjustment: { label: 'تعديل', color: 'text-[#D97706] bg-[#FFFBEB]', icon: <FaExchangeAlt className="text-xs" /> },
 return: { label: 'إرجاع', color: 'text-[#7C3AED] bg-[#FAF5FF]', icon: <FaUndo className="text-xs" /> },
}

type ActionType = 'adjust' | 'waste' | 'return' | 'usage'

export default function InventoryManager() {
 const { hasPermission } = useAuth()
 const [movements, setMovements] = useState<StockMovement[]>([])
 const [materials, setMaterials] = useState<Material[]>([])
 const [loading, setLoading] = useState(true)
 const [materialFilter, setMaterialFilter] = useState('')
 const [typeFilter, setTypeFilter] = useState('all')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showAction, setShowAction] = useState<ActionType | null>(null)
 const [actionForm, setActionForm] = useState({ material_id: '', quantity: 1, direction: 'in' as 'in' | 'out', notes: '' })
 const [saving, setSaving] = useState(false)

 const canAdjust = hasPermission('inventory', 'adjust')
 const canUsage = hasPermission('inventory', 'usage')

 const loadMovements = useCallback(async (mId: string, type: string, p: number) => {
 setLoading(true)
 try {
 const { getStockMovements } = await import('@/app/actions/inventory')
 const res = await getStockMovements(mId || undefined, type === 'all' ? undefined : type, p)
 if (res.success) { setMovements(res.data); setPagination(res.pagination) }
 } finally { setLoading(false) }
 }, [])

 const loadMaterials = useCallback(async () => {
 try {
 const { getMaterials } = await import('@/app/actions/materials')
 const res = await getMaterials(undefined, 1, 200)
 if (res.success) setMaterials(res.data.filter((m: Material) => m.is_active))
 } catch { /* ignore */ }
 }, [])

 useEffect(() => { loadMovements('', 'all', 1); loadMaterials() }, [loadMovements, loadMaterials])
 useEffect(() => { loadMovements(materialFilter, typeFilter, page) }, [materialFilter, typeFilter, page, loadMovements])

 const openAction = (type: ActionType) => {
 setActionForm({ material_id: '', quantity: 1, direction: type === 'adjust' ? 'in' : 'out', notes: '' })
 setShowAction(type)
 }

 const handleAction = async () => {
 setSaving(true); setNotification(null)
 try {
 if (!actionForm.material_id) { setNotification({ type: 'error', message: 'اختر المادة' }); setSaving(false); return }
 if (actionForm.quantity <= 0) { setNotification({ type: 'error', message: 'الكمية يجب أن تكون أكبر من صفر' }); setSaving(false); return }

 if (showAction === 'adjust') {
 const { adjustStock } = await import('@/app/actions/inventory')
 const res = await adjustStock({ material_id: actionForm.material_id, quantity: actionForm.quantity, direction: actionForm.direction, notes: actionForm.notes || null })
 if (res.success) {
 setNotification({ type: 'success', message: `تم ${actionForm.direction === 'in' ? 'إضافة' : 'خصم'} ${actionForm.quantity} من المخزون` })
 } else {
 setNotification({ type: 'error', message: res.error }); setSaving(false); return
 }
 } else if (showAction === 'waste') {
 if (!actionForm.notes) { setNotification({ type: 'error', message: 'سبب الهدر مطلوب' }); setSaving(false); return }
 const { recordWaste } = await import('@/app/actions/inventory')
 const res = await recordWaste({ material_id: actionForm.material_id, quantity: actionForm.quantity, notes: actionForm.notes })
 if (res.success) {
 setNotification({ type: 'success', message: `تم تسجيل هدر ${actionForm.quantity} من المخزون` })
 } else {
 setNotification({ type: 'error', message: res.error }); setSaving(false); return
 }
 } else if (showAction === 'return') {
 const { recordReturn } = await import('@/app/actions/inventory')
 const res = await recordReturn({ material_id: actionForm.material_id, quantity: actionForm.quantity, notes: actionForm.notes || null })
 if (res.success) {
 setNotification({ type: 'success', message: `تم تسجيل إرجاع ${actionForm.quantity} إلى المخزون` })
 } else {
 setNotification({ type: 'error', message: res.error }); setSaving(false); return
 }
 } else if (showAction === 'usage') {
 const { recordUsage } = await import('@/app/actions/inventory')
 const res = await recordUsage({ material_id: actionForm.material_id, quantity: actionForm.quantity, notes: actionForm.notes || null })
 if (res.success) {
 setNotification({ type: 'success', message: `تم تسجيل استهلاك ${actionForm.quantity} من المخزون` })
 } else {
 setNotification({ type: 'error', message: res.error }); setSaving(false); return
 }
 }

 setShowAction(null)
 setActionForm({ material_id: '', quantity: 1, direction: 'in', notes: '' })
 loadMovements(materialFilter, typeFilter, page)
 loadMaterials()
 } finally { setSaving(false) }
 }

 const ACTION_LABELS: Record<ActionType, { title: string; icon: React.ReactNode }> = {
 adjust: { title: 'تعديل المخزون', icon: <FaTools className="text-[#DC2626]" /> },
 waste: { title: 'تسجيل هدر', icon: <FaTrash className="text-[#DC2626]" /> },
 return: { title: 'تسجيل إرجاع', icon: <FaUndo className="text-[#7C3AED]" /> },
 usage: { title: 'تسجيل استهلاك', icon: <FaFlask className="text-[#2563EB]" /> },
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] mb-1">المخزون</h1>
 <p className="text-[#62666D] text-sm">حركات المخزون وتعديلات</p>
 </div>
 {(canAdjust || canUsage) && (
 <div className="flex gap-2 flex-wrap">
 {canAdjust && (
 <>
 <button onClick={() => openAction('adjust')} className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-xs font-bold transition-colors">
 <FaTools className="text-xs" /> تعديل
 </button>
 <button onClick={() => openAction('waste')} className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-[#111214] rounded-xl text-xs font-bold transition-colors">
 <FaTrash className="text-xs" /> هدر
 </button>
 <button onClick={() => openAction('return')} className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors">
 <FaUndo className="text-xs" /> إرجاع
 </button>
 </>
 )}
 {canUsage && (
 <button onClick={() => openAction('usage')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors">
 <FaFlask className="text-xs" /> استهلاك
 </button>
 )}
 </div>
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
 <select value={materialFilter} onChange={e => { setMaterialFilter(e.target.value); setPage(1) }}
 className="px-3 py-2.5 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="">كل المواد</option>
 {materials.map(m => <option key={m.id} value={m.id}>{m.name} (المخزون: {m.current_stock})</option>)}
 </select>
 <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
 className="px-3 py-2.5 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="all">كل الأنواع</option>
 {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
 </select>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-8 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : movements.length === 0 ? (
 <div className="p-8 text-center"><FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" /><p className="text-[#62666D] text-sm">لا توجد حركات</p></div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">المادة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">النوع</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">الكمية</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">المخزون بعد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">التاريخ</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold">ملاحظات</th>
 </tr>
 </thead>
 <tbody>
 {movements.map(m => {
 const typeInfo = TYPE_MAP[m.type] || { label: m.type, color: 'text-[#62666D] bg-[#F1F2F3]', icon: null }
 return (
 <tr key={m.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3">
 <div className="text-[#111214] font-bold">{m.material?.name || '—'}</div>
 <div className="text-[#62666D] text-xs">{m.material?.sku}</div>
 </td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${typeInfo.color}`}>
 {typeInfo.icon} {typeInfo.label}
 </span>
 </td>
 <td className="px-4 py-3">
 <span className={`font-bold ${m.quantity > 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
 {m.quantity > 0 ? '+' : ''}{m.quantity}
 </span>
 </td>
 <td className="px-4 py-3 text-[#111214]">{m.material?.current_stock ?? '—'}</td>
 <td className="px-4 py-3 text-[#111214] text-xs">{new Date(m.created_at).toLocaleDateString('ar-SA')}</td>
 <td className="px-4 py-3 text-[#62666D] text-xs max-w-[200px] truncate">{m.notes || '—'}</td>
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

 {showAction && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={() => setShowAction(null)} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214] flex items-center gap-2">{ACTION_LABELS[showAction].icon} {ACTION_LABELS[showAction].title}</h2>
 <button onClick={() => setShowAction(null)} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>
 <div className="space-y-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">المادة *</label>
 <select value={actionForm.material_id} onChange={e => setActionForm({ ...actionForm, material_id: e.target.value })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="">اختر المادة</option>
 {materials.map(m => <option key={m.id} value={m.id}>{m.name} (المخزون: {m.current_stock})</option>)}
 </select>
 </div>
 {showAction === 'adjust' && (
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الاتجاه *</label>
 <select value={actionForm.direction} onChange={e => setActionForm({ ...actionForm, direction: e.target.value as 'in' | 'out' })}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]">
 <option value="in">وارد (زيادة)</option>
 <option value="out">صادر (خصم)</option>
 </select>
 </div>
 )}
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">الكمية *</label>
 <input type="number" value={actionForm.quantity} onChange={e => setActionForm({ ...actionForm, quantity: Number(e.target.value) })} min={0.01} step={0.01}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626]" />
 </div>
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1">{showAction === 'waste' ? 'السبب *' : 'ملاحظات'}</label>
 <textarea value={actionForm.notes} onChange={e => setActionForm({ ...actionForm, notes: e.target.value })} rows={2}
 className="w-full px-3 py-2 bg-white border border-[#E7E8EA] shadow-sm rounded-xl text-[#111214] text-sm focus:outline-none focus:border-[#DC2626] resize-none" />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={handleAction} disabled={saving || !actionForm.material_id || actionForm.quantity <= 0}
 className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-[#111214] rounded-xl text-sm font-bold transition-colors">
 {saving ? <FaSpinner className="animate-spin inline" /> : 'تطبيق'}
 </button>
 <button onClick={() => setShowAction(null)} className="px-6 py-2.5 bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] rounded-xl text-sm font-bold transition-colors">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
