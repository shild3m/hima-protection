-- ============================================================
-- PHASE 026 (CORRECTED): Race-safe idempotency, partial UNIQUE,
--   permission-based recipients, booking_created
--
-- UPGRADE PATH: Safe to run on database with OLD 026 already applied.
--   - create_notification(): CREATE OR REPLACE (safe, function exists)
--   - idx_notifications_event_dedup: DROP IF EXISTS + CREATE (safe)
--   - record_inventory_usage(): CREATE OR REPLACE (safe, function exists)
--   - create_booking(): CREATE OR REPLACE (safe, function exists)
--
-- SAFETY:
--   - Does NOT drop/create any tables
--   - Does NOT modify any columns
--   - Does NOT weaken RLS
--   - Does NOT change RBAC permissions or GRANT/REVOKE
--   - Does NOT delete production data
--   - All changes are additive or idempotent replacements
-- ============================================================

-- ============================================================
-- FIX 1: Partial UNIQUE index (replaces existing full UNIQUE)
--
-- WHY partial: PostgreSQL UNIQUE allows duplicate rows when any
-- column is NULL (NULL != NULL by default). A partial index
-- WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL
-- avoids this by excluding NULLs from the index entirely.
--
-- All 11 business events always pass both reference_type and
-- reference_id, so NULLs never occur in production. The partial
-- index is therefore equivalent but avoids the NULL ambiguity.
--
-- SAFETY: DROP IF EXISTS ensures no error if old index name differs.
-- ============================================================
DROP INDEX IF EXISTS public.idx_notifications_event_dedup;

CREATE UNIQUE INDEX idx_notifications_event_dedup
  ON public.notifications(type, reference_type, reference_id, user_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- ============================================================
-- FIX 2: create_notification() — race-safe idempotency
--
-- CONCURRENCY MODEL (three layers):
--
-- Layer 1 — Soft dedup (lines below): SELECT check with 5-minute
--   window. Handles the common sequential case. No lock held.
--   Returns {success: true, duplicate: true}.
--
-- Layer 2 — UNIQUE index: Database-level uniqueness constraint.
--   Catches any duplicate that slips past the soft check due
--   to concurrent execution.
--
-- Layer 3 — EXCEPTION handler: Catches unique_violation from the
--   UNIQUE index and converts it to {success: true, duplicate: true}.
--   This is the race-safe safety net that prevents errors from
--   reaching the client.
--
-- RACE CONDITION FLOW:
--   T1: Request A enters, soft check = no match
--   T2: Request B enters, soft check = no match (A not committed)
--   T3: Request A INSERTs → succeeds
--   T4: Request B INSERTs → unique_violation → EXCEPTION → duplicate
--
-- RESULT: Both requests return success. No error. No duplicate row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id         uuid,
  p_type            text,
  p_title           text,
  p_message         text DEFAULT NULL,
  p_reference_type  text DEFAULT NULL,
  p_reference_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is required');
  END IF;

  IF p_type IS NULL OR p_type = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'type is required');
  END IF;

  IF p_title IS NULL OR p_title = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'title is required');
  END IF;

  -- Layer 1: Soft dedup — if same type+reference+user exists within 5 minutes, skip.
  -- Only checks when both reference columns are non-NULL.
  IF p_reference_type IS NOT NULL AND p_reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = p_type
        AND reference_type = p_reference_type
        AND reference_id = p_reference_id
        AND user_id = p_user_id
        AND created_at > now() - interval '5 minutes'
    ) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;
  END IF;

  -- Layer 2+3: Insert with EXCEPTION handler for race-safe idempotency.
  -- If a concurrent request inserted the same row between our soft check
  -- and this INSERT, the UNIQUE index raises unique_violation, which we
  -- catch and return as duplicate — never exposing the error to the client.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
    VALUES (p_user_id, p_type, p_title, p_message, p_reference_type, p_reference_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- ============================================================
-- FIX 3: record_inventory_usage — permission-based recipients
--
-- REPLACES: Hard-coded role names ('admin', 'super_admin', 'inventory_manager')
-- WITH: Permission-based query via role_permissions + permissions tables
--
-- WHY: If new roles gain inventory:read, they should automatically
-- receive low_stock notifications. Hard-coded names miss new roles.
-- The technician role already has inventory:read but is NOT in the
-- old hard-coded list.
--
-- PATTERN: Same as record_stock_adjustment (Phase 06, migration 005)
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

  -- Permission-based low_stock notification (consistent with record_stock_adjustment)
  IF v_material.current_stock <= v_material.min_stock THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT DISTINCT s.user_id, 'low_stock', 'Low Stock Alert',
      'Material ' || v_material.name || ' stock is ' || v_material.current_stock || ' (at minimum)',
      'materials', p_material_id
    FROM public.staff s
    WHERE s.is_active = true
      AND s.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = s.role_id
          AND p.resource = 'inventory' AND p.action = 'read'
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', v_transaction_id,
    'material_id', p_material_id, 'quantity_deducted', p_quantity,
    'remaining_stock', v_material.current_stock
  );
END;
$$;

-- ============================================================
-- FIX 4: create_booking — booking_created notification
--
-- PRESERVES: All existing validation, customer/vehicle upsert,
--   booking creation, status history, rate limiting, idempotency.
-- ADDS: Notification INSERT after booking creation.
-- NOTE: This function is GRANTed to anon (public booking form).
--   The notification INSERT uses permission-based recipient query
--   which works inside SECURITY DEFINER context.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_booking(
  p_customer_name   text,
  p_customer_phone  text,
  p_customer_email  text,
  p_vehicle_make    text,
  p_vehicle_model   text,
  p_vehicle_year    integer,
  p_vehicle_color   text,
  p_vehicle_plate   text,
  p_service_id      uuid,
  p_preferred_date  date,
  p_preferred_time  text,
  p_notes           text,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_customer_id       uuid;
  v_vehicle_id        uuid;
  v_booking_id        uuid;
  v_service           record;
  v_normalized_phone  text;
  v_existing_booking_id uuid;
BEGIN
  SELECT id, name INTO v_service
  FROM services WHERE id = p_service_id AND is_active = true;

  IF v_service IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخدمة غير موجودة أو غير متاحة');
  END IF;

  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الاسم مطلوب (حرفين على الأقل)');
  END IF;

  IF p_customer_phone IS NULL OR length(trim(p_customer_phone)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'رقم الهاتف مطلوب');
  END IF;

  IF p_customer_email IS NOT NULL AND length(trim(p_customer_email)) > 0 THEN
    IF NOT (trim(p_customer_email) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') THEN
      RETURN jsonb_build_object('success', false, 'error', 'البريد الإلكتروني غير صحيح');
    END IF;
  END IF;

  IF p_vehicle_make IS NULL OR length(trim(p_vehicle_make)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ماركة السيارة مطلوبة');
  END IF;

  IF p_vehicle_model IS NULL OR length(trim(p_vehicle_model)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'موديل السيارة مطلوب');
  END IF;

  IF p_vehicle_year IS NULL OR p_vehicle_year < 1900 OR p_vehicle_year > EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'سنة الصنع غير صحيحة');
  END IF;

  IF p_preferred_date IS NULL OR p_preferred_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'يجب أن يكون التاريخ في المستقبل');
  END IF;

  IF p_preferred_time IS NULL OR length(trim(p_preferred_time)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الوقت المفضل مطلوب');
  END IF;

  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملاحظات طويلة جداً');
  END IF;

  v_normalized_phone := regexp_replace(trim(p_customer_phone), '[^0-9]', '', 'g');
  IF length(v_normalized_phone) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'رقم الهاتف غير صحيح');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_booking_id
    FROM bookings WHERE idempotency_key = p_idempotency_key::text LIMIT 1;
    IF v_existing_booking_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'booking_id', v_existing_booking_id, 'message', 'تم استلام طلب الحجز مسبقاً');
    END IF;
  END IF;

  IF (
    SELECT count(*) FROM bookings b
    JOIN customers c ON c.id = b.customer_id
    WHERE c.phone = v_normalized_phone AND b.created_at >= CURRENT_DATE
  ) >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لقد تجاوزت الحد المسموح. يمكنك المحاولة مرة أخرى غداً.');
  END IF;

  SELECT id INTO v_customer_id FROM customers WHERE phone = v_normalized_phone LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (full_name, phone, email, is_active, source)
    VALUES (trim(p_customer_name), v_normalized_phone,
      CASE WHEN length(trim(COALESCE(p_customer_email, ''))) > 0 THEN trim(p_customer_email) ELSE NULL END,
      true, 'online')
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE customers SET full_name = trim(p_customer_name),
      email = COALESCE(NULLIF(trim(COALESCE(p_customer_email, '')), ''), email),
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  SELECT id INTO v_vehicle_id FROM vehicles
  WHERE customer_id = v_customer_id
    AND lower(make) = lower(trim(p_vehicle_make))
    AND lower(model) = lower(trim(p_vehicle_model))
    AND year = p_vehicle_year
  LIMIT 1;
  IF v_vehicle_id IS NULL THEN
    INSERT INTO vehicles (customer_id, make, model, year, color, plate_number, is_active)
    VALUES (v_customer_id, trim(p_vehicle_make), trim(p_vehicle_model), p_vehicle_year,
      NULLIF(trim(COALESCE(p_vehicle_color, '')), ''), NULLIF(trim(COALESCE(p_vehicle_plate, '')), ''), true)
    RETURNING id INTO v_vehicle_id;
  ELSE
    UPDATE vehicles SET color = COALESCE(NULLIF(trim(COALESCE(p_vehicle_color, '')), ''), color),
      plate_number = COALESCE(NULLIF(trim(COALESCE(p_vehicle_plate, '')), ''), plate_number),
      updated_at = now()
    WHERE id = v_vehicle_id;
  END IF;

  INSERT INTO bookings (service_id, customer_id, vehicle_id, status, preferred_date, preferred_time, customer_notes, source, idempotency_key)
  VALUES (p_service_id, v_customer_id, v_vehicle_id, 'new', p_preferred_date, p_preferred_time::time, NULLIF(trim(COALESCE(p_notes, '')), ''), 'online', p_idempotency_key::text)
  RETURNING id INTO v_booking_id;

  INSERT INTO booking_status_history (booking_id, old_status, new_status, notes)
  VALUES (v_booking_id, NULL, 'new', 'تم إنشاء الحجز من الموقع العام');

  -- booking_created notification to all staff with bookings:read
  INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
  SELECT DISTINCT s.user_id, 'booking_created', 'حجز جديد',
    'تم إنشاء حجز جديد رقم ' || substring(v_booking_id::text from 1 for 8) || ' للخدمة ' || v_service.name,
    'bookings', v_booking_id
  FROM public.staff s
  WHERE s.is_active = true
    AND s.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = s.role_id
        AND p.resource = 'bookings' AND p.action = 'read'
    );

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id, 'message', 'تم استلام طلب الحجز بنجاح');
END;
$$;
