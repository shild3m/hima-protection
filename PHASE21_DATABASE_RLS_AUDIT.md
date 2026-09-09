# Phase 21 — Database + RLS Audit Report

**Project:** Hima Protection — حماية العنوان  
**Date:** 2026-09-01  
**Audit Type:** Independent Database & RLS Audit (Read-Only)  
**Scope:** 32 tables, 35 functions, 49 indexes, 60+ foreign keys, 26 migration files

---

## Executive Summary

**DATABASE + RLS AUDIT COMPLETE — FINDINGS PRESENT**

| Severity | New DB Findings | Phase 20 Confirmed | Total |
|----------|-----------------|---------------------|-------|
| CRITICAL | 2 | 3 | 5 |
| HIGH | 5 | 4 | 9 |
| MEDIUM | 4 | 3 | 7 |
| LOW | 3 | 1 | 4 |
| **Total** | **14** | **11** | **25** |

**Database Architecture:** 32 tables across 26 migrations. 28 tables have RLS enabled. 3 RBAC tables have NO RLS. 35 functions (25+ SECURITY DEFINER). 49 indexes. Strong CHECK constraints on all monetary fields.

**Key DB-Level Strengths:**
- `UNIQUE(referral_id)` on commissions — prevents double-commission
- `UNIQUE(idempotency_key)` on payments, inventory_transactions — prevents duplicates
- `CHECK(current_stock >= 0)` — prevents negative inventory
- `CHECK(amount > 0)` on payments — prevents zero/negative payments
- All monetary fields have CHECK >= 0 constraints
- Atomic SQL functions with FOR UPDATE locking on critical operations

---

## 1. DATABASE SCHEMA FINDINGS

### 1.1 Table Inventory (32 Tables)

| # | Table | Columns | RLS | Notes |
|---|-------|---------|-----|-------|
| 1 | profiles | 7 | YES | User profiles, FK to auth.users CASCADE |
| 2 | staff | 11 | YES | Staff with role_id FK to roles |
| 3 | suppliers | 9 | YES | Vendor management |
| 4 | services | 14 | YES | Service catalog, public read |
| 5 | service_images | 6 | YES | Public images, USING(true) |
| 6 | materials | 13 | YES | Inventory items with CHECK(current_stock >= 0) |
| 7 | service_materials | 6 | YES | Service-material mapping |
| 8 | dealers | 13 | YES | Dealer accounts with status CHECK |
| 9 | customers | 10 | YES | Customer records, NO dealer_id |
| 10 | customer_notes | 5 | YES | Customer notes with created_by |
| 11 | vehicles | 12 | YES | Customer vehicles |
| 12 | offers | 12 | YES | Promotional offers |
| 13 | referrals | 18 | YES | Referral tracking with UNIQUE(referral_code) |
| 14 | referral_services | 5 | YES | RLS enabled, ZERO policies |
| 15 | commissions | 16 | YES | Commission records with UNIQUE(referral_id) |
| 16 | bookings | 15 | YES | Appointment scheduling |
| 17 | booking_items | 6 | YES | Booking line items |
| 18 | booking_status_history | 7 | YES | Append-only status audit |
| 19 | invoices | 19 | YES | Financial records with CHECK constraints |
| 20 | invoice_items | 10 | YES | Invoice line items |
| 21 | payments | 10 | YES | Payment records with UNIQUE(idempotency_key) |
| 22 | inventory_transactions | 13 | YES | Stock movement audit trail |
| 23 | purchases | 10 | YES | Purchase orders |
| 24 | purchase_items | 7 | YES | Purchase line items |
| 25 | expenses | 7 | YES | Expense tracking |
| 26 | notifications | 10 | YES | User notifications |
| 27 | audit_logs | 10 | YES | System audit trail |
| 28 | settings | 3 | YES | Key-value settings |
| 29 | roles | 4 | **NO** | RBAC roles — no RLS |
| 30 | permissions | 4 | **NO** | RBAC permissions — no RLS |
| 31 | role_permissions | 4 | **NO** | RBAC mappings — no RLS |
| 32 | commission_rules | 11 | YES | Commission rule configuration |

### 1.2 Schema Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| S1 | MEDIUM | `customers` has NO `dealer_id` column | `001_initial_schema.sql:170-181` — customers are shared globally |
| S2 | MEDIUM | `invoices` has NO `dealer_id` column | `001_initial_schema.sql:368-388` — invoices tied to customers, not dealers |
| S3 | MEDIUM | `payments` has NO `dealer_id` column | `001_initial_schema.sql:415-426` — payments tied to invoices |
| S4 | LOW | `staff.role` CHECK doesn't include `dealer` | `001_initial_schema.sql:45-48` — dealers stored in separate table |
| S5 | LOW | `vehicles.customer_id` has duplicate FK definitions | `001:204` (CASCADE) and `011:15` (RESTRICT) — last wins |

---

## 2. RLS FINDINGS

### 2.1 Complete RLS Inventory

| # | Table | RLS | S | I | U | D | Policies | Notes |
|---|-------|-----|---|---|---|---|----------|-------|
| 1 | profiles | YES | 1 | 0 | 1 | 0 | 2 | Owner-only (id=auth.uid()) |
| 2 | staff | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 3 | suppliers | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 4 | services | YES | 1 | 0 | 0 | 0 | 1 | Public active read |
| 5 | service_images | YES | 1 | 0 | 0 | 0 | 1 | **USING(true) — fully public** |
| 6 | materials | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 7 | service_materials | YES | 1 | 0 | 0 | 0 | 1 | Permission-based read |
| 8 | dealers | YES | 3 | 1 | 1 | 1 | 5 | Owner + staff policies |
| 9 | customers | YES | 1 | 1 | 1 | 0 | 3 | Permission-based, no DELETE |
| 10 | customer_notes | YES | 1 | 1 | 1 | 1 | 4 | Full CRUD with created_by |
| 11 | vehicles | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 12 | offers | YES | 3 | 0 | 0 | 0 | 3 | Public + dealer + staff SELECTs |
| 13 | referrals | YES | 2 | 1 | 1 | 0 | 4 | **Dealer isolation enforced** |
| 14 | referral_services | YES | 0 | 0 | 0 | 0 | **0** | **RLS enabled, ZERO policies** |
| 15 | commissions | YES | 2 | 0 | 1 | 0 | 3 | **Dealer isolation on SELECT** |
| 16 | bookings | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 17 | booking_items | YES | 1 | 1 | 1 | 1 | 4 | Full CRUD |
| 18 | booking_status_history | YES | 1 | 1 | 0 | 0 | 2 | Append-only |
| 19 | invoices | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 20 | invoice_items | YES | 1 | 1 | 1 | 1 | 4 | Full CRUD |
| 21 | payments | YES | 1 | 1 | 0 | 0 | 2 | Immutable (no U/D) |
| 22 | inventory_transactions | YES | 1 | 0 | 0 | 0 | 1 | SELECT-only |
| 23 | purchases | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 24 | purchase_items | YES | 1 | 1 | 0 | 1 | 4 | No UPDATE, has DELETE |
| 25 | expenses | YES | 1 | 1 | 1 | 0 | 3 | Permission-based |
| 26 | notifications | YES | 1 | 0 | 1 | 0 | 2 | Owner-only (user_id=auth.uid()) |
| 27 | audit_logs | YES | 1 | 0 | 0 | 0 | 1 | SELECT-only, immutable |
| 28 | settings | YES | 1 | 0 | 1 | 0 | 2 | Admin-managed |
| 29 | roles | **NO** | 0 | 0 | 0 | 0 | **0** | **No RLS** |
| 30 | permissions | **NO** | 0 | 0 | 0 | 0 | **0** | **No RLS** |
| 31 | role_permissions | **NO** | 0 | 0 | 0 | 0 | **0** | **No RLS** |
| 32 | commission_rules | YES | 2 | 0 | 0 | 0 | 2 | **Dealer leak on active rules** |

### 2.2 RLS Findings

| ID | Severity | Table | Finding | Evidence |
|----|----------|-------|---------|----------|
| R1 | **CRITICAL** | roles, permissions, role_permissions | **NO RLS** — any authenticated user can read full RBAC schema | `002_security_and_integrity.sql:11-66` |
| R2 | HIGH | referral_services | RLS enabled but ZERO policies — default deny | `001_initial_schema.sql:712` |
| R3 | HIGH | commission_rules | `dealer_select_active_rules` uses `USING(is_active=true)` — no dealer_id filter. **Dealer A can read Dealer B's private rules** | `014_phase13_commission_rules.sql:78` |
| R4 | HIGH | service_images | `USING(true)` — fully public, no filtering | `003_fix_security_migration.sql:865` |
| R5 | MEDIUM | referrals | `staff_update_referrals` is permission-based only — **dealer with `referrals:update` can modify other dealer's referrals** | `003:992-995` |
| R6 | MEDIUM | commissions | `staff_update_commissions` includes `approve` OR `pay` OR `update` — **broad update permission** | `003:1008-1015` |

---

## 3. RBAC FINDINGS

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| B1 | **CONFIRMED** | `roles` table — NO RLS. Any authenticated user can `SELECT * FROM roles` | `002:11-16` |
| B2 | **CONFIRMED** | `permissions` table — NO RLS. Any authenticated user can `SELECT * FROM permissions` | `002:28-34` |
| B3 | **CONFIRMED** | `role_permissions` table — NO RLS. Any authenticated user can read full role→permission mapping | `002:60-66` |
| B4 | INFO | RBAC tables are seed data (read-only in app). No INSERT/UPDATE/DELETE by application. | — |
| B5 | INFO | `has_permission()` function is SECURITY DEFINER with search_path=public — properly secured | `003:178-195` |

**Impact:** An attacker can enumerate: all 7 role names, all 79 permission names, and the exact role→permission mapping. This enables targeted privilege escalation attacks.

---

## 4. SECURITY DEFINER FINDINGS

### 4.1 Functions Missing search_path

| ID | Severity | Function | File:Line | Risk |
|----|----------|----------|-----------|------|
| F1 | **CRITICAL** | `dashboard_revenue_month` | 027:5 | search_path injection — financial data |
| F2 | **CRITICAL** | `dashboard_pending_payments` | 027:16 | search_path injection — financial data |
| F3 | **CRITICAL** | `dashboard_pending_commissions` | 027:26 | search_path injection — financial data |
| F4 | **CRITICAL** | `dashboard_bookings_by_status` | 027:36 | search_path injection — booking data |
| F5 | **CRITICAL** | `dashboard_revenue_chart` | 027:48 | search_path injection — revenue data |
| F6 | **CRITICAL** | `dashboard_bookings_chart` | 027:64 | search_path injection — booking data |
| F7 | **CRITICAL** | `dashboard_services_chart` | 027:77 | search_path injection — service data |
| F8 | **CRITICAL** | `dashboard_dealer_performance` | 027:92 | search_path injection — dealer data |
| F9 | **CRITICAL** | `dashboard_low_stock_count` | 027:117 | search_path injection — inventory data |
| F10 | HIGH | `get_app_test_ids` | 019:5 | search_path injection + no auth |

### 4.2 Functions Missing GRANT/REVOKE

| ID | Severity | Function | Default Access | Risk |
|----|----------|----------|----------------|------|
| F11 | **CRITICAL** | All 9 dashboard functions | ALL roles (anon, authenticated) | **Anonymous users can call financial functions** |
| F12 | HIGH | `get_app_test_ids` | ALL roles | Exposes test IDs to anon |

### 4.3 Dangerous Function

| ID | Severity | Function | Issue |
|----|----------|----------|-------|
| F13 | HIGH | `create_booking` | GRANT to `anon` — any unauthenticated user can create bookings (rate-limited to 3/day per phone) |

---

## 5. CONSTRAINT FINDINGS

### 5.1 Missing Database Constraints

| ID | Severity | Area | DB Constraint | App-Only? | Risk |
|----|----------|------|:---:|:---:|------|
| C1 | **HIGH** | Commission status transitions | CHECK on values only, no state machine trigger | YES | `paid` → `pending` possible via direct SQL |
| C2 | **HIGH** | Booking slot uniqueness | No UNIQUE(service_id, preferred_date, preferred_time) | YES | Double-booking possible |
| C3 | MEDIUM | Invoice status transitions | CHECK on values only, no state machine trigger | YES | `cancelled` → `draft` possible via direct SQL |
| C4 | MEDIUM | Purchase receiving idempotency | Status check only, no idempotency key on inventory inserts | YES | Duplicate stock addition possible in edge case |

### 5.2 Existing Constraints (Good)

| Area | Constraint | Location |
|------|-----------|----------|
| Duplicate payment | `UNIQUE(idempotency_key)` on payments | `001:425` |
| Duplicate commission | `UNIQUE(referral_id)` on commissions | `001:289` |
| Duplicate referral code | `UNIQUE(referral_code)` on referrals | `001:247` |
| Duplicate inventory txn | `UNIQUE(idempotency_key)` on inventory_transactions | `001:449` |
| Negative stock | `CHECK(current_stock >= 0)` on materials | `001:117` |
| Invoice amounts | `CHECK(total >= 0)`, `CHECK(paid_amount >= 0)`, etc. | `001:374-379` |
| Payment amount | `CHECK(amount > 0)` | `001:418` |
| Commission amounts | `CHECK(calculated_amount >= 0)`, `CHECK(rate_value >= 0)` | `001:293-294` |

---

## 6. TRANSACTION FINDINGS

### 6.1 Atomic Operations (All SQL functions)

| Function | Atomic | Row Locks | Idempotent | Risk |
|----------|:---:|:---:|:---:|------|
| `complete_booking` | YES | YES (bookings FOR UPDATE) | YES | LOW |
| `record_inventory_usage` | YES | IMPLICIT (UPDATE WHERE) | YES | NONE |
| `receive_existing_purchase` | YES | YES (purchases FOR UPDATE) | YES | LOW |
| `create_commission_from_rule` | YES | NO | YES (UNIQUE+EXCEPTION) | NONE |
| `record_payment` | YES | YES (invoices FOR UPDATE) | YES | NONE |
| `refund_invoice` | YES | YES (invoices FOR UPDATE) | PARTIAL | NONE |
| `create_invoice` | YES | NO (INSERT) | NO (gap) | LOW |
| `record_stock_adjustment` | YES | IMPLICIT (UPDATE WHERE) | YES | NONE |
| `create_notification` | YES | NO | YES (3-layer) | NONE |

### 6.2 Transaction Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| T1 | LOW | `create_invoice` has no idempotency key — retry creates duplicate | `004:78` |
| T2 | LOW | `refund_invoice` doesn't zero `paid_amount` — by design for audit | `020:44` |
| T3 | INFO | All multi-table operations are atomic (single PL/pgSQL function) | All migrations |

---

## 7. CONCURRENCY FINDINGS

| ID | Severity | Area | Protection | Status |
|----|----------|------|-----------|--------|
| V1 | NONE | Inventory usage | `WHERE current_stock >= p_quantity` in atomic UPDATE | PROTECTED |
| V2 | NONE | Payment recording | `FOR UPDATE` on invoices + overpay guard | PROTECTED |
| V3 | NONE | Commission creation | `UNIQUE(referral_id)` + EXCEPTION handler | PROTECTED |
| V4 | NONE | Purchase receiving | `FOR UPDATE` on purchases + status check | PROTECTED |
| V5 | NONE | Stock adjustment | `WHERE current_stock >= p_quantity` in atomic UPDATE | PROTECTED |
| V6 | NONE | Notification creation | 3-layer idempotency (soft check + UNIQUE + EXCEPTION) | PROTECTED |

**All critical concurrent operations are properly protected at the database level.**

---

## 8. INDEX FINDINGS

### 8.1 Missing Indexes

| ID | Severity | Table.Column | Reason |
|----|----------|--------------|--------|
| I1 | MEDIUM | `customers.referred_by_dealer_id` | FK column not indexed |
| I2 | MEDIUM | `invoices.vehicle_id` | FK column not indexed |
| I3 | MEDIUM | `invoices.paid_amount` | Used in dashboard SUM queries |
| I4 | MEDIUM | `bookings.referral_id` | FK column not indexed |
| I5 | LOW | `commissions.created_at` | ORDER BY for listing |

### 8.2 Good Indexes (49 total)

All major foreign key columns are indexed. Status columns, timestamps, and RLS filter columns (dealer_id, user_id) are properly indexed. Idempotency keys have UNIQUE constraints.

---

## 9. DEALER ISOLATION

### 9.1 Database-Level Isolation

| Table | Has dealer_id | RLS Isolation | Status |
|-------|:---:|:---:|:---:|
| referrals | YES | `dealer_id = get_dealer_id(auth.uid())` | **SECURE** |
| commissions | YES | `dealer_id = get_dealer_id(auth.uid())` | **SECURE** |
| commission_rules | YES (nullable) | `USING(is_active=true)` — **NO dealer_id filter** | **VULNERABLE** |
| offers | YES (nullable) | `dealer_id = get_dealer_id(auth.uid())` | **SECURE** |
| dealers (self) | — | `user_id = auth.uid()` | **SECURE** |
| notifications | user_id only | `user_id = auth.uid()` | **SECURE** |

### 9.2 Isolation Gaps

| ID | Severity | Finding | Attack Path |
|----|----------|---------|-------------|
| D1 | HIGH | `commission_rules` — Dealer A can read Dealer B's private rules | `SELECT * FROM commission_rules WHERE is_active=true` |
| D2 | MEDIUM | `referrals` UPDATE — `staff_update_referrals` is permission-based only | Dealer with `referrals:update` can modify other dealer's referrals |
| D3 | MEDIUM | `customers`, `invoices`, `payments`, `bookings` — NO dealer_id | By design (single service center model) |

---

## 10. ANONYMOUS ACCESS

| Table/Function | Anonymous Access | Risk |
|----------------|:---:|------|
| services (active) | YES (intentional) | Public website |
| service_images | YES (USING true) | Public website |
| offers (active, no dealer) | YES (intentional) | Public website |
| `create_booking` | YES (GRANT to anon) | Public booking form |
| `get_app_test_ids` | YES (no REVOKE) | **暴露 test data** |
| 9 dashboard functions | YES (no REVOKE) | **暴露 financial data** |
| All other tables | NO (RLS default deny) | — |
| RBAC tables (roles, permissions, role_permissions) | YES (NO RLS) | **暴露 RBAC schema** |

---

## 11. FOREIGN KEY FINDINGS

### 11.1 Dangerous CASCADE Behavior

| ID | Severity | FK | Risk |
|----|----------|-----|------|
| FK1 | MEDIUM | `profiles.id → auth.users ON DELETE CASCADE` | Profile data lost on user deletion |
| FK2 | MEDIUM | `notifications.user_id → auth.users ON DELETE CASCADE` | Notification history lost |
| FK3 | MEDIUM | `commission_rules.dealer_id → dealers ON DELETE CASCADE` | Commission rules lost on dealer deletion |
| FK4 | MEDIUM | `commission_rules.service_id → services ON DELETE CASCADE` | Commission rules lost on service deletion |

---

## 12. AUDIT LOG INTEGRITY

| Check | Status | Evidence |
|-------|:---:|---------|
| INSERT protection | RLS: `has_permission('audit_logs','read')` — SELECT only | `003:1107` |
| UPDATE protection | No UPDATE policy | Immutable |
| DELETE protection | No DELETE policy | Immutable |
| Actor identity | `user_id` FK to auth.users | `001:528` |
| Resource identity | `resource_type` + `resource_id` | `001:530-531` |
| Old/new values | `old_values jsonb` + `new_values jsonb` | `001:532-533` |
| IP tracking | `ip_address text` | `001:534` |
| Client cannot forge actor | INSERT via SECURITY DEFINER functions only | — |

**Audit log is properly protected — append-only, immutable, with actor tracking.**

---

## 13. TEST QUALITY

| Gap | Severity | Evidence |
|-----|----------|---------|
| Tests use service_role key | HIGH | All test files use `SERVICE_KEY` — bypasses RLS |
| Tests don't exercise RLS | HIGH | Tests authenticate via service_role, not user sessions |
| Tests use elevated privileges | MEDIUM | Service role has full DB access |
| No concurrency tests | HIGH | No tests for race conditions |
| No IDOR tests | HIGH | No tests for cross-user access |
| Weak assertions | LOW | Some tests only check `response.ok` |

---

## 14. PHASE 20 FINDING VERIFICATION (Database Evidence)

### CRITICAL

| ID | Phase 20 Finding | DB Verdict | Evidence |
|----|------------------|------------|----------|
| C1 | `/api/test/run-action` exposed | **CONFIRMED** — No DB-level protection. Endpoint exists in source. | `route.ts:18-601` |
| C2 | `staff.ts` mass assignment | **CONFIRMED** — `staff` table has CHECK on `role` column but no trigger preventing role escalation. | `001:45-48` |
| C3 | Hardcoded DB password | **CONFIRMED** — Not a DB issue, but password `Aass357690@` in source files. | Multiple .js files |
| C4 | Hardcoded service role key | **CONFIRMED** — Service role key in source files. | Multiple test files |
| C5 | Fail-open auth on missing env vars | **NOT A DB FINDING** — Application middleware issue. | — |
| C6 | `roles.ts` zero permission checks | **CONFIRMED** — `roles` table has NO RLS. Any user can read. | `002:11-16` |
| C7 | RBAC tables without RLS | **CONFIRMED** — `roles`, `permissions`, `role_permissions` have NO RLS. | `002:11-66` |
| C8 | Dashboard functions exposed to anon | **CONFIRMED** — No REVOKE/GRANT on 9 functions. Default: all roles can call. | `027_dashboard_aggregation.sql` |
| C9 | Dashboard functions missing search_path | **CONFIRMED** — All 9 functions are SECURITY DEFINER without SET search_path. | `027_dashboard_aggregation.sql` |

### HIGH

| ID | Phase 20 Finding | DB Verdict | Evidence |
|----|------------------|------------|----------|
| H1 | Host header injection | **NOT A DB FINDING** — Application middleware issue. | — |
| H2 | Commission no ownership scoping | **CONFIRMED** — `staff_update_commissions` is permission-based, no dealer_id check. | `003:1008-1015` |
| H3 | Cross-dealer referral access | **CONFIRMED** — `staff_update_referrals` is permission-based, no dealer_id check. | `003:992-995` |
| H4 | `createStaff` no permission check | **NOT A DB FINDING** — Application-level issue. `staff` table has RLS. | — |
| H5 | No self-approval prevention | **CONFIRMED** — No DB trigger preventing `approved_by = dealer's user_id`. | `001:287-304` |
| H6 | No max invoice amount cap | **CONFIRMED** — `CHECK(total >= 0)` but no maximum. | `001:378` |
| H7 | No login rate limiting | **NOT A DB FINDING** — Application middleware issue. | — |
| H8 | Dealer layout missing auth | **NOT A DB FINDING** — Application issue. | — |
| H9 | No CSRF protection | **NOT A DB FINDING** — Application issue. | — |
| H10 | Test user password hardcoded | **CONFIRMED** — Password `Aa123456` in test files. | Multiple test files |
| H11 | `redeemReferral` no ownership check | **CONFIRMED** — `staff_update_referrals` is permission-based only. | `003:992-995` |
| H12 | `commission_rules` leaks rates | **CONFIRMED** — `dealer_select_active_rules` uses `USING(is_active=true)` only. | `014:78` |

### MEDIUM

| ID | Phase 20 Finding | DB Verdict | Evidence |
|----|------------------|------------|----------|
| M1 | `cancelInvoice` race | **CONFIRMED** — No FOR UPDATE in TypeScript layer. SQL `update_invoice` has FOR UPDATE but `cancelInvoice` doesn't use it. | `invoices.ts:274` |
| M2 | `cancelPurchase` race | **CONFIRMED** — No FOR UPDATE in TypeScript layer. | `purchases.ts:296` |
| M3 | `updateBookingStatus` race | **CONFIRMED** — No FOR UPDATE in TypeScript layer. | `bookings.ts:179` |
| M4 | Double-booking | **CONFIRMED** — No UNIQUE(service_id, preferred_date, preferred_time). | DB schema |
| M5 | CSP unsafe-inline/eval | **NOT A DB FINDING** | — |
| M6 | httpOnly false | **NOT A DB FINDING** | — |
| M7 | CORS bypass webhooks | **NOT A DB FINDING** | — |
| M8 | Fail-open error handling | **NOT A DB FINDING** | — |
| M9 | `refundInvoice` paid_amount | **CONFIRMED** — `refund_invoice` doesn't zero `paid_amount`. By design. | `020:44` |
| M10 | `referral_services` RLS no policies | **CONFIRMED** — RLS enabled, zero policies. Default deny. | `001:712` |
| M11 | `commission_rules` leaks rates | **CONFIRMED** — Same as H12. | `014:78` |
| M12 | `issueInvoice` race | **CONFIRMED** — No FOR UPDATE in TypeScript layer. | `invoices.ts:224` |

### LOW

| ID | Phase 20 Finding | DB Verdict |
|----|------------------|------------|
| L1-L7 | All LOW findings | **CONFIRMED** |

---

## 15. PRODUCTION BLOCKERS

| # | Issue | Severity | Must Fix |
|---|-------|----------|----------|
| 1 | 9 dashboard functions exposed to anon + missing search_path | CRITICAL | Before launch |
| 2 | `roles`, `permissions`, `role_permissions` — NO RLS | CRITICAL | Before launch |
| 3 | `get_app_test_ids` exposed to all roles | HIGH | Before launch |
| 4 | `commission_rules` dealer isolation leak | HIGH | Before launch |
| 5 | No DB trigger for commission status transitions | HIGH | Before launch |
| 6 | No booking slot uniqueness constraint | HIGH | Before launch |
| 7 | No DB trigger for invoice status transitions | MEDIUM | Before launch |

---

## 16. RECOMMENDED FIX ORDER

### Phase 21A — Immediate (Database Migrations)

1. **ADD** `SET search_path = public` to all 9 dashboard functions
2. **ADD** `REVOKE ALL FROM anon, public; GRANT EXECUTE TO authenticated, service_role` to all 9 dashboard functions
3. **ADD** RLS to `roles`, `permissions`, `role_permissions` with admin-only SELECT policies
4. **FIX** `get_app_test_ids` — add search_path + REVOKE from anon/authenticated, or drop
5. **FIX** `dealer_select_active_rules` — add `dealer_id IS NULL OR dealer_id = get_dealer_id(auth.uid())`

### Phase 21B — Before Launch

6. **ADD** booking slot uniqueness: `CREATE UNIQUE INDEX ON bookings(service_id, preferred_date, preferred_time) WHERE status NOT IN ('cancelled','no_show')`
7. **ADD** commission status transition trigger: `CREATE TRIGGER enforce_commission_status BEFORE UPDATE ON commissions`
8. **ADD** invoice status transition trigger: `CREATE TRIGGER enforce_invoice_status BEFORE UPDATE ON invoices`
9. **ADD** index on `customers.referred_by_dealer_id`
10. **ADD** index on `invoices.vehicle_id`

### Phase 21C — Post-Launch

11. **FIX** `referrals` UPDATE policy — add dealer_id check for dealer-role users
12. **FIX** `commissions` UPDATE policy — add dealer_id check for dealer-role users
13. **REVIEW** dangerous CASCADE behavior on `profiles`, `notifications`, `commission_rules`
14. **ADD** idempotency key to `create_invoice`
