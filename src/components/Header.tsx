'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaShieldAlt,
  FaWhatsapp,
  FaPhone,
  FaTimes,
  FaBars,
  FaCalendarCheck,
} from 'react-icons/fa';

const navLinks = [
  { href: '/', label: 'الرئيسية' },
  { href: '/services', label: 'خدماتنا' },
  { href: '/offers', label: 'العروض' },
  { href: '/about', label: 'عن الشركة' },
  { href: '/contact', label: 'تواصل معنا' },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0A0A0B]/98 backdrop-blur-md shadow-lg shadow-black/30'
            : 'bg-[#0A0A0B]'
        }`}
      >
        {/* Red accent bar */}
        <div className="h-[3px] bg-gradient-to-l from-[#C4121A] via-[#C4121A] to-[#970E14]" />

        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-[72px]">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 text-white font-bold text-xl focus-visible:outline-2 focus-visible:outline-[#C4121A] focus-visible:outline-offset-2 rounded-lg"
              aria-label="عنوان الحماية - الرئيسية"
            >
              <div className="w-10 h-10 bg-[#C4121A] rounded-xl flex items-center justify-center shadow-lg shadow-[#C4121A]/20">
                <FaShieldAlt className="text-white text-lg" />
              </div>
              <span className="hidden sm:block font-black tracking-tight text-lg">عنوان الحماية</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="التنقل الرئيسي">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-[#C4121A] bg-[#C4121A]/[0.08]'
                        : 'text-[#A0A0B8] hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 right-1/2 translate-x-1/2 w-5 h-0.5 bg-[#C4121A] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-[#25D366]/10 flex items-center justify-center text-[#A0A0B8] hover:text-[#25D366] transition-all duration-200"
                aria-label="واتساب"
              >
                <FaWhatsapp className="text-sm" />
              </a>
              <a
                href="tel:+966500000000"
                className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center text-[#A0A0B8] hover:text-white transition-all duration-200"
                aria-label="الهاتف"
              >
                <FaPhone className="text-sm" />
              </a>
              <Link href="/booking" className="btn-primary btn-sm ml-2 gap-2">
                <FaCalendarCheck className="text-xs" />
                احجز موعدك
              </Link>
            </div>

            {/* Mobile Right */}
            <div className="flex items-center gap-2 lg:hidden">
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-[#A0A0B8]"
                aria-label="واتساب"
              >
                <FaWhatsapp />
              </a>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-[#A0A0B8] hover:text-white transition-colors"
                aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                aria-expanded={isOpen}
              >
                {isOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[300px] max-w-[85vw] bg-[#0A0A0B] border-l border-white/[0.06] z-50 lg:hidden transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة"
      >
        {/* Red accent bar in drawer */}
        <div className="h-[3px] bg-gradient-to-l from-[#C4121A] via-[#C4121A] to-[#970E14]" />

        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06]">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-white font-bold text-lg"
              onClick={() => setIsOpen(false)}
            >
              <div className="w-9 h-9 bg-[#C4121A] rounded-xl flex items-center justify-center">
                <FaShieldAlt className="text-white text-sm" />
              </div>
              <span className="font-black">عنوان الحماية</span>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center text-[#A0A0B8] hover:text-white transition-colors"
              aria-label="إغلاق"
            >
              <FaTimes size={16} />
            </button>
          </div>

          {/* Drawer Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="القائمة">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-[#C4121A] bg-[#C4121A]/[0.08]'
                        : 'text-[#A0A0B8] hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Drawer Footer */}
          <div className="px-5 pb-6 pt-4 border-t border-white/[0.06] space-y-3">
            <Link
              href="/booking"
              onClick={() => setIsOpen(false)}
              className="btn-primary btn-md w-full text-center block gap-2"
            >
              <FaCalendarCheck className="text-sm" />
              احجز موعدك
            </Link>
            <div className="flex items-center gap-2">
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors text-sm font-semibold"
              >
                <FaWhatsapp />
                واتساب
              </a>
              <a
                href="tel:+966500000000"
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white/[0.05] text-[#A0A0B8] hover:bg-white/[0.10] hover:text-white transition-colors text-sm font-semibold"
              >
                <FaPhone />
                اتصل
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
