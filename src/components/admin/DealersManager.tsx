'use client'

import { useState, useEffect, useCallback } from 'react'
import {
 FaSearch,
 FaEye,
 FaTimes,
 FaSpinner,
 FaBoxOpen,
} from 'react-icons/fa'

interface Dealer {
 id: string
 business_name: string
 phone: string
 email: string | null
 status: string
 is_active: boolean
 referral_count?: number
 created_at: string
}

interface Referral {
 id: string
 referral_code: string
 customer_name: string
 customer_phone: string
 status: string
 dealer_id: string
 created_at: string
}

export default function DealersManager() {
 const [dealers, setDealers] = useState<Dealer[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
 const [dealerReferrals, setDealerReferrals] = useState<Referral[]>([])
 const [loadingReferrals, setLoadingReferrals] = useState(false)

 const loadDealers = useCallback(async () => {
 setLoading(true)
 try {
 const { getDealers } = await import('@/app/actions/dealer')
 const result = await getDealers({ search: search || undefined })
 if ('data' in result) setDealers(result.data || [])
 } finally {
 setLoading(false)
 }
 }, [search])

 useEffect(() => { loadDealers() }, [loadDealers])

 const loadDealerReferrals = async (dealerId: string) => {
 setLoadingReferrals(true)
 try {
 const { getReferrals } = await import('@/app/actions/referral')
 const result = await getReferrals({ dealer_id: dealerId })
 if ('data' in result) setDealerReferrals(result.data || [])
 } finally {
 setLoadingReferrals(false)
 }
 }

 const handleViewDealer = (dealer: Dealer) => {
 setSelectedDealer(dealer)
 loadDealerReferrals(dealer.id)
 }

 const statusBadge = (status: string) => {
 const map: Record<string, { bg: string; label: string }> = {
 active: { bg: 'bg-[#ECFDF5] text-[#059669]', label: 'نشط' },
 inactive: { bg: 'bg-[#F1F2F3] text-[#62666D]', label: 'غير نشط' },
 suspended: { bg: 'bg-[#FEF2F2] text-[#DC2626]', label: 'معلق' },
 }
 const s = map[status] || map.active
 return (
 <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${s.bg}`}>{s.label}</span>
 )
 }

 const referralStatusBadge = (status: string) => {
 const map: Record<string, string> = {
 created: 'bg-[#EFF6FF] text-[#2563EB]',
 contacted: 'bg-[#FFFBEB] text-[#D97706]',
 redeemed: 'bg-[#ECFDF5] text-[#059669]',
 completed: 'bg-[#ECFDF5] text-[#059669]',
 cancelled: 'bg-[#FEF2F2] text-[#DC2626]',
 expired: 'bg-[#F1F2F3] text-[#62666D]',
 }
 return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${map[status] || map.created}`}>{status}</span>
 }

 return (
 <div className="p-4 md:p-6 lg:p-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-black text-[#111214]">الوكلاء</h1>
 <p className="text-[#62666D] text-sm mt-1">إدارة الوكلاء والإحالات</p>
 </div>
 </div>

 <div className="mb-4">
 <div className="relative">
 <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D] text-sm" />
 <input
 type="text"
 placeholder="بحث بالاسم أو الهاتف..."
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
 ) : dealers.length === 0 ? (
 <div className="p-12 text-center">
 <FaBoxOpen className="text-[#62666D] text-3xl mx-auto mb-2" />
 <p className="text-[#62666D] text-sm">لا يوجد وكلاء</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[#E7E8EA]">
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الاسم</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الهاتف</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الحالة</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">الإحالات</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">تاريخ الإنشاء</th>
 <th className="text-right px-4 py-3 text-[#62666D] font-bold text-xs">إجراءات</th>
 </tr>
 </thead>
 <tbody>
 {dealers.map(dealer => (
 <tr key={dealer.id} className="border-b border-[#E7E8EA] hover:bg-[#F1F2F3]">
 <td className="px-4 py-3 text-[#111214] font-bold">{dealer.business_name}</td>
 <td className="px-4 py-3 text-[#111214]">{dealer.phone}</td>
 <td className="px-4 py-3">{statusBadge(dealer.status)}</td>
 <td className="px-4 py-3 text-[#111214]">{dealer.referral_count || 0}</td>
 <td className="px-4 py-3 text-[#62666D] text-xs">
 {new Date(dealer.created_at).toLocaleDateString('ar-SA')}
 </td>
 <td className="px-4 py-3">
 <button
 onClick={() => handleViewDealer(dealer)}
 className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D] hover:text-[#111214]"
 >
 <FaEye className="text-xs" />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {selectedDealer && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white border border-[#E7E8EA] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
 <h3 className="text-[#111214] font-black">{selectedDealer.business_name}</h3>
 <button onClick={() => setSelectedDealer(null)} className="p-1.5 rounded-lg hover:bg-[#F1F2F3] text-[#62666D]">
 <FaTimes className="text-sm" />
 </button>
 </div>
 <div className="p-6 overflow-y-auto max-h-[60vh]">
 <div className="grid grid-cols-2 gap-4 mb-6">
 <div>
 <p className="text-[#62666D] text-xs mb-1">الهاتف</p>
 <p className="text-[#111214] text-sm font-bold">{selectedDealer.phone}</p>
 </div>
 <div>
 <p className="text-[#62666D] text-xs mb-1">البريد الإلكتروني</p>
 <p className="text-[#111214] text-sm font-bold">{selectedDealer.email || '—'}</p>
 </div>
 <div>
 <p className="text-[#62666D] text-xs mb-1">الحالة</p>
 {statusBadge(selectedDealer.status)}
 </div>
 <div>
 <p className="text-[#62666D] text-xs mb-1">الإحالات</p>
 <p className="text-[#111214] text-sm font-bold">{selectedDealer.referral_count || 0}</p>
 </div>
 </div>

 <h4 className="text-[#111214] font-black text-sm mb-3">الإحالات الأخيرة</h4>
 {loadingReferrals ? (
 <FaSpinner className="animate-spin text-[#DC2626] mx-auto" />
 ) : dealerReferrals.length === 0 ? (
 <p className="text-[#62666D] text-sm text-center py-4">لا توجد إحالات</p>
 ) : (
 <div className="space-y-2">
 {dealerReferrals.map(r => (
 <div key={r.id} className="bg-white border border-[#E7E8EA] shadow-sm rounded-xl p-3 flex items-center justify-between">
 <div>
 <p className="text-[#111214] text-sm font-bold">{r.customer_name}</p>
 <p className="text-[#62666D] text-xs">{r.customer_phone}</p>
 </div>
 {referralStatusBadge(r.status)}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
