'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaReceipt,
 FaSearch,
 FaEye,
 FaPen,
 FaTrash,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaCalendarAlt,
 FaChevronRight,
 FaChevronLeft,
 FaCheckCircle,
 FaPlus,
} from 'react-icons/fa'

interface Expense {
 id: string
 title: string
 amount: number
 expense_date: string
 notes: string | null
 created_by: string | null
 created_at: string
}

interface Pagination {
 page: number
 pageSize: number
 total: number
 totalPages: number
}

type Notification = { type: 'success' | 'error'; message: string } | null

function formatCurrency(amount: number): string {
 return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export default function ExpensesManager() {
 const { hasPermission } = useAuth()
 const [expenses, setExpenses] = useState<Expense[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [debouncedSearch, setDebouncedSearch] = useState('')
 const [page, setPage] = useState(1)
 const [pagination, setPagination] = useState<Pagination | null>(null)
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
 const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)
 const [saving, setSaving] = useState(false)
 const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

 const canCreate = hasPermission('expenses', 'create')
 const canUpdate = hasPermission('expenses', 'update')
 const canDelete = hasPermission('expenses', 'delete')
 const totalPages = pagination?.totalPages || 1

 const [formTitle, setFormTitle] = useState('')
 const [formAmount, setFormAmount] = useState('')
 const [formDate, setFormDate] = useState('')
 const [formNotes, setFormNotes] = useState('')

 useEffect(() => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 debounceRef.current = setTimeout(() => {
 setDebouncedSearch(search)
 setPage(1)
 }, 300)
 return () => {
 if (debounceRef.current) clearTimeout(debounceRef.current)
 }
 }, [search])

 const fetchExpenses = useCallback(async () => {
 try {
 setLoading(true)
 const { getExpenses } = await import('@/app/actions/expenses')
 const result = await getExpenses(debouncedSearch, page)
 if (result.success) {
 setExpenses(result.data)
 if (result.pagination) setPagination(result.pagination)
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب المصروفات' })
 } finally {
 setLoading(false)
 }
 }, [debouncedSearch, page])

 useEffect(() => { fetchExpenses() }, [fetchExpenses])
 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const resetForm = () => {
 setFormTitle('')
 setFormAmount('')
 setFormDate('')
 setFormNotes('')
 setEditingExpense(null)
 setShowForm(false)
 }

 const openCreate = () => {
 resetForm()
 const today = new Date().toISOString().split('T')[0]
 setFormDate(today)
 setShowForm(true)
 }

 const openEdit = (expense: Expense) => {
 setEditingExpense(expense)
 setFormTitle(expense.title)
 setFormAmount(String(expense.amount))
 setFormDate(expense.expense_date)
 setFormNotes(expense.notes || '')
 setShowForm(true)
 }

 const handleSave = async () => {
 if (!formTitle.trim() || !formAmount || !formDate) {
 setNotification({ type: 'error', message: 'يرجى ملء جميع الحقول المطلوبة' })
 return
 }

 setSaving(true)
 try {
 const amount = parseFloat(formAmount)
 if (isNaN(amount) || amount <= 0) {
 setNotification({ type: 'error', message: 'المبلغ يجب أن يكون أكبر من صفر' })
 setSaving(false)
 return
 }

 const payload = {
 title: formTitle.trim(),
 amount,
 expense_date: formDate,
 notes: formNotes.trim() || null,
 }

 if (editingExpense) {
 const { updateExpense } = await import('@/app/actions/expenses')
 const result = await updateExpense(editingExpense.id, payload)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم تحديث المصروف بنجاح' })
 resetForm()
 fetchExpenses()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } else {
 const { createExpense } = await import('@/app/actions/expenses')
 const result = await createExpense(payload)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم إنشاء المصروف بنجاح' })
 resetForm()
 fetchExpenses()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setSaving(false)
 }
 }

 const handleDelete = async (id: string) => {
 if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
 try {
 const { deleteExpense } = await import('@/app/actions/expenses')
 const result = await deleteExpense(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم حذف المصروف بنجاح' })
 fetchExpenses()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 }
 }

 return (
 <div className="space-y-4 sm:space-y-6">
 {notification && (
 <div className={`p-3 rounded-xl border text-sm font-bold ${
 notification.type === 'success'
 ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
 : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
 }`}>
 {notification.type === 'success' ? <FaCheckCircle className="inline ml-2" /> : <FaExclamationTriangle className="inline ml-2" />}
 {notification.message}
 </div>
 )}

 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالعنوان أو الملاحظات..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-2.5 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 />
 </div>
 {canCreate && (
 <button
 onClick={openCreate}
 className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shrink-0"
 >
 <FaPlus className="text-[10px]" />
 مصروف جديد
 </button>
 )}
 </div>

 {showForm && (
 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-4 sm:p-5">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-bold text-[#111214]">
 {editingExpense ? 'تعديل المصروف' : 'مصروف جديد'}
 </h3>
 <button onClick={resetForm} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes className="text-sm" />
 </button>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-bold text-[#62666D] mb-1.5">العنوان *</label>
 <input
 type="text"
 value={formTitle}
 onChange={e => setFormTitle(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-lg px-3 py-2 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 placeholder="عنوان المصروف"
 />
 </div>
 <div>
 <label className="block text-xs font-bold text-[#62666D] mb-1.5">المبلغ (ر.س) *</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={formAmount}
 onChange={e => setFormAmount(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-lg px-3 py-2 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 placeholder="0.00"
 />
 </div>
 <div>
 <label className="block text-xs font-bold text-[#62666D] mb-1.5">التاريخ *</label>
 <input
 type="date"
 value={formDate}
 onChange={e => setFormDate(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-lg px-3 py-2 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 />
 </div>
 <div>
 <label className="block text-xs font-bold text-[#62666D] mb-1.5">ملاحظات</label>
 <input
 type="text"
 value={formNotes}
 onChange={e => setFormNotes(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-lg px-3 py-2 text-sm text-[#111214] placeholder-slate-500 focus:outline-none focus:border-[#DC2626] transition"
 placeholder="ملاحظات (اختياري)"
 />
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-4">
 <button
 onClick={resetForm}
 className="px-4 py-2 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all"
 >
 إلغاء
 </button>
 <button
 onClick={handleSave}
 disabled={saving}
 className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-2"
 >
 {saving && <FaSpinner className="animate-spin text-[10px]" />}
 {editingExpense ? 'تحديث' : 'حفظ'}
 </button>
 </div>
 </div>
 )}

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <div className="w-10 h-10 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 </div>
 ) : expenses.length === 0 ? (
 <div className="text-center py-16">
 <FaBoxOpen className="text-5xl text-[#62666D] mx-auto mb-4" />
 <p className="text-[#62666D] font-bold">لا توجد مصروفات</p>
 </div>
 ) : (
 <>
 <div className="space-y-2 sm:space-y-3">
 {expenses.map(expense => (
 <div key={expense.id} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3 sm:p-4 hover:border-[#FECACA] transition-all group">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1.5 flex-wrap">
 <FaReceipt className="text-[#D97706] text-xs" />
 <span className="text-sm font-bold text-[#111214]">{expense.title}</span>
 </div>
 <div className="flex items-center gap-3 text-xs text-[#62666D] flex-wrap">
 <span className="text-[#111214] font-bold">{formatCurrency(expense.amount)} ر.س</span>
 <span className="flex items-center gap-1">
 <FaCalendarAlt className="text-[8px]" />
 {new Date(expense.expense_date).toLocaleDateString('en-GB')}
 </span>
 </div>
 {expense.notes && (
 <p className="text-xs text-[#62666D] mt-1.5 truncate">{expense.notes}</p>
 )}
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 {canUpdate && (
 <button
 onClick={() => openEdit(expense)}
 className="p-2 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] hover:text-[#111214] rounded-lg transition-all"
 >
 <FaPen className="text-[10px]" />
 </button>
 )}
 {canDelete && (
 <button
 onClick={() => handleDelete(expense.id)}
 className="p-2 bg-[#F7F7F5] hover:bg-[#FEF2F2] border border-[#E7E8EA] text-[#111214] hover:text-[#DC2626] rounded-lg transition-all"
 >
 <FaTrash className="text-[10px]" />
 </button>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>

 {pagination && pagination.total > 0 && (
 <div className="flex items-center justify-between mt-6 px-1">
 <span className="text-xs text-[#62666D]">
 {pagination.total} نتيجة — صفحة {pagination.page} من {pagination.totalPages}
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="px-3 py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
 >
 <FaChevronRight className="text-[10px]" />
 السابق
 </button>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page >= totalPages}
 className="px-3 py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
 >
 التالي
 <FaChevronLeft className="text-[10px]" />
 </button>
 </div>
 </div>
 )}
 </>
 )}
 </div>
 )
}
