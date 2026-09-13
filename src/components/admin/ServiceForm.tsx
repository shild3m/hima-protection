'use client'

import { useState } from 'react'
import {
 FaSave,
 FaTimes,
 FaWrench,
 FaInfoCircle,
 FaExclamationTriangle,
 FaCheckCircle,
} from 'react-icons/fa'
import { ICON_OPTIONS } from '@/lib/service-icons'

interface Service {
 id: string
 name: string
 icon_key: string | null
 short_description: string | null
 description: string | null
 base_price: number
 duration_minutes: number | null
 is_active: boolean
 display_order: number
 image_url: string | null
 meta_title: string | null
 meta_description: string | null
}

interface ServiceFormProps {
 initialData?: Service | null
 onCancel: () => void
 onSaved: () => void
}

export function ServiceForm({ initialData, onCancel, onSaved }: ServiceFormProps) {
  const [name, setName] = useState(initialData?.name || '')
 const [iconKey, setIconKey] = useState(initialData?.icon_key || '')
 const [shortDescription, setShortDescription] = useState(initialData?.short_description || '')
 const [description, setDescription] = useState(initialData?.description || '')
 const [basePrice, setBasePrice] = useState(initialData?.base_price?.toString() || '0')
 const [durationMinutes, setDurationMinutes] = useState(initialData?.duration_minutes?.toString() || '')
 const [isActive, setIsActive] = useState(initialData?.is_active ?? true)
 const [displayOrder, setDisplayOrder] = useState(initialData?.display_order?.toString() || '0')
 const [imageUrl, setImageUrl] = useState(initialData?.image_url || '')
 const [metaTitle, setMetaTitle] = useState(initialData?.meta_title || '')
 const [metaDescription, setMetaDescription] = useState(initialData?.meta_description || '')

 const [loading, setLoading] = useState(false)
 const [errors, setErrors] = useState<Record<string, string>>({})
 const [serverError, setServerError] = useState('')

 const isEditing = !!initialData

 const validate = (): boolean => {
 const newErrors: Record<string, string> = {}

 if (!name.trim()) {
 newErrors.name = 'اسم الخدمة مطلوب'
 } else if (name.trim().length > 200) {
 newErrors.name = 'اسم الخدمة طويل جداً'
 }

 const price = parseFloat(basePrice)
 if (isNaN(price) || price < 0) {
 newErrors.basePrice = 'السعر يجب أن يكون صفر أو أكثر'
 }

 if (durationMinutes) {
 const dur = parseInt(durationMinutes)
 if (isNaN(dur) || dur <= 0) {
 newErrors.durationMinutes = 'المدة يجب أن تكون أكبر من صفر'
 }
 }

 if (imageUrl && !/^https?:\/\/.+/.test(imageUrl)) {
 newErrors.imageUrl = 'رابط الصورة غير صحيح'
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
 const { createService, updateService } = await import('@/app/actions/services')

 const serviceData = {
 name: name.trim(),
 icon_key: iconKey || null,
 short_description: shortDescription.trim() || null,
 description: description.trim() || null,
 base_price: parseFloat(basePrice) || 0,
 duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
 is_active: isActive,
 display_order: parseInt(displayOrder) || 0,
 image_url: imageUrl.trim() || null,
 meta_title: metaTitle.trim() || null,
 meta_description: metaDescription.trim() || null,
 }

 const result = isEditing
 ? await updateService(initialData.id, serviceData)
 : await createService(serviceData)

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
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-[#FEF2F2] flex items-center justify-center">
 <FaWrench className="text-[#DC2626] text-xs" />
 </div>
 {isEditing ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
 </h3>
 <button type="button" onClick={onCancel} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>

 {/* Server Error */}
 {serverError && (
 <div className="flex items-center gap-3 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl mb-6">
 <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
 <FaExclamationTriangle className="text-[#DC2626] text-sm" />
 </div>
 <p className="text-red-200 text-sm font-medium">{serverError}</p>
 </div>
 )}

 {/* Basic Info */}
 <div className="mb-6">
 <h4 className="text-sm font-bold text-[#111214] flex items-center gap-2 mb-4">
 <div className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
 <FaInfoCircle className="text-[#2563EB] text-[10px]" />
 </div>
 المعلومات الأساسية
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Name */}
<div>
  <label className="label-light">اسم الخدمة *</label>
<input
  type="text"
  value={name}
  onChange={(e) => setName(e.target.value)}
  className="input-light"
  placeholder="مثال: tinting سيارات"
  />
  {errors.name && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.name}</p>}
  </div>

  {/* Icon */}
  <div className="md:col-span-2">
  <label className="label-light">أيقونة الخدمة</label>
  <p className="text-[#9CA1A6] text-[11px] mb-2">اختر الأيقونة المناسبة لطبيعة الخدمة — هي التي تظهر على بطاقة الخدمة في الموقع.</p>
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
  {ICON_OPTIONS.map((option) => {
  const OptionIcon = option.component
  const selected = iconKey === option.key
  return (
  <button
  key={option.key}
  type="button"
  onClick={() => setIconKey(selected ? '' : option.key)}
  title={option.label}
  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${
  selected
  ? 'bg-[#FEF2F2] border-[#DC2626] text-[#DC2626]'
  : 'bg-white border-[#E7E8EA] text-[#62666D] hover:border-[#DC2626]/40 hover:text-[#DC2626]'
  }`}
  >
  <OptionIcon className="text-lg" />
  <span className="text-[10px] font-semibold leading-tight text-center">{option.label}</span>
  </button>
  )
  })}
  </div>
  </div>

  {/* Short Description */}
 <div className="md:col-span-2">
 <label className="label-light">الوصف المختصر</label>
 <input
 type="text"
 value={shortDescription}
 onChange={(e) => setShortDescription(e.target.value)}
 maxLength={500}
 className="input-light"
 placeholder="وصف مختصر للخدمة"
 />
 </div>

 {/* Description */}
 <div className="md:col-span-2">
 <label className="label-light">الوصف التفصيلي</label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 rows={3}
 className="textarea-light"
 placeholder="وصف تفصيلي للخدمة"
 />
 </div>
 </div>
 </div>

 {/* Pricing & Duration */}
 <div className="mb-6">
 <h4 className="text-sm font-bold text-[#111214] flex items-center gap-2 mb-4">
 <div className="w-6 h-6 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
 <FaSave className="text-[#059669] text-[10px]" />
 </div>
 السعر والمدة
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {/* Base Price */}
 <div>
 <label className="label-light">السعر الأساسي (ر.س) *</label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={basePrice}
 onChange={(e) => setBasePrice(e.target.value)}
 className="input-light"
 placeholder="0"
 />
 {errors.basePrice && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.basePrice}</p>}
 </div>

 {/* Duration */}
 <div>
 <label className="label-light">المدة (دقيقة)</label>
 <input
 type="number"
 min="1"
 value={durationMinutes}
 onChange={(e) => setDurationMinutes(e.target.value)}
 className="input-light"
 placeholder="اختياري"
 />
 {errors.durationMinutes && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.durationMinutes}</p>}
 </div>

 {/* Display Order */}
 <div>
 <label className="label-light">الترتيب</label>
 <input
 type="number"
 value={displayOrder}
 onChange={(e) => setDisplayOrder(e.target.value)}
 className="input-light"
 placeholder="0"
 />
 </div>
 </div>
 </div>

 {/* Media & SEO */}
 <div className="mb-6">
 <h4 className="text-sm font-bold text-[#111214] flex items-center gap-2 mb-4">
 <div className="w-6 h-6 rounded-lg bg-[#FAF5FF] flex items-center justify-center">
 <FaInfoCircle className="text-[#7C3AED] text-[10px]" />
 </div>
 الصورة وتحسين البحث
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Image URL */}
 <div>
 <label className="label-light">رابط الصورة</label>
 <input
 type="url"
 value={imageUrl}
 onChange={(e) => setImageUrl(e.target.value)}
 className="input-light"
 placeholder="https://..."
 />
 {errors.imageUrl && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.imageUrl}</p>}
 </div>

 {/* Meta Title */}
 <div>
 <label className="label-light">عنوان SEO</label>
 <input
 type="text"
 value={metaTitle}
 onChange={(e) => setMetaTitle(e.target.value)}
 maxLength={200}
 className="input-light"
 placeholder="عنوان صفحة الخدمة"
 />
 </div>

 {/* Meta Description */}
 <div className="md:col-span-2">
 <label className="label-light">وصف SEO</label>
 <input
 type="text"
 value={metaDescription}
 onChange={(e) => setMetaDescription(e.target.value)}
 maxLength={500}
 className="input-light"
 placeholder="وصف صفحة الخدمة لمحركات البحث"
 />
 </div>
 </div>
 </div>

 {/* Status */}
 <div className="mb-6">
 <label className="flex items-center gap-3 cursor-pointer">
 <div className="relative">
 <input
 type="checkbox"
 checked={isActive}
 onChange={(e) => setIsActive(e.target.checked)}
 className="peer w-5 h-5 appearance-none rounded-lg border border-[#E7E8EA] checked:bg-gradient-to-br checked:from-red-600 checked:to-red-700 checked:border-red-600 cursor-pointer transition-all duration-200"
 />
 <FaCheckCircle className="absolute inset-0 flex items-center justify-center text-[10px] text-[#111214] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
 </div>
 <span className="text-[#111214] text-sm font-bold">الخدمة نشطة</span>
 </label>
 </div>

 {/* Actions */}
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
