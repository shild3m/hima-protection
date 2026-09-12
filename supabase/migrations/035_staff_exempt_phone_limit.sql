-- ============================================================
-- PHASE: Staff exemption from daily per-phone booking limit
-- ============================================================
-- Applies the 3-bookings-per-day-per-phone limit ONLY to
-- non-staff callers (public booking form = anon/authenticated
-- visitors). Logged-in staff (admin panel) are exempt.
-- CREATE OR REPLACE keeps existing GRANTs.
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

  -- Daily per-phone limit applies to NON-STAFF callers (public form) only.
  -- Logged-in staff (admin panel) are exempt.
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