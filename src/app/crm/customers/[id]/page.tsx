"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FaUser,
  FaPhone,
  FaCar,
  FaCalendarAlt,
  FaStickyNote,
  FaSpinner,
  FaArrowRight,
  FaPlus,
  FaTrash,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaEdit,
  FaBan,
} from "react-icons/fa";
import {
  getCustomerWithDetails,
  updateCustomer,
  softDeleteCustomer,
  createCustomerNote,
  deleteCustomerNote,
  createVehicle,
} from "@/app/actions/crm";
import type {
  Customer,
  CustomerNote,
  Vehicle,
  Booking,
} from "@/lib/types";

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

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<
    (Booking & { service_name?: string })[]
  >([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "",
  });
  const [saving, setSaving] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    year: "",
    color: "",
    plate_number: "",
  });
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getCustomerWithDetails(customerId);
      if (cancelled) return;
      setCustomer(result.customer);
      setVehicles(result.vehicles);
      setBookings(result.bookings);
      setNotes(result.notes);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [customerId, refreshKey]);

  const handleUpdate = async () => {
    setSaving(true);
    setError("");
    const result = await updateCustomer(customerId, editData);
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

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    const result = await createCustomerNote({
      customer_id: customerId,
      content: noteContent,
    });
    setAddingNote(false);
    if (result.success) {
      setNoteContent("");
      setRefreshKey(k => k + 1);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const result = await deleteCustomerNote(noteId);
    if (result.success) {
      setRefreshKey(k => k + 1);
    }
  };

  const handleAddVehicle = async () => {
    setAddingVehicle(true);
    setError("");
    const result = await createVehicle({
      customer_id: customerId,
      make: newVehicle.make,
      model: newVehicle.model,
      year: newVehicle.year ? parseInt(newVehicle.year) : undefined,
      color: newVehicle.color || undefined,
      plate_number: newVehicle.plate_number || undefined,
    });
    setAddingVehicle(false);
    if (result.success) {
      setShowAddVehicle(false);
      setNewVehicle({ make: "", model: "", year: "", color: "", plate_number: "" });
      setSuccess("تم إضافة السيارة");
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(result.error || "حدث خطأ");
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("هل أنت متأكد من تعطيل هذا العميل؟")) return;
    setDeactivating(true);
    const result = await softDeleteCustomer(customerId);
    setDeactivating(false);
    if (result.success) {
      setSuccess("تم تعطيل العميل");
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

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-[#62666D] text-lg">العميل غير موجود</p>
        <Link
          href="/crm/customers"
          className="mt-4 inline-block text-[#C4121A] hover:underline"
        >
          العودة للعملاء
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/crm/customers"
        className="flex items-center gap-2 text-[#62666D] hover:text-[#111214] mb-6 transition-colors"
      >
        <FaArrowRight /> العودة للعملاء
      </Link>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl mb-6">
          <FaCheckCircle className="text-[#059669]" />
          <p className="text-[#059669] text-sm">{success}</p>
        </div>
      )}

      {/* Customer Info */}
      <div className="card-light rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#C4121A]/10 rounded-full flex items-center justify-center">
              <FaUser className="text-[#C4121A] text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black">{customer.full_name}</h1>
              <p className="text-[#62666D] flex items-center gap-1">
                <FaPhone className="text-[10px]" />
                {customer.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(true);
                setEditData({
                  full_name: customer.full_name,
                  phone: customer.phone,
                  email: customer.email || "",
                  source: customer.source || "",
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#F1F2F3] border border-[#E7E8EA] rounded-xl hover:border-[#C4121A] transition-colors"
            >
              <FaEdit /> تعديل
            </button>
            {customer.is_active && (
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
          <div>
            <span className="text-[#62666D]">البريد الإلكتروني</span>
            <p className="mt-1">{customer.email || "—"}</p>
          </div>
          <div>
            <span className="text-[#62666D]">المصدر</span>
            <p className="mt-1">{customer.source || "—"}</p>
          </div>
          <div>
            <span className="text-[#62666D]">تاريخ التسجيل</span>
            <p className="mt-1">
              {new Date(customer.created_at).toLocaleDateString("en-GB")}
            </p>
          </div>
          <div>
            <span className="text-[#62666D]">الحالة</span>
            <p className="mt-1">
              {customer.is_active ? (
                <span className="text-[#059669]">نشط</span>
              ) : (
                <span className="text-[#DC2626]">غير نشط</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Vehicles */}
      <div className="card-light rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaCar className="text-[#C4121A]" /> السيارات ({vehicles.length})
          </h2>
          <button
            onClick={() => setShowAddVehicle(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#C4121A] hover:bg-[#A00F15] text-white font-bold rounded-xl transition-colors text-sm"
          >
            <FaPlus /> إضافة سيارة
          </button>
        </div>

        {vehicles.length === 0 ? (
          <p className="text-[#62666D] text-center py-8">لا توجد سيارات مسجلة</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/crm/vehicles/${v.id}`}
                className="bg-[#F7F7F5] border border-[#E7E8EA] rounded-xl p-4 hover:border-[#C4121A] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E7E8EA] rounded-lg flex items-center justify-center">
                    <FaCar className="text-[#62666D]" />
                  </div>
                  <div>
                    <p className="font-bold">
                      {v.make} {v.model}
                    </p>
                    <p className="text-[#62666D] text-sm">
                      {v.year} {v.plate_number ? `• ${v.plate_number}` : ""}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bookings */}
      <div className="card-light rounded-2xl p-8 mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <FaCalendarAlt className="text-[#C4121A]" /> الحجوزات ({bookings.length})
        </h2>
        {bookings.length === 0 ? (
          <p className="text-[#62666D] text-center py-8">لا توجد حجوزات</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-[#F7F7F5] border border-[#E7E8EA] rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold">{b.service_name || "خدمة"}</p>
                  <p className="text-[#62666D] text-sm">
                    {b.preferred_date} {b.preferred_time}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    STATUS_COLORS[b.status] || "bg-[#F1F2F3] text-[#62666D]"
                  }`}
                >
                  {STATUS_LABELS[b.status] || b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card-light rounded-2xl p-8">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <FaStickyNote className="text-[#C4121A]" /> الملاحظات ({notes.length})
        </h2>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="أضف ملاحظة..."
            className="input-light flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !noteContent.trim()}
            className="px-6 py-3 bg-[#C4121A] hover:bg-[#A00F15] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {addingNote ? <FaSpinner className="animate-spin" /> : <FaPlus />}
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="text-[#62666D] text-center py-8">لا توجد ملاحظات</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-[#F7F7F5] border border-[#E7E8EA] rounded-xl p-4 flex items-start justify-between"
              >
                <div>
                  <p>{note.content}</p>
                  <p className="text-[#62666D] text-xs mt-2">
                    {new Date(note.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-[#62666D] hover:text-[#DC2626] transition-colors p-1"
                >
                  <FaTrash />
                </button>
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
              <h2 className="text-xl font-bold">تعديل العميل</h2>
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
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={editData.full_name}
                  onChange={(e) =>
                    setEditData({ ...editData, full_name: e.target.value })
                  }
                  className="input-light w-full"
                />
              </div>
              <div>
                <label className="label-light">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) =>
                    setEditData({ ...editData, phone: e.target.value })
                  }
                  className="input-light w-full"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label-light">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) =>
                    setEditData({ ...editData, email: e.target.value })
                  }
                  className="input-light w-full"
                  dir="ltr"
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

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E7E8EA] rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">إضافة سيارة</h2>
              <button
                onClick={() => setShowAddVehicle(false)}
                className="text-[#62666D] hover:text-[#111214]"
              >
                <FaTimes />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-light">
                  الماركة *
                </label>
                <input
                  type="text"
                  value={newVehicle.make}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, make: e.target.value })
                  }
                  className="input-light w-full"
                  placeholder="مثال: تويوتا"
                />
              </div>
              <div>
                <label className="label-light">
                  الطراز *
                </label>
                <input
                  type="text"
                  value={newVehicle.model}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, model: e.target.value })
                  }
                  className="input-light w-full"
                  placeholder="مثال: كامري"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-light">
                    السنة
                  </label>
                  <input
                    type="number"
                    value={newVehicle.year}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, year: e.target.value })
                    }
                    className="input-light w-full"
                    placeholder="2024"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="label-light">
                    اللون
                  </label>
                  <input
                    type="text"
                    value={newVehicle.color}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, color: e.target.value })
                    }
                    className="input-light w-full"
                    placeholder="أبيض"
                  />
                </div>
              </div>
              <div>
                <label className="label-light">
                  رقم اللوحة
                </label>
                <input
                  type="text"
                  value={newVehicle.plate_number}
                  onChange={(e) =>
                    setNewVehicle({
                      ...newVehicle,
                      plate_number: e.target.value,
                    })
                  }
                  className="input-light w-full"
                  placeholder="أ ب ج 1234"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddVehicle}
                disabled={addingVehicle}
                className="flex-1 bg-[#C4121A] hover:bg-[#A00F15] text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {addingVehicle ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  "إضافة"
                )}
              </button>
              <button
                onClick={() => setShowAddVehicle(false)}
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
