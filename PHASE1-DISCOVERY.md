# Phase 1 — Read-Only Discovery Report
## Hima Protection Admin Dashboard Audit
**Date**: September 10, 2026  
**Status**: READ-ONLY — No code changes  
**Scope**: All admin routes, components, server actions, RPCs, DB schema, permissions

---

## MASTER RESOURCE MATRIX

| Resource | LIST | CREATE | UPDATE | DELETE | STATUS ACTIONS | BACKEND EXISTS | PERMISSION EXISTS | UI EXISTS | SERVER AUTH |
|----------|------|--------|--------|--------|---------------|----------------|-------------------|-----------|-------------|
| **bookings** | ✅ BookingsManager | ⚠️ RPC exists (`create_booking`) but admin UI missing | ✅ updateBookingStatus | ❌ | ✅ state machine (new→contacted→confirmed→arrived→in_progress→completed, cancel, no_show) | ✅ | ✅ bookings:CRUD+manage | ⚠️ LIST+UPDATE only, NO admin CREATE | ✅ bookings:read/update |
| **customers** | ✅ CustomersManager | ✅ CustomerForm | ✅ CustomerForm | ⚠️ toggleCustomerStatus (soft) | ❌ | ✅ | ✅ customers:CRUD | ✅ Full CRUD | ✅ customers:read/create/update |
| **vehicles** | ✅ VehiclesManager | ✅ VehicleForm | ✅ VehicleForm | ⚠️ toggleVehicleStatus (soft) | ❌ | ✅ | ✅ vehicles:CRUD | ✅ Full CRUD | ✅ vehicles:read/create/update |
| **services** | ✅ ServicesManager | ✅ ServiceForm | ✅ ServiceForm | ✅ deleteService | ❌ | ✅ | ✅ services:CRUD+delete | ✅ Full CRUD | ✅ services:read/create/update/delete |
| **materials** | ✅ MaterialsManager | ✅ MaterialsManager modal | ✅ MaterialsManager modal | ⚠️ toggleMaterialActive (soft) | ❌ | ✅ | ✅ materials:CRUD | ✅ Full CRUD | ✅ materials:read/create/update |
| **suppliers** | ✅ SuppliersManager | ✅ SuppliersManager modal | ✅ SuppliersManager modal | ⚠️ toggleSupplierActive (soft) | ❌ | ✅ | ✅ suppliers:CRUD | ✅ Full CRUD | ✅ suppliers:read/create/update |
| **invoices** | ✅ InvoicesManager | ❌ Backend RPC exists (`create_invoice`) but NO admin UI | ⚠️ issueInvoice, cancelInvoice only | ❌ | ✅ draft→issued, issued→paid/cancelled, partially_paid→paid/cancelled | ✅ (create_invoice, update_invoice, refund_invoice RPCs) | ✅ invoices:create/update | ⚠️ LIST+STATUS only, NO admin CREATE/EDIT | ✅ invoices:read/update |
| **payments** | ✅ PaymentsManager | ❌ Backend RPC exists (`record_payment`) but NO admin UI | ❌ | ❌ | ❌ | ✅ (record_payment RPC) | ✅ payments:create/read | ⚠️ LIST only, NO admin CREATE | ✅ payments:read/create |
| **purchases** | ✅ PurchasesManager | ✅ PurchasesManager modal | ⚠️ cancelPurchase only | ❌ | ✅ receivePurchase | ✅ | ✅ purchases:create/update/receive | ✅ CREATE+RECEIVE+CANCEL | ✅ purchases:read/create/update/receive |
| **inventory** | ✅ InventoryManager | N/A (RPC-driven) | ✅ adjustStock, recordWaste, recordReturn, recordUsage | N/A | N/A | ✅ (record_stock_adjustment, record_inventory_usage RPCs) | ✅ inventory:read/adjust/usage | ✅ Adjust/Usage/Waste/Return | ✅ inventory:read/adjust/usage |
| **expenses** | ✅ ExpensesManager | ✅ ExpensesManager inline | ✅ ExpensesManager inline | ✅ ExpensesManager delete | ❌ | ✅ | ✅ expenses:CRUD | ✅ Full CRUD | ✅ expenses:read/create/update/delete |
| **dealers** | ✅ DealersManager | ❌ Backend action exists (`createDealer`) but NO admin UI | ❌ Backend action exists (`updateDealer`) but NO admin UI | ❌ Backend action exists (`softDeleteDealer`) but NO admin UI | ❌ | ✅ (createDealer, updateDealer, softDeleteDealer, activateDealer) | ✅ dealers:CRUD | ⚠️ LIST+VIEW only, NO admin CREATE/EDIT/DELETE | ✅ dealers:read (frontend missing) |
| **referrals** | ✅ /admin/referrals page | ❌ | ✅ updateReferralStatus, redeemReferral | ❌ | ✅ created→contacted→redeemed→completed, cancel | ✅ | ✅ referrals:read/update | ✅ STATUS ACTIONS | ⚠️ No frontend permission check |
| **commissions** | ✅ /admin/commissions page | ❌ | ❌ | ✅ cancelCommission | ✅ approveCommission, payCommission | ✅ | ✅ commissions:read/approve/pay/update | ✅ APPROVE/PAY/CANCEL | ⚠️ No frontend permission check |
| **commission_rules** | ❌ No admin UI | ❌ Backend exists (`createCommissionRule`, `updateCommissionRule`) | ❌ Backend exists | ❌ | ❌ | ✅ | ✅ commission_rules:CRUD | ❌ NO UI AT ALL | ✅ (via has_permission RPC) |
| **staff** | ✅ UsersManager | ❌ Backend exists (`createStaff`) but NO admin UI | ❌ Backend exists (`updateStaff`, `toggleStaffStatus`) but NO admin UI | ❌ | ❌ | ✅ (getStaff, createStaff, updateStaff, toggleStaffStatus) | ✅ staff:CRUD | ⚠️ LIST only, NO admin CREATE/EDIT | ✅ staff:read/create/update |
| **roles** | ⚠️ RolesManager exists but broken (roles:read doesn't exist in DB) | ❌ | ❌ | ❌ | ❌ | ✅ (getRoles, getRolePermissions, getAllPermissions) | ⚠️ roles:manage exists, roles:read DOES NOT | ⚠️ Broken — can't list roles | ⚠️ Uses roles:read which doesn't exist |
| **notifications** | ✅ NotificationsManager | N/A | N/A | N/A | N/A | ✅ | ✅ notifications:read/manage | ✅ Read/mark-read | ⚠️ No frontend permission check |
| **audit_logs** | ✅ AuditLogsManager | N/A (write-only via other actions) | N/A | N/A | N/A | ✅ | ✅ audit_logs:read | ✅ Read-only | ⚠️ No frontend permission check |
| **reports** | ✅ ReportsManager | N/A | N/A | N/A | N/A | ✅ (dashboard RPCs) | ✅ reports:read/financial | ⚠️ Read-only stats | ⚠️ No frontend permission check |
| **settings** | ✅ SettingsManager | N/A | N/A | N/A | N/A | ✅ (settings table, RLS) | ✅ settings:read/update | ❌ Placeholder only | ❌ No server actions |

---

## GAP ANALYSIS — PRIORITY ORDER

### CRITICAL GAPS (Functionality completely missing)

| # | Resource | Gap | Backend Available | Priority |
|---|----------|-----|-------------------|----------|
| 1 | **invoices** | NO admin CREATE UI | `createInvoice` RPC + `invoices:create` permission exist | P1 |
| 2 | **invoices** | NO admin EDIT UI (items, discount, tax) | `updateInvoice` RPC + `invoices:update` permission exist | P1 |
| 3 | **invoices** | NO admin REFUND UI | `refundInvoice` RPC exists | P2 |
| 4 | **payments** | NO admin CREATE UI (record payment) | `recordPayment` action + `payments:create` permission exist | P1 |
| 5 | **dealers** | NO admin CREATE/EDIT/DELETE UI | `createDealer`, `updateDealer`, `softDeleteDealer` actions exist | P1 |
| 6 | **staff** | NO admin CREATE/EDIT UI | `createStaff`, `updateStaff`, `toggleStaffStatus` actions exist | P1 |
| 7 | **commission_rules** | NO admin UI at all | `createCommissionRule`, `updateCommissionRule` actions exist | P2 |
| 8 | **bookings** | NO admin CREATE UI | `createBooking` action (no auth) exists; `create_booking` RPC exists | P1 |
| 9 | **roles** | UI broken — `roles:read` doesn't exist in DB | `getRoles` action exists but uses `roles:read` which fails | P1 |

### HIGH GAPS (UI exists but incomplete)

| # | Resource | Gap | What Exists | Priority |
|---|----------|-----|-------------|----------|
| 10 | **invoices** | No createInvoice form in InvoicesManager | InvoicesManager has list + status actions only | P1 |
| 11 | **payments** | PaymentsManager is read-only | `recordPayment` action exists with `payments:create` | P1 |
| 12 | **dealers** | DealersManager is read-only | CRUD actions exist in `dealer.ts` | P1 |
| 13 | **staff** | UsersManager is read-only | CRUD actions exist in `staff.ts` | P1 |
| 14 | **settings** | SettingsManager is placeholder | Settings table + RLS exist | P2 |
| 15 | **reports** | ReportsManager shows only 2 stats | Dashboard RPCs provide rich data | P3 |

### MEDIUM GAPS (Permission/Auth issues)

| # | Resource | Gap | Impact | Priority |
|---|----------|-----|--------|----------|
| 16 | **sidebar** | `reports:read` referenced but doesn't exist in DB | Reports nav item hidden for all users | P1 |
| 17 | **sidebar** | `settings:read` referenced but doesn't exist in DB | Settings nav item hidden for all users | P1 |
| 18 | **sidebar** | `roles:read` referenced but doesn't exist in DB | Roles nav item hidden for all users | P1 |
| 19 | **referrals** | No frontend permission check on /admin/referrals page | Any logged-in user sees status buttons | P2 |
| 20 | **commissions** | No frontend permission check on /admin/commissions page | Any logged-in user sees approve/pay/cancel buttons | P2 |
| 21 | **notifications** | No frontend permission check in NotificationsManager | Any logged-in user sees mark-read buttons | P3 |
| 22 | **audit_logs** | No frontend permission check in AuditLogsManager | Any logged-in user sees audit logs | P3 |
| 23 | **all** | `requirePermission()` redirects to /staff-login instead of 403 | Masks authorization failures | P2 |
| 24 | **crm** | CRM layout has no role-based ACL | Any logged-in staff can access CRM | P2 |

---

## QUICK ACTIONS — CURRENT STATE

| Button | Current Target | Status | Fix Required |
|--------|---------------|--------|-------------|
| حجز جديد | `/booking` | ⚠️ Goes to PUBLIC booking page | Create admin booking form OR reuse public form with auth context |
| عميل جديد | `/admin/customers?create=true` | ✅ Opens inline CustomerForm | None |
| فاتورة جديدة | `/admin/invoices` | ❌ Just lands on invoices list | Create invoice creation workflow |
| مشتريات جديدة | `/admin/purchases?create=true` | ✅ Opens inline create form | None |

---

## SERVER ACTION AUTH PATTERNS

| Pattern | Used By | Security |
|---------|---------|----------|
| `requirePermission()` (from auth.ts) | staff, roles, dashboard, notifications, audit-logs | ✅ Throws on failure, redirects to login |
| `requireAuth()` + `permissions.includes()` | bookings, customers, vehicles, services, materials, suppliers, invoices, payments, purchases, expenses, inventory | ✅ Manual string check, returns error |
| `rpc('has_permission')` | commission, crm, dealer, offer, referral | ✅ DB-level check via RPC |
| **No auth** | booking.ts `createBooking` | ❌ **UNAUTHENTICATED** — anyone can create bookings |

---

## STATE MACHINES (from DB triggers)

### Booking
```
new → contacted | cancelled
contacted → confirmed | cancelled
confirmed → arrived | cancelled | no_show
arrived → in_progress | cancelled
in_progress → completed
```
**Enforced by:** `enforce_booking_status` trigger

### Invoice
```
draft → issued | cancelled
issued → partially_paid | paid | cancelled
partially_paid → paid | refunded
paid → refunded
```
**Enforced by:** `enforce_invoice_status` trigger

### Commission
```
pending → approved | cancelled
approved → paid | cancelled
```
**Enforced by:** `enforce_commission_status` trigger

### Purchase
```
draft → received | cancelled
```
**No trigger** — app-level only

---

## RPC FUNCTIONS AVAILABLE

| RPC | Auth Required | Used By | Admin UI |
|-----|--------------|---------|----------|
| `create_booking` | anon+auth | booking.ts | ❌ No admin UI |
| `create_guest_booking` | service_role | guest-booking.ts | ❌ Guest only |
| `create_invoice` | auth+service | invoices.ts | ❌ No admin UI |
| `update_invoice` | auth+service | invoices.ts | ❌ No admin UI |
| `refund_invoice` | auth+service | invoices.ts | ❌ No admin UI |
| `record_payment` | auth+service | payments.ts | ❌ No admin UI |
| `receive_existing_purchase` | auth+service | purchases.ts | ✅ PurchasesManager |
| `record_stock_adjustment` | auth+service | inventory.ts | ✅ InventoryManager |
| `record_inventory_usage` | auth+service | inventory.ts | ✅ InventoryManager |
| `complete_booking` | auth+service | (internal) | ❌ Internal only |
| `create_commission_from_rule` | auth+service | referral.ts | ✅ (auto on referral completed) |
| `create_notification` | auth | notifications.ts | N/A |
| `create_notifications_for_role` | auth | notifications.ts | N/A |
| `has_permission` | auth | commission, crm, dealer, offer, referral | N/A (helper) |

---

## FILES INVENTORY

### Admin Components (29 files)
| Component | CRUD | Permission Checks |
|-----------|------|-------------------|
| AdminSidebar | Navigation | ✅ permissions.includes per nav item |
| BookingsManager | R + status U | ✅ bookings:update |
| CustomersManager | CRUD | ✅ customers:create/update |
| CustomerForm | CU | None (child component) |
| VehiclesManager | CRUD | ✅ vehicles:create/update |
| VehicleForm | CU | None (child component) |
| ServicesManager | CRUD + D | ✅ services:create/update/delete |
| ServiceForm | CU | None (child component) |
| MaterialsManager | CRUD | ✅ materials:create/update |
| SuppliersManager | CRUD | ✅ suppliers:create/update |
| PurchasesManager | CR + receive/cancel | ✅ purchases:create/receive/update |
| InventoryManager | adjust/usage/waste/return | ✅ inventory:adjust/usage |
| ExpensesManager | CRUD | ✅ expenses:create/update/delete |
| InvoicesManager | R + status U | ✅ invoices:update |
| PaymentsManager | R only | ⚠️ No explicit checks |
| DealersManager | R only | ❌ No checks |
| UsersManager | R only | ❌ No checks |
| RolesManager | R only | ❌ No checks |
| NotificationsManager | R/mark-read | ❌ No checks |
| AuditLogsManager | R | ❌ No checks |
| ReportsManager | R | ❌ No checks |
| SettingsManager | Placeholder | ❌ No checks |
| DashboardKPI | R | ✅ permissions.includes per KPI |
| DashboardCharts | R | ✅ permissions.includes per chart |
| DashboardCards | R (nav links) | ✅ permissions.includes per card |
| QuickActions | R (nav links) | ✅ permissions.includes per action |
| RecentActivity | R | ❌ No checks |
| GlobalSearch | R | ✅ permissions.includes per search type |
| NotificationDropdown | R/mark-read | ❌ No checks |

### Admin Pages (22 routes)
| Route | Component | Auth |
|-------|-----------|------|
| /admin | DashboardKPI, QuickActions, DashboardCharts, RecentActivity | ✅ requireAuth |
| /admin/bookings | BookingsManager | ✅ |
| /admin/customers | CustomersManager | ✅ |
| /admin/vehicles | VehiclesManager | ✅ |
| /admin/services | ServicesManager | ✅ |
| /admin/materials | MaterialsManager | ✅ |
| /admin/suppliers | SuppliersManager | ✅ |
| /admin/purchases | PurchasesManager | ✅ |
| /admin/inventory | InventoryManager | ✅ |
| /admin/expenses | ExpensesManager | ✅ |
| /admin/invoices | InvoicesManager | ✅ |
| /admin/payments | PaymentsManager | ✅ |
| /admin/dealers | DealersManager | ✅ |
| /admin/referrals | Inline page | ✅ |
| /admin/commissions | Inline page | ✅ |
| /admin/notifications | NotificationsManager | ✅ |
| /admin/users | UsersManager | ✅ |
| /admin/roles | RolesManager | ✅ |
| /admin/audit-logs | AuditLogsManager | ✅ |
| /admin/reports | ReportsManager | ✅ |
| /admin/settings | SettingsManager | ✅ |
| /admin/unauthorized | Static page | N/A |

### Server Actions (24 files, ~80 functions)
| File | Functions | Auth Pattern |
|------|-----------|-------------|
| audit-logs.ts | 1 | requirePermission |
| booking.ts | 1 | **NONE** |
| bookings.ts | 4 | requireAuth + permissions.includes |
| commission.ts | 11 | has_permission RPC |
| crm.ts | 15 | local requireAuth + has_permission RPC |
| customers.ts | 6 | requireAuth + permissions.includes |
| dashboard.ts | 7 | requireAuth/requirePermission |
| dealer.ts | 6 | local requireAuth + has_permission RPC |
| expenses.ts | 5 | requireAuth + permissions.includes |
| guest-booking.ts | 1 | **NONE** |
| inventory.ts | 6 | requireAuth + permissions.includes |
| invoices.ts | 8 | requireAuth + permissions.includes |
| materials.ts | 6 | requireAuth + permissions.includes |
| notifications.ts | 6 | requireAuth + requirePermission |
| offer.ts | 5 | has_permission RPC |
| payments.ts | 3 | requireAuth + permissions.includes |
| public-services.ts | 2 | **NONE** (intentionally public) |
| purchases.ts | 7 | requireAuth + permissions.includes |
| referral.ts | 7 | has_permission RPC |
| roles.ts | 4 | requirePermission |
| services.ts | 6 | requireAuth + permissions.includes |
| staff.ts | 4 | requirePermission |
| suppliers.ts | 5 | requireAuth + permissions.includes |
| vehicles.ts | 5 | requireAuth + permissions.includes |

---

## NON-EXISTENT PERMISSIONS REFERENCED IN CODE

| Permission | Where | Impact | Fix |
|-----------|-------|--------|-----|
| `roles:read` | AdminSidebar, roles.ts (4 functions) | Roles management completely broken | Change to `roles:manage` |
| `dashboard:read` | AdminSidebar (mitigated by bypass) | No impact (special case) | Change to `bookings:read` or remove |
| `reports:read` | AdminSidebar, DashboardCards | Reports/settings nav hidden | Change to `reports:read` → add permission OR use `reports:financial` |
| `settings:read` | AdminSidebar | Settings nav hidden | Add permission OR use `settings:update` |

---

## RECOMMENDED IMPLEMENTATION ORDER

### Phase 2: Fix Permission Mismatches (P0)
1. Fix `roles:read` → `roles:manage` in roles.ts and AdminSidebar
2. Fix `reports:read` → use existing permission or add to DB
3. Fix `settings:read` → use existing permission or add to DB

### Phase 3: Invoices (P1)
1. Create admin invoice creation UI (reuse `createInvoice` RPC)
2. Create admin invoice edit UI (reuse `updateInvoice` RPC for drafts)
3. Add refund button (reuse `refundInvoice` RPC)

### Phase 4: Payments (P1)
1. Add "Record Payment" button/action to PaymentsManager
2. Reuse `recordPayment` action

### Phase 5: Dealers (P1)
1. Add create/edit/delete UI to DealersManager
2. Reuse existing `createDealer`, `updateDealer`, `softDeleteDealer` actions

### Phase 6: Staff (P1)
1. Add create/edit UI to UsersManager
2. Reuse existing `createStaff`, `updateStaff`, `toggleStaffStatus` actions
3. Protect role changes

### Phase 7: Bookings (P1)
1. Create admin booking creation form
2. Reuse `create_booking` RPC or adapt `BookingForm.tsx`

### Phase 8: Commission Rules (P2)
1. Create commission rules management UI
2. Reuse existing actions

### Phase 9: Permission Hardening (P2)
1. Add frontend permission checks to referrals, commissions, notifications, audit-logs pages
2. Fix CRM role-based access
3. Fix `requirePermission` to return 403

### Phase 10: Settings/Reports (P3)
1. Implement SettingsManager
2. Enhance ReportsManager

---

*Generated from read-only analysis of 183+ source files, 22 SQL migrations, and direct DB queries.*
*No code changes. No database changes.*
