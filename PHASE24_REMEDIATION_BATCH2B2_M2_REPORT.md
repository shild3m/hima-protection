# PHASE 24 BATCH 2B-2 — M2: TOCTOU Race in updateBookingStatus

**Date:** 2026-09-07
**Finding:** M2 — TOCTOU Race Condition
**Status:** COMPLETE

---

## Changed File

`src/app/actions/bookings.ts` — `updateBookingStatus` function only

---

## Exact Change

### Before (lines 201-206):

```typescript
const { data, error } = await supabase
  .from('bookings')
  .update({ status: newStatus })
  .eq('id', id)
  .select()
  .single()

if (error) {
  console.error('Update booking status error:', error)
  return { success: false as const, error: 'تعذر تحديث حالة الحجز' }
}
```

### After (lines 201-216):

```typescript
const { data, error } = await supabase
  .from('bookings')
  .update({ status: newStatus })
  .eq('id', id)
  .eq('status', existing.status)
  .select()
  .single()

if (error) {
  console.error('Update booking status error:', error)
  return { success: false as const, error: 'تعذر تحديث حالة الحجز' }
}

if (!data) {
  return { success: false as const, error: 'الحجز غير موجود أو تغيرت الحالة منذ قرائتها' }
}
```

### Changes Summary:

1. Added `.eq('status', existing.status)` — UPDATE is now conditional on current DB status matching what was validated
2. Added `if (!data)` check after UPDATE — detects when 0 rows affected (status changed between read and update)

---

## How TOCTOU Is Prevented

### Before (Vulnerable):

```
Request A: READ status='new' ✓ → VALIDATE 'new'→'contacted' ✓ → UPDATE WHERE id=X → succeeds
Request B: READ status='new' ✓ → VALIDATE 'new'→'cancelled' ✓ → UPDATE WHERE id=X → succeeds
                                                         ↑ RACE: B doesn't see A's update
```

### After (Fixed):

```
Request A: READ status='new' ✓ → VALIDATE 'new'→'contacted' ✓ → UPDATE WHERE id=X AND status='new' → succeeds
Request B: READ status='new' ✓ → VALIDATE 'new'→'cancelled' ✓ → UPDATE WHERE id=X AND status='new' → 0 rows (status is now 'contacted')
                                                                                                    ↑ Detected: data=null → error returned
```

### Database-Level Enforcement:

The `.eq('status', existing.status)` clause translates to SQL:
```sql
UPDATE bookings SET status = $1 WHERE id = $2 AND status = $3
```

If the status changed between READ and UPDATE:
- The `WHERE status = $3` clause matches 0 rows
- Supabase returns `data: null` (via `.single()`)
- The `if (!data)` check catches this and returns error

**No JavaScript-level assumption** — the protection is enforced at the database level.

---

## Caller Review

| File | Line | Usage | Safe? |
|------|------|-------|-------|
| `components/admin/BookingsManager.tsx` | 174-185 | Calls `updateBookingStatus`, checks `result.success`, shows notification | ✅ |

The single caller already handles `result.success === false` by showing an error notification. The new "status changed" error will display correctly.

---

## Test Scenarios

### 1. Valid transition (new → contacted)
- **READ**: status='new'
- **VALIDATE**: 'new' → 'contacted' = allowed
- **UPDATE**: `WHERE id=X AND status='new'` → matches 1 row
- **Result**: SUCCESS

### 2. Invalid transition (completed → new)
- **READ**: status='completed'
- **VALIDATE**: 'completed' → 'new' = not in VALID_TRANSITIONS['completed']
- **Result**: Rejected BEFORE UPDATE with "لا يمكن تغيير الحالة من..."

### 3. Race condition (concurrent update)
- **Request A**: READ status='new' → UPDATE WHERE status='new' → succeeds
- **Request B**: READ status='new' → UPDATE WHERE status='new' → 0 rows → `data=null`
- **Result**: "الحجز غير موجود أو تغيرت الحالة منذ قرائتها"

### 4. Booking deleted between read and update
- **READ**: exists with status='new'
- **UPDATE**: `WHERE id=X AND status='new'` → 0 rows (deleted)
- **Result**: `data=null` → "الحجز غير موجود أو تغيرت الحالة منذ قرائتها"

### 5. Unauthorized user
- **requireAuth()** check at line 167 → redirect if no session
- **permission check** at line 168 → 'غير مصرح' if no bookings:update
- Never reaches UPDATE

---

## Regression

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors in `bookings.ts` |

---

## M2 STATUS: **COMPLETE**
