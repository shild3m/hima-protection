import Link from 'next/link';
import type { Metadata } from 'next';
import {
  FaShieldAlt,
  FaAward,
  FaCertificate,
  FaUsers,
  FaCheck,
  FaPaintBrush,
  FaLayerGroup,
  FaEye,
  FaCar,
} from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'عن الشركة — عنوان الحماية',
  description: 'تعرّف على عنوان الحماية — شركة متخصصة في حماية السيارات بأعلى معايير الجودة العالمية.',
  alternates: { canonical: '/about' },
};

const stats = [
  { number: '10+', label: 'سنوات خبرة' },
  { number: '5000+', label: 'سيارة تم حمايتها' },
  { number: '98%', label: 'رضا العملاء' },
  { number: '5+', label: 'سنوات ضمان' },
];

const servicesList = [
  { name: 'حماية الطلاء PPF', icon: FaShieldAlt },
  { name: 'نانو سيراميك', icon: FaLayerGroup },
  { name: 'تظليل السيارات', icon: FaEye },
  { name: 'حماية الزجاج', icon: FaCar },
  { name: 'الحماية الشاملة', icon: FaAward },
];

const reasons = [
  {
    title: 'جودة عالمية',
    description: 'نستخدم فقط المنتجات والمواد المعتمدة عالمياً من أفضل الماركات العالمية.',
  },
  {
    title: 'خبرة واسعة',
    description: 'فريق من المتخصصين ذوي الخبرة الطويلة في مجال حماية وصيانة السيارات.',
  },
  {
    title: 'ضمان حقيقي',
    description: 'نقدم ضماناً حقيقياً على جميع خدماتنا يعكس ثقتنا في جودة عملنا.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="section">
          <div className="container">
            <div className="section-header">
              <p className="section-label">من نحن</p>
              <h1 className="section-title">عنوان الحماية</h1>
              <p className="section-desc max-w-3xl">
                نحن شركة متخصصة في تقديم خدمات حماية السيارات بأعلى معايير الجودة العالمية.
                منذ تأسيسنا ونحن نلتزم بتقديم أفضل الحلول والخدمات التي تحافظ على قيمة سيارتك
                ومظهرها، مع توفير تجربة استثنائية لعملائنا.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {stats.map((stat, i) => (
                <div key={i} className="card p-6 text-center">
                  <p className="text-3xl md:text-4xl font-black text-[#C4121A] mb-2">{stat.number}</p>
                  <p className="text-[#A0A0B8] text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="section-dark">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">خدماتنا</h2>
              <p className="section-desc">حلول حماية متكاملة لسيارتك</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {servicesList.map((s, i) => (
                <div key={i} className="card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#C4121A]/10 rounded-xl flex items-center justify-center shrink-0">
                    <s.icon className="text-[#C4121A] text-xl" />
                  </div>
                  <span className="font-bold">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Us */}
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">لماذا <span className="text-[#C4121A]">نحن</span></h2>
              <p className="section-desc">المميزات التي تجعلنا الخيار الأفضل</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reasons.map((reason, i) => (
                <div key={i} className="card p-7">
                  <div className="w-12 h-12 bg-[#C4121A] rounded-xl flex items-center justify-center mb-5">
                    <FaCheck className="text-white text-xl" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{reason.title}</h3>
                  <p className="text-[#A0A0B8] leading-relaxed">{reason.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section">
          <div className="container-narrow">
            <div className="gradient-red rounded-2xl border border-[#C4121A]/30 p-10 text-center">
              <h2 className="text-3xl font-black mb-4">جاهز لحماية سيارتك؟</h2>
              <p className="text-[#A0A0B8] mb-8 text-lg">احجز موعدك الآن واستمتع بخدمة حماية سيارات على أعلى مستوى</p>
              <Link href="/booking" className="btn-primary btn-lg inline-block">
                احجز الآن
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
