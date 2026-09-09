"use client";

import { useState, useEffect } from "react";
import {
  FaSearch,
  FaSpinner,
  FaUsers,
  FaPhone,
  FaCheckCircle,
  FaClock,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaSync,
} from "react-icons/fa";
import { getReferrals, updateReferralStatus, redeemReferral } from "@/app/actions/referral";
import type {
  ReferralWithServices,
  ReferralFilters,
  ReferralStatus,
  SortConfig,
} from "@/lib/types";

const STATUS_LABELS: Record<ReferralStatus, string> = {
  created: "جديدة",
  contacted: "تم التواصل",
  redeemed: "تم الاستبدال",
  expired: "منتهية",
  cancelled: "ملغاة",
  completed: "مكتملة",
};

const STATUS_COLORS: Record<ReferralStatus, string> = {
  created: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  redeemed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  expired: "bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
};

const VALID_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  created: ["contacted", "cancelled"],
  contacted: ["redeemed", "cancelled"],
  redeemed: ["completed", "cancelled"],
  expired: [],
  cancelled: [],
  completed: [],
};

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const filters: ReferralFilters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const sort: SortConfig = { field: "created_at", direction: "desc" };
      const result = await getReferrals(filters, sort, page, 20);
      if (cancelled) return;
      setReferrals(result.data);
      setTotalPages(result.total_pages);
      setTotal(result.total);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [search, statusFilter, page, trigger]);

  const handleStatusChange = async (referralId: string, newStatus: ReferralStatus) => {
    setUpdatingId(referralId);
    setError("");
    const result = newStatus === "redeemed"
      ? await redeemReferral(referralId)
      : await updateReferralStatus(referralId, newStatus);
    setUpdatingId(null);
    if (result.success) {
      setTrigger((t) => t + 1);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111214]">الإحالات</h1>
        <p className="text-[#62666D] mt-1">إدارة إحالات العملاء من الشركاء</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C4121A]/20 rounded-xl flex items-center justify-center">
              <FaUsers className="text-[#C4121A]" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">الكل</div>
              <div className="text-2xl font-bold text-[#111214]">{total}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <FaClock className="text-blue-400" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">جديدة</div>
              <div className="text-2xl font-bold text-[#111214]">
                {referrals.filter((r) => r.status === "created").length}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <FaCheckCircle className="text-purple-400" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">استبدال</div>
              <div className="text-2xl font-bold text-[#111214]">
                {referrals.filter((r) => r.status === "redeemed").length}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <FaCheckCircle className="text-green-400" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">مكتملة</div>
              <div className="text-2xl font-bold text-[#111214]">
                {referrals.filter((r) => r.status === "completed").length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-red-400">
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D]" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف أو رقم الإحالة..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-light w-full rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-[#C4121A]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReferralStatus | "");
              setPage(1);
            }}
            className="select-light rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C4121A]"
          >
            <option value="">جميع الحالات</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setTrigger((t) => t + 1)}
            className="flex items-center gap-2 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl px-4 py-2.5 text-[#111214] hover:bg-[#E7E8EA] transition-colors"
          >
            <FaSync /> تحديث
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E7E8EA] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <FaSpinner className="animate-spin text-[#C4121A] text-2xl" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-16">
            <FaUsers className="mx-auto text-[#62666D] text-4xl mb-4" />
            <p className="text-[#62666D]">لا توجد إحالات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E8EA]">
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">العميل</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">رقم الإحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الشريك</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">السيارة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">التاريخ</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => {
                  const transitions = VALID_TRANSITIONS[r.status] || [];
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[#E7E8EA]/50 hover:bg-[#F1F2F3] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-[#111214]">{r.customer_name}</div>
                          <div className="text-xs text-[#62666D] flex items-center gap-1 mt-0.5">
                            <FaPhone /> {r.customer_phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-[#111214]">{r.referral_code}</span>
                      </td>
                      <td className="px-6 py-4 text-[#111214] text-sm">
                        {(r.dealer as { business_name?: string })?.business_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-[#111214] text-sm">
                        {[r.car_make, r.car_model, r.car_year].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border ${
                            STATUS_COLORS[r.status]
                          }`}
                        >
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#62666D] text-sm">
                        {new Date(r.created_at).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="px-6 py-4">
                        {transitions.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {transitions.map((next) => (
                              <button
                                key={next}
                                onClick={() => handleStatusChange(r.id, next)}
                                disabled={updatingId === r.id}
                                className={`text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                                  next === "cancelled"
                                    ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                    : "bg-[#C4121A]/10 text-[#C4121A] border-[#C4121A]/30 hover:bg-[#C4121A]/20"
                                }`}
                              >
                                {updatingId === r.id ? (
                                  <FaSpinner className="animate-spin" />
                                ) : (
                                  STATUS_LABELS[next]
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E7E8EA]">
            <div className="text-[#62666D] text-sm">
              صفحة {page} من {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-[#F1F2F3] text-[#111214] disabled:opacity-50 hover:bg-[#E7E8EA] transition-colors"
              >
                <FaChevronRight />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-[#F1F2F3] text-[#111214] disabled:opacity-50 hover:bg-[#E7E8EA] transition-colors"
              >
                <FaChevronLeft />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
