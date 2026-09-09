import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const PASS = process.env.TEST_PASSWORD || "Aa123456";
// NOTE: /api/test/run-action endpoint was removed in Phase 22
const API = process.env.TEST_API_URL || "http://localhost:3099/api/test/run-action";
const R = [];
function log(t, r, d = "") { R.push({ t, r, d }); console.log(`  ${r === "PASS" ? "\u2713" : r === "FAIL" ? "\u2717" : "\u25CB"} ${t}: ${r}${d ? " \u2014 " + d : ""}`); }
function mc(s) { return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${s.access_token}` } } }); }
async function si(email) { const c = createClient(URL, ANON); const { data, error } = await c.auth.signInWithPassword({ email, password: PASS }); if (error) throw new Error(`Auth ${email}: ${error.message}`); return data; }
async function ga() { const { session } = await si("10admin@admin.com"); return mc(session); }

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
    clearTimeout(timeout);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.message };
  }
}

// ============================================================
// SUP1: Supplier CRUD
// ============================================================
async function testSUP1() {
  console.log("\n=== SUP1: SUPPLIER CRUD ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  const phone = `SUP-${Date.now()}`;

  try {
    const createRes = await invoke(sAdmin.access_token, "createSupplier", {
      input: { name: "Test Supplier", phone, email: "test@supplier.com", address: "Riyadh", notes: "Test" }
    });
    log("SUP1a: Create supplier", createRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(createRes?.result));

    if (!createRes?.result?.success) return null;
    const supId = createRes.result.data.id;

    const getRes = await invoke(sAdmin.access_token, "getSupplier", { id: supId });
    log("SUP1b: Read supplier", getRes?.result?.success === true ? "PASS" : "FAIL", getRes?.result?.data?.name);

    const updateRes = await invoke(sAdmin.access_token, "updateSupplier", {
      id: supId, input: { name: "Updated Supplier", email: "updated@supplier.com" }
    });
    log("SUP1c: Update supplier", updateRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(updateRes?.result));

    const verifyRes = await invoke(sAdmin.access_token, "getSupplier", { id: supId });
    log("SUP1d: Updated name correct", verifyRes?.result?.data?.name === "Updated Supplier" ? "PASS" : "FAIL", verifyRes?.result?.data?.name);

    const toggleRes = await invoke(sAdmin.access_token, "toggleSupplierActive", { id: supId });
    log("SUP1e: Toggle supplier active", toggleRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(toggleRes?.result));

    const verifyToggle = await invoke(sAdmin.access_token, "getSupplier", { id: supId });
    log("SUP1f: Supplier is inactive", verifyToggle?.result?.data?.is_active === false ? "PASS" : "FAIL", String(verifyToggle?.result?.data?.is_active));

    await invoke(sAdmin.access_token, "toggleSupplierActive", { id: supId });

    const listRes = await invoke(sAdmin.access_token, "getSuppliers", {});
    log("SUP1g: List suppliers", listRes?.result?.success === true ? "PASS" : "FAIL", `count=${listRes?.result?.data?.length || 0}`);

    const searchRes = await invoke(sAdmin.access_token, "getSuppliers", { search: "Updated" });
    log("SUP1h: Search suppliers", searchRes?.result?.success === true ? "PASS" : "FAIL", `count=${searchRes?.result?.data?.length || 0}`);

    return supId;
  } catch (e) {
    log("SUP1", "FAIL", e.message);
    return null;
  }
}

// ============================================================
// SUP2: Supplier validation
// ============================================================
async function testSUP2() {
  console.log("\n=== SUP2: SUPPLIER VALIDATION ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    const emptyName = await invoke(sAdmin.access_token, "createSupplier", { input: { name: "" } });
    log("SUP2a: Empty name rejected", emptyName?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(emptyName?.result));
  } catch (e) {
    log("SUP2", "FAIL", e.message);
  }
}

// ============================================================
// PUR1: Purchase CRUD (create with items, read, list)
// ============================================================
async function testPUR1(supplierId) {
  console.log("\n=== PUR1: PURCHASE CRUD ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!supplierId) { log("PUR1", "BLOCKED", "No supplier"); return null; }

    const matRes = await invoke(sAdmin.access_token, "getMaterials", {});
    const materials = matRes?.result?.data || [];
    if (materials.length === 0) { log("PUR1", "BLOCKED", "No materials"); return null; }
    const mat = materials[0];

    const createRes = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        notes: "Phase 16 test purchase",
        items: [{ material_id: mat.id, quantity: 10, unit_cost: 25.5 }]
      }
    });
    log("PUR1a: Create purchase with items", createRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(createRes?.result));

    if (!createRes?.result?.success) return null;
    const purchaseId = createRes.result.data.id;

    const getRes = await invoke(sAdmin.access_token, "getPurchase", { id: purchaseId });
    log("PUR1b: Read purchase", getRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify({ status: getRes?.result?.data?.status, items_count: getRes?.result?.data?.items?.length }));

    log("PUR1c: Items stored correctly", getRes?.result?.data?.items?.length === 1 ? "PASS" : "FAIL", `items=${getRes?.result?.data?.items?.length || 0}`);
    log("PUR1d: Item material_id matches", getRes?.result?.data?.items?.[0]?.material_id === mat.id ? "PASS" : "FAIL", "");
    log("PUR1e: Item quantity correct", getRes?.result?.data?.items?.[0]?.quantity === 10 ? "PASS" : "FAIL", `qty=${getRes?.result?.data?.items?.[0]?.quantity}`);
    log("PUR1f: Item unit_cost correct", getRes?.result?.data?.items?.[0]?.unit_cost === 25.5 ? "PASS" : "FAIL", `cost=${getRes?.result?.data?.items?.[0]?.unit_cost}`);

    const totalCost = getRes?.result?.data?.items?.[0]?.total_cost;
    log("PUR1g: Line total server-calculated", totalCost === 255 ? "PASS" : "FAIL", `total=${totalCost}`);

    const listRes = await invoke(sAdmin.access_token, "getPurchases", {});
    log("PUR1h: List purchases", listRes?.result?.success === true ? "PASS" : "FAIL", `count=${listRes?.result?.data?.length || 0}`);

    return purchaseId;
  } catch (e) {
    log("PUR1", "FAIL", e.message);
    return null;
  }
}

// ============================================================
// PUR2: Purchase validation
// ============================================================
async function testPUR2(supplierId) {
  console.log("\n=== PUR2: PURCHASE VALIDATION ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!supplierId) { log("PUR2", "BLOCKED", "No supplier"); return; }

    const invalidSupplier = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: "00000000-0000-0000-0000-000000000000",
        purchase_date: new Date().toISOString().split("T")[0],
        items: [{ material_id: "00000000-0000-0000-0000-000000000000", quantity: 1, unit_cost: 10 }]
      }
    });
    log("PUR2a: Invalid supplier rejected", invalidSupplier?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(invalidSupplier?.result));

    const emptyItems = await invoke(sAdmin.access_token, "createPurchase", {
      input: { supplier_id: supplierId, purchase_date: new Date().toISOString().split("T")[0], items: [] }
    });
    log("PUR2b: Empty items rejected", emptyItems?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(emptyItems?.result));

    const zeroQty = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        items: [{ material_id: "bcf87116-3357-450b-b729-5c6872277af0", quantity: 0, unit_cost: 10 }]
      }
    });
    log("PUR2c: Zero quantity rejected", zeroQty?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(zeroQty?.result));

    const negCost = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        items: [{ material_id: "bcf87116-3357-450b-b729-5c6872277af0", quantity: 1, unit_cost: -5 }]
      }
    });
    log("PUR2d: Negative cost rejected", negCost?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(negCost?.result));
  } catch (e) {
    log("PUR2", "FAIL", e.message);
  }
}

// ============================================================
// PUR3: Purchase receiving (atomic) — ISOLATED test data
// ============================================================
async function testPUR3(supplierId) {
  console.log("\n=== PUR3: PURCHASE RECEIVING ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!supplierId) { log("PUR3", "BLOCKED", "No supplier"); return; }

    const ts = Date.now();

    // Create dedicated material (stock=0)
    const matRes = await invoke(sAdmin.access_token, "createMaterial", {
      input: {
        name: `PUR3 Material ${ts}`, sku: `PUR3-${ts}`, unit: "piece",
        min_stock: 0, max_stock: 1000, cost_per_unit: 10,
      }
    });
    const matId = matRes?.result?.data?.id;
    if (!matId) { log("PUR3", "FAIL", "Failed to create test material"); return; }

    // Create dedicated purchase (qty=7)
    const purchaseQty = 7;
    const purchRes = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        notes: "PUR3 isolated test",
        items: [{ material_id: matId, quantity: purchaseQty, unit_cost: 15 }]
      }
    });
    const purchaseId = purchRes?.result?.data?.id;
    if (!purchaseId) { log("PUR3", "FAIL", "Failed to create test purchase"); return; }

    // Record exact initial stock
    const before = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
    const beforeStock = before?.result?.data?.current_stock || 0;

    // Receive ONCE
    const receiveRes = await invoke(sAdmin.access_token, "receivePurchase", { purchaseId });
    log("PUR3a: Receive purchase", receiveRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(receiveRes?.result));

    // Verify stock increased by exact qty
    const after = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
    const afterStock = after?.result?.data?.current_stock || 0;
    log("PUR3b: Stock incremented", afterStock === beforeStock + purchaseQty ? "PASS" : "FAIL", `${beforeStock} -> ${afterStock} (expected +${purchaseQty})`);

    // Verify status
    const verifyPurchase = await invoke(sAdmin.access_token, "getPurchase", { id: purchaseId });
    log("PUR3c: Status is received", verifyPurchase?.result?.data?.status === "received" ? "PASS" : "FAIL", `status=${verifyPurchase?.result?.data?.status}`);

    log("PUR3d: received_at set", verifyPurchase?.result?.data?.received_at !== null ? "PASS" : "FAIL", "");

    // Double receive (should fail)
    const doubleReceive = await invoke(sAdmin.access_token, "receivePurchase", { purchaseId });
    log("PUR3e: Double receive blocked", doubleReceive?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(doubleReceive?.result));

    // Verify stock did NOT change
    const stockAfterDouble = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
    log("PUR3f: Stock not double-incremented", stockAfterDouble?.result?.data?.current_stock === afterStock ? "PASS" : "FAIL",
      `expected=${afterStock} actual=${stockAfterDouble?.result?.data?.current_stock}`);
  } catch (e) {
    log("PUR3", "FAIL", e.message);
  }

}

// ============================================================
// PUR4: Purchase cancellation
// ============================================================
async function testPUR4(supplierId) {
  console.log("\n=== PUR4: PURCHASE CANCELLATION ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!supplierId) { log("PUR4", "BLOCKED", "No supplier"); return; }

    const matRes = await invoke(sAdmin.access_token, "getMaterials", {});
    const materials = matRes?.result?.data || [];
    if (materials.length === 0) { log("PUR4", "BLOCKED", "No materials"); return; }

    const createRes = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        notes: "Cancel test",
        items: [{ material_id: materials[0].id, quantity: 5, unit_cost: 10 }]
      }
    });
    if (!createRes?.result?.success) { log("PUR4", "FAIL", "Create failed"); return; }
    const cancelId = createRes.result.data.id;

    const cancelRes = await invoke(sAdmin.access_token, "cancelPurchase", { id: cancelId });
    log("PUR4a: Cancel purchase", cancelRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(cancelRes?.result));

    const verify = await invoke(sAdmin.access_token, "getPurchase", { id: cancelId });
    log("PUR4b: Status is cancelled", verify?.result?.data?.status === "cancelled" ? "PASS" : "FAIL", `status=${verify?.result?.data?.status}`);

    const doubleCancel = await invoke(sAdmin.access_token, "cancelPurchase", { id: cancelId });
    log("PUR4c: Double cancel blocked", doubleCancel?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(doubleCancel?.result));

    const receiveCancelled = await invoke(sAdmin.access_token, "receivePurchase", { purchaseId: cancelId });
    log("PUR4d: Receive cancelled blocked", receiveCancelled?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(receiveCancelled?.result));
  } catch (e) {
    log("PUR4", "FAIL", e.message);
  }
}

// ============================================================
// PUR5: Supplier purchase history
// ============================================================
async function testPUR5(supplierId) {
  console.log("\n=== PUR5: SUPPLIER PURCHASE HISTORY ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!supplierId) { log("PUR5", "BLOCKED", "No supplier"); return; }

    const histRes = await invoke(sAdmin.access_token, "getSupplierPurchaseHistory", { supplierId });
    log("PUR5a: Supplier history returns", histRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(histRes?.result?.stats));
  } catch (e) {
    log("PUR5", "FAIL", e.message);
  }
}

// ============================================================
// PUR6: RBAC — unauthorized purchase operations
// ============================================================
async function testPUR6(supplierId) {
  console.log("\n=== PUR6: RBAC — unauthorized purchase operations ===");
  const { session: sDealer } = await si("dealer-a@test.com").catch(() => ({ session: null }));

  try {
    if (!sDealer) { log("PUR6", "BLOCKED", "No dealer user"); return; }
    if (!supplierId) { log("PUR6", "BLOCKED", "No supplier"); return; }

    const createRes = await invoke(sDealer.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        items: [{ material_id: "bcf87116-3357-450b-b729-5c6872277af0", quantity: 1, unit_cost: 10 }]
      }
    });
    log("PUR6a: Dealer cannot create purchase", createRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(createRes?.result));

    const createSup = await invoke(sDealer.access_token, "createSupplier", {
      input: { name: "Hacked Supplier" }
    });
    log("PUR6b: Dealer cannot create supplier", createSup?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(createSup?.result));

    const listPurch = await invoke(sDealer.access_token, "getPurchases", {});
    log("PUR6c: Dealer cannot list purchases", listPurch?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(listPurch?.result));
  } catch (e) {
    log("PUR6", "FAIL", e.message);
  }
}

// ============================================================
// PUR7: Concurrent receive
// ============================================================
async function testPUR7(supplierId) {
  console.log("\n=== PUR7: CONCURRENT RECEIVE ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!supplierId) { log("PUR7", "BLOCKED", "No supplier"); return; }

    const matRes = await invoke(sAdmin.access_token, "getMaterials", {});
    const materials = matRes?.result?.data || [];
    if (materials.length === 0) { log("PUR7", "BLOCKED", "No materials"); return; }

    const createRes = await invoke(sAdmin.access_token, "createPurchase", {
      input: {
        supplier_id: supplierId,
        purchase_date: new Date().toISOString().split("T")[0],
        notes: "Concurrency test",
        items: [{ material_id: materials[0].id, quantity: 20, unit_cost: 15 }]
      }
    });
    if (!createRes?.result?.success) { log("PUR7", "FAIL", "Create failed"); return; }
    const concId = createRes.result.data.id;

    const before = await invoke(sAdmin.access_token, "getMaterial", { id: materials[0].id });
    const beforeStock = before?.result?.data?.current_stock || 0;

    const timeout = (ms) => new Promise((_,re) => setTimeout(() => re(new Error("timeout")), ms));
    const wrap = (p, ms) => Promise.race([p, timeout(ms)]);
    const [r1, r2] = await Promise.all([
      wrap(invoke(sAdmin.access_token, "receivePurchase", { purchaseId: concId }), 30000),
      wrap(invoke(sAdmin.access_token, "receivePurchase", { purchaseId: concId }), 30000),
    ]);

    const successCount = [r1, r2].filter(r => r?.result?.success === true).length;
    log("PUR7a: Exactly one succeeds", successCount === 1 ? "PASS" : "FAIL", `successes=${successCount}`);

    const after = await invoke(sAdmin.access_token, "getMaterial", { id: materials[0].id });
    const afterStock = after?.result?.data?.current_stock || 0;
    log("PUR7b: Stock incremented once", afterStock === beforeStock + 20 ? "PASS" : "FAIL", `${beforeStock} -> ${afterStock}`);

    const verify = await invoke(sAdmin.access_token, "getPurchase", { id: concId });
    log("PUR7c: Status is received", verify?.result?.data?.status === "received" ? "PASS" : "FAIL", `status=${verify?.result?.data?.status}`);
  } catch (e) {
    log("PUR7", "FAIL", e.message);
  }
}

// ============================================================
// CLEANUP
// ============================================================
async function cleanup(supplierId, purchaseIds) {
  const admin = await ga();
  for (const pid of purchaseIds) {
    await admin.from("purchase_items").delete().eq("purchase_id", pid);
    await admin.from("inventory_transactions").delete().eq("reference_id", pid).eq("type", "purchase");
    await admin.from("purchases").delete().eq("id", pid);
  }
  if (supplierId) {
    await admin.from("suppliers").delete().eq("id", supplierId);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("============================================================");
  console.log("PHASE 16 — SUPPLIERS + PURCHASES TESTS");
  console.log("============================================================");

  const supplierId = await testSUP1();
  await testSUP2();

  const purchaseId = await testPUR1(supplierId);
  await testPUR2(supplierId);
  await testPUR3(supplierId);
  await testPUR4(supplierId);
  await testPUR5(supplierId);
  await testPUR6(supplierId);
  await testPUR7(supplierId);

  await cleanup(supplierId, purchaseId ? [purchaseId] : []);

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
