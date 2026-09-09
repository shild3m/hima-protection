"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/auth";
import type {
  Customer,
  CustomerNote,
  Vehicle,
  Booking,
  BookingStatusHistory,
  CustomerWithStats,
  VehicleWithCustomer,
  PaginatedResult,
  CustomerFilters,
  VehicleFilters,
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

function validateCustomerInput(input: {
  full_name?: string;
  phone?: string;
  email?: string;
  source?: string;
}): string | null {
  if (!input.full_name || input.full_name.trim().length < 2) {
    return "الاسم مطلوب (حرفين على الأقل)";
  }
  if (input.full_name.trim().length > 200) {
    return "الاسم طويل جداً (200 حرف كحد أقصى)";
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
  if (
    input.source &&
    !["walk_in", "referral", "online", "social", "phone"].includes(
      input.source
    )
  ) {
    return "مصدر العميل غير صحيح";
  }
  return null;
}

function validateVehicleInput(input: {
  make?: string;
  model?: string;
  year?: number;
}): string | null {
  if (!input.make || input.make.trim().length < 1) {
    return "ماركة السيارة مطلوبة";
  }
  if (input.make.trim().length > 100) {
    return "ماركة السيارة طويلة جداً";
  }
  if (!input.model || input.model.trim().length < 1) {
    return "موديل السيارة مطلوب";
  }
  if (input.model.trim().length > 100) {
    return "موديل السيارة طويل جداً";
  }
  if (
    input.year &&
    (input.year < 1900 || input.year > new Date().getFullYear() + 1)
  ) {
    return "سنة الصنع غير صحيحة";
  }
  return null;
}

const CUSTOMER_SORT_FIELDS = [
  "created_at",
  "full_name",
  "phone",
  "updated_at",
];
const VEHICLE_SORT_FIELDS = [
  "created_at",
  "year",
  "make",
  "model",
  "updated_at",
];

// ============================================================
// AUTH + PERMISSION + OBJECT-LEVEL AUTH HELPERS
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

async function assertCustomerExists(
  supabase: ReturnType<typeof createClient> extends Promise<infer R> ? R : never,
  customerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .single();
  return !error && !!data;
}

async function assertVehicleExists(
  supabase: ReturnType<typeof createClient> extends Promise<infer R> ? R : never,
  vehicleId: string
): Promise<{ exists: boolean; customer_id?: string }> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, customer_id")
    .eq("id", vehicleId)
    .single();
  if (error || !data) return { exists: false };
  return { exists: true, customer_id: data.customer_id };
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

// NOTE: Audit logging is non-atomic with the business mutation.
// The business record is written first; if the audit insert fails,
// the mutation still succeeds. This is an accepted limitation of the
// current server-action architecture (no explicit DB transaction control
// from Next.js Server Actions). A future phase may introduce RPC-based
// atomic audit logging if required.
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
// CUSTOMER ACTIONS
// ============================================================

export async function getCustomers(
  filters: CustomerFilters = {},
  sort: SortConfig = { field: "created_at", direction: "desc" },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<CustomerWithStats>> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "read");

    const supabase = await createClient();
    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase
      .from("customers")
      .select(
        "*, vehicle_count:vehicles(count), booking_count:bookings(count)",
        { count: "exact" }
      );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.or(
          `full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
        );
      }
    }
    if (filters.source) {
      query = query.eq("source", filters.source);
    }
    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }
    if (filters.created_from) {
      query = query.gte("created_at", filters.created_from);
    }
    if (filters.created_to) {
      query = query.lte("created_at", filters.created_to + "T23:59:59");
    }

    const sortField = safeSortField(sort.field, CUSTOMER_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getCustomers error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    const total = count || 0;
    const customers: CustomerWithStats[] = (data || []).map(
      (c: Record<string, unknown>) => ({
        ...(c as Omit<Customer, never>),
        vehicle_count:
          Array.isArray(c.vehicle_count) && c.vehicle_count.length > 0
            ? (c.vehicle_count[0] as { count: number }).count
            : 0,
        booking_count:
          Array.isArray(c.booking_count) && c.booking_count.length > 0
            ? (c.booking_count[0] as { count: number }).count
            : 0,
      })
    );

    return {
      data: customers,
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
    console.error("getCustomers unexpected error:", msg);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function getCustomer(
  customerId: string
): Promise<Customer | null> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "read");

    if (!isValidUUID(customerId)) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, full_name, phone, email, source, referred_by_dealer_id, notes, is_active, created_at, updated_at"
      )
      .eq("id", customerId)
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
    console.error("getCustomer unexpected error:", msg);
    return null;
  }
}

export async function getCustomerWithDetails(customerId: string): Promise<{
  customer: Customer | null;
  vehicles: Vehicle[];
  bookings: (Booking & { service_name?: string })[];
  notes: CustomerNote[];
}> {
  const empty = {
    customer: null,
    vehicles: [],
    bookings: [],
    notes: [],
  };

  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "read");

    if (!isValidUUID(customerId)) {
      return empty;
    }

    const supabase = await createClient();

    const [customerRes, vehiclesRes, bookingsRes, notesRes] =
      await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, full_name, phone, email, source, referred_by_dealer_id, notes, is_active, created_at, updated_at"
          )
          .eq("id", customerId)
          .single(),
        supabase
          .from("vehicles")
          .select(
            "id, customer_id, make, model, year, color, plate_number, vin, notes, is_active, created_at, updated_at"
          )
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("bookings")
          .select(
            "id, customer_id, vehicle_id, service_id, status, preferred_date, preferred_time, customer_notes, admin_notes, source, created_by, created_at, updated_at, services(name)"
          )
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("customer_notes")
          .select("id, customer_id, content, created_by, created_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);

    if (customerRes.error || !customerRes.data) {
      return empty;
    }

    const bookings = (bookingsRes.data || []).map(
      (b: Record<string, unknown>) => ({
        ...(b as Omit<Booking, never>),
        service_name:
          (b.services as { name: string } | null)?.name || undefined,
      })
    );

    return {
      customer: customerRes.data,
      vehicles: vehiclesRes.data || [],
      bookings,
      notes: notesRes.data || [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
      return empty;
    }
    console.error("getCustomerWithDetails unexpected error:", msg);
    return empty;
  }
}

export async function createCustomer(input: {
  full_name: string;
  phone: string;
  email?: string;
  source?: string;
  notes?: string;
}): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "create");

    const validationError = validateCustomerInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const supabase = await createClient();
    const normalizedPhone = normalizePhone(input.phone);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        full_name: input.full_name.trim(),
        phone: normalizedPhone,
        email: input.email?.trim() || null,
        source: input.source || "walk_in",
        notes: input.notes?.trim() || null,
        is_active: true,
      })
      .select(
        "id, full_name, phone, email, source, referred_by_dealer_id, notes, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "رقم الهاتف مسجل مسبقاً" };
      }
      console.error("createCustomer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء العميل" };
    }

    await writeAuditLog(user.id, "customer_created", "customers", data.id, {
      full_name: data.full_name,
      phone: data.phone,
      source: data.source,
    });

    return { success: true, customer: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("createCustomer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function updateCustomer(
  customerId: string,
  input: {
    full_name?: string;
    phone?: string;
    email?: string;
    source?: string;
    notes?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "update");

    if (!isValidUUID(customerId)) {
      return { success: false, error: "معرف العميل غير صحيح" };
    }

    if (input.full_name !== undefined || input.phone !== undefined) {
      const validationError = validateCustomerInput({
        full_name: input.full_name,
        phone: input.phone,
        email: input.email,
        source: input.source,
      });
      if (validationError) {
        return { success: false, error: validationError };
      }
    }

    const supabase = await createClient();

    // Object-level: verify customer exists before update
    const customerExists = await assertCustomerExists(supabase, customerId);
    if (!customerExists) {
      return { success: false, error: "العميل غير موجود" };
    }

    const ALLOWED_FIELDS = [
      "full_name",
      "phone",
      "email",
      "source",
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

    if (updateData.full_name !== undefined)
      updateData.full_name = (updateData.full_name as string).trim();
    if (updateData.phone !== undefined)
      updateData.phone = normalizePhone(updateData.phone as string);
    if (updateData.email !== undefined)
      updateData.email = (updateData.email as string)?.trim() || null;
    if (updateData.notes !== undefined)
      updateData.notes = (updateData.notes as string)?.trim() || null;

    const { data, error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", customerId)
      .select(
        "id, full_name, phone, email, source, referred_by_dealer_id, notes, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "رقم الهاتف مسجل مسبقاً" };
      }
      console.error("updateCustomer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تحديث العميل" };
    }

    await writeAuditLog(user.id, "customer_updated", "customers", customerId, {
      updated_fields: Object.keys(updateData),
    });

    return { success: true, customer: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("updateCustomer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function softDeleteCustomer(
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "delete");

    if (!isValidUUID(customerId)) {
      return { success: false, error: "معرف العميل غير صحيح" };
    }

    const supabase = await createClient();

    // Object-level: verify customer exists before deactivation
    const customerExists = await assertCustomerExists(supabase, customerId);
    if (!customerExists) {
      return { success: false, error: "العميل غير موجود" };
    }

    const { error } = await supabase
      .from("customers")
      .update({ is_active: false })
      .eq("id", customerId);

    if (error) {
      console.error("softDeleteCustomer DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء حذف العميل" };
    }

    await writeAuditLog(
      user.id,
      "customer_deactivated",
      "customers",
      customerId,
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
    console.error("softDeleteCustomer unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

// ============================================================
// VEHICLE ACTIONS
// ============================================================

export async function getVehicles(
  filters: VehicleFilters = {},
  sort: SortConfig = { field: "created_at", direction: "desc" },
  page: number = 1,
  per_page: number = 20
): Promise<PaginatedResult<VehicleWithCustomer>> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "vehicles", "read");

    const supabase = await createClient();
    const { page: p, per_page: pp, from, to } = parsePagination(page, per_page);

    let query = supabase
      .from("vehicles")
      .select(
        "id, customer_id, make, model, year, color, plate_number, vin, notes, is_active, created_at, updated_at, customers(id, full_name, phone)",
        { count: "exact" }
      );

    if (filters.search) {
      const s = sanitizeSearch(filters.search);
      if (s.length > 0) {
        query = query.or(
          `make.ilike.%${s}%,model.ilike.%${s}%,plate_number.ilike.%${s}%,vin.ilike.%${s}%`
        );
      }
    }
    if (filters.make) {
      query = query.ilike("make", `%${sanitizeSearch(filters.make)}%`);
    }
    if (filters.model) {
      query = query.ilike("model", `%${sanitizeSearch(filters.model)}%`);
    }
    if (filters.year) {
      query = query.eq("year", filters.year);
    }
    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }
    if (filters.customer_id && isValidUUID(filters.customer_id)) {
      query = query.eq("customer_id", filters.customer_id);
    }

    const sortField = safeSortField(sort.field, VEHICLE_SORT_FIELDS);
    query = query.order(sortField, { ascending: sort.direction === "asc" });

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("getVehicles error:", error.message);
      return { data: [], total: 0, page: p, per_page: pp, total_pages: 0 };
    }

    const total = count || 0;
    const vehicles: VehicleWithCustomer[] = (data || []).map(
      (v: Record<string, unknown>) => ({
        ...(v as Omit<Vehicle, never> & {
          customers?: { id: string; full_name: string; phone: string } | null;
        }),
        customer: v.customers
          ? {
              id: (v.customers as { id: string }).id,
              full_name: (v.customers as { full_name: string }).full_name,
              phone: (v.customers as { phone: string }).phone,
            } as Customer
          : undefined,
      })
    );

    return {
      data: vehicles,
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
    console.error("getVehicles unexpected error:", msg);
    return { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 };
  }
}

export async function getVehicle(
  vehicleId: string
): Promise<(Vehicle & { customer?: Customer }) | null> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "vehicles", "read");

    if (!isValidUUID(vehicleId)) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select(
        "id, customer_id, make, model, year, color, plate_number, vin, notes, is_active, created_at, updated_at, customers(id, full_name, phone, email, source, is_active)"
      )
      .eq("id", vehicleId)
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
    console.error("getVehicle unexpected error:", msg);
    return null;
  }
}

export async function getVehicleWithHistory(
  vehicleId: string
): Promise<{
  vehicle: (Vehicle & { customer?: Customer }) | null;
  bookings: (Booking & { service_name?: string })[];
  history: BookingStatusHistory[];
}> {
  const empty = { vehicle: null, bookings: [], history: [] };

  try {
    const user = await requireAuth();
    await requirePermission(user.id, "vehicles", "read");

    if (!isValidUUID(vehicleId)) {
      return empty;
    }

    const supabase = await createClient();

    const [vehicleRes, bookingsRes] = await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, customer_id, make, model, year, color, plate_number, vin, notes, is_active, created_at, updated_at, customers(id, full_name, phone, email, source, is_active)"
        )
        .eq("id", vehicleId)
        .single(),
      supabase
        .from("bookings")
        .select(
          "id, customer_id, vehicle_id, service_id, status, preferred_date, preferred_time, customer_notes, admin_notes, source, created_by, created_at, updated_at, services(name)"
        )
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (vehicleRes.error || !vehicleRes.data) {
      return empty;
    }

    const bookingIds = (bookingsRes.data || []).map(
      (b: { id: string }) => b.id
    );

    let historyData: BookingStatusHistory[] = [];
    if (bookingIds.length > 0) {
      const { data: histRes } = await supabase
        .from("booking_status_history")
        .select(
          "id, booking_id, old_status, new_status, changed_by, notes, created_at"
        )
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false });
      historyData = (histRes || []) as BookingStatusHistory[];
    }

    const bookings = (bookingsRes.data || []).map(
      (b: Record<string, unknown>) => ({
        ...(b as Omit<Booking, never>),
        service_name:
          (b.services as { name: string } | null)?.name || undefined,
      })
    );

    return {
      vehicle: vehicleRes.data,
      bookings,
      history: historyData,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
      return empty;
    }
    console.error("getVehicleWithHistory unexpected error:", msg);
    return empty;
  }
}

export async function createVehicle(input: {
  customer_id: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  plate_number?: string;
  vin?: string;
  notes?: string;
}): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "vehicles", "create");

    const validationError = validateVehicleInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }
    if (!input.customer_id || !isValidUUID(input.customer_id)) {
      return { success: false, error: "معرف العميل غير صحيح" };
    }

    const supabase = await createClient();

    // Object-level: verify the target customer exists and is accessible
    const customerExists = await assertCustomerExists(
      supabase,
      input.customer_id
    );
    if (!customerExists) {
      return { success: false, error: "العميل غير موجود" };
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        customer_id: input.customer_id,
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year || null,
        color: input.color?.trim() || null,
        plate_number: input.plate_number?.trim() || null,
        vin: input.vin?.trim() || null,
        notes: input.notes?.trim() || null,
        is_active: true,
      })
      .select(
        "id, customer_id, make, model, year, color, plate_number, vin, notes, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("createVehicle DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء السيارة" };
    }

    await writeAuditLog(user.id, "vehicle_created", "vehicles", data.id, {
      make: data.make,
      model: data.model,
      customer_id: input.customer_id,
    });

    return { success: true, vehicle: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("createVehicle unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function updateVehicle(
  vehicleId: string,
  input: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    plate_number?: string;
    vin?: string;
    notes?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "vehicles", "update");

    if (!isValidUUID(vehicleId)) {
      return { success: false, error: "معرف السيارة غير صحيح" };
    }

    if (input.make !== undefined || input.model !== undefined) {
      const validationError = validateVehicleInput({
        make: input.make,
        model: input.model,
        year: input.year,
      });
      if (validationError) {
        return { success: false, error: validationError };
      }
    }

    const supabase = await createClient();

    // Object-level: verify vehicle exists before update
    const vehicleCheck = await assertVehicleExists(supabase, vehicleId);
    if (!vehicleCheck.exists) {
      return { success: false, error: "السيارة غير موجودة" };
    }

    const ALLOWED_FIELDS = [
      "make",
      "model",
      "year",
      "color",
      "plate_number",
      "vin",
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

    if (updateData.make !== undefined)
      updateData.make = (updateData.make as string).trim();
    if (updateData.model !== undefined)
      updateData.model = (updateData.model as string).trim();
    if (updateData.color !== undefined)
      updateData.color = (updateData.color as string)?.trim() || null;
    if (updateData.plate_number !== undefined)
      updateData.plate_number =
        (updateData.plate_number as string)?.trim() || null;
    if (updateData.vin !== undefined)
      updateData.vin = (updateData.vin as string)?.trim() || null;
    if (updateData.notes !== undefined)
      updateData.notes = (updateData.notes as string)?.trim() || null;

    const { data, error } = await supabase
      .from("vehicles")
      .update(updateData)
      .eq("id", vehicleId)
      .select(
        "id, customer_id, make, model, year, color, plate_number, vin, notes, is_active, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("updateVehicle DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء تحديث السيارة" };
    }

    await writeAuditLog(user.id, "vehicle_updated", "vehicles", vehicleId, {
      updated_fields: Object.keys(updateData),
    });

    return { success: true, vehicle: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("updateVehicle unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function softDeleteVehicle(
  vehicleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "vehicles", "delete");

    if (!isValidUUID(vehicleId)) {
      return { success: false, error: "معرف السيارة غير صحيح" };
    }

    const supabase = await createClient();

    // Object-level: verify vehicle exists before deactivation
    const vehicleCheck = await assertVehicleExists(supabase, vehicleId);
    if (!vehicleCheck.exists) {
      return { success: false, error: "السيارة غير موجودة" };
    }

    const { error } = await supabase
      .from("vehicles")
      .update({ is_active: false })
      .eq("id", vehicleId);

    if (error) {
      console.error("softDeleteVehicle DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء حذف السيارة" };
    }

    await writeAuditLog(
      user.id,
      "vehicle_deactivated",
      "vehicles",
      vehicleId,
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
    console.error("softDeleteVehicle unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

// ============================================================
// CUSTOMER NOTES ACTIONS
// ============================================================

export async function getCustomerNotes(
  customerId: string
): Promise<CustomerNote[]> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "read");

    if (!isValidUUID(customerId)) {
      return [];
    }

    const supabase = await createClient();

    // Object-level: verify customer exists before reading notes
    const customerExists = await assertCustomerExists(supabase, customerId);
    if (!customerExists) {
      return [];
    }

    const { data, error } = await supabase
      .from("customer_notes")
      .select("id, customer_id, content, created_by, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getCustomerNotes error:", error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED" || msg === "FORBIDDEN") {
      return [];
    }
    console.error("getCustomerNotes unexpected error:", msg);
    return [];
  }
}

export async function createCustomerNote(input: {
  customer_id: string;
  content: string;
}): Promise<{ success: boolean; note?: CustomerNote; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "create");

    if (!input.content || input.content.trim().length < 1) {
      return { success: false, error: "المحتوى مطلوب" };
    }
    if (input.content.trim().length > 2000) {
      return {
        success: false,
        error: "المحتوى طويل جداً (2000 حرف كحد أقصى)",
      };
    }
    if (!input.customer_id || !isValidUUID(input.customer_id)) {
      return { success: false, error: "معرف العميل غير صحيح" };
    }

    const supabase = await createClient();

    // Object-level: verify customer exists before creating note
    const customerExists = await assertCustomerExists(
      supabase,
      input.customer_id
    );
    if (!customerExists) {
      return { success: false, error: "العميل غير موجود" };
    }

    const { data, error } = await supabase
      .from("customer_notes")
      .insert({
        customer_id: input.customer_id,
        content: input.content.trim(),
        created_by: user.id,
      })
      .select("id, customer_id, content, created_by, created_at")
      .single();

    if (error) {
      console.error("createCustomerNote DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء إنشاء الملاحظة" };
    }

    await writeAuditLog(
      user.id,
      "customer_note_created",
      "customer_notes",
      data.id,
      { customer_id: input.customer_id }
    );

    return { success: true, note: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHORIZED") {
      return { success: false, error: "غير مصرح" };
    }
    if (msg === "FORBIDDEN") {
      return { success: false, error: "ليس لديك صلاحية" };
    }
    console.error("createCustomerNote unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}

export async function deleteCustomerNote(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    await requirePermission(user.id, "customers", "delete");

    if (!isValidUUID(noteId)) {
      return { success: false, error: "معرف الملاحظة غير صحيح" };
    }

    const supabase = await createClient();

    // Object-level: load the note first to verify it exists and get its customer_id
    const { data: noteData, error: noteError } = await supabase
      .from("customer_notes")
      .select("id, customer_id")
      .eq("id", noteId)
      .single();

    if (noteError || !noteData) {
      return { success: false, error: "الملاحظة غير موجودة" };
    }

    // Verify the user can access the parent customer
    const customerExists = await assertCustomerExists(
      supabase,
      noteData.customer_id
    );
    if (!customerExists) {
      return { success: false, error: "العميل غير موجود" };
    }

    const { error } = await supabase
      .from("customer_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      console.error("deleteCustomerNote DB error:", error.message);
      return { success: false, error: "حدث خطأ أثناء حذف الملاحظة" };
    }

    await writeAuditLog(
      user.id,
      "customer_note_deleted",
      "customer_notes",
      noteId,
      { customer_id: noteData.customer_id }
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
    console.error("deleteCustomerNote unexpected error:", msg);
    return { success: false, error: "حدث خطأ غير متوقع" };
  }
}
