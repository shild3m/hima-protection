"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FaSearch,
  FaPlus,
  FaBuilding,
  FaPhone,
  FaEnvelope,
  FaSortAmountDown,
  FaSortAmountUp,
  FaChevronLeft,
  FaChevronRight,
  FaSpinner,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { getDealers, createDealer } from "@/app/actions/dealer";
import type { DealerWithStats, DealerFilters, SortConfig } from "@/lib/types";

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

export default function DealersPage() {
  const [dealers, setDealers] = useState<DealerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<SortConfig>({
    field: "created_at",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [newDealer, setNewDealer] = useState({
    business_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const filters: DealerFilters = {};
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      const result = await getDealers(filters, sort, page, 20);
      if (cancelled) return;
      setDealers(result.data);
      setTotalPages(result.total_pages);
      setTotal(result.total);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [search, statusFilter, sort, page]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    const result = await createDealer(newDealer);
    setCreating(false);
    if (result.success) {
      setCreateSuccess(true);
      setNewDealer({ business_name: "", phone: "", email: "", address: "", notes: "" });
      setTimeout(() => {
        setShowCreate(false);
        setCreateSuccess(false);
        setPage(1);
      }, 1500);
    } else {
      setCreateError(result.error || "حدث خطأ");
    }
  };

  const toggleSort = (field: string) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الشركاء</h1>
          <p className="text-[#62666D] mt-1">إدارة شركاء التوزيع</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#C4121A] hover:bg-[#A00F16] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <FaPlus /> إضافة شريك
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="text-[#62666D] text-sm">إجمالي الشركاء</div>
          <div className="text-2xl font-bold mt-1">{total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="text-[#62666D] text-sm">الشركاء النشطون</div>
          <div className="text-2xl font-bold text-[#059669] mt-1">
            {dealers.filter((d) => d.status === "active").length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E7E8EA]">
          <div className="text-[#62666D] text-sm">الإحالات</div>
          <div className="text-2xl font-bold text-[#C4121A] mt-1">
            {dealers.reduce((sum, d) => sum + (d.referral_count || 0), 0)}
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
              placeholder="بحث بالاسم أو الهاتف أو البريد..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-light w-full pr-10 pl-4"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="select-light px-4 py-2.5"
            >
              <option value="">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="suspended">معلق</option>
            </select>
            <button
              onClick={() => toggleSort("business_name")}
              className="flex items-center gap-2 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl px-4 py-2.5 hover:bg-[#E7E8EA] transition-colors"
            >
              {sort.field === "business_name" && sort.direction === "asc" ? (
                <FaSortAmountUp />
              ) : (
                <FaSortAmountDown />
              )}
              الاسم
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E7E8EA] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <FaSpinner className="animate-spin text-[#C4121A] text-2xl" />
          </div>
        ) : dealers.length === 0 ? (
          <div className="text-center py-16">
            <FaBuilding className="mx-auto text-[#62666D] text-4xl mb-4" />
            <p className="text-[#62666D]">لا يوجد شركاء</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E8EA]">
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الاسم</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الهاتف</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">البريد</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الحالة</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">الإحالات</th>
                  <th className="text-right px-6 py-4 text-[#62666D] font-medium text-sm">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((dealer) => (
                  <tr
                    key={dealer.id}
                    className="border-b border-[#E7E8EA]/50 hover:bg-[#F7F7F5] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/crm/dealers/${dealer.id}`}
                        className="flex items-center gap-3 hover:text-[#C4121A] transition-colors"
                      >
                        <div className="w-10 h-10 bg-[#C4121A]/10 rounded-xl flex items-center justify-center">
                          <FaBuilding className="text-[#C4121A]" />
                        </div>
                        <div>
                          <div className="font-medium">{dealer.business_name}</div>
                          {dealer.address && (
                            <div className="text-xs text-[#62666D] flex items-center gap-1 mt-0.5">
                              <FaMapMarkerAlt /> {dealer.address}
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#111214]">
                        <FaPhone className="text-[#62666D] text-xs" />
                        {dealer.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#111214]">
                        <FaEnvelope className="text-[#62666D] text-xs" />
                        {dealer.email || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border ${
                          STATUS_COLORS[dealer.status] || STATUS_COLORS.active
                        }`}
                      >
                        {STATUS_LABELS[dealer.status] || dealer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#111214]">
                      {dealer.referral_count || 0}
                    </td>
                    <td className="px-6 py-4 text-[#62666D] text-sm">
                      {new Date(dealer.created_at).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E7E8EA]">
            <div className="text-[#62666D] text-sm">
              صفحة {page} من {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-[#F1F2F3] disabled:opacity-50 hover:bg-[#E7E8EA] transition-colors"
              >
                <FaChevronRight />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-[#F1F2F3] disabled:opacity-50 hover:bg-[#E7E8EA] transition-colors"
              >
                <FaChevronLeft />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-[#E7E8EA] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E8EA]">
              <h2 className="text-lg font-bold">إضافة شريك جديد</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#62666D] hover:text-[#111214]">
                <FaTimes />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {createSuccess && (
                <div className="flex items-center gap-2 bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-3 text-[#059669]">
                  <FaCheckCircle /> تم الإنشاء بنجاح
                </div>
              )}
              {createError && (
                <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#DC2626]/20 rounded-xl p-3 text-[#DC2626]">
                  <FaExclamationTriangle /> {createError}
                </div>
              )}
              <div>
                <label className="label-light">اسم النشاط *</label>
                <input
                  type="text"
                  value={newDealer.business_name}
                  onChange={(e) => setNewDealer({ ...newDealer, business_name: e.target.value })}
                  className="input-light w-full"
                  placeholder="اسم النشاط التجاري"
                />
              </div>
              <div>
                <label className="label-light">رقم الهاتف *</label>
                <input
                  type="text"
                  value={newDealer.phone}
                  onChange={(e) => setNewDealer({ ...newDealer, phone: e.target.value })}
                  className="input-light w-full"
                  placeholder="05XXXXXXXX"
                />
              </div>
              <div>
                <label className="label-light">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={newDealer.email}
                  onChange={(e) => setNewDealer({ ...newDealer, email: e.target.value })}
                  className="input-light w-full"
                  placeholder="dealer@example.com"
                />
              </div>
              <div>
                <label className="label-light">العنوان</label>
                <input
                  type="text"
                  value={newDealer.address}
                  onChange={(e) => setNewDealer({ ...newDealer, address: e.target.value })}
                  className="input-light w-full"
                  placeholder="المدينة، المنطقة"
                />
              </div>
              <div>
                <label className="label-light">ملاحظات</label>
                <textarea
                  value={newDealer.notes}
                  onChange={(e) => setNewDealer({ ...newDealer, notes: e.target.value })}
                  rows={3}
                  className="textarea-light w-full resize-none"
                  placeholder="ملاحظات إضافية..."
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-[#E7E8EA]">
              <button
                onClick={handleCreate}
                disabled={creating || !newDealer.business_name || !newDealer.phone}
                className="flex-1 bg-[#C4121A] hover:bg-[#A00F16] text-white py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {creating ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                {creating ? "جاري الإنشاء..." : "إنشاء"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-6 py-2.5 bg-[#F1F2F3] hover:bg-[#E7E8EA] rounded-xl transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
