'use client'

import Link from 'next/link'
import {
  FaCalendarCheck,
  FaFileInvoiceDollar,
  FaUsers,
  FaWarehouse,
  FaHandshake,
  FaChartBar,
} from 'react-icons/fa'

interface CardDef {
  href: string
  label: string
  description: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  resource: string
}

const CARDS: CardDef[] = [
  { href: '/admin/bookings', label: 'الحجوزات', description: 'إدارة حجوزات العملاء', icon: <FaCalendarCheck />, iconBg: 'bg-[#10B981]/8', iconColor: 'text-[#059669]', resource: 'bookings' },
  { href: '/admin/invoices', label: 'الفواتير', description: 'إنشاء وإدارة الفواتير', icon: <FaFileInvoiceDollar />, iconBg: 'bg-[#F59E0B]/8', iconColor: 'text-[#D97706]', resource: 'invoices' },
  { href: '/admin/customers', label: 'العملاء', description: 'بيانات العملاء', icon: <FaUsers />, iconBg: 'bg-[#3B82F6]/8', iconColor: 'text-[#2563EB]', resource: 'customers' },
  { href: '/admin/inventory', label: 'المخزون', description: 'إدارة المواد والمخزون', icon: <FaWarehouse />, iconBg: 'bg-[#8B5CF6]/8', iconColor: 'text-[#7C3AED]', resource: 'materials' },
  { href: '/admin/referrals', label: 'الإحالات', description: 'إدارة إحالات العملاء', icon: <FaHandshake />, iconBg: 'bg-[#06B6D4]/8', iconColor: 'text-[#0891B2]', resource: 'referrals' },
  { href: '/admin/reports', label: 'التقارير', description: 'التقارير والإحصائيات', icon: <FaChartBar />, iconBg: 'bg-[#EF4444]/8', iconColor: 'text-[#DC2626]', resource: 'reports' },
]

interface DashboardCardsProps {
  permissions: string[]
}

export default function DashboardCards({ permissions }: DashboardCardsProps) {
  const visibleCards = CARDS.filter(card =>
    permissions.includes(`${card.resource}:view`) || card.resource === 'bookings'
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {visibleCards.map(card => (
        <Link
          key={card.href}
          href={card.href}
          className="card-light-hover p-5"
        >
          <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center ${card.iconColor} text-lg mb-4`}>
            {card.icon}
          </div>
          <h3 className="text-[#111214] font-black text-sm mb-1">{card.label}</h3>
          <p className="text-[#62666D] text-xs">{card.description}</p>
        </Link>
      ))}
    </div>
  )
}
