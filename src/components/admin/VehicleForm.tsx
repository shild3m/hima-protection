'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaSave,
 FaTimes,
 FaCar,
 FaExclamationTriangle,
 FaSearch,
 FaSpinner,
} from 'react-icons/fa'

interface Vehicle {
 id: string
 customer_id: string
 make: string
 model: string
 year: number | null
 color: string | null
 plate_number: string | null
 vin: string | null
 notes: string | null
 is_active: boolean
 customer?: {
 id: string
 full_name: string
 phone: string
 }
}

interface CustomerOption {
 id: string
 full_name: string
 phone: string
}

interface VehicleFormProps {
 initialData?: Vehicle | null
 onCancel: () => void
 onSaved: () => void
}

export function VehicleForm({ initialData, onCancel, onSaved }: VehicleFormProps) {
 const [customerId, setCustomerId] = useState(initialData?.customer_id || '')
 const [make, setMake] = useState(initialData?.make || '')
 const [model, setModel] = useState(initialData?.model || '')
 const [year, setYear] = useState(initialData?.year?.toString() || '')
 const [color, setColor] = useState(initialData?.color || '')
 const [plateNumber, setPlateNumber] = useState(initialData?.plate_number || '')
 const [vin, setVin] = useState(initialData?.vin || '')
 const [notes, setNotes] = useState(initialData?.notes || '')
 const [isActive, setIsActive] = useState(initialData?.is_active ?? true)

 const [loading, setLoading] = useState(false)
 const [errors, setErrors] = useState<Record<string, string>>({})
 const [serverError, setServerError] = useState('')

 const [customerSearch, setCustomerSearch] = useState('')
 const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
 const [searchingCustomers, setSearchingCustomers] = useState(false)
 const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

 const isEditing = !!initialData

 const searchCustomers = useCallback(async (query: string) => {
 if (!query.trim()) {
 setCustomerOptions([])
 return
 }
 setSearchingCustomers(true)
 try {
 const { getCustomers } = await import('@/app/actions/customers')
 const result = await getCustomers(query, 1, 10)
 if (result.success) {
 setCustomerOptions(result.data.map((c: { id: string; full_name: string; phone: string }) => ({ id: c.id, full_name: c.full_name, phone: c.phone })))
 }
 } catch {
 } finally {
 setSearchingCustomers(false)
 }
 }, [])

 useEffect(() => {
 const t = setTimeout(() => {
 searchCustomers(customerSearch)
 }, 300)
 return () => clearTimeout(t)
 }, [customerSearch, searchCustomers])

 useEffect(() => {
 if (initialData?.customer) {
 setCustomerOptions([initialData.customer])
 }
 }, [initialData?.customer])

 const validate = (): boolean => {
 const newErrors: Record<string, string> = {}

 if (!customerId) {
 newErrors.customerId = 'يجب اختيار العميل'
 }

 if (!make.trim()) {
 newErrors.make = 'شركة الصنع مطلوبة'
 } else if (make.trim().length > 100) {
 newErrors.make = 'اسم الشركة طويل جداً'
 }

 if (!model.trim()) {
 newErrors.model = 'الموديل مطلوب'
 } else if (model.trim().length > 100) {
 newErrors.model = 'اسم الموديل طويل جداً'
 }

 if (year) {
 const yearNum = parseInt(year)
 if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) {
 newErrors.year = 'السنة غير صحيحة'
 }
 }

 if (vin.trim() && vin.trim().length > 17) {
 newErrors.vin = 'رقم الهيكل أطول من 17 حرفاً'
 }

 if (plateNumber.trim() && plateNumber.trim().length > 20) {
 newErrors.plateNumber = 'رقم اللوحة طويل جداً'
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
 const { createVehicle, updateVehicle } = await import('@/app/actions/vehicles')

 const vehicleData = {
 customer_id: customerId,
 make: make.trim(),
 model: model.trim(),
 year: year ? parseInt(year) : null,
 color: color.trim() || null,
 plate_number: plateNumber.trim() || null,
 vin: vin.trim() || null,
 notes: notes.trim() || null,
 is_active: isActive,
 }

 const result = isEditing
 ? await updateVehicle(initialData.id, vehicleData)
 : await createVehicle(vehicleData)

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
 <FaCar className="text-[#DC2626] text-xs" />
 </div>
 {isEditing ? 'تعديل بيانات المركبة' : 'إضافة مركبة جديدة'}
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

 <div className="mb-6">
 <label className="label-light">العميل *</label>
 <div className="relative">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 value={showCustomerDropdown ? customerSearch : (initialData?.customer?.full_name || customerOptions.find(c => c.id === customerId)?.full_name || '')}
 onChange={(e) => {
 setCustomerSearch(e.target.value)
 setShowCustomerDropdown(true)
 if (customerId) {
 setCustomerId('')
 }
 }}
 onFocus={() => { setShowCustomerDropdown(true); setCustomerSearch('') }}
 className={`w-full px-4 py-3 bg-[#F7F7F5] border ${errors.customerId ? 'border-[#DC2626]' : 'border-[#E7E8EA]'} text-[#111214] rounded-xl focus:border-[#FECACA] focus:ring-2 focus:ring-red-500/20 outline-none transition-all placeholder:text-[15px] placeholder:text-[#62666D] text-[15px] pr-10`}
 placeholder="بحث بالاسم أو رقم الجوال..."
 />
 {searchingCustomers && (
 <FaSpinner className="absolute left-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm animate-spin" />
 )}
 {showCustomerDropdown && customerOptions.length > 0 && (
 <div className="absolute top-full mt-1 w-full bg-white border border-[#E7E8EA] rounded-xl shadow-2xl z-10 max-h-48 overflow-y-auto">
 {customerOptions.map((c) => (
 <button
 key={c.id}
 type="button"
 onClick={() => {
 setCustomerId(c.id)
 setCustomerSearch('')
 setShowCustomerDropdown(false)
 }}
 className="w-full text-right px-4 py-3 hover:bg-[#F1F2F3] transition text-sm flex items-center justify-between"
 >
 <span className="text-[#111214] font-bold">{c.full_name}</span>
 <span className="text-[#62666D] text-xs" dir="ltr">{c.phone}</span>
 </button>
 ))}
 </div>
 )}
 {showCustomerDropdown && customerSearch && customerOptions.length === 0 && !searchingCustomers && (
 <div className="absolute top-full mt-1 w-full bg-white border border-[#E7E8EA] rounded-xl shadow-2xl z-10 p-4 text-center">
 <p className="text-[#62666D] text-sm">لا توجد نتائج</p>
 </div>
 )}
 </div>
 {errors.customerId && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.customerId}</p>}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
 <div>
 <label className="label-light">شركة الصنع *</label>
 <input
 type="text"
 value={make}
 onChange={(e) => setMake(e.target.value)}
 className="input-light"
 placeholder="مثال: Toyota, BMW"
 />
 {errors.make && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.make}</p>}
 </div>

 <div>
 <label className="label-light">الموديل *</label>
 <input
 type="text"
 value={model}
 onChange={(e) => setModel(e.target.value)}
 className="input-light"
 placeholder="مثال: Camry, X5"
 />
 {errors.model && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.model}</p>}
 </div>

 <div>
 <label className="label-light">السنة</label>
 <input
 type="number"
 min="1900"
 max={new Date().getFullYear() + 2}
 value={year}
 onChange={(e) => setYear(e.target.value)}
 className="input-light"
 placeholder="2024"
 />
 {errors.year && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.year}</p>}
 </div>

 <div>
 <label className="label-light">اللون</label>
 <input
 type="text"
 value={color}
 onChange={(e) => setColor(e.target.value)}
 className="input-light"
 placeholder="مثال: أبيض, أسود"
 />
 </div>

 <div>
 <label className="label-light">رقم اللوحة</label>
 <input
 type="text"
 value={plateNumber}
 onChange={(e) => setPlateNumber(e.target.value)}
 className="input-light"
 placeholder="أ ب ج 1234"
 />
 {errors.plateNumber && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.plateNumber}</p>}
 </div>

 <div>
 <label className="label-light">رقم الهيكل (VIN)</label>
 <input
 type="text"
 value={vin}
 onChange={(e) => setVin(e.target.value)}
 maxLength={17}
 className="input-light"
 placeholder="17 حرفاً"
 />
 {errors.vin && <p className="text-[#DC2626] text-xs mt-1 flex items-center gap-1"><FaExclamationTriangle className="text-[8px]" />{errors.vin}</p>}
 </div>
 </div>

 <div className="mb-6">
 <label className="label-light">ملاحظات</label>
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={3}
 className="textarea-light"
 placeholder="ملاحظات إضافية عن المركبة (اختياري)"
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
 <span className="text-[#111214] text-sm font-bold">المركبة نشطة</span>
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
