'use client'

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBooking } from "@/app/actions/booking";
import { formatPrice, formatDuration } from "@/lib/service-utils";
import type { Service } from "@/lib/service-utils";
import {
  FaUser,
  FaPhone,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaPaintBrush,
} from "react-icons/fa";
import { getServiceIcon } from "@/lib/service-icons";


export default function BookingForm({ services }: { services: Service[] }) {
  return (
    <Suspense fallback={null}>
      <BookingFormContent services={services} />
    </Suspense>
  );
}

function BookingFormContent({ services }: { services: Service[] }) {
  const searchParams = useSearchParams();
  const preselectedServiceId = searchParams.get("service");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    preselectedServiceId && services.some((s) => s.id === preselectedServiceId)
      ? preselectedServiceId
      : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [bookingRef, setBookingRef] = useState("");

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      newErrors.customerName = "الاسم مطلوب (حرفين على الأقل)";
    }
    if (!formData.customerPhone.trim() || formData.customerPhone.trim().length < 5) {
      newErrors.customerPhone = "رقم الهاتف مطلوب";
    }
    if (!selectedServiceId) {
      newErrors.service = "يرجى اختيار الخدمة";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;
    if (!selectedServiceId) return;

    setSubmitting(true);

    try {
      const idempotencyKey = crypto.randomUUID();

      const result = await createBooking({
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        serviceId: selectedServiceId,
        idempotencyKey,
      });

      if (result.success) {
        setBookingRef(result.bookingId?.slice(0, 8) || "");
        setSubmitted(true);
      } else {
        setError(result.error || "حدث خطأ أثناء إنشاء الحجز");
      }
    } catch {
      setError("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white">
        <main className="pt-24 pb-16 flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="card p-10">
              <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaCheckCircle className="text-[#10B981] text-4xl" />
              </div>
              <h1 className="text-3xl font-black mb-4">
                تم استلام طلب الحجز بنجاح
              </h1>
              <p className="text-[#A0A0B8] mb-2">
                شكراً لك {formData.customerName}
              </p>
              <p className="text-[#A0A0B8] mb-8">
                سيتواصل معك فريقنا قريباً لتأكيد الموعد. يرجى التأكد من صحة
                بيانات التواصل.
              </p>
              <div className="bg-[#1A1B1E] rounded-xl p-4 mb-6 text-right">
                <p className="text-sm text-[#6B6B80] mb-1">الخدمة المطلوبة</p>
                <p className="font-bold">{selectedService?.name}</p>
                {bookingRef && (
                  <>
                    <p className="text-sm text-[#6B6B80] mt-3 mb-1">رقم الحجز</p>
                    <p className="font-bold text-[#C4121A]">#{bookingRef}</p>
                  </>
                )}
              </div>
              <p className="text-[#6B6B80] text-sm mb-6">
                هذا طلب حجز — سيتم تأكيد الموعد بعد التواصل معك
              </p>
              <Link href="/services" className="btn-primary btn-md inline-block">
                العودة للخدمات
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="section-sm">
          <div className="container">
            <div className="section-header">
              <p className="section-label">الحجز</p>
              <h1 className="section-title">احجز موعدك <span className="text-[#C4121A]">الآن</span></h1>
              <p className="section-desc">اختر الخدمة المناسبة وأكمل نموذج الحجز وسنتواصل معك لتأكيد الموعد</p>
            </div>
          </div>
        </section>

        {/* Service Selection */}
        <section className="section-sm">
          <div className="container">
            <h2 className="text-2xl font-black mb-6">اختر الخدمة</h2>

            {services.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FaPaintBrush className="text-2xl" />
                </div>
                <h3 className="empty-state-title">لا توجد خدمات متاحة حالياً</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((service) => {
                  const Icon = getServiceIcon(service.icon_key);
                  const isSelected = selectedServiceId === service.id;
                  const price = formatPrice(service.base_price);
                  const duration = formatDuration(service.duration_minutes);

                  return (
                    <button
                      key={service.id}
                      onClick={() => {
                        setSelectedServiceId(service.id);
                        if (errors.service) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.service;
                            return next;
                          });
                        }
                      }}
                      className={`text-right border rounded-xl p-5 transition-all ${
                        isSelected
                          ? "bg-[#111214] border-[#C4121A] shadow-[0_0_20px_rgba(196,18,26,0.15)]"
                          : "bg-[#111214] border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-[#C4121A]/20" : "bg-white/[0.04]"
                          }`}
                        >
                          <Icon
                            className={
                              isSelected ? "text-[#C4121A]" : "text-[#6B6B80]"
                            }
                          />
                        </div>
                        <span className="font-bold">{service.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        {price ? (
                          <span className="text-[#C4121A] font-bold">{price}</span>
                        ) : (
                          <span className="text-[#6B6B80] text-sm">اتصل للاستفسار</span>
                        )}
                        {duration && (
                          <span className="text-[#6B6B80] text-xs flex items-center gap-1">
                            <FaClock className="text-[10px]" />
                            {duration}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {errors.service && (
              <p className="text-[#EF4444] text-sm mt-2 flex items-center gap-1">
                <FaExclamationTriangle className="text-xs" />
                {errors.service}
              </p>
            )}
          </div>
        </section>

        {/* Booking Form */}
        {selectedServiceId && (
          <section className="section-sm">
            <div className="container max-w-3xl">
              <h2 className="text-2xl font-black mb-6">بيانات الحجز</h2>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl mb-6">
                  <FaExclamationTriangle className="text-[#EF4444] shrink-0" />
                  <p className="text-[#F87171] text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="card p-8 space-y-5">
                {/* Step 1: Personal Info */}
                <div className="border-b border-white/[0.06] pb-5 mb-5">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-[#C4121A]">01</span> بياناتك الشخصية
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">
                        <FaUser className="inline ml-1 text-xs" />
                        الاسم الكامل *
                      </label>
                      <input
                        type="text"
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleChange}
                        className={`input ${errors.customerName ? '!border-[#EF4444]/50' : ''}`}
                        placeholder="الاسم الكامل"
                      />
                      {errors.customerName && (
                        <p className="error-text">{errors.customerName}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">
                        <FaPhone className="inline ml-1 text-xs" />
                        رقم الهاتف *
                      </label>
                      <input
                        type="tel"
                        name="customerPhone"
                        value={formData.customerPhone}
                        onChange={handleChange}
                        className={`input ${errors.customerPhone ? '!border-[#EF4444]/50' : ''}`}
                        placeholder="05XXXXXXXX"
                        dir="ltr"
                      />
                      {errors.customerPhone && (
                        <p className="error-text">{errors.customerPhone}</p>
                      )}
                    </div>
                  </div>
                </div>

                                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary btn-lg w-full"
                >
                  {submitting ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      جاري إرسال الحجز...
                    </>
                  ) : (
                    "تأكيد الحجز"
                  )}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
