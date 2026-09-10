'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  FaCalendarCheck,
  FaWrench,
  FaUsers,
  FaFileInvoiceDollar,
  FaHandshake,
  FaChartBar,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaUserTie,
  FaCar,
  FaClipboardList,
  FaWarehouse,
  FaMoneyBillWave,
  FaExchangeAlt,
  FaCubes,
  FaTruck,
  FaShoppingCart,
  FaUserShield,
  FaBell,
  FaClipboardCheck,
  FaTag,
  FaReceipt,
} from 'react-icons/fa'
import { useAuth } from '@/components/AuthProvider'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  resource: string
  action: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'لوحة التحكم', icon: <FaChartBar />, resource: 'dashboard', action: 'read' },
  { href: '/admin/bookings', label: 'الحجوزات', icon: <FaCalendarCheck />, resource: 'bookings', action: 'read' },
  { href: '/admin/services', label: 'الخدمات', icon: <FaWrench />, resource: 'services', action: 'read' },
  { href: '/admin/customers', label: 'العملاء', icon: <FaUsers />, resource: 'customers', action: 'read' },
  { href: '/admin/vehicles', label: 'السيارات', icon: <FaCar />, resource: 'vehicles', action: 'read' },
  { href: '/admin/invoices', label: 'الفواتير', icon: <FaFileInvoiceDollar />, resource: 'invoices', action: 'read' },
  { href: '/admin/payments', label: 'المدفوعات', icon: <FaMoneyBillWave />, resource: 'payments', action: 'read' },
  { href: '/admin/materials', label: 'المواد', icon: <FaCubes />, resource: 'materials', action: 'read' },
  { href: '/admin/suppliers', label: 'الموردين', icon: <FaTruck />, resource: 'suppliers', action: 'read' },
  { href: '/admin/expenses', label: 'المصروفات', icon: <FaReceipt />, resource: 'expenses', action: 'read' },
  { href: '/admin/purchases', label: 'المشتريات', icon: <FaShoppingCart />, resource: 'purchases', action: 'read' },
  { href: '/admin/inventory', label: 'المخزون', icon: <FaWarehouse />, resource: 'inventory', action: 'read' },
  { href: '/admin/dealers', label: 'الوكلاء', icon: <FaHandshake />, resource: 'dealers', action: 'read' },
  { href: '/admin/referrals', label: 'الإحالات', icon: <FaHandshake />, resource: 'referrals', action: 'read' },
  { href: '/admin/commissions', label: 'العمولات', icon: <FaExchangeAlt />, resource: 'commissions', action: 'read' },
  { href: '/admin/commission-rules', label: 'قواعد العمولات', icon: <FaExchangeAlt />, resource: 'commission_rules', action: 'read' },
  { href: '/admin/offers', label: 'العروض', icon: <FaTag />, resource: 'offers', action: 'read' },
  { href: '/admin/notifications', label: 'الإشعارات', icon: <FaBell />, resource: 'notifications', action: 'read' },
  { href: '/admin/users', label: 'المستخدمين', icon: <FaUsers />, resource: 'staff', action: 'read' },
  { href: '/admin/roles', label: 'الأدوار', icon: <FaUserShield />, resource: 'roles', action: 'manage' },
  { href: '/admin/audit-logs', label: 'سجل التدقيق', icon: <FaClipboardCheck />, resource: 'audit_logs', action: 'read' },
  { href: '/admin/reports', label: 'التقارير', icon: <FaClipboardList />, resource: 'reports', action: 'read' },
  { href: '/admin/settings', label: 'الإعدادات', icon: <FaCog />, resource: 'settings', action: 'read' },
]

interface AdminSidebarProps {
  userName: string
  roleName: string
  permissions: string[]
}

export default function AdminSidebar({ userName, roleName, permissions }: AdminSidebarProps) {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const filteredNav = NAV_ITEMS.filter(item =>
    permissions.includes(`${item.resource}:${item.action}`) ||
    item.resource === 'dashboard'
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.06]">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C4121A] flex items-center justify-center">
            <FaCar className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-white font-black text-sm">لوحة التحكم</h1>
            <p className="text-[#6B6B80] text-[10px] font-medium">{roleName}</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-white/[0.08] text-white border border-white/[0.08]'
                  : 'text-[#6B6B80] hover:text-[#111214] hover:bg-[#F1F2F3] border border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                isActive ? 'bg-[#C4121A]/10 text-[#C4121A]' : 'bg-[#F7F7F5] text-[#6B6B80]'
              }`}>
                {item.icon}
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/[0.06]">
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-xs font-bold truncate">{userName}</p>
          <p className="text-[#6B6B80] text-[10px]">{roleName}</p>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-[#6B6B80] hover:text-[#111214] hover:bg-[#F1F2F3] transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-[#F7F7F5] flex items-center justify-center text-xs">
            <FaSignOutAlt />
          </div>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl bg-[#111214] border border-white/[0.08] flex items-center justify-center text-white"
      >
        <FaBars className="text-sm" />
      </button>

      <aside className="hidden lg:flex fixed top-0 right-0 w-64 h-screen bg-[#111214] border-l border-white/[0.06] flex-col z-40">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 right-0 w-64 h-screen bg-[#111214] border-l border-white/[0.06] flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white"
            >
              <FaTimes className="text-xs" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
