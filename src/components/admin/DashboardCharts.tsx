'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getRevenueChartData,
  getBookingsChartData,
  getServicesChartData,
  getDealerPerformanceData,
  getInventoryChartData,
  type RevenueChartData,
  type BookingsChartData,
  type ServicesChartData,
  type DealerPerformanceData,
  type InventoryChartData,
} from '@/app/actions/dashboard'

interface DateRange {
  from: string
  to: string
  label: string
}

const DATE_RANGES: DateRange[] = [
  { from: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0], label: '7 أيام' },
  { from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0], label: '30 يوم' },
  { from: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0], label: '3 أشهر' },
]

const PIE_COLORS = ['#C4121A', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

interface BarChartProps {
  labels: string[]
  values: number[]
  color?: string
  title: string
  height?: number
}

function BarChart({ labels, values, color = '#C4121A', title, height = 160 }: BarChartProps) {
  const maxVal = Math.max(...values, 1)
  const summary = labels.map((l, i) => `${l}: ${values[i].toLocaleString('en-GB')}`).join(', ')

  return (
    <div className="bg-[#F7F7F5] border border-white/[0.06] rounded-2xl p-5" role="figure" aria-label={`${title}: ${summary}`}>
      <h3 className="text-white font-black text-sm mb-4">{title}</h3>
      {labels.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[#62666D] text-xs">لا توجد بيانات</div>
      ) : (
        <>
          <div className="flex items-end gap-1.5" style={{ height }} aria-hidden="true">
            {values.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[#62666D] text-[10px] font-bold">{val.toLocaleString('en-GB')}</span>
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${(val / maxVal) * (height - 30)}px`,
                    backgroundColor: color,
                    minHeight: val > 0 ? '4px' : '0px',
                    opacity: 0.8,
                  }}
                />
                <span className="text-[#62666D] text-[9px] truncate w-full text-center" title={labels[i]}>
                  {labels[i].length > 6 ? labels[i].slice(0, 5) + '…' : labels[i]}
                </span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead><tr><th>الفترة</th><th>القيمة</th></tr></thead>
            <tbody>{labels.map((l, i) => <tr key={i}><td>{l}</td><td>{values[i]}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  )
}

interface PieChartProps {
  labels: string[]
  values: number[]
  title: string
}

function PieChart({ labels, values, title }: PieChartProps) {
  const total = values.reduce((s, v) => s + v, 0)

  const segments = useMemo(() => {
    const totalVal = values.reduce((s, v) => s + v, 0)
    return values.map((val, i) => {
      const pct = totalVal > 0 ? (val / totalVal) * 100 : 0
      const prevPcts = values.slice(0, i).map(v => totalVal > 0 ? (v / totalVal) * 100 : 0)
      const start = prevPcts.reduce((s, p) => s + p, 0)
      return { pct, color: PIE_COLORS[i % PIE_COLORS.length], label: labels[i], value: val, start }
    })
  }, [values, labels])

  const gradientParts = useMemo(() => {
    const parts: string[] = []
    let angle = 0
    for (const seg of segments) {
      const end = angle + (seg.pct / 100) * 360
      parts.push(`${seg.color} ${angle}deg ${end}deg`)
      angle = end
    }
    return parts
  }, [segments])

  const summary = labels.map((l, i) => `${l}: ${values[i]}`).join(', ')

  return (
    <div className="bg-[#F7F7F5] border border-white/[0.06] rounded-2xl p-5" role="figure" aria-label={`${title}: ${summary}`}>
      <h3 className="text-white font-black text-sm mb-4">{title}</h3>
      {total === 0 ? (
        <div className="flex items-center justify-center h-32 text-[#62666D] text-xs">لا توجد بيانات</div>
      ) : (
        <div className="flex items-center gap-4">
          <div
            className="w-24 h-24 rounded-full flex-shrink-0"
            style={{
              background: gradientParts.length > 0
                ? `conic-gradient(${gradientParts.join(', ')})`
                : '#333',
            }}
            aria-hidden="true"
          />
          <div className="flex-1 space-y-1.5" role="list">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 text-xs" role="listitem">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} aria-hidden="true" />
                <span className="text-[#62666D] flex-1 truncate">{seg.label}</span>
                <span className="text-white font-bold">{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>الفئة</th><th>العدد</th></tr></thead>
        <tbody>{labels.map((l, i) => <tr key={i}><td>{l}</td><td>{values[i]}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

interface HorizontalBarChartProps {
  labels: string[]
  values: number[]
  color?: string
  title: string
}

function HorizontalBarChart({ labels, values, color = '#3B82F6', title }: HorizontalBarChartProps) {
  const maxVal = Math.max(...values, 1)
  const summary = labels.map((l, i) => `${l}: ${values[i].toLocaleString('en-GB')}`).join(', ')

  return (
    <div className="bg-[#F7F7F5] border border-white/[0.06] rounded-2xl p-5" role="figure" aria-label={`${title}: ${summary}`}>
      <h3 className="text-white font-black text-sm mb-4">{title}</h3>
      {labels.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[#62666D] text-xs">لا توجد بيانات</div>
      ) : (
        <div className="space-y-3" role="list">
          {labels.map((label, i) => (
            <div key={i} role="listitem">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#62666D] text-xs truncate max-w-[60%]">{label}</span>
                <span className="text-white text-xs font-bold">{values[i].toLocaleString('en-GB')}</span>
              </div>
              <div className="w-full h-2 bg-[#F7F7F5] rounded-full overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(values[i] / maxVal) * 100}%`,
                    backgroundColor: color,
                    minWidth: values[i] > 0 ? '4px' : '0px',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>الوكيل</th><th>الإحالات</th></tr></thead>
        <tbody>{labels.map((l, i) => <tr key={i}><td>{l}</td><td>{values[i]}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

interface DualBarChartProps {
  labels: string[]
  series1: number[]
  series2: number[]
  label1: string
  label2: string
  color1?: string
  color2?: string
  title: string
  height?: number
}

function DualBarChart({ labels, series1, series2, label1, label2, color1 = '#C4121A', color2 = '#3B82F6', title, height = 160 }: DualBarChartProps) {
  const allVals = [...series1, ...series2]
  const maxVal = Math.max(...allVals, 1)
  const summary = labels.map((l, i) => `${l}: ${label1}=${series1[i]}, ${label2}=${series2[i]}`).join('؛ ')

  return (
    <div className="bg-[#F7F7F5] border border-white/[0.06] rounded-2xl p-5" role="figure" aria-label={`${title}: ${summary}`}>
      <h3 className="text-white font-black text-sm mb-4">{title}</h3>
      <div className="flex items-center gap-4 mb-3" aria-hidden="true">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color1 }} />
          <span className="text-[#62666D] text-[10px]">{label1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color2 }} />
          <span className="text-[#62666D] text-[10px]">{label2}</span>
        </div>
      </div>
      {labels.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[#62666D] text-xs">لا توجد بيانات</div>
      ) : (
        <>
          <div className="flex items-end gap-2" style={{ height }} aria-hidden="true">
            {labels.map((lbl, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex gap-0.5 items-end w-full justify-center">
                  <div
                    className="w-2.5 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${(series1[i] / maxVal) * (height - 30)}px`,
                      backgroundColor: color1,
                      minHeight: series1[i] > 0 ? '3px' : '0px',
                    }}
                  />
                  <div
                    className="w-2.5 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${(series2[i] / maxVal) * (height - 30)}px`,
                      backgroundColor: color2,
                      minHeight: series2[i] > 0 ? '3px' : '0px',
                    }}
                  />
                </div>
                <span className="text-[#62666D] text-[9px] truncate w-full text-center" title={lbl}>
                  {lbl.length > 6 ? lbl.slice(0, 5) + '…' : lbl}
                </span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead><tr><th>المادة</th><th>{label1}</th><th>{label2}</th></tr></thead>
            <tbody>{labels.map((l, i) => <tr key={i}><td>{l}</td><td>{series1[i]}</td><td>{series2[i]}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  )
}

interface DashboardChartsProps {
  permissions: string[]
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" role="status" aria-label="جاري تحميل الرسوم البيانية">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-[#F7F7F5] border border-white/[0.06] rounded-2xl p-5 animate-pulse">
          <div className="w-32 h-4 bg-[#F7F7F5] rounded mb-4" />
          <div className="h-40 bg-white/[0.03] rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardCharts({ permissions }: DashboardChartsProps) {
  const [rangeIdx, setRangeIdx] = useState(1)
  const [bundle, setBundle] = useState<{
    revenue: RevenueChartData | null
    bookings: BookingsChartData | null
    services: ServicesChartData | null
    dealerPerf: DealerPerformanceData | null
    inventory: InventoryChartData | null
  } | null>(null)
  const [isPending, setIsPending] = useState(false)

  const canViewBookings = permissions.includes('bookings:read')
  const canViewInvoices = permissions.includes('invoices:read')
  const canViewReferrals = permissions.includes('referrals:read')
  const canViewMaterials = permissions.includes('materials:read')

  const range = DATE_RANGES[rangeIdx]

  const load = useCallback(async (from: string, to: string) => {
    setIsPending(true)
    const results = await Promise.all([
      canViewInvoices ? getRevenueChartData(from, to) : null,
      canViewBookings ? getBookingsChartData(from, to) : null,
      canViewBookings ? getServicesChartData(from, to) : null,
      canViewReferrals ? getDealerPerformanceData() : null,
      canViewMaterials ? getInventoryChartData() : null,
    ])
    setBundle({
      revenue: results[0]?.success ? results[0]!.data! : null,
      bookings: results[1]?.success ? results[1]!.data! : null,
      services: results[2]?.success ? results[2]!.data! : null,
      dealerPerf: results[3]?.success ? results[3]!.data! : null,
      inventory: results[4]?.success ? results[4]!.data! : null,
    })
    setIsPending(false)
  }, [canViewBookings, canViewInvoices, canViewReferrals, canViewMaterials])

  useEffect(() => {
    load(range.from, range.to)
  }, [load, range.from, range.to])

  const handleRangeChange = useCallback((idx: number) => {
    setRangeIdx(idx)
  }, [])

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-white">الرسوم البيانية</h2>
        <div className="flex items-center gap-1 bg-[#F7F7F5] rounded-xl p-1" role="radiogroup" aria-label="نطاق التاريخ">
          {DATE_RANGES.map((r, i) => (
            <button
              key={i}
              onClick={() => handleRangeChange(i)}
              role="radio"
              aria-checked={i === rangeIdx}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                i === rangeIdx
                  ? 'bg-red-600 text-white'
                  : 'text-[#62666D] hover:text-[#111214]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!bundle ? (
        <ChartsSkeleton />
      ) : (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
          {canViewInvoices && bundle.revenue && (
            <BarChart
              labels={bundle.revenue.labels.map(l => l.slice(5))}
              values={bundle.revenue.values}
              color="#C4121A"
              title="الإيرادات اليومية (ر.س)"
            />
          )}

          {canViewBookings && bundle.bookings && (
            <PieChart
              labels={bundle.bookings.labels}
              values={bundle.bookings.values}
              title="الحجوزات حسب الحالة"
            />
          )}

          {canViewBookings && bundle.services && (
            <BarChart
              labels={bundle.services.labels}
              values={bundle.services.values}
              color="#10B981"
              title="الخدمات المكتملة"
              height={140}
            />
          )}

          {canViewReferrals && bundle.dealerPerf && bundle.dealerPerf.names.length > 0 && (
            <HorizontalBarChart
              labels={bundle.dealerPerf.names}
              values={bundle.dealerPerf.referralCounts}
              color="#F59E0B"
              title="أداء الوكلاء (إحالات)"
            />
          )}

          {canViewMaterials && bundle.inventory && bundle.inventory.names.length > 0 && (
            <DualBarChart
              labels={bundle.inventory.names.map(n => n.length > 10 ? n.slice(0, 9) + '…' : n)}
              series1={bundle.inventory.currentStock}
              series2={bundle.inventory.minStock}
              label1="المخزون الحالي"
              label2="الحد الأدنى"
              color1="#3B82F6"
              color2="#EF4444"
              title="مستويات المخزون"
              height={140}
            />
          )}
        </div>
      )}
    </div>
  )
}

export { ChartsSkeleton as DashboardChartsSkeleton }
