'use client';

import { useState } from 'react';
import { FaPhone, FaEnvelope, FaWhatsapp, FaClock, FaMapMarkerAlt, FaInstagram, FaSnapchatGhost, FaCheckCircle } from 'react-icons/fa';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      <main className="pt-24 pb-16">
        <section className="section">
          <div className="container">
            <div className="section-header">
              <p className="section-label">تواصل معنا</p>
              <h1 className="section-title">نحن هنا <span className="text-[#C4121A]">لمساعدتك</span></h1>
              <p className="section-desc">لا تتردد في التواصل معنا لأي استفسار أو لحجز موعد</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Form */}
              <div>
                {submitted ? (
                  <div className="card p-10 text-center">
                    <div className="w-16 h-16 bg-[#C4121A]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FaCheckCircle className="text-[#C4121A] text-3xl" />
                    </div>
                    <h3 className="text-2xl font-black mb-3">تم الإرسال بنجاح</h3>
                    <p className="text-[#A0A0B8]">سنتواصل معك في أقرب وقت ممكن</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="card p-8 space-y-5">
                    <h2 className="text-xl font-bold mb-2">أرسل رسالة</h2>
                    <div>
                      <label className="label">الاسم</label>
                      <input type="text" name="name" required value={formData.name} onChange={handleChange}
                        className="input" placeholder="الاسم الكامل" />
                    </div>
                    <div>
                      <label className="label">الهاتف</label>
                      <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                        className="input" placeholder="05XXXXXXXX" dir="ltr" />
                    </div>
                    <div>
                      <label className="label">البريد الإلكتروني</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange}
                        className="input" placeholder="email@example.com" dir="ltr" />
                    </div>
                    <div>
                      <label className="label">الرسالة</label>
                      <textarea name="message" required rows={4} value={formData.message} onChange={handleChange}
                        className="textarea" placeholder="اكتب رسالتك هنا..." />
                    </div>
                    <button type="submit" className="btn-primary btn-md w-full">إرسال</button>
                  </form>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-5">
                <div className="card p-8">
                  <h2 className="text-xl font-bold mb-6">قنوات التواصل</h2>
                  <div className="space-y-4">
                    <a href="https://wa.me/966500000000" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 bg-[#1A1B1E] rounded-xl p-4 hover:bg-[#252629] transition-colors">
                      <div className="w-12 h-12 bg-[#25D366]/10 rounded-lg flex items-center justify-center shrink-0">
                        <FaWhatsapp className="text-[#25D366] text-xl" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">واتساب</p>
                        <p className="text-[#A0A0B8] text-sm" dir="ltr">+966 50 000 0000</p>
                      </div>
                    </a>
                    <a href="tel:+966500000000"
                      className="flex items-center gap-4 bg-[#1A1B1E] rounded-xl p-4 hover:bg-[#252629] transition-colors">
                      <div className="w-12 h-12 bg-[#C4121A]/10 rounded-lg flex items-center justify-center shrink-0">
                        <FaPhone className="text-[#C4121A] text-xl" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">الهاتف</p>
                        <p className="text-[#A0A0B8] text-sm" dir="ltr">+966 50 000 0000</p>
                      </div>
                    </a>
                    <a href="mailto:info@himaprotection.com"
                      className="flex items-center gap-4 bg-[#1A1B1E] rounded-xl p-4 hover:bg-[#252629] transition-colors">
                      <div className="w-12 h-12 bg-[#C4121A]/10 rounded-lg flex items-center justify-center shrink-0">
                        <FaEnvelope className="text-[#C4121A] text-xl" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">البريد الإلكتروني</p>
                        <p className="text-[#A0A0B8] text-sm">info@himaprotection.com</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="card p-8">
                  <h2 className="text-xl font-bold mb-6">معلومات أخرى</h2>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#1A1B1E] rounded-lg flex items-center justify-center shrink-0">
                        <FaClock className="text-[#6B6B80]" />
                      </div>
                      <div>
                        <p className="text-[#6B6B80] text-sm">ساعات العمل</p>
                        <p className="font-bold text-sm">9 صباحاً — 11 مساءً</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#1A1B1E] rounded-lg flex items-center justify-center shrink-0">
                        <FaMapMarkerAlt className="text-[#6B6B80]" />
                      </div>
                      <div>
                        <p className="text-[#6B6B80] text-sm">الموقع</p>
                        <p className="font-bold text-sm">الرياض، المملكة العربية السعودية</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card p-8">
                  <h2 className="text-xl font-bold mb-6">تابعنا</h2>
                  <div className="flex gap-3">
                    {[FaInstagram, FaSnapchatGhost].map((Icon, i) => (
                      <a key={i} href="#" className="w-11 h-11 bg-[#1A1B1E] rounded-xl flex items-center justify-center hover:bg-[#252629] transition-colors text-[#A0A0B8] hover:text-white">
                        <Icon className="text-lg" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
