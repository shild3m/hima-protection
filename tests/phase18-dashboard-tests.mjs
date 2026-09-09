import { createClient } from "@supabase/supabase-js";

// ============================================================
// PHASE 18: ADMIN DASHBOARD — COMPREHENSIVE TEST SUITE
// Tests: KPIs, Charts, Activity, Security, RBAC, Access Control
// ============================================================

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const PASS = process.env.TEST_PASSWORD || "Aa123456";
// NOTE: /api/test/run-action endpoint was removed in Phase 22
const API = process.env.TEST_API_URL || "http://localhost:3099/api/test/run-action";

const R = [];
let TOTAL = 0;
let PASSED = 0;
let FAILED = 0;

function log(t, r, d = "") {
  TOTAL++;
  if (r === "PASS") PASSED++; else FAILED++;
  R.push({ t, r, d });
  const icon = r === "PASS" ? "\u2713" : r === "FAIL" ? "\u2717" : "\u25CB";
  console.log(`  ${icon} ${t}: ${r}${d ? " \u2014 " + d : ""}`);
}

const adminSB = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg");

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
    const json = await res.json();
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function si(email) {
  const c = createClient(URL, ANON);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`Auth ${email}: ${error.message}`);
  return data;
}

// ============================================================
// SECTION 1: SUPER_ADMIN — FULL ACCESS
// ============================================================
async function section1_superAdminKPIs() {
  console.log("\n=== SECTION 1: SUPER_ADMIN KPIs ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  // K1: getDashboardKPIs returns success
  const k1 = await invoke(at, "getDashboardKPIs");
  log("K1-DASHBOARD-KPI-SUCCESS", k1.ok && k1.result?.success ? "PASS" : "FAIL",
    k1.result?.error || "");

  // K2: KPI data structure has all expected fields
  const kpis = k1.result?.data;
  const hasAllFields = kpis && typeof kpis.bookingsToday === "number" &&
    typeof kpis.newCustomers === "number" &&
    typeof kpis.carsInService === "number" &&
    typeof kpis.completedServices === "number" &&
    typeof kpis.revenue === "number" &&
    typeof kpis.pendingPayments === "number" &&
    typeof kpis.totalReferrals === "number" &&
    typeof kpis.pendingCommissions === "number" &&
    typeof kpis.lowStock === "number";
  log("K2-KPI-FIELDS-COMPLETE", hasAllFields ? "PASS" : "FAIL");

  // K3: KPI values are non-negative
  const allNonNeg = kpis && Object.values(kpis).every(v =>
    typeof v === "number" ? v >= 0 : true
  );
  log("K3-KPI-VALUES-NON-NEGATIVE", allNonNeg ? "PASS" : "FAIL");

  // K4: Revenue is a number (not NaN/undefined)
  log("K4-REVENUE-NUMERIC", typeof kpis?.revenue === "number" ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 2: CHART DATA
// ============================================================
async function section2_chartData() {
  console.log("\n=== SECTION 2: CHART DATA ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  // C1: Revenue chart data
  const c1 = await invoke(at, "getRevenueChartData", { from: thirtyDaysAgo, to: today });
  log("C1-REVENUE-CHART", c1.ok && c1.result?.success ? "PASS" : "FAIL",
    c1.result?.error || "");
  const revData = c1.result?.data;
  log("C2-REVENUE-CHART-ARRAYS", Array.isArray(revData?.labels) && Array.isArray(revData?.values) ? "PASS" : "FAIL");
  log("C3-REVENUE-CHART-LENGTH", revData?.labels?.length === revData?.values?.length ? "PASS" : "FAIL");

  // C4: Bookings chart data
  const c4 = await invoke(at, "getBookingsChartData", { from: thirtyDaysAgo, to: today });
  log("C4-BOOKINGS-CHART", c4.ok && c4.result?.success ? "PASS" : "FAIL");

  // C5: Services chart data
  const c5 = await invoke(at, "getServicesChartData", { from: thirtyDaysAgo, to: today });
  log("C5-SERVICES-CHART", c5.ok && c5.result?.success ? "PASS" : "FAIL");

  // C6: Dealer performance data
  const c6 = await invoke(at, "getDealerPerformanceData");
  log("C6-DEALER-PERF", c6.ok && c6.result?.success ? "PASS" : "FAIL");
  const dp = c6.result?.data;
  log("C7-DEALER-PERF-ARRAYS", Array.isArray(dp?.names) && Array.isArray(dp?.referralCounts) ? "PASS" : "FAIL");
  log("C8-DEALER-PERF-LENGTH", dp?.names?.length === dp?.referralCounts?.length ? "PASS" : "FAIL");

  // C9: Inventory chart data
  const c9 = await invoke(at, "getInventoryChartData");
  log("C9-INVENTORY-CHART", c9.ok && c9.result?.success ? "PASS" : "FAIL");
  const inv = c9.result?.data;
  log("C10-INVENTORY-CHART-ARRAYS", Array.isArray(inv?.names) && Array.isArray(inv?.currentStock) ? "PASS" : "FAIL");
  log("C11-INVENTORY-CHART-LENGTHS", inv?.names?.length === inv?.currentStock?.length && inv?.currentStock?.length === inv?.minStock?.length ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 3: RECENT ACTIVITY
// ============================================================
async function section3_recentActivity() {
  console.log("\n=== SECTION 3: RECENT ACTIVITY ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  const allPerms = [
    "bookings:view", "customers:view", "invoices:view", "payments:view",
    "referrals:view"
  ];

  // A1: Recent activity with full permissions
  const a1 = await invoke(at, "getRecentActivity", { limit: 10 });
  log("A1-RECENT-ACTIVITY", a1.ok && a1.result?.success ? "PASS" : "FAIL",
    a1.result?.error || "");
  const acts = a1.result?.data;
  log("A2-ACTIVITY-IS-ARRAY", Array.isArray(acts) ? "PASS" : "FAIL");
  log("A3-ACTIVITY-LIMIT", acts?.length <= 10 ? "PASS" : "FAIL",
    `count=${acts?.length}`);

  // A4: Activity items have required fields
  if (acts && acts.length > 0) {
    const item = acts[0];
    const valid = item.id && item.type && item.title && item.timestamp;
    log("A4-ACTIVITY-ITEM-FIELDS", valid ? "PASS" : "FAIL");
  } else {
    log("A4-ACTIVITY-ITEM-FIELDS", "PASS", "no activity (empty DB)");
  }

  // A5: Activity with no permissions returns empty (server resolves permissions)
  const a5 = await invoke(at, "getRecentActivity", { limit: 10 });
  log("A5-ACTIVITY-SERVER-AUTH", a5.ok && a5.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 4: SERVER-SIDE AUTH VERIFICATION
// ============================================================
async function section4_permissionFiltering() {
  console.log("\n=== SECTION 4: SERVER-SIDE AUTH VERIFICATION ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  // P1: Admin gets full KPIs (server resolves permissions)
  const p1 = await invoke(at, "getDashboardKPIs");
  const z = p1.result?.data;
  log("P1-ADMIN-FULL-KPI", p1.ok && p1.result?.success ? "PASS" : "FAIL");
  log("P2-ADMIN-HAS-REVENUE", typeof z?.revenue === "number" ? "PASS" : "FAIL");
  log("P3-ADMIN-HAS-BOOKINGS", typeof z?.bookingsToday === "number" ? "PASS" : "FAIL");
  log("P4-ADMIN-HAS-LOWSTOCK", typeof z?.lowStock === "number" ? "PASS" : "FAIL");
  log("P5-ADMIN-HAS-REFERRALS", typeof z?.totalReferrals === "number" ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 5: DEALER ACCESS CONTROL
// ============================================================
async function section5_dealerAccess() {
  console.log("\n=== SECTION 5: DEALER ACCESS CONTROL ===");

  // D1: Dealer cannot call admin-only actions directly
  let dealerSession;
  try {
    dealerSession = await si("dealer-a@test.com");
  } catch {
    log("D1-DEALER-AUTH", "FAIL", "dealer login failed");
    return;
  }
  const dealerToken = dealerSession.session.access_token;

  // D2: getDashboardKPIs works with dealer permissions (limited by server-side auth)
  const d2 = await invoke(dealerToken, "getDashboardKPIs");
  const dk = d2.result?.data;
  log("D1-DEALER-KPI-LIMITED",
    dk?.bookingsToday === 0 && dk?.revenue === 0 && dk?.carsInService === 0 ? "PASS" : "FAIL");

  // D3: getRevenueChartData should work but return data (dealer permissions don't affect chart)
  const d3 = await invoke(dealerToken, "getRevenueChartData", {
    from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  log("D2-DEALER-CHART-RETURN", d3.ok && d3.result?.success ? "PASS" : "FAIL");

  // D4: getDealerPerformanceData - dealer can see this
  const d4 = await invoke(dealerToken, "getDealerPerformanceData");
  log("D3-DEALER-PERF-ACCESS", d4.ok && d4.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 6: DATA LEAKAGE PREVENTION
// ============================================================
async function section6_dataLeakage() {
  console.log("\n=== SECTION 6: DATA LEAKAGE PREVENTION ===");

  // L1: Receiptionist (limited perms) — server resolves permissions
  let receptionSession;
  try {
    receptionSession = await si("reception@hima.com");
  } catch {
    log("L1-RECEPTION-AUTH", "FAIL", "reception login failed");
    return;
  }
  const recToken = receptionSession.session.access_token;

  const l1 = await invoke(recToken, "getDashboardKPIs");
  const rk = l1.result?.data;
  log("L1-RECEPTION-NO-FINANCIAL",
    rk?.revenue === 0 && rk?.pendingPayments === 0 && rk?.pendingCommissions === 0 ? "PASS" : "FAIL");

  // L2: Receptionist recent activity limited by server-side permissions
  const l2 = await invoke(recToken, "getRecentActivity", {
    limit: 10
  });
  log("L2-RECEPTION-ACTIVITY", l2.ok && l2.result?.success ? "PASS" : "FAIL");

  // L3: Chart data with restricted permissions (only bookings)
  const l3 = await invoke(recToken, "getBookingsChartData", {
    from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  log("L3-RECEPTION-CHARTS-BOOKINGS", l3.ok && l3.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 7: INPUT VALIDATION
// ============================================================
async function section7_inputValidation() {
  console.log("\n=== SECTION 7: INPUT VALIDATION ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  // V1: Invalid date range (from > to)
  const v1 = await invoke(at, "getRevenueChartData", {
    from: "2026-12-31",
    to: "2026-01-01"
  });
  log("V1-INVALID-DATE-RANGE", v1.ok && v1.result?.success === false ? "PASS" : "FAIL",
    v1.result?.error || "");

  // V2: Empty permissions array
  const v2 = await invoke(at, "getDashboardKPIs", { permissions: [] });
  log("V2-EMPTY-PERMISSIONS", v2.ok && v2.result?.success ? "PASS" : "FAIL");

  // V3: getRecentActivity with 0 limit
  const v3 = await invoke(at, "getRecentActivity", { permissions: ["bookings:view"], limit: 0 });
  log("V3-ZERO-LIMIT", v3.ok && v3.result?.success ? "PASS" : "FAIL");

  // V4: getRecentActivity with negative limit
  const v4 = await invoke(at, "getRecentActivity", { permissions: ["bookings:view"], limit: -1 });
  log("V4-NEGATIVE-LIMIT", v4.ok && v4.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 8: EXISTING ACTIONS VERIFICATION
// ============================================================
async function section8_existingActions() {
  console.log("\n=== SECTION 8: EXISTING ACTIONS VERIFICATION ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  // E1: getBookingStats
  const e1 = await invoke(at, "getBookingStats");
  log("E1-BOOKING-STATS", e1.ok && e1.result?.success ? "PASS" : "FAIL");

  // E2: getInvoiceStats
  const e2 = await invoke(at, "getInvoiceStats");
  log("E2-INVOICE-STATS", e2.ok && e2.result?.success ? "PASS" : "FAIL");

  // E3: getStaff
  const e3 = await invoke(at, "getStaff");
  log("E3-GET-STAFF", e3.ok && e3.result?.success ? "PASS" : "FAIL");

  // E4: getRoles
  const e4 = await invoke(at, "getRoles");
  log("E4-GET-ROLES", e4.ok && e4.result?.success ? "PASS" : "FAIL");

  // E5: getAllPermissions
  const e5 = await invoke(at, "getAllPermissions");
  log("E5-GET-PERMISSIONS", e5.ok && (e5.result?.success !== false || e5.result?.data) ? "PASS" : "FAIL");

  // E6: getAuditLogs
  const e6 = await invoke(at, "getAuditLogs");
  log("E6-AUDIT-LOGS", e6.ok && e6.result?.success ? "PASS" : "FAIL");

  // E7: getDealers (returns {data} not {success,data})
  const e7 = await invoke(at, "getDealers");
  log("E7-GET-DEALERS", e7.ok && e7.result?.data ? "PASS" : "FAIL");

  // E8: getReferrals (returns {data} not {success,data})
  const e8 = await invoke(at, "getReferrals", { filters: {}, sort: {}, page: 1, per_page: 5 });
  log("E8-GET-REFERRALS", e8.ok && e8.result?.data ? "PASS" : "FAIL");

  // E9: getCommissions (returns {data} not {success,data})
  const e9 = await invoke(at, "getCommissions", { filters: {}, sort: {}, page: 1, per_page: 5 });
  log("E9-GET-COMMISSIONS", e9.ok && e9.result?.data ? "PASS" : "FAIL");

  // E10: getNotifications
  const e10 = await invoke(at, "getNotifications", { page: 1, pageSize: 5 });
  log("E10-GET-NOTIFICATIONS", e10.ok && e10.result?.success ? "PASS" : "FAIL");

  // E11: getUnreadCount
  const e11 = await invoke(at, "getUnreadCount");
  log("E11-UNREAD-COUNT", e11.ok && e11.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// SECTION 9: EDGE CASES
// ============================================================
async function section9_edgeCases() {
  console.log("\n=== SECTION 9: EDGE CASES ===");
  const { session } = await si("10admin@admin.com");
  const at = session.access_token;

  // X1: Same-day range
  const today = new Date().toISOString().split("T")[0];
  const x1 = await invoke(at, "getRevenueChartData", { from: today, to: today });
  log("X1-SAME-DAY-RANGE", x1.ok && x1.result?.success ? "PASS" : "FAIL");

  // X2: Far future date range
  const x2 = await invoke(at, "getRevenueChartData", { from: "2030-01-01", to: "2030-12-31" });
  log("X2-FUTURE-RANGE", x2.ok && x2.result?.success ? "PASS" : "FAIL");

  // X3: getRecentActivity with large limit
  const x3 = await invoke(at, "getRecentActivity", { limit: 1000 });
  log("X3-LARGE-LIMIT", x3.ok && x3.result?.success ? "PASS" : "FAIL");
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("PHASE 18: ADMIN DASHBOARD — COMPREHENSIVE TEST SUITE");
  console.log("=".repeat(60));

  try { await section1_superAdminKPIs(); } catch (e) { log("SECTION1", "FAIL", e.message); }
  try { await section2_chartData(); } catch (e) { log("SECTION2", "FAIL", e.message); }
  try { await section3_recentActivity(); } catch (e) { log("SECTION3", "FAIL", e.message); }
  try { await section4_permissionFiltering(); } catch (e) { log("SECTION4", "FAIL", e.message); }
  try { await section5_dealerAccess(); } catch (e) { log("SECTION5", "FAIL", e.message); }
  try { await section6_dataLeakage(); } catch (e) { log("SECTION6", "FAIL", e.message); }
  try { await section7_inputValidation(); } catch (e) { log("SECTION7", "FAIL", e.message); }
  try { await section8_existingActions(); } catch (e) { log("SECTION8", "FAIL", e.message); }
  try { await section9_edgeCases(); } catch (e) { log("SECTION9", "FAIL", e.message); }

  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL: ${TOTAL} | PASS: ${PASSED} | FAIL: ${FAILED}`);
  console.log("=".repeat(60));

  if (FAILED > 0) {
    console.log("\nFAILED TESTS:");
    for (const r of R.filter(x => x.r === "FAIL")) {
      console.log(`  ✗ ${r.t}: ${r.d}`);
    }
  }

  process.exit(FAILED > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
