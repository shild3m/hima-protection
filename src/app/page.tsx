import type { Metadata } from 'next'
import HomeContent from '@/components/HomeContent'

export const metadata: Metadata = {
  title: 'عنوان الحماية — حماية سياراتك هي أولويتنا',
  description:
    'شركة متخصصة في حماية السيارات بخدمات تظليل وحماية الطلاء ونانو سيراميك بأعلى جودة وأفضل الأسعار.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'عنوان الحماية — حماية سياراتك هي أولويتنا',
    description: 'حماية سياراتك هي أولويتنا — تظليل، حماية طلاء، نانو سيراميك.',
    url: '/',
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function HomePage() {
  return <HomeContent />
}
