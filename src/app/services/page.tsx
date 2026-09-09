import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicServices } from "@/lib/services";
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
} from "react-icons/fa";

export const metadata: Metadata = {
  title: "خدماتنا — عنوان الحماية",
  description:
    "اكتشف خدماتنا المتميزة في حماية السيارات: تظليل، حماية الطلاء PPF، نانو سيراميك، حماية الزجاج، والحماية الشاملة.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "خدماتنا | عنوان الحماية",
    description:
      "اكتشف خدماتنا المتميزة في حماية السيارات بأعلى جودة وأفضل الأسعار.",
    url: "/services",
    locale: "ar_SA",
    type: "website",
  },
};

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

function ServicesSkeleton() {
  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <main className="pt-24 pb-16">
        <section className="container">
          <div className="section-header">
            <div className="h-5 w-24 bg-[#1A1B1E] rounded mx-auto mb-4 animate-pulse" />
            <div className="h-10 w-64 bg-[#1A1B1E] rounded mx-auto mb-4 animate-pulse" />
            <div className="h-5 w-80 bg-[#1A1B1E] rounded mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card p-7 animate-pulse">
                <div className="w-12 h-12 bg-[#1A1B1E] rounded-xl mb-5" />
                <div className="h-5 bg-[#1A1B1E] rounded w-3/4 mb-3" />
                <div className="h-4 bg-[#1A1B1E] rounded w-full mb-2" />
                <div className="h-4 bg-[#1A1B1E] rounded w-2/3 mb-6" />
                <div className="flex justify-between">
                  <div className="h-6 bg-[#1A1B1E] rounded w-20" />
                  <div className="h-4 bg-[#1A1B1E] rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

async function ServicesContent() {
  const services = await getPublicServices();

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="section-sm">
          <div className="container">
            <div className="section-header">
              <p className="section-label">خدماتنا</p>
              <h1 className="section-title">حلول حماية <span className="text-[#C4121A]">متكاملة</span></h1>
              <p className="section-desc">نقدم أفضل خدمات حماية السيارات بأحدث التقنيات العالمية وأعلى معايير الجودة</p>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="section-sm">
          <div className="container">
            {services.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FaPaintBrush className="text-2xl" />
                </div>
                <h3 className="empty-state-title">لا توجد خدمات متاحة حالياً</h3>
                <p className="empty-state-desc">سنعمل على إضافة خدماتنا قريباً. تابعونا للحصول على آخر التحديثات.</p>
                <Link href="/contact" className="btn-primary btn-md inline-flex items-center gap-2">
                  تواصل معنا
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {services.map((service) => {
                  const price = formatPrice(service.base_price);
                  const duration = formatDuration(service.duration_minutes);

                  return (
                    <Link key={service.id} href={`/services/${service.slug}`} className="group card-hover p-7 flex flex-col">
                      <div className="w-12 h-12 bg-[#C4121A]/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-[#C4121A]/20 transition-colors">
                        <ServiceIcon slug={service.slug} className="text-[#C4121A] text-xl" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{service.name}</h3>
                      <p className="text-[#A0A0B8] text-sm mb-5 leading-relaxed flex-1">
                        {service.short_description || service.description}
                      </p>
                      <div className="flex items-center justify-between mb-4">
                        {price ? (
                          <span className="text-[#C4121A] font-bold text-xl">{price}</span>
                        ) : (
                          <span className="text-[#6B6B80] text-sm">اتصل للاستفسار</span>
                        )}
                        {duration && (
                          <span className="text-[#6B6B80] text-sm flex items-center gap-1">
                            <FaClock className="text-xs" />
                            {duration}
                          </span>
                        )}
                      </div>
                      <span className="text-[#C4121A] text-sm font-semibold flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        التفاصيل <FaArrowLeft className="text-xs" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
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
                <a href="https://wa.me/966500000000" target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg inline-flex items-center gap-2.5">
                  تواصل عبر واتساب
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<ServicesSkeleton />}>
      <ServicesContent />
    </Suspense>
  );
}
