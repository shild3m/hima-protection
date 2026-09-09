import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODIwMjcsImV4cCI6MjEwMzI1ODAyN30.8TkXc9WFmr-HUpbkDszYovlrlyAZzZzbMJq9TvGptmo";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";
const PASS = process.env.TEST_PASSWORD || "Aa123456";
// NOTE: /api/test/run-action endpoint was removed in Phase 22
const API = process.env.TEST_API_URL || "http://localhost:3099/api/test/run-action";

const R = [];
function log(t, r, d = "") { R.push({ t, r, d }); console.log(`  ${r === "PASS" ? "\u2713" : r === "FAIL" ? "\u2717" : "\u25CB"} ${t}: ${r}${d ? " \u2014 " + d : ""}`); }

const adminSB = createClient(URL, SERVICE_KEY);

async function si(email) {
  const c = createClient(URL, ANON);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`Auth ${email}: ${error.message}`);
  return data;
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
    clearTimeout(timeout);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    return { error: e.message };
  }
}

async function main() {
  console.log("============================================================");
  console.log("PHASE 16 — ISOLATED PUR3 STOCK VERIFICATION");
  console.log("============================================================");

  const { session: sAdmin } = await si("10admin@admin.com");
  const ts = Date.now();

  // 1. Create dedicated supplier
  console.log("\n--- SETUP ---");
  const supRes = await invoke(sAdmin.access_token, "createSupplier", {
    input: { name: `PUR3ISO Supplier ${ts}`, phone: `SUP-${ts}` }
  });
  const supId = supRes?.result?.data?.id;
  if (!supId) { console.log("FAILED to create supplier:", JSON.stringify(supRes)); return; }
  console.log(`  Supplier: ${supId}`);

  // 2. Create dedicated material via test route (stock starts at 0)
  const matRes = await invoke(sAdmin.access_token, "createMaterial", {
    input: {
      name: `PUR3ISO Material ${ts}`,
      sku: `PUR3ISO-${ts}`,
      unit: "piece",
      min_stock: 0,
      max_stock: 1000,
      cost_per_unit: 10,
    }
  });
  const matId = matRes?.result?.data?.id;
  if (!matId) { console.log("FAILED to create material:", JSON.stringify(matRes)); return; }
  console.log(`  Material: ${matId}`);

  // 3. Create dedicated purchase (qty=7)
  const purchaseQty = 7;
  const purchRes = await invoke(sAdmin.access_token, "createPurchase", {
    input: {
      supplier_id: supId,
      purchase_date: new Date().toISOString().split("T")[0],
      notes: "Isolated PUR3 test",
      items: [{ material_id: matId, quantity: purchaseQty, unit_cost: 15 }]
    }
  });
  const purchaseId = purchRes?.result?.data?.id;
  if (!purchaseId) { console.log("FAILED to create purchase:", JSON.stringify(purchRes)); return; }
  console.log(`  Purchase: ${purchaseId} (qty=${purchaseQty})`);

  // 4. Record exact initial stock
  const beforeRes = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
  const beforeStock = beforeRes?.result?.data?.current_stock;
  console.log(`\n--- TEST ---`);
  console.log(`  Before stock: ${beforeStock}`);

  // 5. Receive purchase ONCE
  const recv1 = await invoke(sAdmin.access_token, "receivePurchase", { purchaseId });
  console.log(`  Receive 1: success=${recv1?.result?.success} error=${recv1?.result?.error || 'none'}`);
  log("PUR3-ISO-a: Receive succeeded", recv1?.result?.success === true ? "PASS" : "FAIL",
    JSON.stringify(recv1?.result));

  // 6. Record stock after first receive
  const after1Res = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
  const after1Stock = after1Res?.result?.data?.current_stock;
  console.log(`  After receive 1: ${after1Stock} (expected ${beforeStock + purchaseQty})`);
  log("PUR3-ISO-b: Stock increased by exact qty", after1Stock === beforeStock + purchaseQty ? "PASS" : "FAIL",
    `${beforeStock} -> ${after1Stock} (expected +${purchaseQty})`);

  // 7. Double receive (should fail)
  const recv2 = await invoke(sAdmin.access_token, "receivePurchase", { purchaseId });
  console.log(`  Receive 2: success=${recv2?.result?.success} error=${recv2?.result?.error || 'none'}`);
  log("PUR3-ISO-c: Double receive rejected", recv2?.result?.success === false ? "PASS" : "FAIL",
    JSON.stringify(recv2?.result));

  // 8. Record stock after double receive — THE CRITICAL CHECK
  const after2Res = await invoke(sAdmin.access_token, "getMaterial", { id: matId });
  const after2Stock = after2Res?.result?.data?.current_stock;
  console.log(`  After receive 2: ${after2Stock}`);
  log("PUR3-ISO-d: Stock unchanged after double receive", after2Stock === after1Stock ? "PASS" : "FAIL",
    `${after1Stock} -> ${after2Stock}`);

  // 9. Check inventory transactions
  const { count: txnCount } = await adminSB.from("inventory_transactions")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", purchaseId)
    .eq("type", "purchase");
  log("PUR3-ISO-e: Exactly 1 purchase transaction", txnCount === 1 ? "PASS" : "FAIL", `txns=${txnCount}`);

  // 10. Verify purchase status
  const purchCheck = await invoke(sAdmin.access_token, "getPurchase", { id: purchaseId });
  log("PUR3-ISO-f: Purchase status=received", purchCheck?.result?.data?.status === "received" ? "PASS" : "FAIL",
    `status=${purchCheck?.result?.data?.status}`);

  // Cleanup
  console.log("\n--- CLEANUP ---");
  await adminSB.from("inventory_transactions").delete().eq("reference_id", purchaseId).eq("type", "purchase");
  await adminSB.from("purchase_items").delete().eq("purchase_id", purchaseId);
  await adminSB.from("purchases").delete().eq("id", purchaseId);
  await adminSB.from("materials").delete().eq("id", matId);
  await adminSB.from("suppliers").delete().eq("id", supId);
  console.log("  Cleaned up dedicated test records");

  console.log("\n============================================================");
  const pass = R.filter(r => r.r === "PASS").length;
  const fail = R.filter(r => r.r === "FAIL").length;
  console.log(`PASS = ${pass}  FAIL = ${fail}  TOTAL = ${R.length}`);
  if (fail > 0) {
    console.log("\nFAILURES:");
    R.filter(r => r.r === "FAIL").forEach(r => console.log(`  ✗ ${r.t}: ${r.d}`));
  }
}

main().catch(console.error);
