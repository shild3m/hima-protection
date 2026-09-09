"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/auth";
import type {
  Offer,
  OfferWithService,
  PaginatedResult,
  OfferFilters,
  OfferType,
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

const VALID_OFFER_TYPES: OfferType[] = [
  "fixed_discount",
  "percentage_discount",
  "free_service",
  "special_price",
];

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
// PUBLIC — Get active general offers (no auth required)
// ============================================================

export async function getPublicOffers(): Promise<OfferWithService[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("offers")
      .select(`*, service:services(name, base_price)`)
      .eq("is_active", true)
      .is("dealer_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getPublicOffers error:", error.message);
      return [];
    }

    return (data || []) as OfferWithService[];
  } catch {
    return [];
  }
}

// ============================================================
// ADMIN ACTIONS
// ============================================================

export async function getOffers(
  filters: OfferFilters = {},
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<OfferWithService>> {
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
      p_resource: "offers",
      p_action: "read",
    });

    if (!hasPerm) {
      return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
    }

    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase.from("offers").select(
      `*,
       service:services(name, base_price),
       dealer:dealers(business_name)`,
      { count: "exact" }
    );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.ilike("title", `%${s}%`);
      }
    }
    if (filters.offer_type) {
      query = query.eq("offer_type", filters.offer_type);
    }
    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    query = query.order("created_at", { ascending: false });
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getOffers error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    return {
      data: (data || []) as OfferWithService[],
      total: count || 0,
      page: p,
      per_page: pp,
      total_pages: Math.ceil((count || 0) / pp),
    };
  } catch (e) {
    console.error("getOffers unexpected error:", e);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function createOffer(input: {
  title: string;
  description?: string;
  offer_type: OfferType;
  value?: number;
  service_id?: string;
  dealer_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ success: boolean; offer?: Offer; error?: string }> {
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
      p_resource: "offers",
      p_action: "create",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!input.title || input.title.trim().length < 2) {
      return { success: false, error: "عنوان العرض مطلوب" };
    }
    if (input.title.trim().length > 200) {
      return { success: false, error: "عنوان العرض طويل جداً" };
    }
    if (!VALID_OFFER_TYPES.includes(input.offer_type)) {
      return { success: false, error: "نوع العرض غير صحيح" };
    }
    if (input.value !== undefined && input.value !== null && input.value < 0) {
      return { success: false, error: "قيمة العرض يجب أن تكون موجبة" };
    }
    if (input.service_id && !isValidUUID(input.service_id)) {
      return { success: false, error: "معرف الخدمة غير صحيح" };
    }
    if (input.dealer_id && !isValidUUID(input.dealer_id)) {
      return { success: false, error: "معرف الشريك غير صحيح" };
    }
    if (input.start_date && input.end_date) {
      if (new Date(input.end_date) <= new Date(input.start_date)) {
        return { success: false, error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية" };
      }
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("offers")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        offer_type: input.offer_type,
        value: input.value ?? null,
        service_id: input.service_id || null,
        dealer_id: input.dealer_id || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("createOffer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء العرض" };
    }

    await writeAuditLog(user.id, "offer_created", "offers", data.id, {
      title: data.title,
      offer_type: data.offer_type,
      value: data.value,
      dealer_id: data.dealer_id,
    });

    return { success: true, offer: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("createOffer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function updateOffer(
  offerId: string,
  input: {
    title?: string;
    description?: string;
    offer_type?: OfferType;
    value?: number;
    service_id?: string;
    start_date?: string;
    end_date?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; offer?: Offer; error?: string }> {
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
      p_resource: "offers",
      p_action: "update",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(offerId)) {
      return { success: false, error: "معرف العرض غير صحيح" };
    }

    if (input.title !== undefined) {
      if (input.title.trim().length < 2) {
        return { success: false, error: "عنوان العرض مطلوب" };
      }
      if (input.title.trim().length > 200) {
        return { success: false, error: "عنوان العرض طويل جداً" };
      }
    }
    if (input.offer_type !== undefined && !VALID_OFFER_TYPES.includes(input.offer_type)) {
      return { success: false, error: "نوع العرض غير صحيح" };
    }
    if (input.value !== undefined && input.value !== null && input.value < 0) {
      return { success: false, error: "قيمة العرض يجب أن تكون موجبة" };
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.offer_type !== undefined) updateData.offer_type = input.offer_type;
    if (input.value !== undefined) updateData.value = input.value ?? null;
    if (input.service_id !== undefined) updateData.service_id = input.service_id || null;
    if (input.start_date !== undefined) updateData.start_date = input.start_date || null;
    if (input.end_date !== undefined) updateData.end_date = input.end_date || null;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "لا توجد تغييرات" };
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("offers")
      .update(updateData)
      .eq("id", offerId)
      .select()
      .single();

    if (error) {
      console.error("updateOffer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تحديث العرض" };
    }

    await writeAuditLog(user.id, "offer_updated", "offers", offerId, {
      updated_fields: Object.keys(updateData),
    });

    return { success: true, offer: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("updateOffer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function deleteOffer(
  offerId: string
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
      p_resource: "offers",
      p_action: "delete",
    });

    if (!hasPerm) {
      return { success: false, error: "ليس لديك صلاحية" };
    }

    if (!isValidUUID(offerId)) {
      return { success: false, error: "معرف العرض غير صحيح" };
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("offers").delete().eq("id", offerId);

    if (error) {
      console.error("deleteOffer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء حذف العرض" };
    }

    await writeAuditLog(user.id, "offer_deleted", "offers", offerId, {});

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    console.error("deleteOffer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}
