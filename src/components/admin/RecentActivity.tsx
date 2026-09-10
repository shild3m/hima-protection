'use client'

import { useEffect, useState, useCallback } from 'react'
import { FaCalendarCheck, FaMoneyBillWave, FaHandshake, FaUsers, FaFileInvoiceDollar, FaSync, FaInbox } from 'react-icons/fa'
import { getRecentActivity, type RecentActivityItem } from '@/app/actions/dashboard'

const ICON_MAP: Record<string, React.ReactNode> = {
  calendar: <FaCalendarCheck />,
  money: <FaMoneyBillWave />,
  handshake: <FaHandshake />,
  user: <FaUsers />,
  invoice: <FaFileInvoiceDollar />,
}

const COLOR_MAP: Record<string, string> = {
  booking: 'bg-[#10B981]/8 text-[#059669]',
  payment: 'bg-[#8B5CF6]/8 text-[#7C3AED]',
  referral: 'bg-[#06B6D4]/8 text-[#0891B2]',
  customer: 'bg-[#3B82F6]/8 text-[#2563EB]',
  invoice: 'bg-[#F59E0B]/8 text-[#D97706]',
}

function timeAgo(ts: string) {
  const now = Date.now()
  const diff = now - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} س`
  const days = Math.floor(hrs / 24)
  return `منذ ${days} ي`
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="جاري تحميل النشاطات">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-9 h-9 rounded-lg bg-[#F1F2F3]" />
          <div className="flex-1 space-y-1.5">
            <div className="w-24 h-3 bg-[#F1F2F3] rounded" />
            <div className="w-32 h-2.5 bg-[#F1F2F3] rounded" />
          </div>
          <div className="w-12 h-2.5 bg-[#F1F2F3] rounded" />
        </div>
      ))}
    </div>
  )
}

export default function RecentActivity() {
  const [res, setRes] = useState<{ success: boolean; data?: RecentActivityItem[]; error?: string } | null>(null)
  const [isPending, setIsPending] = useState(false)

  const load = useCallback(async () => {
    setIsPending(true)
    const r = await getRecentActivity(10)
    setRes(r)
    setIsPending(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!res) {
    return <ActivitySkeleton />
  }

  if (!res.success) {
    return (
      <section className="card-light p-5" aria-label="آخر النشاطات">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#111214] font-black text-sm">آخر النشاطات</h3>
        </div>
        <div className="text-center py-6" role="alert">
          <p className="text-[#DC2626] text-xs font-bold mb-2">{res.error || 'فشل تحميل النشاط'}</p>
          <button
            onClick={load}
            className="text-[#DC2626] hover:text-[#B91C1C] text-xs font-bold flex items-center gap-1 mx-auto"
            aria-label="إعادة تحميل النشاطات"
          >
            <FaSync className="text-[10px]" /> إعادة المحاولة
          </button>
        </div>
      </section>
    )
  }

  const activities = res.data || []

  return (
    <section className={`card-light p-5 ${isPending ? 'opacity-50 pointer-events-none' : ''}`} aria-label="آخر النشاطات">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#111214] font-black text-sm">آخر النشاطات</h3>
        <button
          onClick={load}
          className="text-[#62666D] hover:text-[#111214] transition-colors"
          aria-label="تحديث النشاطات"
        >
          <FaSync className="text-xs" />
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <FaInbox className="text-[#E7E8EA] text-2xl mx-auto mb-2" aria-hidden="true" />
          <p className="text-[#62666D] text-xs">لا توجد نشاطات حديثة</p>
        </div>
      ) : (
        <ul className="space-y-1" role="list" aria-label="قائمة النشاطات">
          {activities.map(item => (
            <li
              key={`${item.type}-${item.id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F1F2F3] transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg ${COLOR_MAP[item.type] || 'bg-[#F1F2F3] text-[#62666D]'} flex items-center justify-center text-xs flex-shrink-0`} aria-hidden="true">
                {ICON_MAP[item.icon] || <FaCalendarCheck />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#111214] text-xs font-bold truncate">{item.title}</p>
                <p className="text-[#62666D] text-[10px] truncate">{item.description}</p>
              </div>
              <time className="text-[#62666D] text-[10px] flex-shrink-0" dateTime={item.timestamp}>
                {timeAgo(item.timestamp)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export { ActivitySkeleton as RecentActivitySkeleton }
