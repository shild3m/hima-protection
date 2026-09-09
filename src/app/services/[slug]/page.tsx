import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getPublicServices,
  getPublicServiceBySlug,
} from "@/lib/services";
import { formatPrice, formatDuration } from "@/lib/service-utils";
import {
  FaPaintBrush,
  FaShieldAlt,
  FaLayerGroup,
  FaWindowMaximize,
  FaCheckCircle,
  FaClock,
  FaArrowLeft,
  FaCalendarCheck,
  FaStar,
  FaCheck,
  FaPhone,
} from "react-icons/fa";

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "window-tinting": FaWindowMaximize,
  ppf: FaShieldAlt,
  "nano-ceramic": FaLayerGroup,
  "glass-protection": FaWindowMaximize,
  "full-protection": FaCheckCircle,
};

function ServiceIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = SERVICE_ICONS[slug] || FaPaintBrush;
  return <Icon className={className} />;
}

export async function generateStaticParams() {
  const services = await getPublicServices();
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublicServiceBySlug(slug);

  if (!service) {
    return { title: "خدمة غير موجودة — عنوان الحماية" };
  }

  const description =
    service.short_description ||
    service.description?.slice(0, 160) ||
    `تفاصيل خدمة ${service.name} من عنوان الحماية`;

  return {
    title: `${service.name} — عنوان الحماية`,
    description,
    alternates: { canonical: `/services/${slug}` },
    openGraph: {
      title: `${service.name} | عنوان الحماية`,
      description,
      url: `/services/${slug}`,
      locale: "ar_SA",
      type: "website",
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getPublicServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const price = formatPrice(service.base_price);
  const duration = formatDuration(service.duration_minutes);

  const features = [
    "جودة عالمية معتمدة",
    "ضمان شامل على الخدمة",
    "فريق فني متخصص",
    "خامات أصلية 100%",
    "خدمات سريعة واحترافية",
    "متابعة ما بعد الخدمة",
  ];

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.short_description || service.description?.slice(0, 200),
    provider: {
      '@type': 'Organization',
      name: 'عنوان الحماية',
      url: 'https://www.himaprotection.com',
    },
    areaServed: {
      '@type': 'Country',
      name: 'المملكة العربية السعودية',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'SAR',
      price: service.base_price,
      availability: 'https://schema.org/InStock',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: 'https://www.himaprotection.com' },
      { '@type': 'ListItem', position: 2, name: 'خدماتنا', item: 'https://www.himaprotection.com/services' },
      { '@type': 'ListItem', position: 3, name: service.name, item: `https://www.himaprotection.com/services/${slug}` },
    ],
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main className="pt-24 pb-16">
        {/* Breadcrumb */}
        <div className="container mb-8">
          <nav className="flex items-center gap-2 text-sm text-[#6B6B80]">
            <Link href="/" className="hover:text-white transition-colors">الرئيسية</Link>
            <span>/</span>
            <Link href="/services" className="hover:text-white transition-colors">خدماتنا</Link>
            <span>/</span>
            <span className="text-white">{service.name}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="section">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="w-16 h-16 bg-[#C4121A]/10 rounded-2xl flex items-center justify-center mb-6">
                  <ServiceIcon slug={service.slug} className="text-[#C4121A] text-3xl" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black mb-4">{service.name}</h1>
                <p className="text-[#A0A0B8] text-lg mb-8 leading-relaxed">
                  {service.short_description || service.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-8">
                  {price && (
                    <div className="card px-6 py-3">
                      <span className="text-[#6B6B80] text-sm block">السعر</span>
                      <span className="text-[#C4121A] font-black text-2xl">{price}</span>
                    </div>
                  )}
                  {duration && (
                    <div className="card px-6 py-3">
                      <span className="text-[#6B6B80] text-sm block">المدة</span>
                      <span className="text-white font-bold text-lg flex items-center gap-2">
                        <FaClock className="text-[#C4121A] text-sm" />
                        {duration}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-3">
                  <Link href="/booking" className="btn-primary btn-lg inline-flex items-center gap-2.5">
                    <FaCalendarCheck className="text-sm" />
                    احجز موعدك الآن
                  </Link>
                  <a href="tel:+966500000000" className="btn-secondary btn-lg inline-flex items-center gap-2.5">
                    <FaPhone className="text-sm" />
                    اتصل للاستفسار
                  </a>
                </div>
              </div>

              <div className="relative">
                <div className="aspect-square bg-[#111214] border border-white/[0.06] rounded-2xl flex items-center justify-center">
                  <ServiceIcon slug={service.slug} className="text-[#252629] text-[120px]" />
                </div>
                <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-[#C4121A]/5 rounded-full blur-3xl" />
              </div>
            </div>
          </div>
        </section>

        {/* Description */}
        {service.description && (
          <section className="section-dark">
            <div className="container">
              <div className="card p-8 md:p-12">
                <h2 className="text-2xl font-black mb-6">وصف الخدمة</h2>
                <div className="text-[#A0A0B8] leading-relaxed text-lg whitespace-pre-line">
                  {service.description}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Features */}
        <section className="section">
          <div className="container">
            <h2 className="text-2xl font-black mb-8">مميزات الخدمة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature, i) => (
                <div key={i} className="card p-5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#C4121A]/10 rounded-lg flex items-center justify-center shrink-0">
                    <FaCheck className="text-[#C4121A] text-sm" />
                  </div>
                  <span className="text-[#A0A0B8] font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rating */}
        <section className="section-dark">
          <div className="container-narrow">
            <div className="card p-8 text-center">
              <div className="flex items-center justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar key={star} className="text-amber-400 text-xl" />
                ))}
              </div>
              <p className="text-[#A0A0B8] text-lg">
                تقييم <span className="text-white font-bold">4.9</span> من <span className="text-white font-bold">+200</span> عميل
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section">
          <div className="container-narrow">
            <div className="gradient-red rounded-2xl border border-[#C4121A]/30 p-8 md:p-12 text-center">
              <h2 className="text-3xl font-black mb-4">هل أنت مستعد لحماية سيارتك؟</h2>
              <p className="text-[#A0A0B8] text-lg mb-8 max-w-2xl mx-auto">
                احجز موعدك الآن واحصل على استشارة مجانية مع فريقنا المتخصص
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/booking" className="btn-primary btn-lg inline-flex items-center gap-2.5">
                  <FaCalendarCheck className="text-sm" />
                  احجز موعدك
                </Link>
                <Link href="/services" className="btn-secondary btn-lg inline-flex items-center gap-2.5">
                  <FaArrowLeft className="text-sm" />
                  عرض جميع الخدمات
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
