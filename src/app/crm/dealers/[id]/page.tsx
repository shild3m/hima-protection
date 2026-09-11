"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  FaSpinner,
  FaArrowRight,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaBuilding,
  FaEdit,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBan,
  FaPlay,
} from "react-icons/fa";
import { getDealer, updateDealer, activateDealer, softDeleteDealer } from "@/app/actions/dealer";
import type { Dealer } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  suspended: "معلق",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#10B981]/8 text-[#059669] border-[#10B981]/20",
  inactive: "bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]",
  suspended: "bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20",
};

export default function DealerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [editData, setEditData] = useState({
    business_name: "",
    phone: "",
    email: "",
    address: "",
    status: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const d = await getDealer(id);
      if (cancelled) return;
      if (!d) {
        setError("الشريك غير موجود");
      } else {
        setDealer(d);
        setEditData({
          business_name: d.business_name,
          phone: d.phone,
          email: d.email || "",
          address: d.address || "",
          status: d.status,
          notes: d.notes || "",
        });
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const result = await updateDealer(id, editData);
    setSaving(false);
    if (result.success && result.dealer) {
      setDealer(result.dealer);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("هل أنت متأكد من تعطيل هذا الشريك؟")) return;
    const result = await softDeleteDealer(id);
    if (result.success) {
      setDealer((prev) => prev ? { ...prev, is_active: false, status: "inactive" } : prev);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const handleActivate = async () => {
    const result = await activateDealer(id);
    if (result.success) {
      setDealer((prev) => prev ? { ...prev, is_active: true, status: "active" } : prev);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <FaSpinner className="animate-spin text-[#C4121A] text-2xl" />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="text-center py-16">
        <FaBuilding className="mx-auto text-[#62666D] text-4xl mb-4" />
        <p className="text-[#62666D]">{error || "الشريك غير موجود"}</p>
        <Link href="/crm/dealers" className="mt-4 inline-flex items-center gap-2 text-[#C4121A] hover:underline">
          <FaArrowRight /> العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/dealers"
            className="p-2 rounded-xl bg-[#F1F2F3] text-[#62666D] hover:text-[#111214] transition-colors"
          >
            <FaArrowRight />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{dealer.business_name}</h1>
            <p className="text-[#62666D] mt-1">تفاصيل الشريك</p>
          </div>
        </div>
        <div className="flex gap-3">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 bg-[#F1F2F3] hover:bg-[#E7E8EA] px-4 py-2.5 rounded-xl transition-colors"
            >
              <FaEdit /> تعديل
            </button>
          )}
          {dealer.is_active ? (
            <button
              onClick={handleDeactivate}
              className="flex items-center gap-2 bg-[#FEF2F2] hover:bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20 px-4 py-2.5 rounded-xl transition-colors"
            >
              <FaBan /> تعطيل
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="flex items-center gap-2 bg-[#10B981]/8 hover:bg-[#10B981]/15 text-[#059669] border border-[#10B981]/20 px-4 py-2.5 rounded-xl transition-colors"
            >
              <FaPlay /> تفعيل
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="flex items-center gap-2 bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-3 text-[#059669]">
          <FaCheckCircle /> تم الحفظ بنجاح
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#DC2626]/20 rounded-xl p-3 text-[#DC2626]">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-white rounded-2xl border border-[#E7E8EA] p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-[#C4121A]/10 rounded-2xl flex items-center justify-center">
            <FaBuilding className="text-[#C4121A] text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{dealer.business_name}</h2>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border mt-1 ${
                STATUS_COLORS[dealer.status] || STATUS_COLORS.active
              }`}
            >
              {STATUS_LABELS[dealer.status] || dealer.status}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-light">اسم النشاط</label>
                <input
                  type="text"
                  value={editData.business_name}
                  onChange={(e) => setEditData({ ...editData, business_name: e.target.value })}
                  className="input-light w-full"
                />
              </div>
              <div>
                <label className="label-light">رقم الهاتف</label>
                <input
                  type="text"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="input-light w-full"
                />
              </div>
              <div>
                <label className="label-light">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="input-light w-full"
                />
              </div>
              <div>
                <label className="label-light">العنوان</label>
                <input
                  type="text"
                  value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  className="input-light w-full"
                />
              </div>
              <div>
                <label className="label-light">الحالة</label>
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="select-light w-full"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                  <option value="suspended">معلق</option>
                </select>
              </div>
              <div>
                <label className="label-light">ملاحظات</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={3}
                  className="textarea-light w-full resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !editData.business_name || !editData.phone}
                className="flex items-center gap-2 bg-[#C4121A] hover:bg-[#A00F16] text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button
                onClick={() => { setEditing(false); setEditData({ ...dealer, email: dealer.email || "", address: dealer.address || "", notes: dealer.notes || "" }); }}
                className="px-5 py-2.5 bg-[#F1F2F3] hover:bg-[#E7E8EA] rounded-xl transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <InfoRow icon={<FaPhone />} label="الهاتف" value={dealer.phone} />
              <InfoRow icon={<FaEnvelope />} label="البريد" value={dealer.email || "—"} />
              <InfoRow icon={<FaMapMarkerAlt />} label="العنوان" value={dealer.address || "—"} />
            </div>
            <div className="space-y-4">
              <InfoRow icon={<FaBuilding />} label="النوع" value={dealer.commission_type === "fixed" ? "ثابت" : "نسبة"} />
              <InfoRow icon={<FaBuilding />} label="القيمة" value={String(dealer.commission_value)} />
              <InfoRow icon={<FaBuilding />} label="أنشئ في" value={new Date(dealer.created_at).toLocaleDateString("en-GB")} />
            </div>
            {dealer.notes && (
              <div className="sm:col-span-2">
                <div className="text-sm text-[#62666D] mb-1">ملاحظات</div>
                <div>{dealer.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Future Sections Placeholder */}
      <div className="bg-white rounded-2xl border border-[#E7E8EA] p-6">
        <h3 className="text-lg font-bold mb-4">الإحالات</h3>
        <div className="text-center py-8">
          <p className="text-[#62666D]">ستظهر الإحالات هنا بعد تكامل المرحلة 12</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-[#F1F2F3] rounded-lg flex items-center justify-center text-[#62666D]">
        {icon}
      </div>
      <div>
        <div className="text-xs text-[#62666D]">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}
