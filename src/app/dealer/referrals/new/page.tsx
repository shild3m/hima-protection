"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowRight,
} from "react-icons/fa";
import { createReferral } from "@/app/actions/referral";

export default function NewReferralPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    car_make: "",
    car_model: "",
    car_year: "",
    car_color: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await createReferral({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      car_make: form.car_make || undefined,
      car_model: form.car_model || undefined,
      car_year: form.car_year ? Number(form.car_year) : undefined,
      car_color: form.car_color || undefined,
      notes: form.notes || undefined,
    });

    setSubmitting(false);

    if (result.success && result.referral_code) {
      setCode(result.referral_code);
      setSuccess(true);
    } else {
      setError(result.error || "حدث خطأ غير متوقع");
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card-light rounded-2xl border border-[#E7E8EA] p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaCheckCircle className="text-green-500 text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-[#111214] mb-2">تم إنشاء الإحالة بنجاح</h2>
          <p className="text-[#62666D] mb-6">رقم الإحالة</p>
          <div className="bg-[#F1F2F3] rounded-xl px-6 py-4 mb-6">
            <span className="text-2xl font-mono font-bold text-[#C4121A]">{code}</span>
          </div>
          <p className="text-[#62666D] text-sm mb-6">
            شارك هذا الرقم مع العميل. يمكن استخدامه عند الحجز.
          </p>
          <div className="flex gap-3">
            <Link
              href="/dealer/referrals"
              className="flex-1 flex items-center justify-center gap-2 bg-[#C4121A] hover:bg-[#A00F16] text-white py-3 rounded-xl font-medium transition-colors"
            >
              العودة للإحالات
            </Link>
            <button
              onClick={() => {
                setSuccess(false);
                setCode("");
                setForm({
                  customer_name: "",
                  customer_phone: "",
                  car_make: "",
                  car_model: "",
                  car_year: "",
                  car_color: "",
                  notes: "",
                });
              }}
              className="px-6 py-3 bg-[#F1F2F3] hover:bg-[#E7E8EA] text-[#111214] rounded-xl transition-colors"
            >
              إحالة جديدة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link
          href="/dealer/referrals"
          className="inline-flex items-center gap-2 text-[#62666D] hover:text-[#111214] transition-colors"
        >
          <FaArrowRight /> العودة للإحالات
        </Link>
      </div>

      <div className="card-light rounded-2xl border border-[#E7E8EA]">
        <div className="px-6 py-4 border-b border-[#E7E8EA]">
          <h2 className="text-lg font-bold text-[#111214]">إحالة عميل جديد</h2>
          <p className="text-[#62666D] text-sm mt-1">أدخل بيانات العميل المراد إحالته</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600">
              <FaExclamationTriangle /> {error}
            </div>
          )}

          <div>
            <label className="label-light block text-sm mb-1">اسم العميل *</label>
            <input
              type="text"
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              className="input-light w-full rounded-xl px-4 py-2.5"
              placeholder="الاسم الكامل"
            />
          </div>

          <div>
            <label className="label-light block text-sm mb-1">رقم الهاتف *</label>
            <input
              type="tel"
              required
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              className="input-light w-full rounded-xl px-4 py-2.5"
              placeholder="05XXXXXXXX"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-light block text-sm mb-1">ماركة السيارة</label>
              <input
                type="text"
                value={form.car_make}
                onChange={(e) => setForm({ ...form, car_make: e.target.value })}
                className="input-light w-full rounded-xl px-4 py-2.5"
                placeholder="مثال: Toyota"
              />
            </div>
            <div>
              <label className="label-light block text-sm mb-1">الموديل</label>
              <input
                type="text"
                value={form.car_model}
                onChange={(e) => setForm({ ...form, car_model: e.target.value })}
                className="input-light w-full rounded-xl px-4 py-2.5"
                placeholder="مثال: Camry"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-light block text-sm mb-1">سنة الصنع</label>
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear() + 1}
                value={form.car_year}
                onChange={(e) => setForm({ ...form, car_year: e.target.value })}
                className="input-light w-full rounded-xl px-4 py-2.5"
                placeholder="2024"
              />
            </div>
            <div>
              <label className="label-light block text-sm mb-1">اللون</label>
              <input
                type="text"
                value={form.car_color}
                onChange={(e) => setForm({ ...form, car_color: e.target.value })}
                className="input-light w-full rounded-xl px-4 py-2.5"
                placeholder="أبيض"
              />
            </div>
          </div>

          <div>
            <label className="label-light block text-sm mb-1">ملاحظات</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="textarea-light w-full rounded-xl px-4 py-2.5 resize-none"
              placeholder="ملاحظات إضافية..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !form.customer_name || !form.customer_phone}
            className="w-full bg-[#C4121A] hover:bg-[#A00F16] text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaCheckCircle />
            )}
            {submitting ? "جاري الإنشاء..." : "إنشاء الإحالة"}
          </button>
        </form>
      </div>
    </div>
  );
}
