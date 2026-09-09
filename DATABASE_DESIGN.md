# PHASE 02 FINAL — DATABASE DESIGN (Reviewed & Corrected)
# منصة تظليل وحة السيارات — تصميم قاعدة البيانات

---

## CHANGES MADE (Phase 02 → Phase 02B → Phase 02 FINAL)

### Phase 02B Changes

| # | Issue | Before | After | Reason |
|---|-------|--------|-------|--------|
| 1 | Public Access Security | `WITH CHECK (true)` on bookings, customers, vehicles | **Removed all public INSERT policies**. All mutations go through Server Actions. | Browser is untrusted. Server validates and controls all DB operations. |
| 2 | RBAC | Role in `staff.role` only | **Kept simple** — `staff.role` for staff, `dealers` table for dealers. No separate roles/permissions tables in V1. | Simple and sufficient. Extensible by adding tables later without breaking changes. |
| 3 | User Model | `auth.users → profiles → staff/dealers` | **Clarified**: auth.users = identity, profiles = app data, staff = role, dealers = separate access. No role in profiles. | Single source of truth for role (staff.role or dealer existence). |
| 4 | Referral Vehicle FK | `vehicle_id uuid` (no FK) | **Added** `REFERENCES public.vehicles(id) ON DELETE SET NULL` | Proper referential integrity. |
| 5 | Customer Phone Unique | `UNIQUE(phone)` | **Kept** — documented decision | One customer = one phone. If phone changes → UPDATE. Appropriate for car service business. |
| 6 | Booking Model | `service_id` + `booking_items` | **Kept and documented** | service_id = primary service (required). booking_items = additional services (optional). Not redundant. |
| 7 | Booking Idempotency | `phone + date + service` as key | **Changed**: client-generated UUID as idempotency_key | Client generates UUID per request. Same key = same request. Prevents retries, not prevents valid different bookings. |
| 8 | Payment Idempotency | `timestamp + random` | **Changed**: client-generated UUID as idempotency_key | Same pattern as bookings. Reliable duplicate prevention. |
| 9 | Payment Concurrency | No protection | **Documented**: `SELECT ... FOR UPDATE` on invoice + atomic validation | Row lock prevents concurrent payments from overpaying. |
| 10 | Invoice Integrity | Values could come from browser | **Documented**: All financial values calculated server-side. Invoice items are price snapshots. | Prices stored at invoice creation time never change. |
| 11 | Inventory Architecture | current_stock could be inconsistent | **Documented**: current_stock = cached balance. Source of truth = inventory_transactions. Atomic UPDATE with stock check. | `UPDATE materials SET current_stock = current_stock - qty WHERE current_stock >= qty` prevents negative stock atomically. |
| 12 | Inventory Idempotency | No protection | **Changed**: idempotency_key = `'usage_{booking_id}_{material_id}'` | Same service completion cannot deduct stock twice. |
| 13 | Inventory Reference | Polymorphic (reference_type + reference_id) | **Kept** — documented | Acceptable for tracking purposes. Actual FKs exist on booking_id, service_id, vehicle_id. |
| 14 | Purchase Receiving | No status | **Added** `status` column: draft → received → cancelled | Prevents duplicate receiving. Only 'draft' purchases can be received. |
| 15 | Commission Integrity | UNIQUE(referral_id) | **Kept** — documented | One commission per referral. If referral has multiple services, commission is for the primary service. |
| 16 | Commission Snapshot | Snapshot fields existed | **Verified**: calculation_type, rate_value, calculated_amount stored at creation. Never recalculated. | Old commissions unaffected by rule changes. |
| 17 | Offers Security | Public read all offers | **Changed**: Public sees only `dealer_id IS NULL` (general offers). Dealer sees own offers. Admin sees all. | Dealer-specific offers not exposed to public. |
| 18 | Profile Trigger | `SECURITY DEFINER` without search_path | **Fixed**: Added `SET search_path = public` | Prevents search path injection attacks. |
| 19 | Audit Logs | Could be modified/deleted | **Documented**: Append-only. RLS in Phase 03 will prevent UPDATE/DELETE. | Even admin cannot modify audit trail. |
| 20 | Soft Delete | Inconsistent (some is_active, some not) | **Standardized**: is_active on customers, vehicles, dealers, materials, services, invoices, payments. No soft delete on audit_logs (append-only). | Consistent approach. Financial records use is_active for visibility control. |
| 21 | Financial Data | No concurrency protection | **Documented**: SELECT FOR UPDATE + atomic validation + CHECK constraints | Multiple layers of protection. |
| 22 | Database Types | text + CHECK | **Kept** — documented decision | More flexible than ENUM. No ALTER TYPE needed. Simpler maintenance. |
| 23 | Indexes | Missing some, extra some | **Reviewed**: Removed idx_audit_logs_action (low selectivity). Added idx_inventory_transactions_booking. | Only useful indexes kept. |
| 24 | Foreign Keys | Some ON DELETE missing | **Reviewed**: All FKs have explicit ON DELETE behavior | Business-meaningful cascade rules. |
| 25 | SQL Migration | Had dangerous public INSERT policies | **Rewritten**: No public INSERT policies. All mutations server-side. | Security by design. |
| 26 | RLS | Public INSERT on bookings, customers, vehicles | **Removed**: Only public SELECT on services, service_images, general offers | Default deny. Server Actions handle all writes. |

### Phase 02 FINAL Changes

| # | Issue | Before | After | Reason |
|---|-------|--------|-------|--------|
| 27 | RBAC Implementation | Simple `staff.role` text | **Added** `roles`, `permissions`, `role_permissions` tables with full RBAC | Granular permission checks via database functions. Supports 7 roles with specific permissions per resource. |
| 28 | Guest Booking Security | Public INSERT on bookings | **Implemented** `create_guest_booking()` Server Action with input validation | All guest booking creation goes through server-side validation. No public DB access. |
| 29 | Payment Atomicity | Application-level only | **Implemented** `record_payment()` with `SELECT FOR UPDATE` + atomic status update | Database-level concurrency protection. Prevents overpayment. |
| 30 | Inventory Atomicity | Application-level only | **Implemented** `record_inventory_usage()` with atomic `UPDATE ... WHERE current_stock >= qty` | Database-level stock protection. Prevents negative inventory. |
| 31 | Purchase Receiving | No atomic function | **Implemented** `receive_purchase()` with transaction | Atomic purchase receiving with inventory updates. |
| 32 | Commission Creation | No atomic function | **Implemented** `create_commission()` with idempotency | Idempotent commission creation. Prevents duplicates. |
| 33 | Booking Completion | No atomic function | **Implemented** `complete_booking()` with inventory + commission | Atomic booking completion with all side effects. |
| 34 | RLS Policies | Basic only | **Implemented** comprehensive RLS with Default Deny + role-based access | Full security at database level. Each table has specific policies per role. |
| 35 | Helper Functions | None | **Implemented** `get_user_role()`, `has_permission()`, `get_dealer_id()`, `normalize_phone()` | Utility functions for RLS policies and business logic. |

---

## REMAINING RISKS

| # | Risk | Severity | Mitigation | Phase |
|---|------|----------|------------|-------|
| 1 | No rate limiting at database level | MEDIUM | Application-level rate limiting in middleware | 03 |
| 2 | No database-level email/phone validation | LOW | Server-side validation in functions | 03 |
| 3 | Purchase items allows same material twice | LOW | UNIQUE(purchase_id, material_id) prevents duplicates | OK |

---

## DATABASE FINAL STATUS

**READY FOR PHASE 03**

All critical issues have been addressed:
- ✅ No dangerous public INSERT policies
- ✅ Client-generated idempotency keys (bookings, payments, inventory)
- ✅ Atomic inventory stock updates
- ✅ Payment concurrency protection
- ✅ Invoice price snapshots
- ✅ Commission snapshots
- ✅ Proper foreign keys
- ✅ Proper ON DELETE behavior
- ✅ Essential indexes only
- ✅ Secure trigger function
- ✅ Audit logs append-only design
- ✅ RBAC tables with granular permissions
- ✅ Database functions for critical operations
- ✅ Comprehensive RLS policies
- ✅ Guest booking via Server Action

---

## DECISIONS DOCUMENTED

### 1. text + CHECK vs ENUM
**Decision**: Use `text + CHECK` constraints.
**Reason**: More flexible. Adding new values doesn't require `ALTER TYPE`. Simpler maintenance. Performance difference is negligible for this use case.

### 2. Customer Phone UNIQUE
**Decision**: `customers.phone` is UNIQUE.
**Reason**: One customer = one phone number. If phone changes → UPDATE the record, not create new. Appropriate for car service business where each customer has one primary contact.

### 3. Booking service_id + booking_items
**Decision**: Keep both. `service_id` = primary service (required). `booking_items` = additional services (optional).
**Reason**: Not redundant. The primary service is always required. Additional services are optional and stored separately for flexibility.

### 4. Commission per Referral (not per Referral Service)
**Decision**: UNIQUE(referral_id) — one commission per referral.
**Reason**: Commission is based on the dealer's overall referral, not individual services. If the referral has multiple services, the commission is calculated from the primary service (is_primary = true).

### 4b. Primary Service for Commission
**Decision**: `referral_services.is_primary` — at most one primary service per referral.
**Schema**: `is_primary boolean NOT NULL DEFAULT false` + partial unique index `UNIQUE(referral_id) WHERE is_primary = true`.
**Reason**: For percentage commissions, the commission amount depends on a specific service's `base_price`. The primary service (`is_primary = true`) is the one used. Fixed commissions do not depend on service price.
**Rule**:
- Percentage commission: `calculated_amount = primary_service.base_price * dealer.commission_value / 100`. If no primary service exists, commission creation fails with a clear error.
- Fixed commission: `calculated_amount = dealer.commission_value`. Service price is irrelevant.
- Not every referral requires a primary service at the DB level (fixed commissions don't need one), but percentage commissions will fail without one.

### 5. Inventory Source of Truth
**Decision**: `inventory_transactions` is the source of truth. `materials.current_stock` is a cached balance.
**Reason**: Ledger-based approach provides complete audit trail. Cached balance improves query performance. Atomic updates keep them in sync.

### 6. Soft Delete Strategy
**Decision**: Use `is_active` flag on business entities (customers, vehicles, dealers, materials, services, invoices, payments). Audit logs are append-only.
**Reason**: Financial records must be preserved. is_active allows hiding from normal queries while maintaining data integrity.

### 7. RBAC Approach
**Decision**: Full RBAC with `roles`, `permissions`, `role_permissions` tables. Database functions check permissions via `has_permission()`.
**Reason**: Granular access control at database level. Each role has specific permissions per resource. RLS policies use these functions.

---

## 28 Tables Summary

| # | Table | Purpose | Soft Delete | Notes |
|---|-------|---------|-------------|-------|
| 1 | profiles | User app data | No (cascade with auth.users) | |
| 2 | staff | Staff + roles | No (is_active) | |
| 3 | suppliers | Material suppliers | No (is_active) | |
| 4 | services | Car services | No (is_active) | |
| 5 | service_images | Service photos | No | |
| 6 | materials | Physical materials | No (is_active) | |
| 7 | service_materials | Expected usage per service | No | N:N junction |
| 8 | dealers | Car dealerships | No (is_active) | |
| 9 | customers | Customer records | No (is_active) | phone = UNIQUE |
| 10 | customer_notes | Customer notes | No | |
| 11 | vehicles | Customer cars | No (is_active) | |
| 12 | offers | Promotions | No (is_active) | |
| 13 | referrals | Dealer referrals | No (is_active) | referral_code = UNIQUE |
| 14 | referral_services | Referral services | No | N:N junction, is_primary for commission |
| 15 | commissions | Dealer commissions | No | referral_id = UNIQUE |
| 16 | bookings | Appointments | No | idempotency_key = UNIQUE |
| 17 | booking_items | Additional services | No (cascade) | |
| 18 | booking_status_history | Status changes | No | Append-only |
| 19 | invoices | Customer invoices | No | invoice_number = UNIQUE |
| 20 | invoice_items | Invoice line items | No (cascade) | Price snapshots |
| 21 | payments | Invoice payments | No | idempotency_key = UNIQUE |
| 22 | inventory_transactions | Stock movements | No | Append-only ledger |
| 23 | purchases | Purchase orders | No | status: draft→received→cancelled |
| 24 | purchase_items | Purchase line items | No (cascade) | |
| 25 | expenses | Simple expenses | No | |
| 26 | notifications | In-app notifications | No (cascade) | |
| 27 | audit_logs | Audit trail | No | Append-only, bigint PK |
| 28 | settings | System settings | No | Key-value |

---

## NEW TABLES (Phase 02 FINAL)

| # | Table | Purpose | Notes |
|---|-------|---------|-------|
| 29 | roles | Named roles for RBAC | super_admin, admin, receptionist, inventory_manager, technician, accountant, dealer |
| 30 | permissions | Granular permissions | resource + action (e.g., 'bookings', 'create') |
| 31 | role_permissions | Role-permission mapping | Many-to-many junction |

---

## DATABASE FUNCTIONS (Phase 02 FINAL)

| # | Function | Purpose | Security |
|---|----------|---------|----------|
| 1 | `get_user_role(user_id)` | Get role name for a user | SECURITY DEFINER, STABLE |
| 2 | `get_user_role_id(user_id)` | Get role UUID for a user | SECURITY DEFINER, STABLE |
| 3 | `has_permission(user_id, resource, action)` | Check if user has permission | SECURITY DEFINER, STABLE |
| 4 | `get_dealer_id(user_id)` | Get dealer ID for a user | SECURITY DEFINER, STABLE |
| 5 | `normalize_phone(phone)` | Normalize phone to digits only | SECURITY DEFINER, IMMUTABLE |
| 6 | `create_guest_booking(...)` | Secure guest booking creation | SECURITY DEFINER, input validation |
| 7 | `record_payment(...)` | Atomic payment with concurrency protection | SECURITY DEFINER, SELECT FOR UPDATE |
| 8 | `record_inventory_usage(...)` | Atomic inventory deduction | SECURITY DEFINER, atomic UPDATE |
| 9 | `receive_purchase(...)` | Atomic purchase receiving | SECURITY DEFINER, transaction |
| 10 | `create_commission(...)` | Idempotent commission creation | SECURITY DEFINER, idempotent |
| 11 | `complete_booking(...)` | Atomic booking completion | SECURITY DEFINER, transaction |

---

## SERVER ACTIONS (Phase 02 FINAL)

| # | Action | Purpose | File |
|---|--------|---------|------|
| 1 | `createGuestBooking(input)` | Guest booking creation | `app/actions/guest-booking.ts` |

---

## FILES CREATED

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/migrations/001_initial_schema.sql` | 28 tables, indexes, triggers, basic RLS |
| 2 | `supabase/migrations/002_security_and_integrity.sql` | RBAC, RLS, Database Functions |
| 3 | `supabase/migrations/002_test_queries.sql` | 10 test scenarios |
| 4 | `app/actions/guest-booking.ts` | Server Action for guest booking |

---

## TEST SCENARIOS

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Guest booking creation | Booking created, customer + vehicle created |
| 2 | Duplicate booking (same idempotency_key) | Returns existing booking, not a new one |
| 3 | Payment recording | Payment recorded, invoice status updated |
| 4 | Duplicate payment (same idempotency_key) | Returns existing payment, not a new one |
| 5 | Payment amount exceeds remaining | Error message |
| 6 | Inventory usage | Stock deducted, transaction created |
| 7 | Insufficient stock | Error message, no deduction |
| 8 | Commission creation | Commission created for completed referral |
| 9 | Duplicate commission | Returns existing commission, not a new one |
| 10 | Complete booking | Status updated, inventory deducted, commission created |
