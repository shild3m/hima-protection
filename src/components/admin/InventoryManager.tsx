'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import SelectList from '@/components/ui/SelectList'
import {
 FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle,
 FaExclamationTriangle, FaTimes, FaPlus, FaMinus, FaFilter, FaHistory, FaSearch,
} from 'react-icons/fa'

interface Material { id: string; name: string; sku: string; unit: string; current_stock: number; min_stock: number; is_active: boolean }
interface Availability { id: string; name: string; sku: string; unit: string; current_stock: number; reserved_stock: number; available_stock: number; min_stock: number; is_active: boolean }
interface StockMovement {
 id: string; material_id: string; quantity: number; type: string; notes: string | null;
 created_at: string; created_by: string | null;
 material: { id: string; name: string; sku: string; unit: string; current_stock: number } | null;
}
interface LatestMovement { id: string; material_id: string; quantity: number; type: string; created_at: string }

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
type Notification = { type: 'success' | 'error'; message: string } | null

const UNIT_LABELS: Record<string, string> = {
 meter: 'متر', piece: 'قطعة', roll: 'لفة', box: 'علبة', liter: 'لتر', ml: 'مل', bottle: 'زجاجة',
}

const HISTORY_FILTER_OPTIONS = [
 { value: 'in', label: 'إضافة' },
 { value: 'out', label: 'خصم' },
 { value: 'purchase', label: 'شراء' },
 { value: 'usage', label: 'استهلاك' },
 { value: 'return', label: 'إرجاع' },
 { value: 'adjustment', label: 'تسوية' },
]

function formatUnit(unit: string) {
 return UNIT_LABELS[unit] || unit
}

function getMovementInfo(type: string, quantity: number): { label: string; color: string } {
 switch (type) {
 case 'purchase':
 return { label: 'شراء', color: 'text-[#059669] bg-[#ECFDF5]' }
 case 'usage':
 return { label: 'استهلاك', color: 'text-[#DC2626] bg-[#FEF2F2]' }
 case 'waste':
 return { label: 'هدر', color: 'text-[#DC2626] bg-[#FEF2F2]' }
 case 'return':
 return { label: 'إرجاع', color: 'text-[#059669] bg-[#ECFDF5]' }
 case 'adjustment':
 return { label: quantity > 0 ? 'تسوية إضافة' : 'تسوية خصم', color: 'text-[#D97706] bg-[#FFFBEB]' }
 default:
 return quantity > 0
 ? { label: 'إضافة', color: 'text-[#059669] bg-[#ECFDF5]' }
 : { label: 'خصم', color: 'text-[#DC2626] bg-[#FEF2F2]' }
 }
}

type ActionType = 'in' | 'out'

const ACTION_LABELS: Record<ActionType, { title: string; icon: React.ReactNode }> = {
 in: { title: 'إضافة للمخزون', icon: <FaPlus className="text-[#059669]" /> },
 out: { title: 'خصم من المخزون', icon: <FaMinus className="text-[#DC2626]" /> },
}

export default function InventoryManager({ initialMaterials, initialAvailability, initialLatestMovements }: {
 initialMaterials?: Material[]
 initialAvailability?: Availability[]
 initialLatestMovements?: Record<string, LatestMovement>
} = {}) {
 const { hasPermission } = useAuth()
 const [materials, setMaterials] = useState<Material[]>(initialMaterials ?? [])
 const [availability, setAvailability] = useState<Availability[]>(initialAvailability ?? [])
 const [latestMovements, setLatestMovements] = useState<Record<string, LatestMovement>>(initialLatestMovements ?? {})
 const [loading, setLoading] = useState(initialAvailability === undefined)
 const [search, setSearch] = useState('')
 const [notification, setNotification] = useState<Notification>(null)
 const [showAction, setShowAction] = useState<ActionType | null>(null)
 const [actionForm, setActionForm] = useState({ material_id: '', quantity: 1, direction: 'in' as 'in' | 'out', notes: '' })
 const [saving, setSaving] = useState(false)
 const [actionError, setActionError] = useState('')
 const [historyMaterial, setHistoryMaterial] = useState<Availability | null>(null)
 const [historyMovements, setHistoryMovements] = useState<StockMovement[]>([])
 const [historyPagination, setHistoryPagination] = useState<Pagination | null>(null)
 const [historyType, setHistoryType] = useState('all')
 const [historyPage, setHistoryPage] = useState(1)
 const [historyLoading, setHistoryLoading] = useState(false)
 const historyRequest = useRef(0)

 const canAdjust = hasPermission('inventory', 'adjust')

 const loadMaterials = useCallback(async () => {
 try {
 const { getMaterialOptions } = await import('@/app/actions/materials')
 const res = await getMaterialOptions()
 if (res.success) setMaterials(res.data)
 } catch { /* ignore */ }
 }, [])

 const loadAvailability = useCallback(async () => {
 try {
 const { getInventoryAvailability } = await import('@/app/actions/inventory')
 const res = await getInventoryAvailability()
 if (res.success) setAvailability(res.data as Availability[])
 } catch { /* ignore */ }
 }, [])

 const loadLatestMovements = useCallback(async () => {
 try {
 const { getLatestStockMovements } = await import('@/app/actions/inventory')
 const res = await getLatestStockMovements()
 if (res.success) setLatestMovements(res.data)
 } catch { /* ignore */ }
 }, [])

 useEffect(() => {
 if (initialMaterials === undefined) loadMaterials()
 }, [initialMaterials, loadMaterials])

 useEffect(() => {
 if (initialAvailability !== undefined && initialLatestMovements !== undefined) return
 let cancelled = false
 setLoading(true)
 Promise.all([
 initialAvailability === undefined ? loadAvailability() : Promise.resolve(),
 initialLatestMovements === undefined ? loadLatestMovements() : Promise.resolve(),
 ]).finally(() => {
 if (!cancelled) setLoading(false)
 })
 return () => { cancelled = true }
 }, [initialAvailability, initialLatestMovements, loadAvailability, loadLatestMovements])

 useEffect(() => {
 if (!historyMaterial) return
 let cancelled = false
 const requestId = ++historyRequest.current
 setHistoryLoading(true)
 ;(async () => {
 try {
 const { getStockMovements } = await import('@/app/actions/inventory')
 const res = await getStockMovements(historyMaterial.id, historyType === 'all' ? undefined : historyType, historyPage, 10)
 if (cancelled || requestId !== historyRequest.current) return
 if (res.success) {
 setHistoryMovements(res.data)
 setHistoryPagination(res.pagination)
 } else {
 setHistoryMovements([])
 setHistoryPagination(null)
 }
 } finally {
 if (!cancelled && requestId === historyRequest.current) setHistoryLoading(false)
 }
 })()
 return () => { cancelled = true }
 }, [historyMaterial, historyType, historyPage])

 const openAction = (direction: ActionType) => {
 setActionForm({ material_id: '', quantity: 1, direction, notes: '' })
 setShowAction(direction)
 setActionError('')
 }

 const changeQuantity = (delta: number) => {
 const current = Number.isFinite(actionForm.quantity) ? actionForm.quantity : 0
 setActionForm(f => ({ ...f, quantity: Math.max(1, current + delta) }))
 setActionError('')
 }

 const handleAction = async () => {
 setSaving(true); setNotification(null); setActionError('')
 try {
 if (!actionForm.material_id) { setActionError('اختر المادة'); return }
 if (actionForm.quantity <= 0) { setActionError('الكمية يجب أن تكون أكبر من صفر'); return }

 const { adjustStock } = await import('@/app/actions/inventory')
 const res = await adjustStock({ material_id: actionForm.material_id, quantity: actionForm.quantity, direction: actionForm.direction, notes: actionForm.notes || null })
 if (!res.success) {
 setActionError(res.error || 'حدث خطأ'); return
 }
 setNotification({ type: 'success', message: `تم ${actionForm.direction === 'in' ? 'إضافة' : 'خصم'} ${actionForm.quantity} من المخزون` })

 setShowAction(null)
 setActionForm({ material_id: '', quantity: 1, direction: 'in', notes: '' })
 await Promise.all([loadAvailability(), loadLatestMovements(), loadMaterials()])
 } finally { setSaving(false) }
 }

 const openHistory = (item: Availability) => {
 setHistoryMaterial(item)
 setHistoryType('all')
 setHistoryPage(1)
 }

 const closeHistory = () => {
 setHistoryMaterial(null)
 setHistoryMovements([])
 setHistoryPagination(null)
 }

 const term = search.trim().toLowerCase()
 const visibleMaterials = availability.filter(item =>
 !term
 || item.name.toLowerCase().includes(term)
 || (item.sku || '').toLowerCase().includes(term)
 )

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] mb-1">المخزون</h1>
 <p className="text-[#62666D] text-sm">مواد المخزون والحركات</p>
 </div>
 {canAdjust && (
 <div className="flex gap-2 flex-wrap">
 <button onClick={() => openAction('in')} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors">
 <FaPlus className="text-xs" /> إضافة
 </button>
 <button onClick={() => openAction('out')} className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors">
 <FaMinus className="text-xs" /> خصم
 </button>
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

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-[#E7E8EA]">
 <div className="flex-1">
 <h2 className="text-sm font-black text-[#111214]">المواد</h2>
 <p className="text-[11px] text-[#62666D] mt-1">الرصيد الفعلي والمحجوز والمتاح لكل مادة</p>
 </div>
 <div className="relative w-full sm:w-64">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA0A6] text-xs pointer-events-none" />
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="ابحث عن مادة..."
 aria-label="بحث في المواد"
 className="w-full h-9 pr-9 pl-3 bg-white border border-[#E7E8EA] rounded-xl text-[#111214] text-xs font-bold shadow-sm transition-all hover:border-[#DC2626]/40 focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-[#DC2626]/10"
 />
 </div>
 </div>

 {loading ? (
 <div className="p-8 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : visibleMaterials.length === 0 ? (
 <div className="p-8 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">{availability.length === 0 ? 'لا توجد مواد' : 'لا توجد مواد مطابقة للبحث'}</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[560px] text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">المادة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">الرصيد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">آخر حركة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">الإجراء</th>
 </tr>
 </thead>
 <tbody>
 {visibleMaterials.map(item => {
 const latest = latestMovements[item.id]
 const latestInfo = latest ? getMovementInfo(latest.type, latest.quantity) : null
 return (
 <tr key={item.id} className="border-b border-[#E7E8EA] last:border-b-0 hover:bg-[#F1F2F3]">
 <td className="px-4 py-3">
 <div className="text-[#111214] font-bold">{item.name}</div>
 <div className="text-[#62666D] text-[11px]">{[item.sku, formatUnit(item.unit)].filter(Boolean).join(' · ')}</div>
 </td>
 <td className="px-4 py-3">
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap">
 <span className="text-[#62666D]">الفعلي <b className="text-[#111214]">{item.current_stock}</b></span>
 <span className="text-[#62666D]">المحجوز <b className={item.reserved_stock > 0 ? 'text-[#D97706]' : 'text-[#111214]'}>{item.reserved_stock}</b></span>
 <span className="text-[#62666D]">المتاح <b className={item.available_stock <= item.min_stock ? 'text-[#DC2626]' : 'text-[#059669]'}>{item.available_stock}</b></span>
 </div>
 </td>
 <td className="px-4 py-3">
 {latest && latestInfo ? (
 <>
 <div className="flex items-center gap-2 whitespace-nowrap">
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${latestInfo.color}`}>{latestInfo.label}</span>
 <span className={`font-bold ${latest.quantity > 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
 {latest.quantity > 0 ? '+' : ''}{latest.quantity}
 </span>
 </div>
 <div className="text-[#62666D] text-[11px] mt-1">{new Date(latest.created_at).toLocaleDateString('en-GB')}</div>
 </>
 ) : (
 <span className="text-[#62666D] text-xs">لا توجد حركات</span>
 )}
 </td>
 <td className="px-4 py-3">
 <button onClick={() => openHistory(item)}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E7E8EA] rounded-lg text-xs font-bold text-[#111214] shadow-sm transition-colors hover:border-[#DC2626]/40 hover:text-[#DC2626]">
 <FaHistory className="text-[11px]" /> السجل
 </button>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {historyMaterial && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={closeHistory} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
 <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E7E8EA]">
 <div>
 <h2 className="text-base font-black text-[#111214] flex items-center gap-2"><FaHistory className="text-[#DC2626] text-sm" /> سجل حركة — {historyMaterial.name}</h2>
 <p className="text-[11px] text-[#62666D] mt-1">كل الحركات المسجلة لهذه المادة</p>
 </div>
 <button onClick={closeHistory} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]" aria-label="إغلاق السجل"><FaTimes /></button>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-end gap-3 px-5 py-3 border-b border-[#E7E8EA]">
 <div className="w-full sm:w-48">
 <label className="block text-[#62666D] text-[11px] font-bold mb-1.5">النوع</label>
 <SelectList
 value={historyType}
 onChange={v => { setHistoryType(v); setHistoryPage(1) }}
 options={[{ value: 'all', label: 'كل الأنواع' }, ...HISTORY_FILTER_OPTIONS]}
 placeholder="كل الأنواع"
 icon={<FaFilter />}
 ariaLabel="تصفية حسب النوع"
 />
 </div>
 {historyPagination && (
 <p className="text-[11px] text-[#62666D] sm:pb-2">{historyPagination.total} حركة</p>
 )}
 </div>

 <div className="flex-1 overflow-auto">
 {historyLoading ? (
 <div className="p-8 text-center"><FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto" /></div>
 ) : historyMovements.length === 0 ? (
 <div className="p-8 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا توجد حركات لهذه المادة</p>
 </div>
 ) : (
 <table className="w-full min-w-[520px] text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">النوع</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">الكمية</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">التاريخ</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold whitespace-nowrap">ملاحظات</th>
 </tr>
 </thead>
 <tbody>
 {historyMovements.map(m => {
 const info = getMovementInfo(m.type, m.quantity)
 return (
 <tr key={m.id} className="border-b border-[#E7E8EA] last:border-b-0 hover:bg-[#F1F2F3]">
 <td className="px-4 py-3">
 <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${info.color}`}>{info.label}</span>
 </td>
 <td className="px-4 py-3">
 <span className={`font-bold ${m.quantity > 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
 {m.quantity > 0 ? '+' : ''}{m.quantity}
 </span>
 </td>
 <td className="px-4 py-3 text-[#111214] text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
 <td className="px-4 py-3 text-[#62666D] text-xs max-w-[220px] truncate" title={m.notes || undefined}>{m.notes || '—'}</td>
 </tr>
 )
 })}
 </tbody>
 </table>
 )}
 </div>

 {historyPagination && historyPagination.totalPages > 1 && (
 <div className="flex items-center justify-between px-4 py-3 border-t border-[#E7E8EA]">
 <p className="text-[#62666D] text-xs">الصفحة {historyPagination.page} من {historyPagination.totalPages}</p>
 <div className="flex gap-2">
 <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1}
 className="p-2 rounded-lg bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] disabled:opacity-30"><FaChevronRight className="text-xs" /></button>
 <button onClick={() => setHistoryPage(p => Math.min(historyPagination.totalPages, p + 1))} disabled={historyPage >= historyPagination.totalPages}
 className="p-2 rounded-lg bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] disabled:opacity-30"><FaChevronLeft className="text-xs" /></button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {showAction && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/60" onClick={() => { setShowAction(null); setActionError('') }} />
 <div className="relative bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-black text-[#111214] flex items-center gap-2">{ACTION_LABELS[showAction].icon} {ACTION_LABELS[showAction].title}</h2>
 <button onClick={() => { setShowAction(null); setActionError('') }} className="p-2 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes /></button>
 </div>

 {actionError && (
 <div className="mb-4 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs font-bold">
 {actionError}
 </div>
 )}
 <div className="space-y-4">
 <div>
 <label className="block text-[#62666D] text-xs font-bold mb-1.5">المادة <span className="text-[#DC2626]">*</span></label>
 <SelectList
 value={actionForm.material_id}
 onChange={v => { setActionForm({ ...actionForm, material_id: v }); setActionError('') }}
 options={materials.map(m => ({ value: m.id, label: `${m.name} (المخزون: ${m.current_stock})` }))}
 placeholder="اختر المادة"
 icon={<FaBoxOpen />}
 searchable
 searchPlaceholder="ابحث عن مادة..."
 emptyText="لا توجد مواد مطابقة"
 ariaLabel="اختر المادة"
 />
 </div>
 <div>
 <label htmlFor="action-quantity" className="block text-[#62666D] text-xs font-bold mb-1.5">الكمية <span className="text-[#DC2626]">*</span></label>
 <div className="flex items-stretch gap-2">
 <button type="button" onClick={() => changeQuantity(-1)} aria-label="تقليل الكمية"
 className="w-11 h-11 shrink-0 flex items-center justify-center bg-white border border-[#E7E8EA] rounded-xl text-[#62666D] shadow-sm transition-all hover:border-[#DC2626]/40 hover:text-[#DC2626]">
 <FaMinus className="text-xs" />
 </button>
 <input id="action-quantity" type="number" inputMode="decimal" value={actionForm.quantity}
 onChange={e => { setActionForm({ ...actionForm, quantity: Number(e.target.value) }); setActionError('') }} min={1} step={1}
 className="flex-1 min-w-0 h-11 text-center bg-white border border-[#E7E8EA] rounded-xl text-[#111214] text-sm font-bold shadow-sm transition-all hover:border-[#DC2626]/40 focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-[#DC2626]/10" />
 <button type="button" onClick={() => changeQuantity(1)} aria-label="زيادة الكمية"
 className="w-11 h-11 shrink-0 flex items-center justify-center bg-white border border-[#E7E8EA] rounded-xl text-[#62666D] shadow-sm transition-all hover:border-[#059669]/50 hover:text-[#059669]">
 <FaPlus className="text-xs" />
 </button>
 </div>
 </div>
 <div>
 <label htmlFor="action-notes" className="block text-[#62666D] text-xs font-bold mb-1.5">ملاحظات</label>
 <textarea id="action-notes" value={actionForm.notes} onChange={e => { setActionForm({ ...actionForm, notes: e.target.value }); setActionError('') }} rows={2}
 className="w-full px-3 py-2.5 bg-white border border-[#E7E8EA] rounded-xl text-[#111214] text-sm shadow-sm transition-all hover:border-[#DC2626]/40 focus:outline-none focus:border-[#DC2626] focus:ring-4 focus:ring-[#DC2626]/10 resize-none" />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={handleAction} disabled={saving || !actionForm.material_id || actionForm.quantity <= 0}
 className={`flex-1 h-11 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-sm transition-colors ${showAction === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
 {saving ? <FaSpinner className="animate-spin inline" /> : 'تطبيق'}
 </button>
 <button onClick={() => { setShowAction(null); setActionError('') }} className="px-6 h-11 bg-[#F7F7F5] border border-[#E7E8EA] text-[#62666D] hover:text-[#111214] rounded-xl text-sm font-bold transition-colors">إلغاء</button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
