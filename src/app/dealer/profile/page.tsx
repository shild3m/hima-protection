"use client";

import { useState, useEffect } from "react";
import {
  FaSpinner,
  FaBuilding,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaEdit,
} from "react-icons/fa";
import { createClient } from "@supabase/supabase-js";

const URL = "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";

interface DealerProfile {
  id: string;
  business_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function DealerProfilePage() {
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
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
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const c = createClient(URL, ANON);
        const { data: { session } } = await c.auth.getSession();
        if (!session) { setError("يجب تسجيل الدخول"); setLoading(false); return; }

        const authC = createClient(URL, ANON, {
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        });

        const { data: dealerId } = await authC.rpc("get_dealer_id", { p_user_id: session.user.id });
        if (!dealerId) { setError("لا يوجد حساب شريك"); setLoading(false); return; }

        const { data: d, error: dErr } = await authC
          .from("dealers")
          .select("id, business_name, phone, email, address, status, is_active, created_at, updated_at")
          .eq("id", dealerId)
          .single();

        if (cancelled) return;
        if (dErr || !d) { setError("حدث خطأ"); } else {
          setDealer(d);
          setEditData({ business_name: d.business_name, phone: d.phone, email: d.email || "", address: d.address || "" });
        }
      } catch { if (!cancelled) setError("حدث خطأ"); }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const c = createClient(URL, ANON);
      const { data: { session } } = await c.auth.getSession();
      if (!session) { setError("يجب تسجيل الدخول"); setSaving(false); return; }

      const authC = createClient(URL, ANON, {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      });

      const { error: updErr } = await authC
        .from("dealers")
        .update({
          business_name: editData.business_name.trim(),
          phone: editData.phone.replace(/[^0-9]/g, ""),
          email: editData.email.trim() || null,
          address: editData.address.trim() || null,
        })
        .eq("id", dealer!.id);

      setSaving(false);
      if (updErr) { setError("حدث خطأ أثناء الحفظ"); return; }

      setDealer((prev) => prev ? {
        ...prev,
        business_name: editData.business_name.trim(),
        phone: editData.phone.replace(/[^0-9]/g, ""),
        email: editData.email.trim() || null,
        address: editData.address.trim() || null,
      } : prev);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch { setError("حدث خطأ غير متوقع"); setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><FaSpinner className="animate-spin text-[#C4121A] text-2xl" /></div>;
  }

  if (error && !dealer) {
    return (
      <div className="text-center py-16">
        <FaExclamationTriangle className="mx-auto text-yellow-500 text-4xl mb-4" />
        <p className="text-[#62666D]">{error}</p>
      </div>
    );
  }

  if (!dealer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#111214]">الملف الشخصي</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 bg-[#F1F2F3] hover:bg-[#E7E8EA] text-[#111214] px-4 py-2.5 rounded-xl transition-colors"
          >
            <FaEdit /> تعديل
          </button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-600">
          <FaCheckCircle /> تم الحفظ بنجاح
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      <div className="card-light rounded-2xl border border-[#E7E8EA] p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-[#C4121A]/10 rounded-2xl flex items-center justify-center">
            <FaBuilding className="text-[#C4121A] text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111214]">{dealer.business_name}</h2>
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border mt-1 ${
              dealer.status === "active" ? "bg-green-50 text-green-600 border-green-200" : "bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]"
            }`}>
              {dealer.status === "active" ? "نشط" : dealer.status === "suspended" ? "معلق" : "غير نشط"}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-light block text-sm mb-1">اسم النشاط</label>
                <input type="text" value={editData.business_name}
                  onChange={(e) => setEditData({ ...editData, business_name: e.target.value })}
                  className="input-light w-full rounded-xl px-4 py-2.5" />
              </div>
              <div>
                <label className="label-light block text-sm mb-1">رقم الهاتف</label>
                <input type="text" value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="input-light w-full rounded-xl px-4 py-2.5" />
              </div>
              <div>
                <label className="label-light block text-sm mb-1">البريد الإلكتروني</label>
                <input type="email" value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="input-light w-full rounded-xl px-4 py-2.5" />
              </div>
              <div>
                <label className="label-light block text-sm mb-1">العنوان</label>
                <input type="text" value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  className="input-light w-full rounded-xl px-4 py-2.5" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving || !editData.business_name || !editData.phone}
                className="flex items-center gap-2 bg-[#C4121A] hover:bg-[#A00F16] text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors">
                {saving ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => { setEditing(false); setEditData({ business_name: dealer.business_name, phone: dealer.phone, email: dealer.email || "", address: dealer.address || "" }); }}
                className="px-5 py-2.5 bg-[#F1F2F3] hover:bg-[#E7E8EA] text-[#111214] rounded-xl transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoRow icon={<FaPhone />} label="الهاتف" value={dealer.phone} />
            <InfoRow icon={<FaEnvelope />} label="البريد" value={dealer.email || "—"} />
            <InfoRow icon={<FaMapMarkerAlt />} label="العنوان" value={dealer.address || "—"} />
            <InfoRow icon={<FaBuilding />} label="تاريخ الانضمام" value={new Date(dealer.created_at).toLocaleDateString("ar-SA")} />
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-[#F1F2F3] rounded-lg flex items-center justify-center text-[#62666D]">{icon}</div>
      <div>
        <div className="text-xs text-[#62666D]">{label}</div>
        <div className="text-[#111214]">{value}</div>
      </div>
    </div>
  );
}
