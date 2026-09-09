import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'احجز موعدك — عنوان الحماية',
  description:
    'احجز موعدك الآن للحصول على استشارة مجانية وفحص سيارتك. اختار الخدمة والوقت المناسب.',
  alternates: { canonical: '/booking' },
  openGraph: {
    title: 'احجز موعدك | عنوان الحماية',
    description: 'احجز موعدك الآن للحصول على استشارة مجانية.',
    url: '/booking',
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
