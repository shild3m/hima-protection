"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FaSearch,
  FaCar,
  FaUser,
  FaSortAmountDown,
  FaSortAmountUp,
  FaChevronLeft,
  FaChevronRight,
  FaSpinner,
} from "react-icons/fa";
import { getVehicles } from "@/app/actions/crm";
import type { VehicleWithCustomer, VehicleFilters, SortConfig } from "@/lib/types";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortConfig>({
    field: "created_at",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const filters: VehicleFilters = {};
      if (search) filters.search = search;
      const result = await getVehicles(filters, sort, page, 20);
      if (cancelled) return;
      setVehicles(result.data);
      setTotalPages(result.total_pages);
      setTotal(result.total);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [search, sort, page]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">السيارات</h1>
      </div>

      {/* Search */}
      <div className="card-light rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-[#62666D]" />
            <input
              type="text"
              placeholder="بحث بالماركة أو الطراز أو اللوحة..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-light w-full pr-10"
              dir="rtl"
            />
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
                  field: "make",
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
              الماركة
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 text-[#62666D] text-sm">{total} نتيجة</div>

      {loading ? (
        <div className="flex justify-center py-20">
          <FaSpinner className="animate-spin text-[#C4121A] text-3xl" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 card-light rounded-2xl">
          <FaCar className="text-[#62666D] text-4xl mx-auto mb-4" />
          <p className="text-[#62666D] text-lg">لا توجد سيارات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vehicle) => (
            <Link
              key={vehicle.id}
              href={`/crm/vehicles/${vehicle.id}`}
              className="card-light rounded-2xl p-6 hover:border-[#C4121A] transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#F1F2F3] rounded-full flex items-center justify-center">
                  <FaCar className="text-[#62666D] text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    {vehicle.make} {vehicle.model}
                  </h3>
                  <p className="text-[#62666D] text-sm">
                    {vehicle.year}
                    {vehicle.color ? ` • ${vehicle.color}` : ""}
                    {vehicle.plate_number ? ` • ${vehicle.plate_number}` : ""}
                  </p>
                </div>
              </div>
              {vehicle.customer && (
                <p className="text-[#62666D] text-sm flex items-center gap-1">
                  <FaUser className="text-[10px]" />
                  {vehicle.customer.full_name}
                </p>
              )}
              {!vehicle.is_active && (
                <span className="inline-block mt-2 px-2 py-1 bg-[#FEF2F2] text-[#DC2626] text-xs rounded-lg">
                  غير نشط
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

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
    </div>
  );
}
