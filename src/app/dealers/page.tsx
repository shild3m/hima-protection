import Link from 'next/link';
import type { Metadata } from 'next';
import { FaHandshake, FaChartLine, FaUsers, FaAward, FaCheckCircle } from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'شركاؤنا — عنوان الحماية',
  description: 'كن شريكاً في نجاح عنوان الحماية — شراكة مربحة ودعم كامل.',
  alternates: { canonical: '/dealers' },
};

const benefits = [
  'منتج عالمي بجودة عالية وضمان حقيقي',
  'تدريب ودعم فني مستمر لفريقك',
  'مواد تسويقية احترافية جاهزة للاستخدام',
  'عمولات تنافسية ومجزية',
  'صيانة ودعم بعد البيع',
  'اسم تجاري معروف وموثوق',
];

const steps = [
  { number: '01', title: 'تواصل معنا', description: 'أرسل طلبك عبر نموذج التواصل أو واتساب وسنقوم بالرد عليك خلال 24 ساعة.', icon: FaHandshake },
  { number: '02', title: 'تقييم التعاون', description: 'نقيّم طلبك ونحدد الشروط المناسبة لتحقيق أقصى استفادة للطرفين.', icon: FaChartLine },
  { number: '03', title: 'ابدأ التعاون', description: 'نوقع العقد ونبدأ التعاون مع دعم كامل من فريقنا المتخصص.', icon: FaUsers },
];

const stats = [
  { number: '50+', label: 'شريك نشط' },
  { number: '15+', label: 'مدينة في المملكة' },
  { number: '98%', label: 'نسبة رضا الشركاء' },
  { number: '10+', label: 'سنوات خبرة' },
];

export default function DealersPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="section">
          <div className="container">
            <div className="section-header">
              <p className="section-label">شركاؤنا</p>
              <h1 className="section-title">كن شريكاً في <span className="text-[#C4121A]">النجاح</span></h1>
              <p className="section-desc">نبحث عن شركاء موثوقين لتوسيع شبكة خدماتنا وتقديم أفضل حلول حماية السيارات في جميع أنحاء المملكة</p>
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

        {/* Benefits */}
        <section className="section-dark">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">مميزات <span className="text-[#C4121A]">الشراكة</span></h2>
              <p className="section-desc">الفوائد التي تحصلها عند الانضمام كشريك</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {benefits.map((benefit, i) => (
                <div key={i} className="card p-6 flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#C4121A]/10 rounded-xl flex items-center justify-center shrink-0">
                    <FaAward className="text-[#C4121A]" />
                  </div>
                  <span className="text-[#A0A0B8]">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">كيف يعمل <span className="text-[#C4121A]">التعاون؟</span></h2>
              <p className="section-desc">ثلاث خطوات بسيطة لبدء الشراكة</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {steps.map((step, i) => (
                <div key={i} className="card p-8 text-center relative">
                  <span className="absolute top-4 right-4 text-5xl font-black text-[#1A1B1E]">{step.number}</span>
                  <div className="w-14 h-14 bg-[#C4121A]/10 rounded-2xl flex items-center justify-center mx-auto mb-5 relative z-10">
                    <step.icon className="text-[#C4121A] text-xl" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 relative z-10">{step.title}</h3>
                  <p className="text-[#A0A0B8] text-sm leading-relaxed relative z-10">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section">
          <div className="container-narrow">
            <div className="gradient-red rounded-2xl border border-[#C4121A]/30 p-10 text-center">
              <FaCheckCircle className="text-[#C4121A] text-4xl mx-auto mb-6" />
              <h2 className="text-3xl font-black mb-4">مستعد للانضمام؟</h2>
              <p className="text-[#A0A0B8] mb-8 text-lg max-w-xl mx-auto">
                تواصل معنا اليوم وكن جزءاً من شبكة شركاء ناجحين في جميع أنحاء المملكة
              </p>
              <Link href="/contact" className="btn-primary btn-lg inline-block">
                تواصل معنا
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
