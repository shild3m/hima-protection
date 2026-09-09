"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FaSpinner,
  FaPlus,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaUsers,
  FaCheckCircle,
  FaClock,
  FaPhone,
} from "react-icons/fa";
import { getMyReferrals, getMyReferralStats } from "@/app/actions/referral";
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
  created: "bg-blue-50 text-blue-600 border-blue-200",
  contacted: "bg-yellow-50 text-yellow-600 border-yellow-200",
  redeemed: "bg-purple-50 text-purple-600 border-purple-200",
  expired: "bg-[#F1F2F3] text-[#62666D] border-[#E7E8EA]",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  completed: "bg-green-50 text-green-600 border-green-200",
};

export default function DealerReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    created: 0,
    contacted: 0,
    redeemed: 0,
    completed: 0,
    cancelled: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const filters: ReferralFilters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const sort: SortConfig = { field: "created_at", direction: "desc" };
      const result = await getMyReferrals(filters, sort, page, 20);
      if (cancelled) return;
      setReferrals(result.data);
      setTotalPages(result.total_pages);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [search, statusFilter, page]);

  useEffect(() => {
    getMyReferralStats().then(setStats);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111214]">الإحالات</h1>
          <p className="text-[#62666D] mt-1">إدارة إحالات العملاء</p>
        </div>
        <Link
          href="/dealer/referrals/new"
          className="flex items-center gap-2 bg-[#C4121A] hover:bg-[#A00F16] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <FaPlus /> إحالة جديدة
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C4121A]/10 rounded-xl flex items-center justify-center">
              <FaUsers className="text-[#C4121A]" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">الكل</div>
              <div className="text-2xl font-bold text-[#111214]">{stats.total}</div>
            </div>
          </div>
        </div>
        <div className="stat-card bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FaClock className="text-blue-500" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">جديدة</div>
              <div className="text-2xl font-bold text-[#111214]">{stats.created}</div>
            </div>
          </div>
        </div>
        <div className="stat-card bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <FaCheckCircle className="text-purple-500" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">تم الاستبدال</div>
              <div className="text-2xl font-bold text-[#111214]">{stats.redeemed}</div>
            </div>
          </div>
        </div>
        <div className="stat-card bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <FaCheckCircle className="text-green-500" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">مكتملة</div>
              <div className="text-2xl font-bold text-[#111214]">{stats.completed}</div>
            </div>
          </div>
        </div>
      </div>

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
              className="input-light w-full rounded-xl py-2.5 pr-10 pl-4"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReferralStatus | "");
              setPage(1);
            }}
            className="select-light rounded-xl px-4 py-2.5"
          >
            <option value="">جميع الحالات</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
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
            <Link
              href="/dealer/referrals/new"
              className="mt-4 inline-flex items-center gap-2 text-[#C4121A] hover:underline"
            >
              <FaPlus /> أضف إحالة جديدة
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E8EA]">
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">العميل</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">رقم الإحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">السيارة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#E7E8EA]/50 hover:bg-[#F7F7F5] transition-colors"
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
                  </tr>
                ))}
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
