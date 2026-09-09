'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { ServiceForm } from '@/components/admin/ServiceForm'
import {
 FaWrench,
 FaSearch,
 FaPlus,
 FaPen,
 FaTrash,
 FaEye,
 FaEyeSlash,
 FaCheck,
 FaTimes,
 FaExclamationTriangle,
 FaSpinner,
 FaBoxOpen,
 FaClock,
 FaMoneyBillWave,
} from 'react-icons/fa'

interface Service {
 id: string
 name: string
 slug: string
 short_description: string | null
 description: string | null
 base_price: number
 duration_minutes: number | null
 is_active: boolean
 display_order: number
 image_url: string | null
 meta_title: string | null
 meta_description: string | null
 created_at: string
 updated_at: string
}

type Notification = { type: 'success' | 'error'; message: string } | null

export default function ServicesManager() {
 const { hasPermission } = useAuth()
 const [services, setServices] = useState<Service[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [notification, setNotification] = useState<Notification>(null)
 const [showForm, setShowForm] = useState(false)
 const [editingService, setEditingService] = useState<Service | null>(null)
 const [viewingService, setViewingService] = useState<Service | null>(null)
 const [deletingService, setDeletingService] = useState<Service | null>(null)
 const [togglingId, setTogglingId] = useState<string | null>(null)

 const canCreate = hasPermission('services', 'create')
 const canUpdate = hasPermission('services', 'update')
 const canDelete = hasPermission('services', 'delete')

 const fetchServices = useCallback(async () => {
 try {
 const { getServices } = await import('@/app/actions/services')
 const result = await getServices(search)
 if (result.success) {
 setServices(result.data)
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'تعذر جلب الخدمات' })
 } finally {
 setLoading(false)
 }
 }, [search])

 useEffect(() => {
 fetchServices()
 }, [fetchServices])

 useEffect(() => {
 if (!notification) return
 const t = setTimeout(() => setNotification(null), 4000)
 return () => clearTimeout(t)
 }, [notification])

 const handleToggle = async (id: string) => {
 setTogglingId(id)
 try {
 const { toggleServiceStatus } = await import('@/app/actions/services')
 const result = await toggleServiceStatus(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم تغيير الحالة بنجاح' })
 fetchServices()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 } finally {
 setTogglingId(null)
 }
 }

 const handleDelete = async (id: string) => {
 try {
 const { deleteService } = await import('@/app/actions/services')
 const result = await deleteService(id)
 if (result.success) {
 setNotification({ type: 'success', message: 'تم حذف الخدمة بنجاح' })
 setDeletingService(null)
 fetchServices()
 } else {
 setNotification({ type: 'error', message: result.error })
 }
 } catch {
 setNotification({ type: 'error', message: 'حدث خطأ غير متوقع' })
 }
 }

 const filteredServices = services

 return (
 <div className="p-4 md:p-6 lg:p-8">
 {/* Notification Toast */}
 {notification && (
 <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 animate-bounceIn ${
 notification.type === 'success'
 ? 'bg-[#ECFDF5] border-[#A7F3D0] text-green-300'
 : 'bg-[#FEF2F2] border-[#FECACA] text-red-300'
 }`}>
 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
 notification.type === 'success' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
 }`}>
 {notification.type === 'success' ? <FaCheck /> : <FaExclamationTriangle />}
 </div>
 {notification.message}
 <button onClick={() => setNotification(null)} className="mr-4 opacity-60 hover:opacity-100 transition">
 <FaTimes className="text-xs" />
 </button>
 </div>
 )}

 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214] flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
 <FaWrench className="text-[#DC2626] text-sm" />
 </div>
 إدارة الخدمات
 </h1>
 <p className="text-[#62666D] text-sm mt-1 mr-11">إضافة وتعديل وإدارة الخدمات</p>
 </div>
 {canCreate && (
 <button
 onClick={() => { setShowForm(!showForm); setEditingService(null) }}
 className={`font-bold text-sm transition-all rounded-xl px-5 py-2.5 flex items-center gap-2 ${
 showForm || editingService
 ? 'bg-white/[0.05] text-[#111214] hover:bg-[#F1F2F3] border border-[#E7E8EA]'
 : 'bg-gradient-to-l from-red-600 to-red-700 text-white hover:shadow-lg hover:shadow-red-900/20 border-0'
 }`}
 >
 {showForm || editingService ? <FaTimes className="text-xs" /> : <FaPlus className="text-xs" />}
 {showForm || editingService ? 'إلغاء' : 'إضافة خدمة جديدة'}
 </button>
 )}
 </div>

 {/* Form */}
 {(showForm || editingService) && (
 <div className="mb-6 animate-fadeIn">
 <ServiceForm
 key={editingService?.id || 'new'}
 initialData={editingService}
 onCancel={() => { setEditingService(null); setShowForm(false) }}
 onSaved={() => { setEditingService(null); setShowForm(false); fetchServices(); setNotification({ type: 'success', message: editingService ? 'تم تحديث الخدمة بنجاح' : 'تم إنشاء الخدمة بنجاح' }) }}
 />
 </div>
 )}

 {/* Search */}
 <div className="mb-4">
 <div className="relative max-w-md">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو الوصف..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-white border border-[#E7E8EA] shadow-sm rounded-xl pr-10 pl-4 py-2.5 text-[#111214] text-sm focus:outline-none focus:border-[#FECACA] placeholder:text-[#62666D]"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#111214] transition">
 <FaTimes className="text-xs" />
 </button>
 )}
 </div>
 </div>

 {/* Service List */}
 {loading ? (
 <div className="flex items-center justify-center py-16">
 <div className="flex flex-col items-center gap-4">
 <div className="w-10 h-10 border-2 border-[#FECACA] border-t-red-500 rounded-full animate-spin"></div>
 <span className="text-sm text-[#62666D]">جاري التحميل...</span>
 </div>
 </div>
 ) : filteredServices.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-[#62666D]">
 <div className="w-16 h-16 rounded-2xl bg-[#F7F7F5] border border-[#E7E8EA] flex items-center justify-center mb-4">
 <FaBoxOpen className="text-2xl text-[#62666D]" />
 </div>
 <p className="font-bold">لا توجد خدمات مضافة بعد</p>
 <p className="text-xs text-[#62666D] mt-1">أضف خدمة جديدة من الزر أعلاه</p>
 </div>
 ) : (
 <div className="grid gap-3">
 {filteredServices.map((service) => (
 <div
 key={service.id}
 className="group bg-white border border-[#E7E8EA] hover:border-[#E7E8EA] rounded-xl p-3 sm:p-4 flex items-center justify-between transition-all duration-200"
 >
 <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
 <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border ${
 service.is_active
 ? 'bg-[#FEF2F2] border-[#FECACA]'
 : 'bg-[#F7F7F5] border-[#E7E8EA]'
 }`}>
 <FaWrench className={`text-[11px] sm:text-sm ${service.is_active ? 'text-[#DC2626]' : 'text-[#62666D]'}`} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="text-[#111214] font-bold text-xs sm:text-sm truncate">{service.name}</h4>
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
 service.is_active
 ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
 : 'bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]'
 }`}>
 {service.is_active ? 'نشط' : 'معطّل'}
 </span>
 </div>
 <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-[#62666D]">
 {service.short_description && (
 <span className="truncate max-w-[200px]">{service.short_description}</span>
 )}
 {service.short_description && <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>}
 <span className="flex items-center gap-1">
 <FaMoneyBillWave className="text-[#059669]/60 text-[10px]" />
 <span className="font-bold text-[#111214]">{Number(service.base_price).toLocaleString()}</span>
 <span className="text-[10px] text-[#62666D] font-normal">ر.س</span>
 </span>
 {service.duration_minutes && (
 <>
 <span className="w-1 h-1 rounded-full bg-[#E7E8EA]"></span>
 <span className="flex items-center gap-1">
 <FaClock className="text-[#2563EB]/60 text-[10px]" />
 {service.duration_minutes} دقيقة
 </span>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="flex gap-1.5 sm:gap-2 shrink-0 mr-2 sm:mr-4">
 <button
 onClick={() => setViewingService(viewingService?.id === service.id ? null : service)}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaEye className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">عرض</span>
 </button>
 {canUpdate && (
 <button
 onClick={() => { setEditingService(service); setShowForm(false) }}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#EFF6FF] hover:bg-blue-500/20 border border-[#BFDBFE] text-blue-300 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaPen className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">تعديل</span>
 </button>
 )}
 {canUpdate && (
 <button
 onClick={() => handleToggle(service.id)}
 disabled={togglingId === service.id}
 className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1 disabled:opacity-50 ${
 service.is_active
 ? 'bg-[#FFFBEB] hover:bg-[#FFFBEB] border border-[#FDE68A] text-amber-300'
 : 'bg-[#ECFDF5] hover:bg-[#ECFDF5] border border-[#A7F3D0] text-green-300'
 }`}
 >
 {togglingId === service.id ? (
 <FaSpinner className="text-[9px] sm:text-[10px] animate-spin" />
 ) : service.is_active ? (
 <FaEyeSlash className="text-[9px] sm:text-[10px]" />
 ) : (
 <FaEye className="text-[9px] sm:text-[10px]" />
 )}
 <span className="hidden sm:inline">{service.is_active ? 'تعطيل' : 'تفعيل'}</span>
 </button>
 )}
 {canDelete && (
 <button
 onClick={() => setDeletingService(service)}
 className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#FEF2F2] hover:bg-[#FEF2F2] border border-[#FECACA] text-red-300 rounded-lg text-[10px] sm:text-xs font-bold transition-all hover:scale-105 flex items-center gap-1"
 >
 <FaTrash className="text-[9px] sm:text-[10px]" />
 <span className="hidden sm:inline">حذف</span>
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* View Service Modal */}
 {viewingService && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setViewingService(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-[#111214] flex items-center gap-2">
 <FaWrench className="text-[#DC2626] text-sm" />
 تفاصيل الخدمة
 </h3>
 <button onClick={() => setViewingService(null)} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>
 <div className="space-y-3">
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الاسم:</span>
 <span className="text-[#111214] font-bold">{viewingService.name}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">المختصر:</span>
 <span className="text-[#111214] font-bold">{viewingService.slug}</span>
 </div>
 {viewingService.short_description && (
 <div className="text-sm">
 <span className="text-[#62666D]">الوصف المختصر:</span>
 <p className="text-[#111214] mt-1">{viewingService.short_description}</p>
 </div>
 )}
 {viewingService.description && (
 <div className="text-sm">
 <span className="text-[#62666D]">الوصف:</span>
 <p className="text-[#111214] mt-1">{viewingService.description}</p>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">السعر:</span>
 <span className="text-[#111214] font-bold">{Number(viewingService.base_price).toLocaleString()} ر.س</span>
 </div>
 {viewingService.duration_minutes && (
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">المدة:</span>
 <span className="text-[#111214] font-bold">{viewingService.duration_minutes} دقيقة</span>
 </div>
 )}
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الحالة:</span>
 <span className={`font-bold ${viewingService.is_active ? 'text-[#059669]' : 'text-[#62666D]'}`}>
 {viewingService.is_active ? 'نشط' : 'معطّل'}
 </span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">الترتيب:</span>
 <span className="text-[#111214] font-bold">{viewingService.display_order}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">تاريخ الإنشاء:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingService.created_at).toLocaleDateString('ar-SA')}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-[#62666D]">آخر تحديث:</span>
 <span className="text-[#111214] font-bold">{new Date(viewingService.updated_at).toLocaleDateString('ar-SA')}</span>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Delete Confirmation Modal */}
 {deletingService && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setDeletingService(null)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
 <FaExclamationTriangle className="text-[#DC2626]" />
 </div>
 <div>
 <h3 className="text-lg font-bold text-[#111214]">حذف الخدمة</h3>
 <p className="text-sm text-[#62666D]">هل أنت متأكد من حذف هذه الخدمة؟</p>
 </div>
 </div>
 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-4 mb-4">
 <p className="text-[#111214] font-bold text-sm">{deletingService.name}</p>
 <p className="text-[#62666D] text-xs mt-1">{deletingService.slug}</p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => setDeletingService(null)}
 className="flex-1 py-2.5 bg-[#F7F7F5] border border-[#E7E8EA] text-[#111214] font-bold rounded-xl hover:bg-[#F1F2F3] transition"
 >
 إلغاء
 </button>
 <button
 onClick={() => handleDelete(deletingService.id)}
 className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
 >
 حذف
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
