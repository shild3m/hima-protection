'use client'

import { FaWhatsapp, FaTag } from "react-icons/fa";
import type { OfferWithService } from "@/lib/types";

const OFFER_TYPE_LABELS: Record<string, string> = {
  fixed_discount: "خصم ثابت",
  percentage_discount: "خصم نسبة",
  free_service: "خدمة مجانية",
  special_price: "سعر خاص",
};

function formatOfferValue(offer: OfferWithService): string {
  if (offer.value === null || offer.value === undefined) return "";
  switch (offer.offer_type) {
    case "fixed_discount":
      return `${offer.value.toLocaleString("en-GB")} ر.س`;
    case "percentage_discount":
      return `${offer.value}%`;
    case "special_price":
      return `${offer.value.toLocaleString("en-GB")} ر.س`;
    default:
      return "";
  }
}

function getOfferTag(offer: OfferWithService): string {
  return OFFER_TYPE_LABELS[offer.offer_type] || "عرض";
}

export default function OffersContent({ offers }: { offers: OfferWithService[] }) {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="section-sm">
          <div className="container">
            <div className="section-header">
              <p className="section-label">العروض</p>
              <h1 className="section-title">عروض خاصة <span className="text-[#C4121A]">وحصرية</span></h1>
              <p className="section-desc">استمتع بعروضنا الحصرية على خدمات الحماية المتميزة</p>
            </div>

            <div className="gradient-red rounded-2xl border border-[#C4121A]/30 p-6 mb-12 max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
                <div className="w-10 h-10 bg-[#C4121A]/20 rounded-lg flex items-center justify-center">
                  <FaTag className="text-[#C4121A] text-xl" />
                </div>
                <p className="text-lg font-semibold">
                  {offers.length === 0
                    ? "عرض حالياً في مرحلة التحديث — قريباً بعروض جديدة وحصرية"
                    : `${offers.length} عرض متاح حالياً`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Offers Grid */}
        <section className="section-sm">
          <div className="container">
            {offers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FaTag className="text-2xl" />
                </div>
                <h3 className="empty-state-title">لا توجد عروض متاحة حالياً</h3>
                <p className="empty-state-desc">تفضل بزورنا مرة أخرى قريباً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="card p-8 relative overflow-hidden group hover:border-[#C4121A]/30 transition-all"
                  >
                    <span className="absolute top-4 left-4 bg-[#C4121A] text-white text-xs font-bold px-3 py-1 rounded-full">
                      {getOfferTag(offer)}
                    </span>
                    <div className="text-center mb-6">
                      {offer.value !== null && offer.value !== undefined && (
                        <span className="text-5xl font-bold text-[#C4121A]">
                          {formatOfferValue(offer)}
                        </span>
                      )}
                      {offer.offer_type === "free_service" && (
                        <span className="text-5xl font-bold text-[#C4121A]">مجاني</span>
                      )}
                      <p className="text-[#6B6B80] text-sm mt-1">
                        {offer.offer_type === "percentage_discount" ? "خصم" : ""}
                      </p>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-center">{offer.title}</h3>
                    {offer.description && (
                      <p className="text-[#A0A0B8] text-sm mb-6 leading-relaxed text-center">
                        {offer.description}
                      </p>
                    )}
                    {offer.service && (
                      <div className="text-center mb-4">
                        <span className="text-xs text-[#6B6B80]">الخدمة: </span>
                        <span className="text-xs text-[#A0A0B8]">{offer.service.name}</span>
                      </div>
                    )}
                    {offer.start_date && offer.end_date && (
                      <div className="text-center mb-4 text-xs text-[#6B6B80]">
                        من {new Date(offer.start_date).toLocaleDateString("en-GB")} إلى{" "}
                        {new Date(offer.end_date).toLocaleDateString("en-GB")}
                      </div>
                    )}
                    <a
                      href="https://wa.me/966500000000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold py-3 rounded-xl transition-colors"
                    >
                      <FaWhatsapp className="text-lg" />
                      <span>اطلب عبر واتساب</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="section">
          <div className="container-narrow">
            <div className="card p-10 text-center">
              <h2 className="text-2xl font-bold mb-3">لم تجد العرض المناسب؟</h2>
              <p className="text-[#A0A0B8] mb-6">
                تواصل معنا عبر واتساب وسنقدم لك عرضاً مخصصاً يناسب احتياجاتك وميزانيتك
              </p>
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold py-4 px-8 rounded-xl transition-colors"
              >
                <FaWhatsapp className="text-lg" />
                <span>تواصل معنا</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
