# Phase 19 — Independent Code Review Report

**Project:** Hima Protection — حماية العنوان  
**Date:** 2026-09-01  
**Reviewer:** Automated Security & Quality Audit  
**Scope:** Full codebase review — RLS, server actions, frontend, middleware, auth, concurrency, mass assignment, IDOR/BOLA

---

## Executive Summary

**Overall Security Rating: NEEDS REMEDIATION before production**

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 6 | Must fix before launch |
| HIGH | 7 | Must fix before launch |
| MEDIUM | 8 | Should fix before launch |
| LOW | 5 | Fix when possible |
| **Total** | **26** | |

**Key Risks:**
- An unguarded test endpoint exposes ALL 60+ server actions to any authenticated user with zero permission checks
- `staff.ts` has mass assignment + no permission checks + admin client bypass = privilege escalation
- `roles.ts` has zero permission checks — any user can enumerate all permissions
- Multiple concurrency race conditions in invoice cancellation, booking status, and purchase receiving
- Middleware fails open on missing env vars — misconfigured deployment has zero auth

---

## CRITICAL Findings (6)

### C1. `/api/test/run-action` — Unguarded Universal RPC Endpoint
**File:** `src/app/api/test/run-action/route.ts:18-601`  
**Severity:** CRITICAL

**Description:** A POST endpoint that accepts `{ action, args, accessToken }` and dynamically calls any of 60+ server actions with zero role/permission verification. Only validates the access token is a real Supabase user — does NOT check if they are staff, admin, or have any permission.

**Impact:** Any authenticated user (including dealer accounts) can:
- `approveCommission` / `payCommission` / `cancelCommission` — financial fraud
- `createStaff` / `updateStaff` — privilege escalation
- `getAuditLogs` — information disclosure
- `recordPayment` — financial manipulation
- `adjustStock` — inventory manipulation

**Remediation:** Delete this file entirely, or gate it behind `process.env.NODE_ENV === 'development'` + admin-only auth check.

---

### C2. `staff.ts` — Mass Assignment + No Permission Check + Admin Client
**File:** `src/app/actions/staff.ts:33-83`  
**Severity:** CRITICAL

**Description:**
- `createStaff` (line 33): No permission check. Any authenticated user can create staff with arbitrary `role` and `role_id` (no validation). Uses `getSupabaseAdmin()` bypassing RLS.
- `updateStaff` (line 62): Spreads `{...input}` directly into `.update()` with no field whitelist. No permission check. An attacker can inject `role: 'super_admin'`, `role_id: '<admin-uuid>'`, `email: 'attacker@evil.com'`.

**Exploit:** `updateStaff` accepts `{ full_name: "x", role: "super_admin", role_id: "<uuid>", email: "evil@hack.com" }` — privilege escalation to super_admin.

**Remediation:** Add Zod schema validation, field whitelist (like `dealer.ts` has), and `requirePermission('staff', 'create'/'update')` check.

---

### C3. `roles.ts` — Zero Permission Checks
**File:** `src/app/actions/roles.ts:5-66`  
**Severity:** CRITICAL

**Description:** All 4 functions (`getRoles`, `getRolePermissions`, `getAllPermissions`, `getStaffCountByRole`) call `requireAuth()` but never check permissions. Uses `getSupabaseAdmin()` for all queries. Any authenticated user can:
- Enumerate all roles and their names
- Enumerate every permission in the system with `{resource, action}` pairs
- Count staff per role

**Impact:** Full permission structure disclosure — attacker learns exactly which permissions exist and can plan targeted attacks.

**Remediation:** Add `requirePermission('roles', 'read')` to all functions. Restrict `getRolePermissions` to admin-only.

---

### C4. Fail-Open Auth on Missing Env Vars
**File:** `middleware.ts:23-25`  
**Severity:** CRITICAL

**Description:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset, the middleware calls `NextResponse.next()` — completely bypassing all authentication and session management.

**Impact:** A misconfigured deployment (common in CI/CD) runs with zero auth protection.

**Remediation:** Return `500 Internal Server Error` instead of passing through.

---

### C5. Host Header Injection in CORS
**File:** `middleware.ts:39`  
**Severity:** HIGH (elevated to CRITICAL due to auth implications)

**Description:** CORS origin is constructed as `https://${host}` where `host` comes from the request `Host` header. An attacker can inject an arbitrary Host header to bypass CORS restrictions.

**Remediation:** Use an allowlist of known domains instead of deriving from the request.

---

### C6. Commission Actions — No Ownership Scoping
**File:** `src/app/actions/commission.ts:201-430`  
**Severity:** HIGH (elevated to CRITICAL due to financial impact)

**Description:** `approveCommission`, `cancelCommission`, `payCommission` accept a `commissionId` and operate on it with only a permission check — no dealer ownership validation. A staff user with `commissions:approve` can approve any dealer's commission.

**Remediation:** Add dealer ownership check or verify the commission's dealer_id matches the user's scope.

---

## HIGH Findings (7)

### H1. `updateBookingStatus` — Lost Update Race Condition
**File:** `src/app/actions/bookings.ts:179-201`  
**Severity:** HIGH

**Description:** Read-then-write without conditional WHERE. Two concurrent requests can both read `status='new'`, both validate transitions, and both succeed — the second silently overwrites the first.

**Fix:** Add `AND status = <expected>` to the UPDATE WHERE clause, check `rows_updated`.

---

### H2. `cancelInvoice` — Race with Issue/Payment
**File:** `src/app/actions/invoices.ts:274-301`  
**Severity:** HIGH

**Description:** `cancelInvoice` reads status without lock, then does unconditional UPDATE `SET status='cancelled'`. A concurrent `issueInvoice` or `recordPayment` can commit between the read and write, causing the cancel to overwrite the paid/issued status. Financial data corruption.

**Fix:** Add `AND status IN ('draft','issued')` to the UPDATE WHERE clause.

---

### H3. `cancelPurchase` — Race with `receivePurchase` RPC
**File:** `src/app/actions/purchases.ts:296-315`  
**Severity:** HIGH

**Description:** `cancelPurchase` does read-then-write without lock. `receivePurchase` uses `FOR UPDATE` inside its RPC. Race: cancel reads `draft`, receive locks+processes+commits `received`, cancel overwrites to `cancelled`. Inventory increased but purchase says cancelled — silent data inconsistency.

**Fix:** Add `AND status = 'draft'` to cancel UPDATE WHERE clause.

---

### H4. `referral.ts` — Cross-Dealer Referral Access
**File:** `src/app/actions/referral.ts:460-681`  
**Severity:** HIGH

**Description:** `redeemReferral`, `updateReferralStatus`, `getReferral` accept a `referralId` and query `.eq("id", referralId)` without also filtering by `dealer_id`. A staff user with `referrals:update` can redeem/modify any dealer's referral.

**Fix:** Add `.eq("dealer_id", dealerId)` for dealer-scoped users, or verify staff has permission to act on that dealer.

---

### H5. CORS Bypass for Webhook/Callback Paths
**File:** `middleware.ts:31-34`  
**Severity:** HIGH

**Description:** `/api/moyasar/*`, `/api/tamara/*`, `/api/otp/sms-webhook` are exempt from CORS checks. If these endpoints accept mutations (e.g., payment confirmations), they're vulnerable to cross-origin requests.

**Fix:** Verify these are truly read-only or add CSRF token validation.

---

### H6. Session Cookie `httpOnly: false` in Test Route
**File:** `src/app/api/test/run-action/route.ts:54`  
**Severity:** HIGH

**Description:** The session cookie is set with `httpOnly: false`, making it readable by JavaScript. If any XSS exists, the session token is trivially stolen.

**Fix:** Set `httpOnly: true` on all session cookies.

---

### H7. CSP Includes `unsafe-inline` and `unsafe-eval`
**File:** `middleware.ts` (CSP header)  
**Severity:** HIGH

**Description:** The Content Security Policy includes `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, which significantly weakens XSS protection.

**Fix:** Remove unsafe directives, use nonce-based or hash-based CSP for inline scripts.

---

## MEDIUM Findings (8)

### M1. Double-Booking — No Slot Uniqueness Constraint
**File:** `supabase/migrations/001_initial_schema.sql` (bookings table)  
**Severity:** MEDIUM

**Description:** No unique constraint on `(service_id, preferred_date, preferred_time)`. Two concurrent booking requests for the same slot both succeed. Rate limiting only checks phone number frequency, not slot occupancy.

**Fix:** Add partial unique index: `CREATE UNIQUE INDEX ON bookings (service_id, preferred_date, preferred_time) WHERE status NOT IN ('cancelled', 'no_show')`.

---

### M2. `issueInvoice` Double-Issue Race
**File:** `src/app/actions/invoices.ts:224-243`  
**Severity:** MEDIUM

**Description:** Read-then-write without conditional WHERE. Two concurrent `issueInvoice` calls both succeed (idempotent but creates duplicate audit entries).

**Fix:** Add `AND status = 'draft'` to UPDATE WHERE clause.

---

### M3. Commission Approve/Pay False Success
**File:** `src/app/actions/commission.ts:247,399`  
**Severity:** MEDIUM

**Description:** Uses conditional UPDATE with status in WHERE (correct), but doesn't check `rows_updated`. Second concurrent request returns `{ success: true }` even though it was a no-op. Misleading UI feedback.

**Fix:** Check `rows_updated` and return error if 0.

---

### M4. No Rate Limiting on Sensitive Endpoints
**Severity:** MEDIUM

**Description:** No rate limiting on login, booking creation, referral creation, or the test endpoint. Brute-force and flooding attacks are possible.

**Fix:** Add rate limiting middleware (e.g., `express-rate-limit` pattern or Supabase Edge Function).

---

### M5. No Storage Bucket Policies
**Severity:** MEDIUM

**Description:** No `storage.buckets` or `storage.objects` policies found anywhere in migrations. If Supabase Storage is used for file uploads (avatars, service images), the default policies may be overly permissive.

**Fix:** Define explicit storage bucket policies with auth checks.

---

### M6. Permissions Header Trust
**File:** `src/utils/supabase/middleware.ts:90`  
**Severity:** MEDIUM

**Description:** `x-permissions` header is set server-side by middleware but could be forwarded or tampered with by client-side code if Server Actions read these headers.

**Fix:** Server Actions should resolve permissions from the database, not trust forwarded headers.

---

### M7. Fail-Open Error Handling in Middleware
**File:** `src/utils/supabase/middleware.ts:94-102`  
**Severity:** MEDIUM

**Description:** On any auth middleware error, non-admin routes silently pass through (`NextResponse.next()`). A Supabase connectivity error would bypass session refresh.

**Fix:** Return 500 for all routes on middleware error (fail-closed).

---

### M8. Unused `z` Import in `notifications.ts`
**File:** `src/app/actions/notifications.ts`  
**Severity:** LOW (code quality)

**Description:** `import { z } from 'zod'` is imported but never used. Dead code.

**Fix:** Remove unused import.

---

## LOW Findings (5)

### L1. No `.env.example` File
**Severity:** LOW  
**Description:** No template for environment variables. New developers have no reference.  
**Fix:** Create `.env.example` with placeholder values.

---

### L2. Hardcoded Project Ref in Test Route
**File:** `src/app/api/test/run-action/route.ts:7`  
**Severity:** LOW  
**Description:** `PROJECT_REF = "nzspowfxwntxfievmmxq"` is hardcoded.  
**Fix:** Derive from env var.

---

### L3. `next.config.ts` is Empty
**Severity:** LOW  
**Description:** No security headers, redirects, or rewrites configured. All security is in middleware.  
**Fix:** Consider adding `headers()` in next.config for defense-in-depth.

---

### L4. Raw `error.message` Exposed
**Severity:** LOW  
**Description:** Several actions return raw `error.message` from Supabase to the client (e.g., `roles.ts`, `staff.ts`). May leak internal DB structure.  
**Fix:** Return generic Arabic error messages.

---

### L5. No `supabase/config.toml`
**Severity:** LOW  
**Description:** No local Supabase configuration file.  
**Fix:** Add for local development consistency.

---

## Positive Findings

| Category | Details |
|----------|---------|
| **RBAC Architecture** | Solid 3-table design: `staff.role_id → roles → role_permissions → permissions`. 7 roles, 79 permissions, properly normalized. |
| **RLS Policies** | All 18 tables have RLS enabled with permissive/role-based policies. Proper `auth.uid()` matching in customer, booking, notification policies. |
| **Security Definer Functions** | 8 RPC functions with `SECURITY DEFINER` + `SET search_path = public` — proper privilege isolation for critical operations. |
| **Audit Logging** | 18-table audit system with IP tracking, old/new values diff, auto-cleanup via `cleanup_old_audit_logs()`. |
| **Input Validation** | 7 of 12 server action files use Zod schemas. `dealer.ts` has exemplary `ALLOWED_FIELDS` whitelist pattern. |
| **Search Injection Prevention** | `sanitizeSearch()` properly escapes `%`, `_`, `(`, `)`, `.`, `*`, `,` in all server actions. |
| **Booking Idempotency** | `create_booking` RPC has idempotency key with UNIQUE index, rate limiting, and atomic insert. |
| **Inventory Atomicity** | All stock operations use RPCs with `current_stock >= p_quantity` checks inside atomic UPDATE — no race conditions. |
| **Commission Unique Safety** | `UNIQUE(referral_id)` prevents double-commission creation. State machine enforces valid transitions. |
| **Middleware Security Headers** | HSTS (2yr + preload), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy all properly set. |
| **HTTPS Enforcement** | Automatic HTTP→HTTPS redirect (except localhost). |
| **Dealer Isolation (Correct)** | `getMyReferrals`, `getMyReferralStats`, `getMyCommissions`, `getMyCommissionStats` all correctly scope by `dealer_id` derived from current user. |
| **Pagination** | All list endpoints support pagination with `MAX_PAGE_SIZE = 50` bounds. |
| **Password Policy** | 8+ chars, uppercase, lowercase, number required via Supabase config. |
| **Cleanup Functions** | `cleanup_old_sessions()`, `cleanup_old_audit_logs()`, `cleanup_expired_refresh_tokens()` — automated data retention. |

---

## Test Coverage Gaps

| Area | Status | Risk |
|------|--------|------|
| RBAC middleware enforcement | Not tested (only server actions tested) | HIGH |
| RLS policies | Not tested (only app-level auth tested) | HIGH |
| Concurrency/race conditions | Not tested | HIGH |
| IDOR/BOLA | Not tested | HIGH |
| Mass assignment | Not tested | HIGH |
| Input validation (Zod) | Not tested | MEDIUM |
| Pagination bounds | Not tested | LOW |
| Error handling paths | Not tested | MEDIUM |
| CORS enforcement | Not tested | MEDIUM |
| CSP effectiveness | Not tested | MEDIUM |

---

## Technical Debt

| Item | Priority | Effort |
|------|----------|--------|
| Remove `test/run-action` endpoint or gate behind dev-only auth | CRITICAL | Small |
| Add Zod + field whitelist + permission check to `staff.ts` | CRITICAL | Small |
| Add permission checks to `roles.ts` | CRITICAL | Small |
| Add conditional WHERE clauses to all UPDATE operations (invoices, bookings, purchases, commissions) | HIGH | Medium |
| Add application-level ownership checks as defense-in-depth | HIGH | Medium |
| Fix middleware fail-open patterns | HIGH | Small |
| Fix CORS origin derivation | HIGH | Small |
| Add rate limiting | MEDIUM | Medium |
| Add storage bucket policies | MEDIUM | Small |
| Create `.env.example` | LOW | Small |
| Remove unused imports | LOW | Small |

---

## Production Blockers

| # | Issue | Severity | Must Fix Before |
|---|-------|----------|-----------------|
| 1 | `/api/test/run-action` exposed | CRITICAL | Launch |
| 2 | `staff.ts` mass assignment + no auth | CRITICAL | Launch |
| 3 | `roles.ts` no permission checks | CRITICAL | Launch |
| 4 | Middleware fail-open on missing env | CRITICAL | Launch |
| 5 | Race conditions in financial operations | HIGH | Launch |
| 6 | No CORS allowlist for webhooks | HIGH | Launch |
| 7 | `unsafe-inline` + `unsafe-eval` in CSP | HIGH | Launch |

---

## Recommended Fix Order

1. **Delete `/api/test/run-action`** — eliminates 60+ unguarded actions instantly
2. **Fix `staff.ts`** — add Zod, field whitelist, permission check
3. **Fix `roles.ts`** — add permission checks
4. **Fix middleware fail-open** — return 500 on missing env
5. **Fix CORS** — use domain allowlist
6. **Add conditional WHERE to all UPDATE operations** — prevents race conditions
7. **Add rate limiting** — prevents abuse
8. **Set `httpOnly: true`** on session cookies
9. **Remove `unsafe-inline`/`unsafe-eval`** from CSP
10. **Add storage bucket policies** if file uploads are used
