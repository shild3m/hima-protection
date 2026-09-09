'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  FaShieldAlt,
  FaStar,
  FaClock,
  FaWhatsapp,
  FaUsers,
  FaCertificate,
  FaAward,
  FaCog,
  FaPaintBrush,
  FaLayerGroup,
  FaEye,
  FaChevronDown,
  FaCheck,
  FaArrowLeft,
  FaCalendarCheck,
  FaCar,
  FaGem,
  FaPhoneAlt,
  FaQuoteRight,
  FaCrown,
  FaRocket,
  FaCheckCircle,
  FaHeart,
} from 'react-icons/fa'

const services = [
  { icon: FaPaintBrush, title: 'حماية الطلاء (PPF)', desc: 'طبقة شفافة عالية الجودة تمنع الخدوش والبِلى وتحافظ على لمعان سيارتك لسنوات.', slug: 'ppf' },
  { icon: FaEye, title: 'تظليل السيارات', desc: 'تظليل احترافي يقلل الحرارة ويوفر الخصوصية ويحمي داخلية سيارتك من أشعة الشمس.', slug: 'window-tinting' },
  { icon: FaCog, title: 'نانو سيراميك', desc: 'طلاء سيراميك نانوي يوفر حماية فائقة ويعطي لمعان استثنائي ويسهل التنظيف.', slug: 'nano-ceramic' },
  { icon: FaLayerGroup, title: 'حماية الزجاج', desc: 'طبقة حماية تزيد مقاومة الكسر وتحميه من الخدوش والصدمات الصغيرة.', slug: 'glass-protection' },
  { icon: FaShieldAlt, title: 'الحماية الشاملة', desc: 'حزمة متكاملة تشمل الطلاء والزجاج والفراغ الداخلي لحماية سيارتك بالكامل.', slug: 'full-protection' },
]

const reasons = [
  { icon: FaGem, title: 'خامات عالمية', desc: 'نستخدم فقط المنتجات المعتمدة عالمياً من أكبر الشركات المتخصصة.', stat: '100%' },
  { icon: FaAward, title: 'خبرة تمتد لسنوات', desc: 'فريق متخصص بخبرة تزيد عن 10 سنوات في مجال حماية السيارات.', stat: '10+' },
  { icon: FaCertificate, title: 'ضمان كتابي', desc: 'نقدم ضماناً حقيقياً وموثوقاً على جميع خدماتنا.', stat: '5-7' },
  { icon: FaUsers, title: 'ثقة عملائنا', desc: 'أكثر من 5000 عميل راضٍ يثقون بنا لحماية سياراتهم.', stat: '5000+' },
]

const packages = [
  { name: 'الأساسية', desc: 'حماية محددة لسيارتك',     features: ['حماية الطلاء الأمامي', 'تظليل النوافذ الجانبية', 'فحص شامل بعد التطبيق', 'ضمان 3 سنوات'], popular: false, icon: FaShieldAlt },
  { name: 'المتقدمة', desc: 'حماية شاملة بمستوى عالي',     features: ['حماية الطلاء الكاملة (PPF)', 'تظليل النوافذ بالكامل', 'نانو سيراميك للفراغ الخارجي', 'حماية الزجاج الأمامي', 'فحص شامل بعد التطبيق', 'ضمان 5 سنوات'], popular: true, icon: FaCrown },
  { name: 'الفاخرة', desc: 'الحماية الكاملة المتكاملة',     features: ['حماية الطلاء الكاملة (PPF)', 'تظليل النوافذ بالكامل', 'نانو سيراميك شامل', 'حماية الزجاج بالكامل', 'حماية الفراغ الداخلي', 'تنظيف وتلميع شامل', 'ضمان 7 سنوات + صيانة دورية'], popular: false, icon: FaRocket },
]

const steps = [
  { num: '01', title: 'تواصل معنا', desc: 'أرسل لنا استفسارك عبر الواتساب أو الموقع وسنرد عليك فوراً.', icon: FaPhoneAlt },
  { num: '02', title: 'اختر الخدمة', desc: 'نقدم لك استشارة مجانية لاختيار أفضل حماية تناسب سيارتك.', icon: FaCar },
  { num: '03', title: 'احجز موعدك', desc: 'حدد الوقت المناسب لك وسنعد كل شيء مسبقاً.', icon: FaCalendarCheck },
  { num: '04', title: 'استلم سيارتك', desc: 'نسلّمك سيارتك بحالة ممتازة مع ضمان كتابي.', icon: FaCheckCircle },
]

const testimonials = [
  { name: 'أحمد الراشد', role: 'مالك مرسيدس', rating: 5, text: 'خدمة ممتازة ونتائج تفوق التوقعات. سيارتي تبدو كأنها جديدة بعد الحماية.', avatar: 'ع' },
  { name: 'محمد العتيبي', role: 'مالك بي إم دبليو', rating: 5, text: 'فريق محترف جداً وخامات عالمية. أنصح بالحماية الشاملة لجميع أصحاب السيارات.', avatar: 'م' },
  { name: 'خالد الشمري', role: 'مالك أودي', rating: 5, text: 'أفضل مكان لحماية السيارات في المنطقة. الضمان الحقيقي يعطي ثقة كبيرة.', avatar: 'خ' },
]

const faqItems = [
  { q: 'ما مدة ضمان الحماية؟', a: 'نقدم ضماناً كتابياً لمدة تتراوح بين 5 إلى 10 سنوات حسب نوع الحماية المختارة.', icon: FaCertificate },
  { q: 'هل يمكن إزالة الحماية بدون إتلاف الطلاء؟', a: 'نعم، جميع حماياتنا قابلة للإزالة بسهولة دون أي أضرار بالطلاء الأصلي.', icon: FaShieldAlt },
  { q: 'كم يستغرق تطبيق الحماية الكاملة؟', a: 'يعتمد على نوع الخدمة، وتتراوح بين يوم إلى 3 أيام عمل.', icon: FaClock },
  { q: 'هل تقدمون خدمة التنقل للمنزل؟', a: 'نعم، نقدم خدمة التنقل لعملائنا في المناطق المجاورة بتكلفة إضافية.', icon: FaCar },
  { q: 'هل الحماية تؤثر على لون الطلاء؟', a: 'لا أبداً! الحماية شفافة تماماً ولا تغيّر لون الطلاء الأصلي.', icon: FaEye },
]

function AnimatedCounter({ target, duration = 2000 }: { target: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const numericTarget = parseInt(target.replace(/[^0-9]/g, ''), 10)
  const suffix = target.replace(/[0-9]/g, '')

  useEffect(() => {
    if (!ref.current || hasAnimated) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true)
          const startTime = Date.now()
          const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * numericTarget))
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [numericTarget, duration, hasAnimated])

  return <div ref={ref}>{count}{suffix}</div>
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, isVisible }
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const hero = useInView(0.1)
  const trustBar = useInView(0.2)
  const servicesSection = useInView(0.1)
  const whyUs = useInView(0.1)
  const packagesSection = useInView(0.1)
  const stepsSection = useInView(0.1)
  const testimonialsSection = useInView(0.1)
  const faqSection = useInView(0.1)
  const ctaSection = useInView(0.1)

  return (
    <main className="bg-[#0A0A0B] text-white">

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative min-h-[92vh] md:min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B] via-[#0A0A0B] to-[#0A0A0B]" />
          {/* Red glow - PROMINENT */}
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[#C4121A]/[0.15] rounded-full blur-[160px]" />
          <div className="absolute top-[25%] left-[20%] w-[400px] h-[400px] bg-[#C4121A]/[0.1] rounded-full blur-[120px]" />
          <div className="absolute bottom-[15%] right-[15%] w-[350px] h-[350px] bg-[#C4121A]/[0.08] rounded-full blur-[100px]" />
          {/* White glow */}
          <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] bg-white/[0.03] rounded-full blur-[100px]" />
          {/* Red dot pattern */}
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.6) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          {/* White dot grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0A0B] to-transparent" />
        </div>

        <div ref={hero.ref} className="relative z-10 max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-0">
          <div className="max-w-4xl">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-full pl-4 pr-5 py-2 mb-8 transition-all duration-700 ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <span className="w-2 h-2 bg-[#C4121A] rounded-full animate-pulse" />
              <span className="text-white/70 text-xs font-bold tracking-wide">الحماية المتميزة للسيارات</span>
            </div>

            {/* Heading */}
            <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-black leading-[1.08] mb-7 transition-all duration-700 delay-100 ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              حماية تليق{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-[#C4121A]">بسيارتك</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-[#C4121A]/[0.3] -rotate-1" />
              </span>
            </h1>

            {/* Subtitle */}
            <p className={`text-lg md:text-xl text-white/50 max-w-2xl mb-6 leading-relaxed transition-all duration-700 delay-200 ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              تظليل، حماية طلاء، نانو سيراميك وحلول متخصصة للعناية بسيارتك.
              <br className="hidden md:block" />
              نحمي سيارتك بأعلى معايير الجودة العالمية.
            </p>

            {/* Tags */}
            <div className={`flex flex-wrap gap-2.5 mb-10 transition-all duration-700 delay-300 ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              {[
                { icon: FaPaintBrush, label: 'حماية طلاء' },
                { icon: FaEye, label: 'تظليل' },
                { icon: FaCog, label: 'نانو سيراميك' },
                { icon: FaLayerGroup, label: 'حماية زجاج' },
              ].map((tag) => (
                <span key={tag.label} className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 bg-white/[0.03] border border-white/[0.06] rounded-full px-3.5 py-1.5">
                  <tag.icon className="text-[10px] text-[#C4121A]" />
                  {tag.label}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-[400ms] ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <Link href="/booking" className="group relative btn-primary btn-lg inline-flex items-center gap-3 overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <FaCalendarCheck className="text-sm relative z-10" />
                <span className="relative z-10">احجز موعدك</span>
              </Link>
              <Link href="/services" className="btn-secondary btn-lg inline-flex items-center gap-3">
                استكشف خدماتنا
                <FaArrowLeft className="text-xs" />
              </Link>
            </div>

            {/* Trust row */}
            <div className={`flex flex-wrap items-center gap-x-8 gap-y-4 mt-12 pt-8 border-t border-white/[0.06] transition-all duration-700 delay-500 ${hero.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              {[
                { icon: FaCheckCircle, text: 'ضمان كتابي' },
                { icon: FaGem, text: 'خامات عالمية' },
                { icon: FaUsers, text: 'فريق متخصص' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5 text-white/40 text-sm">
                  <item.icon className="text-[#C4121A] text-xs" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUST BAR ═══════════ */}
      <section ref={trustBar.ref} className="relative bg-[#111214]/60 border-y border-[#C4121A]/[0.12]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#C4121A]/[0.04] via-transparent to-[#C4121A]/[0.04]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.4) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { num: '10+', label: 'سنوات خبرة', icon: FaAward },
              { num: '5000+', label: 'سيارة تم حمايتها', icon: FaCar },
              { num: '98%', label: 'رضا العملاء', icon: FaHeart },
              { num: '5+', label: 'سنوات ضمان', icon: FaCertificate },
            ].map((stat, i) => (
              <div key={i} className={`text-center transition-all duration-700 ${trustBar.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="w-12 h-12 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/[0.06]">
                  <stat.icon className="text-[#C4121A] text-lg" />
                </div>
                <p className="text-3xl md:text-4xl font-black text-white mb-1">
                  <AnimatedCounter target={stat.num} />
                </p>
                <p className="text-white/40 text-xs md:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SERVICES ═══════════ */}
      <section ref={servicesSection.ref} className="section relative">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10">
          <div className="section-header">
            <p className={`section-label transition-all duration-600 ${servicesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>خدماتنا</p>
            <h2 className={`section-title transition-all duration-600 delay-100 ${servicesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              حلول حماية <span className="text-[#C4121A]">متكاملة</span>
            </h2>
            <p className={`section-desc transition-all duration-600 delay-200 ${servicesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              نقدم مجموعة شاملة من خدمات الحماية بأعلى جودة وأحدث التقنيات العالمية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service, i) => (
              <Link key={i} href={`/services/${service.slug}`} className={`group card-hover p-7 relative overflow-hidden transition-all duration-700 ${servicesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i * 80 + 200}ms` }}>
                <div className="absolute inset-0 bg-gradient-to-br from-[#C4121A]/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="absolute top-0 left-0 text-[10px] font-black text-white/[0.04] select-none">{String(i + 1).padStart(2, '0')}</div>
                  <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#C4121A]/[0.1] group-hover:scale-110 transition-all duration-500 border border-white/[0.06]">
                    <service.icon className="text-[#C4121A] text-xl" />
                  </div>
                  <h3 className="text-lg font-bold mb-2.5 group-hover:text-[#C4121A] transition-colors duration-300">{service.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-5">{service.desc}</p>
                  <span className="text-[#C4121A] text-sm font-semibold flex items-center gap-2 group-hover:gap-3 transition-all duration-300">
                    التفاصيل <FaArrowLeft className="text-xs group-hover:-translate-x-1 transition-transform duration-300" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ WHY US ═══════════ */}
      <section ref={whyUs.ref} className="section-dark relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#C4121A]/[0.06] via-transparent to-[#C4121A]/[0.06]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.4) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10">
          <div className="section-header">
            <p className={`section-label transition-all duration-600 ${whyUs.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>لماذا نحن</p>
            <h2 className={`section-title transition-all duration-600 delay-100 ${whyUs.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              التفاصيل الصغيرة <span className="text-[#C4121A]">تصنع الفرق</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {reasons.map((reason, i) => (
              <div key={i} className={`card p-6 text-center group hover:border-[#C4121A]/30 transition-all duration-500 ${whyUs.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i * 100 + 100}ms` }}>
                <div className="text-3xl font-black text-white/[0.06] mb-2 group-hover:text-[#C4121A]/[0.15] transition-colors duration-300">{reason.stat}</div>
                <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-[#C4121A]/[0.1] group-hover:scale-110 transition-all duration-500 border border-white/[0.06]">
                  <reason.icon className="text-[#C4121A] text-xl" />
                </div>
                <h3 className="font-bold mb-2">{reason.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{reason.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PACKAGES ═══════════ */}
      <section ref={packagesSection.ref} className="section relative">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10">
          <div className="section-header">
            <p className={`section-label transition-all duration-600 ${packagesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>الباقات</p>
            <h2 className={`section-title transition-all duration-600 delay-100 ${packagesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              اختر الحماية <span className="text-[#C4121A]">المناسبة</span>
            </h2>
            <p className={`section-desc transition-all duration-600 delay-200 ${packagesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              ثلاث مستويات من الحماية لتناسب كل الاحتياجات والميزانيات
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {packages.map((pkg, i) => (
              <div key={i} className={`card p-7 relative transition-all duration-700 ${pkg.popular ? 'border-[#C4121A]/40 shadow-glow' : ''} ${packagesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i * 120 + 100}ms` }}>
                {pkg.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="badge-primary text-xs px-4 py-1.5 shadow-lg shadow-[#C4121A]/20">الأكثر طلباً</span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${pkg.popular ? 'bg-[#C4121A]/[0.1] border-[#C4121A]/[0.2]' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                    <pkg.icon className={`text-xl ${pkg.popular ? 'text-[#C4121A]' : 'text-white/40'}`} />
                  </div>
                  <h3 className="text-xl font-black mb-1">{pkg.name}</h3>
                  <p className="text-white/40 text-sm">{pkg.desc}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {pkg.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-white/[0.04] flex items-center justify-center mt-0.5 shrink-0 border border-white/[0.06]">
                        <FaCheck className="text-[#C4121A] text-[9px]" />
                      </div>
                      <span className="text-white/50">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/booking" className={`block text-center py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${pkg.popular ? 'btn-primary w-full' : 'btn-secondary w-full'}`}>
                  احجز الآن
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section ref={stepsSection.ref} className="section-dark relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#C4121A]/[0.06] via-transparent to-[#C4121A]/[0.06]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.4) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10">
          <div className="section-header">
            <p className={`section-label transition-all duration-600 ${stepsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>كيف نعمل</p>
            <h2 className={`section-title transition-all duration-600 delay-100 ${stepsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              أربع خطوات <span className="text-[#C4121A]">بسيطة</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {steps.map((step, i) => (
              <div key={i} className={`text-center relative transition-all duration-700 ${stepsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i * 120 + 100}ms` }}>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                )}
                <div className="relative w-16 h-16 bg-[#111214] border border-white/[0.08] rounded-2xl flex items-center justify-center mx-auto mb-5 group hover:border-[#C4121A]/40 transition-all duration-500">
                  <step.icon className="text-[#C4121A] text-lg" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#C4121A] rounded-full flex items-center justify-center border-2 border-[#0A0A0B]">
                    <span className="text-white text-[10px] font-black">{step.num}</span>
                  </div>
                </div>
                <h3 className="font-bold mb-2">{step.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section ref={testimonialsSection.ref} className="section relative">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.5) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10">
          <div className="section-header">
            <p className={`section-label transition-all duration-600 ${testimonialsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>آراء عملائنا</p>
            <h2 className={`section-title transition-all duration-600 delay-100 ${testimonialsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              ثقة عملائنا <span className="text-[#C4121A]">أكبر دليل</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className={`card p-7 relative overflow-hidden transition-all duration-700 ${testimonialsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${i * 120 + 100}ms` }}>
                <FaQuoteRight className="absolute top-5 left-5 text-white/[0.03] text-5xl" />
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <FaStar key={j} className="text-amber-400 text-sm" />
                  ))}
                </div>
                <p className="text-white/50 leading-relaxed mb-6 text-sm relative z-10">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-5 border-t border-white/[0.06]">
                  <div className="w-11 h-11 bg-white/[0.04] rounded-full flex items-center justify-center text-[#C4121A] font-bold text-sm border border-white/[0.06]">
                    {t.avatar}
                  </div>
                  <div>
                    <span className="font-bold text-sm block">{t.name}</span>
                    <span className="text-white/30 text-xs">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section ref={faqSection.ref} className="section-dark relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#C4121A]/[0.06] via-transparent to-[#C4121A]/[0.06]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.4) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container-narrow relative z-10">
          <div className="section-header">
            <p className={`section-label transition-all duration-600 ${faqSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>أسئلة متكررة</p>
            <h2 className={`section-title transition-all duration-600 delay-100 ${faqSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              كل ما تحتاج <span className="text-[#C4121A]">معرفته</span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className={`card overflow-hidden transition-all duration-700 ${faqSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: `${i * 80 + 100}ms` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center gap-4 p-5 text-right" aria-expanded={openFaq === i}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 border ${openFaq === i ? 'bg-[#C4121A]/[0.1] border-[#C4121A]/[0.2]' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                    <item.icon className={`text-sm transition-colors duration-300 ${openFaq === i ? 'text-[#C4121A]' : 'text-white/30'}`} />
                  </div>
                  <span className="font-bold text-sm md:text-base flex-1">{item.q}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${openFaq === i ? 'bg-[#C4121A]/[0.1] rotate-180' : 'bg-white/[0.03]'}`}>
                    <FaChevronDown className={`text-xs transition-colors duration-300 ${openFaq === i ? 'text-[#C4121A]' : 'text-white/30'}`} />
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-400 ease-out ${openFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-5 pb-5 pl-14">
                    <p className="text-white/40 text-sm leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section ref={ctaSection.ref} className="section relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#C4121A]/[0.18] via-[#C4121A]/[0.05] to-[#0A0A0B]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, rgba(196,18,26,0.6) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#C4121A]/[0.08] rounded-full blur-[160px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#C4121A]/[0.06] rounded-full blur-[120px]" />

        <div className="relative z-10 container-narrow text-center">
          <div className={`transition-all duration-700 ${ctaSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/[0.08]">
              <FaShieldAlt className="text-[#C4121A] text-2xl" />
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-5 leading-tight">
              جاهز تحمي{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-[#C4121A]">سيارتك</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-[#C4121A]/[0.3] -rotate-1" />
              </span>
              ؟
            </h2>

            <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              تواصل معنا الآن واحصل على استشارة مجانية وعرض سعر مخصص لسيارتك
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/booking" className="group relative btn-primary btn-lg inline-flex items-center gap-3 overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <FaCalendarCheck className="text-sm relative z-10" />
                <span className="relative z-10">احجز موعدك</span>
              </Link>
              <a href="https://wa.me/966500000000" target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg inline-flex items-center gap-3">
                <FaWhatsapp className="text-sm" />
                تواصل عبر واتساب
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-10 pt-8 border-t border-white/[0.06]">
              {['ضمان كتابي', 'خامات عالمية', 'فريق متخصص', 'أسعار منافسة'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-white/30 text-sm">
                  <FaCheck className="text-[#C4121A] text-xs" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Bottom CTA */}
      <div className="mobile-bottom-cta">
        <Link href="/booking" className="btn-primary btn-md inline-flex items-center gap-2.5">
          <FaCalendarCheck className="text-sm" />
          احجز موعدك
        </Link>
      </div>
    </main>
  )
}
