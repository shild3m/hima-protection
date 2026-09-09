-- ============================================================
-- PHASE 05 HARDENING MIGRATIONS
-- Execute in Supabase SQL Editor (Dashboard)
-- Date: 2026-08-26
--
-- SAFETY NOTES:
-- - No DROP SEQUENCE or DROP FUNCTION statements.
-- - Uses CREATE OR REPLACE (idempotent) for functions.
-- - Uses CREATE SEQUENCE IF NOT EXISTS for sequences.
-- - Sequence is initialized from existing invoice data to prevent
--   duplicate invoice numbers. If no invoices exist, starts at 0.
-- - This migration is safe to run multiple times (idempotent).
-- - No production data is modified or deleted.
-- ============================================================


-- ============================================================
-- MIGRATION 1: Invoice Number Sequence + Function
-- Purpose: Concurrency-safe invoice number generation
-- ============================================================

-- Create sequence idempotently (safe to run multiple times)
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

-- Initialize sequence from existing invoice data.
-- Extracts the numeric suffix from the highest existing invoice number.
-- If no invoices exist, sets to 0 so the first nextval returns 1.
-- This prevents duplicate invoice numbers with existing data.
-- Safe to run multiple times: setval resets to current table max,
-- which is correct even if sequence was already used.
DO $$
DECLARE
  v_max_num bigint;
BEGIN
  SELECT COALESCE(
    (SELECT MAX(
      substring(invoice_number from 'INV-\d{4}-(\d+)$')::bigint
    ) FROM public.invoices),
    0
  ) INTO v_max_num;

  IF v_max_num > 0 THEN
    PERFORM setval('public.invoice_number_seq', v_max_num);
  END IF;
END $$;

-- Atomic function: generates next invoice number via PostgreSQL sequence.
-- SECURITY DEFINER ensures the function runs with owner privileges,
-- so the caller does not need direct USAGE on the sequence.
-- Authorization is checked inside create_invoice() / update_invoice(),
-- not in this helper function (generating a number is not a privileged operation).
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_next bigint;
  v_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_next := nextval('public.invoice_number_seq');
  v_number := 'INV-' || v_year || '-' || lpad(v_next::text, 6, '0');
  RETURN v_number;
END;
$$;


-- ============================================================
-- MIGRATION 2: create_invoice() RPC
-- Purpose: Atomic invoice + items creation in single transaction.
-- All validation, authorization, and calculations happen inside
-- this function within a single PostgreSQL transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_invoice(
  p_customer_id   uuid,
  p_vehicle_id    uuid DEFAULT NULL,
  p_booking_id    uuid DEFAULT NULL,
  p_discount      numeric DEFAULT 0,
  p_tax_rate      numeric DEFAULT 0,
  p_notes         text DEFAULT NULL,
  p_items         jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_invoice_id  uuid;
  v_inv_number  text;
  v_subtotal    numeric := 0;
  v_tax_amount  numeric;
  v_total       numeric;
  v_item        jsonb;
  v_item_total  numeric;
  v_service_id  uuid;
BEGIN
  -- Authorization: must be authenticated and have invoices:create
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_permission(v_caller_id, 'invoices', 'create') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: invoices.create');
  END IF;

  -- Validate customer exists
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found or inactive');
  END IF;

  -- Validate vehicle belongs to customer
  IF p_vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE id = p_vehicle_id AND customer_id = p_customer_id AND is_active = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vehicle not found or does not belong to customer');
    END IF;
  END IF;

  -- Validate booking belongs to customer
  IF p_booking_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE id = p_booking_id AND customer_id = p_customer_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking not found or does not belong to customer');
    END IF;
  END IF;

  -- Validate items array is not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one item required');
  END IF;

  -- Validate invoice-level inputs
  IF p_discount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discount cannot be negative');
  END IF;
  IF p_tax_rate < 0 OR p_tax_rate > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tax rate must be between 0 and 100');
  END IF;

  -- Calculate subtotal from items (validate each item)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate item fields
    IF (v_item->>'description') IS NULL OR trim(v_item->>'description') = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item description is required');
    END IF;
    IF (v_item->>'quantity') IS NULL OR (v_item->>'quantity')::numeric <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item quantity must be greater than 0');
    END IF;
    IF (v_item->>'unit_price') IS NULL OR (v_item->>'unit_price')::numeric < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item unit price cannot be negative');
    END IF;
    IF COALESCE((v_item->>'discount')::numeric, 0) < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item discount cannot be negative');
    END IF;
    IF COALESCE((v_item->>'tax_rate')::numeric, 0) < 0
       OR COALESCE((v_item->>'tax_rate')::numeric, 0) > 100 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item tax rate must be between 0 and 100');
    END IF;

    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
                    - COALESCE((v_item->>'discount')::numeric, 0);
    IF v_item_total < 0 THEN v_item_total := 0; END IF;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  -- Calculate tax and total
  v_tax_amount := v_subtotal * (p_tax_rate / 100);
  v_total := v_subtotal + v_tax_amount - p_discount;

  IF v_total < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Total cannot be negative');
  END IF;

  -- Generate invoice number (concurrency-safe via sequence)
  v_inv_number := public.generate_invoice_number();

  -- Insert invoice + items atomically (single transaction)
  INSERT INTO public.invoices (
    invoice_number, customer_id, vehicle_id, booking_id,
    subtotal, discount, tax_rate, tax_amount, total,
    paid_amount, status, notes, created_by
  ) VALUES (
    v_inv_number, p_customer_id, p_vehicle_id, p_booking_id,
    v_subtotal, p_discount, p_tax_rate, v_tax_amount, v_total,
    0, 'draft', p_notes, v_caller_id
  ) RETURNING id INTO v_invoice_id;

  -- Insert all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
                    - COALESCE((v_item->>'discount')::numeric, 0);
    IF v_item_total < 0 THEN v_item_total := 0; END IF;

    -- Validate service exists (optional field — set to NULL if invalid)
    v_service_id := NULL;
    IF (v_item->>'service_id') IS NOT NULL AND (v_item->>'service_id') != 'null' THEN
      v_service_id := (v_item->>'service_id')::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id AND is_active = true) THEN
        v_service_id := NULL;
      END IF;
    END IF;

    INSERT INTO public.invoice_items (
      invoice_id, service_id, description, quantity, unit_price, discount, tax_rate, total
    ) VALUES (
      v_invoice_id,
      v_service_id,
      trim(v_item->>'description'),
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount')::numeric, 0),
      COALESCE((v_item->>'tax_rate')::numeric, 0),
      v_item_total
    );
  END LOOP;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (v_caller_id, 'invoice_created', 'invoices', v_invoice_id,
    jsonb_build_object(
      'invoice_number', v_inv_number,
      'total', v_total,
      'customer_id', p_customer_id,
      'item_count', jsonb_array_length(p_items)
    ));

  RETURN jsonb_build_object(
    'success', true, 'invoice_id', v_invoice_id,
    'invoice_number', v_inv_number, 'total', v_total
  );
END;
$$;


-- ============================================================
-- MIGRATION 3: update_invoice() RPC
-- Purpose: Atomic invoice + items update in single transaction.
-- Only draft invoices can be edited. Uses FOR UPDATE row lock.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_invoice(
  p_invoice_id  uuid,
  p_discount    numeric DEFAULT NULL,
  p_tax_rate    numeric DEFAULT NULL,
  p_notes       text DEFAULT NULL,
  p_items       jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid;
  v_invoice    record;
  v_subtotal   numeric;
  v_discount   numeric;
  v_tax_rate   numeric;
  v_tax_amount numeric;
  v_total      numeric;
  v_item       jsonb;
  v_item_total numeric;
  v_service_id uuid;
BEGIN
  -- Authorization
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_permission(v_caller_id, 'invoices', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: invoices.update');
  END IF;

  -- Lock invoice row to prevent concurrent modifications
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  -- Only draft invoices can be edited
  IF v_invoice.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft invoices can be edited');
  END IF;

  -- Validate inputs
  IF p_discount IS NOT NULL AND p_discount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discount cannot be negative');
  END IF;
  IF p_tax_rate IS NOT NULL AND (p_tax_rate < 0 OR p_tax_rate > 100) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tax rate must be between 0 and 100');
  END IF;

  -- Resolve discount and tax_rate (use provided values or keep existing)
  v_discount := COALESCE(p_discount, v_invoice.discount);
  v_tax_rate := COALESCE(p_tax_rate, v_invoice.tax_rate);

  IF p_items IS NOT NULL THEN
    -- Full item replacement: validate, delete old, insert new
    IF jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'At least one item required');
    END IF;

    -- Validate each item before deleting existing ones
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      IF (v_item->>'description') IS NULL OR trim(v_item->>'description') = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item description is required');
      END IF;
      IF (v_item->>'quantity') IS NULL OR (v_item->>'quantity')::numeric <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item quantity must be greater than 0');
      END IF;
      IF (v_item->>'unit_price') IS NULL OR (v_item->>'unit_price')::numeric < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item unit price cannot be negative');
      END IF;
      IF COALESCE((v_item->>'discount')::numeric, 0) < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item discount cannot be negative');
      END IF;
      IF COALESCE((v_item->>'tax_rate')::numeric, 0) < 0
         OR COALESCE((v_item->>'tax_rate')::numeric, 0) > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item tax rate must be between 0 and 100');
      END IF;
    END LOOP;

    -- All items validated — safe to delete existing
    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

    -- Insert new items and recalculate subtotal
    v_subtotal := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
                      - COALESCE((v_item->>'discount')::numeric, 0);
      IF v_item_total < 0 THEN v_item_total := 0; END IF;
      v_subtotal := v_subtotal + v_item_total;

      v_service_id := NULL;
      IF (v_item->>'service_id') IS NOT NULL AND (v_item->>'service_id') != 'null' THEN
        v_service_id := (v_item->>'service_id')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id AND is_active = true) THEN
          v_service_id := NULL;
        END IF;
      END IF;

      INSERT INTO public.invoice_items (
        invoice_id, service_id, description, quantity, unit_price, discount, tax_rate, total
      ) VALUES (
        p_invoice_id,
        v_service_id,
        trim(v_item->>'description'),
        (v_item->>'quantity')::numeric,
        (v_item->>'unit_price')::numeric,
        COALESCE((v_item->>'discount')::numeric, 0),
        COALESCE((v_item->>'tax_rate')::numeric, 0),
        v_item_total
      );
    END LOOP;
  ELSE
    -- No items provided: keep existing items, recalculate with new discount/tax_rate
    SELECT COALESCE(SUM(total), 0) INTO v_subtotal
    FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  END IF;

  -- Calculate tax and total
  v_tax_amount := v_subtotal * (v_tax_rate / 100);
  v_total := v_subtotal + v_tax_amount - v_discount;

  IF v_total < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Total cannot be negative');
  END IF;

  -- Update invoice
  UPDATE public.invoices
  SET subtotal = v_subtotal,
      discount = v_discount,
      tax_rate = v_tax_rate,
      tax_amount = v_tax_amount,
      total = v_total,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (v_caller_id, 'invoice_updated', 'invoices', p_invoice_id,
    jsonb_build_object(
      'total', v_total,
      'discount', v_discount,
      'tax_rate', v_tax_rate,
      'items_replaced', (p_items IS NOT NULL)
    ));

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'total', v_total);
END;
$$;


-- ============================================================
-- MIGRATION 4: invoice_items RLS Policies
-- Purpose: Fix default-deny on invoice_items table.
--
-- NOTE: These policies mirror the existing invoices table pattern
-- (002/003): any staff member with invoices:read can read ALL
-- invoice items, any staff with invoices:create can insert, etc.
-- This is consistent with the RBAC design — access is controlled
-- by role permissions, not per-record ownership.
-- ============================================================

DROP POLICY IF EXISTS "staff_select_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_insert_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_update_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_delete_invoice_items" ON public.invoice_items;

CREATE POLICY "staff_select_invoice_items"
  ON public.invoice_items FOR SELECT
  USING (public.has_permission(auth.uid(), 'invoices', 'read'));

CREATE POLICY "staff_insert_invoice_items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'invoices', 'create'));

CREATE POLICY "staff_update_invoice_items"
  ON public.invoice_items FOR UPDATE
  USING (public.has_permission(auth.uid(), 'invoices', 'update'));

CREATE POLICY "staff_delete_invoice_items"
  ON public.invoice_items FOR DELETE
  USING (public.has_permission(auth.uid(), 'invoices', 'update'));


-- ============================================================
-- MIGRATION 5: REVOKE/GRANT — Function Execution Security
-- Prevents anon/authenticated from calling functions directly
-- unless explicitly granted. Follows the pattern in 003.
-- ============================================================

-- Revoke all from public (anonymous + authenticated) for new functions
REVOKE ALL ON FUNCTION public.generate_invoice_number() FROM public;
REVOKE ALL ON FUNCTION public.create_invoice(uuid, uuid, uuid, numeric, numeric, text, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.update_invoice(uuid, numeric, numeric, text, jsonb) FROM public;

-- Revoke from anon (Supabase default privileges)
REVOKE ALL ON FUNCTION public.generate_invoice_number() FROM anon;
REVOKE ALL ON FUNCTION public.create_invoice(uuid, uuid, uuid, numeric, numeric, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_invoice(uuid, numeric, numeric, text, jsonb) FROM anon;

-- generate_invoice_number: internal helper, called by create_invoice/update_invoice.
-- Grant to authenticated (needed if called directly for testing) and service_role.
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated, service_role;

-- create_invoice: staff function, called by authenticated users with invoices:create
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, numeric, numeric, text, jsonb) TO authenticated, service_role;

-- update_invoice: staff function, called by authenticated users with invoices:update
GRANT EXECUTE ON FUNCTION public.update_invoice(uuid, numeric, numeric, text, jsonb) TO authenticated, service_role;


-- ============================================================
-- VERIFICATION QUERIES (informational — do not modify data)
-- ============================================================

-- Verify sequence exists and current value
SELECT sequencename, last_value
FROM pg_sequences WHERE sequencename = 'invoice_number_seq';

-- Verify functions exist
SELECT proname as function_name, prokind as kind
FROM pg_proc
WHERE proname IN ('generate_invoice_number', 'create_invoice', 'update_invoice')
  AND pronamespace = 'public'::regnamespace;

-- Verify RLS policies on invoice_items
SELECT policyname, cmd as operation, qual as using_expr
FROM pg_policies
WHERE tablename = 'invoice_items' AND schemaname = 'public';

-- Verify function permissions
SELECT
  p.proname as function_name,
  r.rolname as grantee,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
CROSS JOIN (SELECT oid, rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) r
WHERE p.proname IN ('generate_invoice_number', 'create_invoice', 'update_invoice')
  AND p.pronamespace = 'public'::regnamespace
ORDER BY p.proname, r.rolname;
