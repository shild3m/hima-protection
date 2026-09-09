import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'تواصل معنا — عنوان الحماية',
  description:
    'تواصل مع فريق عنوان الحماية: هاتف، واتساب، بريد إلكتروني، أو زرنا في_location. نحن هنا لمساعدتك.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'تواصل معنا | عنوان الحماية',
    description: 'تواصل مع فريق عنوان الحماية للاستفسار أو الحجز.',
    url: '/contact',
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
