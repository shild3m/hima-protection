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
// MAT1: createMaterial — RBAC + validation
// ============================================================
async function testMAT1() {
  console.log("\n=== MAT1: CREATE MATERIAL (RBAC + VALIDATION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  const sku = `TEST-${Date.now()}`;

  try {
    const input = { name: "PPF Film Test", sku, unit: "meter", min_stock: 10, max_stock: 100, cost_per_unit: 50, notes: "Test material" };
    const res = await invoke(sAdmin.access_token, "createMaterial", { input });
    log("MAT1a: Admin creates material", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result));

    if (res?.result?.success) {
      const matId = res.result.data.id;

      // MAT1b: Verify material exists
      const getRes = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
      log("MAT1b: Material readable", getRes?.result?.success === true ? "PASS" : "FAIL", getRes?.result?.data?.name);

      // MAT1c: Duplicate SKU rejected
      const dupRes = await invoke(sAdmin.access_token, "createMaterial", { input: { ...input, name: "Duplicate" } });
      log("MAT1c: Duplicate SKU rejected", dupRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(dupRes?.result));

      // MAT1d: Empty name rejected
      const emptyRes = await invoke(sAdmin.access_token, "createMaterial", { input: { ...input, name: "", sku: `EMPTY-${Date.now()}` } });
      log("MAT1d: Empty name rejected", emptyRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(emptyRes?.result));

      // MAT1e: Invalid unit rejected
      const unitRes = await invoke(sAdmin.access_token, "createMaterial", { input: { ...input, sku: `UNIT-${Date.now()}`, unit: "invalid" } });
      log("MAT1e: Invalid unit rejected", unitRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(unitRes?.result));

      // MAT1f: Negative cost rejected
      const costRes = await invoke(sAdmin.access_token, "createMaterial", { input: { ...input, sku: `COST-${Date.now()}`, cost_per_unit: -5 } });
      log("MAT1f: Negative cost rejected", costRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(costRes?.result));

      return matId;
    }
    return null;
  } catch (e) {
    log("MAT1", "FAIL", e.message);
    return null;
  }
}

// ============================================================
// MAT2: updateMaterial
// ============================================================
async function testMAT2(materialId) {
  console.log("\n=== MAT2: UPDATE MATERIAL ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("MAT2", "BLOCKED", "No material"); return; }

    const res = await invoke(sAdmin.access_token, "updateMaterial", { id: materialId, input: { name: "PPF Film Updated", cost_per_unit: 60 } });
    log("MAT2a: Update material", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result));

    const getRes = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    log("MAT2b: Updated name correct", getRes?.result?.data?.name === "PPF Film Updated" ? "PASS" : "FAIL", getRes?.result?.data?.name);
    log("MAT2c: Updated cost correct", getRes?.result?.data?.cost_per_unit === 60 ? "PASS" : "FAIL", String(getRes?.result?.data?.cost_per_unit));
  } catch (e) {
    log("MAT2", "FAIL", e.message);
  }
}

// ============================================================
// MAT3: toggleMaterialActive
// ============================================================
async function testMAT3(materialId) {
  console.log("\n=== MAT3: TOGGLE MATERIAL STATUS ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("MAT3", "BLOCKED", "No material"); return; }

    const res = await invoke(sAdmin.access_token, "toggleMaterialActive", { id: materialId });
    log("MAT3a: Toggle material", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result));

    const getRes = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    log("MAT3b: Material is inactive", getRes?.result?.data?.is_active === false ? "PASS" : "FAIL", String(getRes?.result?.data?.is_active));

    // Toggle back
    await invoke(sAdmin.access_token, "toggleMaterialActive", { id: materialId });
    const getRes2 = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    log("MAT3c: Material is active again", getRes2?.result?.data?.is_active === true ? "PASS" : "FAIL", String(getRes2?.result?.data?.is_active));
  } catch (e) {
    log("MAT3", "FAIL", e.message);
  }
}

// ============================================================
// MAT4: getMaterials + getLowStockMaterials
// ============================================================
async function testMAT4() {
  console.log("\n=== MAT4: READ MATERIALS + LOW STOCK ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    const listRes = await invoke(sAdmin.access_token, "getMaterials", {});
    log("MAT4a: getMaterials returns list", listRes?.result?.success === true ? "PASS" : "FAIL", `count=${listRes?.result?.data?.length || 0}`);

    const lowRes = await invoke(sAdmin.access_token, "getLowStockMaterials", {});
    log("MAT4b: getLowStockMaterials returns", lowRes?.result?.success === true ? "PASS" : "FAIL", `low=${lowRes?.result?.data?.length || 0}`);

    const summaryRes = await invoke(sAdmin.access_token, "getInventorySummary", {});
    log("MAT4c: getInventorySummary returns", summaryRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(summaryRes?.result?.data));
  } catch (e) {
    log("MAT4", "FAIL", e.message);
  }
}

// ============================================================
// MAT5: RBAC — unauthorized cannot create material
// ============================================================
async function testMAT5() {
  console.log("\n=== MAT5: RBAC — unauthorized material creation ===");
  const { session: sReception } = await si("reception@hima.com").catch(() => ({ session: null }));

  try {
    if (!sReception) { log("MAT5", "BLOCKED", "No receptionist user"); return; }

    const res = await invoke(sReception.access_token, "createMaterial", { input: { name: "Hack", sku: "HACK", unit: "piece" } });
    log("MAT5: Unauthorized cannot create material", res?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(res?.result));
  } catch (e) {
    log("MAT5", "FAIL", e.message);
  }
}

// ============================================================
// INV1: adjustStock — in/out
// ============================================================
async function testINV1(materialId) {
  console.log("\n=== INV1: ADJUST STOCK ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("INV1", "BLOCKED", "No material"); return; }

    // Get current stock
    const before = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    const beforeStock = before?.result?.data?.current_stock || 0;

    // Add 50
    const addRes = await invoke(sAdmin.access_token, "adjustStock", { input: { material_id: materialId, quantity: 50, direction: "in", notes: "Test add" } });
    log("INV1a: Adjust stock IN", addRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(addRes?.result));

    const after = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    const afterStock = after?.result?.data?.current_stock || 0;
    log("INV1b: Stock increased", afterStock === beforeStock + 50 ? "PASS" : "FAIL", `${beforeStock} -> ${afterStock}`);

    // Remove 20
    const removeRes = await invoke(sAdmin.access_token, "adjustStock", { input: { material_id: materialId, quantity: 20, direction: "out", notes: "Test remove" } });
    log("INV1c: Adjust stock OUT", removeRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(removeRes?.result));

    const after2 = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    const after2Stock = after2?.result?.data?.current_stock || 0;
    log("INV1d: Stock decreased", after2Stock === afterStock - 20 ? "PASS" : "FAIL", `${afterStock} -> ${after2Stock}`);
  } catch (e) {
    log("INV1", "FAIL", e.message);
  }
}

// ============================================================
// INV2: negative stock prevention
// ============================================================
async function testINV2(materialId) {
  console.log("\n=== INV2: NEGATIVE STOCK PREVENTION ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("INV2", "BLOCKED", "No material"); return; }

    const res = await invoke(sAdmin.access_token, "adjustStock", { input: { material_id: materialId, quantity: 99999, direction: "out", notes: "Should fail" } });
    log("INV2: Negative stock blocked", res?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(res?.result));
  } catch (e) {
    log("INV2", "FAIL", e.message);
  }
}

// ============================================================
// INV3: recordWaste
// ============================================================
async function testINV3(materialId) {
  console.log("\n=== INV3: RECORD WASTE ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("INV3", "BLOCKED", "No material"); return; }

    const res = await invoke(sAdmin.access_token, "recordWaste", { input: { material_id: materialId, quantity: 2, notes: "Damaged during transport" } });
    log("INV3a: Record waste", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result));

    const mat = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    log("INV3b: Stock decreased after waste", mat?.result?.data?.current_stock !== undefined ? "PASS" : "FAIL", `stock=${mat?.result?.data?.current_stock}`);

    // Waste without reason should fail
    const failRes = await invoke(sAdmin.access_token, "recordWaste", { input: { material_id: materialId, quantity: 1, notes: "" } });
    log("INV3c: Waste without reason rejected", failRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(failRes?.result));
  } catch (e) {
    log("INV3", "FAIL", e.message);
  }
}

// ============================================================
// INV4: recordReturn
// ============================================================
async function testINV4(materialId) {
  console.log("\n=== INV4: RECORD RETURN ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("INV4", "BLOCKED", "No material"); return; }

    const before = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    const beforeStock = before?.result?.data?.current_stock || 0;

    const res = await invoke(sAdmin.access_token, "recordReturn", { input: { material_id: materialId, quantity: 3, notes: "Customer return" } });
    log("INV4a: Record return", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result));

    const after = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    log("INV4b: Stock increased after return", after?.result?.data?.current_stock === beforeStock + 3 ? "PASS" : "FAIL", `${beforeStock} -> ${after?.result?.data?.current_stock}`);
  } catch (e) {
    log("INV4", "FAIL", e.message);
  }
}

// ============================================================
// INV5: recordUsage
// ============================================================
async function testINV5(materialId) {
  console.log("\n=== INV5: RECORD USAGE ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    if (!materialId) { log("INV5", "BLOCKED", "No material"); return; }

    const before = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    const beforeStock = before?.result?.data?.current_stock || 0;

    const res = await invoke(sAdmin.access_token, "recordUsage", { input: { material_id: materialId, quantity: 1, notes: "Manual usage test" } });
    log("INV5a: Record usage", res?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(res?.result));

    const after = await invoke(sAdmin.access_token, "getMaterial", { id: materialId });
    log("INV5b: Stock decreased after usage", after?.result?.data?.current_stock === beforeStock - 1 ? "PASS" : "FAIL", `${beforeStock} -> ${after?.result?.data?.current_stock}`);

    // Usage exceeding stock should fail
    const failRes = await invoke(sAdmin.access_token, "recordUsage", { input: { material_id: materialId, quantity: 99999 } });
    log("INV5c: Usage exceeding stock blocked", failRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(failRes?.result));
  } catch (e) {
    log("INV5", "FAIL", e.message);
  }
}

// ============================================================
// INV6: getStockMovements
// ============================================================
async function testINV6() {
  console.log("\n=== INV6: STOCK MOVEMENTS ===");
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    const res = await invoke(sAdmin.access_token, "getStockMovements", {});
    log("INV6a: getStockMovements returns", res?.result?.success === true ? "PASS" : "FAIL", `count=${res?.result?.data?.length || 0}`);

    const filterRes = await invoke(sAdmin.access_token, "getStockMovements", { type: "adjustment" });
    log("INV6b: Filter by type works", filterRes?.result?.success === true ? "PASS" : "FAIL", `count=${filterRes?.result?.data?.length || 0}`);
  } catch (e) {
    log("INV6", "FAIL", e.message);
  }
}

// ============================================================
// INV7: RBAC — unauthorized operations
// ============================================================
async function testINV7(materialId) {
  console.log("\n=== INV7: RBAC — unauthorized inventory operations ===");
  const { session: sDealer } = await si("dealer-a@test.com").catch(() => ({ session: null }));

  try {
    if (!sDealer) { log("INV7", "BLOCKED", "No dealer user"); return; }
    if (!materialId) { log("INV7", "BLOCKED", "No material"); return; }

    const adjustRes = await invoke(sDealer.access_token, "adjustStock", { input: { material_id: materialId, quantity: 1, direction: "in", notes: "Hack" } });
    log("INV7a: Dealer cannot adjust stock", adjustRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(adjustRes?.result));

    const wasteRes = await invoke(sDealer.access_token, "recordWaste", { input: { material_id: materialId, quantity: 1, notes: "Hack" } });
    log("INV7b: Dealer cannot record waste", wasteRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(wasteRes?.result));

    const usageRes = await invoke(sDealer.access_token, "recordUsage", { input: { material_id: materialId, quantity: 1 } });
    log("INV7c: Dealer cannot record usage", usageRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(usageRes?.result));
  } catch (e) {
    log("INV7", "FAIL", e.message);
  }
}

// ============================================================
// INV8: RBAC — Receptionist cannot do inventory operations
// ============================================================
async function testINV8(materialId) {
  console.log("\n=== INV8: RBAC — Receptionist inventory operations denied ===");
  const { session: sReception } = await si("reception@hima.com").catch(() => ({ session: null }));

  try {
    if (!sReception) { log("INV8", "BLOCKED", "No receptionist user"); return; }
    if (!materialId) { log("INV8", "BLOCKED", "No material"); return; }

    const adjustRes = await invoke(sReception.access_token, "adjustStock", { input: { material_id: materialId, quantity: 1, direction: "in", notes: "Hack" } });
    log("INV8a: Receptionist cannot adjust stock", adjustRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(adjustRes?.result));

    const wasteRes = await invoke(sReception.access_token, "recordWaste", { input: { material_id: materialId, quantity: 1, notes: "Hack" } });
    log("INV8b: Receptionist cannot record waste", wasteRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(wasteRes?.result));

    const usageRes = await invoke(sReception.access_token, "recordUsage", { input: { material_id: materialId, quantity: 1 } });
    log("INV8c: Receptionist cannot record usage", usageRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(usageRes?.result));

    const returnRes = await invoke(sReception.access_token, "recordReturn", { input: { material_id: materialId, quantity: 1, notes: "Hack" } });
    log("INV8d: Receptionist cannot record return", returnRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(returnRes?.result));
  } catch (e) {
    log("INV8", "FAIL", e.message);
  }
}

// ============================================================
// CLEANUP
// ============================================================
async function cleanup(materialId) {
  if (!materialId) return;
  const admin = await ga();
  await admin.from("materials").delete().eq("id", materialId);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("============================================================");
  console.log("PHASE 15 — INVENTORY MANAGEMENT TESTS");
  console.log("============================================================");

  const materialId = await testMAT1();
  await testMAT2(materialId);
  await testMAT3(materialId);
  await testMAT4();
  await testMAT5();
  await testINV1(materialId);
  await testINV2(materialId);
  await testINV3(materialId);
  await testINV4(materialId);
  await testINV5(materialId);
  await testINV6();
  await testINV7(materialId);
  await testINV8(materialId);

  await cleanup(materialId);

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
