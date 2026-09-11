"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FaSpinner,
  FaBuilding,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUsers,
  FaArrowLeft,
} from "react-icons/fa";
import { createClient } from "@supabase/supabase-js";

const URL = "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";

function DealerStats({ dealerId }: { dealerId: string }) {
  const [stats, setStats] = useState({ total: 0, created: 0, redeemed: 0, completed: 0 });
  const [commStats, setCommStats] = useState({ pending: 0, approved: 0, paid: 0, total_amount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const c = createClient(URL, ANON);
        const { data: { session } } = await c.auth.getSession();
        if (!session) return;
        const authC = createClient(URL, ANON, {
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        });
        const { data } = await authC
          .from("referrals")
          .select("status")
          .eq("dealer_id", dealerId);
        if (cancelled) return;
        const rows = data || [];
        setStats({
          total: rows.length,
          created: rows.filter((r: { status: string }) => r.status === "created").length,
          redeemed: rows.filter((r: { status: string }) => r.status === "redeemed").length,
          completed: rows.filter((r: { status: string }) => r.status === "completed").length,
        });

        // Fetch commission stats
        const { data: commissions } = await authC
          .from("commissions")
          .select("status, calculated_amount")
          .eq("dealer_id", dealerId);
        if (!cancelled && commissions) {
          const cRows = commissions || [];
          setCommStats({
            pending: cRows.filter((c: { status: string }) => c.status === "pending").length,
            approved: cRows.filter((c: { status: string }) => c.status === "approved").length,
            paid: cRows.filter((c: { status: string }) => c.status === "paid").length,
            total_amount: cRows
              .filter((c: { status: string }) => c.status !== "cancelled")
              .reduce((s: number, c: { calculated_amount: number }) => s + (c.calculated_amount || 0), 0),
          });
        }

        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dealerId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Link
        href="/dealer/referrals"
        className="card-light rounded-xl p-4 border border-[#E7E8EA] hover:border-[#C4121A]/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C4121A]/10 rounded-xl flex items-center justify-center">
              <FaUsers className="text-[#C4121A]" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">الإحالات</div>
              <div className="text-2xl font-bold text-[#111214]">
                {loading ? "—" : stats.total}
              </div>
            </div>
          </div>
          <FaArrowLeft className="text-[#62666D]" />
        </div>
        {!loading && (
          <div className="flex gap-4 mt-3 text-xs text-[#62666D]">
            <span>جديدة: {stats.created}</span>
            <span>استبدال: {stats.redeemed}</span>
            <span>مكتملة: {stats.completed}</span>
          </div>
        )}
      </Link>
      <div className="card-light rounded-xl p-4 border border-[#E7E8EA]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
            <FaCheckCircle className="text-green-500" />
          </div>
          <div>
            <div className="text-[#62666D] text-sm">العمولات</div>
            <div className="text-2xl font-bold text-[#111214]">
              {loading ? "—" : commStats.total_amount.toLocaleString("en-GB")} <span className="text-sm font-normal text-[#62666D]">ر.س</span>
            </div>
          </div>
        </div>
        {!loading && (
          <div className="flex gap-4 mt-3 text-xs text-[#62666D]">
            <span>قيد الانتظار: {commStats.pending}</span>
            <span>تمت الموافقة: {commStats.approved}</span>
            <span>تم الدفع: {commStats.paid}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface DealerProfile {
  id: string;
  business_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
}

export default function DealerDashboardPage() {
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const c = createClient(URL, ANON);
        const { data: { session } } = await c.auth.getSession();
        if (!session) {
          setError("يجب تسجيل الدخول");
          setLoading(false);
          return;
        }

        const authC = createClient(URL, ANON, {
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        });

        // Get dealer record via get_dealer_id
        const { data: dealerId } = await authC.rpc("get_dealer_id", {
          p_user_id: session.user.id,
        });

        if (!dealerId) {
          setError("لا يوجد حساب شريك مرتبط بحسابك");
          setLoading(false);
          return;
        }

        const { data: dealerData, error: dErr } = await authC
          .from("dealers")
          .select("id, business_name, phone, email, address, status, is_active, created_at")
          .eq("id", dealerId)
          .single();

        if (cancelled) return;

        if (dErr || !dealerData) {
          setError("حدث خطأ في تحميل البيانات");
        } else {
          setDealer(dealerData);
        }
      } catch {
        if (!cancelled) setError("حدث خطأ غير متوقع");
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <FaSpinner className="animate-spin text-[#C4121A] text-2xl" />
      </div>
    );
  }

  if (error) {
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111214]">لوحة الشريك</h1>
        <p className="text-[#62666D] mt-1">مرحباً، {dealer.business_name}</p>
      </div>

      {/* Status Card */}
      <div className="card-light rounded-2xl border border-[#E7E8EA] p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-[#C4121A]/10 rounded-2xl flex items-center justify-center">
            <FaBuilding className="text-[#C4121A] text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111214]">{dealer.business_name}</h2>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border mt-1 ${
                dealer.status === "active"
                  ? "bg-green-50 text-green-600 border-green-200"
                  : dealer.status === "suspended"
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]"
              }`}
            >
              {dealer.status === "active" ? "نشط" : dealer.status === "suspended" ? "معلق" : "غير نشط"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F1F2F3] rounded-lg flex items-center justify-center text-[#62666D]">
              <FaPhone />
            </div>
            <div>
              <div className="text-xs text-[#62666D]">الهاتف</div>
              <div className="text-[#111214]">{dealer.phone}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F1F2F3] rounded-lg flex items-center justify-center text-[#62666D]">
              <FaEnvelope />
            </div>
            <div>
              <div className="text-xs text-[#62666D]">البريد</div>
              <div className="text-[#111214]">{dealer.email || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F1F2F3] rounded-lg flex items-center justify-center text-[#62666D]">
              <FaMapMarkerAlt />
            </div>
            <div>
              <div className="text-xs text-[#62666D]">العنوان</div>
              <div className="text-[#111214]">{dealer.address || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#F1F2F3] rounded-lg flex items-center justify-center text-[#62666D]">
              <FaCheckCircle />
            </div>
            <div>
              <div className="text-xs text-[#62666D]">تاريخ الانضمام</div>
              <div className="text-[#111214]">{new Date(dealer.created_at).toLocaleDateString("en-GB")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <DealerStats dealerId={dealer.id} />

      {/* Profile Link */}
      <Link
        href="/dealer/profile"
        className="block card-light hover:bg-[#F1F2F3] rounded-2xl border border-[#E7E8EA] p-6 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#111214]">الملف الشخصي</h3>
            <p className="text-[#62666D] text-sm mt-1">عرض وتعديل معلومات النشاط</p>
          </div>
          <FaSpinner className="text-[#62666D] rotate-180" />
        </div>
      </Link>
    </div>
  );
}
