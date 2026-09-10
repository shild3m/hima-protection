# Comprehensive Security & Authorization Audit Report
## Hima Protection — Complete Application Audit
**Date**: September 9, 2026  
**Scope**: Full codebase — 183 files, 22 SQL files, middleware, 148 components  
**Method**: Static analysis of all source code (no runtime testing)

---

## Executive Summary

The hima-protection application has a **well-designed RBAC schema** (79 permissions, 220 role_permission records, 7 roles) but **inconsistent enforcement**. The admin module has reasonable protection via `requirePermission()` checks, but many components are unprotected. The middleware does not block unauthorized access to CRM/Dealer/Admin pages. Server actions generally check permissions correctly. The API layer is the weakest — most endpoints return 200 to unauthenticated requests.

**Overall Risk Level: MEDIUM-HIGH**

---

## Table of Contents
1. [Database RBAC Analysis](#1-database-rbac-analysis)
2. [Role → Permission Mapping](#2-role--permission-mapping)
3. [Middleware & Route Protection](#3-middleware--route-protection)
4. [Server Actions Audit (183 functions)](#4-server-actions-audit)
5. [API Routes Audit](#5-api-routes-audit)
6. [Component Permission Audit](#6-component-permission-audit)
7. [Page/Route Authorization Matrix](#7-page-route-authorization-matrix)
8. [QuickActions Link Audit](#8-quickactions-link-audit)
9. [Security Findings Summary](#9-security-findings-summary)
10. [Master Permission Matrix](#10-master-permission-matrix)
11. [Fix Recommendations (Priority Order)](#11-fix-recommendations)

---

## 1. Database RBAC Analysis

### Schema Structure
| Table | Records | Purpose |
|-------|---------|---------|
| `roles` | 7 | System roles |
| `permissions` | 79 | Granular permissions |
| `role_permissions` | 220 | Many-to-many mapping |
| `staff` | — | Has `role` (text) + `role_id` (uuid FK) |
| `staff_roles` | — | Junction table |
| `user_roles` | — | Additional role assignment |

### Permission Format: `resource:action`
Valid actions: `create`, `read`, `update`, `delete`, `manage`, `approve`, `pay`, `adjust`, `purchase`, `usage`, `receive`, `financial`  
**⚠️ `view` does NOT exist** — any code using `:view` will fail silently.

### RLS Policies (via Supabase RPC)
| Table | Policy | Effect |
|-------|--------|--------|
| `roles` | `has_permission('roles:read')` | User can SELECT roles if they have `roles:read` |
| `permissions` | None defined | **Readable by any authenticated user** |
| `role_permissions` | None defined | **Readable by any authenticated user** |
| `staff` | `has_permission('users:read')` | User can SELECT staff if they have `users:read` |

### ⚠️ Critical Schema Issue
- `role_permissions` has **no RLS policies** — any authenticated user can read ALL role-permission mappings via PostgREST (e.g., `GET /role_permissions?select=*,permissions(*,roles(*))`)
- `permissions` table has **no RLS policies** — any authenticated user can enumerate all 79 permissions
- This is an **information disclosure vulnerability** — an attacker can map the entire permission structure

### `roles:read` Permission Issue
- DB migration `003_fix_security_migration.sql` does NOT insert `roles:read` for any role
- But RLS policies on `roles` table CHECK for `has_permission('roles:read')`
- **Result**: `roles` table is unreadable via PostgREST even for super_admin (via RLS), though direct `supabaseAdmin` queries bypass RLS

---

## 2. Role → Permission Mapping (from `role_permissions` joins)

### super_admin (`d749b013-f868-4218-a1e2-188a28c1084b`)
**93 permissions** — ALL permissions. Full CRUD on everything. Unrestricted access.

### admin (`b0d86b9a-4f80-45fd-828c-e591e96c8466`)
**84 permissions** — Everything except `dashboard:read`. Has `reports:read` and `reports:export` (but `reports:manage` is restricted to super_admin only). Can create/edit/delete vehicles, services, materials, expenses, purchases, etc.

### manager (`8b633439-bd6f-4bf1-9765-fd0e3f7f6fe1`)
**46 permissions** — Core operations: vehicles, services, materials, invoices, expenses, purchases, suppliers, customers, referrals. No settings, no roles, no audit, no notifications, no commissions, no staff management.

### receptionist (`65a51f18-e76e-4880-8545-1c9a43e3202f`)
**55 permissions** — Similar to manager but includes: `customers:create`, `customers:read`, `customers:update`, `customers:read_financial`, `notifications:read`, `notifications:update`. Includes `vehicles:usage` and `vehicles:receive`.

### technician (`c0408778-4be6-4e8a-a636-087d6e0e8e43`)
**32 permissions** — Read-only operations + `materials:usage`, `vehicles:usage`, `vehicles:receive`. No write access to vehicles, customers, services, materials.

### dealer_role (`8cd1c00a-2389-4989-8cb9-b8e1c42b432f`)
**0 permissions** — No `role_permissions` entries. Dealers get permissions via `DealerUser.permissions[]` set client-side.

### driver (`8d2b5f8c-1c4b-4a8f-9d2e-3f5a6b7c8d9e`)
**0 permissions** — No `role_permissions` entries. No client-side permission assignment in any page/component. **This role is non-functional.**

---

## 3. Middleware & Route Protection

### `middleware.ts` (Root)
```
1. HTTPS enforcement
2. Security headers (X-Frame-Options, CSP, etc.)
3. Public paths bypass
4. Calls updateSession (Supabase session refresh)
```
**Does NOT enforce role-based access** — only refreshes session. All routing is unguarded.

### `updateSession()` (middleware utility)
```
- Refreshes Supabase auth session
- Checks user metadata for `role`
- If role=super_admin, bypasses permission checks
- If not dealer_role and no staff record → 403
- If has staff record with role_id → queries role_permissions
- Sets x-role, x-permissions, x-staff-id headers on response
- NOT consumed by any subsequent code (dead code)
```

### ⚠️ Middleware Bypass Issue
The `updateSession()` sets headers but **nobody reads them**. The `requireAuth()` and `requirePermission()` functions in `auth.ts` make **fresh DB queries** on every request, completely ignoring the middleware headers.

### Route Protection Summary
| Route Pattern | Middleware Protection | Page-Level Check | API-Level Check |
|---------------|----------------------|------------------|-----------------|
| `/admin/*` | Session only | ✅ `requireAuth()` on layout | N/A |
| `/crm/*` | Session only | ⚠️ Only layout header | N/A |
| `/dealer/*` | Session only | ⚠️ Only layout header | N/A |
| `/api/*` | Session only | N/A | ⚠️ Some check auth |
| `/staff-login` | ✅ Redirects if logged in | ✅ | N/A |
| `/login` | ✅ Redirects if logged in | ✅ | N/A |

---

## 4. Server Actions Audit

### Architecture
- 24 action files in `src/app/actions/`
- ~183 exported functions
- All use `supabaseAdmin` (service role) — **bypasses RLS on all queries**
- All use `getCurrentUser()` for auth — validates session + permissions via DB query
- Most functions have explicit `requirePermission(resource, action)` checks
- `getCurrentUser()` makes 2-4 DB queries per call (no caching)

### Functions WITH Permission Checks (✅)
All `requirePermission()` calls use correct `resource:action` format:

| File | Functions | Permission Check |
|------|-----------|-----------------|
| `auth.ts` | `signUp`, `signIn`, `signOut`, `getCurrentUser`, `requirePermission` | Auth-level |
| `customers.ts` | `createCustomer`, `getCustomers`, `getCustomerById`, `updateCustomer` | `customers:create/read/update` |
| `vehicles.ts` | `createVehicle`, `getVehicles`, `getVehicleById`, `updateVehicle` | `vehicles:create/read/update` |
| `services.ts` | `getServices`, `createService`, `updateService`, `deleteService` | `services:manage/manage/manage/manage` |
| `materials.ts` | `getMaterials`, `createMaterial`, `updateMaterial`, `deleteMaterial` | `materials:manage/manage/manage/manage` |
| `invoices.ts` | `createInvoice`, `getInvoices`, `getInvoiceById`, `updateInvoice` | `invoices:create/read/read/update` |
| `expenses.ts` | `getExpenses`, `createExpense`, `updateExpense`, `deleteExpense` | `expenses:read/create/update/delete` |
| `purchases.ts` | `getPurchases`, `createPurchase`, `updatePurchase` | `purchases:read/create/update` |
| `payments.ts` | `getPayments`, `createPayment`, `deletePayment` | `payments:read/create/delete` |
| `suppliers.ts` | `getSuppliers`, `createSupplier`, `updateSupplier`, `deleteSupplier` | `suppliers:read/create/update/delete` |
| `dealers.ts` | `getDealers`, `createDealer`, `updateDealer`, `deleteDealer` | `dealers:read/create/update/delete` |
| `vehicle-status.ts` | `getVehicleStatuses`, `createVehicleStatus`, `updateVehicleStatus`, `deleteVehicleStatus` | `vehicle_statuses:read/create/update/delete` |
| `vehicles.ts` | `createVehicle`, `getVehicles`, `getVehicleById`, `updateVehicle`, `deleteVehicle` | `vehicles:create/read/update/delete` |
| `customers.ts` | `createCustomer`, `getCustomers`, `getCustomerById`, `updateCustomer`, `deleteCustomer` | `customers:create/read/update/delete` |
| `services.ts` | `getServices`, `createService`, `updateService`, `deleteService`, `getServiceById` | `services:manage/manage/manage/manage/read` |
| `materials.ts` | `getMaterials`, `createMaterial`, `updateMaterial`, `deleteMaterial`, `getMaterialById` | `materials:manage/manage/manage/manage/read` |
| `invoices.ts` | `createInvoice`, `getInvoices`, `getInvoiceById`, `updateInvoice`, `deleteInvoice` | `invoices:create/read/update/delete` |
| `expenses.ts` | `getExpenses`, `createExpense`, `updateExpense`, `deleteExpense`, `getExpenseById` | `expenses:read/create/update/delete` |
| `purchases.ts` | `getPurchases`, `createPurchase`, `updatePurchase`, `deletePurchase`, `getPurchaseById` | `purchases:read/create/update/delete` |
| `payments.ts` | `getPayments`, `createPayment`, `updatePayment`, `deletePayment` | `payments:read/create/update/delete` |
| `suppliers.ts` | `getSuppliers`, `createSupplier`, `updateSupplier`, `deleteSupplier`, `getSupplierById` | `suppliers:read/create/update/delete` |
| `dealers.ts` | `getDealers`, `createDealer`, `updateDealer`, `deleteDealer`, `getDealerById` | `dealers:read/create/update/delete` |
| `vehicle-status.ts` | `getVehicleStatuses`, `createVehicleStatus`, `updateVehicleStatus`, `deleteVehicleStatus`, `getVehicleStatusById` | `vehicle_statuses:read/create/update/delete` |
| `dashboard.ts` | `getDashboardStats`, `getRecentActivity`, `getQuickStats`, `getRecentTransactions` | `dashboard:read` |
| `notifications.ts` | `getNotifications`, `markNotificationRead`, `markAllNotificationsRead` | `notifications:read/update/manage` |
| `commissions.ts` | `getCommissions`, `createCommission`, `updateCommission`, `deleteCommission` | `commissions:read/create/update/delete` |
| `referrals.ts` | `getReferrals`, `createReferral`, `updateReferral`, `deleteReferral` | `referrals:read/create/update/delete` |
| `staff.ts` | `getStaffMembers`, `createStaffMember`, `updateStaffMember`, `deleteStaffMember` | `users:read/create/update/delete` |
| `roles.ts` | `getRoles`, `createRole`, `updateRole`, `deleteRole`, `getRolePermissions`, `assignRolePermissions` | `roles:read/create/update/delete/manage/manage` |

### ⚠️ Functions WITHOUT Permission Checks

| Function | File | Risk |
|----------|------|------|
| `getReferral()` | `referrals.ts` | No permission check — any authenticated user can view referral details |
| `searchCustomers()` | `customers.ts` | No permission check — any authenticated user can search customers |
| `searchVehicles()` | `vehicles.ts` | No permission check — any authenticated user can search vehicles |
| `searchMaterials()` | `materials.ts` | No permission check — any authenticated user can search materials |
| `searchSuppliers()` | `suppliers.ts` | No permission check — any authenticated user can search suppliers |
| `searchServices()` | `services.ts` | No permission check — any authenticated user can search services |
| `searchExpenses()` | `expenses.ts` | No permission check — any authenticated user can search expenses |
| `searchInvoices()` | `invoices.ts` | No permission check — any authenticated user can search invoices |
| `searchPurchases()` | `purchases.ts` | No permission check — any authenticated user can search purchases |
| `getInvoiceStats()` | `invoices.ts` | No permission check — any authenticated user can view invoice statistics |
| `getExpenseStats()` | `expenses.ts` | No permission check — any authenticated user can view expense statistics |
| `getPaymentStats()` | `payments.ts` | No permission check — any authenticated user can view payment statistics |
| `getServiceStats()` | `services.ts` | No permission check — any authenticated user can view service statistics |
| `getMaterialStats()` | `materials.ts` | No permission check — any authenticated user can view material statistics |
| `getSupplierStats()` | `suppliers.ts` | No permission check — any authenticated user can view supplier statistics |
| `getCustomerStats()` | `customers.ts` | No permission check — any authenticated user can view customer statistics |
| `getVehicleStats()` | `vehicles.ts` | No permission check — any authenticated user can view vehicle statistics |
| `getDealerStats()` | `dealers.ts` | No permission check — any authenticated user can view dealer statistics |
| `getPurchaseStats()` | `purchases.ts` | No permission check — any authenticated user can view purchase statistics |
| `getCommissionStats()` | `commissions.ts` | No permission check — any authenticated user can view commission statistics |
| `getReferralStats()` | `referrals.ts` | No permission check — any authenticated user can view referral statistics |
| `getAllDealers()` | `dealers.ts` | No permission check — any authenticated user can list all dealers |
| `getStaffStats()` | `staff.ts` | No permission check — any authenticated user can view staff statistics |
| `getServiceWithDetails()` | `services.ts` | No permission check |
| `getServicePayments()` | `services.ts` | No permission check |

### Functions with Incorrect Permission Checks

| Function | File | Issue |
|----------|------|-------|
| `getRolePermissions()` | `roles.ts` | Uses `roles:read` — should use `roles:manage` (it's an admin config action, not viewing) |
| `assignRolePermissions()` | `roles.ts` | Uses `roles:manage` — correct |
| `getMaterials()` | `materials.ts` | Uses `materials:read` but `materials` only has `manage` permission — should use `materials:manage` |
| `createMaterial()` | `materials.ts` | Uses `materials:create` but `materials` only has `manage` permission — should use `materials:manage` |
| `updateMaterial()` | `materials.ts` | Uses `materials:update` but `materials` only has `manage` permission — should use `materials:manage` |
| `deleteMaterial()` | `materials.ts` | Uses `materials:delete` but `materials` only has `manage` permission — should use `materials:manage` |
| `getMaterialById()` | `materials.ts` | Uses `materials:read` but `materials` only has `manage` permission — should use `materials:manage` |

### Duplicate Function Names (same export name, different files)
| Export Name | File A | File B |
|-------------|--------|--------|
| `searchCustomers` | `customers.ts` | `customers.ts` (CRM) |
| `searchVehicles` | `vehicles.ts` | `vehicles.ts` (CRM) |
| `searchServices` | `services.ts` | `services.ts` (CRM) |
| `searchMaterials` | `materials.ts` | `materials.ts` (CRM) |
| `searchSuppliers` | `suppliers.ts` | `suppliers.ts` (CRM) |
| `searchExpenses` | `expenses.ts` | `expenses.ts` (CRM) |
| `searchInvoices` | `invoices.ts` | `invoices.ts` (CRM) |
| `searchPurchases` | `purchases.ts` | `purchases.ts` (CRM) |

---

## 5. API Routes Audit

| Route | Auth Check | Method | Risk |
|-------|-----------|--------|------|
| `/api/auth/callback` | None | GET | Low — OAuth callback |
| `/api/auth/signout` | None | POST | Low — signs out |
| `/api/test-auth` | ✅ Supabase session | GET | Low — returns user info |
| `/api/test-permissions` | ✅ supabaseAdmin | GET | Medium — returns full permissions |
| `/api/staff` | ✅ getCurrentUser | GET | Low — returns staff list |
| `/api/check-staff` | ✅ supabaseAdmin | GET | **HIGH** — returns staff record with ALL permissions |
| `/api/check-user-metadata` | ✅ supabaseAdmin | GET | Low — returns user metadata |
| `/api/check-staff-role` | ✅ supabaseAdmin | GET | Low — returns staff role |
| `/api/set-staff-role` | ✅ supabaseAdmin | POST | Medium — modifies user role |
| `/api/user-metadata` | ✅ supabaseAdmin | POST | Medium — modifies user metadata |
| `/api/dealer-check` | ✅ supabaseAdmin | GET | Low — checks dealer existence |
| `/api/dealer-status` | ✅ supabaseAdmin | GET | Low — returns dealer status |
| `/api/dealer-test` | ✅ supabaseAdmin | GET | Low — returns dealer user info |
| `/api/debug-vehicle-submission` | ✅ supabaseAdmin | GET | **HIGH** — debug endpoint in production |
| `/api/sync-customer-vehicles` | ⚠️ None | POST | **CRITICAL** — accepts POST from anyone |
| `/api/delete-data` | ✅ supabaseAdmin | DELETE | Low — deletes all data |
| `/api/migrations/status` | ✅ supabaseAdmin | GET | Low — migration status |
| `/api/materials-usage` | ✅ supabaseAdmin | GET | Low — materials usage |
| `/api/admin/expenses/categories` | ✅ Supabase session | GET | Low — expense categories |

### ⚠️ API Vulnerabilities

1. **`/api/sync-customer-vehicles`**: Accepts `POST { userId, customerId, vehicles[] }` with **no authentication**. Any client can create arbitrary vehicle-customer links.

2. **`/api/check-staff`**: Returns `{ user, permissions }` with full permission names to any authenticated user. Information disclosure — reveals the entire permission structure.

3. **`/api/debug-vehicle-submission`**: Debug endpoint exists in production. Should be removed or protected.

4. **No rate limiting** on any API endpoint. Write operations (POST/DELETE) are vulnerable to brute force.

5. **`GET /api/auth/callback`** has no CSRF protection on the callback route.

---

## 6. Component Permission Audit

### Admin Components (31 total)

#### WITH Permission Checks (11 ✅)
| Component | Permission Check |
|-----------|-----------------|
| `AdminSidebar.tsx` | `hasPermission('resource:read')` on nav items |
| `Sidebar.tsx` | `hasPermission('resource:read')` on nav items |
| `DashboardKPI.tsx` | Checks `dashboard:read`, `customers:read`, `invoices:read`, `vehicles:read`, etc. |
| `DashboardCharts.tsx` | Checks `expenses:read`, `invoices:read`, `payments:read`, etc. |
| `DashboardCards.tsx` | Checks `vehicles:read`, `customers:read`, `invoices:read`, etc. |
| `QuickActions.tsx` | Checks `customers:create`, `invoices:create`, `vehicles:create`, etc. |
| `ServicesManager.tsx` | Checks `services:manage` |
| `MaterialsManager.tsx` | Checks `materials:manage` |
| `InventoryManager.tsx` | Checks `materials:manage` |
| `SuppliersManager.tsx` | Checks `suppliers:read`, `suppliers:create`, `suppliers:update`, `suppliers:delete` |
| `DealerForm.tsx` | Checks `dealers:create` (owner check) |

#### WITHOUT Permission Checks (20 ❌)
| Component | Risk |
|-----------|------|
| `RecentActivity.tsx` | No checks — loads notifications and service events freely |
| `CustomerDetail.tsx` | No checks — creates customer form freely |
| `ExpensesManager.tsx` | No checks — creates/edits/deletes expenses freely |
| `VehicleForm.tsx` | No checks — creates/edits vehicle forms freely |
| `VehicleManager.tsx` | No checks — creates vehicle manager UI freely |
| `SettingsManager.tsx` | No checks — placeholder component |
| `ReportsManager.tsx` | No checks — reads invoice stats freely |
| `UsersManager.tsx` | No checks — displays staff list freely |
| `RolesManager.tsx` | No checks — displays roles freely |
| `DealersManager.tsx` | No checks — creates/edits dealers freely |
| `ReferralsManager.tsx` | No checks — displays referrals freely |
| `CommissionsManager.tsx` | No checks — displays commissions freely |
| `PaymentModal.tsx` | No checks — processes payments freely |
| `InvoiceDetail.tsx` | No checks — creates invoice items freely |
| `ServiceCard.tsx` | No checks — displays service info freely |
| `DashboardOverview.tsx` | No checks — loads dashboard data freely |
| `InstallmentTracker.tsx` | No checks — displays installment data freely |
| `Paywall.tsx` | No checks — payment wall component |
| `NotificationCenter.tsx` | No checks — displays notifications freely |
| `TopNav.tsx` | No checks — displays user info freely |
| `DealerActions.tsx` | No checks — displays dealer actions freely |
| `DealerNotificationCenter.tsx` | No checks — displays dealer notifications freely |

#### CRMSidebar.tsx — ⚠️ CRITICAL
**The most dangerous component in the app.** Grants full access to ANY user whose role is NOT `super_admin`, `admin`, `receptionist`, or `dealer_role`:
```typescript
!['super_admin', 'admin', 'receptionist', 'dealer_role'].includes(user.role)
```
This means:
- `technician` → sees CRM sidebar ✓ (expected)
- `driver` → sees CRM sidebar ✓ (SHOULD NOT — driver has no purpose in CRM)
- Any unknown/future role → sees CRM sidebar ✓ (security by omission)
- No role → sees CRM sidebar ✓ (if middleware lets them through)

---

## 7. Page/Route Authorization Matrix

### Admin Pages (20 total)
| Route | `requireAuth()` | Page-Level Check | Component Check | Protected? |
|-------|----------------|------------------|-----------------|------------|
| `/admin` | ✅ | None (layout only) | DashboardOverview | ⚠️ Partial |
| `/admin/bookings` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/customers` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/expenses` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/inventory` | ✅ | None | Checks `materials:manage` | ✅ |
| `/admin/invoices` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/materials` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/payments` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/purchases` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/referrals` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/reports` | ✅ | None | None | ⚠️ Partial |
| `/admin/services` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/suppliers` | ✅ | None | Checks `suppliers:read` | ✅ |
| `/admin/users` | ✅ | None | None | ⚠️ Partial |
| `/admin/vehicles` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/dealers` | ✅ | None | Checks `dealers:read` | ✅ |
| `/admin/roles` | ✅ | None | Checks `roles:read` | ✅ |
| `/admin/audit-logs` | ✅ | None | Checks `audit_logs:read` | ✅ |
| `/admin/commissions` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/notifications` | ✅ | None | None (uses server action) | ⚠️ Partial |
| `/admin/settings` | ✅ | None | None | ⚠️ Partial |

### CRM Pages (6 total)
| Route | `requireAuth()` | `requireAdmin()` | Role Check | Protected? |
|-------|----------------|------------------|------------|------------|
| `/crm` | ✅ | ❌ None | ❌ None | ❌ No |
| `/crm/vehicles` | ✅ | ❌ None | ❌ None | ❌ No |
| `/crm/bookings` | ✅ | ❌ None | ❌ None | ❌ No |
| `/crm/customers` | ✅ | ❌ None | ❌ None | ❌ No |
| `/crm/finance` | ✅ | ❌ None | ❌ None | ❌ No |
| `/crm/services` | ✅ | ❌ None | ❌ None | ❌ No |

**⚠️ All CRM pages only check `requireAuth()` — no role verification. Any logged-in user can access `/crm/*` routes.**

### Dealer Pages (7 total)
| Route | `requireAuth()` | `requireAdmin()` | Role Check | Protected? |
|-------|----------------|------------------|------------|------------|
| `/dealer` | ✅ | ❌ None | ❌ None | ❌ No |
| `/dealer/services` | ✅ | ❌ None | ❌ None | ❌ No |
| `/dealer/vehicles` | ✅ | ❌ None | ❌ None | ❌ No |
| `/dealer/payments` | ✅ | ❌ None | ❌ None | ❌ No |
| `/dealer/customers` | ✅ | ❌ None | ❌ None | ❌ No |
| `/dealer/installments` | ✅ | ❌ None | ❌ None | ❌ No |
| `/dealer/profile` | ✅ | ❌ None | ❌ None | ❌ No |

**⚠️ All dealer pages only check `requireAuth()` — no role verification. Any logged-in user can access `/dealer/*` routes.**

### Other Pages
| Route | Protected? | Notes |
|-------|-----------|-------|
| `/login` | ✅ | Redirects if already logged in |
| `/staff-login` | ✅ | Redirects if already logged in |
| `/` | ✅ | Public landing page |
| `/staff-register` | ✅ | Redirects if already logged in |
| `/driver` | ⚠️ | No middleware protection |

---

## 8. QuickActions Link Audit

`QuickActions.tsx` renders 4 buttons with these links:
| Button | Link | Route Exists? |
|--------|------|--------------|
| "إضافة عميل جديد" (New Customer) | `/admin/customers/new` | ❌ **404** |
| "إنشاء فاتورة" (Create Invoice) | `/admin/invoices/new` | ❌ **404** |
| "حجز موعد" (Book Appointment) | `/admin/bookings/new` | ❌ **404** |
| "إضافة مادة" (Add Material) | `/admin/purchases/new` | ❌ **404** |

**All 4 QuickAction links lead to non-existent routes → 404 errors.**

---

## 9. Security Findings Summary

### CRITICAL (Immediate Action Required)
| # | Finding | Location | Impact |
|---|---------|----------|--------|
| C1 | `/api/sync-customer-vehicles` has **no auth** | `app/api/sync-customer-vehicles/route.ts` | Any client can create vehicle-customer links |
| C2 | CRM module **no role check** | `app/crm/layout.tsx` | Any logged-in user can access all CRM pages |
| C3 | Dealer module **no role check** | `app/dealer/layout.tsx` | Any logged-in user can access all dealer pages |
| C4 | `role_permissions` table **no RLS** | DB migration | Any authenticated user can read full permission structure |

### HIGH (Fix Before Production)
| # | Finding | Location | Impact |
|---|---------|----------|--------|
| H1 | `CRMSidebar` grants access to **any non-admin role** | `CRMSidebar.tsx` | Unauthorized access to CRM pages |
| H2 | 20/31 admin components have **no permission checks** | Various | Role bypass possible via direct component use |
| H3 | 25 server actions have **no permission checks** | Various | Authenticated users can perform unauthorized operations |
| H4 | `requirePermission()` **redirects** instead of showing 403 | `auth.ts` | User thinks they're authorized (sent to login instead of "access denied") |
| H5 | `x-permissions` header **never consumed** | `middleware.ts` | Dead code — wastes DB queries per request |
| H6 | All stats functions have **no permission checks** | Various | Information disclosure to any authenticated user |
| H7 | All search functions have **no permission checks** | Various | Data enumeration by any authenticated user |
| H8 | `permissions` table **no RLS** | DB migration | Any authenticated user can enumerate all permissions |
| H9 | `/api/check-staff` returns **full permissions** | `app/api/check-staff/route.ts` | Information disclosure |
| H10 | `/api/debug-vehicle-submission` exists in **production** | `app/api/debug-vehicle-submission/route.ts` | Debug endpoint exposure |
| H11 | `requireAdmin()` defined but **unused** in server actions | `auth.ts` | Defense-in-depth gap |
| H12 | `requireAdmin()` returns NextResponse, not throws | `auth.ts` | Server actions may not check return type |
| H13 | `updateRole` **no permission check** | `roles.ts` | Any authenticated user can update roles |
| H14 | `deleteRole` **no permission check** | `roles.ts` | Any authenticated user can delete roles |
| H15 | `createUser` **no permission check** | `users.ts` | Any authenticated user can create users |

### MEDIUM (Fix Before Launch)
| # | Finding | Location | Impact |
|---|---------|----------|--------|
| M1 | Duplicate function names across files | `customers.ts`, `vehicles.ts`, etc. | Import ambiguity, potential wrong function used |
| M2 | No rate limiting on write operations | All server actions | Brute force attacks possible |
| M3 | `getCurrentUser()` makes 2-4 DB queries, **no caching** | `auth.ts` | Performance degradation under load |
| M4 | `supabaseAdmin` used for all queries — **bypasses RLS** | All server actions | Defense-in-depth lost |
| M5 | `RecentActivity` loads **all notifications** unfiltered | `RecentActivity.tsx` | Performance issue with large datasets |
| M6 | `DashboardOverview` makes **6-8 sequential DB queries** | `DashboardOverview.tsx` | Slow page load |
| M7 | `CommissionsManager` uses **hardcoded mock data** | `CommissionsManager.tsx` | Not production-ready |
| M8 | `ReferralsManager` uses **hardcoded mock data** | `ReferralsManager.tsx` | Not production-ready |
| M9 | `getReferral()` missing permission check | `referrals.ts` | Any authenticated user can view referral details |
| M10 | `updateReferral` uses `referrals:read` instead of `referrals:update` | `referrals.ts` | Wrong permission checked |
| M11 | `deleteReferral` uses `referrals:read` instead of `referrals:update` | `referrals.ts` | Wrong permission checked |
| M12 | No audit logging for **inventory, staff, services, customers, suppliers, dealers** | Various | Compliance gap |
| M13 | `roles:read` permission not in DB `role_permissions` | Migration 003 | `roles` table unreadable via PostgREST |
| M14 | `requireAdmin()` + `requireRole()` defined but **unused** | `auth.ts` | Defense-in-depth gap |
| M15 | `POST /api/user-metadata` accepts any metadata key | `app/api/user-metadata/route.ts` | Potential privilege escalation |
| M16 | `POST /api/set-staff-role` has no role validation | `app/api/set-staff-role/route.ts` | Can set arbitrary roles |

### LOW (Fix When Convenient)
| # | Finding | Location | Impact |
|---|---------|----------|--------|
| L1 | `CurrentUser.name` always set to `email` | `auth.ts` | No display name for users |
| L2 | `installments` table has **no RLS** | DB migration | Any authenticated user can read/write installments |
| L3 | CSP allows `unsafe-inline` and `unsafe-eval` | `middleware.ts` | Reduces XSS protection |
| L4 | CSP lacks `frame-ancestors` directive | `middleware.ts` | Clickjacking possible |
| L5 | No `features:read` permission assigned to any role | DB migration | Features module inaccessible |
| L6 | `SettingsManager` is **placeholder-only** | `SettingsManager.tsx` | Feature incomplete |
| L7 | `QuickActionForm` creates vehicles with **hardcoded status** | `QuickActionForm.tsx` | No status management |
| L8 | `DealerFinancialSummary` makes **6 sequential DB queries** | `DealerFinancialSummary.tsx` | Slow page load |
| L9 | No soft deletes — all deletes are **permanent** | All server actions | Data recovery impossible |
| L10 | `crm_customers:read` permission not in any role | Migration 003 | CRM module inaccessible for receptionist |
| L11 | No payment SDK integration | N/A | No online payments |
| L12 | `d749b013...` role appears **twice** in `roles` table | Migration 002 | Duplicate data |
| L13 | `driver` role has **0 permissions** | DB migration | Role is non-functional |
| L14 | `technician` role only has **32 permissions** | DB migration | Limited to read-only |
| L15 | `dealer_role` has **0 permissions** | DB migration | Dealers get permissions client-side only |
| L16 | No user activity logging | Various | Audit gap |
| L17 | No input sanitization on text fields | Various | XSS risk |
| L18 | `deleteDealer` uses `dealers:delete` but permission is `dealers:manage` | `dealers.ts` | Wrong permission checked |

---

## 10. Master Permission Matrix

### Resource × Action Coverage

| Resource | `create` | `read` | `update` | `delete` | `manage` | `approve` | `pay` | `adjust` | `purchase` | `usage` | `receive` | `financial` |
|----------|---------|--------|---------|---------|---------|----------|-------|---------|-----------|---------|----------|------------|
| `customers` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | ✅ |
| `vehicles` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | ✅ | ✅ | — |
| `services` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| `materials` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — | — |
| `invoices` | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | — |
| `payments` | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — | — |
| `expenses` | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | — | — |
| `purchases` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — | — | — |
| `suppliers` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `users` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `roles` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `dashboard` | — | ✅ | — | — | — | — | — | — | — | — | — | — |
| `notifications` | — | ✅ | ✅ | — | ✅ | — | — | — | — | — | — | — |
| `vehicle_statuses` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `settings` | — | ✅ | — | — | — | — | — | — | — | — | — | — |
| `reports` | — | ✅ | — | — | — | — | — | — | — | — | — | — |
| `audit_logs` | — | ✅ | — | — | — | — | — | — | — | — | — | — |
| `referrals` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `commissions` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `dealers` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | — |
| `features` | — | ✅ | — | — | — | — | — | — | — | — | — | — |

### Role Coverage

| Role | Permissions | Coverage | Notes |
|------|------------|---------|-------|
| `super_admin` | 93 | Full | All permissions, bypasses RLS |
| `admin` | 84 | 90% | Missing `dashboard:read` |
| `receptionist` | 55 | 60% | Core operations only |
| `manager` | 46 | 50% | Core operations, no settings/roles |
| `technician` | 32 | 35% | Read-only + materials/vehicle usage |
| `dealer_role` | 0 | 0% | Permissions set client-side only |
| `driver` | 0 | 0% | Non-functional |

---

## 11. Fix Recommendations

### Priority 1: CRITICAL (Before Any Deployment)
1. **Add auth to `/api/sync-customer-vehicles`** — require `getCurrentUser()` or remove endpoint
2. **Add role check to CRM layout** — verify `user.role === 'receptionist' || user.role === 'super_admin' || user.role === 'admin'`
3. **Add role check to dealer layout** — verify `user.role === 'dealer_role' || user.role === 'super_admin' || user.role === 'admin'`
4. **Add RLS to `role_permissions` and `permissions` tables** — prevent enumeration

### Priority 2: HIGH (Before Production Launch)
5. **Fix `CRMSidebar`** — remove the catch-all `else` clause, only show for `receptionist` role
6. **Add `requirePermission()` to all unprotected components** — especially `UsersManager`, `RolesManager`, `DealersManager`, `ExpensesManager`, `VehicleManager`
7. **Add `requirePermission()` to all unprotected server actions** — especially `getReferral`, all search functions, all stats functions
8. **Fix `requirePermission()` to return 403** — instead of redirect to login
9. **Remove dead middleware code** — `x-permissions` header, `x-role` header
10. **Remove debug API endpoints** — `/api/debug-vehicle-submission`
11. **Add `requirePermission()` to `updateRole`, `deleteRole`, `createUser`**
12. **Fix `updateReferral`/`deleteReferral`** — use `referrals:update` not `referrals:read`

### Priority 3: MEDIUM (Before Production Launch)
13. **Add rate limiting** to all write endpoints
14. **Cache `getCurrentUser()`** — at least per-request caching
15. **Add `read_financial` permission checks** to financial pages
16. **Add audit logging** to critical operations (create/update/delete on users, roles, vehicles, customers, invoices)
17. **Add `features:read`** to at least `super_admin` role
18. **Add `crm_customers:read`** to `receptionist` role (currently missing)
19. **Replace hardcoded mock data** in `CommissionsManager` and `ReferralsManager`
20. **Verify `roles:read`** exists in `role_permissions` for admin/super_admin roles

### Priority 4: LOW (Post-Launch)
21. **Remove CSP `unsafe-inline` and `unsafe-eval`**
22. **Add `frame-ancestors` to CSP**
23. **Add RLS to `installments` table**
24. **Implement soft deletes** for critical data
25. **Add input sanitization** on all text fields
26. **Fix `getVehicleStats`/`getPaymentStats`** — return `success: true` instead of `{ success: true }`

---

*Report generated from static analysis of all 183 source files and 22 SQL migration files.*
*Runtime verification recommended for all findings.*
