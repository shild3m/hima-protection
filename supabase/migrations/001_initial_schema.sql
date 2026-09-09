-- ============================================================
-- PHASE 02B — DATABASE SCHEMA (Reviewed & Corrected)
-- منصة تظليل وحة السيارات
-- Migration: 001_initial_schema
-- ============================================================

-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. Tables (in dependency order)
-- ============================================================

-- ============================================================
-- PROFILES
-- Purpose: Application data linked to auth.users
-- auth.users = Authentication identity
-- profiles = Application profile (name, phone, avatar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  email      text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STAFF
-- Purpose: Staff members with roles
-- One auth user → one staff record (optional)
-- Dealer users do NOT have staff records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email      text NOT NULL UNIQUE,
  full_name  text NOT NULL,
  phone      text,
  role       text NOT NULL CHECK (role IN (
    'super_admin','admin','receptionist',
    'inventory_manager','technician','accountant'
  )),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text,
  email      text,
  address    text,
  notes      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SERVICES
-- Purpose: Car tinting/protection services
-- slug is UNIQUE for public URLs: /services/window-tint
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  short_description text,
  description       text,
  base_price        numeric NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  duration_minutes  integer CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  is_active         boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 0,
  image_url         text,
  meta_title        text,
  meta_description  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SERVICE IMAGES
-- Separated from services for scalability (multiple images)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  image_url     text NOT NULL,
  alt_text      text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MATERIALS
-- Purpose: Physical materials used in services (PPF, tint, etc.)
-- current_stock = cached balance from inventory_transactions
-- stock is ONLY modified via inventory_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  sku             text NOT NULL UNIQUE,
  unit            text NOT NULL CHECK (unit IN ('meter','liter','ml','piece','roll','box','bottle')),
  min_stock       numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  max_stock       numeric CHECK (max_stock IS NULL OR max_stock >= 0),
  current_stock   numeric NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  cost_per_unit   numeric NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  supplier_id     uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SERVICE MATERIALS
-- Expected material usage per service (N:N)
-- e.g., Full PPF requires 18 meters of PPF material
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_materials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  material_id       uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  expected_quantity numeric NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  notes             text,
  UNIQUE(service_id, material_id)
);

-- ============================================================
-- DEALERS
-- Purpose: Car dealerships that refer customers
-- dealer login via auth.users (phone OTP)
-- dealer isolation: RLS ensures dealer A cannot see dealer B
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dealers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name     text NOT NULL,
  phone             text NOT NULL,
  email             text,
  address           text,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  commission_type   text NOT NULL DEFAULT 'fixed' CHECK (commission_type IN ('fixed','percentage')),
  commission_value   numeric NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CUSTOMERS
-- Purpose: Customer records
-- phone = UNIQUE for deduplication
-- Decision: One customer = one phone number
-- If phone changes → UPDATE, not create new
-- Never soft-delete customers (financial/legal records)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name               text NOT NULL,
  phone                   text NOT NULL UNIQUE,
  email                   text,
  source                  text CHECK (source IN ('walk_in','referral','online','social','phone')),
  referred_by_dealer_id   uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  notes                   text,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CUSTOMER NOTES
-- Purpose: Timestamped notes about customers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- VEHICLES
-- Purpose: Cars owned by customers
-- customer_id → customers (required)
-- No unique on plate_number (plates change, multiple branches future)
-- No unique on VIN (not all cars have VIN, data quality varies)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  make         text NOT NULL,
  model        text NOT NULL,
  year         integer,
  color        text,
  plate_number text,
  vin          text,
  notes        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- OFFERS
-- Purpose: Promotional offers
-- dealer_id IS NULL → general offer (public)
-- dealer_id IS NOT NULL → dealer-specific offer
-- ============================================================
CREATE TABLE IF NOT EXISTS public.offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  offer_type  text NOT NULL CHECK (offer_type IN ('fixed_discount','percentage_discount','free_service','special_price')),
  value       numeric CHECK (value IS NULL OR value >= 0),
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  dealer_id   uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  start_date  date,
  end_date    date CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REFERRALS
-- Purpose: Customer referrals from dealers
-- referral_code = REF-YYYY-NNNNNN (unique, generated server-side)
-- customer_id/vehicle_id are optional (may not exist yet)
-- vehicle_id → vehicles (FK added after vehicles table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code   text NOT NULL UNIQUE,
  dealer_id       uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id      uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  car_make        text,
  car_model       text,
  car_year        integer,
  car_color       text,
  offer_id        uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'created' CHECK (status IN ('created','contacted','redeemed','expired','cancelled','completed')),
  redeemed_at     timestamptz,
  completed_at    timestamptz,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REFERRAL SERVICES
-- Purpose: Services linked to a referral (N:N)
-- A referral can recommend multiple services
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referral_services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referral_id, service_id)
);

-- ============================================================
-- COMMISSIONS
-- Purpose: Dealer commissions for completed referrals
-- UNIQUE(referral_id) = one commission per referral
-- Snapshot: calculation_type, rate_value, calculated_amount
--   are stored at creation time and NEVER recalculated
-- ============================================================
CREATE TABLE IF NOT EXISTS public.commissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id         uuid NOT NULL UNIQUE REFERENCES public.referrals(id) ON DELETE RESTRICT,
  dealer_id           uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  service_id          uuid REFERENCES public.services(id) ON DELETE SET NULL,
  calculation_type    text NOT NULL CHECK (calculation_type IN ('fixed','percentage')),
  rate_value          numeric NOT NULL DEFAULT 0 CHECK (rate_value >= 0),
  calculated_amount   numeric NOT NULL DEFAULT 0 CHECK (calculated_amount >= 0),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  approved_at         timestamptz,
  approved_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at             timestamptz,
  paid_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_notes       text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- BOOKINGS
-- Purpose: Customer appointment bookings
-- service_id = PRIMARY service (required)
-- booking_items = ADDITIONAL services (optional)
-- idempotency_key = client-generated UUID (prevent duplicate submission)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id        uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  service_id        uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','arrived','in_progress','completed','cancelled','no_show')),
  preferred_date    date,
  preferred_time    time,
  referral_id       uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  customer_notes    text,
  admin_notes       text,
  source            text DEFAULT 'walk_in' CHECK (source IN ('walk_in','online','referral','phone')),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  idempotency_key   text UNIQUE
);

-- ============================================================
-- BOOKING ITEMS
-- Purpose: Additional services in a booking
-- Each item snapshots the price at booking time
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total       numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- BOOKING STATUS HISTORY
-- Purpose: Audit trail for booking status changes
-- Append-only (no UPDATE/DELETE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text NOT NULL,
  changed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INVOICES
-- Purpose: Customer invoices
-- All financial values calculated SERVER-SIDE
-- invoice_number = INV-YYYY-NNNNNN (unique, server-generated)
-- paid_amount is ONLY updated via payments table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text NOT NULL UNIQUE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id      uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  booking_id      uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  subtotal        numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount        numeric NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_rate        numeric NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount      numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total           numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid_amount     numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','cancelled','refunded')),
  issued_at       timestamptz,
  cancelled_at    timestamptz,
  cancelled_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INVOICE ITEMS
-- Purpose: Line items in an invoice
-- price/unit_price are SNAPSHOTS at invoice creation time
-- If service price changes later → old invoices are NOT affected
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount    numeric NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_rate    numeric NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  total       numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PAYMENTS
-- Purpose: Invoice payments
-- idempotency_key = client-generated UUID per payment attempt
-- amount is validated server-side: ≤ (invoice.total - invoice.paid_amount)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount            numeric NOT NULL CHECK (amount > 0),
  payment_method    text NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer','online')),
  reference_number  text,
  paid_at           timestamptz NOT NULL DEFAULT now(),
  notes             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  idempotency_key   text UNIQUE
);

-- ============================================================
-- INVENTORY TRANSACTIONS
-- Purpose: Immutable ledger of all stock movements
-- This is the SOURCE OF TRUTH for stock levels
-- materials.current_stock = cached balance
-- quantity: positive = IN (purchase, return), negative = OUT (usage, waste)
-- idempotency_key = "booking_{booking_id}_material_{material_id}"
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity          numeric NOT NULL CHECK (quantity <> 0),
  type              text NOT NULL CHECK (type IN ('purchase','usage','waste','adjustment','return')),
  reference_type    text,
  reference_id      uuid,
  vehicle_id        uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  booking_id        uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  service_id        uuid REFERENCES public.services(id) ON DELETE SET NULL,
  notes             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  idempotency_key   text UNIQUE
);

-- ============================================================
-- PURCHASES
-- Purpose: Purchase orders from suppliers
-- status: draft → received → cancelled
-- total_amount = sum of purchase_items.total_cost
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','received','cancelled')),
  total_amount  numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  purchase_date date NOT NULL,
  received_at   timestamptz,
  notes         text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PURCHASE ITEMS
-- Purpose: Items in a purchase order
-- ============================================================
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  quantity    numeric NOT NULL CHECK (quantity > 0),
  unit_cost   numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost  numeric NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(purchase_id, material_id)
);

-- ============================================================
-- EXPENSES
-- Purpose: Simple expense tracking
-- No complex payroll system — salary = expense "راتب أحمد"
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  amount       numeric NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- Purpose: In-app notifications
-- Extensible: add channel field later for WhatsApp/SMS/Email
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  message         text,
  reference_type  text,
  reference_id    uuid,
  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS
-- Purpose: Immutable append-only audit trail
-- NEVER UPDATE, NEVER DELETE
-- bigint PK for high-volume writes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   uuid,
  old_values    jsonb,
  new_values    jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SETTINGS
-- Purpose: Key-value system settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

-- profiles: phone lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- vehicles: customer's vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON public.vehicles(customer_id);

-- services: active services listing
CREATE INDEX IF NOT EXISTS idx_services_active_order ON public.services(is_active, display_order);

-- service_images: images for a service
CREATE INDEX IF NOT EXISTS idx_service_images_service_id ON public.service_images(service_id);

-- service_materials: materials for a service
CREATE INDEX IF NOT EXISTS idx_service_materials_service_id ON public.service_materials(service_id);
CREATE INDEX IF NOT EXISTS idx_service_materials_material_id ON public.service_materials(material_id);

-- bookings: customer bookings, date queries, status filtering
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_id ON public.bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON public.bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at);

-- booking_items: items for a booking
CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id ON public.booking_items(booking_id);

-- booking_status_history: history for a booking
CREATE INDEX IF NOT EXISTS idx_booking_status_history_booking_id ON public.booking_status_history(booking_id);

-- invoices: customer invoices, status filtering, date queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at);

-- invoice_items: items for an invoice
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- payments: payments for an invoice
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- dealers: status filtering
CREATE INDEX IF NOT EXISTS idx_dealers_status ON public.dealers(status);

-- referrals: dealer's referrals, customer's referrals, status, date
CREATE INDEX IF NOT EXISTS idx_referrals_dealer_id ON public.referrals(dealer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_customer_id ON public.referrals(customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals(created_at);

-- referral_services: services for a referral
CREATE INDEX IF NOT EXISTS idx_referral_services_referral_id ON public.referral_services(referral_id);

-- commissions: dealer's commissions, status
CREATE INDEX IF NOT EXISTS idx_commissions_dealer_id ON public.commissions(dealer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);

-- materials: supplier's materials, active materials
CREATE INDEX IF NOT EXISTS idx_materials_supplier_id ON public.materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_materials_active ON public.materials(is_active);

-- inventory_transactions: material transactions, type filtering, date queries
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_material_id ON public.inventory_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON public.inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON public.inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ref ON public.inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_booking ON public.inventory_transactions(booking_id);

-- purchase_items: items for a purchase
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);

-- expenses: date-based queries
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);

-- notifications: user's unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- audit_logs: user's actions, resource audit trail, date queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ============================================================
-- 4. Functions
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.dealers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- handle_new_user: Auto-create profile on auth.users insert
-- SECURITY DEFINER with fixed search_path for security
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. RLS (Minimal — expanded in Phase 03)
-- ============================================================

-- Enable RLS on all tables (default deny)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ ONLY: Services (active) — for public website
CREATE POLICY "public_select_active_services"
  ON public.services FOR SELECT
  USING (is_active = true);

-- PUBLIC READ ONLY: Service images — for public website
CREATE POLICY "public_select_service_images"
  ON public.service_images FOR SELECT
  USING (true);

-- PUBLIC READ ONLY: General offers (dealer_id IS NULL) — for public website
CREATE POLICY "public_select_general_offers"
  ON public.offers FOR SELECT
  USING (is_active = true AND dealer_id IS NULL);

-- NO public INSERT/UPDATE/DELETE on any table
-- All mutations go through Server Actions / API Routes
-- This ensures:
--   Browser → Server → Validation → Controlled DB Operation

-- ============================================================
-- 6. Idempotency Keys (Documentation)
-- ============================================================

-- Bookings: idempotency_key = client-generated UUID
--   Client generates UUID, sends with request
--   If duplicate request → same key → INSERT fails → return existing
--   Prevents: double-click, network retry, API retry

-- Payments: idempotency_key = client-generated UUID
--   Same pattern as bookings
--   Prevents: double payment submission

-- Inventory: idempotency_key = 'usage_{booking_id}_{material_id}'
--   Prevents: same service completion deducting stock twice

-- Commissions: UNIQUE(referral_id)
--   Prevents: creating commission twice for same referral

-- ============================================================
-- 7. Transaction Requirements (Documentation)
-- ============================================================

-- Service Completion Transaction:
--   BEGIN;
--     1. Validate booking.status IN ('arrived', 'in_progress')
--     2. Validate materials have sufficient stock
--     3. UPDATE bookings SET status = 'completed'
--     4. INSERT booking_status_history
--     5. FOR EACH material used:
--        a. Check idempotency_key not exists
--        b. INSERT inventory_transactions (type: 'usage', qty: -actual)
--        c. UPDATE materials SET current_stock = current_stock - actual
--           WHERE id = material_id AND current_stock >= actual
--           (atomic: fails if insufficient stock)
--     6. IF referral exists:
--        a. UPDATE referrals SET status = 'completed'
--        b. INSERT commissions (if not exists)
--     7. INSERT audit_log
--     8. INSERT notifications
--   COMMIT;
--   On any failure → automatic ROLLBACK

-- Payment Recording Transaction:
--   BEGIN;
--     1. SELECT ... FOR UPDATE on invoice (row lock)
--     2. Validate invoice.status IN ('issued', 'partially_paid')
--     3. Validate amount ≤ (invoice.total - invoice.paid_amount)
--     4. INSERT payments
--     5. UPDATE invoices SET paid_amount = paid_amount + amount
--     6. UPDATE invoices SET status = CASE
--          WHEN paid_amount + amount >= total THEN 'paid'
--          ELSE 'partially_paid'
--        END
--     7. INSERT audit_log
--   COMMIT;

-- Purchase Receiving Transaction:
--   BEGIN;
--     1. Validate purchase.status = 'draft'
--     2. FOR EACH item:
--        a. INSERT purchase_items
--        b. INSERT inventory_transactions (type: 'purchase', qty: +qty)
--        c. UPDATE materials SET current_stock = current_stock + qty
--     3. UPDATE purchases SET status = 'received', received_at = now()
--     4. INSERT audit_log
--   COMMIT;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
