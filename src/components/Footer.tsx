import Link from 'next/link';
import {
  FaShieldAlt,
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
  FaSnapchatGhost,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
  FaArrowLeft,
} from 'react-icons/fa';

const quickLinks = [
  { href: '/', label: 'الرئيسية' },
  { href: '/services', label: 'خدماتنا' },
  { href: '/offers', label: 'العروض' },
  { href: '/about', label: 'عن الشركة' },
  { href: '/contact', label: 'تواصل معنا' },
];

const serviceLinks = [
  { href: '/services/window-tinting', label: 'ظليل السيارات' },
  { href: '/services/ppf', label: 'حماية الطلاء' },
  { href: '/services/nano-ceramic', label: 'نانو سيراميك' },
  { href: '/services/glass-protection', label: 'حماية الزجاج' },
  { href: '/services/full-protection', label: 'الحماية الشاملة' },
];

const socialLinks = [
  { href: 'https://instagram.com/', icon: FaInstagram, label: 'Instagram' },
  { href: 'https://tiktok.com/', icon: FaTiktok, label: 'TikTok' },
  { href: 'https://wa.me/966500000000', icon: FaWhatsapp, label: 'WhatsApp' },
  { href: 'https://snapchat.com/', icon: FaSnapchatGhost, label: 'Snapchat' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0A0A0B] text-white relative">
      {/* Red accent bar */}
      <div className="h-[3px] bg-gradient-to-l from-[#C4121A] via-[#C4121A] to-[#970E14]" />

      <div className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 py-16">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 text-white font-bold text-xl mb-5">
              <div className="w-11 h-11 bg-[#C4121A] rounded-xl flex items-center justify-center shadow-lg shadow-[#C4121A]/20">
                <FaShieldAlt className="text-white text-xl" />
              </div>
              <span className="font-black tracking-tight">عنوان الحماية</span>
            </Link>
            <p className="text-[#A0A0B8] text-sm leading-relaxed mb-6">
              شركة متخصصة في خدمات حماية السيارات بأعلى معايير الجودة العالمية. نحافظ على قيمة سيارتك ومظهرها.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-[#C4121A]/20 flex items-center justify-center text-[#A0A0B8] hover:text-[#C4121A] transition-all duration-200"
                  >
                    <Icon className="text-sm" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-base mb-5">روابط سريعة</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[#A0A0B8] hover:text-[#C4121A] transition-colors text-sm flex items-center gap-2 group"
                  >
                    <FaArrowLeft className="text-[10px] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-bold text-base mb-5">خدماتنا</h3>
            <ul className="space-y-3">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[#A0A0B8] hover:text-[#C4121A] transition-colors text-sm flex items-center gap-2 group"
                  >
                    <FaArrowLeft className="text-[10px] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-bold text-base mb-5">تواصل معنا</h3>
            <ul className="space-y-4">
              <li>
                <a href="tel:+966500000000" className="flex items-start gap-3 text-[#A0A0B8] hover:text-white transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-[#C4121A]/[0.08] flex items-center justify-center shrink-0 group-hover:bg-[#C4121A]/20 transition-colors">
                    <FaPhone className="text-[#C4121A] text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B80] mb-0.5">الهاتف</p>
                    <p className="text-sm font-semibold" dir="ltr">+966 50 000 0000</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="mailto:info@himaprotection.com" className="flex items-start gap-3 text-[#A0A0B8] hover:text-white transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-[#C4121A]/[0.08] flex items-center justify-center shrink-0 group-hover:bg-[#C4121A]/20 transition-colors">
                    <FaEnvelope className="text-[#C4121A] text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B80] mb-0.5">البريد الإلكتروني</p>
                    <p className="text-sm font-semibold">info@himaprotection.com</p>
                  </div>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-[#A0A0B8]">
                  <div className="w-9 h-9 rounded-xl bg-[#C4121A]/[0.08] flex items-center justify-center shrink-0">
                    <FaMapMarkerAlt className="text-[#C4121A] text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B80] mb-0.5">الموقع</p>
                    <p className="text-sm font-semibold">الرياض، المملكة العربية السعودية</p>
                  </div>
                </div>
              </li>
              <li>
                <div className="flex items-start gap-3 text-[#A0A0B8]">
                  <div className="w-9 h-9 rounded-xl bg-[#C4121A]/[0.08] flex items-center justify-center shrink-0">
                    <FaClock className="text-[#C4121A] text-xs" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B80] mb-0.5">ساعات العمل</p>
                    <p className="text-sm font-semibold">السبت - الخميس: 9 ص - 11 م</p>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.06] py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#6B6B80] text-xs">
            &copy; {year} عنوان الحماية — جميع الحقوق محفوظة
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-[#6B6B80] hover:text-[#A0A0B8] text-xs transition-colors">
              سياسة الخصوصية
            </Link>
            <Link href="/terms" className="text-[#6B6B80] hover:text-[#A0A0B8] text-xs transition-colors">
              الشروط والأحكام
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
