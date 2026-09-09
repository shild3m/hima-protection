const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

const migrations = [
  // ─── MIGRATION 1: Invoice Number Sequence + Function ───
  {
    name: '1. invoice_number_seq + generate_invoice_number()',
    sql: `
-- Drop existing objects if they exist (idempotent)
DROP FUNCTION IF EXISTS public.generate_invoice_number();
DROP SEQUENCE IF EXISTS public.invoice_number_seq;

-- Create sequence for invoice numbers
CREATE SEQUENCE public.invoice_number_seq;

-- Atomic function: generates next invoice number safely
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

-- Verify
SELECT 'generate_invoice_number() created' as result;
`,
  },

  // ─── MIGRATION 2: create_invoice() RPC ───
  {
    name: '2. create_invoice() RPC',
    sql: `
DROP FUNCTION IF EXISTS public.create_invoice(uuid, uuid, uuid, numeric, numeric, text, jsonb);

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
  v_caller_id := auth.uid();

  IF NOT public.has_permission(v_caller_id, 'invoices', 'create') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: invoices.create');
  END IF;

  -- Validate customer exists
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  -- Validate vehicle if provided
  IF p_vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.vehicles WHERE id = p_vehicle_id AND customer_id = p_customer_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vehicle not found or does not belong to customer');
    END IF;
  END IF;

  -- Validate booking if provided
  IF p_booking_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = p_booking_id AND customer_id = p_customer_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Booking not found or does not belong to customer');
    END IF;
  END IF;

  -- Validate items
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one item required');
  END IF;

  -- Calculate totals using numeric (exact)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
                    - COALESCE((v_item->>'discount')::numeric, 0);
    IF v_item_total < 0 THEN v_item_total := 0; END IF;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  v_tax_amount := v_subtotal * (p_tax_rate / 100);
  v_total := v_subtotal + v_tax_amount - p_discount;

  IF v_total < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Total cannot be negative');
  END IF;

  -- Generate invoice number (atomic via sequence)
  v_inv_number := public.generate_invoice_number();

  -- Insert invoice
  INSERT INTO public.invoices (
    invoice_number, customer_id, vehicle_id, booking_id,
    subtotal, discount, tax_rate, tax_amount, total,
    paid_amount, status, notes, created_by
  ) VALUES (
    v_inv_number, p_customer_id, p_vehicle_id, p_booking_id,
    v_subtotal, p_discount, p_tax_rate, v_tax_amount, v_total,
    0, 'draft', p_notes, v_caller_id
  ) RETURNING id INTO v_invoice_id;

  -- Insert items (within same transaction)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
                    - COALESCE((v_item->>'discount')::numeric, 0);
    IF v_item_total < 0 THEN v_item_total := 0; END IF;

    -- Validate service_id if provided
    v_service_id := NULL;
    IF (v_item->>'service_id') IS NOT NULL AND (v_item->>'service_id') != 'null' THEN
      v_service_id := (v_item->>'service_id')::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id) THEN
        v_service_id := NULL;
      END IF;
    END IF;

    INSERT INTO public.invoice_items (
      invoice_id, service_id, description, quantity, unit_price, discount, tax_rate, total
    ) VALUES (
      v_invoice_id,
      v_service_id,
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount')::numeric, 0),
      COALESCE((v_item->>'tax_rate')::numeric, 0),
      v_item_total
    );
  END LOOP;

  -- Audit
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (v_caller_id, 'invoice_created', 'invoices', v_invoice_id,
    jsonb_build_object('invoice_number', v_inv_number, 'total', v_total, 'customer_id', p_customer_id));

  RETURN jsonb_build_object(
    'success', true, 'invoice_id', v_invoice_id,
    'invoice_number', v_inv_number, 'total', v_total
  );
END;
$$;

-- Verify
SELECT 'create_invoice() created' as result;
`,
  },

  // ─── MIGRATION 3: update_invoice() RPC ───
  {
    name: '3. update_invoice() RPC',
    sql: `
DROP FUNCTION IF EXISTS public.update_invoice(uuid, numeric, numeric, text, jsonb);

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
  v_caller_id := auth.uid();

  IF NOT public.has_permission(v_caller_id, 'invoices', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: invoices.update');
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft invoices can be edited');
  END IF;

  v_discount := COALESCE(p_discount, v_invoice.discount);
  v_tax_rate := COALESCE(p_tax_rate, v_invoice.tax_rate);

  -- Update items if provided
  IF p_items IS NOT NULL THEN
    IF jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'At least one item required');
    END IF;

    -- Delete and re-insert (atomic within transaction)
    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

    v_subtotal := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
                      - COALESCE((v_item->>'discount')::numeric, 0);
      IF v_item_total < 0 THEN v_item_total := 0; END IF;
      v_subtotal := v_subtotal + v_item_total;

      -- Validate service_id if provided
      v_service_id := NULL;
      IF (v_item->>'service_id') IS NOT NULL AND (v_item->>'service_id') != 'null' THEN
        v_service_id := (v_item->>'service_id')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id) THEN
          v_service_id := NULL;
        END IF;
      END IF;

      INSERT INTO public.invoice_items (
        invoice_id, service_id, description, quantity, unit_price, discount, tax_rate, total
      ) VALUES (
        p_invoice_id,
        v_service_id,
        v_item->>'description',
        (v_item->>'quantity')::numeric,
        (v_item->>'unit_price')::numeric,
        COALESCE((v_item->>'discount')::numeric, 0),
        COALESCE((v_item->>'tax_rate')::numeric, 0),
        v_item_total
      );
    END LOOP;
  ELSE
    -- No items change, recalculate from existing items
    SELECT COALESCE(SUM(total), 0) INTO v_subtotal
    FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  END IF;

  v_tax_amount := v_subtotal * (v_tax_rate / 100);
  v_total := v_subtotal + v_tax_amount - v_discount;

  IF v_total < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Total cannot be negative');
  END IF;

  UPDATE public.invoices
  SET subtotal = v_subtotal,
      discount = v_discount,
      tax_rate = v_tax_rate,
      tax_amount = v_tax_amount,
      total = v_total,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Audit
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (v_caller_id, 'invoice_updated', 'invoices', p_invoice_id,
    jsonb_build_object('total', v_total, 'discount', v_discount, 'tax_rate', v_tax_rate));

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'total', v_total);
END;
$$;

-- Verify
SELECT 'update_invoice() created' as result;
`,
  },

  // ─── MIGRATION 4: invoice_items RLS Policies ───
  {
    name: '4. invoice_items RLS policies',
    sql: `
-- Drop existing policies if any
DROP POLICY IF EXISTS "staff_select_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_insert_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_update_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_delete_invoice_items" ON public.invoice_items;

-- SELECT: staff with invoices:read can view items
CREATE POLICY "staff_select_invoice_items"
  ON public.invoice_items FOR SELECT
  USING (public.has_permission(auth.uid(), 'invoices', 'read'));

-- INSERT: staff with invoices:create can add items
CREATE POLICY "staff_insert_invoice_items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'invoices', 'create'));

-- UPDATE: staff with invoices:update can modify items
CREATE POLICY "staff_update_invoice_items"
  ON public.invoice_items FOR UPDATE
  USING (public.has_permission(auth.uid(), 'invoices', 'update'));

-- DELETE: staff with invoices:update can remove items (needed for update flow)
CREATE POLICY "staff_delete_invoice_items"
  ON public.invoice_items FOR DELETE
  USING (public.has_permission(auth.uid(), 'invoices', 'update'));

-- Verify
SELECT 'invoice_items RLS policies created' as result;
`,
  },
];

async function runMigrations() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.\n');

    for (const migration of migrations) {
      console.log(`\n=== EXECUTING: ${migration.name} ===`);
      try {
        const result = await client.query(migration.sql);
        // Show last SELECT result
        const lastResult = result[result.length - 1];
        if (lastResult && lastResult.rows) {
          for (const row of lastResult.rows) {
            console.log('  ✓', Object.values(row)[0]);
          }
        }
        console.log(`  ✓ ${migration.name} COMPLETE`);
      } catch (err) {
        console.error(`  ✗ ${migration.name} FAILED:`, err.message);
        process.exit(1);
      }
    }

    console.log('\n=== ALL MIGRATIONS COMPLETE ===');

  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
