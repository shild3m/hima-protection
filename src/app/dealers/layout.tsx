import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'شركاؤنا — عنوان الحماية',
  description:
    'شركاء عنوان الحماية حول المملكة: فريق منوزعين ومعتمدين يقدمون خدمات حماية السيارات بأعلى معايير الجودة.',
  alternates: { canonical: '/dealers' },
  openGraph: {
    title: 'شركاؤنا | عنوان الحماية',
    description: 'شركاء عنوان الحماية حول المملكة.',
    url: '/dealers',
    locale: 'ar_SA',
    type: 'website',
  },
}

export default function DealersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
