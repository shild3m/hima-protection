import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from "next/link";

export default async function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/dealers/login')
  }
  if (user.role_name !== 'dealer') {
    redirect('/staff-login')
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#111214]" dir="rtl">
      <div className="flex">
        <aside className="hidden lg:block w-64 bg-white border-l border-[#E7E8EA] min-h-screen p-6 fixed right-0 top-0">
          <div className="mb-8">
            <Link href="/dealer" className="text-xl font-black text-[#C4121A]">
              لوحة الشريك
            </Link>
          </div>
          <nav className="space-y-2">
            <NavLink href="/dealer">الرئيسية</NavLink>
            <NavLink href="/dealer/referrals">الإحالات</NavLink>
            <NavLink href="/dealer/profile">الملف الشخصي</NavLink>
            <NavLink href="/dealers">شركاؤنا</NavLink>
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
  disabled = false,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block px-4 py-3 rounded-xl font-medium transition-colors ${
        disabled
          ? "text-[#62666D] cursor-not-allowed"
          : "text-[#62666D] hover:text-[#111214] hover:bg-[#F1F2F3]"
      }`}
    >
      {children}
    </Link>
  );
}
