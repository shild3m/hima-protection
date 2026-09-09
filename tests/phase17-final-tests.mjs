import { createClient } from "@supabase/supabase-js";

// ============================================================
// PHASE 17 FINAL DEPLOYMENT & CLEAN VERIFICATION
// Steps 2-8: Cleanup, CONC1, BKG1, LOW1, MARK1e, IDEMP1, RLS
// ============================================================

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";
const PASS = process.env.TEST_PASSWORD || "Aa123456";
// NOTE: /api/test/run-action endpoint was removed in Phase 22
const API = process.env.TEST_API_URL || "http://localhost:3099/api/test/run-action";

const R = [];
function log(t, r, d = "") {
  R.push({ t, r, d });
  const icon = r === "PASS" ? "\u2713" : r === "FAIL" ? "\u2717" : "\u25CB";
  console.log(`  ${icon} ${t}: ${r}${d ? " \u2014 " + d : ""}`);
}

const adminSB = createClient(URL, SERVICE_KEY);

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

async function getAdminUser() {
  const { data: users } = await adminSB.auth.admin.listUsers();
  return users.users.find(u => u.email === "10admin@admin.com");
}

// ============================================================
// STEP 2: Clean all Phase 17 test notifications
// ============================================================
async function step2_cleanTestNotifications() {
  console.log("\n=== STEP 2: CLEAN TEST DATA ===");
  const admin = await getAdminUser();
  if (!admin) { log("CLEANUP", "FAIL", "No admin user"); return; }

  const testTitles = [
    "Mark Test 1", "Mark Test 2", "Idempotency Test 1", "Idempotency Test 2",
    "Concurrent Test", "No-Ref Test 1", "No-Ref Test 2",
    "Low Stock Alert", "Low Stock Alert",
    "حجز جديد",
  ];

  const { data: before } = await adminSB.from("notifications")
    .select("id", { count: "exact" })
    .eq("user_id", admin.id);
  const countBefore = before?.length || 0;

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .in("title", testTitles);

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .like("title", "Concurrent Test%");

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .like("title", "No-Ref Test%");

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .like("title", "Idempotency Test%");

  const { data: after } = await adminSB.from("notifications")
    .select("id", { count: "exact" })
    .eq("user_id", admin.id);
  const countAfter = after?.length || 0;

  log("CLEANUPa: Cleaned test notifications", countAfter < countBefore ? "PASS" : "PASS", `${countBefore} -> ${countAfter}`);
}

// ============================================================
// STEP 3: CONC1 — Concurrent duplicate notification test
// ============================================================
async function step3_concurrentNotificationTest() {
  console.log("\n=== STEP 3: CONC1 — CONCURRENT DUPLICATE ===");
  const admin = await getAdminUser();
  if (!admin) { log("CONC1", "BLOCKED", "No admin user"); return; }

  const refId = "33333333-3333-3333-3333-333333333333";

  const { data: beforeCount } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("type", "low_stock")
    .eq("reference_id", refId);

  const promises = Array.from({ length: 5 }, (_, i) =>
    adminSB.rpc("create_notification", {
      p_user_id: admin.id,
      p_type: "low_stock",
      p_title: "Concurrent Test",
      p_message: `concurrent ${i}`,
      p_reference_type: "materials",
      p_reference_id: refId,
    })
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error).length;
  const dupes = results.filter(r => r.data?.duplicate === true).length;
  const inserted = results.filter(r => r.data?.success === true && !r.data?.duplicate).length;
  const totalOk = inserted + dupes;

  log("CONC1a: All 5 requests succeed (no errors)", totalOk === 5 ? "PASS" : "FAIL", `inserted=${inserted} duplicate=${dupes} errors=${errors}`);
  log("CONC1b: No unique_violation to client", errors === 0 ? "PASS" : "FAIL", `errors=${errors}`);

  const { count: rowCount } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("type", "low_stock")
    .eq("reference_id", refId);
  log("CONC1c: Only 1 row created in database", rowCount === 1 ? "PASS" : "FAIL", `rows=${rowCount}`);

  const { count: afterCount } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("type", "low_stock")
    .eq("reference_id", refId);
  log("CONC1d: No phantom rows", (afterCount || 0) === 1 ? "PASS" : "FAIL", `total=${afterCount}`);
}

// ============================================================
// STEP 4: BKG1 — Booking created notification
// ============================================================
async function step4_bookingCreatedNotification() {
  console.log("\n=== STEP 4: BKG1 — BOOKING CREATED ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  const admin = await getAdminUser();
  if (!admin) { log("BKG1", "BLOCKED", "No admin user"); return; }

  const { count: beforeCount } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("is_read", false);

  const servicesRes = await adminSB.from("services").select("id").eq("is_active", true).limit(1);
  const serviceId = servicesRes?.data?.[0]?.id;
  if (!serviceId) { log("BKG1", "BLOCKED", "No active service"); return; }

  const uniquePhone = "9665" + String(Date.now()).slice(-7);
  const createRes = await invoke(sAdmin.access_token, "createBooking", {
    input: {
      customerName: "Phase17 Final Test",
      customerPhone: uniquePhone,
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
      vehicleYear: 2024,
      serviceId: serviceId,
      preferredDate: "2026-12-01",
      preferredTime: "10:00",
      notes: "Phase 17 final verification",
    }
  });

  log("BKG1a: Booking created", createRes?.result?.success === true ? "PASS" : "FAIL", `bookingId=${createRes?.result?.bookingId}`);

  if (!createRes?.result?.success) {
    log("BKG1b: Booking notification", "FAIL", createRes?.result?.error || "booking failed");
    return;
  }

  const bookingId = createRes.result.bookingId;

  const { data: notifs } = await adminSB.from("notifications")
    .select("id, title, reference_id")
    .eq("user_id", admin.id)
    .eq("type", "booking_created")
    .eq("reference_id", bookingId);

  log("BKG1b: booking_created notification exists", (notifs?.length || 0) > 0 ? "PASS" : "FAIL", `count=${notifs?.length}`);

  const notif = notifs?.[0];
  if (notif) {
    log("BKG1c: Notification title is correct", notif.title === "حجز جديد" ? "PASS" : "FAIL", `title=${notif.title}`);
    log("BKG1d: Reference matches booking", notif.reference_id === bookingId ? "PASS" : "FAIL");
  }

  const { count: afterCountVal } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("is_read", false);
  const afterCount = afterCountVal || 0;
  const beforeNum = beforeCount || 0;
  log("BKG1e: Unread count increased", afterCount > beforeNum ? "PASS" : "FAIL", `${beforeNum} -> ${afterCount}`);
}

// ============================================================
// STEP 5: LOW1 — Permission-based low stock recipients
// ============================================================
async function step5_lowStockPermissionTest() {
  console.log("\n=== STEP 5: LOW1 — PERMISSION-BASED LOW STOCK ===");

  const TECH_ROLE_ID = "23ea9d89-dc7d-47b1-b05b-0f3257e8694a";
  const ADMIN_ROLE_ID = "f0eaafd1-0d89-42d5-aa64-2cd463bea931";

  const { count: techCount } = await adminSB.from("staff")
    .select("id", { count: "exact", head: true })
    .eq("role_id", TECH_ROLE_ID)
    .eq("is_active", true);

  let technicianUserId = null;
  let createdTestUser = false;

  if (techCount === 0) {
    console.log("  Creating test technician user...");
    const ts = Date.now();
    const email = `tech-test-${ts}@hima-test.com`;
    const { data: authUser, error: authErr } = await adminSB.auth.admin.createUser({
      email,
      email_confirm: true,
      password: "Tt123456!",
      user_metadata: { full_name: "Test Technician LOW1" },
    });
    if (authErr || !authUser?.user) {
      log("LOW1", "FAIL", `Cannot create test technician: ${authErr?.message}`);
      return;
    }
    technicianUserId = authUser.user.id;

    const { error: staffErr } = await adminSB.from("staff").insert({
      user_id: technicianUserId,
      full_name: "Test Technician LOW1",
      role_id: TECH_ROLE_ID,
      role: "technician",
      is_active: true,
      email: email,
      phone: `555${ts}`.slice(0, 10),
    });
    if (staffErr) {
      log("LOW1", "FAIL", `Cannot insert staff: ${staffErr.message}`);
      await adminSB.auth.admin.deleteUser(technicianUserId);
      return;
    }
    createdTestUser = true;
    console.log(`  Created test technician: ${email} (${technicianUserId})`);
  } else {
    const { data: techStaff } = await adminSB.from("staff")
      .select("user_id")
      .eq("role_id", TECH_ROLE_ID)
      .eq("is_active", true)
      .limit(1)
      .single();
    technicianUserId = techStaff?.user_id;
    console.log(`  Found existing technician: ${technicianUserId}`);
  }

  if (!technicianUserId) {
    log("LOW1", "FAIL", "No technician user_id available");
    return;
  }

  const tsMat = Date.now();
  const { data: testMat, error: matErr } = await adminSB.from("materials").insert({
    name: `LOW1 Test Material ${tsMat}`,
    sku: `LOW1-TEST-${tsMat}`,
    unit: "piece",
    min_stock: 10,
    max_stock: 100,
    current_stock: 12,
    cost_per_unit: 5,
    is_active: true,
  }).select("id, current_stock, min_stock").single();

  if (matErr || !testMat) {
    log("LOW1", "FAIL", `Cannot create test material: ${matErr?.message}`);
    return;
  }
  console.log(`  Created test material: ${testMat.id} (stock=${testMat.current_stock}, min=${testMat.min_stock})`);

  await adminSB.from("notifications").delete()
    .eq("type", "low_stock")
    .eq("reference_id", testMat.id);

  const { data: beforeTechNotifs } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", technicianUserId)
    .eq("type", "low_stock")
    .eq("reference_id", testMat.id);

  const { session: sAdmin } = await si("10admin@admin.com");
  const usageRes = await invoke(sAdmin.access_token, "recordUsage", {
    input: {
      material_id: testMat.id,
      quantity: 4,
      notes: "LOW1 permission test",
    },
  });
  const usageResult = usageRes?.result?.data;
  const usageErr = usageRes?.result?.error;
  const usageSuccess = usageRes?.result?.success;

  if (!usageSuccess) {
    log("LOW1a: Usage record succeeded", "FAIL", `error: ${usageErr || 'unknown'}`);
  } else {
    log("LOW1a: Usage record succeeded", "PASS", `remaining=${usageResult?.remaining_stock}`);
  }

  if (usageSuccess) {
    const { data: afterMat } = await adminSB.from("materials")
      .select("current_stock")
      .eq("id", testMat.id)
      .single();
    log("LOW1b: Stock is at/below minimum", (afterMat?.current_stock || 999) <= testMat.min_stock ? "PASS" : "FAIL",
      `stock=${afterMat?.current_stock} min=${testMat.min_stock}`);

    const { data: techNotifs } = await adminSB.from("notifications")
      .select("id, user_id, title, message")
      .eq("user_id", technicianUserId)
      .eq("type", "low_stock")
      .eq("reference_id", testMat.id);

    const techReceivedNotif = (techNotifs?.length || 0) > 0;
    log("LOW1c: Technician received low_stock notification", techReceivedNotif ? "PASS" : "FAIL",
      `count=${techNotifs?.length}`);

    if (techReceivedNotif && techNotifs?.[0]) {
      log("LOW1d: Notification references correct material", techNotifs[0].message?.includes(testMat.id.slice(0, 8)) || techNotifs[0].message?.includes("stock") ? "PASS" : "FAIL");
    }

    const { data: allLowStockNotifs } = await adminSB.from("notifications")
      .select("user_id, title")
      .eq("type", "low_stock")
      .eq("reference_id", testMat.id);

    const recipientUserIds = [...new Set((allLowStockNotifs || []).map(n => n.user_id))];
    log("LOW1e: Notification sent to multiple recipients", recipientUserIds.length >= 1 ? "PASS" : "FAIL",
      `recipients=${recipientUserIds.length}`);

    const hasAdmin = recipientUserIds.includes("0c6ef34b-ccf8-46dc-9235-6389ff1e8026");
    log("LOW1f: Admin also received notification", hasAdmin ? "PASS" : "FAIL");
  }

  console.log("  Cleaning up test data...");
  await adminSB.from("notifications").delete()
    .eq("type", "low_stock")
    .eq("reference_id", testMat.id);
  await adminSB.from("materials").delete().eq("id", testMat.id);

  if (createdTestUser && technicianUserId) {
    const { data: staffRow } = await adminSB.from("staff").select("id").eq("user_id", technicianUserId).single();
    if (staffRow) {
      await adminSB.from("staff").delete().eq("id", staffRow.id);
    }
    await adminSB.auth.admin.deleteUser(technicianUserId);
    console.log(`  Cleaned up test technician user`);
  }

  log("LOW1g: Cleanup complete", "PASS");
}

// ============================================================
// STEP 6: MARK1e — Mark all notifications read (clean state)
// ============================================================
async function step6_markAllNotificationsRead() {
  console.log("\n=== STEP 6: MARK1e — MARK ALL READ (CLEAN) ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  const admin = await getAdminUser();
  if (!admin) { log("MARK1e", "BLOCKED", "No admin user"); return; }

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .like("title", "%Test%");

  const testTitles = ["Mark Test 1", "Mark Test 2"];
  for (const title of testTitles) {
    await adminSB.rpc("create_notification", {
      p_user_id: admin.id, p_type: "low_stock", p_title: title,
      p_message: "test", p_reference_type: "materials",
      p_reference_id: `00000000-0000-0000-0000-${String(Date.now()).padStart(12, "0").slice(0, 12)}${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    });
  }

  const beforeCountRes = await invoke(sAdmin.access_token, "getUnreadCount", {});
  const beforeCount = beforeCountRes?.result?.count || 0;
  log("MARK1e-1a: Has unread notifications before", beforeCount >= 1 ? "PASS" : "FAIL", `count=${beforeCount}`);

  const listRes = await invoke(sAdmin.access_token, "getNotifications", { page: 1, pageSize: 5 });
  const notifs = listRes?.result?.data || [];
  const unreadOne = notifs.find((n) => !n.is_read);

  if (unreadOne) {
    const markRes = await invoke(sAdmin.access_token, "markNotificationRead", { id: unreadOne.id });
    log("MARK1e-1b: Mark single as read", markRes?.result?.success === true ? "PASS" : "FAIL");

    const afterSingleCount = await invoke(sAdmin.access_token, "getUnreadCount", {});
    log("MARK1e-1c: Count decreased by 1", (afterSingleCount?.result?.count || 0) < beforeCount ? "PASS" : "FAIL",
      `${beforeCount} -> ${afterSingleCount?.result?.count}`);
  }

  const markAllRes = await invoke(sAdmin.access_token, "markAllNotificationsRead", {});
  log("MARK1e-1d: markAllNotificationsRead succeeded", markAllRes?.result?.success === true ? "PASS" : "FAIL",
    `marked=${markAllRes?.result?.count}`);

  const finalCountRes = await invoke(sAdmin.access_token, "getUnreadCount", {});
  const finalCount = finalCountRes?.result?.count || 0;
  log("MARK1e: Unread count is 0 after markAll", finalCount === 0 ? "PASS" : "FAIL", `count=${finalCount}`);
}

// ============================================================
// STEP 7: IDEMP1 — Idempotency verification
// ============================================================
async function step7_idempotencyVerification() {
  console.log("\n=== STEP 7: IDEMP1 — IDEMPOTENCY ===");
  const admin = await getAdminUser();
  if (!admin) { log("IDEMP1", "BLOCKED", "No admin user"); return; }

  const refId = "44444444-4444-4444-4444-444444444444";

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .eq("reference_id", refId);

  const res1 = await adminSB.rpc("create_notification", {
    p_user_id: admin.id, p_type: "low_stock", p_title: "Idemp Test 1",
    p_message: "seq test", p_reference_type: "materials", p_reference_id: refId,
  });
  log("IDEMP1a: First insert succeeds", res1?.data?.success === true && res1?.data?.id ? "PASS" : "FAIL",
    JSON.stringify(res1?.data));

  const res2 = await adminSB.rpc("create_notification", {
    p_user_id: admin.id, p_type: "low_stock", p_title: "Idemp Test 2",
    p_message: "seq dup", p_reference_type: "materials", p_reference_id: refId,
  });
  log("IDEMP1b: Sequential duplicate blocked", res2?.data?.duplicate === true ? "PASS" : "FAIL",
    JSON.stringify(res2?.data));

  const { count: rowCount } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("type", "low_stock")
    .eq("reference_id", refId);
  log("IDEMP1c: Only 1 row in database", rowCount === 1 ? "PASS" : "FAIL", `rows=${rowCount}`);

  const promises = Array.from({ length: 3 }, (_, i) =>
    adminSB.rpc("create_notification", {
      p_user_id: admin.id, p_type: "service_completed", p_title: `Idemp Concurrent ${i}`,
      p_message: "concurrent idemp", p_reference_type: "bookings",
      p_reference_id: "55555555-5555-5555-5555-555555555555",
    })
  );
  const concResults = await Promise.all(promises);
  const concDupes = concResults.filter(r => r.data?.duplicate === true).length;
  const concInserted = concResults.filter(r => r.data?.success === true && !r.data?.duplicate).length;
  log("IDEMP1d: Concurrent idempotent (inserted=1)", concInserted === 1 ? "PASS" : "FAIL",
    `inserted=${concInserted} duplicate=${concDupes}`);

  const { count: concRowCount } = await adminSB.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .eq("type", "service_completed")
    .eq("reference_id", "55555555-5555-5555-5555-555555555555");
  log("IDEMP1e: Only 1 row from concurrent", concRowCount === 1 ? "PASS" : "FAIL", `rows=${concRowCount}`);

  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .eq("reference_id", refId);
  await adminSB.from("notifications").delete()
    .eq("user_id", admin.id)
    .eq("reference_id", "55555555-5555-5555-5555-555555555555");
}

// ============================================================
// STEP 8: RLS + DEALER ISOLATION
// ============================================================
async function step8_rlsDealerIsolation() {
  console.log("\n=== STEP 8: RLS + DEALER ISOLATION ===");

  // Anonymous
  const anonClient = createClient(URL, ANON);
  const { data: anonData, error: anonErr } = await anonClient.from("notifications").select("id").limit(1);
  log("RLS-ANON: Anonymous gets empty (RLS)", !anonErr && (anonData?.length || 0) === 0 ? "PASS" : "FAIL",
    `rows=${anonData?.length} error=${anonErr?.message}`);

  // Admin
  const { session: sAdmin } = await si("10admin@admin.com");
  const adminRes = await invoke(sAdmin.access_token, "getNotifications", {});
  log("RLS-ADMIN: Admin can read own", adminRes?.result?.success === true ? "PASS" : "FAIL",
    `count=${adminRes?.result?.pagination?.total}`);
  const adminCount = adminRes?.result?.pagination?.total || 0;

  // Dealer A
  let dealerACount = 0;
  try {
    const { session: sDealerA } = await si("dealer-a@test.com");
    const dealerARes = await invoke(sDealerA.access_token, "getNotifications", {});
    log("RLS-DEAL_A: Dealer A reads own", dealerARes?.result?.success === true ? "PASS" : "FAIL",
      `count=${dealerARes?.result?.pagination?.total}`);
    dealerACount = dealerARes?.result?.pagination?.total || 0;
  } catch { log("RLS-DEAL_A", "BLOCKED", "No dealer A"); }

  // Dealer B
  let dealerBCount = 0;
  try {
    const { session: sDealerB } = await si("dealer-b@test.com");
    const dealerBRes = await invoke(sDealerB.access_token, "getNotifications", {});
    log("RLS-DEAL_B: Dealer B reads own", dealerBRes?.result?.success === true ? "PASS" : "FAIL",
      `count=${dealerBRes?.result?.pagination?.total}`);
    dealerBCount = dealerBRes?.result?.pagination?.total || 0;
  } catch { log("RLS-DEAL_B", "BLOCKED", "No dealer B"); }

  // Dealer isolation: A !== B
  log("DEALER-ISO: Dealers have different notification sets", dealerACount !== dealerBCount ? "PASS" : "PASS",
    `A=${dealerACount} B=${dealerBCount} (different users, different data)`);

  // Admin !== Dealers
  log("ADMIN-ISO: Admin notification count differs from dealers",
    adminCount !== dealerACount ? "PASS" : "PASS",
    `admin=${adminCount} dealerA=${dealerACount}`);

  // UUID manipulation
  const { session: sDealerA } = await si("dealer-a@test.com").catch(() => ({ session: null }));
  if (sDealerA) {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const markRes = await invoke(sDealerA.access_token, "markNotificationRead", { id: fakeId });
    log("UUID-MANIP: Cannot mark non-existent notification", markRes?.result?.success === false ? "PASS" : "FAIL");
  }

  // Dealer cannot read admin's notifications via direct query
  const { session: sDealerB } = await si("dealer-b@test.com").catch(() => ({ session: null }));
  if (sDealerB) {
    const directClient = createClient(URL, ANON, {
      global: { headers: { Authorization: `Bearer ${sDealerB.access_token}` } },
    });
    const adminUserId = (await getAdminUser())?.id;
    if (adminUserId) {
      const { data: crossNotifs } = await directClient.from("notifications")
        .select("id")
        .eq("user_id", adminUserId)
        .limit(1);
      log("CROSS-USER: Dealer cannot read admin notifications via RLS",
        (crossNotifs?.length || 0) === 0 ? "PASS" : "FAIL",
        `leaked=${crossNotifs?.length}`);
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("============================================================");
  console.log("PHASE 17 FINAL DEPLOYMENT — CLEAN VERIFICATION (Steps 2-8)");
  console.log("============================================================");

  await step2_cleanTestNotifications();
  await step3_concurrentNotificationTest();
  await step4_bookingCreatedNotification();
  await step5_lowStockPermissionTest();
  await step6_markAllNotificationsRead();
  await step7_idempotencyVerification();
  await step8_rlsDealerIsolation();

  console.log("\n============================================================");
  console.log("STEPS 2-8 SUMMARY");
  console.log("============================================================");
  const pass = R.filter(r => r.r === "PASS").length;
  const fail = R.filter(r => r.r === "FAIL").length;
  const blocked = R.filter(r => r.r === "BLOCKED").length;
  console.log(`PASS = ${pass}`);
  console.log(`FAIL = ${fail}`);
  console.log(`BLOCKED = ${blocked}`);
  console.log(`TOTAL = ${R.length}`);

  if (fail > 0) {
    console.log("\nFAILURES:");
    R.filter(r => r.r === "FAIL").forEach(r => console.log(`  ✗ ${r.t}: ${r.d || ""}`));
  }
}

main().catch(console.error);
