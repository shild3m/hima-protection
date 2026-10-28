'use client'

import { useEffect, useRef, useState } from 'react'
import {
 FaSave,
 FaTimes,
 FaWrench,
 FaInfoCircle,
 FaExclamationTriangle,
 FaImage,
 FaTrash,
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
}

interface ServiceFormProps {
 initialData?: Service | null
 onCancel: () => void
 onSaved: () => void
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_IMAGE_SIDE = 1600

async function compressImage(file: File): Promise<File> {
  // Animated GIFs are uploaded untouched so the animation survives.
  if (file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas unavailable')

  // Flatten transparency onto white so PNG screenshots keep a clean background.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
  if (!blob) throw new Error('compression failed')

  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
  })

  return compressed.size < file.size ? compressed : file
}

export function ServiceForm({ initialData, onCancel, onSaved }: ServiceFormProps) {
  const [name, setName] = useState(initialData?.name || '')
 const [iconKey, setIconKey] = useState(initialData?.icon_key || '')
 const [shortDescription, setShortDescription] = useState(initialData?.short_description || '')
 const [description, setDescription] = useState(initialData?.description || '')
 const [basePrice, setBasePrice] = useState(initialData?.base_price?.toString() || '0')
 const [durationMinutes, setDurationMinutes] = useState(initialData?.duration_minutes?.toString() || '')
 const [displayOrder, setDisplayOrder] = useState(initialData?.display_order?.toString() || '0')
 const [isActive, setIsActive] = useState(initialData?.is_active ?? true)
 const [imageUrl, setImageUrl] = useState(initialData?.image_url || '')
 const [pendingImage, setPendingImage] = useState<File | null>(null)
 const [imagePreview, setImagePreview] = useState(initialData?.image_url || '')
 const [imageError, setImageError] = useState('')
 const [processingImage, setProcessingImage] = useState(false)
 const fileInputRef = useRef<HTMLInputElement>(null)

 const [loading, setLoading] = useState(false)
 const [errors, setErrors] = useState<Record<string, string>>({})
 const [serverError, setServerError] = useState('')

 const isEditing = !!initialData

 useEffect(() => {
 return () => {
 if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
 }
 }, [imagePreview])

 const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0]
 event.target.value = ''
 if (!file) return

 setImageError('')

 if (file.type === 'image/heic' || file.type === 'image/heif') {
 setImageError('صيغة HEIC غير مدعومة — حوّل الصورة إلى JPG أولاً')
 return
 }
 if (!file.type.startsWith('image/')) {
 setImageError('اختر ملف صورة صحيح')
 return
 }
 if (file.size > MAX_SOURCE_BYTES) {
 setImageError('حجم الصورة كبير جداً (الحد 15 ميجابايت)')
 return
 }
 if (file.type === 'image/gif' && file.size > MAX_UPLOAD_BYTES) {
 setImageError('حجم صورة GIF يجب أن يكون أقل من 5 ميجابايت')
 return
 }

 setProcessingImage(true)
 try {
 const prepared = await compressImage(file)
 if (prepared.size > MAX_UPLOAD_BYTES) {
 setImageError('حجم الصورة بعد الضغط ما زال كبيراً، جرب صورة أصغر')
 return
 }
 if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
 setPendingImage(prepared)
 setImagePreview(URL.createObjectURL(prepared))
 } catch {
 setImageError('تعذر قراءة الصورة، جرب صورة أخرى')
 } finally {
 setProcessingImage(false)
 }
 }

 const clearImage = () => {
 if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
 setPendingImage(null)
 setImagePreview('')
 setImageUrl('')
 setImageError('')
 if (fileInputRef.current) fileInputRef.current.value = ''
 }

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

 setErrors(newErrors)
 return Object.keys(newErrors).length === 0
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setServerError('')

 if (!validate()) return

 setLoading(true)

 try {
 const { createService, updateService, uploadServiceImage } = await import('@/app/actions/services')

 let finalImageUrl = imageUrl.trim()

 if (pendingImage) {
 const formData = new FormData()
 formData.append('file', pendingImage)
 const uploaded = await uploadServiceImage(formData)
 if (!uploaded.success) {
 setServerError(uploaded.error)
 return
 }
 finalImageUrl = uploaded.url
 // Keep the uploaded URL so a failed save can be retried without uploading twice.
 setImageUrl(uploaded.url)
 setPendingImage(null)
 }

 const serviceData = {
 name: name.trim(),
 icon_key: iconKey || null,
 short_description: shortDescription.trim() || null,
 description: description.trim() || null,
 base_price: parseFloat(basePrice) || 0,
 duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
 is_active: isActive,
 display_order: parseInt(displayOrder) || 0,
 image_url: finalImageUrl || null,
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
  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
  {ICON_OPTIONS.map((option) => {
  const OptionIcon = option.component
  const selected = iconKey === option.key
  return (
  <button
  key={option.key}
  type="button"
  onClick={() => setIconKey(selected ? '' : option.key)}
  title={option.label}
  className={`flex items-center justify-center aspect-square rounded-xl border transition-all ${
  selected
  ? 'bg-[#FEF2F2] border-[#DC2626] text-[#DC2626]'
  : 'bg-white border-[#E7E8EA] text-[#62666D] hover:border-[#DC2626]/40 hover:text-[#DC2626]'
  }`}
  >
  <OptionIcon className="text-lg" />
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
  صورة الخدمة
  </h4>
  <div className="flex flex-col sm:flex-row gap-4 items-start">
  {imagePreview ? (
  <div className="relative w-full sm:w-64 shrink-0">
  <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E7E8EA] bg-[#F7F7F5]">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
  src={imagePreview}
  alt="معاينة صورة الخدمة"
  className="w-full h-full object-cover"
  />
  </div>
  <button
  type="button"
  onClick={clearImage}
  className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold hover:bg-black/80 transition"
  >
  <FaTrash className="text-[10px]" />
  إزالة
  </button>
  </div>
  ) : (
  <button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  disabled={processingImage}
  className="w-full sm:w-64 aspect-[4/3] shrink-0 rounded-xl border-2 border-dashed border-[#E7E8EA] bg-[#F7F7F5] hover:border-[#C4121A]/50 hover:bg-[#FEF2F2] transition flex flex-col items-center justify-center gap-2 text-[#62666D] disabled:opacity-50"
  >
  {processingImage ? (
  <div className="w-6 h-6 border-2 border-[#C4121A]/30 border-t-[#C4121A] rounded-full animate-spin" />
  ) : (
  <FaImage className="text-2xl text-[#C4121A]" />
  )}
  <span className="text-sm font-semibold">
  {processingImage ? 'جاري تجهيز الصورة...' : 'اختر صورة'}
  </span>
  <span className="text-[11px] text-[#9CA1A6]">JPG / PNG / WebP / GIF</span>
  </button>
  )}

  <div className="flex-1 min-w-0">
  <input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif"
  onChange={handleImageSelect}
  className="hidden"
  />
  <p className="text-[#62666D] text-xs leading-6">
  ارفع صورة من جهازك وستظهر مباشرة في بطاقة الخدمة على الموقع.
  </p>
  <ul className="text-[#9CA1A6] text-[11px] leading-6 list-disc pr-4">
  <li>تُقبل الصور حتى 15 ميجابايت وتُصغَّر تلقائياً قبل الرفع.</li>
  <li>صيغ مدعومة: JPG / PNG / WebP / GIF.</li>
  <li>المقاس الأفضل 1200×900 (4:3).</li>
  </ul>
  {imagePreview && (
  <button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  className="mt-2 inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-[#E7E8EA] bg-white hover:bg-[#F7F7F5] transition"
  >
  <FaImage className="text-[#C4121A]" />
  تغيير الصورة
  </button>
  )}
  {imageError && (
  <p className="text-[#DC2626] text-xs mt-2 flex items-center gap-1">
  <FaExclamationTriangle className="text-[8px]" />
  {imageError}
  </p>
  )}
  </div>
  </div>
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
