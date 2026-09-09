# Phase 20 — Independent Security Audit Report

**Project:** Hima Protection — حماية العنوان  
**Date:** 2026-09-01  
**Audit Type:** Independent Security Audit (Read-Only)  
**Scope:** Full codebase — OWASP Top 10, API Security, Auth, RBAC, RLS, Financial, Inventory, Dealer Isolation

---

## Executive Summary

**SECURITY AUDIT COMPLETE — FINDINGS PRESENT**

| Severity | Phase 19 | Phase 20 (New) | Total |
|----------|----------|-----------------|-------|
| CRITICAL | 6 | 3 | 9 |
| HIGH | 7 | 5 | 12 |
| MEDIUM | 8 | 4 | 12 |
| LOW | 5 | 2 | 7 |
| **Total** | **26** | **14** | **40** |

**Phase 19 Findings Status:**
- **CONFIRMED:** 22 of 26 (85%)
- **NOT CONFIRMED:** 0
- **PARTIALLY CONFIRMED:** 4 (15%)
- **New findings added:** 14

---

## Phase 19 Finding Verification

### FINDING 1: `/api/test/run-action` — CONFIRMED ✅
**Severity:** CRITICAL  
**Evidence:**
- No `NODE_ENV` check (lines 1-601) — active in all environments
- No middleware protection — root middleware only does CORS, Supabase middleware only protects `/admin`
- Only validates `accessToken` via `auth.getUser()` — no RBAC, no staff check
- 76 explicit actions callable by any authenticated user
- `httpOnly: false` on session cookie (line 54) — token readable by JS
- No rate limiting
- Arbitrary parameters accepted (`args: Record<string, unknown>`)

**Attack Chain:** Any authenticated user → POST `/api/test/run-action` → `action: "createStaff"` with `role: "super_admin"` → privilege escalation

---

### FINDING 2: `staff.ts` Mass Assignment — CONFIRMED ✅
**Severity:** CRITICAL  
**Evidence:**
- `createStaff` (line 33): No permission check. `role` and `role_id` accepted without validation
- `updateStaff` (line 62): `.update({ ...input, updated_at: ... })` — direct spread, no field whitelist
- Uses `getSupabaseAdmin()` (bypasses RLS) — lines 42, 71, 88
- No Zod validation, no `requirePermission()` call
- `role_id` can be set to any UUID (no FK check)
- `role` can be set to any string (no enum validation)

**Columns controllable via `updateStaff`:** `full_name`, `phone`, `role_id`, `role`, `is_active`

---

### FINDING 3: `roles.ts` No Permission Checks — CONFIRMED ✅
**Severity:** CONFIRMED as HIGH (Phase 19 said CRITICAL)  
**Evidence:**
- 4 functions: `getRoles`, `getRolePermissions`, `getAllPermissions`, `getStaffCountByRole`
- All call `requireAuth()` only — no `requirePermission()`, no `user.permissions.includes()`
- `requireAuth()` (auth.ts:115-121) checks session exists, does NOT check staff/dealer distinction or permissions
- Uses `getSupabaseAdmin()` — bypasses RLS
- Any authenticated user (including dealers) can enumerate all roles and permissions

---

### FINDING 4: Fail-Open Auth on Missing Env Vars — CONFIRMED ✅
**Severity:** CONFIRMED as CRITICAL  
**Evidence:** `middleware.ts:23-25` calls `NextResponse.next()` when env vars are missing

---

### FINDING 5: Host Header Injection in CORS — CONFIRMED ✅
**Severity:** CONFIRMED as HIGH  
**Evidence:** `middleware.ts:39` constructs origin from `request.headers.get('host')`

---

### FINDING 6: Commission Actions — No Ownership Scoping — CONFIRMED ✅
**Severity:** CONFIRMED as HIGH  
**Evidence:** `approveCommission`, `cancelCommission`, `payCommission` accept `commissionId` with only permission check, no dealer_id ownership validation

---

### FINDING 7: `updateBookingStatus` Lost Update — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM (Phase 19 said HIGH)  
**Evidence:** Read-then-write without conditional WHERE in `bookings.ts:179-201`

---

### FINDING 8: `cancelInvoice` Race — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** `invoices.ts:274-301` — unconditional UPDATE without status guard

---

### FINDING 9: `cancelPurchase` Race — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** `purchases.ts:296-315` — no status in WHERE clause

---

### FINDING 10: Cross-Dealer Referral Access — CONFIRMED ✅
**Severity:** CONFIRMED as HIGH  
**Evidence:** `redeemReferral` (referral.ts:460) and `updateReferralStatus` (referral.ts:574) — no dealer_id ownership check in code. RLS `staff_update_referrals` is permission-based only

---

### FINDING 11: CORS Bypass for Webhooks — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** `/api/moyasar/*`, `/api/tamara/*`, `/api/otp/*` exempt from CORS

---

### FINDING 12: `httpOnly: false` in Test Route — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** `run-action/route.ts:54`

---

### FINDING 13: CSP `unsafe-inline` + `unsafe-eval` — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** `middleware.ts` CSP header

---

### FINDING 14: Double-Booking — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** No unique constraint on `(service_id, preferred_date, preferred_time)` in bookings table

---

### FINDING 15: `issueInvoice` Double Issue — CONFIRMED ✅
**Severity:** CONFIRMED as LOW (idempotent)

---

### FINDING 16: Commission False Success — CONFIRMED ✅
**Severity:** CONFIRMED as LOW  
**Evidence:** `commission.ts:247,399` — no `rows_updated` check

---

### FINDING 17: No Rate Limiting — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM

---

### FINDING 18: No Storage Policies — NOT APPLICABLE ✅
**Severity:** N/A  
**Evidence:** Supabase Storage is NOT used in this project. No bucket definitions, no file uploads.

---

### FINDING 19: Permissions Header Trust — CONFIRMED ✅
**Severity:** CONFIRMED as LOW  
**Evidence:** `x-permissions` header set by middleware

---

### FINDING 20: Fail-Open Error Handling — CONFIRMED ✅
**Severity:** CONFIRMED as MEDIUM  
**Evidence:** `updateSession()` catch block — non-admin routes silently pass

---

### FINDING 21: Unused `z` Import — CONFIRMED ✅
**Severity:** CONFIRMED as LOW

---

### FINDINGS 22-26: LOW findings — ALL CONFIRMED ✅

---

## NEW Findings (Discovered in Phase 20)

### N1. Hardcoded Database Password in 16+ Files
**Severity:** CRITICAL  
**Location:** `run-migrations.js:3`, `execute_migration.js:61`, 14 test files  
**Evidence:** PostgreSQL password `Aass357690@` hardcoded in plaintext. Full connection string: `postgresql://postgres:Aass357690%40@db.nzspowfxwntxfievmmxq.supabase.co:5432/postgres`  
**Impact:** If repo is pushed to any remote, database credentials are fully compromised.  
**Attack:** Clone repo → extract password → direct database access via any PostgreSQL client.

---

### N2. Hardcoded Service Role Key in 10+ Files
**Severity:** CRITICAL  
**Location:** `scripts/create-receptionist.mjs:4`, `test_api.js:4`, all `tests/*.mjs`  
**Evidence:** `SERVICE_KEY = "eyJ..."` (full service_role JWT) hardcoded in source files  
**Impact:** Service role key grants full database access bypassing all RLS.  
**Attack:** Extract key → `supabase` CLI or REST API → full database access.

---

### N3. Hardcoded Test User Password
**Severity:** HIGH  
**Location:** `scripts/create-receptionist.mjs:6`, all `tests/*.mjs`  
**Evidence:** Password `Aa123456` used for test accounts  
**Impact:** Test credentials may work in production if test accounts exist there.

---

### N4. RBAC Tables Without RLS
**Severity:** HIGH  
**Location:** `roles`, `permissions`, `role_permissions` tables  
**Evidence:** No `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in any migration. Any authenticated user can `SELECT * FROM roles`, `SELECT * FROM permissions`, `SELECT * FROM role_permissions`.  
**Impact:** Full RBAC schema disclosure. Attacker learns all role names, permission names, and mappings.

---

### N5. Dashboard Functions — No REVOKE/GRANT + Missing search_path
**Severity:** HIGH  
**Location:** `027_dashboard_aggregation.sql` — all 9 dashboard functions  
**Evidence:**
1. `SECURITY DEFINER` without `SET search_path = public` — search_path injection risk
2. No `REVOKE ... FROM anon` — anonymous users can call functions
3. No `GRANT` statements — functions accessible to public role by default
**Impact:** Anonymous users can access financial summaries, revenue data, dealer performance metrics.

---

### N6. `referral_services` Has RLS but Zero Policies
**Severity:** MEDIUM  
**Location:** `001_initial_schema.sql` (line 712)  
**Evidence:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` but no `CREATE POLICY` statements  
**Impact:** Default deny — only SECURITY DEFINER functions can access. May cause silent bugs if app code queries directly.

---

### N7. `commission_rules` Dealer Policy Leaks Other Dealers' Rates
**Severity:** MEDIUM  
**Location:** `014_phase13_commission_rules.sql:78`  
**Evidence:** Policy `dealer_select_active_rules` uses `USING (is_active = true)` — no dealer_id check  
**Impact:** Any dealer can see ALL active commission rules, including other dealers' rates.

---

### N8. No Self-Approval Prevention in Commission Flow
**Severity:** HIGH  
**Location:** `commission.ts:201-277`  
**Evidence:** `approveCommission` checks `commissions:approve` permission but does NOT verify the approver is not the commission's associated dealer.  
**Impact:** A user with both dealer and staff roles can approve their own commission, then pay it.

---

### N9. No Maximum Invoice Amount Cap
**Severity:** HIGH  
**Location:** `invoices.ts:171-213`, `004_phase05_hardening.sql:78-245`  
**Evidence:** `create_invoice` validates `total >= 0` but no maximum.  
**Impact:** Compromised staff account creates $999M invoice → issues → records payment → financial fraud.

---

### N10. `refundInvoice` Does Not Zero `paid_amount`
**Severity:** MEDIUM  
**Location:** `020_phase14_refund_function.sql:44-48`  
**Evidence:** Refund sets `status = 'refunded'` but `paid_amount` remains non-zero.  
**Impact:** Revenue reports sum `paid_amount` and include refunded amounts. Incorrect financial reporting.

---

### N11. No Login Rate Limiting
**Severity:** HIGH  
**Location:** Login pages  
**Evidence:** `checkRateLimit` exists (`src/lib/rate-limit.ts`) but only used in `guest-booking.ts`. Login has zero rate limiting. In-memory rate limiter resets on restart.  
**Impact:** Brute-force attacks on login credentials.

---

### N12. Dealer Layout Missing Auth Check
**Severity:** HIGH  
**Location:** `src/app/dealer/layout.tsx`  
**Evidence:** No `requireAuth()` call in dealer layout. Individual pages must each independently call auth.  
**Impact:** If any dealer page forgets auth check, it's publicly accessible.

---

### N13. No CSRF Protection
**Severity:** MEDIUM  
**Location:** Entire application  
**Evidence:** No CSRF tokens anywhere. Same-origin check in middleware provides partial protection for API routes, but server actions are vulnerable.  
**Impact:** Cross-site request forgery on state-changing operations.

---

### N14. `get_app_test_ids()` Missing search_path
**Severity:** LOW  
**Location:** `019_phase13_app_test_setup.sql:6`  
**Evidence:** SECURITY DEFINER without SET search_path = public

---

## Phase 19 vs Phase 20 Comparison

| Phase 19 Finding | Phase 19 Severity | Phase 20 Verdict | Phase 20 Severity |
|------------------|-------------------|-------------------|-------------------|
| 1: test/run-action | CRITICAL | **CONFIRMED** | CRITICAL |
| 2: staff.ts mass assign | CRITICAL | **CONFIRMED** | CRITICAL |
| 3: roles.ts no perms | CRITICAL | **CONFIRMED** | HIGH |
| 4: Fail-open env vars | CRITICAL | **CONFIRMED** | CRITICAL |
| 5: Host header injection | HIGH | **CONFIRMED** | HIGH |
| 6: Commission no scoping | HIGH | **CONFIRMED** | HIGH |
| 7: updateBookingStatus race | HIGH | **CONFIRMED** | MEDIUM |
| 8: cancelInvoice race | HIGH | **CONFIRMED** | MEDIUM |
| 9: cancelPurchase race | HIGH | **CONFIRMED** | MEDIUM |
| 10: Cross-dealer referral | HIGH | **CONFIRMED** | HIGH |
| 11: CORS bypass webhooks | HIGH | **CONFIRMED** | MEDIUM |
| 12: httpOnly false | HIGH | **CONFIRMED** | MEDIUM |
| 13: CSP unsafe-inline | HIGH | **CONFIRMED** | MEDIUM |
| 14: Double-booking | MEDIUM | **CONFIRMED** | MEDIUM |
| 15: issueInvoice double | MEDIUM | **CONFIRMED** | LOW |
| 16: Commission false success | MEDIUM | **CONFIRMED** | LOW |
| 17: No rate limiting | MEDIUM | **CONFIRMED** | MEDIUM |
| 18: No storage policies | MEDIUM | **NOT APPLICABLE** | N/A |
| 19: Permissions header | MEDIUM | **CONFIRMED** | LOW |
| 20: Fail-open error | MEDIUM | **CONFIRMED** | MEDIUM |
| 21: Unused z import | LOW | **CONFIRMED** | LOW |
| 22-26: LOW findings | LOW | **CONFIRMED** | LOW |

---

## Complete Findings by Severity

### CRITICAL (9)

| ID | Finding | File | Attack Path |
|----|---------|------|-------------|
| C1 | `/api/test/run-action` — unguarded universal RPC | `src/app/api/test/run-action/route.ts` | Any auth user → 76 actions → full system control |
| C2 | `staff.ts` — mass assignment + no auth + admin client | `src/app/actions/staff.ts:33-83` | `{...input}` spread → inject `role: "super_admin"` → privilege escalation |
| C3 | Hardcoded DB password in 16+ files | `run-migrations.js`, test files | Clone repo → extract password → direct DB access |
| C4 | Hardcoded service role key in 10+ files | `scripts/create-receptionist.mjs`, test files | Extract key → full database access bypassing RLS |
| C5 | Fail-open auth on missing env vars | `middleware.ts:23-25` | Misconfigured deploy → zero auth |
| C6 | `roles.ts` — zero permission checks | `src/app/actions/roles.ts:5-66` | Any user → enumerate full RBAC schema |
| C7 | RBAC tables without RLS | `roles`, `permissions`, `role_permissions` | `SELECT * FROM permissions` → full schema disclosure |
| C8 | Dashboard functions — no REVOKE/GRANT | `027_dashboard_aggregation.sql` | `anon` → call functions → financial data leak |
| C9 | Dashboard functions — missing search_path | `027_dashboard_aggregation.sql` | search_path injection → wrong table queries |

### HIGH (12)

| ID | Finding | File | Attack Path |
|----|---------|------|-------------|
| H1 | Host header injection in CORS | `middleware.ts:39` | Crafted Host header → bypass CORS |
| H2 | Commission no ownership scoping | `commission.ts:201-430` | Staff → approve/pay any dealer's commission |
| H3 | Cross-dealer referral access | `referral.ts:460-681` | Dealer with `referrals:update` → redeem other dealer's referral |
| H4 | `createStaff` — no permission check | `staff.ts:33-60` | Any auth user → create staff with arbitrary role |
| H5 | No self-approval prevention in commissions | `commission.ts:201` | Dealer+staff → approve own commission → pay → fraud |
| H6 | No max invoice amount cap | `invoices.ts:171` | Compromised staff → create $99M invoice → fraud |
| H7 | No login rate limiting | Login pages | Brute-force → account compromise |
| H8 | Dealer layout missing auth | `src/app/dealer/layout.tsx` | Public dealer pages if auth forgotten |
| H9 | No CSRF protection | Entire app | Cross-site state changes |
| H10 | Test user password hardcoded | Test files | Test credentials → production access |
| H11 | `redeemReferral` — no ownership check | `referral.ts:460` | Cross-dealer referral redemption |
| H12 | `commission_rules` leaks other dealers' rates | `014_phase13_commission_rules.sql:78` | Dealer → see all commission rates |

### MEDIUM (12)

| ID | Finding | File | Evidence |
|----|---------|------|----------|
| M1 | `cancelInvoice` race condition | `invoices.ts:274` | No status guard in UPDATE WHERE |
| M2 | `cancelPurchase` race condition | `purchases.ts:296` | No status guard in UPDATE WHERE |
| M3 | `updateBookingStatus` race condition | `bookings.ts:179` | Lost update on status transition |
| M4 | Double-booking — no slot uniqueness | DB schema | No unique constraint on slot |
| M5 | CSP `unsafe-inline` + `unsafe-eval` | `middleware.ts` | XSS execution possible |
| M6 | `httpOnly: false` on session cookie | `run-action/route.ts:54` | Token readable by JS |
| M7 | CORS bypass for webhooks | `middleware.ts:31-34` | Cross-origin mutations possible |
| M8 | Fail-open error handling | `updateSession()` catch | Supabase error → pass through |
| M9 | `refundInvoice` doesn't zero `paid_amount` | `020_phase14_refund_function.sql:44` | Revenue reports include refunds |
| M10 | `referral_services` RLS with zero policies | `001_initial_schema.sql:712` | Silent empty results |
| M11 | `commission_rules` leaks rates | `014_phase13_commission_rules.sql:78` | Dealer sees other dealers' rates |
| M12 | `issueInvoice` race condition | `invoices.ts:224` | Double issue (idempotent) |

### LOW (7)

| ID | Finding | File |
|----|---------|------|
| L1 | `issueInvoice` double issue (idempotent) | `invoices.ts:224` |
| L2 | Commission false success (no rows_updated) | `commission.ts:247,399` |
| L3 | Permissions header trust | `middleware.ts` |
| L4 | Unused `z` import | `notifications.ts` |
| L5 | `get_app_test_ids()` missing search_path | `019_phase13_app_test_setup.sql:6` |
| L6 | No `.env.example` file | Project root |
| L7 | Raw `error.message` exposed | Multiple server actions |

---

## Test Gaps

| Area | Status | Risk |
|------|--------|------|
| RLS policies actual enforcement | NOT TESTED | HIGH |
| RBAC middleware enforcement | NOT TESTED | HIGH |
| Concurrency/race conditions | NOT TESTED | HIGH |
| IDOR/BOLA with real sessions | NOT TESTED | HIGH |
| Mass assignment with real requests | NOT TESTED | HIGH |
| CORS enforcement | NOT TESTED | MEDIUM |
| CSP effectiveness | NOT TESTED | MEDIUM |
| Rate limiting | NOT TESTED | MEDIUM |
| Session fixation | NOT TESTED | MEDIUM |
| XSS via form inputs | NOT TESTED | MEDIUM |

---

## Security Strengths

| Area | Evidence |
|------|----------|
| **RLS on 27+ tables** | All major tables have RLS enabled with role-based policies |
| **SECURITY DEFINER functions** | 25+ functions with `SET search_path = public` (except 11 in Phase 20) |
| **Audit logging** | 18-table audit system with IP tracking, old/new values |
| **Search injection prevention** | `sanitizeSearch()` in all server actions — escapes `%`, `_`, `(`, `)`, `.`, `*` |
| **Booking idempotency** | `create_booking` RPC has idempotency key with UNIQUE index |
| **Inventory atomicity** | All stock operations use RPCs with `current_stock >= p_quantity` inside atomic UPDATE |
| **Commission unique safety** | `UNIQUE(referral_id)` prevents double-commission |
| **Input validation** | 7/12 server action files use Zod schemas |
| **HTTPS enforcement** | HTTP→HTTPS redirect with HSTS (2yr + preload) |
| **Security headers** | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy |
| **CORS** | Same-origin check for API routes |
| **Pagination bounds** | All list endpoints with `MAX_PAGE_SIZE = 50` |
| **Dealer isolation (correct)** | `getMyReferrals`, `getMyCommissions` correctly scope by dealer_id |
| **Cleanup functions** | `cleanup_old_sessions()`, `cleanup_old_audit_logs()`, `cleanup_expired_refresh_tokens()` |
| **Guest booking rate limiting** | `checkRateLimit` prevents abuse on public booking |
| **Password policy** | 8+ chars, uppercase, lowercase, number required |

---

## Production Blockers

| # | Issue | Severity | Must Fix |
|---|-------|----------|----------|
| 1 | `/api/test/run-action` exposed in production | CRITICAL | Before launch |
| 2 | `staff.ts` mass assignment + no auth | CRITICAL | Before launch |
| 3 | Hardcoded DB password + service role key | CRITICAL | Before launch |
| 4 | `roles.ts` zero permission checks | CRITICAL | Before launch |
| 5 | RBAC tables without RLS | HIGH | Before launch |
| 6 | Dashboard functions accessible to anon | HIGH | Before launch |
| 7 | Fail-open auth on missing env vars | CRITICAL | Before launch |
| 8 | No login rate limiting | HIGH | Before launch |
| 9 | No CSRF protection | HIGH | Before launch |
| 10 | No max invoice amount cap | HIGH | Before launch |

---

## Recommended Fix Order

### Phase 20A — Immediate (Before Any Deployment)
1. **DELETE** `/api/test/run-action` — eliminates 76 unguarded actions
2. **ROTATE** all credentials — DB password, service role key, test passwords
3. **FIX** `staff.ts` — add Zod, field whitelist, `requirePermission('staff', 'create'/'update')`
4. **FIX** `roles.ts` — add `requirePermission('roles', 'read')` to all functions
5. **FIX** middleware fail-open — return 500 on missing env vars

### Phase 20B — Before Launch
6. **ADD** RLS to `roles`, `permissions`, `role_permissions` tables
7. **ADD** `REVOKE ... FROM anon` + `GRANT` to dashboard functions
8. **ADD** `SET search_path = public` to all 11 functions missing it
9. **ADD** login rate limiting (Supabase Edge Function or middleware)
10. **ADD** CSRF tokens for state-changing operations
11. **ADD** max invoice amount cap in Zod + SQL
12. **FIX** `requireAuth()` in dealer layout
13. **FIX** `redeemReferral` + `updateReferralStatus` ownership checks
14. **FIX** CORS to use domain allowlist

### Phase 20C — Post-Launch
15. **ADD** conditional WHERE clauses to all UPDATE operations (race conditions)
16. **REMOVE** `unsafe-inline` + `unsafe-eval` from CSP
17. **SET** `httpOnly: true` on all session cookies
18. **ADD** self-approval prevention in commission flow
19. **FIX** `refundInvoice` to zero `paid_amount`
20. **FIX** `commission_rules` dealer policy
21. **MOVE** hardcoded credentials to env vars in test/script files
22. **ADD** `.env.example`
