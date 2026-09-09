import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from "next/link";

export const metadata = {
  title: 'إدارة العملاء',
  robots: { index: false, follow: false },
}

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/staff-login')
  }
  if (user.role_name === 'dealer') {
    redirect('/dealer')
  }
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#111214]" dir="rtl">
      <div className="flex">
        <aside className="hidden lg:block w-64 bg-white border-l border-[#E7E8EA] min-h-screen p-6 fixed right-0 top-0">
          <div className="mb-8">
            <Link href="/crm" className="text-xl font-black text-[#C4121A]">
              إدارة العملاء
            </Link>
          </div>
          <nav className="space-y-2">
            <NavLink href="/crm/customers">العملاء</NavLink>
            <NavLink href="/crm/vehicles">السيارات</NavLink>
            <NavLink href="/crm/dealers">الشركاء</NavLink>
          </nav>
        </aside>
        <main className="flex-1 lg:mr-64 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block px-4 py-3 rounded-xl text-[#62666D] hover:text-[#111214] hover:bg-[#F1F2F3] transition-colors font-medium"
    >
      {children}
    </Link>
  );
}
