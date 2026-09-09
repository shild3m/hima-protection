'use client'

import Link from 'next/link'
import {
  FaCalendarPlus,
  FaUserPlus,
  FaFileInvoiceDollar,
  FaShoppingCart,
} from 'react-icons/fa'

interface QuickAction {
  href: string
  label: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  resource: string
  action: string
}

const ACTIONS: QuickAction[] = [
  { href: '/admin/bookings/new', label: 'حجز جديد', icon: <FaCalendarPlus />, iconBg: 'bg-[#10B981]/8', iconColor: 'text-[#059669]', resource: 'bookings', action: 'create' },
  { href: '/admin/customers/new', label: 'عميل جديد', icon: <FaUserPlus />, iconBg: 'bg-[#3B82F6]/8', iconColor: 'text-[#2563EB]', resource: 'customers', action: 'create' },
  { href: '/admin/invoices/new', label: 'فاتورة جديدة', icon: <FaFileInvoiceDollar />, iconBg: 'bg-[#F59E0B]/8', iconColor: 'text-[#D97706]', resource: 'invoices', action: 'create' },
  { href: '/admin/purchases/new', label: 'مشتريات جديدة', icon: <FaShoppingCart />, iconBg: 'bg-[#8B5CF6]/8', iconColor: 'text-[#7C3AED]', resource: 'purchases', action: 'create' },
]

interface QuickActionsProps {
  permissions: string[]
}

export default function QuickActions({ permissions }: QuickActionsProps) {
  const visible = ACTIONS.filter(a =>
    permissions.includes(`${a.resource}:${a.action}`)
  )

  if (visible.length === 0) return null

  return (
    <nav aria-label="إجراءات سريعة">
      <h2 className="text-lg font-black text-[#111214] mb-4">إجراءات سريعة</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="list">
        {visible.map(action => (
          <Link
            key={action.href}
            href={action.href}
            role="listitem"
            aria-label={action.label}
            className="card-light-hover p-4 flex flex-col items-center gap-2.5"
          >
            <div className={`w-10 h-10 rounded-xl ${action.iconBg} flex items-center justify-center ${action.iconColor} text-lg`} aria-hidden="true">
              {action.icon}
            </div>
            <span className="text-xs font-bold text-[#111214]">{action.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
