-- ============================================================
-- PHASE 02 -- CORRECTIVE MIGRATION 003 (v2 - Verified)
-- Non-destructive repair of partially-applied Migration 002
-- ============================================================
-- SAFETY: This migration applies ONLY additive changes.
-- It does NOT drop, delete, truncate, or modify any existing data.
-- All policies use DROP POLICY IF EXISTS + CREATE POLICY for idempotency.
-- ============================================================

-- ============================================================
-- 1. PERMISSIONS TABLE DATA (table exists, empty)
-- ============================================================

INSERT INTO public.permissions (resource, action) VALUES
  ('services', 'create'), ('services', 'read'), ('services', 'update'), ('services', 'delete'),
  ('bookings', 'create'), ('bookings', 'read'), ('bookings', 'update'), ('bookings', 'delete'), ('bookings', 'manage'),
  ('customers', 'create'), ('customers', 'read'), ('customers', 'update'), ('customers', 'delete'),
  ('vehicles', 'create'), ('vehicles', 'read'), ('vehicles', 'update'), ('vehicles', 'delete'),
  ('invoices', 'create'), ('invoices', 'read'), ('invoices', 'update'), ('invoices', 'delete'), ('invoices', 'manage'),
  ('payments', 'create'), ('payments', 'read'), ('payments', 'update'), ('payments', 'delete'),
  ('dealers', 'create'), ('dealers', 'read'), ('dealers', 'update'), ('dealers', 'delete'),
  ('referrals', 'create'), ('referrals', 'read'), ('referrals', 'update'), ('referrals', 'delete'),
  ('offers', 'create'), ('offers', 'read'), ('offers', 'update'), ('offers', 'delete'),
  ('commissions', 'create'), ('commissions', 'read'), ('commissions', 'update'), ('commissions', 'approve'), ('commissions', 'pay'),
  ('materials', 'create'), ('materials', 'read'), ('materials', 'update'), ('materials', 'delete'),
  ('inventory', 'read'), ('inventory', 'adjust'), ('inventory', 'purchase'), ('inventory', 'usage'),
  ('suppliers', 'create'), ('suppliers', 'read'), ('suppliers', 'update'), ('suppliers', 'delete'),
  ('purchases', 'create'), ('purchases', 'read'), ('purchases', 'update'), ('purchases', 'receive'),
  ('expenses', 'create'), ('expenses', 'read'), ('expenses', 'update'), ('expenses', 'delete'),
  ('reports', 'read'), ('reports', 'financial'),
  ('staff', 'create'), ('staff', 'read'), ('staff', 'update'), ('staff', 'delete'),
  ('roles', 'manage'),
  ('settings', 'read'), ('settings', 'update'),
  ('audit_logs', 'read'),
  ('notifications', 'read'), ('notifications', 'manage')
ON CONFLICT (resource, action) DO NOTHING;

-- ============================================================
-- 2. ROLE_PERMISSIONS TABLE (does not exist yet)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- ============================================================
-- 3. ROLE_PERMISSIONS DATA
-- ============================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin'
  AND NOT (p.resource = 'roles' AND p.action = 'manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'receptionist' AND (
  (p.resource = 'bookings' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'customers' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'vehicles' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'services' AND p.action = 'read')
  OR (p.resource = 'invoices' AND p.action IN ('create', 'read'))
  OR (p.resource = 'referrals' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'commissions' AND p.action = 'create')
  OR (p.resource = 'notifications' AND p.action = 'read')
) ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'inventory_manager' AND (
  (p.resource = 'materials' AND p.action IN ('create', 'read', 'update', 'delete'))
  OR (p.resource = 'inventory' AND p.action IN ('read', 'adjust', 'purchase', 'usage'))
  OR (p.resource = 'suppliers' AND p.action IN ('create', 'read', 'update', 'delete'))
  OR (p.resource = 'purchases' AND p.action IN ('create', 'read', 'update', 'receive'))
  OR (p.resource = 'notifications' AND p.action = 'read')
) ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'technician' AND (
  (p.resource = 'vehicles' AND p.action = 'read')
  OR (p.resource = 'services' AND p.action = 'read')
  OR (p.resource = 'inventory' AND p.action IN ('read', 'usage'))
  OR (p.resource = 'materials' AND p.action = 'read')
  OR (p.resource = 'notifications' AND p.action = 'read')
) ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'accountant' AND (
  (p.resource = 'invoices' AND p.action IN ('create', 'read', 'update', 'manage'))
  OR (p.resource = 'payments' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'expenses' AND p.action IN ('create', 'read', 'update', 'delete'))
  OR (p.resource = 'commissions' AND p.action IN ('read', 'approve', 'pay'))
  OR (p.resource = 'reports' AND p.action IN ('read', 'financial'))
  OR (p.resource = 'customers' AND p.action = 'read')
  OR (p.resource = 'dealers' AND p.action = 'read')
  OR (p.resource = 'notifications' AND p.action = 'read')
) ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'dealer' AND (
  (p.resource = 'referrals' AND p.action IN ('create', 'read'))
  OR (p.resource = 'offers' AND p.action = 'read')
  OR (p.resource = 'commissions' AND p.action = 'read')
  OR (p.resource = 'notifications' AND p.action = 'read')
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. STAFF TABLE -- ADD role_id COLUMN
-- ============================================================

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id);

UPDATE public.staff s
SET role_id = r.id
FROM public.roles r
WHERE s.role = r.name AND s.role_id IS NULL;

-- ============================================================
-- 4b. REFERRAL_SERVICES -- ADD is_primary COLUMN
-- ============================================================

ALTER TABLE public.referral_services ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Enforce at most one primary service per referral
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referral_services_one_primary
  ON public.referral_services (referral_id)
  WHERE is_primary = true;

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name FROM public.staff s
  JOIN public.roles r ON r.id = s.role_id
  WHERE s.user_id = p_user_id AND s.is_active = true
  UNION ALL
  SELECT 'dealer'::text FROM public.dealers d
  WHERE d.user_id = p_user_id AND d.is_active = true AND d.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.role_id FROM public.staff s
  WHERE s.user_id = p_user_id AND s.is_active = true
  UNION ALL
  SELECT r.id FROM public.dealers d
  JOIN public.roles r ON r.name = 'dealer'
  WHERE d.user_id = p_user_id AND d.is_active = true AND d.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id uuid,
  p_resource text,
  p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = public.get_user_role_id(p_user_id)
      AND p.resource = p_resource
      AND p.action = p_action
  );
$$;

CREATE OR REPLACE FUNCTION public.get_dealer_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id FROM public.dealers d
  WHERE d.user_id = p_user_id AND d.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT regexp_replace(p_phone, '[^0-9]', '', 'g');
$$;

-- ============================================================
-- 6. GUEST BOOKING FUNCTION (FIXED: required params first)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_guest_booking(
  p_customer_name    text,
  p_customer_phone   text,
  p_car_make         text,
  p_car_model        text,
  p_service_id       uuid,
  p_customer_email   text DEFAULT NULL,
  p_car_year         integer DEFAULT NULL,
  p_car_color        text DEFAULT NULL,
  p_car_plate        text DEFAULT NULL,
  p_preferred_date   date DEFAULT NULL,
  p_preferred_time   time DEFAULT NULL,
  p_notes            text DEFAULT NULL,
  p_idempotency_key  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone text;
  v_customer_id      uuid;
  v_vehicle_id       uuid;
  v_booking_id       uuid;
  v_existing_booking uuid;
  v_service_name     text;
BEGIN
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name required');
  END IF;

  IF p_customer_phone IS NULL OR length(trim(p_customer_phone)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phone required');
  END IF;

  IF p_car_make IS NULL OR length(trim(p_car_make)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car make required');
  END IF;

  IF p_car_model IS NULL OR length(trim(p_car_model)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Car model required');
  END IF;

  IF p_service_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service required');
  END IF;

  SELECT name INTO v_service_name
  FROM public.services
  WHERE id = p_service_id AND is_active = true;

  IF v_service_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service not found or inactive');
  END IF;

  v_normalized_phone := public.normalize_phone(p_customer_phone);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_booking
    FROM public.bookings
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_booking IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_existing_booking,
        'duplicate', true,
        'message', 'Booking already exists'
      );
    END IF;
  END IF;

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = v_normalized_phone;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (full_name, phone, email, source)
    VALUES (trim(p_customer_name), v_normalized_phone, p_customer_email, 'online')
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET full_name = trim(p_customer_name),
        email = COALESCE(p_customer_email, email),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  SELECT id INTO v_vehicle_id
  FROM public.vehicles
  WHERE customer_id = v_customer_id
    AND lower(make) = lower(trim(p_car_make))
    AND lower(model) = lower(trim(p_car_model))
    AND (year = p_car_year OR (year IS NULL AND p_car_year IS NULL));

  IF v_vehicle_id IS NULL THEN
    INSERT INTO public.vehicles (customer_id, make, model, year, color, plate_number)
    VALUES (v_customer_id, trim(p_car_make), trim(p_car_model), p_car_year, p_car_color, p_car_plate)
    RETURNING id INTO v_vehicle_id;
  ELSE
    UPDATE public.vehicles
    SET color = COALESCE(p_car_color, color),
        plate_number = COALESCE(p_car_plate, plate_number),
        updated_at = now()
    WHERE id = v_vehicle_id;
  END IF;

  INSERT INTO public.bookings (
    customer_id, vehicle_id, service_id,
    preferred_date, preferred_time,
    customer_notes, source, created_by, idempotency_key
  ) VALUES (
    v_customer_id, v_vehicle_id, p_service_id,
    p_preferred_date, p_preferred_time,
    p_notes, 'online', NULL, p_idempotency_key
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.booking_status_history (booking_id, old_status, new_status, notes)
  VALUES (v_booking_id, NULL, 'new', 'Created from website');

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'customer_id', v_customer_id,
    'vehicle_id', v_vehicle_id,
    'service_name', v_service_name,
    'message', 'Booking created successfully'
  );
END;
$$;

-- ============================================================
-- 7. PAYMENT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_payment(
  p_invoice_id       uuid,
  p_amount           numeric,
  p_payment_method   text,
  p_reference_number text DEFAULT NULL,
  p_notes            text DEFAULT NULL,
  p_idempotency_key  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice         record;
  v_payment_id      uuid;
  v_existing_payment uuid;
  v_new_paid        numeric;
  v_new_status      text;
  v_caller_id       uuid;
BEGIN
  v_caller_id := auth.uid();

  IF NOT public.has_permission(v_caller_id, 'payments', 'create') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: payments.create');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be > 0');
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'card', 'bank_transfer', 'online') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_payment
    FROM public.payments
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_payment IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_existing_payment,
        'duplicate', true,
        'message', 'Payment already recorded'
      );
    END IF;
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status NOT IN ('issued', 'partially_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pay invoice with status: ' || v_invoice.status);
  END IF;

  IF p_amount > (v_invoice.total - v_invoice.paid_amount) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount (' || p_amount || ') exceeds remaining (' || (v_invoice.total - v_invoice.paid_amount) || ')'
    );
  END IF;

  INSERT INTO public.payments (
    invoice_id, amount, payment_method,
    reference_number, notes, idempotency_key, created_by
  ) VALUES (
    p_invoice_id, p_amount, p_payment_method,
    p_reference_number, p_notes, p_idempotency_key, v_caller_id
  )
  RETURNING id INTO v_payment_id;

  v_new_paid := v_invoice.paid_amount + p_amount;

  IF v_new_paid >= v_invoice.total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE public.invoices
  SET paid_amount = v_new_paid,
      status = v_new_status,
      updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'payment_recorded', 'payments', v_payment_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount', p_amount,
      'method', p_payment_method, 'new_paid_amount', v_new_paid, 'new_status', v_new_status
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'payment_id', v_payment_id,
    'invoice_id', p_invoice_id, 'amount', p_amount,
    'new_paid_amount', v_new_paid, 'new_status', v_new_status
  );
END;
$$;

-- ============================================================
-- 8. INVENTORY USAGE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_inventory_usage(
  p_material_id     uuid,
  p_quantity        numeric,
  p_booking_id      uuid DEFAULT NULL,
  p_service_id      uuid DEFAULT NULL,
  p_vehicle_id      uuid DEFAULT NULL,
  p_notes           text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material       record;
  v_transaction_id uuid;
  v_existing_txn   uuid;
  v_rows_updated   integer;
  v_caller_id      uuid;
BEGIN
  v_caller_id := auth.uid();

  IF NOT public.has_permission(v_caller_id, 'inventory', 'usage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: inventory.usage');
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be > 0');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_txn
    FROM public.inventory_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_txn IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true, 'transaction_id', v_existing_txn,
        'duplicate', true, 'message', 'Transaction already recorded'
      );
    END IF;
  END IF;

  UPDATE public.materials
  SET current_stock = current_stock - p_quantity, updated_at = now()
  WHERE id = p_material_id AND current_stock >= p_quantity AND is_active = true;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    SELECT current_stock, name INTO v_material
    FROM public.materials WHERE id = p_material_id;

    IF v_material IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Material not found');
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock. Available: ' || v_material.current_stock || ' of ' || v_material.name
    );
  END IF;

  INSERT INTO public.inventory_transactions (
    material_id, quantity, type, reference_type, reference_id,
    vehicle_id, booking_id, service_id, notes, idempotency_key, created_by
  ) VALUES (
    p_material_id, -p_quantity, 'usage', 'booking', p_booking_id,
    p_vehicle_id, p_booking_id, p_service_id, p_notes, p_idempotency_key, v_caller_id
  )
  RETURNING id INTO v_transaction_id;

  SELECT current_stock, min_stock, name INTO v_material
  FROM public.materials WHERE id = p_material_id;

  IF v_material.current_stock <= v_material.min_stock THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT s.user_id, 'low_stock', 'Low Stock Alert',
      'Material ' || v_material.name || ' stock is ' || v_material.current_stock || ' (at minimum)',
      'materials', p_material_id
    FROM public.staff s
    WHERE s.role_id IN (SELECT id FROM public.roles WHERE name IN ('admin', 'super_admin', 'inventory_manager'))
      AND s.is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', v_transaction_id,
    'material_id', p_material_id, 'quantity_deducted', p_quantity,
    'remaining_stock', v_material.current_stock
  );
END;
$$;

-- ============================================================
-- 9. PURCHASE RECEIVING FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.receive_purchase(
  p_purchase_id     uuid,
  p_items           jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase       record;
  v_item           jsonb;
  v_total          numeric := 0;
  v_item_total     numeric;
  v_item_count     integer := 0;
  v_caller_id      uuid;
BEGIN
  v_caller_id := auth.uid();

  IF NOT public.has_permission(v_caller_id, 'purchases', 'receive') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: purchases.receive');
  END IF;

  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

  IF v_purchase IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not found');
  END IF;

  IF v_purchase.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot receive purchase with status: ' || v_purchase.status || ' (must be draft)');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No items to receive');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_total := (v_item->>'quantity')::numeric * (v_item->>'unit_cost')::numeric;
    v_total := v_total + v_item_total;
    v_item_count := v_item_count + 1;

    INSERT INTO public.purchase_items (purchase_id, material_id, quantity, unit_cost, total_cost)
    VALUES (
      p_purchase_id, (v_item->>'material_id')::uuid,
      (v_item->>'quantity')::numeric, (v_item->>'unit_cost')::numeric, v_item_total
    );

    INSERT INTO public.inventory_transactions (
      material_id, quantity, type, reference_type, reference_id, notes, created_by
    ) VALUES (
      (v_item->>'material_id')::uuid, (v_item->>'quantity')::numeric,
      'purchase', 'purchase', p_purchase_id, 'Purchase received', v_caller_id
    );

    UPDATE public.materials
    SET current_stock = current_stock + (v_item->>'quantity')::numeric,
        cost_per_unit = (v_item->>'unit_cost')::numeric,
        updated_at = now()
    WHERE id = (v_item->>'material_id')::uuid;
  END LOOP;

  UPDATE public.purchases
  SET status = 'received', total_amount = v_total, received_at = now(), updated_at = now()
  WHERE id = p_purchase_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'purchase_received', 'purchases', p_purchase_id,
    jsonb_build_object('items_count', v_item_count, 'total_amount', v_total)
  );

  RETURN jsonb_build_object(
    'success', true, 'purchase_id', p_purchase_id,
    'items_count', v_item_count, 'total_amount', v_total
  );
END;
$$;

-- ============================================================
-- 10. COMMISSION CREATION FUNCTION
-- NOTE: referrals.service_id does NOT exist.
-- Services are in referral_services junction table.
-- Commission uses the PRIMARY service (is_primary = true).
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_commission(
  p_referral_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral       record;
  v_dealer         record;
  v_service        record;
  v_service_id     uuid;
  v_calc_type      text;
  v_rate           numeric;
  v_amount         numeric;
  v_commission_id  uuid;
  v_caller_id      uuid;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NOT NULL THEN
    IF NOT public.has_permission(v_caller_id, 'commissions', 'create') THEN
      RETURN jsonb_build_object('success', false, 'error', 'No permission: commissions.create');
    END IF;
  END IF;

  SELECT * INTO v_referral FROM public.referrals WHERE id = p_referral_id;

  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  IF v_referral.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral must be completed to create commission');
  END IF;

  IF EXISTS (SELECT 1 FROM public.commissions WHERE referral_id = p_referral_id) THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true, 'message', 'Commission already exists for this referral'
    );
  END IF;

  SELECT * INTO v_dealer FROM public.dealers WHERE id = v_referral.dealer_id;

  IF v_dealer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dealer not found');
  END IF;

  -- Get PRIMARY service from referral_services (is_primary = true)
  -- Partial unique index guarantees at most one primary per referral
  SELECT rs.service_id INTO v_service_id
  FROM public.referral_services rs
  WHERE rs.referral_id = p_referral_id
    AND rs.is_primary = true;

  IF v_service_id IS NOT NULL THEN
    SELECT * INTO v_service FROM public.services WHERE id = v_service_id;
  END IF;

  v_calc_type := v_dealer.commission_type;
  v_rate := v_dealer.commission_value;

  IF v_calc_type = 'fixed' THEN
    v_amount := v_rate;
  ELSIF v_calc_type = 'percentage' THEN
    IF v_service IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Primary service is required for percentage commission. Set is_primary = true on one referral_service.'
      );
    END IF;
    v_amount := (v_service.base_price * v_rate / 100);
  ELSE
    v_amount := 0;
  END IF;

  INSERT INTO public.commissions (
    referral_id, dealer_id, service_id, calculation_type, rate_value,
    calculated_amount, status, notes
  ) VALUES (
    p_referral_id, v_referral.dealer_id, v_service_id,
    v_calc_type, v_rate, v_amount, 'pending', 'Auto-created on referral completion'
  )
  RETURNING id INTO v_commission_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'commission_created', 'commissions', v_commission_id,
    jsonb_build_object(
      'referral_id', p_referral_id, 'dealer_id', v_referral.dealer_id,
      'amount', v_amount, 'calculation_type', v_calc_type
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'commission_id', v_commission_id,
    'amount', v_amount, 'calculation_type', v_calc_type
  );
END;
$$;

-- ============================================================
-- 11. COMPLETE BOOKING FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id   uuid,
  p_materials    jsonb DEFAULT '[]'::jsonb,
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking          record;
  v_material         jsonb;
  v_usage_result     jsonb;
  v_comm_result      jsonb;
  v_material_results jsonb := '[]'::jsonb;
  v_caller_id        uuid;
BEGIN
  v_caller_id := auth.uid();

  IF NOT public.has_permission(v_caller_id, 'bookings', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: bookings.update');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.status NOT IN ('arrived', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot complete booking with status: ' || v_booking.status);
  END IF;

  IF p_materials IS NOT NULL AND jsonb_array_length(p_materials) > 0 THEN
    FOR v_material IN SELECT * FROM jsonb_array_elements(p_materials)
    LOOP
      v_usage_result := public.record_inventory_usage(
        p_material_id := (v_material->>'material_id')::uuid,
        p_quantity := (v_material->>'quantity')::numeric,
        p_booking_id := p_booking_id,
        p_service_id := v_booking.service_id,
        p_vehicle_id := v_booking.vehicle_id,
        p_notes := 'Service usage',
        p_idempotency_key := 'usage_' || p_booking_id::text || '_' || (v_material->>'material_id')::text
      );

      v_material_results := v_material_results || v_usage_result;

      IF (v_usage_result->>'success')::boolean = false THEN
        RAISE EXCEPTION 'Material deduction failed: %', v_usage_result->>'error';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.bookings
  SET status = 'completed', admin_notes = COALESCE(p_notes, admin_notes), updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_status_history (booking_id, old_status, new_status, changed_by, notes)
  VALUES (p_booking_id, v_booking.status, 'completed', v_caller_id, p_notes);

  IF v_booking.referral_id IS NOT NULL THEN
    UPDATE public.referrals
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_booking.referral_id AND status = 'redeemed';

    SELECT public.create_commission_from_rule(v_booking.referral_id) INTO v_comm_result;
    IF (v_comm_result->>'success')::boolean = false THEN
      RAISE EXCEPTION 'Commission creation failed: %', v_comm_result->>'error';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'booking_completed', 'bookings', p_booking_id,
    jsonb_build_object('materials_used', jsonb_array_length(p_materials))
  );

  RETURN jsonb_build_object(
    'success', true, 'booking_id', p_booking_id,
    'materials_results', v_material_results
  );
END;
$$;

-- ============================================================
-- 12. RLS POLICIES (every CREATE preceded by DROP IF EXISTS)
-- ============================================================

-- --- SERVICES ---
DROP POLICY IF EXISTS "public_select_active_services" ON public.services;
CREATE POLICY "public_select_active_services"
  ON public.services FOR SELECT
  USING (is_active = true);

-- --- SERVICE IMAGES ---
DROP POLICY IF EXISTS "public_select_service_images" ON public.service_images;
CREATE POLICY "public_select_service_images"
  ON public.service_images FOR SELECT
  USING (true);

-- --- OFFERS ---
DROP POLICY IF EXISTS "public_select_general_offers" ON public.offers;
CREATE POLICY "public_select_general_offers"
  ON public.offers FOR SELECT
  USING (is_active = true AND dealer_id IS NULL);

DROP POLICY IF EXISTS "dealer_select_own_offers" ON public.offers;
CREATE POLICY "dealer_select_own_offers"
  ON public.offers FOR SELECT
  USING (
    dealer_id IS NOT NULL
    AND dealer_id = public.get_dealer_id(auth.uid())
  );

DROP POLICY IF EXISTS "staff_select_all_offers" ON public.offers;
CREATE POLICY "staff_select_all_offers"
  ON public.offers FOR SELECT
  USING (public.has_permission(auth.uid(), 'offers', 'read'));

-- --- DEALERS ---
DROP POLICY IF EXISTS "dealer_select_own" ON public.dealers;
CREATE POLICY "dealer_select_own"
  ON public.dealers FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_select_all_dealers" ON public.dealers;
CREATE POLICY "staff_select_all_dealers"
  ON public.dealers FOR SELECT
  USING (public.has_permission(auth.uid(), 'dealers', 'read'));

-- --- CUSTOMERS ---
DROP POLICY IF EXISTS "staff_select_customers" ON public.customers;
CREATE POLICY "staff_select_customers"
  ON public.customers FOR SELECT
  USING (public.has_permission(auth.uid(), 'customers', 'read'));

DROP POLICY IF EXISTS "staff_insert_customers" ON public.customers;
CREATE POLICY "staff_insert_customers"
  ON public.customers FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'customers', 'create'));

DROP POLICY IF EXISTS "staff_update_customers" ON public.customers;
CREATE POLICY "staff_update_customers"
  ON public.customers FOR UPDATE
  USING (public.has_permission(auth.uid(), 'customers', 'update'));

-- --- VEHICLES ---
DROP POLICY IF EXISTS "staff_select_vehicles" ON public.vehicles;
CREATE POLICY "staff_select_vehicles"
  ON public.vehicles FOR SELECT
  USING (public.has_permission(auth.uid(), 'vehicles', 'read'));

DROP POLICY IF EXISTS "staff_insert_vehicles" ON public.vehicles;
CREATE POLICY "staff_insert_vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'vehicles', 'create'));

DROP POLICY IF EXISTS "staff_update_vehicles" ON public.vehicles;
CREATE POLICY "staff_update_vehicles"
  ON public.vehicles FOR UPDATE
  USING (public.has_permission(auth.uid(), 'vehicles', 'update'));

-- --- BOOKINGS ---
DROP POLICY IF EXISTS "staff_select_bookings" ON public.bookings;
CREATE POLICY "staff_select_bookings"
  ON public.bookings FOR SELECT
  USING (public.has_permission(auth.uid(), 'bookings', 'read'));

-- FIX #1: Guest Booking RLS - NO created_by IS NULL bypass
-- Guest bookings ONLY via create_guest_booking() RPC (service role bypasses RLS)
DROP POLICY IF EXISTS "staff_insert_bookings" ON public.bookings;
CREATE POLICY "staff_insert_bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'bookings', 'create'));

DROP POLICY IF EXISTS "staff_update_bookings" ON public.bookings;
CREATE POLICY "staff_update_bookings"
  ON public.bookings FOR UPDATE
  USING (public.has_permission(auth.uid(), 'bookings', 'update'));

-- --- INVOICES ---
DROP POLICY IF EXISTS "staff_select_invoices" ON public.invoices;
CREATE POLICY "staff_select_invoices"
  ON public.invoices FOR SELECT
  USING (public.has_permission(auth.uid(), 'invoices', 'read'));

DROP POLICY IF EXISTS "staff_insert_invoices" ON public.invoices;
CREATE POLICY "staff_insert_invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'invoices', 'create'));

DROP POLICY IF EXISTS "staff_update_invoices" ON public.invoices;
CREATE POLICY "staff_update_invoices"
  ON public.invoices FOR UPDATE
  USING (public.has_permission(auth.uid(), 'invoices', 'update'));

-- --- PAYMENTS ---
DROP POLICY IF EXISTS "staff_select_payments" ON public.payments;
CREATE POLICY "staff_select_payments"
  ON public.payments FOR SELECT
  USING (public.has_permission(auth.uid(), 'payments', 'read'));

DROP POLICY IF EXISTS "staff_insert_payments" ON public.payments;
CREATE POLICY "staff_insert_payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'payments', 'create'));

-- --- REFERRALS ---
DROP POLICY IF EXISTS "dealer_select_own_referrals" ON public.referrals;
CREATE POLICY "dealer_select_own_referrals"
  ON public.referrals FOR SELECT
  USING (dealer_id = public.get_dealer_id(auth.uid()));

DROP POLICY IF EXISTS "staff_select_all_referrals" ON public.referrals;
CREATE POLICY "staff_select_all_referrals"
  ON public.referrals FOR SELECT
  USING (public.has_permission(auth.uid(), 'referrals', 'read'));

DROP POLICY IF EXISTS "dealer_insert_referrals" ON public.referrals;
CREATE POLICY "dealer_insert_referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (dealer_id = public.get_dealer_id(auth.uid()));

DROP POLICY IF EXISTS "staff_update_referrals" ON public.referrals;
CREATE POLICY "staff_update_referrals"
  ON public.referrals FOR UPDATE
  USING (public.has_permission(auth.uid(), 'referrals', 'update'));

-- --- COMMISSIONS ---
DROP POLICY IF EXISTS "dealer_select_own_commissions" ON public.commissions;
CREATE POLICY "dealer_select_own_commissions"
  ON public.commissions FOR SELECT
  USING (dealer_id = public.get_dealer_id(auth.uid()));

DROP POLICY IF EXISTS "staff_select_all_commissions" ON public.commissions;
CREATE POLICY "staff_select_all_commissions"
  ON public.commissions FOR SELECT
  USING (public.has_permission(auth.uid(), 'commissions', 'read'));

DROP POLICY IF EXISTS "staff_update_commissions" ON public.commissions;
CREATE POLICY "staff_update_commissions"
  ON public.commissions FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'commissions', 'update')
    OR public.has_permission(auth.uid(), 'commissions', 'approve')
    OR public.has_permission(auth.uid(), 'commissions', 'pay')
  );

-- --- MATERIALS ---
DROP POLICY IF EXISTS "staff_select_materials" ON public.materials;
CREATE POLICY "staff_select_materials"
  ON public.materials FOR SELECT
  USING (public.has_permission(auth.uid(), 'materials', 'read'));

DROP POLICY IF EXISTS "staff_insert_materials" ON public.materials;
CREATE POLICY "staff_insert_materials"
  ON public.materials FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'materials', 'create'));

DROP POLICY IF EXISTS "staff_update_materials" ON public.materials;
CREATE POLICY "staff_update_materials"
  ON public.materials FOR UPDATE
  USING (public.has_permission(auth.uid(), 'materials', 'update'));

-- --- INVENTORY TRANSACTIONS ---
DROP POLICY IF EXISTS "staff_select_inventory" ON public.inventory_transactions;
CREATE POLICY "staff_select_inventory"
  ON public.inventory_transactions FOR SELECT
  USING (public.has_permission(auth.uid(), 'inventory', 'read'));

-- --- SUPPLIERS ---
DROP POLICY IF EXISTS "staff_select_suppliers" ON public.suppliers;
CREATE POLICY "staff_select_suppliers"
  ON public.suppliers FOR SELECT
  USING (public.has_permission(auth.uid(), 'suppliers', 'read'));

DROP POLICY IF EXISTS "staff_insert_suppliers" ON public.suppliers;
CREATE POLICY "staff_insert_suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'suppliers', 'create'));

DROP POLICY IF EXISTS "staff_update_suppliers" ON public.suppliers;
CREATE POLICY "staff_update_suppliers"
  ON public.suppliers FOR UPDATE
  USING (public.has_permission(auth.uid(), 'suppliers', 'update'));

-- --- PURCHASES ---
DROP POLICY IF EXISTS "staff_select_purchases" ON public.purchases;
CREATE POLICY "staff_select_purchases"
  ON public.purchases FOR SELECT
  USING (public.has_permission(auth.uid(), 'purchases', 'read'));

DROP POLICY IF EXISTS "staff_insert_purchases" ON public.purchases;
CREATE POLICY "staff_insert_purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'purchases', 'create'));

DROP POLICY IF EXISTS "staff_update_purchases" ON public.purchases;
CREATE POLICY "staff_update_purchases"
  ON public.purchases FOR UPDATE
  USING (public.has_permission(auth.uid(), 'purchases', 'update'));

-- --- EXPENSES ---
DROP POLICY IF EXISTS "staff_select_expenses" ON public.expenses;
CREATE POLICY "staff_select_expenses"
  ON public.expenses FOR SELECT
  USING (public.has_permission(auth.uid(), 'expenses', 'read'));

DROP POLICY IF EXISTS "staff_insert_expenses" ON public.expenses;
CREATE POLICY "staff_insert_expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'expenses', 'create'));

DROP POLICY IF EXISTS "staff_update_expenses" ON public.expenses;
CREATE POLICY "staff_update_expenses"
  ON public.expenses FOR UPDATE
  USING (public.has_permission(auth.uid(), 'expenses', 'update'));

-- --- STAFF ---
DROP POLICY IF EXISTS "staff_select_staff" ON public.staff;
CREATE POLICY "staff_select_staff"
  ON public.staff FOR SELECT
  USING (public.has_permission(auth.uid(), 'staff', 'read'));

DROP POLICY IF EXISTS "admin_insert_staff" ON public.staff;
CREATE POLICY "admin_insert_staff"
  ON public.staff FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'staff', 'create'));

DROP POLICY IF EXISTS "admin_update_staff" ON public.staff;
CREATE POLICY "admin_update_staff"
  ON public.staff FOR UPDATE
  USING (public.has_permission(auth.uid(), 'staff', 'update'));

-- --- PROFILES ---
DROP POLICY IF EXISTS "owner_select_profile" ON public.profiles;
CREATE POLICY "owner_select_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "owner_update_profile" ON public.profiles;
CREATE POLICY "owner_update_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- --- NOTIFICATIONS ---
DROP POLICY IF EXISTS "owner_select_notifications" ON public.notifications;
CREATE POLICY "owner_select_notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_update_notifications" ON public.notifications;
CREATE POLICY "owner_update_notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- --- AUDIT LOGS (SELECT only - no INSERT/UPDATE/DELETE policies) ---
DROP POLICY IF EXISTS "admin_select_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_select_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_permission(auth.uid(), 'audit_logs', 'read'));

-- --- SETTINGS ---
DROP POLICY IF EXISTS "admin_select_settings" ON public.settings;
CREATE POLICY "admin_select_settings"
  ON public.settings FOR SELECT
  USING (public.has_permission(auth.uid(), 'settings', 'read'));

DROP POLICY IF EXISTS "admin_update_settings" ON public.settings;
CREATE POLICY "admin_update_settings"
  ON public.settings FOR UPDATE
  USING (public.has_permission(auth.uid(), 'settings', 'update'));

-- ============================================================
-- 13. REVOKE/GRANT -- FUNCTION EXECUTION SECURITY
-- ============================================================

-- Revoke all from public (anonymous + authenticated)
REVOKE ALL ON FUNCTION public.create_guest_booking(text, text, text, text, uuid, text, integer, text, text, date, time, text, text) FROM public;
REVOKE ALL ON FUNCTION public.record_payment(uuid, numeric, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.record_inventory_usage(uuid, numeric, uuid, uuid, uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.receive_purchase(uuid, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.create_commission(uuid) FROM public;
REVOKE ALL ON FUNCTION public.complete_booking(uuid, jsonb, text) FROM public;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM public;
REVOKE ALL ON FUNCTION public.get_user_role_id(uuid) FROM public;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.get_dealer_id(uuid) FROM public;
REVOKE ALL ON FUNCTION public.normalize_phone(text) FROM public;

-- Revoke from anon (Supabase default privileges grant anon access; REVOKE FROM public does not cover it)
REVOKE ALL ON FUNCTION public.create_guest_booking(text, text, text, text, uuid, text, integer, text, text, date, time, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_payment(uuid, numeric, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.record_inventory_usage(uuid, numeric, uuid, uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.receive_purchase(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_commission(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.complete_booking(uuid, jsonb, text) FROM anon;

-- Revoke create_commission from authenticated (service_role only; called internally by complete_booking)
REVOKE ALL ON FUNCTION public.create_commission(uuid) FROM authenticated;

-- Revoke create_guest_booking from authenticated (service_role only; anonymous guests have no JWT)
REVOKE ALL ON FUNCTION public.create_guest_booking(text, text, text, text, uuid, text, integer, text, text, date, time, text, text) FROM authenticated;

-- STAFF FUNCTIONS: authenticated + service_role (use auth.uid() for RBAC)
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, numeric, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_inventory_usage(uuid, numeric, uuid, uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_booking(uuid, jsonb, text) TO authenticated, service_role;

-- INTERNAL: service_role ONLY (called by complete_booking, not by users directly)
GRANT EXECUTE ON FUNCTION public.create_commission(uuid) TO service_role;

-- GUEST: service_role ONLY (anonymous has no JWT, no auth.uid())
GRANT EXECUTE ON FUNCTION public.create_guest_booking(text, text, text, text, uuid, text, integer, text, text, date, time, text, text) TO service_role;

-- HELPERS: authenticated (for RLS evaluation)
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dealer_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated;

-- ============================================================
-- END OF MIGRATION 003
-- ============================================================
