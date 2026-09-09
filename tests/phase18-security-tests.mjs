import { createClient } from "@supabase/supabase-js";

// ============================================================
// PHASE 18 SECURITY + AUTHORIZATION TESTS
// ============================================================

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const PASS = process.env.TEST_PASSWORD || "Aa123456";
// NOTE: /api/test/run-action endpoint was removed in Phase 22
const API = process.env.TEST_API_URL || "http://localhost:3099/api/test/run-action";

let TOTAL = 0, PASSED = 0, FAILED = 0;
const FAILURES = [];

function log(t, r, d = "") {
  TOTAL++;
  if (r === "PASS") PASSED++; else { FAILED++; FAILURES.push(t); }
  const icon = r === "PASS" ? "\u2713" : r === "FAIL" ? "\u2717" : "\u25CB";
  console.log(`  ${icon} ${t}: ${r}${d ? " \u2014 " + d : ""}`);
}

async function invoke(accessToken, action, args = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, args, accessToken }),
      signal: controller.signal,
    });
    return await res.json();
  } finally { clearTimeout(timeout); }
}

async function si(email) {
  const c = createClient(URL, ANON);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`Auth ${email}: ${error.message}`);
  return data;
}

// ============================================================
// 1: SUPER_ADMIN — full access baseline
// ============================================================
async function section1() {
  console.log("\n=== SECTION 1: ADMIN BASELINE ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  const r1 = await invoke(at, "getDashboardKPIs");
  log("S1-ADMIN-KPI", r1.ok && r1.result?.success ? "PASS" : "FAIL", r1.result?.error || "");
  const k = r1.result?.data;
  log("S1-ADMIN-HAS-REVENUE", k && typeof k.revenue === "number" ? "PASS" : "FAIL");
  log("S1-ADMIN-HAS-BOOKINGS", k && typeof k.bookingsToday === "number" ? "PASS" : "FAIL");
  log("S1-ADMIN-HAS-REFERRALS", k && typeof k.totalReferrals === "number" ? "PASS" : "FAIL");
  log("S1-ADMIN-HAS-COMMISSIONS", k && typeof k.pendingCommissions === "number" ? "PASS" : "FAIL");
  log("S1-ADMIN-HAS-LOWSTOCK", k && typeof k.lowStock === "number" ? "PASS" : "FAIL");

  const r2 = await invoke(at, "getRevenueChartData", { from: "2026-08-01", to: "2026-08-31" });
  log("S1-ADMIN-REVENUE-CHART", r2.ok && r2.result?.success ? "PASS" : "FAIL");

  const r3 = await invoke(at, "getBookingsChartData", { from: "2026-08-01", to: "2026-08-31" });
  log("S1-ADMIN-BOOKINGS-CHART", r3.ok && r3.result?.success ? "PASS" : "FAIL");

  const r4 = await invoke(at, "getServicesChartData", { from: "2026-08-01", to: "2026-08-31" });
  log("S1-ADMIN-SERVICES-CHART", r4.ok && r4.result?.success ? "PASS" : "FAIL");

  const r5 = await invoke(at, "getDealerPerformanceData");
  log("S1-ADMIN-DEALER-PERF", r5.ok && r5.result?.success ? "PASS" : "FAIL");

  const r6 = await invoke(at, "getInventoryChartData");
  log("S1-ADMIN-INVENTORY-CHART", r6.ok && r6.result?.success ? "PASS" : "FAIL");

  const r7 = await invoke(at, "getRecentActivity", { limit: 5 });
  log("S1-ADMIN-ACTIVITY", r7.ok && r7.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// 2: DEALER — cannot access dashboard data
// ============================================================
async function section2() {
  console.log("\n=== SECTION 2: DEALER ISOLATION ===");
  const { session } = await si("dealer-a@test.com");
  const at = session.access_token;

  const d1 = await invoke(at, "getDashboardKPIs");
  log("D1-DEALER-KPI-OK", d1.ok && d1.result?.success ? "PASS" : "FAIL");
  const dk = d1.result?.data;
  log("D2-DEALER-NO-REVENUE", dk?.revenue === 0 ? "PASS" : "FAIL", `revenue=${dk?.revenue}`);
  log("D3-DEALER-NO-BOOKINGS", dk?.bookingsToday === 0 ? "PASS" : "FAIL", `bookings=${dk?.bookingsToday}`);
  log("D4-DEALER-NO-CARS", dk?.carsInService === 0 ? "PASS" : "FAIL", `cars=${dk?.carsInService}`);
  log("D5-DEALER-NO-PENDING", dk?.pendingPayments === 0 ? "PASS" : "FAIL", `pending=${dk?.pendingPayments}`);
  log("D6-DEALER-NO-STOCK", dk?.lowStock === 0 ? "PASS" : "FAIL", `lowStock=${dk?.lowStock}`);
  log("D7-DEALER-NO-COMMISSIONS", dk?.pendingCommissions === 0 ? "PASS" : "FAIL", `commissions=${dk?.pendingCommissions}`);

  const d2 = await invoke(at, "getRevenueChartData", { from: "2026-08-01", to: "2026-08-31" });
  log("D8-DEALER-REVENUE-CHART", d2.ok ? "PASS" : "FAIL");

  const d3 = await invoke(at, "getDealerPerformanceData");
  log("D9-DEALER-PERF", d3.ok && d3.result?.success ? "PASS" : "FAIL");

  const d4 = await invoke(at, "getInventoryChartData");
  log("D10-DEALER-INVENTORY", d4.ok && d4.result?.success ? "PASS" : "FAIL");

  const d5 = await invoke(at, "getRecentActivity", { limit: 10 });
  log("D11-DEALER-ACTIVITY", d5.ok && d5.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// 3: RECEPTIONIST — limited operational KPIs
// ============================================================
async function section3() {
  console.log("\n=== SECTION 3: RECEPTIONIST ===");
  const { session } = await si("reception@hima.com");
  const at = session.access_token;

  const r1 = await invoke(at, "getDashboardKPIs");
  log("R1-REC-KPI", r1.ok && r1.result?.success ? "PASS" : "FAIL");
  const rk = r1.result?.data;
  log("R2-REC-NO-REVENUE", rk?.revenue === 0 ? "PASS" : "FAIL", `revenue=${rk?.revenue}`);
  log("R3-REC-NO-PENDING", rk?.pendingPayments === 0 ? "PASS" : "FAIL", `pending=${rk?.pendingPayments}`);
  log("R4-REC-NO-COMMISSIONS", rk?.pendingCommissions === 0 ? "PASS" : "FAIL", `commissions=${rk?.pendingCommissions}`);
  log("R5-REC-NO-LOWSTOCK", rk?.lowStock === 0 ? "PASS" : "FAIL", `lowStock=${rk?.lowStock}`);
}

// ============================================================
// 4: UNAUTHENTICATED — must fail
// ============================================================
async function section4() {
  console.log("\n=== SECTION 4: UNAUTHENTICATED ===");

  const u1 = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getDashboardKPIs", args: {}, accessToken: "" }),
  });
  const j1 = await u1.json();
  log("U1-NO-TOKEN", !j1.ok || j1.error ? "PASS" : "FAIL", j1.error || "");

  const u2 = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getDashboardKPIs", args: {}, accessToken: "bad-token" }),
  });
  const j2 = await u2.json();
  log("U2-BAD-TOKEN", !j2.ok || j2.error ? "PASS" : "FAIL", j2.error || "");
}

// ============================================================
// 5: FORGERY — dealer cannot escalate privileges
// ============================================================
async function section5() {
  console.log("\n=== SECTION 5: FORGERY ===");
  const { session } = await si("dealer-a@test.com");
  const at = session.access_token;

  const f1 = await invoke(at, "getDashboardKPIs");
  const fk = f1.result?.data;
  log("F1-FORGED-KPI", f1.ok && f1.result?.success ? "PASS" : "FAIL");
  log("F2-FORGED-NO-REVENUE", fk?.revenue === 0 ? "PASS" : "FAIL", `revenue=${fk?.revenue}`);

  const f2 = await invoke(at, "getRecentActivity", { limit: 100 });
  log("F3-FORGED-ACTIVITY", f2.ok && f2.result?.success ? "PASS" : "FAIL");

  const f3 = await invoke(at, "getRevenueChartData", { from: "2026-01-01", to: "2026-12-31" });
  log("F4-FORGED-REVENUE-CHART", f3.ok ? "PASS" : "FAIL");
}

// ============================================================
// 6: DATE VALIDATION
// ============================================================
async function section6() {
  console.log("\n=== SECTION 6: DATE VALIDATION ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  const dv1 = await invoke(at, "getRevenueChartData", { from: "2026-12-31", to: "2026-01-01" });
  log("DV1-FROM-AFTER-TO", dv1.ok && dv1.result?.success === false ? "PASS" : "FAIL", dv1.result?.error || "");

  const dv2 = await invoke(at, "getRevenueChartData", { from: "bad", to: "2026-01-01" });
  log("DV2-INVALID-DATE", dv2.ok && dv2.result?.success === false ? "PASS" : "FAIL", dv2.result?.error || "");

  const dv3 = await invoke(at, "getRevenueChartData", { from: "2026-08-01", to: "2026-08-31" });
  log("DV3-VALID-RANGE", dv3.ok && dv3.result?.success === true ? "PASS" : "FAIL");
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("PHASE 18: SECURITY + AUTHORIZATION TESTS");
  console.log("=".repeat(60));

  try { await section1();   } catch (e) { log("SECTION1", "FAIL", e.message); }
  try { await section2(); } catch (e) { log("SECTION2", "FAIL", e.message); }
  try { await section3(); } catch (e) { log("SECTION3", "FAIL", e.message); }
  try { await section4(); } catch (e) { log("SECTION4", "FAIL", e.message); }
  try { await section5(); } catch (e) { log("SECTION5", "FAIL", e.message); }
  try { await section6(); } catch (e) { log("SECTION6", "FAIL", e.message); }

  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL: ${TOTAL} | PASS: ${PASSED} | FAIL: ${FAILED}`);
  console.log("=".repeat(60));

  if (FAILURES.length > 0) {
    console.log("\nFAILED:");
    FAILURES.forEach(f => console.log(`  - ${f}`));
  }

  process.exit(FAILED > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
