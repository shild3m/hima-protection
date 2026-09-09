"use server";

import { createClient } from "@/lib/supabase/server";

export interface BookingInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor?: string;
  vehiclePlate?: string;
  serviceId: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  message?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function validateInput(input: BookingInput): string | null {
  if (!input.customerName || input.customerName.trim().length < 2) {
    return "الاسم مطلوب (حرفين على الأقل)";
  }

  const normalizedPhone = normalizePhone(input.customerPhone);
  if (normalizedPhone.length < 5) {
    return "رقم الهاتف غير صحيح";
  }

  if (!input.vehicleMake || input.vehicleMake.trim().length < 1) {
    return "ماركة السيارة مطلوبة";
  }

  if (!input.vehicleModel || input.vehicleModel.trim().length < 1) {
    return "موديل السيارة مطلوب";
  }

  if (
    !input.vehicleYear ||
    input.vehicleYear < 1900 ||
    input.vehicleYear > new Date().getFullYear() + 1
  ) {
    return "سنة الصنع غير صحيحة";
  }

  if (!input.serviceId) {
    return "يرجى اختيار الخدمة";
  }

  if (!input.preferredDate) {
    return "التاريخ المفضل مطلوب";
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input.preferredDate)) {
    return "صيغة التاريخ غير صحيحة";
  }

  const preferredDate = new Date(input.preferredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preferredDate < today) {
    return "يجب أن يكون التاريخ في المستقبل";
  }

  if (!input.preferredTime) {
    return "الوقت المفضل مطلوب";
  }

  if (input.customerEmail && input.customerEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.customerEmail.trim())) {
      return "البريد الإلكتروني غير صحيح";
    }
  }

  return null;
}

export async function createBooking(
  input: BookingInput
): Promise<BookingResult> {
  // 1. Server-side validation
  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // 2. Call Supabase RPC function
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_booking", {
    p_customer_name: input.customerName.trim(),
    p_customer_phone: normalizePhone(input.customerPhone),
    p_customer_email: input.customerEmail?.trim() || null,
    p_vehicle_make: input.vehicleMake.trim(),
    p_vehicle_model: input.vehicleModel.trim(),
    p_vehicle_year: input.vehicleYear,
    p_vehicle_color: input.vehicleColor?.trim() || null,
    p_vehicle_plate: input.vehiclePlate?.trim() || null,
    p_service_id: input.serviceId,
    p_preferred_date: input.preferredDate,
    p_preferred_time: input.preferredTime,
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: input.idempotencyKey || null,
  });

  if (error) {
    console.error("Booking RPC error:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء إنشاء الحجز. يرجى المحاولة مرة أخرى.",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
    };
  }

  const result = data as {
    success: boolean;
    booking_id?: string;
    error?: string;
    message?: string;
  };

  if (!result.success) {
    return { success: false, error: result.error || "حدث خطأ" };
  }

  return {
    success: true,
    bookingId: result.booking_id,
    message: result.message || "تم استلام طلب الحجز بنجاح",
  };
}
