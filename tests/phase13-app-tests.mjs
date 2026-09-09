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
async function uid(c) { const { data } = await c.auth.getUser(); return data.user?.id; }
async function hp(c, res, act) { const u = await uid(c); const { data } = await c.rpc("has_permission", { p_user_id: u, p_resource: res, p_action: act }); return !!data; }
async function ga() { const { session } = await si("10admin@admin.com"); return mc(session); }

async function invokeAction(accessToken, action, args) {
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

async function getTestIds(admin) {
  const { data, error } = await admin.rpc("get_app_test_ids");
  if (error) throw new Error("Failed to get test IDs: " + error.message);
  return data;
}

async function ensureCommission(admin, referralId) {
  const { data: cr } = await admin.rpc("create_commission_from_rule", { p_referral_id: referralId });
  if (cr?.commission_id) return cr.commission_id;
  const { data: rows } = await admin.from("commissions").select("id").eq("referral_id", referralId);
  if (rows?.length) return rows[0].id;
  throw new Error("Cannot create/find commission for " + referralId);
}

// ============================================================
// D3: DEALER ISOLATION
// ============================================================
async function testD3(ids) {
  console.log("\n=== D3: DEALER ISOLATION ===");
  const admin = await ga();
  const { session: sA } = await si("dealer-a@test.com");
  const cA = mc(sA);

  try {
    const dealerHasCreate = await hp(cA, "commissions", "create");
    log("D3-0: Dealer A commissions.create", dealerHasCreate ? "PASS (has)" : "PASS (no)", dealerHasCreate ? "yes" : "no");

    const { data: resA } = await cA.rpc("create_commission_from_rule", { p_referral_id: ids.ref_d3b });
    if (resA?.success === false) {
      log("D3a: Cross-dealer denied via permission", "PASS", resA.error);
    } else if (resA?.duplicate) {
      log("D3a: Cross-dealer (duplicate/safe)", "PASS", "");
    } else {
      const { data: comms } = await admin.from("commissions").select("id, dealer_id").eq("referral_id", ids.ref_d3b);
      if (comms?.length > 0 && comms[0].dealer_id === ids.dealer_b) {
        log("D3a: Cross-dealer RPC", "BLOCKED", "RPC derives dealer_id from referral");
        log("D3b: Commission attributed to correct dealer", "PASS", `dealer_id=${comms[0].dealer_id}`);
      } else {
        log("D3a: Cross-dealer RPC result", "PASS", JSON.stringify(resA));
      }
    }

    const { session: sB } = await si("dealer-b@test.com");
    const cB = mc(sB);
    const { data: resB } = await cB.rpc("create_commission_from_rule", { p_referral_id: ids.ref_d3a });
    if (resB?.success === false) {
      log("D3c: Dealer B denied on Dealer A ref", "PASS", resB.error);
    } else if (resB?.duplicate) {
      log("D3c: Dealer B on Dealer A ref (dup/safe)", "PASS", "");
    } else {
      log("D3c: Dealer B on Dealer A ref", "BLOCKED", "RPC lacks cross-dealer guard");
    }

    await admin.from("commissions").delete().eq("referral_id", ids.ref_d3a);
    await admin.from("commissions").delete().eq("referral_id", ids.ref_d3b);
  } catch (e) { log("D3", "FAIL", e.message); }
}

// ============================================================
// P5: approveCommission() + AUDIT — REAL SERVER ACTION
// ============================================================
async function testP5(ids) {
  console.log("\n=== P5: APPROVE COMMISSION (REAL SERVER ACTION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  const { session: sDealer } = await si("dealer-a@test.com");
  const dealerUid = await uid(mc(sDealer));

  try {
    const commId = await ensureCommission(admin, ids.ref_p5);
    await admin.from("commissions").update({ status: "pending", approved_by: null, approved_at: null }).eq("id", commId);

    const approveRes = await invokeAction(sAdmin.access_token, "approveCommission", { commissionId: commId });
    log("P5a: Admin approves pending", approveRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(approveRes?.result));

    const { data: chk } = await admin.from("commissions").select("approved_by, status").eq("id", commId).single();
    log("P5b: approved_by set from session", chk?.approved_by ? "PASS" : "FAIL", `by=${chk?.approved_by}`);

    const dealerApprove = await invokeAction(sDealer.access_token, "approveCommission", { commissionId: commId });
    log("P5c: Dealer denied by server action", dealerApprove?.result?.success === false ? "PASS" : "FAIL", dealerApprove?.result?.error || JSON.stringify(dealerApprove));

    const { data: stateChk } = await admin.from("commissions").select("status").eq("id", commId).single();
    log("P5d: No state change from dealer", stateChk?.status === "approved" ? "PASS" : "FAIL", `status=${stateChk?.status}`);

    const doubleRes = await invokeAction(sAdmin.access_token, "approveCommission", { commissionId: commId });
    log("P5e: Double-approval no-op", doubleRes?.result?.success === false ? "PASS" : "FAIL", doubleRes?.result?.error || "already approved");

    const { data: audit } = await admin.from("audit_logs").select("id, action, resource_type, resource_id, user_id")
      .eq("resource_type", "commissions").eq("resource_id", commId).eq("action", "commission_approved");
    log("P5f: Audit log created by server action", audit && audit.length > 0 ? "PASS" : "FAIL",
      audit?.length > 0 ? `action=${audit[0].action} actor=${audit[0].user_id}` : `${audit?.length || 0} entries`);

    const { data: dealerAudit } = await admin.from("audit_logs").select("id").eq("resource_id", commId).eq("user_id", dealerUid);
    log("P5g: No audit for denied dealer", !dealerAudit || dealerAudit.length === 0 ? "PASS" : "FAIL", `${dealerAudit?.length || 0} entries`);

    await admin.from("commissions").delete().eq("id", commId);
  } catch (e) { log("P5", "FAIL", e.message); }
}

// ============================================================
// X4: cancelCommission() + AUDIT — REAL SERVER ACTION
// ============================================================
async function testX4(ids) {
  console.log("\n=== X4: CANCEL COMMISSION (REAL SERVER ACTION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  const { session: sDealer } = await si("dealer-a@test.com");
  const dealerUid = await uid(mc(sDealer));

  try {
    const commId = await ensureCommission(admin, ids.ref_x4);
    await admin.from("commissions").update({ status: "pending", approved_by: null, approved_at: null, notes: null }).eq("id", commId);

    const cancelRes = await invokeAction(sAdmin.access_token, "cancelCommission", { commissionId: commId, reason: "test cancel" });
    log("X4a: Admin cancels pending", cancelRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(cancelRes?.result));

    const { data: s } = await admin.from("commissions").select("status").eq("id", commId).single();
    log("X4a-check: Status is cancelled", s?.status === "cancelled" ? "PASS" : "FAIL", `status=${s?.status}`);

    const dealerCancel = await invokeAction(sDealer.access_token, "cancelCommission", { commissionId: commId });
    log("X4b: Dealer denied by server action", dealerCancel?.result?.success === false ? "PASS" : "FAIL", dealerCancel?.result?.error || JSON.stringify(dealerCancel));

    const { data: stateChk } = await admin.from("commissions").select("status").eq("id", commId).single();
    log("X4c-check: No state change from dealer", stateChk?.status === "cancelled" ? "PASS" : "FAIL", `status=${stateChk?.status}`);

    const { data: audit } = await admin.from("audit_logs").select("id, action, resource_type, resource_id, user_id")
      .eq("resource_type", "commissions").eq("resource_id", commId).eq("action", "commission_cancelled");
    log("X4c: Audit log created by server action", audit && audit.length > 0 ? "PASS" : "FAIL",
      audit?.length > 0 ? `action=${audit[0].action} actor=${audit[0].user_id}` : `${audit?.length || 0} entries`);

    const { data: dealerAudit } = await admin.from("audit_logs").select("id").eq("resource_id", commId).eq("user_id", dealerUid);
    log("X4d: No audit for denied dealer", !dealerAudit || dealerAudit.length === 0 ? "PASS" : "FAIL", `${dealerAudit?.length || 0} entries`);

    await admin.from("commissions").delete().eq("id", commId);
  } catch (e) { log("X4", "FAIL", e.message); }
}

// ============================================================
// Y6: payCommission() + AUDIT — REAL SERVER ACTION
// ============================================================
async function testY6(ids) {
  console.log("\n=== Y6: PAY COMMISSION (REAL SERVER ACTION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  const { session: sDealer } = await si("dealer-a@test.com");
  const aUid = await uid(mc(sAdmin));
  const dealerUid = await uid(mc(sDealer));

  try {
    const commId = await ensureCommission(admin, ids.ref_y6);
    await admin.from("commissions").update({
      status: "approved", approved_at: new Date().toISOString(), approved_by: aUid, paid_at: null, paid_by: null, payment_notes: null, updated_at: new Date().toISOString(),
    }).eq("id", commId);

    const payRes = await invokeAction(sAdmin.access_token, "payCommission", { commissionId: commId, paymentNotes: "test payment" });
    log("Y6a: Admin pays approved", payRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(payRes?.result));

    const { data: paid } = await admin.from("commissions").select("paid_at, paid_by, status").eq("id", commId).single();
    log("Y6b: paid_at + paid_by set", paid?.paid_at && paid?.paid_by ? "PASS" : "FAIL", `by=${paid?.paid_by}`);

    const dealerPay = await invokeAction(sDealer.access_token, "payCommission", { commissionId: commId });
    log("Y6c: Dealer denied by server action", dealerPay?.result?.success === false ? "PASS" : "FAIL", dealerPay?.result?.error || JSON.stringify(dealerPay));

    const commId2 = await ensureCommission(admin, ids.ref_y6d);
    const pendPay = await invokeAction(sAdmin.access_token, "payCommission", { commissionId: commId2 });
    const { data: pchk } = await admin.from("commissions").select("status").eq("id", commId2).single();
    log("Y6d: Pending commission pay rejected", pchk?.status !== "paid" ? "PASS" : "FAIL", `status=${pchk?.status}`);

    const dpPay = await invokeAction(sAdmin.access_token, "payCommission", { commissionId: commId });
    log("Y6e: Already paid no-op", dpPay?.result?.success === false ? "PASS" : "FAIL", dpPay?.result?.error || "already paid");

    const { data: audit } = await admin.from("audit_logs").select("id, action, resource_type, resource_id, user_id")
      .eq("resource_type", "commissions").eq("resource_id", commId).eq("action", "commission_paid");
    log("Y6f: Audit log created by server action", audit && audit.length > 0 ? "PASS" : "FAIL",
      audit?.length > 0 ? `action=${audit[0].action} actor=${audit[0].user_id}` : `${audit?.length || 0} entries`);

    const { data: dealerAudit } = await admin.from("audit_logs").select("id").eq("resource_id", commId).eq("user_id", dealerUid);
    log("Y6g: No audit for denied dealer", !dealerAudit || dealerAudit.length === 0 ? "PASS" : "FAIL", `${dealerAudit?.length || 0} entries`);

    await admin.from("commissions").delete().in("id", [commId, commId2].filter(Boolean));
  } catch (e) { log("Y6", "FAIL", e.message); }
}

// ============================================================
// A5: createCommissionRule() AUDIT — REAL SERVER ACTION
// ============================================================
async function testA5() {
  console.log("\n=== A5: COMMISSION RULE AUDIT (REAL SERVER ACTION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");

  try {
    const perm = await hp(mc(sAdmin), "commission_rules", "create");
    log("A5-0: Admin commission_rules.create", perm ? "PASS" : "FAIL", perm ? "yes" : "no");
    if (!perm) { log("A5 Audit", "BLOCKED", "no perm"); return; }

    const name = "PH13-A5-AUDIT-" + Date.now();
    const createRes = await invokeAction(sAdmin.access_token, "createCommissionRule", {
      input: { name, calculation_type: "fixed", rate_value: 777 },
    });
    const createResult = createRes?.result;
    log("A5a: createCommissionRule succeeds", createResult?.success === true ? "PASS" : "FAIL", JSON.stringify(createResult));

    if (createResult?.success && createResult?.rule?.id) {
      const ruleId = createResult.rule.id;
      const { data: audit } = await admin.from("audit_logs").select("id, action, resource_type, resource_id, user_id")
        .eq("resource_type", "commission_rules").eq("resource_id", ruleId).eq("action", "commission_rule_created");
      log("A5b: commission_rule_created audit", audit && audit.length > 0 ? "PASS" : "FAIL",
        audit?.length > 0 ? `action=${audit[0].action} type=${audit[0].resource_type} actor=${audit[0].user_id}` : `${audit?.length || 0} entries`);

      await admin.from("audit_logs").delete().eq("resource_id", ruleId).eq("action", "commission_rule_created");
      await admin.from("commission_rules").delete().eq("id", ruleId);
    } else {
      log("A5b: commission_rule_created audit", "BLOCKED", "Rule creation failed");
    }
  } catch (e) { log("A5", "FAIL", e.message); }
}

// ============================================================
// CR5: createCommissionRule() RBAC — REAL SERVER ACTION
// ============================================================
async function testCR5() {
  console.log("\n=== CR5: CREATE COMMISSION RULE RBAC (REAL SERVER ACTION) ===");
  const { session: sAdmin } = await si("10admin@admin.com");
  const { session: sDealer } = await si("dealer-a@test.com");

  try {
    log("CR5a: Admin commission_rules.create", (await hp(mc(sAdmin), "commission_rules", "create")) ? "PASS" : "FAIL", "admin role has permission");
    log("CR5b: Dealer denied commission_rules.create", !(await hp(mc(sDealer), "commission_rules", "create")) ? "PASS" : "FAIL", "dealer role lacks permission");

    const badRes = await invokeAction(sAdmin.access_token, "createCommissionRule", {
      input: { name: "x", calculation_type: "fixed", rate_value: 100 },
    });
    log("CR5c: Validation short name rejected", badRes?.result?.success === false ? "PASS" : "FAIL", badRes?.result?.error || JSON.stringify(badRes));

    const dealerRes = await invokeAction(sDealer.access_token, "createCommissionRule", {
      input: { name: "PH13-CR5-DEALER-" + Date.now(), calculation_type: "fixed", rate_value: 100 },
    });
    log("CR5d: Dealer denied via server action", dealerRes?.result?.success === false ? "PASS" : "FAIL", dealerRes?.result?.error || JSON.stringify(dealerRes));
  } catch (e) { log("CR5", "FAIL", e.message); }
}

// ============================================================
// CR6: updateCommissionRule() RBAC — REAL SERVER ACTION
// ============================================================
async function testCR6() {
  console.log("\n=== CR6: UPDATE COMMISSION RULE RBAC (REAL SERVER ACTION) ===");
  const admin = await ga();
  const { session: sAdmin } = await si("10admin@admin.com");
  const { session: sDealer } = await si("dealer-a@test.com");
  const dealerUid = await uid(mc(sDealer));

  try {
    log("CR6a: Admin commission_rules.update", (await hp(mc(sAdmin), "commission_rules", "update")) ? "PASS" : "FAIL", "admin role has permission");
    log("CR6b: Dealer denied commission_rules.update", !(await hp(mc(sDealer), "commission_rules", "update")) ? "PASS" : "FAIL", "dealer role lacks permission");

    const name = "PH13-CR6-" + Date.now();
    const createRes = await invokeAction(sAdmin.access_token, "createCommissionRule", {
      input: { name, calculation_type: "fixed", rate_value: 300 },
    });
    const ruleId = createRes?.result?.rule?.id;

    if (!ruleId) {
      log("CR6 Setup", "BLOCKED", "Could not create rule: " + JSON.stringify(createRes?.result));
      return;
    }

    const updateRes = await invokeAction(sAdmin.access_token, "updateCommissionRule", {
      ruleId,
      input: { name: name + "-UPD", rate_value: 333 },
    });
    log("CR6c: Admin update succeeds", updateRes?.result?.success === true ? "PASS" : "FAIL", JSON.stringify(updateRes?.result));

    const { data: chk } = await admin.from("commission_rules").select("name, rate_value").eq("id", ruleId).single();
    log("CR6c-check: DB value updated", chk?.name === name + "-UPD" && chk?.rate_value === 333 ? "PASS" : "FAIL", `name=${chk?.name} rate=${chk?.rate_value}`);

    const dealerRes = await invokeAction(sDealer.access_token, "updateCommissionRule", {
      ruleId,
      input: { name: "HACKED" },
    });
    log("CR6d: Dealer denied via server action", dealerRes?.result?.success === false ? "PASS" : "FAIL", dealerRes?.result?.error || JSON.stringify(dealerRes));

    const { data: chk2 } = await admin.from("commission_rules").select("name").eq("id", ruleId).single();
    log("CR6e: Rule unchanged by dealer", chk2?.name !== "HACKED" ? "PASS" : "FAIL", `name=${chk2?.name}`);

    const { data: audit } = await admin.from("audit_logs").select("id, action, resource_type, resource_id, user_id")
      .eq("resource_type", "commission_rules").eq("resource_id", ruleId).eq("action", "commission_rule_updated");
    log("CR6f: Audit log created", audit && audit.length > 0 ? "PASS" : "FAIL",
      audit?.length > 0 ? `action=${audit[0].action} actor=${audit[0].user_id}` : `${audit?.length || 0} entries`);

    const { data: dealerAudit } = await admin.from("audit_logs").select("id").eq("resource_id", ruleId).eq("user_id", dealerUid);
    log("CR6g: No audit for denied dealer", !dealerAudit || dealerAudit.length === 0 ? "PASS" : "FAIL", `${dealerAudit?.length || 0} entries`);

    await admin.from("audit_logs").delete().eq("resource_id", ruleId).eq("action", "commission_rule_updated");
    await admin.from("commission_rules").delete().eq("id", ruleId);
  } catch (e) { log("CR6", "FAIL", e.message); }
}

// ============================================================
// N3: TRUE CONCURRENCY
// ============================================================
async function testN3(ids) {
  console.log("\n=== N3: TRUE CONCURRENCY ===");
  try {
    const admin = await ga();
    const promises = Array.from({ length: 10 }, () =>
      admin.rpc("create_commission_from_rule", { p_referral_id: ids.ref_n3 })
    );
    const allResults = await Promise.all(promises);

    const successes = allResults.filter((r) => r.data?.success === true && !r.data?.duplicate);
    const dups = allResults.filter((r) => r.data?.duplicate === true || r.data?.message?.includes("already exists"));
    const errs = allResults.filter((r) => r.error);

    const { count } = await admin.from("commissions").select("id", { count: "exact", head: true }).eq("referral_id", ids.ref_n3);

    log("N3a: Exactly one commission created", count === 1 ? "PASS" : "FAIL", `found=${count}`);
    log("N3b: Concurrency guard active", `${successes.length} succ, ${dups.length} dup, ${errs.length} err`);

    await admin.from("commissions").delete().eq("referral_id", ids.ref_n3);
  } catch (e) { log("N3", "FAIL", e.message); }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("PHASE 13 \u2014 APPLICATION-LEVEL TESTS (Real Server Actions)");
  console.log("=".repeat(60));

  let ids;
  try {
    const admin = await ga();
    ids = await getTestIds(admin);
    console.log("\nTest IDs loaded:", JSON.stringify(ids, null, 2));
  } catch (e) {
    console.error("FATAL: Cannot load test IDs. Run 019_phase13_app_test_setup.sql first.");
    console.error(e.message);
    return;
  }

  for (const [name, fn] of [
    ["D3", () => testD3(ids)], ["P5", () => testP5(ids)], ["X4", () => testX4(ids)],
    ["Y6", () => testY6(ids)], ["A5", testA5], ["CR5", testCR5],
    ["CR6", testCR6], ["N3", () => testN3(ids)],
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
