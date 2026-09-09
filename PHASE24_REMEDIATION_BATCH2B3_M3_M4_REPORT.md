# PHASE 24 BATCH 2B-3 — M3 & M4: Query Optimization

**Date:** 2026-09-07
**Status:** COMPLETE

---

## M3: getBookingStats — N+1 Query Elimination

### Problem
8 separate queries (one per status) + 1 auth = **9 total queries**.

```
for status in ['new', 'contacted', ...]:
    SELECT count(*) FROM bookings WHERE status = $1   ← 8 queries
```

### Solution
Single query to fetch all status values, count in JS.

```typescript
const { data } = await supabase.from('bookings').select('status')
// Count in JS: O(n) where n = total bookings
```

### Query Count: **9 → 2** (1 auth + 1 data)

### Evidence
| Metric | Before | After |
|--------|--------|-------|
| Queries | 9 | 2 |
| Time | 5,889ms | 496ms |
| Counts match | — | ✅ Exact match |
| Total | 7 | 7 |

### Changed File
`src/app/actions/bookings.ts` — `getBookingStats` function (lines 253-288)

---

## M4: getCurrentUser — Query Reduction via Nested Joins

### Problem
- Staff path: **3 queries** (auth + staff + role_permissions)
- Dealer path: **4-5 queries** (auth + staff miss + dealer + roles + role_permissions)

### Solution

**Staff path:** Replace 2 separate queries (staff + role_permissions) with 1 nested join:
```typescript
// Before: 2 queries
const { data: staff } = await admin.from('staff').select('...').eq('user_id', id)
const { data: rp } = await admin.from('role_permissions').select('...').eq('role_id', staff.role_id)

// After: 1 query
const { data: staff } = await admin.from('staff')
  .select('id, email, user_id, role_id, role, is_active, roles(role_permissions(permissions(resource, action)))')
  .eq('user_id', id)
```

**Dealer path:** Replace 2 separate queries (roles + role_permissions) with 1 nested join:
```typescript
// Before: 2 queries
const { data: dr } = await admin.from('roles').select('id').eq('name', 'dealer')
const { data: rp } = await admin.from('role_permissions').select('...').eq('role_id', dr.id)

// After: 1 query
const { data: dr } = await admin.from('roles')
  .select('id, role_permissions(permissions(resource, action))')
  .eq('name', 'dealer')
```

### Query Count
| Path | Before | After |
|------|--------|-------|
| Staff | 3 | 2 |
| Dealer | 4-5 | 3 |

### Evidence
| Metric | Staff Before | Staff After | Dealer Before | Dealer After |
|--------|-------------|-------------|---------------|--------------|
| Queries | 2 | 1 | 3 | 2 |
| Time | 816ms | 458ms | 1,395ms | 845ms |
| Permissions | 79 | 79 ✅ | 5 | 5 ✅ |

### User Isolation
- Admin permissions: 79
- Dealer permissions: 5
- Different users → different permission sets → no cache leakage ✅

### Unauthorized
- Anonymous → `getCurrentUser()` returns `null` ✅

### Changed File
`src/lib/auth.ts` — `getCurrentUser` function (lines 23-100)

---

## Callers Affected

| Caller | Impact |
|--------|--------|
| `getBookingStats()` callers (BookingsManager, ReportsManager) | None — same return shape |
| `getCurrentUser()` callers (all requireAuth, requirePermission, requireAdmin, check-staff route) | None — same return shape |
| `requireAuth()` | None — delegates to getCurrentUser |
| `requirePermission()` | None — delegates to getCurrentUser |
| `requireAdmin()` | None — delegates to getCurrentUser |

**No API or return shape changes. No callers broken.**

---

## Tests Executed

| # | Test | Result |
|---|------|--------|
| 1 | M3 counts match (old vs new) | ✅ |
| 2 | M3 total match | ✅ |
| 3 | M3 query reduction | ✅ 8 → 1 |
| 4 | M4 staff: id match | ✅ |
| 5 | M4 staff: email match | ✅ |
| 6 | M4 staff: role match | ✅ |
| 7 | M4 staff: is_active match | ✅ |
| 8 | M4 staff: permissions match | ✅ 79/79 |
| 9 | M4 staff: queries reduced | ✅ 2 → 1 |
| 10 | M4 dealer: id match | ✅ |
| 11 | M4 dealer: email match | ✅ |
| 12 | M4 dealer: role_id match | ✅ |
| 13 | M4 dealer: permissions match | ✅ 5/5 |
| 14 | M4 dealer: queries reduced | ✅ 3 → 2 |
| 15 | M4 isolation: admin vs dealer perms different | ✅ 79 vs 5 |
| 16 | M4 unauthorized: no user | ✅ |

---

## Regression

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors in `auth.ts` and `bookings.ts` |

---

## M3 STATUS: **COMPLETE**
## M4 STATUS: **COMPLETE**
