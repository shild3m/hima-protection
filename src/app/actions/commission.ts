"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/auth";
import { createNotificationsForRole } from "@/app/actions/notifications";
import type {
  CommissionWithDetails,
  PaginatedResult,
  CommissionFilters,
  CommissionRule,
  CommissionRuleWithDetails,
  CommissionRuleFilters,
  CommissionMonthlyReport,
} from "@/lib/types";

const MAX_PER_PAGE = 50;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const COMMISSION_SORT_FIELDS = [
  "created_at",
  "calculated_amount",
  "status",
  "approved_at",
  "paid_at",
];

function safeSortField(field: string, allowed: string[]): string {
  return allowed.includes(field) ? field : "created_at";
}

async function writeAuditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  newValues: Record<string, unknown>
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: newValues,
    });
  } catch (auditError) {
    console.error("Audit log write failed (non-critical):", auditError);
  }
}

// ============================================================
// ADMIN / STAFF COMMISSION ACTIONS
// ============================================================

export async function getCommissions(
  filters: CommissionFilters = {},
  sort: { field: string; direction: "asc" | "desc" } = {
    field: "created_at",
    direction: "desc",
  },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<CommissionWithDetails>> {
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
      p_resource: "commissions",
      p_action: "read",
    });

    if (!hasPerm) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase.from("commissions").select(
      `*,
       referral:referrals(referral_code, customer_name, customer_phone),
       dealer:dealers(business_name, phone),
       service:services(name, base_price)`,
      { count: "exact" }
    );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.or(
          `notes.ilike.%${s}%,payment_notes.ilike.%${s}%`
        );
      }
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.dealer_id && isValidUUID(filters.dealer_id)) {
      query = query.eq("dealer_id", filters.dealer_id);
    }
    if (filters.created_from) {
      query = query.gte("created_at", filters.created_from);
    }
    if (filters.created_to) {
      query = query.lte("created_at", filters.created_to);
    }

    const sortField = safeSortField(sort.field, COMMISSION_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getCommissions error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    return {
      data: (data || []) as CommissionWithDetails[],
      total: count || 0,
      page: p,
      per_page: pp,
      total_pages: Math.ceil((count || 0) / pp),
    };
  } catch (e) {
    console.error("getCommissions unexpected error:", e);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function getCommission(
  commissionId: string
): Promise<CommissionWithDetails | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return null;
    if (!isValidUUID(commissionId)) return null;

    const { data: hasPerm } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_resource: "commissions",
      p_action: "read",
    });

    if (!hasPerm) return null;

    const { data, error } = await supabase
      .from("commissions")
      .select(
        `*,
         referral:referrals(referral_code, customer_name, customer_phone, car_make, car_model, car_year),
         dealer:dealers(business_name, phone, commission_type, commission_value),
         service:services(name, base_price)`
      )
      .eq("id", commissionId)
      .single();

    if (error || !data) return null;

    return data as CommissionWithDetails;
  } catch {
    return null;
  }
}

export async function approveCommission(
  commissionId: string,
  notes?: string
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
      p_resource: "commissions",
      p_action: "approve",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(commissionId)) {
      return { success: false, error: "معرف العمولة غير صحيح" };
    }

    const { data: current, error: fetchError } = await supabase
      .from("commissions")
      .select("id, status, calculated_amount, dealer_id, referral_id")
      .eq("id", commissionId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "العمولة غير موجودة" };
    }

    if (current.status !== "pending") {
      return {
        success: false,
        error: `لا يمكن الموافقة على عمولة في حالة "${current.status}"`,
      };
    }

    // Self-approval prevention: fetch caller's dealer_id and check
    const { data: callerStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    const { data: callerDealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    const callerDealerId = callerDealer?.id
    if (callerDealerId && callerDealerId === current.dealer_id) {
      return { success: false, error: "لا يمكنك الموافقة على عمولتك الخاصة" }
    }

    const { error: updateError } = await supabase
      .from("commissions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        notes: notes?.trim() || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commissionId)
      .eq("status", "pending");

    if (updateError) {
      console.error("approveCommission error:", updateError.message);
      return { success: false, error: "حدث خطأ أثناء الموافقة" };
    }

    await writeAuditLog(user.id, "commission_approved", "commissions", commissionId, {
      amount: current.calculated_amount,
      approved_by: user.id,
    });

    createNotificationsForRole('commissions', 'read', 'commission_approved', 'تمت الموافقة على عمولة', `تمت الموافقة على عمولة بقيمة ${current.calculated_amount}`, 'commissions', commissionId).catch(() => {});

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("approveCommission unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function cancelCommission(
  commissionId: string,
  reason?: string
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
      p_resource: "commissions",
      p_action: "update",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(commissionId)) {
      return { success: false, error: "معرف العمولة غير صحيح" };
    }

    const { data: current, error: fetchError } = await supabase
      .from("commissions")
      .select("id, status, calculated_amount, dealer_id")
      .eq("id", commissionId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "العمولة غير موجودة" };
    }

    if (!["pending", "approved"].includes(current.status)) {
      return {
        success: false,
        error: `لا يمكن إلغاء عمولة في حالة "${current.status}"`,
      };
    }

    // Self-cancellation prevention for dealer-role users
    const { data: callerDealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (callerDealer?.id === current.dealer_id) {
      return { success: false, error: "لا يمكنك إلغاء عمولتك الخاصة" }
    }

    const { error: updateError } = await supabase
      .from("commissions")
      .update({
        status: "cancelled",
        notes: reason?.trim() || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commissionId)
      .in("status", ["pending", "approved"]);

    if (updateError) {
      console.error("cancelCommission error:", updateError.message);
      return { success: false, error: "حدث خطأ أثناء الإلغاء" };
    }

    await writeAuditLog(user.id, "commission_cancelled", "commissions", commissionId, {
      amount: current.calculated_amount,
      reason: reason || null,
    });

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("cancelCommission unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function payCommission(
  commissionId: string,
  paymentNotes?: string
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
      p_resource: "commissions",
      p_action: "pay",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(commissionId)) {
      return { success: false, error: "معرف العمولة غير صحيح" };
    }

    const { data: current, error: fetchError } = await supabase
      .from("commissions")
      .select("id, status, calculated_amount, dealer_id")
      .eq("id", commissionId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "العمولة غير موجودة" };
    }

    if (current.status !== "approved") {
      return {
        success: false,
        error: `لا يمكن دفع عمولة في حالة "${current.status}"`,
      };
    }

    // Self-payment prevention for dealer-role users
    const { data: callerDealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (callerDealer?.id === current.dealer_id) {
      return { success: false, error: "لا يمكنك دفع عمولتك الخاصة" }
    }

    const { error: updateError } = await supabase
      .from("commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_by: user.id,
        payment_notes: paymentNotes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commissionId)
      .eq("status", "approved");

    if (updateError) {
      console.error("payCommission error:", updateError.message);
      return { success: false, error: "حدث خطأ أثناء الدفع" };
    }

    await writeAuditLog(user.id, "commission_paid", "commissions", commissionId, {
      amount: current.calculated_amount,
      paid_by: user.id,
      payment_notes: paymentNotes || null,
    });

    createNotificationsForRole('commissions', 'read', 'commission_paid', 'تم دفع عمولة', `تم دفع عمولة بقيمة ${current.calculated_amount}`, 'commissions', commissionId).catch(() => {});

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("payCommission unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

// ============================================================
// DEALER COMMISSION ACTIONS
// ============================================================

export async function getMyCommissions(
  filters: CommissionFilters = {},
  sort: { field: string; direction: "asc" | "desc" } = {
    field: "created_at",
    direction: "desc",
  },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<CommissionWithDetails>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { data: dealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!dealer) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase.from("commissions").select(
      `*,
       referral:referrals(referral_code, customer_name),
       service:services(name, base_price)`,
      { count: "exact" }
    );

    query = query.eq("dealer_id", dealer.id);

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const sortField = safeSortField(sort.field, COMMISSION_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getMyCommissions error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    return {
      data: (data || []) as CommissionWithDetails[],
      total: count || 0,
      page: p,
      per_page: pp,
      total_pages: Math.ceil((count || 0) / pp),
    };
  } catch (e) {
    console.error("getMyCommissions unexpected error:", e);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function getMyCommissionStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  paid: number;
  cancelled: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { total: 0, pending: 0, approved: 0, paid: 0, cancelled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0 };
    }

    const { data: dealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!dealer) {
      return { total: 0, pending: 0, approved: 0, paid: 0, cancelled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0 };
    }

    const { data } = await supabase
      .from("commissions")
      .select("status, calculated_amount")
      .eq("dealer_id", dealer.id);

    const rows = data || [];
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      paid: rows.filter((r) => r.status === "paid").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      pending_amount: rows.filter((r) => r.status === "pending").reduce((s, r) => s + (r.calculated_amount || 0), 0),
      approved_amount: rows.filter((r) => r.status === "approved").reduce((s, r) => s + (r.calculated_amount || 0), 0),
      paid_amount: rows.filter((r) => r.status === "paid").reduce((s, r) => s + (r.calculated_amount || 0), 0),
    };
  } catch {
    return { total: 0, pending: 0, approved: 0, paid: 0, cancelled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0 };
  }
}

// ============================================================
// COMMISSION RULES (Admin only)
// ============================================================

export async function getCommissionRules(
  filters: CommissionRuleFilters = {},
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<CommissionRuleWithDetails>> {
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
      p_resource: "commissions",
      p_action: "read",
    });

    if (!hasPerm) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase.from("commission_rules").select(
      `*,
       dealer:dealers(business_name),
       service:services(name)`,
      { count: "exact" }
    );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.ilike("name", `%${s}%`);
      }
    }
    if (filters.dealer_id && isValidUUID(filters.dealer_id)) {
      query = query.eq("dealer_id", filters.dealer_id);
    }
    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    query = query.order("priority", { ascending: false });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getCommissionRules error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    return {
      data: (data || []) as CommissionRuleWithDetails[],
      total: count || 0,
      page: p,
      per_page: pp,
      total_pages: Math.ceil((count || 0) / pp),
    };
  } catch (e) {
    console.error("getCommissionRules unexpected error:", e);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function createCommissionRule(input: {
  name: string;
  calculation_type: "fixed" | "percentage";
  rate_value: number;
  dealer_id?: string;
  service_id?: string;
  priority?: number;
  notes?: string;
}): Promise<{ success: boolean; rule?: CommissionRule; error?: string }> {
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
      p_resource: "commission_rules",
      p_action: "create",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: "اسم القاعدة مطلوب" };
    }
    if (input.name.trim().length > 200) {
      return { success: false, error: "اسم القاعدة طويل جداً" };
    }
    if (!["fixed", "percentage"].includes(input.calculation_type)) {
      return { success: false, error: "نوع الحساب غير صحيح" };
    }
    if (input.rate_value < 0) {
      return { success: false, error: "قيمة العمولة يجب أن تكون موجبة" };
    }
    if (input.dealer_id && !isValidUUID(input.dealer_id)) {
      return { success: false, error: "معرف الشريك غير صحيح" };
    }
    if (input.service_id && !isValidUUID(input.service_id)) {
      return { success: false, error: "معرف الخدمة غير صحيح" };
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("commission_rules")
      .insert({
        name: input.name.trim(),
        calculation_type: input.calculation_type,
        rate_value: input.rate_value,
        dealer_id: input.dealer_id || null,
        service_id: input.service_id || null,
        priority: input.priority ?? 0,
        is_active: true,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "قاعدة بنفس الشريك والخدمة موجودة بالفعل" };
      }
      console.error("createCommissionRule DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء القاعدة" };
    }

    await writeAuditLog(user.id, "commission_rule_created", "commission_rules", data.id, {
      name: data.name,
      calculation_type: data.calculation_type,
      rate_value: data.rate_value,
      dealer_id: data.dealer_id,
      service_id: data.service_id,
    });

    return { success: true, rule: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("createCommissionRule unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function updateCommissionRule(
  ruleId: string,
  input: {
    name?: string;
    calculation_type?: "fixed" | "percentage";
    rate_value?: number;
    priority?: number;
    is_active?: boolean;
    notes?: string;
  }
): Promise<{ success: boolean; rule?: CommissionRule; error?: string }> {
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
      p_resource: "commission_rules",
      p_action: "update",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(ruleId)) {
      return { success: false, error: "معرف القاعدة غير صحيح" };
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) {
      if (input.name.trim().length < 2) return { success: false, error: "اسم القاعدة مطلوب" };
      updateData.name = input.name.trim();
    }
    if (input.calculation_type !== undefined) updateData.calculation_type = input.calculation_type;
    if (input.rate_value !== undefined) updateData.rate_value = input.rate_value;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "لا توجد تغييرات" };
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("commission_rules")
      .update(updateData)
      .eq("id", ruleId)
      .select()
      .single();

    if (error) {
      console.error("updateCommissionRule DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تحديث القاعدة" };
    }

    await writeAuditLog(user.id, "commission_rule_updated", "commission_rules", ruleId, {
      updated_fields: Object.keys(updateData),
    });

    return { success: true, rule: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("updateCommissionRule unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

// ============================================================
// COMMISSION REPORTS
// ============================================================

export async function getCommissionMonthlyReport(
  month?: string
): Promise<CommissionMonthlyReport[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return [];

    const { data: hasPerm } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_resource: "commissions",
      p_action: "read",
    });

    if (!hasPerm) return [];

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const startDate = `${targetMonth}-01T00:00:00`;
    const endDate = new Date(
      new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)
    ).toISOString();

    const admin = getSupabaseAdmin();

    // Get all dealers with commissions in the month
    const { data: commissions } = await admin
      .from("commissions")
      .select("dealer_id, calculated_amount, status, referrals!inner(completed_at)")
      .gte("created_at", startDate)
      .lt("created_at", endDate);

    if (!commissions || commissions.length === 0) return [];

    // Group by dealer
    const dealerMap = new Map<string, {
      total_referrals: number;
      completed_referrals: number;
      pending_amount: number;
      approved_amount: number;
      paid_amount: number;
      total_amount: number;
    }>();

    for (const c of commissions) {
      const did = c.dealer_id;
      if (!dealerMap.has(did)) {
        dealerMap.set(did, {
          total_referrals: 0,
          completed_referrals: 0,
          pending_amount: 0,
          approved_amount: 0,
          paid_amount: 0,
          total_amount: 0,
        });
      }
      const stats = dealerMap.get(did)!;
      stats.completed_referrals++;
      stats.total_amount += c.calculated_amount || 0;
      if (c.status === "pending") stats.pending_amount += c.calculated_amount || 0;
      if (c.status === "approved") stats.approved_amount += c.calculated_amount || 0;
      if (c.status === "paid") stats.paid_amount += c.calculated_amount || 0;
    }

    // Get dealer names and referral counts in parallel
    const [dealersResult, referralsResult] = await Promise.all([
      admin
        .from("dealers")
        .select("id, business_name"),
      admin
        .from("referrals")
        .select("dealer_id")
        .gte("created_at", startDate)
        .lt("created_at", endDate),
    ])

    const dealerNames = new Map((dealersResult.data || []).map((d) => [d.id, d.business_name]));

    const referralCounts = new Map<string, number>();
    for (const r of referralsResult.data || []) {
      referralCounts.set(r.dealer_id, (referralCounts.get(r.dealer_id) || 0) + 1);
    }

    const result: CommissionMonthlyReport[] = [];
    for (const [dealerId, stats] of dealerMap) {
      result.push({
        dealer_id: dealerId,
        dealer_name: dealerNames.get(dealerId) || "—",
        total_referrals: referralCounts.get(dealerId) || 0,
        completed_referrals: stats.completed_referrals,
        pending_amount: stats.pending_amount,
        approved_amount: stats.approved_amount,
        paid_amount: stats.paid_amount,
        total_amount: stats.total_amount,
      });
    }

    return result;
  } catch (e) {
    console.error("getCommissionMonthlyReport error:", e);
    return [];
  }
}
