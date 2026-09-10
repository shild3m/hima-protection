import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "عنوان الحماية — حماية سياراتك هي أولويتنا",
  description: "شركة متخصصة في حماية السيارات بخدمات تظليل وحماية الطلاء ونانو سيراميك بأعلى جودة وأفضل الأسعار.",
  metadataBase: new URL("https://www.himaprotection.com"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "عنوان الحماية",
    description: "حماية سياراتك هي أولويتنا",
    locale: "ar_SA",
    type: "website",
    images: [
      {
        url: "https://www.himaprotection.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "عنوان الحماية — حماية سياراتك هي أولويتنا",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'عنوان الحماية',
  url: 'https://www.himaprotection.com',
  logo: 'https://www.himaprotection.com/logo.png',
  description: 'شركة متخصصة في حماية السيارات بخدمات تظليل وحماية الطلاء ونانو سيراميك.',
  areaServed: {
    '@type': 'Country',
    name: 'المملكة العربية السعودية',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+966-50-000-0000',
    contactType: 'customer service',
    availableLanguage: ['Arabic'],
  },
}

const webSiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'عنوان الحماية',
  url: 'https://www.himaprotection.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.himaprotection.com/services?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
}

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'عنوان الحماية',
  description: 'شركة متخصصة في حماية السيارات بخدمات تظليل وحماية الطلاء ونانو سيراميك.',
  url: 'https://www.himaprotection.com',
  logo: 'https://www.himaprotection.com/logo.png',
  image: 'https://www.himaprotection.com/og-image.png',
  telephone: '+966500000000',
  email: 'info@himaprotection.com',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'SA',
    addressLocality: 'الرياض',
    addressRegion: 'الرياض',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: '24.7136',
    longitude: '46.6753',
  },
  areaServed: {
    '@type': 'Country',
    name: 'المملكة العربية السعودية',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '23:00',
  },
}

const PUBLIC_PATHS = ['/', '/about', '/services', '/offers', '/booking', '/contact', '/dealers', '/staff-login'];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/services/')) return true;
  return false;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} h-full antialiased`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </head>
      <body className={`${readex.className} min-h-full flex flex-col bg-[#0A0A0B] text-white`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
