"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

interface GlobalSearchResult {
  id: string;
  type: "customer" | "vehicle" | "booking" | "invoice";
  title: string;
  subtitle: string;
  href: string;
}

function sanitizeSearch(input: string): string {
  return input
    .trim()
    .replace(/,/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\./g, "")
    .replace(/\*/g, "")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

const MAX_PER_TYPE = 3;

interface BookingRow {
  id: string;
  status: string;
  created_at: string;
  customer: { full_name: string; phone: string | null } | null;
  vehicle: { make: string; model: string; plate_number: string | null } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
  customer: { full_name: string; phone: string | null } | null;
}

/**
 * Merge result groups coming from several PostgREST branches (see below),
 * keeping the newest rows and dropping duplicates by id.
 */
function mergeNewest<T extends { id: string; created_at: string }>(groups: T[], limit: number): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const row of groups) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  merged.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return merged.slice(0, limit);
}

/**
 * One round trip group instead of four sequential server-action calls.
 *
 * Permissions come from the short-lived (30s) CurrentUser cache — the same
 * source as `has_permission`. Each table is only queried when the caller can
 * read it, and the queries run in parallel through the RLS-bound client.
 *
 * NOTE: PostgREST cannot OR across two embedded resources in a single request
 * (`or=(customer.x,vehicle.y)` is rejected with PGRST100), so joining searches
 * run as parallel branches against the embedded resource (`referencedTable`
 * maps to `customer.or=(...)`) and are merged here.
 */
export async function globalSearch(rawQuery: string): Promise<GlobalSearchResult[]> {
  const query = sanitizeSearch(rawQuery || "");
  if (query.length < 2) return [];

  const user = await getCurrentUser();
  if (!user) return [];

  const can = (perm: string) => user.permissions.includes(perm);

  const supabase = await createClient();
  const like = `%${query}%`;
  const jobs: Promise<GlobalSearchResult[]>[] = [];

  if (can("customers:read")) {
    jobs.push(
      (async () => {
        const { data } = await supabase
          .from("customers")
          .select("id, full_name, phone, created_at")
          .or(`full_name.ilike.${like},phone.ilike.${like}`)
          .order("created_at", { ascending: false })
          .limit(MAX_PER_TYPE);

        return (data || []).map((c) => ({
          id: c.id as string,
          type: "customer" as const,
          title: c.full_name as string,
          subtitle: (c.phone as string) || "",
          href: `/admin/customers?id=${c.id}`,
        }));
      })()
    );
  }

  if (can("vehicles:read")) {
    jobs.push(
      (async () => {
        const { data } = await supabase
          .from("vehicles")
          .select("id, make, model, plate_number, vin, created_at")
          .or(
            `make.ilike.${like},model.ilike.${like},plate_number.ilike.${like},vin.ilike.${like}`
          )
          .order("created_at", { ascending: false })
          .limit(MAX_PER_TYPE);

        return (data || []).map((v) => ({
          id: v.id as string,
          type: "vehicle" as const,
          title: `${v.make} ${v.model}`,
          subtitle: (v.plate_number as string) || (v.vin as string) || "",
          href: `/admin/vehicles?id=${v.id}`,
        }));
      })()
    );
  }

  if (can("bookings:read")) {
    jobs.push(
      (async () => {
        const [byCustomer, byVehicle] = await Promise.all([
          supabase
            .from("bookings")
            .select(
              "id, status, created_at, customer:customers!inner(full_name, phone), vehicle:vehicles!inner(make, model, plate_number)"
            )
            .or(`full_name.ilike.${like},phone.ilike.${like}`, { referencedTable: "customer" })
            .order("created_at", { ascending: false })
            .limit(MAX_PER_TYPE),
          supabase
            .from("bookings")
            .select(
              "id, status, created_at, customer:customers!inner(full_name, phone), vehicle:vehicles!inner(make, model, plate_number)"
            )
            .or(`make.ilike.${like},model.ilike.${like},plate_number.ilike.${like}`, {
              referencedTable: "vehicle",
            })
            .order("created_at", { ascending: false })
            .limit(MAX_PER_TYPE),
        ]);

        const rows = [
          ...((byCustomer.data || []) as unknown as BookingRow[]),
          ...((byVehicle.data || []) as unknown as BookingRow[]),
        ];

        return mergeNewest(rows, MAX_PER_TYPE).map((b) => ({
          id: b.id,
          type: "booking" as const,
          title: b.customer?.full_name ? `حجز ${b.customer.full_name}` : `حجز ${b.id.slice(0, 8)}`,
          subtitle: [b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : null, b.status]
            .filter(Boolean)
            .join(" — "),
          href: `/admin/bookings?id=${b.id}`,
        }));
      })()
    );
  }

  if (can("invoices:read")) {
    jobs.push(
      (async () => {
        const [byNumber, byCustomer] = await Promise.all([
          supabase
            .from("invoices")
            .select(
              "id, invoice_number, total, status, created_at, customer:customers!inner(full_name, phone)"
            )
            .or(`invoice_number.ilike.${like}`)
            .order("created_at", { ascending: false })
            .limit(MAX_PER_TYPE),
          supabase
            .from("invoices")
            .select(
              "id, invoice_number, total, status, created_at, customer:customers!inner(full_name, phone)"
            )
            .or(`full_name.ilike.${like},phone.ilike.${like}`, { referencedTable: "customer" })
            .order("created_at", { ascending: false })
            .limit(MAX_PER_TYPE),
        ]);

        const rows = [
          ...((byNumber.data || []) as unknown as InvoiceRow[]),
          ...((byCustomer.data || []) as unknown as InvoiceRow[]),
        ];

        return mergeNewest(rows, MAX_PER_TYPE).map((inv) => ({
          id: inv.id,
          type: "invoice" as const,
          title: inv.invoice_number,
          subtitle: `${Number(inv.total || 0).toLocaleString("en-GB")} ر.س — ${
            inv.customer?.full_name || inv.status
          }`,
          href: `/admin/invoices?id=${inv.id}`,
        }));
      })()
    );
  }

  if (jobs.length === 0) return [];

  const groups = await Promise.allSettled(jobs);
  return groups.flatMap((g) => (g.status === "fulfilled" ? g.value : []));
}
