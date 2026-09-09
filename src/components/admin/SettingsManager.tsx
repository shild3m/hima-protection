'use client'

import {
 FaCog,
 FaShieldAlt,
 FaDatabase,
 FaServer,
} from 'react-icons/fa'

export default function SettingsManager() {
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
 </div>
 )
}
