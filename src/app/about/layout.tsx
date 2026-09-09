import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'من نحن — عنوان الحماية',
  description:
    'تعرف على عنوان الحماية: فريق متخصص في حماية السيارات بخبرة واسعة في تظليل وحماية الطلاء ونانو سيراميك.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'من نحن | عنوان الحماية',
    description: 'فريق متخصص في حماية السيارات بخبرة واسعة.',
    url: '/about',
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
