"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FaSearch,
  FaPlus,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaCar,
  FaCalendarAlt,
  FaFilter,
  FaSortAmountDown,
  FaSortAmountUp,
  FaChevronLeft,
  FaChevronRight,
  FaSpinner,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { getCustomers, createCustomer } from "@/app/actions/crm";
import type { CustomerWithStats, CustomerFilters, SortConfig } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "حضور مباشر",
  referral: "إحالة",
  online: "أونلاين",
  social: "سوشيال",
  phone: "هاتف",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
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
  const [newCustomer, setNewCustomer] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "walk_in",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const filters: CustomerFilters = {};
      if (search) filters.search = search;
      if (sourceFilter) filters.source = sourceFilter;
      const result = await getCustomers(filters, sort, page, 20);
      if (cancelled) return;
      setCustomers(result.data);
      setTotalPages(result.total_pages);
      setTotal(result.total);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [search, sourceFilter, sort, page]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    const result = await createCustomer(newCustomer);
    setCreating(false);
    if (result.success) {
      setCreateSuccess(true);
      setShowCreate(false);
      setNewCustomer({ full_name: "", phone: "", email: "", source: "walk_in" });
      setPage(1);
      setSearch("");
      setSourceFilter("");
      setTimeout(() => setCreateSuccess(false), 3000);
    } else {
      setCreateError(result.error || "حدث خطأ");
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">العملاء</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-3 bg-[#C4121A] hover:bg-[#A00F15] text-white font-bold rounded-xl transition-colors"
        >
          <FaPlus /> عميل جديد
        </button>
      </div>

      {createSuccess && (
        <div className="flex items-center gap-3 p-4 bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl mb-6">
          <FaCheckCircle className="text-[#059669]" />
          <p className="text-[#059669] text-sm">تم إنشاء العميل بنجاح</p>
        </div>
      )}

      {/* Search & Filters */}
      <div className="card-light rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D]" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف أو البريد..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-light w-full pr-10"
              dir="rtl"
            />
          </div>
          <div className="relative">
            <FaFilter className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D]" />
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="select-light w-full pr-10 appearance-none"
            >
              <option value="">جميع المصادر</option>
              <option value="walk_in">حضور مباشر</option>
              <option value="referral">إحالة</option>
              <option value="online">أونلاين</option>
              <option value="social">سوشيال</option>
              <option value="phone">هاتف</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setSort({
                  field: "created_at",
                  direction: sort.direction === "desc" ? "asc" : "desc",
                })
              }
              className="flex items-center gap-2 px-4 py-3 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl hover:border-[#C4121A] transition-colors"
            >
              {sort.direction === "desc" ? (
                <FaSortAmountDown />
              ) : (
                <FaSortAmountUp />
              )}
              التاريخ
            </button>
            <button
              onClick={() =>
                setSort({
                  field: "full_name",
                  direction: sort.direction === "desc" ? "asc" : "desc",
                })
              }
              className="flex items-center gap-2 px-4 py-3 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl hover:border-[#C4121A] transition-colors"
            >
              {sort.direction === "desc" ? (
                <FaSortAmountDown />
              ) : (
                <FaSortAmountUp />
              )}
              الاسم
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mb-4 text-[#62666D] text-sm">
        {total} نتيجة
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <FaSpinner className="animate-spin text-[#C4121A] text-3xl" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-20 card-light rounded-2xl">
          <FaUser className="text-[#62666D] text-4xl mx-auto mb-4" />
          <p className="text-[#62666D] text-lg">لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/crm/customers/${customer.id}`}
              className="card-light rounded-2xl p-6 hover:border-[#C4121A] transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#C4121A]/10 rounded-full flex items-center justify-center">
                  <FaUser className="text-[#C4121A] text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{customer.full_name}</h3>
                  <p className="text-[#62666D] text-sm flex items-center gap-1">
                    <FaPhone className="text-[10px]" />
                    {customer.phone}
                  </p>
                </div>
              </div>
              {customer.email && (
                <p className="text-[#62666D] text-sm flex items-center gap-1 mb-2">
                  <FaEnvelope className="text-[10px]" />
                  {customer.email}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#62666D]">
                  {customer.source
                    ? SOURCE_LABELS[customer.source] || customer.source
                    : ""}
                </span>
                <div className="flex items-center gap-3 text-[#62666D]">
                  <span className="flex items-center gap-1">
                    <FaCar className="text-[10px]" />
                    {customer.vehicle_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <FaCalendarAlt className="text-[10px]" />
                    {customer.booking_count || 0}
                  </span>
                </div>
              </div>
              {!customer.is_active && (
                <span className="inline-block mt-2 px-2 py-1 bg-[#FEF2F2] text-[#DC2626] text-xs rounded-lg">
                  غير نشط
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-3 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl disabled:opacity-50 hover:border-[#C4121A] transition-colors"
          >
            <FaChevronRight />
          </button>
          <span className="text-[#62666D]">
            صفحة {page} من {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-3 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl disabled:opacity-50 hover:border-[#C4121A] transition-colors"
          >
            <FaChevronLeft />
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E7E8EA] rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">عميل جديد</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-[#62666D] hover:text-[#111214]"
              >
                <FaTimes />
              </button>
            </div>
            {createError && (
              <div className="flex items-center gap-2 p-3 bg-[#FEF2F2] border border-[#DC2626]/20 rounded-xl mb-4">
                <FaExclamationTriangle className="text-[#DC2626]" />
                <p className="text-[#DC2626] text-sm">{createError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="label-light">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={newCustomer.full_name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, full_name: e.target.value })
                  }
                  className="input-light w-full"
                  placeholder="الاسم الكامل"
                />
              </div>
              <div>
                <label className="label-light">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="input-light w-full"
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label-light">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  className="input-light w-full"
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label-light">
                  المصدر
                </label>
                <select
                  value={newCustomer.source}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, source: e.target.value })
                  }
                  className="select-light w-full appearance-none"
                >
                  <option value="walk_in">حضور مباشر</option>
                  <option value="referral">إحالة</option>
                  <option value="online">أونلاين</option>
                  <option value="social">سوشيال</option>
                  <option value="phone">هاتف</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-[#C4121A] hover:bg-[#A00F15] text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creating ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  "إنشاء"
                )}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-6 py-3 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl hover:border-[#C4121A] transition-colors"
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
