"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/auth";
import { createNotificationsForRole } from "@/app/actions/notifications";
import type {
  Referral,
  ReferralWithServices,
  PaginatedResult,
  ReferralFilters,
  SortConfig,
  ReferralStatus,
} from "@/lib/types";

const MAX_PER_PAGE = 50;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// HELPERS
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function sanitizeSearch(input: string): string {
  return input.replace(/[%_]/g, "").trim();
}

function parsePagination(page: unknown, per_page: unknown) {
  const p = typeof page === "number" && page > 0 ? Math.floor(page) : 1;
  const pp =
    typeof per_page === "number" && per_page > 0
      ? Math.min(Math.floor(per_page), MAX_PER_PAGE)
      : 20;
  const from = (p - 1) * pp;
  const to = from + pp - 1;
  return { page: p, per_page: pp, from, to };
}

function generateReferralCode(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-4);
  const rand = Math.floor(100000 + Math.random() * 900000).toString();
  return `REF-${year}-${rand}`;
}

async function getDealerIdForUser(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("dealers")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.id || null;
}

const REFERRAL_SORT_FIELDS = [
  "created_at",
  "customer_name",
  "status",
  "updated_at",
];

function safeSortField(field: string, allowed: string[]): string {
  return allowed.includes(field) ? field : "created_at";
}

const VALID_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  created: ["contacted", "cancelled"],
  contacted: ["redeemed", "cancelled"],
  redeemed: ["completed", "cancelled"],
  expired: [],
  cancelled: [],
  completed: [],
};

async function writeAuditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  newValues: Record<string, unknown>,
  oldValues?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: newValues,
      old_values: oldValues || null,
    });
  } catch (auditError) {
    console.error("Audit log write failed (non-critical):", auditError);
  }
}

// ============================================================
// DEALER ACTIONS
// ============================================================

export async function createReferral(input: {
  customer_name: string;
  customer_phone: string;
  car_make?: string;
  car_model?: string;
  car_year?: number;
  car_color?: string;
  offer_id?: string;
  service_ids?: string[];
  primary_service_index?: number;
  notes?: string;
}): Promise<{
  success: boolean;
  referral?: Referral;
  referral_code?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "يجب تسجيل الدخول" };
    }

    const dealerId = await getDealerIdForUser(user.id);
    if (!dealerId) {
      return { success: false, error: "لا يوجد حساب شريك مرتبط بحسابك" };
    }

    if (!input.customer_name || input.customer_name.trim().length < 2) {
      return { success: false, error: "اسم العميل مطلوب (حرفين على الأقل)" };
    }
    if (input.customer_name.trim().length > 200) {
      return { success: false, error: "اسم العميل طويل جداً" };
    }
    if (
      !input.customer_phone ||
      input.customer_phone.replace(/[^0-9]/g, "").length < 5
    ) {
      return { success: false, error: "رقم هاتف العميل غير صحيح" };
    }
    if (input.customer_phone.replace(/[^0-9]/g, "").length > 20) {
      return { success: false, error: "رقم هاتف العميل طويل جداً" };
    }
    if (input.car_year !== undefined && input.car_year !== null) {
      const y = input.car_year;
      if (y < 1900 || y > new Date().getFullYear() + 1) {
        return { success: false, error: "سنة الصنع غير صحيحة" };
      }
    }

    // Validate offer_id exists if provided
    if (input.offer_id && isValidUUID(input.offer_id)) {
      const admin = getSupabaseAdmin();
      const { data: offer } = await admin
        .from("offers")
        .select("id, is_active")
        .eq("id", input.offer_id)
        .maybeSingle();
      if (!offer) {
        return { success: false, error: "العرض المحدد غير موجود" };
      }
      if (!offer.is_active) {
        return { success: false, error: "العرض المحدد غير نشط" };
      }
    } else if (input.offer_id) {
      return { success: false, error: "معرف العرض غير صحيح" };
    }

    // Validate service_ids exist if provided
    if (input.service_ids && input.service_ids.length > 0) {
      const admin = getSupabaseAdmin();
      const { data: services } = await admin
        .from("services")
        .select("id")
        .in("id", input.service_ids);
      if (!services || services.length !== input.service_ids.length) {
        return { success: false, error: "بعض الخدمات المحددة غير موجودة" };
      }
    }

    let referralCode = generateReferralCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from("referrals")
        .select("id")
        .eq("referral_code", referralCode)
        .maybeSingle();
      if (!existing) break;
      referralCode = generateReferralCode();
      attempts++;
    }

    const normalizedPhone = input.customer_phone.replace(/[^0-9]/g, "");

    const { data: referral, error: insertError } = await supabase
      .from("referrals")
      .insert({
        referral_code: referralCode,
        dealer_id: dealerId,
        customer_name: input.customer_name.trim(),
        customer_phone: normalizedPhone,
        car_make: input.car_make?.trim() || null,
        car_model: input.car_model?.trim() || null,
        car_year: input.car_year || null,
        car_color: input.car_color?.trim() || null,
        offer_id: input.offer_id || null,
        status: "created",
        notes: input.notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return { success: false, error: "رقم الإحالة موجود بالفعل، يرجى المحاولة مرة أخرى" };
      }
      console.error("createReferral DB error:", insertError.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء الإحالة" };
    }

    // Insert referral_services (bypass RLS via admin client)
    if (input.service_ids && input.service_ids.length > 0) {
      const admin = getSupabaseAdmin();
      const serviceRows = input.service_ids.map((sid, idx) => ({
        referral_id: referral.id,
        service_id: sid,
        is_primary: idx === (input.primary_service_index ?? 0),
      }));

      const { error: rsError } = await admin
        .from("referral_services")
        .insert(serviceRows);

      if (rsError) {
        console.error("createReferral services insert error:", rsError.message);
      }
    }

    // Audit log
    await writeAuditLog(user.id, "referral_created", "referrals", referral.id, {
      referral_code: referralCode,
      customer_name: input.customer_name.trim(),
      dealer_id: dealerId,
      offer_id: input.offer_id || null,
    });

    createNotificationsForRole('referrals', 'read', 'referral_created', 'إحالة جديدة', `تم إنشاء إحالة ${referralCode}`, 'referrals', referral.id).catch(() => {});

    return { success: true, referral, referral_code: referralCode };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("createReferral unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function getMyReferrals(
  filters: ReferralFilters = {},
  sort: SortConfig = { field: "created_at", direction: "desc" },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<ReferralWithServices>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const dealerId = await getDealerIdForUser(user.id);
    if (!dealerId) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase
      .from("referrals")
      .select("*, referral_services:referral_services(*)", { count: "exact" });

    query = query.eq("dealer_id", dealerId);

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.or(
          `customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,referral_code.ilike.%${s}%`
        );
      }
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const sortField = safeSortField(sort.field, REFERRAL_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getMyReferrals error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    return {
      data: (data || []) as ReferralWithServices[],
      total: count || 0,
      page: p,
      per_page: pp,
      total_pages: Math.ceil((count || 0) / pp),
    };
  } catch (e) {
    console.error("getMyReferrals unexpected error:", e);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function getMyReferralStats(): Promise<{
  total: number;
  created: number;
  contacted: number;
  redeemed: number;
  completed: number;
  cancelled: number;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { total: 0, created: 0, contacted: 0, redeemed: 0, completed: 0, cancelled: 0 };
    }

    const dealerId = await getDealerIdForUser(user.id);
    if (!dealerId) {
      return { total: 0, created: 0, contacted: 0, redeemed: 0, completed: 0, cancelled: 0 };
    }

    const { data } = await supabase
      .from("referrals")
      .select("status")
      .eq("dealer_id", dealerId);

    const rows = data || [];
    return {
      total: rows.length,
      created: rows.filter((r) => r.status === "created").length,
      contacted: rows.filter((r) => r.status === "contacted").length,
      redeemed: rows.filter((r) => r.status === "redeemed").length,
      completed: rows.filter((r) => r.status === "completed").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    };
  } catch {
    return { total: 0, created: 0, contacted: 0, redeemed: 0, completed: 0, cancelled: 0 };
  }
}

// ============================================================
// STAFF / ADMIN ACTIONS
// ============================================================

export async function getReferrals(
  filters: ReferralFilters = {},
  sort: SortConfig = { field: "created_at", direction: "desc" },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<ReferralWithServices>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { data: hasPerm } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_resource: "referrals",
      p_action: "read",
    });

    if (!hasPerm) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase.from("referrals").select(
      `*,
       referral_services:referral_services(*),
       dealer:dealers(business_name, phone)`,
      { count: "exact" }
    );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.or(
          `customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,referral_code.ilike.%${s}%`
        );
      }
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.dealer_id && isValidUUID(filters.dealer_id)) {
      query = query.eq("dealer_id", filters.dealer_id);
    }

    const sortField = safeSortField(sort.field, REFERRAL_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getReferrals error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    return {
      data: (data || []) as ReferralWithServices[],
      total: count || 0,
      page: p,
      per_page: pp,
      total_pages: Math.ceil((count || 0) / pp),
    };
  } catch (e) {
    console.error("getReferrals unexpected error:", e);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

// ============================================================
// REDEMPTION — Dedicated secure flow
// ============================================================

export async function redeemReferral(
  referralId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "يجب تسجيل الدخول" };
    }

    const { data: hasPerm } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_resource: "referrals",
      p_action: "update",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(referralId)) {
      return { success: false, error: "معرف الإحالة غير صحيح" };
    }

    // 1. Fetch referral with current status + offer
    const { data: referral, error: fetchError } = await supabase
      .from("referrals")
      .select("id, status, offer_id, dealer_id, referral_code, customer_name")
      .eq("id", referralId)
      .single();

    if (fetchError || !referral) {
      return { success: false, error: "الإحالة غير موجودة" };
    }

    // Dealer ownership check: dealer users can only redeem their own referrals
    const { data: callerDealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (callerDealer && callerDealer.id !== referral.dealer_id) {
      return { success: false, error: "ليس لديك صلاحية لهذه الإحالة" }
    }

    // 2. Verify status is 'contacted' (only contacted referrals can be redeemed)
    if (referral.status !== "contacted") {
      return {
        success: false,
        error: `لا يمكن استبدال إحالة في حالة "${referral.status}"`,
      };
    }

    // 3. If offer_id exists, verify offer is active and not expired
    if (referral.offer_id) {
      const admin = getSupabaseAdmin();
      const { data: offer, error: offerError } = await admin
        .from("offers")
        .select("id, is_active, start_date, end_date")
        .eq("id", referral.offer_id)
        .single();

      if (offerError || !offer) {
        return { success: false, error: "العرض المرجع غير موجود" };
      }
      if (!offer.is_active) {
        return { success: false, error: "العرض المرجع غير نشط" };
      }
      if (offer.end_date) {
        const now = new Date();
        const endDate = new Date(offer.end_date);
        if (endDate < now) {
          return { success: false, error: "العرض المرجع منتهي الصلاحية" };
        }
      }
    }

    // 4. Atomic redemption — prevents double redemption via concurrency
    //    UPDATE only succeeds if status is still 'contacted'
    const { data: updated, error: updateError } = await supabase
      .from("referrals")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", referralId)
      .eq("status", "contacted")
      .select("id, status")
      .single();

    if (updateError || !updated) {
      // Either status changed between read and update (concurrency) or RLS blocked
      return {
        success: false,
        error: "فشلت عملية الاستبدال. قد تكون الحالة تغيرت أثناء المعالجة.",
      };
    }

    // 5. Audit log
    await writeAuditLog(user.id, "referral_redeemed", "referrals", referralId, {
      referral_code: referral.referral_code,
      customer_name: referral.customer_name,
      offer_id: referral.offer_id || null,
    });

    createNotificationsForRole('referrals', 'read', 'referral_redeemed', 'تم استبدال الإحالة', `تم استبدال إحالة ${referral.referral_code}`, 'referrals', referralId).catch(() => {});

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("redeemReferral unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

// ============================================================
// STATUS UPDATE — Generic with audit
// ============================================================

export async function updateReferralStatus(
  referralId: string,
  newStatus: ReferralStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "يجب تسجيل الدخول" };
    }

    const { data: hasPerm } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_resource: "referrals",
      p_action: "update",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(referralId)) {
      return { success: false, error: "معرف الإحالة غير صحيح" };
    }

    const VALID_STATUSES: ReferralStatus[] = [
      "created",
      "contacted",
      "redeemed",
      "expired",
      "cancelled",
      "completed",
    ];
    if (!VALID_STATUSES.includes(newStatus)) {
      return { success: false, error: "الحالة الجديدة غير صحيحة" };
    }

    const { data: current, error: fetchError } = await supabase
      .from("referrals")
      .select("id, status, referral_code, customer_name, dealer_id")
      .eq("id", referralId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "الإحالة غير موجودة" };
    }

    // Dealer ownership check: dealer users can only update their own referrals
    const { data: callerDealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (callerDealer && callerDealer.id !== current.dealer_id) {
      return { success: false, error: "ليس لديك صلاحية لهذه الإحالة" }
    }

    const allowed = VALID_TRANSITIONS[current.status as ReferralStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `لا يمكن التحويل من حالة "${current.status}" إلى "${newStatus}"`,
      };
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "redeemed") updateData.redeemed_at = new Date().toISOString();
    if (newStatus === "completed") updateData.completed_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("referrals")
      .update(updateData)
      .eq("id", referralId);

    if (updateError) {
      console.error("updateReferralStatus error:", updateError.message);
      return { success: false, error: "حدث خطأ أثناء تحديث الحالة" };
    }

    // Create commission when referral is completed
    // Uses create_commission_from_rule() — derives dealer_id from referral,
    // resolves commission rule, calculates amount server-side.
    // UNIQUE(referral_id) prevents duplicate commissions.
    if (newStatus === "completed") {
      const { data: commissionResult, error: commError } = await supabase.rpc(
        "create_commission_from_rule",
        { p_referral_id: referralId }
      );

      if (commError) {
        console.error("Commission creation error:", commError.message);
      } else if (commissionResult && !commissionResult.success) {
        console.error("Commission creation failed:", commissionResult.error);
      }
    }

    // Audit log
    const actionName = `referral_${newStatus}`;
    await writeAuditLog(user.id, actionName, "referrals", referralId, {
      old_status: current.status,
      new_status: newStatus,
      referral_code: current.referral_code,
    });

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("updateReferralStatus unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function getReferral(
  referralId: string
): Promise<ReferralWithServices | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return null;

    if (!isValidUUID(referralId)) return null;

    const { data, error } = await supabase
      .from("referrals")
      .select(
        `*,
         referral_services:referral_services(*, service:services(name, base_price)),
         dealer:dealers(business_name, phone)`
      )
      .eq("id", referralId)
      .single();

    if (error || !data) return null;

    return data as ReferralWithServices;
  } catch {
    return null;
  }
}
