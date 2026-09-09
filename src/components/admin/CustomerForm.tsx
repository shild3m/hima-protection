'use client'

import { useState } from 'react'
import {
 FaSave,
 FaTimes,
 FaUsers,
 FaExclamationTriangle,
} from 'react-icons/fa'

interface Customer {
 id: string
 full_name: string
 phone: string
 email: string | null
 source: string | null
 notes: string | null
 is_active: boolean
}

interface CustomerFormProps {
 initialData?: Customer | null
 onCancel: () => void
 onSaved: () => void
}

const sourceOptions = [
 { value: '', label: 'اختر المصدر' },
 { value: 'walk_in', label: 'حضور مباشر' },
 { value: 'referral', label: 'إحالة' },
 { value: 'online', label: 'أونلاين' },
 { value: 'social', label: 'تواصل اجتماعي' },
 { value: 'phone', label: 'هاتف' },
]

export function CustomerForm({ initialData, onCancel, onSaved }: CustomerFormProps) {
 const [fullName, setFullName] = useState(initialData?.full_name || '')
 const [phone, setPhone] = useState(initialData?.phone || '')
 const [email, setEmail] = useState(initialData?.email || '')
 const [source, setSource] = useState(initialData?.source || '')
 const [notes, setNotes] = useState(initialData?.notes || '')
 const [isActive, setIsActive] = useState(initialData?.is_active ?? true)

 const [loading, setLoading] = useState(false)
 const [errors, setErrors] = useState<Record<string, string>>({})
 const [serverError, setServerError] = useState('')

 const isEditing = !!initialData

 const validate = (): boolean => {
 const newErrors: Record<string, string> = {}

 if (!fullName.trim()) {
 newErrors.fullName = 'اسم العميل مطلوب'
 } else if (fullName.trim().length > 200) {
 newErrors.fullName = 'اسم العميل طويل جداً'
 }

 if (!phone.trim()) {
 newErrors.phone = 'رقم الجوال مطلوب'
 } else if (phone.trim().length < 5) {
 newErrors.phone = 'رقم الجوال قصير جداً'
 } else if (phone.trim().length > 20) {
 newErrors.phone = 'رقم الجوال طويل جداً'
 }

 if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
 newErrors.email = 'البريد الإلكتروني غير صحيح'
 }

 setErrors(newErrors)
 return Object.keys(newErrors).length === 0
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setServerError('')

 if (!validate()) return

 setLoading(true)

 try {
 const { createCustomer, updateCustomer } = await import('@/app/actions/customers')

 const customerData = {
 full_name: fullName.trim(),
 phone: phone.trim(),
 email: email.trim() || null,
 source: (source || null) as 'walk_in' | 'referral' | 'online' | 'social' | 'phone' | null,
 notes: notes.trim() || null,
 is_active: isActive,
 }

 const result = isEditing
 ? await updateCustomer(initialData.id, customerData)
 : await createCustomer(customerData)

 if (result.success) {
 onSaved()
 } else {
 setServerError(result.error)
 }
 } catch {
 setServerError('حدث خطأ غير متوقع')
 } finally {
 setLoading(false)
 }
 }

 return (
 <form onSubmit={handleSubmit} className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-4 sm:p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-[#FEF2F2] flex items-center justify-center">
 <FaUsers className="text-[#DC2626] text-xs" />
 </div>
 {isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
 </h3>
 <button type="button" onClick={onCancel} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>

 {serverError && (
 <div className="flex items-center gap-3 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl mb-6">
 <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
 <FaExclamationTriangle className="text-[#DC2626] text-sm" />
 </div>
 <p className="text-red-200 text-sm font-medium">{serverError}</p>
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
 <div>
 <label className="label-light">اسم العميل *</label>
 <input
 type="text"
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 className="input-light"
 placeholder="أدخل اسم العميل"
 />
 {errors.fullName && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.fullName}</p>}
 </div>

 <div>
 <label className="label-light">رقم الجوال *</label>
 <input
 type="tel"
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 className="input-light"
 placeholder="05XXXXXXXX"
 />
 {errors.phone && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.phone}</p>}
 </div>

 <div>
 <label className="label-light">البريد الإلكتروني</label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className="input-light"
 placeholder="example@email.com"
 />
 {errors.email && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.email}</p>}
 </div>

 <div>
 <label className="label-light">المصدر</label>
 <select
 value={source}
 onChange={(e) => setSource(e.target.value)}
 className="select-light"
 >
 {sourceOptions.map((opt) => (
 <option key={opt.value} value={opt.value} className="bg-white text-[#111214]">
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div className="mb-6">
 <label className="label-light">ملاحظات</label>
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={3}
 className="textarea-light"
 placeholder="ملاحظات إضافية عن العميل (اختياري)"
 />
 </div>

 <div className="mb-6">
 <label className="flex items-center gap-3 cursor-pointer">
 <div className="relative">
 <input
 type="checkbox"
 checked={isActive}
 onChange={(e) => setIsActive(e.target.checked)}
 className="peer w-5 h-5 appearance-none rounded-lg border border-[#E7E8EA] checked:bg-gradient-to-br checked:from-red-600 checked:to-red-700 checked:border-red-600 cursor-pointer transition-all duration-200"
 />
 <FaSave className="absolute inset-0 flex items-center justify-center text-[10px] text-[#111214] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
 </div>
 <span className="text-[#111214] text-sm font-bold">العميل نشط</span>
 </label>
 </div>

 <div className="flex gap-2">
 <button
 type="button"
 onClick={onCancel}
 className="flex-1 py-3 bg-[#F7F7F5] border border-[#E7E8EA] text-[#111214] font-bold rounded-xl hover:bg-[#F1F2F3] transition text-sm"
 >
 إلغاء
 </button>
 <button
 type="submit"
 disabled={loading}
 className="flex-1 py-3 bg-[#C4121A] text-white font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
 >
 {loading ? (
 <>
 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
 جاري الحفظ...
 </>
 ) : (
 <>
 <FaSave className="text-sm" />
 {isEditing ? 'تحديث' : 'إضافة'}
 </>
 )}
 </button>
 </div>
 </form>
 )
}
