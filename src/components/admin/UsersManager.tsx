'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import {
 FaSearch,
 FaSpinner,
 FaBoxOpen,
 FaToggleOn,
 FaToggleOff,
 FaPlus,
 FaPen,
 FaCheckCircle,
 FaExclamationTriangle,
 FaTimes,
 FaUser,
 FaEnvelope,
 FaPhone,
 FaUserShield,
} from 'react-icons/fa'

interface Staff {
 id: string
 email: string
 full_name: string
 phone: string | null
 role: string
 role_id: string
 is_active: boolean
 created_at: string
}

export default function UsersManager() {
 const { hasPermission } = useAuth()
 const [staff, setStaff] = useState<Staff[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [page, setPage] = useState(1)
 const [total, setTotal] = useState(0)
 const [pageSize] = useState(20)
 const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
 const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
 const [formData, setFormData] = useState({ email: '', full_name: '', phone: '', role_id: '', role: '' })
 const [formErrors, setFormErrors] = useState<Record<string, string>>({})
 const [formSubmitting, setFormSubmitting] = useState(false)
 const [actionLoading, setActionLoading] = useState<string | null>(null)

 const canCreate = hasPermission('staff', 'create')
 const canUpdate = hasPermission('staff', 'update')

 useEffect(() => {
   if (!notification) return
   const t = setTimeout(() => setNotification(null), 4000)
   return () => clearTimeout(t)
 }, [notification])

 const loadStaff = useCallback(async (p: number) => {
 setLoading(true)
 try {
 const { getStaff } = await import('@/app/actions/staff')
 const result = await getStaff(search || undefined, p, pageSize)
 if (result.success) {
 setStaff(result.data || [])
 setTotal(result.pagination?.total || 0)
 }
 } finally {
 setLoading(false)
 }
 }, [search, pageSize])

 useEffect(() => { loadStaff(page) }, [page, loadStaff])

 const totalPages = Math.ceil(total / pageSize)

 const loadRoles = async () => {
   if (roles.length === 0) {
     try {
       const { getRoles } = await import('@/app/actions/roles')
       const res = await getRoles()
       if (res.success) setRoles(res.data || [])
     } catch {}
   }
 }

 const handleOpenForm = async (s?: Staff) => {
   await loadRoles()
   if (s) {
     setEditingStaff(s)
     setFormData({ email: s.email, full_name: s.full_name, phone: s.phone || '', role_id: s.role_id, role: s.role })
   } else {
     setEditingStaff(null)
     setFormData({ email: '', full_name: '', phone: '', role_id: '', role: '' })
   }
   setFormErrors({})
   setShowForm(true)
 }

 const handleFormSubmit = async (e: React.FormEvent) => {
   e.preventDefault()
   setFormErrors({})
   const errs: Record<string, string> = {}
   if (!editingStaff && !formData.email.trim()) errs.email = 'البريد الإلكتروني مطلوب'
   if (!formData.full_name.trim() || formData.full_name.trim().length < 2) errs.full_name = 'الاسم مطلوب (حرفين على الأقل)'
   if (!formData.role_id) errs.role_id = 'يرجى اختيار الدور'
   if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
   setFormSubmitting(true)
    try {
      if (editingStaff) {
       const { updateStaff } = await import('@/app/actions/staff')
        const result = await updateStaff(editingStaff.id, { full_name: formData.full_name.trim(), phone: formData.phone.trim() || undefined, role_id: formData.role_id })
       if (result.success) {
         setNotification({ type: 'success', message: 'تم تحديث الموظف بنجاح' })
         setShowForm(false)
         loadStaff(page)
       } else {
         setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
       }
     } else {
       const { createStaff } = await import('@/app/actions/staff')
        const result = await createStaff({ email: formData.email.trim(), full_name: formData.full_name.trim(), phone: formData.phone.trim() || undefined, role_id: formData.role_id })
       if (result.success) {
         setNotification({ type: 'success', message: 'تم إنشاء الموظف بنجاح' })
         setShowForm(false)
         loadStaff(page)
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

 const handleToggleStatus = async (s: Staff) => {
   setActionLoading(s.id)
   try {
     const { toggleStaffStatus } = await import('@/app/actions/staff')
     const result = await toggleStaffStatus(s.id)
     if (result.success) {
       setNotification({ type: 'success', message: s.is_active ? 'تم تعطيل الموظف' : 'تفعيل الموظف بنجاح' })
       loadStaff(page)
     } else {
       setNotification({ type: 'error', message: result.error || 'حدث خطأ' })
     }
   } catch {
     setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
   } finally {
     setActionLoading(null)
   }
 }

 const roleBadge = (role: string) => {
 const map: Record<string, string> = {
 super_admin: 'bg-[#FEF2F2] text-[#DC2626]',
 admin: 'bg-[#FFFBEB] text-[#D97706]',
 receptionist: 'bg-[#EFF6FF] text-[#2563EB]',
 inventory_manager: 'bg-[#FAF5FF] text-[#7C3AED]',
 technician: 'bg-[#ECFDF5] text-[#059669]',
 accountant: 'bg-[#ECFEFF] text-[#0891B2]',
 }
 const cls = map[role] || 'bg-[#F1F2F3] text-[#62666D]'
 return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cls}`}>{role}</span>
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
 <h1 className="text-2xl font-black text-[#111214]">المستخدمين</h1>
 <p className="text-[#62666D] text-sm mt-1">إدارة الموظفين والصلاحيات</p>
 </div>
 {canCreate && (
 <button onClick={() => handleOpenForm()} className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
 <FaPlus className="text-xs" />
 موظف جديد
 </button>
 )}
 </div>

 <div className="mb-4">
 <div className="relative">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو البريد أو الهاتف..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl py-2.5 pr-10 pl-4 text-[#111214] text-sm placeholder-slate-500 focus:outline-none focus:border-[#DC2626]"
 />
 </div>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-12 text-center">
 <FaSpinner className="animate-spin text-[#DC2626] text-2xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">جاري التحميل...</p>
 </div>
 ) : staff.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا يوجد موظفين</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الاسم</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">البريد</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الدور</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">تاريخ الإنشاء</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">إجراءات</th>
 </tr>
 </thead>
 <tbody>
 {staff.map(s => (
 <tr key={s.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{s.full_name || s.email}</td>
 <td className="px-4 py-3 text-[#111214]">{s.email}</td>
 <td className="px-4 py-3">{roleBadge(s.role)}</td>
 <td className="px-4 py-3">
 {s.is_active ? (
 <FaToggleOn className="text-[#059669] text-lg" />
 ) : (
 <FaToggleOff className="text-[#62666D] text-lg" />
 )}
 </td>
 <td className="px-4 py-3 text-[#62666D] text-xs">
 {new Date(s.created_at).toLocaleDateString('ar-SA')}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1">
 {canUpdate && <button onClick={() => handleOpenForm(s)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]"><FaPen className="text-xs" /></button>}
 {canUpdate && (
 <button onClick={() => handleToggleStatus(s)} disabled={actionLoading === s.id} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] disabled:opacity-50">
 {actionLoading === s.id ? <FaSpinner className="animate-spin text-xs" /> : s.is_active ? <FaToggleOff className="text-[#DC2626] text-sm" /> : <FaToggleOn className="text-[#059669] text-sm" />}
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {totalPages > 1 && (
 <div className="flex items-center justify-center gap-2 mt-4">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page === 1}
 className="px-3 py-1.5 rounded-lg bg-[#F7F7F5] text-[#62666D] text-xs font-bold disabled:opacity-30"
 >
 السابق
 </button>
 <span className="text-[#62666D] text-xs">{page} / {totalPages}</span>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="px-3 py-1.5 rounded-lg bg-[#F7F7F5] text-[#62666D] text-xs font-bold disabled:opacity-30"
 >
 التالي
 </button>
 </div>
 )}

 {showForm && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
 <h3 className="text-[#111214] font-black">{editingStaff ? 'تعديل الموظف' : 'موظف جديد'}</h3>
 <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]"><FaTimes className="text-sm" /></button>
 </div>
 <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
 {!editingStaff && (
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">البريد الإلكتروني *</label>
 <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={`w-full bg-white border ${formErrors.email ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="email@example.com" dir="ltr" />
 {formErrors.email && <p className="text-[#DC2626] text-xs mt-1">{formErrors.email}</p>}
 </div>
 )}
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الاسم الكامل *</label>
 <input type="text" value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} className={`w-full bg-white border ${formErrors.full_name ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]`} placeholder="الاسم الكامل" />
 {formErrors.full_name && <p className="text-[#DC2626] text-xs mt-1">{formErrors.full_name}</p>}
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">رقم الهاتف</label>
 <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]" placeholder="05XXXXXXXX" dir="ltr" />
 </div>
 <div>
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الدور *</label>
 <select value={formData.role_id} onChange={e => setFormData(p => ({ ...p, role_id: e.target.value }))} className={`w-full bg-white border ${formErrors.role_id ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626] appearance-none cursor-pointer`}>
 <option value="">اختر الدور</option>
 {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
 </select>
 {formErrors.role_id && <p className="text-[#DC2626] text-xs mt-1">{formErrors.role_id}</p>}
 </div>
 <div className="flex gap-3 pt-2">
 <button type="submit" disabled={formSubmitting} className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
 {formSubmitting ? <><FaSpinner className="animate-spin" /> جاري الحفظ...</> : editingStaff ? 'تحديث' : 'إضافة'}
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
