# PHASE 24 — Remediation Batch 1 Report

**Date:** 2026-09-04
**Target Findings:** C1, C2, C3, H1, H2, H3, H4
**Status:** ✅ COMPLETE — TypeScript PASS, Build PASS (48 pages)

---

## C1 — Fix requireAdmin()

**File:** `src/lib/auth.ts:132-139`

**Root cause:** `requireAdmin()` only checked `getCurrentUser()` returned non-null. Any authenticated staff member (receptionist, technician, accountant) passed the admin guard.

**Fix:** Added explicit role_name check — only `super_admin` and `admin` are allowed. All other roles receive HTTP 403.

**Before:**
```typescript
export async function requireAdmin() {
  const currentUser = await getCurrentUser()
  if (!currentUser) { return NextResponse.json({ error: 'غير مصرح' }, { status: 401 }) }
  return { user: currentUser, role: currentUser.role_name }
}
```

**After:**
```typescript
export async function requireAdmin() {
  const currentUser = await getCurrentUser()
  if (!currentUser) { return NextResponse.json({ error: 'غير مصرح' }, { status: 401 }) }
  if (currentUser.role_name !== 'super_admin' && currentUser.role_name !== 'admin') {
    return NextResponse.json({ error: 'غير مصرح — الصلاحيات غير كافية' }, { status: 403 })
  }
  return { user: currentUser, role: currentUser.role_name }
}
```

**Security impact:** Receptionist, technician, accountant, inventory_manager, dealer roles are now blocked from admin routes at the server level.

---

## C2 — Remove /api/test/run-action

**File:** `src/app/api/test/run-action/route.ts`

**Root cause:** Universal action dispatcher that could invoke any of 79 server actions. Protected only by `NODE_ENV === 'production'` check — if misconfigured, any authenticated user could call any action.

**Fix:** Replaced entire file with a stub that unconditionally returns 404 for both GET and POST. No action dispatch code remains. No ACTION_MAP, no dynamic imports, no service-role key usage.

**After:**
```typescript
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 })
}
export async function GET() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 })
}
```

**Security impact:** Universal action proxy is completely eliminated. No executable dispatch path remains.

---

## C3 — Fix audit logs authorization

**File:** `src/app/actions/audit-logs.ts`

**Root cause:** `getAuditLogs` used `requireAuth()` only — any authenticated user (including dealers) could read all audit logs. Search parameter was interpolated into `.or()` without sanitization.

**Fix:**
1. Replaced `requireAuth()` with `requirePermission('audit_logs', 'read')`
2. Added search parameter sanitization (trim + escape `%` and `_`)
3. Replaced raw `error.message` and `(e as Error).message` with generic Arabic messages
4. Added `console.error` for server-side logging

**Security impact:** Only users with `audit_logs:read` permission can access audit logs. Search injection vector is mitigated.

---

## H1 — Dashboard chart permissions

**File:** `src/app/actions/dashboard.ts`

**Root cause:** `getRevenueChartData`, `getBookingsChartData`, `getServicesChartData`, `getDealerPerformanceData`, `getInventoryChartData` used `resolveUser()` (which only calls `requireAuth()`) — any authenticated staff member could access all analytics.

**Fix:** Replaced `resolveUser()` with specific `requirePermission()` calls:

| Function | Permission Required |
|----------|-------------------|
| `getRevenueChartData` | `invoices:read` |
| `getBookingsChartData` | `bookings:read` |
| `getServicesChartData` | `bookings:read` |
| `getDealerPerformanceData` | `dealers:read` |
| `getInventoryChartData` | `materials:read` |

Added `requirePermission` to the import from `@/lib/auth`.

**Security impact:** Dashboard analytics are now gated behind specific permissions. Users without the required permission are redirected to login.

---

## H2 — Sanitize error messages

**Files:** `src/app/actions/staff.ts`, `src/app/actions/roles.ts`, `src/app/actions/dashboard.ts`

**Root cause:** Raw `(e as Error).message` and `error.message` returned to client in catch blocks, potentially exposing table names, SQL fragments, constraint names, and stack traces.

**Fix:** All client-facing error responses replaced with generic Arabic messages:

| File | Before | After |
|------|--------|-------|
| `staff.ts` | `error.message` (4 locations) | `'تعذر جلب بيانات الموظفين'`, `'تعذر إنشاء الموظف'`, `'تعذر تحديث بيانات الموظف'`, `'تعذر تحديث حالة الموظف'` |
| `staff.ts` | `(e as Error).message` (4 locations) | `'حدث خطأ غير متوقع'` |
| `roles.ts` | `error.message` (4 locations) | `'تعذر جلب الأدوار'`, `'تعذر جلب صلاحيات الدور'`, `'تعذر جلب الصلاحيات'`, `'تعذر جلب عدد الموظفين'` |
| `roles.ts` | `(e as Error).message` (4 locations) | `'حدث خطأ غير متوقع'` |
| `dashboard.ts` | `err.message` / `(e as Error).message` (7 locations) | `'حدث خطأ غير متوقع'` |

Also fixed a bug in `toggleStaffStatus`: referenced `result` instead of `data`, and error message said "إنشاء" instead of "تحديث".

**Security impact:** No database internals, table names, or SQL errors exposed to clients.

---

## H3 — /api/check-staff response

**File:** `src/app/api/check-staff/route.ts`

**Root cause:** Response included `name` field (redundant — client already has it from Supabase auth).

**Fix:** Removed `name` from response. Kept `isStaff`, `role`, and `permissions` (permissions are required by `AuthProvider.tsx` for client-side UI rendering via `hasPermission()`).

**Note:** The `permissions` array is retained because `AuthProvider.tsx` uses it for `hasPermission()` — a client-side UI helper that controls element visibility. All real authorization enforcement happens server-side via `requirePermission()`. The client permissions are UI-only and do not grant any access.

**Security impact:** Minimal — reduced information surface. `permissions` array remains but is not a privilege escalation vector.

---

## H4 — Booking status DB trigger

**File:** `supabase/migrations/029_booking_status_trigger.sql` (NEW)

**Root cause:** Booking status transitions were enforced only at the application level (`bookings.ts:12-21`). No database trigger existed, unlike commissions and invoices which both have triggers.

**Fix:** Created `enforce_booking_status_transition()` function + trigger following the exact pattern of `enforce_commission_status_transition` and `enforce_invoice_status_transition`.

**Valid transitions (mirroring application code):**
```
new         → contacted, cancelled
contacted   → confirmed, cancelled
confirmed   → arrived, cancelled, no_show
arrived     → in_progress, cancelled
in_progress → completed
completed   → (terminal)
cancelled   → (terminal)
no_show     → (terminal)
```

**Function properties:**
- `SECURITY DEFINER` ✅
- `SET search_path = public` ✅
- `BEFORE UPDATE OF status` trigger ✅
- Rejects invalid status values ✅
- Rejects invalid transitions ✅
- No-op if status unchanged ✅

**Security impact:** Invalid booking status transitions are now rejected at the database level, regardless of which code path attempts the update. Defense-in-depth with the application-level check.

**Migration must be applied via Supabase Dashboard SQL Editor.**

---

## Verification

```
npx tsc --noEmit    → PASS (zero errors)
npm run build       → PASS (48 pages, 0 errors)
```

### Regression Check

| Fix | Still Present |
|-----|--------------|
| Phase 22 CRM auth guard | ✅ |
| Phase 22 dealer isolation | ✅ |
| Phase 22 migrations 027/028 | ✅ |
| Phase 23 sitemap/robots/JSON-LD | ✅ |
| Phase 23 service-utils.ts boundary | ✅ |
| Phase 23 not-found/loading | ✅ |
| Phase 23 dynamic imports | ✅ |

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/auth.ts` | requireAdmin() — added role_name check |
| `src/app/api/test/run-action/route.ts` | Replaced with 404 stub |
| `src/app/actions/audit-logs.ts` | Added requirePermission + sanitized search + generic errors |
| `src/app/actions/dashboard.ts` | Added requirePermission to 5 chart functions + sanitized 7 error messages |
| `src/app/actions/staff.ts` | Sanitized 8 error messages + fixed toggleStaffStatus bug |
| `src/app/actions/roles.ts` | Sanitized 8 error messages |
| `src/app/api/check-staff/route.ts` | Removed `name` from response |
| `supabase/migrations/029_booking_status_trigger.sql` | NEW — booking status trigger |

---

## Remaining Phase 24 Findings

| # | Finding | Severity | Batch |
|---|---------|----------|-------|
| H5 | `'unsafe-eval'` in CSP | HIGH | Batch 2 |
| H6 | No rate limiting on authenticated actions | HIGH | Batch 2 |
| M1 | CRM/dealer routes have no middleware-level auth | MEDIUM | Batch 2 |
| M2 | `updateBookingStatus` TOCTOU race (no conditional `.eq('status', old)`) | MEDIUM | Batch 2 |
| M3 | `getBookingStats` N+1 query (8 sequential) | MEDIUM | Batch 2 |
| M4 | `getCurrentUser()` 3-4 queries per request, no caching | MEDIUM | Batch 2 |
| M5 | Service slugs missing from sitemap | MEDIUM | Batch 2 |
| M6 | No `LocalBusiness` JSON-LD | MEDIUM | Batch 2 |
| M7 | JSON-LD `logo` points to nonexistent file | MEDIUM | Batch 2 |
| M8 | `createNotification` / `createNotificationsForRole` no auth | MEDIUM | Batch 2 |
| M9 | No `og:image` anywhere | MEDIUM | Batch 2 |
| M10 | `/contact`, `/booking`, `/dealers` missing metadata | MEDIUM | Batch 2 |
| C4 | No favicon or og:image | CRITICAL | Batch 2 |

**Note:** C4 (favicon/og:image) is classified as CRITICAL in the audit but is a UX/SEO issue, not a security issue. It is addressed in the deployment readiness checklist.

---

## PHASE 24 REMEDIATION BATCH 1 STATUS: COMPLETE
