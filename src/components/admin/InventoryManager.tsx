'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import SelectList from '@/components/ui/SelectList'
import {
 FaSpinner, FaBoxOpen, FaChevronRight, FaChevronLeft, FaCheckCircle,
 FaExclamationTriangle, FaTimes, FaArrowUp, FaArrowDown,
 FaPlus, FaMinus, FaFilter,
} from 'react-icons/fa'

interface Material { id: string; name: string; sku: string; unit: string; current_stock: number; min_stock: number; is_active: boolean }
interface StockMovement {
 id: string; material_id: string; quantity: number; type: string; notes: string | null;
 created_at: string; created_by: string | null;
 material: { id: string; name: string; sku: string; unit: string; current_stock: number } | null;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
type Notification = { type: 'success' | 'error'; message: string } | null

const FILTER_OPTIONS = [
 { value: 'in', label: 'إضافة' },
 { value: 'out', label: 'خصم' },
]

function getTypeInfo(quantity: number): { label: string; color: string; icon: React.ReactNode } {
 if (quantity > 0) {
 return { label: 'إضافة', color: 'text-[#059669] bg-[#ECFDF5]', icon: <FaArrowDown className="text-xs" /> }
 }
 return { label: 'خصم', color: 'text-[#DC2626] bg-[#FEF2F2]', icon: <FaArrowUp className="text-xs" /> }
}

type ActionType = 'in' | 'out'

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
  const [actionError, setActionError] = useState('')

 const canAdjust = hasPermission('inventory', 'adjust')

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
 const { getMaterialOptions } = await import('@/app/actions/materials')
 const res = await getMaterialOptions()
 if (res.success) setMaterials(res.data)
 } catch { /* ignore */ }
 }, [])

 useEffect(() => { loadMaterials() }, [loadMaterials])
 useEffect(() => { loadMovements(materialFilter, typeFilter, page) }, [materialFilter, typeFilter, page, loadMovements])

 const openAction = (direction: ActionType) => {
 setActionForm({ material_id: '', quantity: 1, direction, notes: '' })
 setShowAction(direction)
 }

  const changeQuantity = (delta: number) => {
  const current = Number.isFinite(actionForm.quantity) ? actionForm.quantity : 0
  setActionForm(f => ({ ...f, quantity: Math.max(1, current + delta) }))
  setActionError('')
  }

  const handleAction = async () => {
  setSaving(true); setNotification(null); setActionError('')
  try {
  if (!actionForm.material_id) { setActionError('اختر المادة'); setSaving(false); return }
  if (actionForm.quantity <= 0) { setActionError('الكمية يجب أن تكون أكبر من صفر'); setSaving(false); return }

  const { adjustStock } = await import('@/app/actions/inventory')
  const res = await adjustStock({ material_id: actionForm.material_id, quantity: actionForm.quantity, direction: actionForm.direction, notes: actionForm.notes || null })
  if (!res.success) {
  setActionError(res.error || 'حدث خطأ'); setSaving(false); return
  }
  setNotification({ type: 'success', message: `تم ${actionForm.direction === 'in' ? 'إضافة' : 'خصم'} ${actionForm.quantity} من المخزون` })

  setShowAction(null)
  setActionForm({ material_id: '', quantity: 1, direction: 'in', notes: '' })
  setActionError('')
  loadMovements(materialFilter, typeFilter, page)
  loadMaterials()
  } finally { setSaving(false) }
  }

 const ACTION_LABELS: Record<ActionType, { title: string; icon: React.ReactNode }> = {
 in: { title: 'إضافة للمخزون', icon: <FaPlus className="text-[#059669]" /> },
 out: { title: 'خصم من المخزون', icon: <FaMinus className="text-[#DC2626]" /> },
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] mb-1">المخزون</h1>
 <p className="text-[#62666D] text-sm">حركات المخزون وتعديلات</p>
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

 <div className="flex flex-col sm:flex-row gap-3 mb-4">
 <div className="w-full sm:flex-1 sm:min-w-72">
 <label className="block text-[#62666D] text-[11px] font-bold mb-1.5">المادة</label>
 <SelectList
 value={materialFilter}
 onChange={v => { setMaterialFilter(v); setPage(1) }}
 options={[{ value: '', label: 'كل المواد' }, ...materials.map(m => ({ value: m.id, label: `${m.name} (المخزون: ${m.current_stock})` }))]}
 placeholder="كل المواد"
 icon={<FaBoxOpen />}
 searchable
 searchPlaceholder="ابحث عن مادة..."
 emptyText="لا توجد مواد مطابقة"
 ariaLabel="تصفية حسب المادة"
 />
 </div>
 <div className="w-full sm:w-44">
 <label className="block text-[#62666D] text-[11px] font-bold mb-1.5">النوع</label>
 <SelectList
 value={typeFilter}
 onChange={v => { setTypeFilter(v); setPage(1) }}
 options={[{ value: 'all', label: 'كل الأنواع' }, ...FILTER_OPTIONS]}
 placeholder="كل الأنواع"
 icon={<FaFilter />}
 ariaLabel="تصفية حسب النوع"
 />
 </div>
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
 const typeInfo = getTypeInfo(m.quantity)
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
 <td className="px-4 py-3 text-[#111214] text-xs">{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
 <td className="px-4 py-3 text-[#62666D] text-xs max-w-[200px] truncate">{m.notes || 'لا توجد ملاحظات مسجّلة'}</td>
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
