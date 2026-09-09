import { createClient } from "@supabase/supabase-js";

const URL = "https://nzspowfxwntxfievmmxq.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const admin = createClient(URL, SERVICE_KEY);
const anon = createClient(URL, anonKey);

async function main() {
  console.log("=== POST-MIGRATION VERIFICATION (via data queries) ===\n");

  // 1. RLS on RBAC - try querying as anon (should be blocked)
  console.log("--- C7: RLS on RBAC tables (anon should get 0 rows or error) ---");
  for (const t of ["roles", "permissions", "role_permissions"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    const count = data?.length || 0;
    const blocked = error || count === 0;
    console.log(`  ${t}: ${blocked ? "BLOCKED (GOOD)" : "OPEN (BAD)"} (${count} rows, error: ${error?.message || "none"})`);
  }

  // Also check as admin (service_role bypasses RLS)
  console.log("  [as service_role, these tables should exist]");
  for (const t of ["roles", "permissions", "role_permissions"]) {
    const { data, error } = await admin.from(t).select("*").limit(1);
    console.log(`  ${t}: ${error ? "ERROR: " + error.message : data?.length + " row(s) accessible"}`);
  }

  // 2. Dashboard functions via RPC (service_role)
  console.log("\n--- C8: Dashboard functions via RPC ---");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const today = new Date().toISOString().split("T")[0];

  const rpcTests = [
    { name: "dashboard_revenue_month", args: { p_month_start: monthStart } },
    { name: "dashboard_pending_payments", args: {} },
    { name: "dashboard_pending_commissions", args: {} },
    { name: "dashboard_bookings_by_status", args: { p_date: today } },
    { name: "dashboard_revenue_chart", args: { p_from: today, p_to: today } },
    { name: "dashboard_bookings_chart", args: { p_from: today, p_to: today } },
    { name: "dashboard_services_chart", args: { p_from: today, p_to: today } },
    { name: "dashboard_dealer_performance", args: {} },
    { name: "dashboard_low_stock_count", args: {} },
  ];
  for (const { name, args } of rpcTests) {
    const { data, error } = await admin.rpc(name, args);
    console.log(`  ${name}: ${error ? "ERROR: " + error.message : "OK → " + JSON.stringify(data)}`);
  }

  // 3. get_app_test_ids should be dropped
  console.log("\n--- C10: get_app_test_ids (should fail) ---");
  const { data: tid, error: tidErr } = await admin.rpc("get_app_test_ids");
  console.log(`  get_app_test_ids: ${tidErr ? "DROPPED (GOOD): " + tidErr.message : "EXISTS (BAD): " + JSON.stringify(tid)}`);

  // 4. Commission trigger test: try invalid transition
  console.log("\n--- DB1: Commission status trigger ---");
  const { data: commissions } = await admin.from("commissions").select("id, status").limit(3);
  if (commissions?.length > 0) {
    const c = commissions[0];
    // If pending, try setting to 'paid' directly (should fail: pending→paid not allowed)
    if (c.status === "pending") {
      const { error: e } = await admin.from("commissions").update({ status: "paid" }).eq("id", c.id);
      console.log(`  pending→paid attempt: ${e ? "BLOCKED (GOOD): " + e.message : "ALLOWED (BAD)"}`);
    } else {
      console.log(`  First commission is '${c.status}', skipping test (would need pending)`);
    }
  } else {
    console.log("  No commissions found to test");
  }

  // 5. Invoice trigger test: try invalid transition
  console.log("\n--- DB3: Invoice status trigger ---");
  const { data: invoices } = await admin.from("invoices").select("id, status").limit(3);
  if (invoices?.length > 0) {
    const inv = invoices[0];
    if (inv.status === "draft") {
      const { error: e } = await admin.from("invoices").update({ status: "paid" }).eq("id", inv.id);
      console.log(`  draft→paid attempt: ${e ? "BLOCKED (GOOD): " + e.message : "ALLOWED (BAD)"}`);
    } else {
      console.log(`  First invoice is '${inv.status}', skipping test (would need draft)`);
    }
  } else {
    console.log("  No invoices found to test");
  }

  // 6. Booking slot uniqueness (check via query)
  console.log("\n--- DB2: Duplicate booking slots ---");
  const { data: bookings } = await admin.from("bookings")
    .select("id, service_id, preferred_date, preferred_time, status")
    .not("status", "in", "(cancelled,no_show)")
    .not("preferred_date", "is", null)
    .not("preferred_time", "is", null);
  const slots = new Map();
  for (const b of bookings || []) {
    const key = `${b.service_id}|${b.preferred_date}|${b.preferred_time}`;
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key).push(b);
  }
  let dups = 0;
  for (const [k, v] of slots) {
    if (v.length > 1) { dups++; console.log(`  DUPLICATE: ${k} → ${v.length} bookings`); }
  }
  console.log(`  Active duplicate slots: ${dups}`);

  console.log("\n=== VERIFICATION COMPLETE ===");
}

main().catch(console.error);
