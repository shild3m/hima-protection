# PHASE 24 BATCH 2B-4 — M10 & M11

**Date:** 2026-09-07
**Status:** COMPLETE

---

## M10: service_role in services path

### Problem
`src/app/actions/services.ts` created its own `supabaseAdmin` instance at module load time using `createClient()` from `@supabase/supabase-js` with the service role key. This was inconsistent with the rest of the codebase which uses `getSupabaseAdmin()` from `@/lib/auth`.

### Analysis
- **Authorization checks**: All 6 functions (getServices, getService, createService, updateService, toggleServiceStatus, deleteService) have `requireAuth()` + permission checks before every DB operation ✅
- **service_role usage**: Server-side only, never exposed to client ✅
- **Why service_role is justified**: No RLS policies for admin CRUD on services table. Service_role bypasses RLS to allow admin operations.
- **Risk**: If authorization check has a bug, service_role allows unauthorized access. This is acceptable since authorization checks are the primary defense.

### Change
```diff
- import { createClient } from '@supabase/supabase-js'
- import { requireAuth } from '@/lib/auth'
- const supabaseAdmin = createClient(
-   process.env.NEXT_PUBLIC_SUPABASE_URL!,
-   process.env.SUPABASE_SERVICE_ROLE_KEY!
- )
+ import { requireAuth, getSupabaseAdmin } from '@/lib/auth'
```

All `supabaseAdmin` references replaced with `getSupabaseAdmin()` calls.

### Changed File
`src/app/actions/services.ts`

---

## M11: getMyCommissions — service_role / RLS

### Problem
`getMyCommissions` and `getMyCommissionStats` in `src/app/actions/commission.ts` used `getSupabaseAdmin()` (service_role) to look up the dealer record, even though the authenticated client could read it via RLS.

### Analysis
- **Current flow**: Auth check → service_role dealer lookup → authenticated client commission query
- **Issue**: Service_role for dealer lookup bypasses RLS unnecessarily. The dealer lookup filters by `user_id = auth.uid()`, which the authenticated client can do directly.
- **RLS verification**: Anonymous users see 0 rows on dealers and commissions tables. RLS is enforced.
- **Cross-dealer isolation**: Dealer A cannot see Dealer B's commissions (verified by test).

### Change
```diff
// getMyCommissions (line 492)
- const admin = getSupabaseAdmin();
- const { data: dealer } = await admin
+ const { data: dealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

// getMyCommissionStats (line 561)
- const admin = getSupabaseAdmin();
- const { data: dealer } = await admin
+ const { data: dealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
```

### Changed File
`src/app/actions/commission.ts`

### Remaining service_role usages (legitimate)
| Function | Usage | Justification |
|----------|-------|---------------|
| writeAuditLog | audit_logs insert | Audit logs need bypass RLS |
| createCommissionRule | commission_rules insert | Admin CRUD |
| updateCommissionRule | commission_rules update | Admin CRUD |
| getCommissionMonthlyReport | commissions/dealers/referrals read | Admin reports |

---

## Tests Executed

| # | Test | Result |
|---|------|--------|
| 1 | services.ts uses getSupabaseAdmin() | ✅ |
| 2 | services.ts has requireAuth() on all functions | ✅ |
| 3 | services.ts has permission checks on all functions | ✅ |
| 4 | No service_role in client/browser code | ✅ |
| 5 | Dealer -> own dealer record | ✅ |
| 6 | Dealer -> own commissions | ✅ |
| 7 | All commissions belong to dealer | ✅ |
| 8 | Dealer -> OTHER commissions | ✅ (0 rows) |
| 9 | Cannot see other dealer commissions | ✅ |
| 10 | Unauthorized: no user | ✅ |
| 11 | Anonymous -> commissions blocked by RLS | ✅ |

---

## Regression

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |

---

## M10 STATUS: **COMPLETE**
## M11 STATUS: **COMPLETE**
