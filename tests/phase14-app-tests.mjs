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
// INV1: createInvoice — RBAC + validation
// ============================================================
async function testINV1() {
  console.log("\n=== INV1: CREATE INVOICE (RBAC + VALIDATION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    // Get a valid customer_id
    const { data: customers } = await admin.from("customers").select("id").eq("is_active", true).limit(1);
    const customerId = customers?.[0]?.id;
    if (!customerId) { log("INV1", "BLOCKED", "No customers"); return; }

    // INV1a: Admin creates invoice
    const input = {
      customer_id: customerId,
      discount: 10,
      tax_rate: 15,
      notes: "Phase14 test",
      items: [
        { description: "Tinting", quantity: 2, unit_price: 500, discount: 0, tax_rate: 0 },
        { description: "Polish", quantity: 1, unit_price: 200, discount: 50, tax_rate: 0 },
      ],
    };
    const createRes = await invoke(sAdmin.access_token, "createInvoice", { input });
    log("INV1a: Admin creates invoice", createRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(createRes?.result));

    // INV1b: Verify invoice is draft
    if (createRes?.result?.data?.invoice_id) {
      const invoiceId = createRes.result.data.invoice_id;
      const { data: inv } = await admin.from("invoices").select("status, total").eq("id", invoiceId).single();
      log("INV1b: Invoice status is draft", inv?.status === "draft" ? "PASS" : "FAIL", `status=${inv?.status}`);

      // INV1c: Verify total (subtotal=1150, tax=172.5, discount=10, total=1312.5)
      log("INV1c: Total calculated correctly", inv?.total === 1312.5 ? "PASS" : "FAIL", `total=${inv?.total}`);

      // INV1d: Verify items count
      const { count } = await admin.from("invoice_items").select("id", { count: "exact", head: true }).eq("invoice_id", invoiceId);
      log("INV1d: Items created (count=2)", count === 2 ? "PASS" : "FAIL", `count=${count}`);

      // INV1e: Audit log
      const { count: auditCount } = await admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("resource_type", "invoices").eq("resource_id", invoiceId).eq("action", "invoice_created");
      log("INV1e: Audit log invoice_created", auditCount >= 1 ? "PASS" : "FAIL", `count=${auditCount}`);

      // INV1f: Empty items rejected
      const badInput = { ...input, items: [] };
      const badRes = await invoke(sAdmin.access_token, "createInvoice", { input: badInput });
      log("INV1f: Empty items rejected", badRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(badRes?.result));

      // Cleanup
      await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
      await admin.from("invoices").delete().eq("id", invoiceId);
    }
  } catch (e) { log("INV1", "FAIL", e.message); }
}

// ============================================================
// INV2: issueInvoice — status transition
// ============================================================
async function testINV2() {
  console.log("\n=== INV2: ISSUE INVOICE ===");
  const admin = await ga();
  try {
    const { data: customers } = await admin.from("customers").select("id").eq("is_active", true).limit(1);
    const customerId = customers?.[0]?.id;
    if (!customerId) { log("INV2", "BLOCKED", "No customers"); return; }

    const input = {
      customer_id: customerId,
      items: [{ description: "Test", quantity: 1, unit_price: 100, discount: 0, tax_rate: 0 }],
    };
    const createRes = await invoke((await si("10admin@admin.com")).session.access_token, "createInvoice", { input });
    const invoiceId = createRes?.result?.data?.invoice_id;
    if (!invoiceId) { log("INV2", "BLOCKED", "createInvoice failed"); return; }

    // INV2a: Issue invoice
    const issueRes = await invoke((await si("10admin@admin.com")).session.access_token, "issueInvoice", { id: invoiceId });
    log("INV2a: Issue invoice succeeds", issueRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(issueRes?.result));

    // INV2b: Status is issued
    const { data: inv } = await admin.from("invoices").select("status").eq("id", invoiceId).single();
    log("INV2b: Status is issued", inv?.status === "issued" ? "PASS" : "FAIL", `status=${inv?.status}`);

    // INV2c: Cannot issue again
    const issueRes2 = await invoke((await si("10admin@admin.com")).session.access_token, "issueInvoice", { id: invoiceId });
    log("INV2c: Cannot issue issued invoice", issueRes2?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(issueRes2?.result));

    // Cleanup
    await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
    await admin.from("invoices").delete().eq("id", invoiceId);
  } catch (e) { log("INV2", "FAIL", e.message); }
}

// ============================================================
// INV3: recordPayment — idempotency + overpayment
// ============================================================
async function testINV3() {
  console.log("\n=== INV3: RECORD PAYMENT ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const { data: customers } = await admin.from("customers").select("id").eq("is_active", true).limit(1);
    const customerId = customers?.[0]?.id;
    if (!customerId) { log("INV3", "BLOCKED", "No customers"); return; }

    const input = {
      customer_id: customerId,
      items: [{ description: "Test Payment", quantity: 1, unit_price: 1000, discount: 0, tax_rate: 0 }],
    };
    const createRes = await invoke(sAdmin.access_token, "createInvoice", { input });
    const invoiceId = createRes?.result?.data?.invoice_id;
    if (!invoiceId) { log("INV3", "BLOCKED", "createInvoice failed"); return; }

    // Issue invoice first
    await invoke(sAdmin.access_token, "issueInvoice", { id: invoiceId });

    // INV3a: Record payment
    const payInput = { invoice_id: invoiceId, amount: 500, payment_method: "cash", notes: "Test" };
    const payRes = await invoke(sAdmin.access_token, "recordPayment", { input: payInput });
    log("INV3a: Record payment succeeds", payRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(payRes?.result));

    // INV3b: Status is partially_paid
    const { data: inv } = await admin.from("invoices").select("status, paid_amount").eq("id", invoiceId).single();
    log("INV3b: Status partially_paid", inv?.status === "partially_paid" ? "PASS" : "FAIL", `status=${inv?.status}`);
    log("INV3c: paid_amount=500", inv?.paid_amount === 500 ? "PASS" : "FAIL", `paid=${inv?.paid_amount}`);

    // INV3d: Overpayment blocked
    const overpayRes = await invoke(sAdmin.access_token, "recordPayment", { input: { invoice_id: invoiceId, amount: 99999, payment_method: "cash" } });
    const overpayResult = overpayRes?.result ?? overpayRes;
    log("INV3d: Overpayment blocked", overpayResult?.success === false ? "PASS" : "FAIL", JSON.stringify(overpayResult));

    // INV3e: Idempotency key prevents duplicate
    const idemKey = crypto.randomUUID();
    const idemRes1 = await invoke(sAdmin.access_token, "recordPayment", { input: { invoice_id: invoiceId, amount: 100, payment_method: "card", idempotency_key: idemKey } });
    const idemRes2 = await invoke(sAdmin.access_token, "recordPayment", { input: { invoice_id: invoiceId, amount: 100, payment_method: "card", idempotency_key: idemKey } });
    log("INV3e: Idempotency prevents duplicate", idemRes1?.result?.data?.success === true && idemRes2?.result?.data?.duplicate === true ? "PASS" : "FAIL", JSON.stringify({ first: idemRes1?.result, second: idemRes2?.result }));

    // INV3f: Pay remaining → paid
    const { data: invCheck } = await admin.from("invoices").select("total, paid_amount").eq("id", invoiceId).single();
    const remaining = invCheck ? invCheck.total - invCheck.paid_amount : 0;
    await invoke(sAdmin.access_token, "recordPayment", { input: { invoice_id: invoiceId, amount: remaining, payment_method: "bank_transfer" } });
    const { data: inv2 } = await admin.from("invoices").select("status").eq("id", invoiceId).single();
    log("INV3f: Full payment → paid", inv2?.status === "paid" ? "PASS" : "FAIL", `status=${inv2?.status}`);

    // INV3g: Cannot pay paid invoice
    const payPaidRes = await invoke(sAdmin.access_token, "recordPayment", { input: { invoice_id: invoiceId, amount: 1, payment_method: "cash" } });
    log("INV3g: Cannot pay paid invoice", payPaidRes?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(payPaidRes?.result));

    // Cleanup
    await admin.from("payments").delete().eq("invoice_id", invoiceId);
    await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
    await admin.from("invoices").delete().eq("id", invoiceId);
  } catch (e) { log("INV3", "FAIL", e.message); }
}

// ============================================================
// INV4: refundInvoice
// ============================================================
async function testINV4() {
  console.log("\n=== INV4: REFUND INVOICE ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const { data: customers } = await admin.from("customers").select("id").eq("is_active", true).limit(1);
    const customerId = customers?.[0]?.id;
    if (!customerId) { log("INV4", "BLOCKED", "No customers"); return; }

    const input = {
      customer_id: customerId,
      items: [{ description: "Refund Test", quantity: 1, unit_price: 500, discount: 0, tax_rate: 0 }],
    };
    const createRes = await invoke(sAdmin.access_token, "createInvoice", { input });
    const invoiceId = createRes?.result?.data?.invoice_id;
    if (!invoiceId) { log("INV4", "BLOCKED", "createInvoice failed"); return; }

    // Issue + pay
    await invoke(sAdmin.access_token, "issueInvoice", { id: invoiceId });
    await invoke(sAdmin.access_token, "recordPayment", { input: { invoice_id: invoiceId, amount: 500, payment_method: "cash" } });

    // INV4a: Refund paid invoice
    const refundRes = await invoke(sAdmin.access_token, "refundInvoice", { id: invoiceId, reason: "Test refund" });
    const refundResult = refundRes?.result ?? refundRes;
    const refundNotFound = JSON.stringify(refundResult).includes('Could not find the function') || JSON.stringify(refundRes).includes('Could not find the function');
    if (refundNotFound) {
      log("INV4a: Refund paid invoice", "BLOCKED", "Run migration 020_phase14_refund_function.sql in Supabase Dashboard");
      log("INV4b: Status is refunded", "BLOCKED", "Depends on refund_invoice function");
      log("INV4c: Cannot refund draft", "BLOCKED", "Depends on refund_invoice function");
      log("INV4d: Audit log invoice_refunded", "BLOCKED", "Depends on refund_invoice function");
    } else {
      log("INV4a: Refund paid invoice", refundResult?.success === true ? "PASS" : "FAIL", JSON.stringify(refundResult));

      // INV4b: Status is refunded
      const { data: inv } = await admin.from("invoices").select("status").eq("id", invoiceId).single();
      log("INV4b: Status is refunded", inv?.status === "refunded" ? "PASS" : "FAIL", `status=${inv?.status}`);

      // INV4c: Cannot refund draft
      const createRes2 = await invoke(sAdmin.access_token, "createInvoice", { input: { ...input, items: [{ description: "Draft", quantity: 1, unit_price: 100, discount: 0, tax_rate: 0 }] } });
      const draftId = createRes2?.result?.data?.invoice_id;
      if (draftId) {
        const refundDraftRes = await invoke(sAdmin.access_token, "refundInvoice", { id: draftId });
        const draftResult = refundDraftRes?.result ?? refundDraftRes;
        log("INV4c: Cannot refund draft", draftResult?.success === false ? "PASS" : "FAIL", JSON.stringify(draftResult));
        await admin.from("invoice_items").delete().eq("invoice_id", draftId);
        await admin.from("invoices").delete().eq("id", draftId);
      }

      // INV4d: Audit log
      const { count: auditCount } = await admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("resource_type", "invoices").eq("resource_id", invoiceId).eq("action", "invoice_refunded");
      log("INV4d: Audit log invoice_refunded", auditCount >= 1 ? "PASS" : "FAIL", `count=${auditCount}`);
    }

    // Cleanup
    await admin.from("payments").delete().eq("invoice_id", invoiceId);
    await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
    await admin.from("invoices").delete().eq("id", invoiceId);
  } catch (e) { log("INV4", "FAIL", e.message); }
}

// ============================================================
// INV5: getInvoices + getInvoiceStats (read RBAC)
// ============================================================
async function testINV5() {
  console.log("\n=== INV5: READ INVOICES + STATS ===");
  try {
    const listRes = await invoke((await si("10admin@admin.com")).session.access_token, "getInvoices", {});
    log("INV5a: getInvoices returns list", listRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(listRes?.result));

    const statsRes = await invoke((await si("10admin@admin.com")).session.access_token, "getInvoiceStats", {});
    log("INV5b: getInvoiceStats returns counts", statsRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(statsRes?.result));
  } catch (e) { log("INV5", "FAIL", e.message); }
}

// ============================================================
// INV6: cancelInvoice
// ============================================================
async function testINV6() {
  console.log("\n=== INV6: CANCEL INVOICE ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  try {
    const { data: customers } = await admin.from("customers").select("id").eq("is_active", true).limit(1);
    const customerId = customers?.[0]?.id;
    if (!customerId) { log("INV6", "BLOCKED", "No customers"); return; }

    const input = {
      customer_id: customerId,
      items: [{ description: "Cancel Test", quantity: 1, unit_price: 300, discount: 0, tax_rate: 0 }],
    };
    const createRes = await invoke(sAdmin.access_token, "createInvoice", { input });
    const invoiceId = createRes?.result?.data?.invoice_id;
    if (!invoiceId) { log("INV6", "BLOCKED", "createInvoice failed"); return; }

    // INV6a: Cancel draft invoice
    const cancelRes = await invoke(sAdmin.access_token, "cancelInvoice", { id: invoiceId });
    log("INV6a: Cancel draft invoice", cancelRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(cancelRes?.result));

    // INV6b: Status is cancelled
    const { data: inv } = await admin.from("invoices").select("status").eq("id", invoiceId).single();
    log("INV6b: Status is cancelled", inv?.status === "cancelled" ? "PASS" : "FAIL", `status=${inv?.status}`);

    // INV6c: Cannot cancel already cancelled
    const cancelRes2 = await invoke(sAdmin.access_token, "cancelInvoice", { id: invoiceId });
    log("INV6c: Cannot cancel already cancelled", cancelRes2?.result?.success === false ? "PASS" : "FAIL", JSON.stringify(cancelRes2?.result));

    // Cleanup
    await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
    await admin.from("invoices").delete().eq("id", invoiceId);
  } catch (e) { log("INV6", "FAIL", e.message); }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("PHASE 14 \u2014 APPLICATION-LEVEL TESTS (Real Server Actions)");
  console.log("=".repeat(60));

  for (const [name, fn] of [
    ["INV1", testINV1], ["INV2", testINV2], ["INV3", testINV3],
    ["INV4", testINV4], ["INV5", testINV5], ["INV6", testINV6],
  ]) {
    try { await fn(); } catch (e) { log(name, "FAIL", e.message); }
  }

  console.log("\n" + "=".repeat(60));
  console.log("APPLICATION TESTS SUMMARY");
  console.log("=".repeat(60));
  const pass = R.filter((r) => r.r === "PASS").length;
  const fail = R.filter((r) => r.r === "FAIL").length;
  const blocked = R.filter((r) => r.r === "BLOCKED").length;
  console.log(`PASS = ${pass}`);
  console.log(`FAIL = ${fail}`);
  console.log(`BLOCKED = ${blocked}`);
  console.log(`TOTAL = ${R.length}`);
  if (fail > 0) {
    console.log("\nFailed:");
    R.filter((r) => r.r === "FAIL").forEach((r) => console.log(`  \u2717 ${r.t}: ${r.d}`));
  }
}

main().catch(console.error);
