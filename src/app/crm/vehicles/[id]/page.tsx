"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FaCar,
  FaUser,
  FaCalendarAlt,
  FaSpinner,
  FaArrowRight,
  FaEdit,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPaintBrush,
  FaIdCard,
  FaClock,
  FaBan,
} from "react-icons/fa";
import { getVehicleWithHistory, updateVehicle, softDeleteVehicle } from "@/app/actions/crm";
import type { Vehicle, BookingStatusHistory } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  confirmed: "مؤكد",
  arrived: "وصل",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
  no_show: "لم يحضر",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600",
  contacted: "bg-yellow-500/10 text-yellow-600",
  confirmed: "bg-[#10B981]/8 text-[#059669]",
  arrived: "bg-purple-500/10 text-purple-600",
  in_progress: "bg-orange-500/10 text-orange-600",
  completed: "bg-[#10B981]/8 text-[#059669]",
  cancelled: "bg-[#FEF2F2] text-[#DC2626]",
  no_show: "bg-[#F1F2F3] text-[#62666D]",
};

export default function VehicleDetailPage() {
  const params = useParams();
  const vehicleId = params.id as string;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<BookingStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    make: "",
    model: "",
    year: "",
    color: "",
    plate_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getVehicleWithHistory(vehicleId);
      if (cancelled) return;
      setVehicle(result.vehicle);
      setHistory(result.history || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [vehicleId, refreshKey]);

  const handleUpdate = async () => {
    setSaving(true);
    setError("");
    const result = await updateVehicle(vehicleId, {
      make: editData.make,
      model: editData.model,
      year: editData.year ? parseInt(editData.year) : undefined,
      color: editData.color || undefined,
      plate_number: editData.plate_number || undefined,
    });
    setSaving(false);
    if (result.success) {
      setEditing(false);
      setSuccess("تم تحديث البيانات");
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("هل أنت متأكد من تعطيل هذه السيارة؟")) return;
    setDeactivating(true);
    const result = await softDeleteVehicle(vehicleId);
    setDeactivating(false);
    if (result.success) {
      setSuccess("تم تعطيل السيارة");
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <FaSpinner className="animate-spin text-[#C4121A] text-3xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20">
        <p className="text-[#62666D] text-lg">السيارة غير موجودة</p>
        <Link
          href="/crm/vehicles"
          className="mt-4 inline-block text-[#C4121A] hover:underline"
        >
          العودة للسيارات
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/crm/vehicles"
        className="flex items-center gap-2 text-[#62666D] hover:text-[#111214] mb-6 transition-colors"
      >
        <FaArrowRight /> العودة للسيارات
      </Link>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl mb-6">
          <FaCheckCircle className="text-[#059669]" />
          <p className="text-[#059669] text-sm">{success}</p>
        </div>
      )}

      {/* Vehicle Info */}
      <div className="card-light rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#F1F2F3] rounded-2xl flex items-center justify-center">
              <FaCar className="text-[#C4121A] text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black">
                {vehicle.make} {vehicle.model}
              </h1>
              <p className="text-[#62666D]">
                {vehicle.year}
                {vehicle.color ? ` • ${vehicle.color}` : ""}
                {vehicle.plate_number ? ` • ${vehicle.plate_number}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(true);
                setEditData({
                  make: vehicle.make,
                  model: vehicle.model,
                  year: vehicle.year?.toString() || "",
                  color: vehicle.color || "",
                  plate_number: vehicle.plate_number || "",
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl hover:border-[#C4121A] transition-colors"
            >
              <FaEdit /> تعديل
            </button>
            {vehicle.is_active && (
              <button
                onClick={handleDeactivate}
                disabled={deactivating}
                className="flex items-center gap-2 px-4 py-2 bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626] rounded-xl hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
              >
                {deactivating ? <FaSpinner className="animate-spin" /> : <FaBan />} تعطيل
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#FEF2F2] border border-[#DC2626]/20 rounded-xl mb-4">
            <FaExclamationTriangle className="text-[#DC2626]" />
            <p className="text-[#DC2626] text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FaCar className="text-[#62666D] text-[10px]" />
            <div>
              <span className="text-[#62666D]">الماركة</span>
              <p className="mt-1 font-bold">{vehicle.make}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FaIdCard className="text-[#62666D] text-[10px]" />
            <div>
              <span className="text-[#62666D]">الطراز</span>
              <p className="mt-1 font-bold">{vehicle.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FaClock className="text-[#62666D] text-[10px]" />
            <div>
              <span className="text-[#62666D]">السنة</span>
              <p className="mt-1 font-bold">{vehicle.year || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FaPaintBrush className="text-[#62666D] text-[10px]" />
            <div>
              <span className="text-[#62666D]">اللون</span>
              <p className="mt-1 font-bold">{vehicle.color || "—"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[#62666D]">رقم اللوحة</span>
            <p className="mt-1 font-bold">{vehicle.plate_number || "—"}</p>
          </div>
          <div>
            <span className="text-[#62666D]">الحالة</span>
            <p className="mt-1">
              {vehicle.is_active ? (
                <span className="text-[#059669] font-bold">نشط</span>
              ) : (
                <span className="text-[#DC2626] font-bold">غير نشط</span>
              )}
            </p>
          </div>
        </div>

        {vehicle.customer_id && (
          <div className="mt-4 pt-4 border-t border-[#E7E8EA]">
            <Link
              href={`/crm/customers/${vehicle.customer_id}`}
              className="flex items-center gap-2 text-[#C4121A] hover:underline"
            >
              <FaUser /> عرض بيانات المالك
            </Link>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card-light rounded-2xl p-8">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <FaCalendarAlt className="text-[#C4121A]" /> تاريخ الحالة
        </h2>

        {history.length === 0 ? (
          <p className="text-[#62666D] text-center py-8">لا يوجد سجل</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="bg-[#F7F7F5] border border-[#E7E8EA] rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded ${
                        h.old_status ? (STATUS_COLORS[h.old_status] || "bg-[#F1F2F3] text-[#62666D]") : "bg-[#F1F2F3] text-[#62666D]"
                      }`}
                    >
                      {h.old_status ? (STATUS_LABELS[h.old_status] || h.old_status) : "—"}
                    </span>
                    <span className="text-[#62666D]">←</span>
                    <span
                      className={`px-2 py-1 rounded ${
                        STATUS_COLORS[h.new_status] || "bg-[#F1F2F3] text-[#62666D]"
                      }`}
                    >
                      {STATUS_LABELS[h.new_status] || h.new_status}
                    </span>
                  </div>
                  <span className="text-[#62666D] text-xs">
                    {new Date(h.created_at).toLocaleString("ar-SA")}
                  </span>
                </div>
                {h.notes && (
                  <p className="text-[#62666D] text-sm">{h.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E7E8EA] rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">تعديل السيارة</h2>
              <button
                onClick={() => setEditing(false)}
                className="text-[#62666D] hover:text-[#111214]"
              >
                <FaTimes />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-light">
                  الماركة
                </label>
                <input
                  type="text"
                  value={editData.make}
                  onChange={(e) =>
                    setEditData({ ...editData, make: e.target.value })
                  }
                  className="input-light w-full"
                />
              </div>
              <div>
                <label className="label-light">
                  الطراز
                </label>
                <input
                  type="text"
                  value={editData.model}
                  onChange={(e) =>
                    setEditData({ ...editData, model: e.target.value })
                  }
                  className="input-light w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-light">
                    السنة
                  </label>
                  <input
                    type="number"
                    value={editData.year}
                    onChange={(e) =>
                      setEditData({ ...editData, year: e.target.value })
                    }
                    className="input-light w-full"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="label-light">
                    اللون
                  </label>
                  <input
                    type="text"
                    value={editData.color}
                    onChange={(e) =>
                      setEditData({ ...editData, color: e.target.value })
                    }
                    className="input-light w-full"
                  />
                </div>
              </div>
              <div>
                <label className="label-light">
                  رقم اللوحة
                </label>
                <input
                  type="text"
                  value={editData.plate_number}
                  onChange={(e) =>
                    setEditData({ ...editData, plate_number: e.target.value })
                  }
                  className="input-light w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 bg-[#C4121A] hover:bg-[#A00F15] text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <FaSpinner className="animate-spin" /> : "حفظ"}
              </button>
              <button
                onClick={() => setEditing(false)}
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
