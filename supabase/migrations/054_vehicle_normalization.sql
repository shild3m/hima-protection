-- ============================================================
-- 054: Vehicle identity = serial number (VIN) + tentative/confirmed
--      + public booking without a vehicle
-- ============================================================
-- Rules implemented (agreed with the owner):
--   1. The serial number (VIN, "الرقم التسلسلي") is the vehicle identity:
--      - mandatory (NOT NULL)
--      - unique, ignoring case/spaces/dashes
--      - the plate number is NOT unique and NOT an identity
--      - same VIN + new plate  => same vehicle (plate updated, old kept)
--      - new VIN  + old plate  => different vehicle
--   2. vehicles.status = 'tentative' (registered by a booking that entered
--      service) / 'confirmed' (booking completed).
--   3. Public booking collects only: name + phone + service
--      => bookings.vehicle_id becomes nullable; the vehicle is completed by
--      staff when the booking moves to "in_progress".
--
-- Safe to run on the current database:
--   vehicles = 0 rows, bookings = 0 rows, so NOT NULL / DROP NOT NULL are safe.
-- ============================================================

-- ------------------------------------------------------------
-- 1) vehicles: status (tentative / confirmed)
-- ------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'tentative';

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('tentative', 'confirmed'));

-- Plate history: a plate can change while the serial number stays the same.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS previous_plates text[] NOT NULL DEFAULT '{}';

-- ------------------------------------------------------------
-- 2) vehicles: the serial number is mandatory and unique
-- ------------------------------------------------------------
-- Blank strings would block the unique index, drop them first.
UPDATE public.vehicles
SET vin = NULL
WHERE vin IS NOT NULL AND btrim(vin) = '';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vehicles WHERE vin IS NULL) THEN
    RAISE EXCEPTION 'vehicles.vin is NULL on existing rows — fill the serial numbers first';
  END IF;
END $$;

ALTER TABLE public.vehicles ALTER COLUMN vin SET NOT NULL;

-- Identity index: 'ab x-12' = 'ABX12'. Plate stays non-unique on purpose.
DROP INDEX IF EXISTS public.vehicles_vin_unique;
CREATE UNIQUE INDEX vehicles_vin_unique
  ON public.vehicles (lower(regexp_replace(btrim(vin), '[\s-]', '', 'g')));

-- ------------------------------------------------------------
-- 3) bookings: the vehicle may be missing until staff completes it
-- ------------------------------------------------------------
ALTER TABLE public.bookings ALTER COLUMN vehicle_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 4) Public booking RPC: name + phone + service only.
--    No vehicle is created for an online booking.
--    (Drops every existing overload so PostgREST sees exactly one.)
-- ------------------------------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'create_booking' AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || f.sig;
  END LOOP;
END $$;

CREATE FUNCTION public.create_booking(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_email   text,
  p_service_id       uuid,
  p_preferred_date   date DEFAULT NULL,
  p_preferred_time   text DEFAULT NULL,
  p_notes            text DEFAULT NULL,
  p_idempotency_key  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_customer_id        uuid;
  v_booking_id         uuid;
  v_service            record;
  v_normalized_phone   text;
  v_existing_booking_id uuid;
  v_preferred_time_raw text;
  v_preferred_time     time;
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

  -- Date/time are optional: the staff member completes them later.
  IF p_preferred_date IS NOT NULL AND p_preferred_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'يجب أن يكون التاريخ في المستقبل');
  END IF;

  v_preferred_time_raw := NULLIF(btrim(COALESCE(p_preferred_time, '')), '');
  IF v_preferred_time_raw IS NOT NULL AND v_preferred_time_raw !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'الوقت المفضل غير صحيح');
  END IF;
  v_preferred_time := v_preferred_time_raw::time;

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

  -- Daily per-phone limit applies to NON-STAFF callers (public form) only.
  IF NOT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  ) THEN
    IF (
      SELECT count(*) FROM bookings b
      JOIN customers c ON c.id = b.customer_id
      WHERE c.phone = v_normalized_phone AND b.created_at >= CURRENT_DATE
    ) >= 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'لقد تجاوزت الحد المسموح. يمكنك المحاولة مرة أخرى غداً.');
    END IF;
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

  -- No vehicle here on purpose: the online booking carries only
  -- name + phone + service. Staff attach the vehicle when the booking
  -- moves to "in_progress" (serial number is mandatory by then).
  INSERT INTO bookings (service_id, customer_id, vehicle_id, status, preferred_date, preferred_time, customer_notes, source, idempotency_key)
  VALUES (p_service_id, v_customer_id, NULL, 'new',
    p_preferred_date, v_preferred_time,
    NULLIF(trim(COALESCE(p_notes, '')), ''), 'online', p_idempotency_key::text)
  RETURNING id INTO v_booking_id;

  INSERT INTO booking_status_history (booking_id, old_status, new_status, notes)
  VALUES (v_booking_id, NULL, 'new', 'تم إنشاء الحجز من الموقع العام');

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

REVOKE ALL ON FUNCTION public.create_booking(text, text, text, uuid, date, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(text, text, text, uuid, date, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_booking(text, text, text, uuid, date, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(text, text, text, uuid, date, text, text, uuid) TO service_role;

-- ------------------------------------------------------------
-- 5) Helper: find a vehicle by its serial number, using the exact same
--    normalization as the unique index (case/spaces/dashes insensitive).
--    SECURITY INVOKER => normal RLS rules still apply to the caller.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.vehicles_by_serial(text);
CREATE FUNCTION public.vehicles_by_serial(p_serial text)
RETURNS SETOF public.vehicles
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.*
  FROM public.vehicles v
  WHERE lower(regexp_replace(btrim(v.vin), '[\s-]', '', 'g'))
      = lower(regexp_replace(btrim(COALESCE(p_serial, '')), '[\s-]', '', 'g'))
    AND btrim(COALESCE(p_serial, '')) <> '';
$$;

REVOKE ALL ON FUNCTION public.vehicles_by_serial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vehicles_by_serial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vehicles_by_serial(text) TO service_role;

-- ============================================================
-- Verification (expected: 0 rows, 0 rows, 0 rows, 2 rows)
-- ============================================================
-- SELECT count(*) FROM public.vehicles WHERE vin IS NULL;          -- 0
-- SELECT indexdef FROM pg_indexes
--   WHERE tablename = 'vehicles' AND indexname = 'vehicles_vin_unique';
-- SELECT attname, attnotnull FROM pg_attribute
--   WHERE attrelid = 'public.bookings'::regclass AND attname = 'vehicle_id';
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'create_booking';
-- SELECT public.vehicles_by_serial('TEST-001');   -- helper (empty for now)
