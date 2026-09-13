"use client";

import { useState } from "react";
import {
  FaPaintBrush,
  FaShieldAlt,
  FaLayerGroup,
  FaWindowMaximize,
  FaCheckCircle,
  FaClock,
  FaArrowLeft,
} from "react-icons/fa";
import { formatPrice, formatDuration } from "@/lib/service-utils";
import type { Service } from "@/lib/service-utils";

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "window-tinting": FaWindowMaximize,
  ppf: FaShieldAlt,
  "nano-ceramic": FaLayerGroup,
  "glass-protection": FaWindowMaximize,
  "full-protection": FaCheckCircle,
};

export function ServiceCard({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const price = formatPrice(service.base_price);
  const duration = formatDuration(service.duration_minutes);
  const Icon = SERVICE_ICONS[service.slug] || FaPaintBrush;

  const fullDescription = service.description || service.short_description || "";
  const showImage = Boolean(service.image_url) && !imgError;

  return (
    <div className="group card-hover p-7 flex flex-col">
      {showImage ? (
        <div className="aspect-[4/3] rounded-xl overflow-hidden mb-5 bg-[#1A1B1E]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={service.image_url!}
            alt={service.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="w-12 h-12 bg-[#C4121A]/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-[#C4121A]/20 transition-colors">
          <Icon className="text-[#C4121A] text-xl" />
        </div>
      )}
      <h3 className="text-lg font-bold mb-2">{service.name}</h3>
      <p className="text-[#A0A0B8] text-sm mb-4 leading-relaxed">
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

      {fullDescription && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-auto inline-flex items-center gap-1.5 text-[#C4121A] text-sm font-semibold transition-all group-hover:gap-2.5 self-start cursor-pointer"
        >
          <span>{open ? "إخفاء التفاصيل" : "التفاصيل"}</span>
          <FaArrowLeft
            className={`text-xs transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          />
        </button>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t border-[#2A2B2F] animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-0.5 bg-[#C4121A] rounded-full" />
            <span className="text-[#6B6B80] text-xs font-semibold tracking-wide">
              وصف الخدمة
            </span>
          </div>
          <div className="text-[#A0A0B8] text-sm leading-7 whitespace-pre-line space-y-3">
            {service.description ? (
              service.description
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <p key={i} className="flex gap-2.5">
                    <span className="text-[#C4121A] shrink-0 mt-1.5">•</span>
                    <span>{line}</span>
                  </p>
                ))
            ) : (
              <p className="flex gap-2.5">
                <span className="text-[#C4121A] shrink-0 mt-1">•</span>
                <span>{service.short_description}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}