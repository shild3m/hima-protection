# PHASE 01 — SYSTEM ARCHITECTURE
# منصة تظليل وحماية السيارات — التصميم المعماري الكامل

---

## 1. Project Overview

منصة إلكترونية متكاملة لشركة متخصصة في تظليل وحماية السيارات.

### التقنيات

| الطبقة | التقنية |
|--------|---------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (Auth + PostgreSQL + Storage + Realtime) |
| ORM | None — Supabase JS Client مباشرة |
| Deployment | Vercel |
| Language | Arabic (RTL) — قابل للإنجليزية مستقبلًا |

### الطبيعة

- ليست مجرد موقع تعريفي — بل نظام متكامل
- Public Website + Admin Dashboard + Dealer Portal
- 22 Modul رئيسي
- نظام مالي بسيط (ليس محاسبة قانونية)

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Public Pages  │  │ Admin Pages  │  │  Dealer Portal   │  │
│  │  (SEO/SSR)   │  │  (CSR+SSR)   │  │     (CSR)        │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │             │
│         │    Next.js Server Actions            │             │
│         │    + React Server Components         │             │
│         │                  │                    │             │
└─────────┼──────────────────┼────────────────────┼────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Middleware                          │   │
│  │  • HTTPS Redirect  • Session Refresh  • CORS         │   │
│  │  • CSP Headers     • Rate Limiting    • Auth Check    │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                              │                               │
│  ┌──────────────────────────▼───────────────────────────┐   │
│  │              Server Layer                             │   │
│  │  ┌─────────────────┐  ┌──────────────────────────┐   │   │
│  │  │ Server Actions  │  │    API Routes             │   │   │
│  │  │ ( mutations )   │  │  ( webhooks, external )   │   │   │
│  │  └────────┬────────┘  └────────────┬─────────────┘   │   │
│  │           │                         │                  │   │
│  │  ┌────────▼─────────────────────────▼─────────────┐   │   │
│  │  │           Supabase Server Client                │   │   │
│  │  │  • anon key (user sessions)                     │   │   │
│  │  │  • service_role (server-only operations)        │   │   │
│  │  └────────────────────┬───────────────────────────┘   │   │
│  └───────────────────────┼──────────────────────────────┘   │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                               │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │    Auth     │  │ PostgreSQL │  │      Storage          │  │
│  │  (GoTrue)   │  │    (RLS)   │  │  (avatars, docs)     │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
│  ┌────────────┐  ┌────────────┐                             │
│  │  Realtime   │  │   Edge     │                             │
│  │ (optional)  │  │ Functions  │                             │
│  └────────────┘  └────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### مبدأ الجدران (Defense in Depth)

```
الطبقة 1: Browser Validation     → UX فقط، لا أمان
الطبقة 2: Middleware             → Auth check, CORS, CSP, Rate Limit
الطبقة 3: Server Actions/Routes  → Validation, Auth, Business Logic
الطبقة 4: Supabase RLS          → Database-level protection
الطبقة 5: PostgreSQL Constraints → Unique, FK, CHECK
```

---

## 3. Module Architecture

### 3.1 Modules Overview

| # | Module | المسؤولية | نوع الوصول |
|---|--------|-----------|------------|
| 1 | Public Website | الصفحة الرئيسية، الخدمات، العروض، من نحن، تواصل | عام |
| 2 | Services | إدارة الخدمات (Name, Price, Duration, Materials) | Admin CRUD + Public Read |
| 3 | Booking System | حجز موعد للخدمة | Public Create + Admin Manage |
| 4 | CRM (Customers) | إدارة بيانات العملاء | Admin/Receptionist |
| 5 | Vehicles | إدارة سيارات العملاء | Admin/Receptionist |
| 6 | Invoices | إصدار وإدارة الفواتير | Admin/Accountant |
| 7 | Payments | تسجيل المدفوعات | Admin/Accountant |
| 8 | Dealers | إدارة حسابات المعارض | Admin |
| 9 | Referrals | إحالات المعارض | Dealer Create + Admin Manage |
| 10 | Offers | عروض المعارض | Admin |
| 11 | Commissions | عمولات المعارض | Admin/Accountant |
| 12 | Inventory | إدارة المخزون | Admin/Inventory Manager |
| 13 | Materials | المواد المستخدمة | Admin/Inventory Manager |
| 14 | Suppliers | الموردين | Admin/Inventory Manager |
| 15 | Purchases | المشتريات | Admin/Inventory Manager |
| 16 | Expenses | المصاريف البسيطة | Admin/Accountant |
| 17 | Employees/Staff | الموظفين والأدوار | Admin |
| 18 | Users | إدارة المستخدمين | Admin |
| 19 | Roles & Permissions | الأدوار والصلاحيات | Super Admin |
| 20 | Notifications | الإشعارات | System |
| 21 | Reports | التقارير البسيطة | Admin/Accountant |
| 22 | Audit Logs | سجل العمليات | System (readonly) |

### 3.2 Module Dependencies

```
Public Website
    └── Services (read-only)

Booking System
    ├── Services (read pricing)
    ├── Customers (create/link)
    ├── Vehicles (create/link)
    └── Notifications (on status change)

CRM (Customers)
    ├── Vehicles (1:N)
    ├── Bookings (1:N)
    ├── Invoices (1:N)
    └── Referrals (N:1 optional)

Invoices
    ├── Customers
    ├── Vehicles
    ├── Services (line items)
    ├── Bookings (optional link)
    └── Payments (1:N)

Payments
    └── Invoices (N:1)

Dealers
    ├── Referrals (1:N)
    ├── Offers (N:N)
    └── Commissions (1:N)

Referrals
    ├── Dealers (N:1)
    ├── Customers (N:1)
    ├── Offers (N:1 optional)
    └── Commissions (1:1 on completion)

Commissions
    ├── Referrals (1:1)
    └── Dealers (N:1)

Inventory
    ├── Materials (N:1)
    └── Inventory Transactions (1:N)

Materials
    ├── Services (N:N — expected usage)
    └── Inventory (1:N)

Purchases
    ├── Suppliers (N:1)
    └── Purchase Items (1:N)

Suppliers
    └── Purchases (1:N)

Expenses
    └── (standalone — no dependencies)

Staff
    └── Roles (N:1)

Notifications
    └── (event-driven — no direct FK)

Audit Logs
    └── (standalone — append-only)
```

---

## 4. Business Flows

### 4.1 Customer Booking Flow

```
1. العميل يفتح صفحة الخدمة
2. يضغط "احجز موعدك"
3. يملأ النموذج:
   - الاسم
   - رقم الجوال
   - البريد (اختياري)
   - الشركة المصنعة للسيارة
   - الموديل
   - سنة الصنع
   - اللون
   - رقم اللوحة (اختياري)
   - الخدمة
   - الخدمات الإضافية (اختياري)
   - التاريخ المفضل
   - الوقت المفضل
   - ملاحظات (اختياري)
4. Browser يرسل إلى Server Action
5. Server-side:
   a. Validate المدخلات
   b. Rate Limit Check
   c. Phone Duplicate Check (إذا كان نفس الرقم)
   d. Create or Link Customer
   e. Create or Link Vehicle
   f. Create Booking (status: NEW)
   g. Log Audit
   h. Create Notification
6. Return Success → عرض تأكيد الحجز
7. Admin يرى الحجز الجديد في Dashboard

حالات الحجز:
  NEW → CONTACTED → CONFIRMED → ARRIVED → IN_PROGRESS → COMPLETED
                                                      ↘ CANCELLED
                                                      ↘ NO_SHOW
```

**Edge Cases:**
- حجز مكرر (نفس الرقم + نفس التاريخ + نفس الخدمة) → يُمنع
- بيانات غير صحيحة → Server-side validation
- Rate Limit → حماية من Spam

### 4.2 Dealer Referral Flow

```
1. المعرض يسجل الدخول (Dealer Portal)
2. يضغط "إحالة جديدة"
3. يملأ:
   - اسم العميل
   - رقم جوال العميل
   - السيارة (Make + Model + Year + Color)
   - الخدمة المقترحة
   - العرض إن وجد
   - ملاحظات
4. Server-side:
   a. Validate المدخلات
   b. Verify Dealer ID from session
   c. Create Customer (if new)
   d. Create Vehicle (if new)
   e. Generate Referral Code (REF-YYYY-NNNNNN)
   f. Create Referral (status: CREATED)
   g. Log Audit
   h. Create Notification
5. المعرض يرى الإحالة مع الكود
6. عند وصول العميل للمركز:
   a. الموظف يبحث بالرقم أو الكود
   b. يرى بيانات الإحالة
   c. يحول الحالة إلى REDEEMED
7. عند اكتمال الخدمة:
   a. الحالة → COMPLETED
   b. Create Commission Record
   c. NotifyDealer

حالات الإحالة:
  CREATED → CONTACTED → REDEEMED → COMPLETED
                                  ↘ EXPIRED
                                  ↘ CANCELLED
```

**حماية المعرض:**
- RLS: `WHERE dealer_id = auth.uid()`
- المعرض لا يرى بيانات معرض آخر
- لا يستطيع تعديل إحالة مكتملة

### 4.3 Service Completion Flow

```
1. الموظف يفتح صفحة الحجز
2. يضغط "إكمال الخدمة"
3. يسجل:
   - المواد المستخدمة فعليًا (Material + Quantity)
   - ملاحظات التنفيذ
4. Server-side (TRANSACTION):
   BEGIN;
   
   a. Validate materials exist and sufficient stock
   b. Update Booking status → COMPLETED
   c. For each material used:
      - Create Inventory Transaction (type: USAGE)
      - Decrease stock_quantity (atomic: stock = stock - qty)
   d. If linked Referral exists:
      - Update Referral status → COMPLETED
      - Create Commission Record
   e. Log Audit
   f. Create Notifications (booking completed, low stock warning)
   
   COMMIT;

5. إذا فشل أي خطوة → ROLLBACK بالكامل
```

**حماية:**
- لا يمكن إكمال نفس الحجز مرتين (status check)
- لا يمكن تخصم مخزون مرتين (idempotency key)
- لا يمكن استخدام مخزون غير موجود (stock check)
- Transaction واحدة لكل العملية

### 4.4 Invoice Flow

```
1. الموظف يضغط "إنشاء فاتورة" من صفحة الحجز
2. Server-side:
   a. Calculate total from services (Server-side pricing)
   b. Apply discount if any (from Offer or manual)
   c. Calculate tax if applicable
   d. Create Invoice (status: DRAFT)
3. الموظف يراجع الفاتورة
4. يضغط "إصدار الفاتورة"
   a. Server: status → ISSUED
5. عند استلام الدفع:
   a. Create Payment
   b. Update Invoice (paid_amount += payment)
   c. If fully paid → status: PAID
   d. If partially paid → status: PARTIALLY_PAID

حالات الفاتورة:
  DRAFT → ISSUED → PARTIALLY_PAID → PAID
                                   ↘ CANCELLED
                                   ↘ REFUNDED
```

**حماية:**
- لا يثق النظام بـ Price من Browser
- السعر يُحسب Server-side من جدول Services
- لا يمكن تعديل فاتورة PAID بدون صلاحية خاصة

### 4.5 Payment Flow

```
1. من صفحة الفاتورة، يضغط "تسجيل دفعة"
2. يملأ:
   - المبلغ
   - طريقة الدفع (Cash/Card/Bank Transfer)
   - رقم المرجع (اختياري)
   - ملاحظات
3. Server-side (TRANSACTION):
   BEGIN;
   
   a. Validate payment amount ≤ remaining balance
   b. Create Payment record
   c. Update Invoice: paid_amount += amount
   d. Update Invoice status (PAID / PARTIALLY_PAID)
   e. Log Audit
   f. Create Notification
   
   COMMIT;

4. لا يمكن:
   - دفعة ب金额 أكبر من المتبقي
   - دفعة مكررة (idempotency)
   - تعديل دفعة بدون صلاحية
```

### 4.6 Inventory Consumption Flow

```
1. عند إكمال الخدمة:
   a. النظام يعرض المواد المتوقعة للخدمة
   b. الموظف يسجل الكمية الفعلية المستخدمة
2. Server-side (part of Service Completion Transaction):
   BEGIN;
   
   a. For each material:
      - Check: stock_quantity >= actual_usage
      - Create Inventory Transaction (type: USAGE)
      - Atomic: UPDATE materials SET stock = stock - qty
   b. If any material insufficient → ROLLBACK
   c. If low stock after deduction → Create Notification
   
   COMMIT;
```

**حماية:**
- stock_quantity لا يُعدل مباشرة — فقط عبر Transactions
- كل حركة مسجلة في Inventory Transactions
- لا يمكن تخصم مخزون بدون Transaction

### 4.7 Purchase Flow

```
1. الموظف يضغط "إضافة مشتريات"
2. يملأ:
   - المورد
   - المواد + الكمية + تكلفة الوحدة
   - التاريخ
   - ملاحظات
3. Server-side (TRANSACTION):
   BEGIN;
   
   a. Create Purchase record
   b. For each item:
      - Create Purchase Item
      - Create Inventory Transaction (type: PURCHASE)
      - Atomic: UPDATE materials SET stock = stock + qty
   c. Log Audit
   d. Create Notification
   
   COMMIT;
```

### 4.8 Commission Flow

```
1. عند إكمال خدمة مرتبطة بإحالة:
   a. Server يتحقق:
      - هل الإحالة REDEEMED?
      - هل تم إنشاء عمولة لهذه الإحالة مسبقًا؟
   b. If no existing commission:
      - Fetch dealer's commission rule
      - Calculate amount (fixed or percentage)
      - Create Commission (status: PENDING)
   
2. المدير يراجع العمولات:
   - Approved → PENDING
   - Paid → PAID
   - Cancelled → CANCELLED

3. عند الدفع:
   a. Create Payment (linked to commission)
   b. Update Commission status → PAID
   c. Log Audit
```

**حماية:**
- لا يمكن إنشاء عمولة مرتين (unique constraint: referral_id)
- لا يمكن الدفع مرتين
- المبلغ يُحسب Server-side من القاعدة

### 4.9 Expense Flow

```
1. Admin/Accountant يضغط "إضافة مصروف"
2. يملأ:
   - اسم المصروف
   - المبلغ
   - التاريخ
   - ملاحظات
3. Server-side:
   a. Validate المدخلات
   b. Create Expense
   c. Log Audit
4. يمكن تعديل/حذف بصلاحية
```

### 4.10 Financial Summary Flow

```
التقرير المالي يُحسب Server-side:

SELECT:
  (إجمالي المدفوعات الفواتير)     AS Revenue
  - (إجمالي المشتريات)            AS Purchases
  - (إجمالي المصروفات)            AS Expenses
  - (إجمالي العمولات المدفوعة)   AS Commissions
  = الصافي التقريبي               AS Net

لا يُ信赖 Browser بأي رقم.
```

---

## 5. User Roles

### 5.1 Role Definitions

| Role | الوصول |
|------|--------|
| SUPER_ADMIN | كل الصلاحيات + إدارة الأدوار |
| ADMIN | كل شيء إلا إدارة الأدوار |
| RECEPTIONIST | Bookings, Customers, Vehicles, Services (read), Invoices (limited) |
| INVENTORY_MANAGER | Inventory, Materials, Suppliers, Purchases |
| TECHNICIAN | Vehicles assigned to him, Services, Materials usage |
| ACCOUNTANT | Invoices, Payments, Expenses, Commissions, Reports |
| DEALER | Own referrals, own offers, own commissions |

### 5.2 Permission Matrix

```
Resource              | SUPER_ADMIN | ADMIN | RECEPTIONIST | INVENTORY_MGR | TECHNICIAN | ACCOUNTANT | DEALER
----------------------|-------------|-------|--------------|---------------|------------|------------|-------
Services (CRUD)       | ✅           | ✅     | Read          | -             | Read       | -          | -
Bookings (CRUD)       | ✅           | ✅     | ✅            | -             | Read*      | -          | Referrals Only
Customers (CRUD)      | ✅           | ✅     | ✅            | -             | -          | -          | Own Referrals
Vehicles (CRUD)       | ✅           | ✅     | ✅            | -             | Read*      | -          | Own Referrals
Invoices (CRUD)       | ✅           | ✅     | Create**      | -             | -          | ✅          | -
Payments (CRUD)       | ✅           | ✅     | -             | -             | -          | ✅          | -
Dealers (CRUD)        | ✅           | ✅     | -             | -             | -          | Read       | -
Referrals (CRUD)      | ✅           | ✅     | ✅            | -             | -          | Read       | Create + Read Own
Offers (CRUD)         | ✅           | ✅     | -             | -             | -          | Read       | Read Own
Commissions (Read)    | ✅           | ✅     | -             | -             | -          | ✅          | Read Own
Inventory (CRUD)      | ✅           | ✅     | -             | ✅            | Read       | -          | -
Materials (CRUD)      | ✅           | ✅     | -             | ✅            | Read       | -          | -
Suppliers (CRUD)      | ✅           | ✅     | -             | ✅            | -          | Read       | -
Purchases (CRUD)      | ✅           | ✅     | -             | ✅            | -          | Read       | -
Expenses (CRUD)       | ✅           | ✅     | -             | -             | -          | ✅          | -
Financial Summary     | ✅           | ✅     | -             | -             | -          | ✅          | -
Reports               | ✅           | ✅     | -             | Limited       | -          | ✅          | Own Only
Notifications (Read)  | ✅           | ✅     | ✅            | ✅            | ✅          | ✅          | ✅
Staff/Users (CRUD)    | ✅           | ✅     | -             | -             | -          | -          | -
Roles/Permissions     | ✅           | -      | -             | -             | -          | -          | -
Audit Logs (Read)     | ✅           | ✅     | -             | -             | -          | -          | -
Settings              | ✅           | ✅     | -             | -             | -          | -          | -

* Technician sees only assigned vehicles
** Receptionist creates draft invoices only
```

---

## 6. Permission Concept

### 6.1 RBAC Model

```
User (auth.users)
  └── Staff Record (staff table)
       └── role: enum SUPER_ADMIN, ADMIN, RECEPTIONIST, INVENTORY_MANAGER, TECHNICIAN, ACCOUNTANT
       
Dealer (dealers table)
  └── Linked to auth.users
  └── Separate access model (not Staff)
```

### 6.2 How Permissions Work

```
1. Middleware: Check if user is authenticated
2. Server Action: 
   a. Get user from session
   b. Fetch staff record + role
   c. Check role against required permission
   d. If DEALER role: check dealer_id ownership
3. RLS: Database-level enforcement
4. Never trust client-provided role
```

### 6.3 Dealer Access

```
Dealer Authentication:
  - Separate login flow (Dealer Portal)
  - Phone-based OTP
  - Session managed by Supabase Auth
  
Dealer Restrictions:
  - Can only see own referrals
  - Can only see own offers
  - Can only see own commissions
  - Cannot access Admin Dashboard
  - Cannot modify completed referrals
  - Cannot see other dealers' data
```

---

## 7. Database Entities

### 7.1 Core Entities

```
┌──────────────────────────────────────────────────────────────────────┐
│                         AUTH LAYER                                    │
│                                                                       │
│  auth.users (Supabase managed)                                        │
│    id (uuid PK)                                                       │
│    phone, email                                                       │
│    raw_user_meta_data                                                 │
│    created_at                                                         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                        PROFILE LAYER                                  │
│                                                                       │
│  profiles                                                             │
│    id (uuid PK → auth.users)                                         │
│    phone, full_name, email                                            │
│    role: text (for staff only)                                        │
│    created_at, updated_at                                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                      BUSINESS ENTITIES                                 │
│                                                                       │
│  services              materials           suppliers                   │
│  customers             vehicles            purchases                   │
│  bookings              inventory_transactions  purchase_items          │
│  invoices              offers              expenses                    │
│  payments              dealers             referrals                   │
│  commissions           notifications       audit_logs                  │
│  staff                 settings                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Entity Details

#### services
```sql
services (
  id              uuid PK DEFAULT gen_random_uuid()
  name            text NOT NULL           -- "ظليل سيارات"
  slug            text UNIQUE NOT NULL    -- "window-tint"
  description     text
  short_description text
  base_price      numeric NOT NULL        -- السعر الأساسي
  duration_minutes integer                -- مدة التنفيذ بالدقائق
  is_active       boolean DEFAULT true
  display_order   integer DEFAULT 0
  image_url       text
  meta_title      text                    -- SEO
  meta_description text                   -- SEO
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### customers
```sql
customers (
  id              uuid PK DEFAULT gen_random_uuid()
  full_name       text NOT NULL
  phone           text NOT NULL
  email           text
  source          text                    -- 'walk_in', 'referral', 'online', 'social'
  referred_by_dealer_id uuid → dealers(id)
  notes           text
  total_spent     numeric DEFAULT 0
  visit_count     integer DEFAULT 0
  last_visit_at   timestamptz
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
  
  UNIQUE(phone)  -- هاتف فريد لكل عميل
)
```

#### vehicles
```sql
vehicles (
  id              uuid PK DEFAULT gen_random_uuid()
  customer_id     uuid NOT NULL → customers(id)
  make            text NOT NULL           -- "Toyota"
  model           text NOT NULL           -- "Camry"
  year            integer                 -- 2025
  color           text
  plate_number    text
  vin             text
  notes           text
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### bookings
```sql
bookings (
  id              uuid PK DEFAULT gen_random_uuid()
  customer_id     uuid NOT NULL → customers(id)
  vehicle_id      uuid NOT NULL → vehicles(id)
  service_id      uuid NOT NULL → services(id)
  
  -- Status
  status          text DEFAULT 'new'      
    CHECK (status IN ('new','contacted','confirmed','arrived','in_progress','completed','cancelled','no_show'))
  
  -- Schedule
  preferred_date  date
  preferred_time  time
  
  -- Additional Services (IDs of extra services)
  additional_services uuid[]
  
  -- Referral Link
  referral_id     uuid → referrals(id)
  
  -- Notes
  customer_notes  text
  admin_notes     text
  
  -- Metadata
  created_by      uuid → auth.users(id)   -- which staff created
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
  
  -- Idempotency
  idempotency_key text UNIQUE             -- prevent duplicate bookings
)
```

#### vehicles → booking status history
```sql
booking_status_history (
  id              uuid PK DEFAULT gen_random_uuid()
  booking_id      uuid NOT NULL → bookings(id)
  old_status      text
  new_status      text NOT NULL
  changed_by      uuid → auth.users(id)
  notes           text
  created_at      timestamptz DEFAULT now()
)
```

#### invoices
```sql
invoices (
  id              uuid PK DEFAULT gen_random_uuid()
  invoice_number  text UNIQUE NOT NULL    -- INV-YYYY-NNNNNN
  customer_id     uuid NOT NULL → customers(id)
  vehicle_id      uuid → vehicles(id)
  booking_id      uuid → bookings(id)
  
  -- Line Items (stored as JSONB for flexibility)
  items           jsonb NOT NULL          -- [{service_id, name, quantity, unit_price, total}]
  
  -- Financials
  subtotal        numeric NOT NULL
  discount        numeric DEFAULT 0
  tax_rate        numeric DEFAULT 0
  tax_amount      numeric DEFAULT 0
  total           numeric NOT NULL
  
  -- Payment
  paid_amount     numeric DEFAULT 0
  payment_status  text DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partially_paid','paid','refunded'))
  
  -- Status
  status          text DEFAULT 'draft'
    CHECK (status IN ('draft','issued','partially_paid','paid','cancelled','refunded'))
  
  -- Metadata
  issued_at       timestamptz
  created_by      uuid → auth.users(id)
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### payments
```sql
payments (
  id              uuid PK DEFAULT gen_random_uuid()
  invoice_id      uuid NOT NULL → invoices(id)
  amount          numeric NOT NULL CHECK (amount > 0)
  payment_method  text NOT NULL
    CHECK (payment_method IN ('cash','card','bank_transfer','online'))
  reference_number text
  notes           text
  paid_by         uuid → auth.users(id)
  created_at      timestamptz DEFAULT now()
  
  -- Idempotency
  idempotency_key text UNIQUE
)
```

#### dealers
```sql
dealers (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid → auth.users(id)  -- linked auth account
  business_name   text NOT NULL
  phone           text NOT NULL
  email           text
  address         text
  status          text DEFAULT 'active'
    CHECK (status IN ('active','inactive','suspended'))
  commission_type text DEFAULT 'fixed'   -- 'fixed' or 'percentage'
  commission_value numeric DEFAULT 0      -- 50 SAR or 10%
  notes           text
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### referrals
```sql
referrals (
  id              uuid PK DEFAULT gen_random_uuid()
  referral_code   text UNIQUE NOT NULL    -- REF-2026-000001
  dealer_id       uuid NOT NULL → dealers(id)
  customer_id     uuid → customers(id)
  vehicle_id      uuid → vehicles(id)
  
  -- Referral Data
  customer_name   text NOT NULL
  customer_phone  text NOT NULL
  car_make        text
  car_model       text
  car_year        integer
  car_color       text
  
  -- Service
  service_id      uuid → services(id)
  offer_id        uuid → offers(id)
  
  -- Status
  status          text DEFAULT 'created'
    CHECK (status IN ('created','contacted','redeemed','expired','cancelled','completed'))
  
  -- Timestamps
  redeemed_at     timestamptz
  completed_at    timestamptz
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### offers
```sql
offers (
  id              uuid PK DEFAULT gen_random_uuid()
  title           text NOT NULL
  description     text
  offer_type      text NOT NULL
    CHECK (offer_type IN ('fixed_discount','percentage_discount','free_service','special_price'))
  value           numeric                 -- discount amount or percentage
  service_id      uuid → services(id)     -- linked service if applicable
  dealer_id       uuid → dealers(id)      -- NULL = general, specific = dealer-only
  start_date      date
  end_date        date
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### commissions
```sql
commissions (
  id              uuid PK DEFAULT gen_random_uuid()
  referral_id     uuid UNIQUE NOT NULL → referrals(id)  -- UNIQUE: one commission per referral
  dealer_id       uuid NOT NULL → dealers(id)
  amount          numeric NOT NULL
  status          text DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','cancelled'))
  
  -- Payment Details
  paid_at         timestamptz
  paid_by         uuid → auth.users(id)
  payment_notes   text
  
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### materials
```sql
materials (
  id              uuid PK DEFAULT gen_random_uuid()
  name            text NOT NULL
  sku             text UNIQUE NOT NULL
  unit            text NOT NULL
    CHECK (unit IN ('meter','liter','ml','piece','roll','box','bottle'))
  min_stock       numeric DEFAULT 0       -- alert threshold
  max_stock       numeric
  current_stock   numeric DEFAULT 0       -- derived from transactions
  cost_per_unit   numeric DEFAULT 0
  supplier_id     uuid → suppliers(id)
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### service_materials (expected usage per service)
```sql
service_materials (
  id              uuid PK DEFAULT gen_random_uuid()
  service_id      uuid NOT NULL → services(id)
  material_id     uuid NOT NULL → materials(id)
  expected_quantity numeric NOT NULL      -- e.g., 18 meters for full PPF
  
  UNIQUE(service_id, material_id)
)
```

#### inventory_transactions
```sql
inventory_transactions (
  id              uuid PK DEFAULT gen_random_uuid()
  material_id     uuid NOT NULL → materials(id)
  quantity        numeric NOT NULL        -- positive for IN, negative for OUT
  type            text NOT NULL
    CHECK (type IN ('purchase','usage','waste','adjustment','return'))
  reference_type  text                    -- 'booking', 'purchase', 'adjustment'
  reference_id    uuid                    -- FK to booking/purchase/adjustment
  vehicle_id      uuid → vehicles(id)     -- if usage is for specific vehicle
  booking_id      uuid → bookings(id)     -- if linked to booking
  notes           text
  created_by      uuid → auth.users(id)
  created_at      timestamptz DEFAULT now()
  
  -- Idempotency
  idempotency_key text UNIQUE
)
```

#### suppliers
```sql
suppliers (
  id              uuid PK DEFAULT gen_random_uuid()
  name            text NOT NULL
  phone           text
  email           text
  address         text
  notes           text
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### purchases
```sql
purchases (
  id              uuid PK DEFAULT gen_random_uuid()
  supplier_id     uuid NOT NULL → suppliers(id)
  total_amount    numeric NOT NULL
  purchase_date   date NOT NULL
  notes           text
  created_by      uuid → auth.users(id)
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### purchase_items
```sql
purchase_items (
  id              uuid PK DEFAULT gen_random_uuid()
  purchase_id     uuid NOT NULL → purchases(id)
  material_id     uuid NOT NULL → materials(id)
  quantity        numeric NOT NULL CHECK (quantity > 0)
  unit_cost       numeric NOT NULL
  total_cost      numeric NOT NULL
  
  UNIQUE(purchase_id, material_id)
)
```

#### expenses
```sql
expenses (
  id              uuid PK DEFAULT gen_random_uuid()
  title           text NOT NULL           -- "راتب أحمد", "إيجار", "كهرباء"
  amount          numeric NOT NULL CHECK (amount > 0)
  expense_date    date NOT NULL
  notes           text
  created_by      uuid → auth.users(id)
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### staff
```sql
staff (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid → auth.users(id)
  email           text UNIQUE NOT NULL
  full_name       text NOT NULL
  phone           text
  role            text NOT NULL
    CHECK (role IN ('super_admin','admin','receptionist','inventory_manager','technician','accountant'))
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
```

#### notifications
```sql
notifications (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid → auth.users(id)   -- NULL = broadcast
  type            text NOT NULL           -- 'booking_new', 'low_stock', etc.
  title           text NOT NULL
  message         text
  reference_type  text                    -- 'booking', 'invoice', etc.
  reference_id    uuid
  is_read         boolean DEFAULT false
  created_at      timestamptz DEFAULT now()
)
```

#### audit_logs
```sql
audit_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
  user_id         uuid → auth.users(id)
  action          text NOT NULL           -- 'create', 'update', 'delete', 'status_change'
  resource_type   text NOT NULL           -- 'booking', 'invoice', 'payment', etc.
  resource_id     uuid
  old_values      jsonb
  new_values      jsonb
  ip_address      text
  user_agent      text
  created_at      timestamptz DEFAULT now()
)
```

#### settings
```sql
settings (
  key             text PRIMARY KEY
  value           jsonb NOT NULL DEFAULT '{}'
  updated_at      timestamptz DEFAULT now()
)
```

---

## 8. Entity Relationships

```
auth.users ────────────── 1:1 ──────── profiles
auth.users ────────────── 1:1 ──────── staff
auth.users ────────────── 1:1 ──────── dealers (via dealers.user_id)

customers ─────────────── 1:N ──────── vehicles
customers ─────────────── 1:N ──────── bookings
customers ─────────────── 1:N ──────── invoices
customers ─────────────── 1:N ──────── referrals (via referrals.customer_id)

vehicles ──────────────── 1:N ──────── bookings
vehicles ──────────────── 1:N ──────── inventory_transactions (optional)

services ──────────────── 1:N ──────── bookings
services ──────────────── 1:N ──────── service_materials
services ──────────────── 1:N ──────── offers (optional)

bookings ──────────────── 1:1 ──────── booking_status_history (per change)
bookings ──────────────── 1:1 ──────── referrals (optional)
bookings ──────────────── 1:N ──────── invoices (optional)
bookings ──────────────── 1:N ──────── inventory_transactions (optional)

invoices ──────────────── 1:N ──────── payments
invoices ──────────────── N:1 ──────── customers
invoices ──────────────── N:1 ──────── vehicles (optional)

dealers ───────────────── 1:N ──────── referrals
dealers ───────────────── 1:N ──────── offers (optional)
dealers ───────────────── 1:N ──────── commissions

referrals ─────────────── 1:1 ──────── commissions (on completion)
referrals ─────────────── N:1 ──────── dealers
referrals ─────────────── N:1 ──────── customers (optional)

materials ─────────────── 1:N ──────── inventory_transactions
materials ─────────────── 1:N ──────── service_materials
materials ─────────────── 1:N ──────── purchase_items

suppliers ─────────────── 1:N ──────── materials (optional)
suppliers ─────────────── 1:N ──────── purchases

purchases ─────────────── 1:N ──────── purchase_items
```

---

## 9. Booking Architecture

### Data Flow

```
Browser Form
  → Server Action: createBooking()
    → Validate inputs (Zod or manual)
    → Rate limit check
    → Find or create customer (by phone)
    → Find or create vehicle (by customer + make + model + year)
    → Check idempotency (same phone + date + service → reject)
    → Insert booking (status: 'new')
    → Insert booking_status_history
    → Create audit log
    → Create notification
    → Return success
```

### Booking States Diagram

```
                    ┌──────────────┐
                    │     NEW      │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  CONTACTED   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
              ┌─────│  CONFIRMED   │─────┐
              │     └──────┬───────┘     │
              │            │              │
       ┌──────▼───────┐   │     ┌───────▼──────┐
       │   CANCELLED  │   │     │   NO_SHOW    │
       └──────────────┘   │     └──────────────┘
                          │
                   ┌──────▼───────┐
                   │   ARRIVED    │
                   └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │ IN_PROGRESS  │
                   └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │  COMPLETED   │
                   └──────────────┘
```

---

## 10. CRM Architecture

### Customer Profile

```
Customer
  ├── Personal: name, phone, email, source, notes
  ├── Vehicles: [Vehicle, Vehicle, ...]
  │     └── Each Vehicle: make, model, year, color, plate
  ├── Bookings: [Booking, Booking, ...]
  │     └── Each: service, date, status, invoice
  ├── Invoices: [Invoice, Invoice, ...]
  │     └── Each: total, paid, status
  ├── Referral: (optional — came from dealer)
  │     └── Dealer name, offer used
  └── Summary:
        ├── Total Spent: X
        ├── Visit Count: N
        └── Last Visit: date
```

### Deduplication Strategy

```
Customer identified by: phone (unique)

When creating booking:
  1. Find customer by phone
  2. If exists → link to existing customer
  3. If not → create new customer

When dealer creates referral:
  1. Find customer by phone
  2. If exists → link, update referred_by_dealer_id
  3. If not → create new customer
```

---

## 11. Dealer Architecture

### Dealer Portal

```
Dealer Login (Phone OTP)
  → Dealer Dashboard
    ├── My Referrals (list, status, codes)
    ├── New Referral Form
    ├── My Offers (view active offers)
    ├── My Commissions (pending, paid)
    └── Profile (edit business info)
```

### Dealer Data Isolation

```
RLS Policy:
  dealers table: WHERE user_id = auth.uid()
  referrals table: WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())
  commissions table: WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())
  offers table: WHERE dealer_id IS NULL OR dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())
```

### Commission Rules

```
Dealer has:
  - commission_type: 'fixed' | 'percentage'
  - commission_value: 50 (SAR) or 10 (%)

When referral completed:
  - Calculate: commission = fixed_amount OR (service_price * percentage / 100)
  - Create commission record
```

---

## 12. Referral Architecture

### Referral Code Generation

```
Format: REF-YYYY-NNNNNN

Year: current year
Sequential: 000001, 000002, ...

Generated server-side only.
Unique constraint in database.
```

### Referral Lifecycle

```
1. CREATED: Dealer submits referral
2. CONTACTED: Staff contacted customer
3. REDEEMED: Customer arrived, offer applied
4. COMPLETED: Service completed → Commission eligible
5. EXPIRED: Referral timeout (e.g., 30 days)
6. CANCELLED: Referral cancelled by dealer or admin
```

---

## 13. Commission Architecture

### Calculation Rules

```
IF dealer.commission_type = 'fixed':
  commission = dealer.commission_value
  
IF dealer.commission_type = 'percentage':
  commission = service.base_price * dealer.commission_value / 100
```

### Commission States

```
PENDING → APPROVED → PAID
  ↓         ↓
CANCELLED  CANCELLED
```

### Idempotency

```
Unique constraint: commissions.referral_id

This prevents:
  - Creating commission twice for same referral
  - Double payment tracking
```

---

## 14. Invoice Architecture

### Invoice Number Generation

```
Format: INV-YYYY-NNNNNN

Generated server-side.
Unique constraint in database.
```

### Price Calculation

```
Server-side:
  1. Fetch service.base_price
  2. Add additional services prices
  3. Apply discount (if any)
  4. Calculate tax (if applicable)
  5. Total = subtotal - discount + tax

Never trust client-provided prices.
```

### Invoice States

```
DRAFT → ISSUED → PARTIALLY_PAID → PAID
  ↓         ↓          ↓
CANCELLED  CANCELLED  REFUNDED
```

---

## 15. Payment Architecture

### Payment Recording

```
Server Action: recordPayment()
  1. Validate: user has ACCOUNTANT or ADMIN role
  2. Validate: invoice exists and is ISSUED/PARTIALLY_PAID
  3. Validate: payment_amount ≤ (invoice.total - invoice.paid_amount)
  4. Begin Transaction:
     a. INSERT payment
     b. UPDATE invoice: paid_amount += payment_amount
     c. UPDATE invoice status (if fully paid → 'paid')
     d. INSERT audit log
     e. INSERT notification
  5. Commit
```

### Duplicate Prevention

```
idempotency_key on payments table.
If same key exists → return existing payment (don't create new).
```

---

## 16. Inventory Architecture

### Stock Management

```
materials.current_stock = SUM(inventory_transactions.quantity)

Not maintained as a separate column that can be directly edited.
All changes go through inventory_transactions.
```

### Transaction Types

```
PURCHASE:  +quantity (stock increases)
USAGE:     -quantity (stock decreases)
WASTE:     -quantity (stock decreases)
ADJUSTMENT: ±quantity (manual correction)
RETURN:    +quantity (material returned to stock)
```

### Stock Update Formula

```
current_stock = 
  SUM(CASE WHEN type IN ('purchase','return','adjustment_positive') THEN quantity ELSE 0 END)
  - SUM(CASE WHEN type IN ('usage','waste','adjustment_negative') THEN ABS(quantity) ELSE 0 END)
```

### Low Stock Alert

```
When stock decreases:
  IF materials.current_stock <= materials.min_stock:
    Create notification: "Low stock: {material_name}"
```

---

## 17. Purchase Architecture

### Purchase Lifecycle

```
1. Staff creates purchase
2. Server validates: supplier exists, items valid
3. Transaction:
   a. Create purchase record
   b. Create purchase items
   c. Create inventory transactions (PURCHASE)
   d. Update materials.current_stock (atomic)
4. Materials now available for use
```

---

## 18. Expense Architecture

### Simple Model

```
Expenses are standalone records:
  - title: " rent", "electricity", "salary - Ahmed"
  - amount: 5000
  - date: 2026-08-27
  - notes: optional

No complex payroll system.
Salary = expense with title "salary - [name]"
```

### Financial Reporting

```
Revenue: SUM(payments.amount) WHERE invoice is for services
Purchases: SUM(purchases.total_amount)
Expenses: SUM(expenses.amount)
Commissions: SUM(commissions.amount) WHERE status = 'paid'
Net = Revenue - Purchases - Expenses - Commissions
```

---

## 19. Financial Summary Architecture

### Calculation (Server-side Only)

```sql
-- Revenue
SELECT COALESCE(SUM(p.amount), 0) as revenue
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
WHERE p.created_at BETWEEN :start AND :end;

-- Purchases
SELECT COALESCE(SUM(total_amount), 0) as purchases
FROM purchases
WHERE purchase_date BETWEEN :start AND :end;

-- Expenses
SELECT COALESCE(SUM(amount), 0) as expenses
FROM expenses
WHERE expense_date BETWEEN :start AND :end;

-- Commissions
SELECT COALESCE(SUM(amount), 0) as commissions
FROM commissions
WHERE status = 'paid' AND paid_at BETWEEN :start AND :end;

-- Net
Net = Revenue - Purchases - Expenses - Commissions
```

### Time Filters

```
Today | This Week | This Month | This Year | Custom Range
```

---

## 20. Notification Architecture

### Event Types

| Event | Type Key | Recipients |
|-------|----------|------------|
| حجز جديد | booking_new | Admin, Receptionist |
| تأكيد حجز | booking_confirmed | Customer (future), Staff |
| إلغاء حجز | booking_cancelled | Admin, Staff |
| وصول السيارة | booking_arrived | Admin, Staff |
| اكتمال الخدمة | booking_completed | Admin, Staff, Dealer (if referral) |
| انخفاض المخزون | low_stock | Inventory Manager |
| إحالة جديدة | referral_new | Admin |
| استخدام العرض | offer_redeemed | Admin, Dealer |
| عمولة جديدة | commission_new | Admin, Dealer |
| اعتماد العمولة | commission_approved | Dealer |
| دفع العمولة | commission_paid | Dealer, Accountant |
| إصدار فاتورة | invoice_issued | Admin, Accountant |
| استلام دفعة | payment_received | Admin, Accountant |

### Future Channels (Not implemented now)

```
WhatsApp → via API
SMS → via API
Email → via Resend/SendGrid
Push → via Firebase
```

Schema supports: `notifications` table with `type` field for filtering.

---

## 21. Audit Log Architecture

### What Gets Logged

```
- Auth events: login, failed_login, logout
- CRUD: create, update, delete on any entity
- Status changes: booking, invoice, referral, commission
- Financial: payment, refund, commission payment
- Inventory: purchase, usage, waste, adjustment
- Access: role change, permission change
```

### What Does NOT Get Logged

```
- Passwords
- Access tokens
- Secrets
- Personal data beyond necessary
```

### Audit Log Entry

```
{
  user_id: "uuid",
  action: "status_change",
  resource_type: "booking",
  resource_id: "uuid",
  old_values: { status: "confirmed" },
  new_values: { status: "completed" },
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0..."
}
```

### Immutability

```
- Audit logs cannot be updated or deleted by any user
- No UPDATE or DELETE permissions on audit_logs table
- Only INSERT (by system) and SELECT (by admin)
```

---

## 22. Authentication Architecture

### Auth Flow

```
Public User (Phone OTP):
  1. Enter phone number
  2. Receive OTP via Authentica (WhatsApp)
  3. Verify OTP
  4. Supabase creates/finds user
  5. Session stored in cookies
  6. User can create bookings

Staff (Phone OTP):
  1. Enter phone number
  2. Receive OTP
  3. Verify OTP
  4. Server checks: is this phone in staff table?
  5. If yes → staff session
  6. If no → reject

Dealer (Phone OTP):
  1. Enter phone number
  2. Receive OTP
  3. Verify OTP
  4. Server checks: is this phone linked to a dealer?
  5. If yes → dealer session
  6. If no → reject
```

### Session Management

```
- Supabase SSR handles session via cookies
- Middleware refreshes session on every request
- Session expires after configured period
- No long-lived tokens
```

---

## 23. Authorization Architecture

### Server-side Authorization

```
Every Server Action:
  1. Get user from session (supabase.auth.getUser())
  2. Fetch staff/dealer record
  3. Check role against required permission
  4. If dealer: check ownership
  5. If insufficient → 403
```

### RLS Authorization

```
Every table has RLS policies:
  - Public tables (services, settings): SELECT for all
  - User data (customers, bookings): SELECT for own only
  - Dealer data: SELECT for own dealer only
  - Admin data: SELECT for staff with admin role
  - Sensitive data: restricted by role
```

---

## 24. RLS Strategy

### Policy Types

```sql
-- 1. Public Read
CREATE POLICY "Public read" ON services FOR SELECT USING (true);

-- 2. Owner Only
CREATE POLICY "Owner read" ON customers 
  FOR SELECT USING (
    id IN (SELECT customer_id FROM bookings WHERE created_by = auth.uid())
    OR created_by = auth.uid()
  );

-- 3. Staff Only
CREATE POLICY "Staff access" ON bookings 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','receptionist'))
  );

-- 4. Dealer Own Data
CREATE POLICY "Dealer own referrals" ON referrals 
  FOR SELECT USING (
    dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())
  );

-- 5. Specific Role
CREATE POLICY "Inventory manager" ON materials 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'inventory_manager')
  );
```

### RLS Enforcement

```
Level 1: Application (Server Actions check role)
Level 2: Database (RLS policies enforce access)
Level 3: PostgreSQL (constraints prevent invalid data)
```

---

## 25. Security Architecture

### OWASP Top 10 Mitigations

| Risk | Mitigation |
|------|------------|
| Broken Access Control | RLS + Server-side auth check + RBAC |
| Cryptographic Failures | HTTPS only, secrets in env vars, hashed OTP |
| Injection | Supabase parameterized queries, no raw SQL |
| Insecure Design | Threat modeling, least privilege |
| Security Misconfiguration | CSP headers, CORS, security headers in middleware |
| Vulnerable Components | Regular npm audit, updated dependencies |
| Auth Failures | Rate limiting on OTP, session management |
| Data Integrity | Database transactions, idempotency keys |
| Logging Failures | Audit logs (immutable) |
| SSRF | No user-controlled URLs in server requests |

### Rate Limiting

```
Endpoints to rate-limit:
  - POST /api/otp/send         → 3 per phone per 5 min
  - POST /api/otp/verify       → 5 per phone per 5 min
  - POST /api/bookings         → 5 per phone per hour
  - POST /api/dealer/referrals → 10 per dealer per hour
  - POST /api/payments         → 10 per user per hour
```

### File Upload Security

```
Storage buckets:
  - avatars: profile pictures (public read)
  - documents: invoices, receipts (staff only)
  - vehicles: vehicle images (staff only)

Rules:
  - Validate file type (images only for avatars)
  - Max file size: 5MB
  - No executable files
  - Scan for malware (future)
```

---

## 26. Server / Client Boundaries

### Server Components (Default)

```
- Pages that display data (Server Components)
  /services
  /services/[slug]
  /dashboard
  /admin/bookings
  /admin/customers
  etc.

- Layouts that fetch data
  app/layout.tsx
  app/admin/layout.tsx
```

### Client Components

```
- Interactive forms
  BookingForm
  InvoiceForm
  PaymentForm
  ReferralForm
  ExpenseForm

- Real-time updates
  NotificationBell
  BookingStatusBadge

- Modals and dialogs
  ConfirmDialog
  StatusChangeDialog

- State management
  SearchFilters
  DateRangePicker
```

### Server Actions

```
'use server'

All mutations:
  - createBooking()
  - updateBookingStatus()
  - createInvoice()
  - recordPayment()
  - createReferral()
  - completeService()
  - createPurchase()
  - createExpense()
  - createMaterial()
  - etc.

All use: validate, check auth, execute, audit, return
```

### API Routes

```
app/api/
  ├── otp/send/route.ts           → External: Authentica
  ├── otp/verify/route.ts         → External: Authentica
  ├── settings/public/route.ts    → Public settings
  ├── webhooks/moyasar/route.ts   → Payment gateway webhook
  └── webhooks/tamara/route.ts    → Payment gateway webhook
```

### Database Functions (RPC)

```sql
-- Generate sequential numbers
CREATE FUNCTION generate_referral_code() RETURNS text
CREATE FUNCTION generate_invoice_number() RETURNS text

-- Calculate stock
CREATE FUNCTION get_current_stock(p_material_id uuid) RETURNS numeric

-- Financial summary
CREATE FUNCTION get_financial_summary(p_start date, p_end date) RETURNS jsonb
```

---

## 27. Transaction Requirements

### Operations Requiring DB Transactions

| Operation | Tables Affected | Isolation |
|-----------|-----------------|-----------|
| Service Completion | bookings + inventory_transactions + materials + referrals + commissions | SERIALIZABLE |
| Payment Recording | payments + invoices | READ COMMITTED |
| Purchase Receiving | purchases + purchase_items + inventory_transactions + materials | SERIALIZABLE |
| Commission Creation | commissions + referrals | READ COMMITTED |

### Transaction Pattern

```sql
BEGIN;
  -- Validate
  -- Insert/Update
  -- Insert audit log
COMMIT;

-- On error: automatic ROLLBACK
```

---

## 28. Idempotency Requirements

### Operations Needing Idempotency

| Operation | Idempotency Key | Prevention |
|-----------|-----------------|------------|
| Booking | phone + date + service_id | UNIQUE constraint |
| Payment | idempotency_key | UNIQUE constraint |
| Inventory Usage | booking_id + material_id | UNIQUE constraint |
| Commission | referral_id | UNIQUE constraint |
| Purchase | (manual — no auto-dedup) | Staff review |

---

## 29. Scalability Strategy

### Architecture Decisions for Future Growth

```
1. Multi-Branch:
   - Add branch_id to all business tables
   - RLS filters by branch
   - No schema change needed

2. Multi-Warehouse:
   - Add warehouse_id to materials + inventory_transactions
   - Stock per warehouse
   - Transfer transactions between warehouses

3. Online Payments:
   - Add payment_provider field to payments
   - Webhook handlers for Moyasar/Tamara
   - No schema change needed

4. WhatsApp/SMS/Email:
   - Notifications table already supports channel field
   - Add delivery_status, external_id
   - Notification workers per channel

5. English Language:
   - Add locale field to content tables
   - OR use separate translation tables
   - RTL/LTR handled by Next.js i18n

6. Mobile App:
   - Same Supabase backend
   - Same RLS policies
   - Same Server Actions (via API)
```

---

## 30. Performance Strategy

### Database

```
- Indexes on frequently queried columns:
  customers.phone
  bookings.customer_id, bookings.status, bookings.created_at
  invoices.customer_id, invoices.status
  referrals.dealer_id, referrals.status
  inventory_transactions.material_id, inventory_transactions.created_at
  audit_logs.user_id, audit_logs.created_at

- Pagination: LIMIT/OFFSET or cursor-based
- Avoid SELECT * — select only needed columns
- Use Supabase's .single() for single rows
```

### Frontend

```
- Server Components (default) — no client JS
- Dynamic imports for heavy components
- Next.js Image component for optimization
- Skeleton loading states
- Lazy loading for below-fold content
- ISR for public pages (services, about)
```

### Caching

```
- Public pages: ISR (revalidate: 300)
- Settings: cached with revalidation
- No client-side caching of sensitive data
```

---

## 31. SEO Strategy

### Public Pages

```
/services           → All services
/services/[slug]    → Service detail
/offers             → Current offers
/dealers            → Dealer directory (future)
/about              → About us
/contact            → Contact

Each page:
  - Title: unique, descriptive
  - Meta description: unique
  - Canonical URL
  - OpenGraph tags
  - Structured data (LocalBusiness, Service)
  - Arabic language tag
  - RTL direction
```

### Sitemap

```
Dynamic sitemap from services table.
Updated on service publish/unpublish.
```

---

## 32. Backup Strategy

### Supabase Backups

```
- Daily automated backups (Supabase Pro plan)
- Point-in-time recovery (PITR) for last 7 days
- Manual backup before major migrations
```

### Backup Verification

```
- Monthly restore test to staging
- Verify data integrity
- Document restore procedure
```

### Critical Data

```
- Customers
- Bookings
- Invoices + Payments
- Inventory Transactions
- Audit Logs
- Commissions
```

---

## 33. Monitoring Strategy

### What to Monitor

```
- Server errors (Vercel logs)
- Database errors (Supabase dashboard)
- Failed logins (audit_logs)
- Rate limit violations
- Low stock alerts
- Payment failures
- Webhook failures
```

### What NOT to Monitor

```
- Passwords
- Tokens
- Secrets
- Personal data in logs
```

### Alerting

```
- Low stock → notification to inventory manager
- Payment failure → notification to admin
- High error rate → notification to developer
```

---

## 34. Risks and Edge Cases

### Race Conditions

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Two staff complete same booking | Double inventory deduction | Status check + idempotency |
| Concurrent inventory usage | Stock goes negative | Atomic UPDATE with CHECK |
| Two payments for same invoice | Overpayment | Atomic balance check |
| Two commissions for same referral | Duplicate commission | UNIQUE(referral_id) |

### Data Integrity

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Customer deleted with bookings | Orphaned records | Soft delete only |
| Service deleted with bookings | Broken references | is_active flag, not delete |
| Dealer deleted with referrals | Broken references | Soft delete only |
| Material deleted with transactions | Broken references | is_active flag |

### Business Edge Cases

| Scenario | Handling |
|----------|----------|
| Customer books same service twice on same day | Allow (different times) or block based on business rule |
| Dealer referral for existing customer | Link referral to existing customer |
| Commission rule changes mid-month | Commission uses rule at time of creation |
| Service price changes after booking | Booking uses price at time of booking |
| Material stock goes to 0 during service | Block completion, require purchase first |
| Refund after commission paid | Cancel commission or deduct from next payment |

---

## 35. Recommended Implementation Phases

### Phase 1: Foundation (Week 1-2)

```
1. Database Schema
   - All tables
   - All RLS policies
   - All indexes
   - All triggers

2. Auth System
   - Supabase Auth setup
   - Phone OTP flow
   - Staff login
   - Dealer login
   - Middleware

3. Core Layout
   - Root layout (RTL, Arabic)
   - Admin layout
   - Dealer layout
   - Navigation
```

### Phase 2: Core Business (Week 3-4)

```
4. Services Module
   - Service CRUD (Admin)
   - Service listing (Public)
   - Service detail (Public)

5. Customers & Vehicles
   - Customer CRUD
   - Vehicle CRUD
   - CRM views

6. Booking System
   - Booking form (Public)
   - Booking management (Admin)
   - Status flow
```

### Phase 3: Financial (Week 5-6)

```
7. Invoices
   - Invoice creation
   - Invoice management
   - Price calculation (Server-side)

8. Payments
   - Payment recording
   - Invoice status updates
   - Duplicate prevention

9. Expenses
   - Simple expense CRUD
   - Expense reports
```

### Phase 4: Inventory (Week 7-8)

```
10. Materials & Inventory
    - Material CRUD
    - Inventory transactions
    - Stock management
    - Low stock alerts

11. Suppliers & Purchases
    - Supplier CRUD
    - Purchase recording
    - Stock increase flow
```

### Phase 5: Dealer System (Week 9-10)

```
12. Dealers
    - Dealer CRUD
    - Dealer portal

13. Referrals
    - Referral creation
    - Referral flow
    - Code generation

14. Offers
    - Offer CRUD
    - Offer assignment

15. Commissions
    - Commission calculation
    - Commission management
    - Payment tracking
```

### Phase 6: Dashboard & Reports (Week 11-12)

```
16. Dashboard
    - Statistics
    - Charts
    - Quick actions

17. Reports
    - Sales report
    - Booking report
    - Customer report
    - Dealer report
    - Inventory report
    - Expense report
    - Financial summary

18. Notifications
    - In-app notifications
    - Notification center

19. Audit Logs
    - Audit log viewer
    - Filter by action/resource
```

### Phase 7: Polish (Week 13-14)

```
20. SEO
    - Meta tags
    - Sitemap
    - Structured data

21. Performance
    - Optimization
    - Caching
    - Lazy loading

22. Security Audit
    - Penetration testing
    - RLS verification
    - Permission review

23. Testing
    - Unit tests
    - Integration tests
    - E2E tests
```

---

## ملخص

هذه المعمارية تغطي:

- **22 Module** — كل module محدد مسؤولياته وعلاقته
- **10 Business Flows** — كل flow مفصل بالخطوات
- **7 User Roles** — كل role بصلاحياته
- **25+ Database Entity** — كل entity بأعمدته وعلاقاته
- **Security by Design** — RBAC + RLS + Validation + Audit
- **Scalability** — قابل للفروع والمستودعات والدفع الإلكتروني
- **Simplicity** — مصاريف بسيطة، محاسبة Basic، لا تعقيد زائد

**下一步**: بعد اعتماد هذه المعمارية، نبدأ Phase 1: Foundation.
