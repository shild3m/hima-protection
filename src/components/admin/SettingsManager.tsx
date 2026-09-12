'use client'

import { useState } from 'react'
import {
 FaCog,
 FaShieldAlt,
 FaDatabase,
 FaServer,
 FaTrash,
 FaSpinner,
 FaTimes,
} from 'react-icons/fa'
import { useAuth } from '@/components/AuthProvider'

export default function SettingsManager() {
 const { staffInfo } = useAuth()
 const isSuperAdmin = staffInfo?.role === 'super_admin'

 const [showTokenSettings, setShowTokenSettings] = useState(false)
 const [currentToken, setCurrentToken] = useState('')
 const [newToken, setNewToken] = useState('')
 const [tokenSettingsLoading, setTokenSettingsLoading] = useState(false)
 const [tokenSettingsError, setTokenSettingsError] = useState('')
 const [tokenSettingsSuccess, setTokenSettingsSuccess] = useState('')

 const handleSaveToken = async () => {
   if (!currentToken.trim() || !newToken.trim()) return
   setTokenSettingsLoading(true)
   setTokenSettingsError('')
   setTokenSettingsSuccess('')
   try {
     const { sha256 } = await import('@/lib/crypto')
     const { setDeleteToken } = await import('@/app/actions/bookings')
     const result = await setDeleteToken(await sha256(currentToken.trim()), await sha256(newToken.trim()))
     if (result.success) {
       setTokenSettingsSuccess('تم تحديث رمز الحذف بنجاح')
       setCurrentToken('')
       setNewToken('')
     } else {
       setTokenSettingsError(result.error || 'حدث خطأ')
     }
   } catch {
     setTokenSettingsError('حدث خطأ غير متوقع')
   } finally {
     setTokenSettingsLoading(false)
   }
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="mb-6">
 <h1 className="text-2xl font-black text-[#111214]">الإعدادات</h1>
 <p className="text-[#62666D] text-sm mt-1">إعدادات النظام</p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626]">
 <FaShieldAlt className="text-sm" />
 </div>
 <h3 className="text-[#111214] font-black">الأمان</h3>
 </div>
 <p className="text-[#62666D] text-xs">إدارة كلمات المرور والصلاحيات</p>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center text-[#2563EB]">
 <FaCog className="text-sm" />
 </div>
 <h3 className="text-[#111214] font-black">النظام</h3>
 </div>
 <p className="text-[#62666D] text-xs">إعدادات النظام العامة</p>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center text-[#7C3AED]">
 <FaDatabase className="text-sm" />
 </div>
 <h3 className="text-[#111214] font-black">قاعدة البيانات</h3>
 </div>
 <p className="text-[#62666D] text-xs">معلومات قاعدة البيانات</p>
 </div>

 <div className="bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-[#D97706]">
 <FaServer className="text-sm" />
 </div>
 <h3 className="text-[#111214] font-black">الخادم</h3>
 </div>
 <p className="text-[#62666D] text-xs">معلومات الخادم والأداء</p>
 </div>
 </div>

 {isSuperAdmin && (
 <div className="mt-4 bg-white border border-[#E7E8EA] shadow-sm rounded-2xl p-6">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626]">
 <FaTrash className="text-sm" />
 </div>
 <div>
 <h3 className="text-[#111214] font-black">رمز حذف الحجوزات</h3>
 <p className="text-[#62666D] text-xs mt-0.5">يُطلب عند الحذف النهائي لأي حجز</p>
 </div>
 </div>
 <button
 onClick={() => setShowTokenSettings(true)}
 className="px-4 py-2 bg-[#111214] hover:bg-[#1A1C22] text-white rounded-xl text-sm font-bold transition-all"
 >
 تغيير الرمز
 </button>
 </div>
 </div>
 )}

 {showTokenSettings && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowTokenSettings(false)}>
 <div className="bg-white border border-[#E7E8EA] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-base font-bold text-[#111214] flex items-center gap-2">
 <FaTrash className="text-[#DC2626] text-sm" />
 الرمز الخاص
 </h3>
 <button onClick={() => setShowTokenSettings(false)} className="text-[#62666D] hover:text-[#111214] transition">
 <FaTimes />
 </button>
 </div>

 {tokenSettingsSuccess && (
 <div className="mb-4 p-3 bg-[#ECFDF5] rounded-xl border border-[#A7F3D0] text-xs text-[#059669] font-bold">
 {tokenSettingsSuccess}
 </div>
 )}
 {tokenSettingsError && (
 <div className="mb-4 p-3 bg-[#FEF2F2] rounded-xl border border-[#FECACA] text-xs text-[#DC2626] font-bold">
 {tokenSettingsError}
 </div>
 )}

 <div className="mb-4">
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الرمز الحالي *</label>
 <input
 type="password"
 value={currentToken}
 onChange={e => { setCurrentToken(e.target.value); setTokenSettingsError(''); setTokenSettingsSuccess('') }}
 className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]"
 placeholder="الرمز الحالي..."
 autoFocus
 />
 </div>

 <div className="mb-4">
 <label className="text-xs font-bold text-[#62666D] mb-1 block">الرمز الجديد *</label>
 <input
 type="password"
 value={newToken}
 onChange={e => { setNewToken(e.target.value); setTokenSettingsError(''); setTokenSettingsSuccess('') }}
 className="w-full bg-white border border-[#E7E8EA] rounded-xl px-3 py-2.5 text-sm text-[#111214] focus:outline-none focus:border-[#DC2626]"
 placeholder="رمز سري جديد..."
 />
 </div>

 <div className="flex gap-3">
 <button
 onClick={handleSaveToken}
 disabled={!currentToken.trim() || !newToken.trim() || tokenSettingsLoading}
 className="flex-1 px-4 py-2.5 bg-[#DC2626] hover:bg-[#9B1B30] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {tokenSettingsLoading ? <><FaSpinner className="animate-spin" /> جاري الحفظ...</> : 'حفظ الرمز'}
 </button>
 <button
 onClick={() => setShowTokenSettings(false)}
 className="px-4 py-2.5 bg-[#F7F7F5] hover:bg-[#F1F2F3] border border-[#E7E8EA] text-[#111214] rounded-xl text-sm font-bold transition-all"
 >
 إغلاق
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}