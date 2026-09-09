# PHASE 24 — REMEDIATION BATCH 2A REPORT

**Date:** 2026-09-07
**Findings:** H5 (unsafe-eval CSP), H6 (rate limiting)
**Status:** H6 DEPLOYED + VERIFIED | H5 SOURCE FIXED — PAYMENT RUNTIME NOT VERIFIED

---

## H5 — Remove `unsafe-eval` from CSP

| Aspect | Detail |
|--------|--------|
| Root Cause | CSP `script-src` included `'unsafe-eval'` with zero codebase usage |
| Codebase scan | 0 `eval()`, 0 `new Function()`, 0 string timers, 0 eval-requiring dependencies |
| Payment SDKs | Moyasar/Tamara/PayFort exist ONLY in CSP headers — no SDK code in source |
| Change | Removed `'unsafe-eval'` from `middleware.ts:78` |
| Status | **SOURCE FIXED — PAYMENT RUNTIME NOT VERIFIED** |

---

## H6 — Rate Limiting (Final Design v3)

### Architecture
- **Algorithm**: Fixed Window, epoch-aligned
- **Identity**: `auth.uid()` exclusively — no `p_user_id` parameter
- **Atomicity**: Single `INSERT ... ON CONFLICT DO UPDATE` — no race window
- **Table**: `rate_limits` with RLS denied for all direct access
- **Function**: SECURITY DEFINER, `search_path = public`
- **Client**: Authenticated server client only (`createClient()` from `@/utils/supabase/server`)

### Migration: `030_rate_limiting.sql`

```sql
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text
) RETURNS jsonb
```

- Single parameter only — no `p_window_seconds`, no `p_max_requests`
- `auth.uid()` is mandatory — raises exception if NULL
- Server-controlled CASE allowlist determines window/max per action
- Unknown actions → EXCEPTION
- Fixed window: `to_timestamp(floor(extract(epoch FROM now()) / v_window_seconds) * v_window_seconds)`
- Cleanup: bounded delete of own expired windows (max 10 rows per request)
- GRANT: `authenticated` only
- REVOKE: `anon`, `public`
- RLS: `USING (false) WITH CHECK (false)`

### Helper: `src/lib/rate-limit.ts`

```typescript
checkRateLimit(action: string): Promise<{ ok: boolean; error?: string }>
```

- Uses `createClient()` (authenticated, cookie-based) — NOT `getSupabaseAdmin()`
- Client-side allowlist for early fail-fast (SQL is source of truth)
- All actions fail-closed on infrastructure error
- Generic Arabic error messages only

### Rate Limits (Server-Controlled)

| Action | Window | Max | Source Function |
|--------|--------|-----|-----------------|
| `staff:create` | 60s | 10 | `createStaff` |
| `staff:update` | 60s | 10 | `updateStaff`, `toggleStaffStatus` |
| `bookings:update` | 60s | 30 | `updateBookingStatus` |
| `invoices:create` | 60s | 15 | `createInvoice` |
| `invoices:update` | 60s | 15 | `issueInvoice`, `cancelInvoice`, `updateInvoice`, `refundInvoice` |
| `payments:create` | 60s | 10 | `recordPayment` |
| `purchases:create` | 60s | 10 | `createPurchase` |
| `purchases:update` | 60s | 10 | `receivePurchase`, `cancelPurchase` |
| `materials:create` | 60s | 15 | `createMaterial` |
| `materials:update` | 60s | 15 | `updateMaterial`, `toggleMaterialActive` |

**10 actions. 0 dummy keys. Every key maps to a real function.**

---

## POST-DEPLOYMENT TEST RESULTS

### Test Suite: 12/12 PASSED

```
=== TEST 1: Under limit (expect ALLOWED) ===
  PASS: allowed=true, current=1, limit=10

=== TEST 2: At limit (expect ALLOWED) ===
  PASS: allowed=true, current=15, limit=15

=== TEST 3: Over limit (expect REJECTED) ===
  PASS: allowed=false, current=16, limit=15

=== TEST 4: User isolation (expect B allowed) ===
  PASS: user B allowed, current=1

=== TEST 5: Action isolation (expect independent) ===
  PASS: invoices:create independent, current=1, limit=15

=== TEST 6: Window expiry (60s window, waiting...) ===
  INFO: Rate limited at staff:create, waiting 61s for window reset...
  PASS: window expired, reset to current=1

=== TEST 7: Concurrency (20 parallel, limit 10) ===
  PASS: 10 allowed, 10 rejected

=== TEST 8: Anonymous (expect EXCEPTION) ===
  PASS: exception raised for anonymous

=== TEST 9: Unknown action (expect EXCEPTION) ===
  PASS: exception raised for unknown action

=== TEST 10: Empty action (expect EXCEPTION) ===
  PASS: exception raised for empty action

=== TEST 11: Service role (expect EXCEPTION) ===
  PASS: service role blocked

=== TEST 12: Cleanup check ===
  PASS: purchases:create works, current=1

=== RESULTS: 12 passed, 0 failed ===
```

### Security Verification

| Test | Result | Error Message | Source |
|------|--------|---------------|--------|
| Anonymous RPC | **REJECTED** | `permission denied for function check_rate_limit` | REVOKE GRANT |
| Service Role RPC | **REJECTED** | `Authentication required for rate limiting` | auth.uid() = NULL |
| Unknown Action | **REJECTED** | `Unknown rate limit action: totally_fake_action` | CASE ELSE |
| Empty Action | **REJECTED** | `Invalid action name` | length check |

### User Isolation (VERIFIED)

```
User A staff:create after 10: {"limit":10,"allowed":false,"current":11}
User B staff:create first call: {"limit":10,"allowed":true,"current":1}
Isolation: PASS
```

User A consuming 10+1 requests does NOT affect User B. User B starts at `current: 1`.

### Action Isolation (VERIFIED)

```
User A materials:create after 15: {"limit":15,"allowed":false,"current":16}
User A payments:create first call: {"limit":10,"allowed":true,"current":1}
Action isolation: PASS
```

`materials:create` counter is independent of `payments:create` counter.

### Concurrency (VERIFIED)

```
20 parallel requests, limit 10
Result: 10 allowed, 10 rejected
PASS
```

Atomic UPSERT correctly enforced the limit under concurrent load.

### RLS Verification

| Operation | Result | Evidence |
|-----------|--------|----------|
| Direct SELECT | **BLOCKED** | Returns empty `[]` (RLS USING(false) filters all rows) |
| Direct INSERT | **BLOCKED** | `new row violates row-level security policy for table "rate_limits"` |
| Direct DELETE | **BLOCKED** | Returns 0 rows affected (RLS USING(false) prevents matching) |

---

## Action Coverage (16/16)

| Function | File | Rate Limited? | Key |
|----------|------|---------------|-----|
| `createStaff` | staff.ts | YES | `staff:create` |
| `updateStaff` | staff.ts | YES | `staff:update` |
| `toggleStaffStatus` | staff.ts | YES | `staff:update` |
| `updateBookingStatus` | bookings.ts | YES | `bookings:update` |
| `createInvoice` | invoices.ts | YES | `invoices:create` |
| `issueInvoice` | invoices.ts | YES | `invoices:update` |
| `cancelInvoice` | invoices.ts | YES | `invoices:update` |
| `updateInvoice` | invoices.ts | YES | `invoices:update` |
| `refundInvoice` | invoices.ts | YES | `invoices:update` |
| `recordPayment` | payments.ts | YES | `payments:create` |
| `createPurchase` | purchases.ts | YES | `purchases:create` |
| `receivePurchase` | purchases.ts | YES | `purchases:update` |
| `cancelPurchase` | purchases.ts | YES | `purchases:update` |
| `createMaterial` | materials.ts | YES | `materials:create` |
| `updateMaterial` | materials.ts | YES | `materials:update` |
| `toggleMaterialActive` | materials.ts | YES | `materials:update` |

**16/16 write functions covered. 0 gaps.**

`roles.ts` — 4 functions, ALL read-only. No rate limiting needed.

---

## Caller Audit

```
bookings.ts:172: const rl = await checkRateLimit('bookings:update')
invoices.ts:178: const rl = await checkRateLimit('invoices:create')
invoices.ts:225: const rl = await checkRateLimit('invoices:update')
invoices.ts:278: const rl = await checkRateLimit('invoices:update')
invoices.ts:337: const rl = await checkRateLimit('invoices:update')
invoices.ts:384: const rl = await checkRateLimit('invoices:update')
materials.ts:148: const rl = await checkRateLimit('materials:create')
materials.ts:212: const rl = await checkRateLimit('materials:update')
materials.ts:291: const rl = await checkRateLimit('materials:update')
payments.ts:55: const rl = await checkRateLimit('payments:create')
purchases.ts:152: const rl = await checkRateLimit('purchases:create')
purchases.ts:249: const rl = await checkRateLimit('purchases:update')
purchases.ts:303: const rl = await checkRateLimit('purchases:update')
staff.ts:61: const rl = await checkRateLimit('staff:create')
staff.ts:116: const rl = await checkRateLimit('staff:update')
staff.ts:171: const rl = await checkRateLimit('staff:update')
```

| Check | Result |
|-------|--------|
| Total calls | 16 |
| Old-signature calls (2 args) | **0** |
| userId parameter calls | **0** |
| All single-argument | **16/16** |
| Auth → RL → Validation order | **16/16 correct** |
| Failed auth consuming quota | **No** (RL runs after auth) |

---

## Rate Limit Placement

All 16 functions follow: **auth → rate limit → validation/business logic**

| File | Auth Method | RL Placement | Correct? |
|------|-------------|-------------|----------|
| staff.ts | `requirePermission()` | After auth, before validation | YES |
| bookings.ts | `requireAuth()` + permission check | After auth, before status update | YES |
| invoices.ts | `requireAuth()` + permission check | After auth, before validation | YES |
| payments.ts | `requireAuth()` + permission check | After auth, before DB write | YES |
| purchases.ts | `requireAuth()` + permission check | After auth, before validation | YES |
| materials.ts | `requireAuth()` + permission check | After auth, before validation | YES |

---

## TSC / Build Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 8 pre-existing errors in admin components. 0 errors in Batch 2A files |
| `npm run build` | Same 8 pre-existing errors. No new errors |

### Pre-Existing Error Evidence

All 8 errors are `result.error` (type `string | undefined`) passed to `setNotification({ message: ... })` (expects `string`) in admin client components:

- `BookingsManager.tsx:184` — `setNotification({ type: 'error', message: result.error })`
- `InvoicesManager.tsx:179,198` — same pattern
- `MaterialsManager.tsx:119,124,133` — same pattern
- `PurchasesManager.tsx:115,137` — same pattern

**Proof these are NOT caused by Batch 2A:**
1. Zero `checkRateLimit` / `rate-limit` / `import.*rate` references in any of the 4 files
2. None of these files were modified by Batch 2A
3. The errors are type mismatches in `setNotification` calls — purely client-side UI code

---

## Code Review

### SQL (`030_rate_limiting.sql`)

| Check | Status |
|-------|--------|
| Single parameter (`p_action text`) | ✅ |
| No `p_window_seconds` / `p_max_requests` | ✅ |
| `auth.uid()` identity | ✅ Line 43 |
| NULL check on `auth.uid()` | ✅ Line 44 |
| Parameter validation | ✅ Line 49 |
| Server-controlled CASE allowlist | ✅ Lines 54-67 |
| Unknown action → EXCEPTION | ✅ Line 66 |
| Fixed window aligned to epoch | ✅ Lines 73-75 |
| Atomic UPSERT | ✅ Lines 78-82 |
| Bounded cleanup (LIMIT 10) | ✅ Lines 87-93 |
| Cleanup scoped to own key | ✅ Line 90 |
| SECURITY DEFINER | ✅ Line 30 |
| SET search_path = public | ✅ Line 31 |
| GRANT EXECUTE to authenticated | ✅ Line 104 |
| REVOKE from anon/public | ✅ Lines 105-106 |
| RLS enabled | ✅ Line 20 |
| RLS deny-all policy | ✅ Lines 22-23 |
| Unique index | ✅ Lines 17-18 |

### Helper (`src/lib/rate-limit.ts`)

| Check | Status |
|-------|--------|
| `'use server'` directive | ✅ Line 1 |
| Authenticated client only | ✅ `createClient()` (cookie-based, anon key) |
| No service role references | ✅ Zero matches |
| Client-side allowlist | ✅ Lines 13-24 |
| Single-arg RPC call | ✅ Line 36-38 |
| Fail-closed on error | ✅ Lines 40-43, 51-53 |
| Generic Arabic errors | ✅ Lines 31, 42, 47, 52 |

---

## FINAL STATUS

| Finding | Source | Database | Runtime | Tests |
|---------|--------|----------|---------|-------|
| **H5** | SOURCE FIXED | N/A | PAYMENT RUNTIME NOT VERIFIED | N/A |
| **H6** | VERIFIED | VERIFIED | VERIFIED | **12/12** |

**H6 = READY FOR DEPLOYMENT — DEPLOYED + VERIFIED**
