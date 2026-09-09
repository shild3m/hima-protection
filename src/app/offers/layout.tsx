import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'العروض — عنوان الحماية',
  description:
    'تابع أحدث عروض وخصومات عنوان الحماية على خدمات تظليل وحماية السيارات. عروض محدودة بأسعار استثنائية.',
  alternates: { canonical: '/offers' },
  openGraph: {
    title: 'العروض | عنوان الحماية',
    description: 'تابع أحدث عروض وخصومات عنوان الحماية.',
    url: '/offers',
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function OffersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
