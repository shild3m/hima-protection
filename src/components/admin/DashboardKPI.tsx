'use client'

import { use, useState, useTransition } from 'react'
import {
  FaCalendarCheck,
  FaUsers,
  FaCar,
  FaCheckCircle,
  FaMoneyBillWave,
  FaReceipt,
  FaHandshake,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaSync,
} from 'react-icons/fa'
import type { DashboardKPIs } from '@/app/actions/dashboard'
import { getDashboardKPIs } from '@/app/actions/dashboard'

interface KPIDef {
  key: keyof DashboardKPIs
  label: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  permission?: string
  format?: 'number' | 'currency'
}

const KPI_CARDS: KPIDef[] = [
  { key: 'bookingsToday', label: 'حجوزات اليوم', icon: <FaCalendarCheck />, iconBg: 'bg-[#10B981]/8', iconColor: 'text-[#059669]', permission: 'bookings:view' },
  { key: 'newCustomers', label: 'عملاء جدد', icon: <FaUsers />, iconBg: 'bg-[#3B82F6]/8', iconColor: 'text-[#2563EB]', permission: 'customers:view' },
  { key: 'carsInService', label: 'سيارات قيد الخدمة', icon: <FaCar />, iconBg: 'bg-[#F59E0B]/8', iconColor: 'text-[#D97706]', permission: 'bookings:view' },
  { key: 'completedServices', label: 'خدمات مكتملة اليوم', icon: <FaCheckCircle />, iconBg: 'bg-[#10B981]/8', iconColor: 'text-[#059669]', permission: 'bookings:view' },
  { key: 'revenue', label: 'إيرادات الشهر', icon: <FaMoneyBillWave />, iconBg: 'bg-[#8B5CF6]/8', iconColor: 'text-[#7C3AED]', permission: 'invoices:view', format: 'currency' },
  { key: 'pendingPayments', label: 'مدفوعات معلقة', icon: <FaReceipt />, iconBg: 'bg-[#EF4444]/8', iconColor: 'text-[#DC2626]', permission: 'invoices:view', format: 'currency' },
  { key: 'totalReferrals', label: 'إجمالي الإحالات', icon: <FaHandshake />, iconBg: 'bg-[#06B6D4]/8', iconColor: 'text-[#0891B2]', permission: 'referrals:view' },
  { key: 'pendingCommissions', label: 'عمولات معلقة', icon: <FaExchangeAlt />, iconBg: 'bg-[#F97316]/8', iconColor: 'text-[#EA580C]', permission: 'commissions:view', format: 'currency' },
  { key: 'lowStock', label: 'مخزون منخفض', icon: <FaExclamationTriangle />, iconBg: 'bg-[#EF4444]/8', iconColor: 'text-[#DC2626]', permission: 'materials:view' },
]

interface DashboardKPIProps {
  permissions: string[]
}

function Skeleton({ permissions }: DashboardKPIProps) {
  const visibleCards = KPI_CARDS.filter(c => !c.permission || permissions.includes(c.permission))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="جاري تحميل مؤشرات الأداء">
      {visibleCards.map(card => (
        <div key={card.key} className="card-light p-5 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}>
              {card.icon}
            </div>
            <div className="w-16 h-6 bg-[#F1F2F3] rounded-lg" />
          </div>
          <p className="text-[#62666D] text-xs mb-1">{card.label}</p>
          <div className="w-20 h-8 bg-[#F1F2F3] rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function formatValue(value: number, format?: string) {
  if (format === 'currency') {
    return `${value.toLocaleString('ar-SA')} ر.س`
  }
  return value.toLocaleString('ar-SA')
}

export default function DashboardKPI({ permissions }: DashboardKPIProps) {
  const [promise, setPromise] = useState(() => getDashboardKPIs())
  const [isPending, startTransition] = useTransition()

  const res = use(promise)

  if (!res.success) {
    return (
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-6 text-center" role="alert">
        <FaExclamationTriangle className="text-[#DC2626] text-2xl mx-auto mb-2" />
        <p className="text-[#DC2626] text-sm font-bold">{res.error || 'Failed to load KPIs'}</p>
        <button
          onClick={() => startTransition(() => setPromise(getDashboardKPIs()))}
          className="mt-3 text-[#DC2626] hover:text-[#B91C1C] text-xs font-bold flex items-center gap-1 mx-auto"
          aria-label="إعادة تحميل مؤشرات الأداء"
        >
          <FaSync className="text-[10px]" /> إعادة المحاولة
        </button>
      </div>
    )
  }

  const kpis = res.data!
  const visibleCards = KPI_CARDS.filter(card =>
    !card.permission || permissions.includes(card.permission)
  )

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isPending ? 'opacity-50 pointer-events-none' : ''}`} role="list" aria-label="مؤشرات الأداء">
      {visibleCards.map(card => {
        const value = kpis[card.key]
        const numericValue = typeof value === 'number' ? value : 0
        return (
          <div
            key={card.key}
            role="listitem"
            className="card-light p-5 hover:shadow-light-card-hover transition-all duration-200"
            aria-label={`${card.label}: ${formatValue(numericValue, card.format)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center ${card.iconColor}`} aria-hidden="true">
                {card.icon}
              </div>
              {card.format === 'currency' && numericValue > 0 && (
                <span className="text-[#62666D] text-[10px] font-bold bg-[#F1F2F3] px-2 py-0.5 rounded-md">SAR</span>
              )}
            </div>
            <p className="text-[#62666D] text-xs mb-1">{card.label}</p>
            <p className="text-[#111214] text-2xl font-black">
              {formatValue(numericValue, card.format)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export { Skeleton as DashboardKPISkeleton }
