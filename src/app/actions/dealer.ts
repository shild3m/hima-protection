"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/auth";
import type {
  Dealer,
  DealerWithStats,
  PaginatedResult,
  DealerFilters,
  SortConfig,
} from "@/lib/types";

// ============================================================
// CONSTANTS
// ============================================================

const MAX_PER_PAGE = 50;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// INTERNAL HELPERS
// ============================================================

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function sanitizeSearch(input: string): string {
  return input.replace(/[%_]/g, "").trim();
}

function validateDealerInput(input: {
  business_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: string;
  notes?: string;
}): string | null {
  if (!input.business_name || input.business_name.trim().length < 2) {
    return "اسم النشاط مطلوب (حرفين على الأقل)";
  }
  if (input.business_name.trim().length > 200) {
    return "اسم النشاط طويل جداً (200 حرف كحد أقصى)";
  }
  if (!input.phone || normalizePhone(input.phone).length < 5) {
    return "رقم الهاتف غير صحيح";
  }
  if (normalizePhone(input.phone).length > 20) {
    return "رقم الهاتف طويل جداً";
  }
  if (input.email && input.email.trim()) {
    if (input.email.trim().length > 254) {
      return "البريد الإلكتروني طويل جداً";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      return "البريد الإلكتروني غير صحيح";
    }
  }
  if (input.address && input.address.trim().length > 500) {
    return "العنوان طويل جداً (500 حرف كحد أقصى)";
  }
  if (
    input.status &&
    !["active", "inactive", "suspended"].includes(input.status)
  ) {
    return "حالة الشريك غير صحيحة";
  }
  if (input.notes && input.notes.trim().length > 2000) {
    return "الملاحظات طويلة جداً (2000 حرف كحد أقصى)";
  }
  return null;
}

const DEALER_SORT_FIELDS = [
  "created_at",
  "business_name",
  "phone",
  "status",
  "updated_at",
];

// ============================================================
// AUTH + PERMISSION HELPERS
// ============================================================

type AuthenticatedUser = { id: string; email?: string };

async function requireAuth(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }
  return { id: user.id, email: user.email };
}

async function requirePermission(
  userId: string,
  resource: string,
  action: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    p_user_id: userId,
    p_resource: resource,
    p_action: action,
  });
  if (error || !data) {
    throw new Error("FORBIDDEN");
  }
}

async function assertDealerExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("dealers")
    .select("id")
    .eq("id", dealerId)
    .single();
  return !error && !!data;
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

function safeSortField(field: string, allowed: string[]): string {
  return allowed.includes(field) ? field : "created_at";
}

async function writeAuditLog(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
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
// DEALER ACTIONS (Admin)
// ============================================================

export async function getDealers(
  filters: DealerFilters = {},
  sort: SortConfig = { field: "created_at", direction: "desc" },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<DealerWithStats>> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "dealers", "read");

    const supabase = await createClient();
    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase
      .from("dealers")
      .select(
        "*, referral_count:referrals(count)",
        { count: "exact" }
      );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.or(
          `business_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
        );
      }
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    const sortField = safeSortField(sort.field, DEALER_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getDealers error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    const total = count || 0;
    const dealers: DealerWithStats[] = (data || []).map(
      (d: Record<string, unknown>) => ({
        ...(d as Omit<Dealer, never>),
        referral_count:
          Array.isArray(d.referral_count) && d.referral_count.length > 0
            ? (d.referral_count[0] as { count: number }).count
            : 0,
      })
    );

    return {
      data: dealers,
      total,
      page: p,
      per_page: pp,
      total_pages: Math.ceil(total / pp),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }
    console.error("getDealers unexpected error:", msg);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function getDealer(
  dealerId: string
): Promise<Dealer | null> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "dealers", "read");

    if (!isValidUUID(dealerId)) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealers")
      .select(
        "id, user_id, business_name, phone, email, address, status, commission_type, commission_value, notes, is_active, created_at, updated_at"
      )
      .eq("id", dealerId)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
      return null;
    }
    console.error("getDealer unexpected error:", msg);
    return null;
  }
}

export async function createDealer(input: {
  business_name: string;
  phone: string;
  email?: string;
  address?: string;
  status?: string;
  notes?: string;
}): Promise<{ success: boolean; dealer?: Dealer; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "dealers", "create");

    const validationError = validateDealerInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const supabase = await createClient();
    const normalizedPhone = normalizePhone(input.phone);

    const { data, error } = await supabase
      .from("dealers")
      .insert({
        business_name: input.business_name.trim(),
        phone: normalizedPhone,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        status: input.status || "active",
        notes: input.notes?.trim() || null,
        is_active: true,
      })
      .select(
        "id, user_id, business_name, phone, email, address, status, commission_type, commission_value, notes, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "رقم الهاتف مسجل مسبقاً" };
      }
      console.error("createDealer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء الشريك" };
    }

    await writeAuditLog(user.id, "dealer_created", "dealers", data.id, {
      business_name: data.business_name,
      phone: data.phone,
      status: data.status,
    });

    return { success: true, dealer: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("createDealer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function updateDealer(
  dealerId: string,
  input: {
    business_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    status?: string;
    notes?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; dealer?: Dealer; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "dealers", "update");

    if (!isValidUUID(dealerId)) {
      return { success: false, error: "معرف الشريك غير صحيح" };
    }

    if (input.business_name !== undefined || input.phone !== undefined) {
      const validationError = validateDealerInput({
        business_name: input.business_name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        status: input.status,
      });
      if (validationError) {
        return { success: false, error: validationError };
      }
    }

    const supabase = await createClient();

    const dealerExists = await assertDealerExists(supabase, dealerId);
    if (!dealerExists) {
      return { success: false, error: "الشريك غير موجود" };
    }

    const ALLOWED_FIELDS = [
      "business_name",
      "phone",
      "email",
      "address",
      "status",
      "notes",
      "is_active",
    ] as const;
    const updateData: Record<string, unknown> = {};

    for (const field of ALLOWED_FIELDS) {
      if (input[field as keyof typeof input] !== undefined) {
        updateData[field] = input[field as keyof typeof input];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "لا توجد تغييرات" };
    }

    if (updateData.business_name !== undefined)
      updateData.business_name = (updateData.business_name as string).trim();
    if (updateData.phone !== undefined)
      updateData.phone = normalizePhone(updateData.phone as string);
    if (updateData.email !== undefined)
      updateData.email = (updateData.email as string)?.trim() || null;
    if (updateData.address !== undefined)
      updateData.address = (updateData.address as string)?.trim() || null;
    if (updateData.notes !== undefined)
      updateData.notes = (updateData.notes as string)?.trim() || null;

    const { data, error } = await supabase
      .from("dealers")
      .update(updateData)
      .eq("id", dealerId)
      .select(
        "id, user_id, business_name, phone, email, address, status, commission_type, commission_value, notes, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "رقم الهاتف مسجل مسبقاً" };
      }
      console.error("updateDealer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تحديث الشريك" };
    }

    await writeAuditLog(user.id, "dealer_updated", "dealers", dealerId, {
      updated_fields: Object.keys(updateData),
    });

    return { success: true, dealer: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("updateDealer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function softDeleteDealer(
  dealerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "dealers", "delete");

    if (!isValidUUID(dealerId)) {
      return { success: false, error: "معرف الشريك غير صحيح" };
    }

    const supabase = await createClient();

    const dealerExists = await assertDealerExists(supabase, dealerId);
    if (!dealerExists) {
      return { success: false, error: "الشريك غير موجود" };
    }

    const { error } = await supabase
      .from("dealers")
      .update({ is_active: false })
      .eq("id", dealerId);

    if (error) {
      console.error("softDeleteDealer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تعطيل الشريك" };
    }

    await writeAuditLog(
      user.id,
      "dealer_deactivated",
      "dealers",
      dealerId,
      {}
    );

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("softDeleteDealer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function activateDealer(
  dealerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "dealers", "update");

    if (!isValidUUID(dealerId)) {
      return { success: false, error: "معرف الشريك غير صحيح" };
    }

    const supabase = await createClient();

    const dealerExists = await assertDealerExists(supabase, dealerId);
    if (!dealerExists) {
      return { success: false, error: "الشريك غير موجود" };
    }

    const { error } = await supabase
      .from("dealers")
      .update({ is_active: true, status: "active" })
      .eq("id", dealerId);

    if (error) {
      console.error("activateDealer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تفعيل الشريك" };
    }

    await writeAuditLog(
      user.id,
      "dealer_activated",
      "dealers",
      dealerId,
      {}
    );

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("activateDealer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}
