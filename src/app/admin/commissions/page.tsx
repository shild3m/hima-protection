"use client";

import { useState, useEffect } from "react";
import {
  FaSearch,
  FaSpinner,
  FaCheckCircle,
  FaDollarSign,
  FaClock,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaSync,
} from "react-icons/fa";
import {
  getCommissions,
  approveCommission,
  cancelCommission,
  payCommission,
} from "@/app/actions/commission";
import type {
  CommissionWithDetails,
  CommissionFilters,
  CommissionStatus,
} from "@/lib/types";

const STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "قيد الانتظار",
  approved: "تمت الموافقة",
  paid: "تم الدفع",
  cancelled: "ملغاة",
};

const STATUS_COLORS: Record<CommissionStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const filters: CommissionFilters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const sort = { field: "created_at", direction: "desc" as const };
      const result = await getCommissions(filters, sort, page, 20);
      if (cancelled) return;
      setCommissions(result.data);
      setTotalPages(result.total_pages);
      setTotal(result.total);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [search, statusFilter, page, trigger]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setError("");
    const result = await approveCommission(id);
    setActionLoading(null);
    if (result.success) {
      setTrigger((t) => t + 1);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const handlePay = async (id: string) => {
    setActionLoading(id);
    setError("");
    const result = await payCommission(id);
    setActionLoading(null);
    if (result.success) {
      setTrigger((t) => t + 1);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const handleCancel = async (id: string) => {
    setActionLoading(id);
    setError("");
    const result = await cancelCommission(id);
    setActionLoading(null);
    if (result.success) {
      setTrigger((t) => t + 1);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111214]">العمولات</h1>
        <p className="text-[#62666D] mt-1">إدارة عمولات الإحالة</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C4121A]/20 rounded-xl flex items-center justify-center">
              <FaDollarSign className="text-[#C4121A]" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">الكل</div>
              <div className="text-2xl font-bold text-[#111214]">{total}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <FaClock className="text-yellow-400" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">قيد الانتظار</div>
              <div className="text-2xl font-bold text-[#111214]">
                {commissions.filter((c) => c.status === "pending").length}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <FaCheckCircle className="text-blue-400" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">تمت الموافقة</div>
              <div className="text-2xl font-bold text-[#111214]">
                {commissions.filter((c) => c.status === "approved").length}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <FaDollarSign className="text-green-400" />
            </div>
            <div>
              <div className="text-[#62666D] text-sm">تم الدفع</div>
              <div className="text-2xl font-bold text-[#111214]">
                {commissions.filter((c) => c.status === "paid").length}
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
              placeholder="بحث..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-light w-full rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-[#C4121A]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as CommissionStatus | ""); setPage(1); }}
            className="select-light rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C4121A]"
          >
            <option value="">جميع الحالات</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
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
        ) : commissions.length === 0 ? (
          <div className="text-center py-16">
            <FaDollarSign className="mx-auto text-[#62666D] text-4xl mb-4" />
            <p className="text-[#62666D]">لا توجد عمولات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E8EA]">
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الشريك</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الإحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الخدمة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">المبلغ</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">النوع</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">التاريخ</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#E7E8EA]/50 hover:bg-[#F1F2F3] transition-colors"
                  >
                    <td className="px-6 py-4 text-[#111214] text-sm">
                      {(c.dealer as { business_name?: string })?.business_name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#111214]">
                        {(c.referral as { referral_code?: string })?.referral_code || "—"}
                      </div>
                      <div className="text-xs text-[#62666D]">
                        {(c.referral as { customer_name?: string })?.customer_name || ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#111214] text-sm">
                      {(c.service as { name?: string })?.name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-[#111214]">{formatAmount(c.calculated_amount)}</span>
                      <span className="text-[#62666D] text-xs mr-1">ر.س</span>
                    </td>
                    <td className="px-6 py-4 text-[#111214] text-sm">
                      {c.calculation_type === "fixed" ? "ثابت" : `نسبة ${c.rate_value}%`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#62666D] text-sm">
                      {new Date(c.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="px-6 py-4">
                      {actionLoading === c.id ? (
                        <FaSpinner className="animate-spin text-[#C4121A]" />
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {c.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(c.id)}
                                className="text-xs px-2 py-1 rounded-lg border bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20 transition-colors"
                              >
                                موافقة
                              </button>
                              <button
                                onClick={() => handleCancel(c.id)}
                                className="text-xs px-2 py-1 rounded-lg border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition-colors"
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                          {c.status === "approved" && (
                            <>
                              <button
                                onClick={() => handlePay(c.id)}
                                className="text-xs px-2 py-1 rounded-lg border bg-[#C4121A]/10 text-[#C4121A] border-[#C4121A]/30 hover:bg-[#C4121A]/20 transition-colors"
                              >
                                دفع
                              </button>
                              <button
                                onClick={() => handleCancel(c.id)}
                                className="text-xs px-2 py-1 rounded-lg border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition-colors"
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                        </div>
                      )}
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
