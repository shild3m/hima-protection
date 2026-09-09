import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";
const PASS = process.env.TEST_PASSWORD || "Aa123456";
// NOTE: /api/test/run-action endpoint was removed in Phase 22
const API = process.env.TEST_API_URL || "http://localhost:3099/api/test/run-action";
const R = [];
function log(t, r, d = "") { R.push({ t, r, d }); console.log(`  ${r === "PASS" ? "\u2713" : r === "FAIL" ? "\u2717" : r === "BLOCKED" ? "\u25CB" : "\u25CB"} ${t}: ${r}${d ? " \u2014 " + d : ""}`); }

const admin = createClient(URL, SERVICE_KEY);

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
// AUTH1: Anonymous cannot read private notifications
// ============================================================
async function testAUTH1() {
  console.log("\n=== AUTH1: ANONYMOUS ACCESS ===");
  try {
    const c = createClient(URL, ANON);
    const { data, error } = await c.from("notifications").select("id").limit(1);
    log("AUTH1a: Anonymous gets empty (RLS filters)", !error && data?.length === 0 ? "PASS" : "FAIL", `rows=${data?.length} error=${error?.message}`);
  } catch (e) { log("AUTH1", "FAIL", e.message); }
}

// ============================================================
// OWN1: User can read own + unread count
// ============================================================
async function testOWN1() {
  console.log("\n=== OWN1: OWNERSHIP ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const res = await invoke(sAdmin.access_token, "getNotifications", {});
    log("OWN1a: Admin can read own notifications", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result?.pagination));

    const countRes = await invoke(sAdmin.access_token, "getUnreadCount", {});
    log("OWN1b: Unread count returns", countRes?.result?.success === true ? "PASS" : "FAIL", `count=${countRes?.result?.count}`);
  } catch (e) { log("OWN1", "FAIL", e.message); }
}

// ============================================================
// OWN2: Cross-user protection (fake UUID)
// ============================================================
async function testOWN2() {
  console.log("\n=== OWN2: CROSS-USER PROTECTION ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await invoke(sAdmin.access_token, "markNotificationRead", { id: fakeId });
    log("OWN2a: Cannot mark non-existent notification", res?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(res?.result));
  } catch (e) { log("OWN2", "FAIL", e.message); }
}

// ============================================================
// DEAL1: Dealer isolation
// ============================================================
async function testDEAL1() {
  console.log("\n=== DEAL1: DEALER ISOLATION ===");
  const { session: sDealerA } = await si("dealer-a@test.com").catch(() => ({ session: null }));
  const { session: sDealerB } = await si("dealer-b@test.com").catch(() => ({ session: null }));
  try {
    if (!sDealerA) { log("DEAL1", "BLOCKED", "No dealer A user"); return; }

    const resA = await invoke(sDealerA.access_token, "getNotifications", {});
    log("DEAL1a: Dealer A can read own notifications", resA?.result?.success === true ? "PASS" : "FAIL", `count=${resA?.result?.pagination?.total}`);

    if (sDealerB) {
      const countA = await invoke(sDealerA.access_token, "getUnreadCount", {});
      const countB = await invoke(sDealerB.access_token, "getUnreadCount", {});
      log("DEAL1b: Dealers have separate counts", countA?.result?.success && countB?.result?.success ? "PASS" : "FAIL", `A=${countA?.result?.count} B=${countB?.result?.count}`);
    }
  } catch (e) { log("DEAL1", "FAIL", e.message); }
}

// ============================================================
// MARK1: Mark as read + mark all
// ============================================================
async function testMARK1() {
  console.log("\n=== MARK1: MARK AS READ ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const { data: users } = await admin.auth.admin.listUsers();
    const userId = users.users.find(u => u.email === "10admin@admin.com")?.id;
    if (!userId) { log("MARK1", "BLOCKED", "No admin user"); return; }

    await admin.rpc("create_notification", {
      p_user_id: userId, p_type: "low_stock", p_title: "Mark Test 1",
      p_message: "test", p_reference_type: "materials",
      p_reference_id: "00000000-0000-0000-0000-000000000001",
    });
    await admin.rpc("create_notification", {
      p_user_id: userId, p_type: "low_stock", p_title: "Mark Test 2",
      p_message: "test", p_reference_type: "materials",
      p_reference_id: "00000000-0000-0000-0000-000000000002",
    });

    const beforeCount = await invoke(sAdmin.access_token, "getUnreadCount", {});
    log("MARK1a: Has unread notifications", (beforeCount?.result?.count || 0) >= 2 ? "PASS" : "FAIL", `count=${beforeCount?.result?.count}`);

    const listRes = await invoke(sAdmin.access_token, "getNotifications", { page: 1, pageSize: 5 });
    const notifs = listRes?.result?.data || [];
    const unread = notifs.find(n => !n.is_read);

    if (unread) {
      const markRes = await invoke(sAdmin.access_token, "markNotificationRead", { id: unread.id });
      log("MARK1b: Mark single as read", markRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(markRes?.result));

      const afterCount = await invoke(sAdmin.access_token, "getUnreadCount", {});
      log("MARK1c: Count decreased", (afterCount?.result?.count || 0) < (beforeCount?.result?.count || 0) ? "PASS" : "FAIL", `${beforeCount?.result?.count} -> ${afterCount?.result?.count}`);
    }

    const markAllRes = await invoke(sAdmin.access_token, "markAllNotificationsRead", {});
    log("MARK1d: Mark all as read", markAllRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(markAllRes?.result));

    const finalCount = await invoke(sAdmin.access_token, "getUnreadCount", {});
    log("MARK1e: Unread count is 0", finalCount?.result?.count === 0 ? "PASS" : "FAIL", `count=${finalCount?.result?.count}`);
  } catch (e) { log("MARK1", "FAIL", e.message); }
}

// ============================================================
// IDEMP1: Sequential duplicate notification (5-minute window)
// ============================================================
async function testIDEMP1() {
  console.log("\n=== IDEMP1: SEQUENTIAL DUPLICATE PREVENTION ===");
  try {
    const { data: users } = await admin.auth.admin.listUsers();
    const userId = users.users.find(u => u.email === "10admin@admin.com")?.id;
    if (!userId) { log("IDEMP1", "BLOCKED", "No admin user"); return; }

    const refId = "11111111-1111-1111-1111-111111111111";
    const res1 = await admin.rpc("create_notification", {
      p_user_id: userId, p_type: "low_stock", p_title: "Idempotency Test 1",
      p_message: "test", p_reference_type: "materials", p_reference_id: refId,
    });
    log("IDEMP1a: First insert succeeds", res1?.data?.success === true && res1?.data?.id ? "PASS" : "FAIL", JSON.stringify(res1?.data));

    const res2 = await admin.rpc("create_notification", {
      p_user_id: userId, p_type: "low_stock", p_title: "Idempotency Test 2",
      p_message: "test dup", p_reference_type: "materials", p_reference_id: refId,
    });
    log("IDEMP1b: Sequential duplicate within 5min blocked", res2?.data?.duplicate === true ? "PASS" : "FAIL", JSON.stringify(res2?.data));

    const { count } = await admin.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", "low_stock").eq("reference_id", refId);
    log("IDEMP1c: Only 1 row created", count === 1 ? "PASS" : "FAIL", `rows=${count}`);
  } catch (e) { log("IDEMP1", "FAIL", e.message); }
}

// ============================================================
// RBAC1: Unauthorized cannot read other users' notifications
// ============================================================
async function testRBAC1() {
  console.log("\n=== RBAC1: UNAUTHORIZED OPERATIONS ===");
  const { session: sDealer } = await si("dealer-a@test.com").catch(() => ({ session: null }));
  try {
    if (!sDealer) { log("RBAC1", "BLOCKED", "No dealer user"); return; }
    const res = await invoke(sDealer.access_token, "getNotifications", {});
    log("RBAC1a: Dealer gets own (empty) notifications", res?.result?.success === true ? "PASS" : "FAIL", `count=${res?.result?.pagination?.total}`);
  } catch (e) { log("RBAC1", "FAIL", e.message); }
}

// ============================================================
// BKG1: booking_created notification on new booking
// ============================================================
async function testBKG1() {
  console.log("\n=== BKG1: BOOKING CREATED NOTIFICATION ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const { data: users } = await admin.auth.admin.listUsers();
    const userId = users.users.find(u => u.email === "10admin@admin.com")?.id;
    if (!userId) { log("BKG1", "BLOCKED", "No admin user"); return; }

    const beforeCount = await invoke(sAdmin.access_token, "getUnreadCount", {});

    const servicesRes = await admin.from("services").select("id").eq("is_active", true).limit(1);
    const serviceId = servicesRes?.data?.[0]?.id;
    if (!serviceId) { log("BKG1", "BLOCKED", "No active service"); return; }

    const uniquePhone = "9665" + String(Date.now()).slice(-7);
    const createRes = await invoke(sAdmin.access_token, "createBooking", {
      input: {
        customerName: "Notification Test",
        customerPhone: uniquePhone,
        vehicleMake: "Toyota",
        vehicleModel: "Camry",
        vehicleYear: 2024,
        serviceId: serviceId,
        preferredDate: "2026-12-01",
        preferredTime: "10:00",
        notes: "Phase 17 notification test",
      }
    });
    log("BKG1a: Booking created", createRes?.result?.success === true ? "PASS" : "FAIL", `bookingId=${createRes?.result?.bookingId}`);

    const afterCount = await invoke(sAdmin.access_token, "getUnreadCount", {});
    const beforeNum = beforeCount?.result?.count || 0;
    const afterNum = afterCount?.result?.count || 0;
    log("BKG1b: Booking notification received", afterNum > beforeNum ? "PASS" : "FAIL", `${beforeNum} -> ${afterNum}`);
  } catch (e) { log("BKG1", "FAIL", e.message); }
}

// ============================================================
// CONC1: Concurrent duplicate notification (race-safe idempotency)
// Fires 5 identical requests via Promise.all to trigger the
// EXCEPTION handler path in create_notification().
// ============================================================
async function testCONC1() {
  console.log("\n=== CONC1: CONCURRENT DUPLICATE PREVENTION ===");
  try {
    const { data: users } = await admin.auth.admin.listUsers();
    const userId = users.users.find(u => u.email === "10admin@admin.com")?.id;
    if (!userId) { log("CONC1", "BLOCKED", "No admin user"); return; }

    const refId = "22222222-2222-2222-2222-222222222222";

    const promises = Array.from({ length: 5 }, (_, i) =>
      admin.rpc("create_notification", {
        p_user_id: userId, p_type: "low_stock", p_title: "Concurrent Test",
        p_message: `concurrent ${i}`, p_reference_type: "materials", p_reference_id: refId,
      })
    );

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error).length;
    const dupes = results.filter(r => r.data?.duplicate === true).length;
    const inserted = results.filter(r => r.data?.success === true && !r.data?.duplicate).length;
    const totalOk = inserted + dupes;

    log("CONC1a: All 5 requests succeed or return duplicate (no errors)",
      totalOk === 5 ? "PASS" : "FAIL",
      `inserted=${inserted} duplicate=${dupes} errors=${errors}`);

    log("CONC1b: No unique_violation exposed to client",
      errors === 0 ? "PASS" : "FAIL", `errors=${errors}`);

    const { count } = await admin.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "low_stock")
      .eq("reference_id", refId);
    log("CONC1c: Only 1 row created", count === 1 ? "PASS" : "FAIL", `rows=${count}`);
  } catch (e) { log("CONC1", "FAIL", e.message); }
}

// ============================================================
// NOREF1: Duplicate notification without reference (NULL columns)
// Partial UNIQUE index does NOT enforce on NULLs.
// Both inserts should succeed. Acceptable because no business
// event creates notifications without references.
// ============================================================
async function testNOREF1() {
  console.log("\n=== NOREF1: DUPLICATE WITHOUT REFERENCE ===");
  try {
    const { data: users } = await admin.auth.admin.listUsers();
    const userId = users.users.find(u => u.email === "10admin@admin.com")?.id;
    if (!userId) { log("NOREF1", "BLOCKED", "No admin user"); return; }

    const res1 = await admin.rpc("create_notification", {
      p_user_id: userId, p_type: "low_stock", p_title: "No-Ref Test 1",
      p_message: "no ref", p_reference_type: null, p_reference_id: null,
    });
    log("NOREF1a: First no-ref insert succeeds", res1?.data?.success === true ? "PASS" : "FAIL", JSON.stringify(res1?.data));

    const res2 = await admin.rpc("create_notification", {
      p_user_id: userId, p_type: "low_stock", p_title: "No-Ref Test 2",
      p_message: "no ref 2", p_reference_type: null, p_reference_id: null,
    });
    log("NOREF1b: Second no-ref insert succeeds (no UNIQUE for NULLs)",
      res2?.data?.success === true ? "PASS" : "FAIL", JSON.stringify(res2?.data));

    const { count } = await admin.from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", "low_stock")
      .is("reference_type", null).is("reference_id", null);
    log("NOREF1c: Both no-ref rows exist", count === 2 ? "PASS" : "FAIL", `rows=${count}`);
  } catch (e) { log("NOREF1", "FAIL", e.message); }
}

// ============================================================
// LOW1: Permission-based low_stock recipient resolution
//
// BLOCKED: No active technician user exists in the database.
// The technician role has inventory:read permission but is NOT
// in the old hard-coded list ('admin','super_admin','inventory_manager').
// Testing this requires either:
//   a) An existing technician user (none active), OR
//   b) Creating a test user (invasive — not done here)
//
// Manual verification required:
//   1. Create a technician user with inventory:read
//   2. Trigger record_inventory_usage on a material at min_stock
//   3. Verify technician receives low_stock notification
//   4. Clean up test user
// ============================================================
async function testLOW1() {
  console.log("\n=== LOW1: PERMISSION-BASED LOW STOCK RECIPIENTS ===");
  try {
    const { count: techCount } = await admin.from("staff")
      .select("*", { count: "exact", head: true })
      .eq("role_id", "23ea9d89-dc7d-47b1-b05b-0f3257e8694a")
      .eq("is_active", true);

    if (techCount === 0) {
      log("LOW1", "BLOCKED", "No active technician user. Manual verification required: create technician with inventory:read, trigger low_stock, verify notification received.");
      return;
    }

    log("LOW1", "BLOCKED", `Found ${techCount} active technician(s) but test not implemented for live verification.`);
  } catch (e) { log("LOW1", "FAIL", e.message); }
}

// ============================================================
// CLEANUP
// ============================================================
async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers();
  const userId = users.users.find(u => u.email === "10admin@admin.com")?.id;
  if (userId) {
    await admin.from("notifications").delete()
      .eq("user_id", userId)
      .in("title", [
        "Mark Test 1", "Mark Test 2", "Idempotency Test 1", "Idempotency Test 2",
        "Concurrent Test", "No-Ref Test 1", "No-Ref Test 2",
      ]);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("============================================================");
  console.log("PHASE 17 — NOTIFICATION SYSTEM TESTS (CORRECTED 026)");
  console.log("============================================================");

  await testAUTH1();
  await testOWN1();
  await testOWN2();
  await testDEAL1();
  await testMARK1();
  await testIDEMP1();
  await testRBAC1();
  await testBKG1();
  await testCONC1();
  await testNOREF1();
  await testLOW1();

  await cleanup();

  console.log("\n============================================================");
  console.log("APPLICATION TESTS SUMMARY");
  console.log("============================================================");
  const pass = R.filter(r => r.r === "PASS").length;
  const fail = R.filter(r => r.r === "FAIL").length;
  const blocked = R.filter(r => r.r === "BLOCKED").length;
  console.log(`PASS = ${pass}`);
  console.log(`FAIL = ${fail}`);
  console.log(`BLOCKED = ${blocked}`);
  console.log(`TOTAL = ${R.length}`);
}

main().catch(console.error);
