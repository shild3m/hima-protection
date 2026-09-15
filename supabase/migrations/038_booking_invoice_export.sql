-- ============================================================
-- MIGRATION 038: Booking → Invoice Export Pipeline
-- 1. vehicles.size (small / medium / large)
-- 2. service_materials per-size quantities
-- 3. export_booking_invoice(): atomic issue + payment + inventory deduction
-- Security: SECURITY DEFINER, permissions, row locking, idempotency, audit
-- ============================================================

-- ------------------------------------------------------------
-- 1. VEHICLE SIZE
-- ------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS size text DEFAULT 'medium'
  CHECK (size IN ('small', 'medium', 'large'));

-- ------------------------------------------------------------
-- 2. SERVICE MATERIALS PER-SIZE QUANTITIES
--    qty_small/qty_medium/qty_large = expected usage per car size
--    Backfill old rows with expected_quantity for all sizes.
-- ------------------------------------------------------------
ALTER TABLE public.service_materials
  ADD COLUMN IF NOT EXISTS qty_small  numeric NOT NULL DEFAULT 0 CHECK (qty_small  >= 0),
  ADD COLUMN IF NOT EXISTS qty_medium numeric NOT NULL DEFAULT 0 CHECK (qty_medium >= 0),
  ADD COLUMN IF NOT EXISTS qty_large  numeric NOT NULL DEFAULT 0 CHECK (qty_large  >= 0);

UPDATE public.service_materials
SET qty_small  = COALESCE(expected_quantity, 0),
    qty_medium = COALESCE(expected_quantity, 0),
    qty_large  = COALESCE(expected_quantity, 0)
WHERE qty_small = 0 AND qty_medium = 0 AND qty_large = 0
  AND expected_quantity IS NOT NULL AND expected_quantity > 0;

DROP INDEX IF EXISTS idx_service_materials_service;
CREATE INDEX IF NOT EXISTS idx_service_materials_service ON public.service_materials(service_id);

-- ------------------------------------------------------------
-- 3. EXPORT FUNCTION (Atomic + Authorization + Idempotency)
--    Issue invoice → record payment → deduct materials (by vehicle size)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_booking_invoice(
  p_invoice_id       uuid,
  p_payment_method   text,
  p_idempotency_key  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id     uuid;
  v_invoice       record;
  v_booking       record;
  v_payment_key   text;
  v_payment_result jsonb;
  v_material      record;
  v_usage_result  jsonb;
  v_materials     jsonb := '[]'::jsonb;
  v_vehicle_size  text;
  v_deducted_qty  numeric;
BEGIN
  v_caller_id := auth.uid();
  v_payment_key := COALESCE(p_idempotency_key, 'export_' || p_invoice_id::text);

  -- Authorization (bundle: export needs invoice + payment + inventory usage)
  IF NOT public.has_permission(v_caller_id, 'invoices', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية تصدير الفواتير');
  END IF;
  IF NOT public.has_permission(v_caller_id, 'payments', 'create') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية تسجيل الدفع');
  END IF;
  IF NOT public.has_permission(v_caller_id, 'inventory', 'usage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية استخدام المخزون');
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'card', 'bank_transfer', 'online') THEN
    RETURN jsonb_build_object('success', false, 'error', 'طريقة الدفع غير صحيحة');
  END IF;

  -- Lock the invoice row (prevents double export race)
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;

  IF v_invoice.status NOT IN ('draft') THEN
    RETURN jsonb_build_object('success', false, 'error', 'يمكن تصدير الفواتير المسودة فقط');
  END IF;

  -- Payment idempotency: one payment per export
  IF v_payment_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.payments
      WHERE idempotency_key = v_payment_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'تم تصدير هذه الفاتورة مسبقاً');
    END IF;
  END IF;

  -- 1) Issue the invoice
  UPDATE public.invoices
  SET status = 'issued',
      issued_at = now(),
      updated_at = now()
  WHERE id = p_invoice_id;

  -- 2) Record the full payment
  v_payment_result := public.record_payment(
    p_invoice_id,
    v_invoice.total,
    p_payment_method,
    NULL,
    'دفع تلقائي عند تصدير الفاتورة',
    v_payment_key
  );

  IF NOT (v_payment_result->>'success')::boolean THEN
    RAISE EXCEPTION 'تعذر تسجيل الدفعة: %', v_payment_result->>'error';
  END IF;

  -- 3) Deduct materials if the invoice is linked to a booking
  IF v_invoice.booking_id IS NOT NULL THEN
    SELECT b.vehicle_id, b.service_id, ve.size
      INTO v_booking, v_vehicle_size
    FROM public.bookings b
    LEFT JOIN public.vehicles ve ON ve.id = b.vehicle_id
    WHERE b.id = v_invoice.booking_id;

    IF v_booking.vehicle_id IS NOT NULL THEN
      FOR v_material IN
        SELECT sm.material_id AS id,
               m.name,
               m.unit,
               SUM(
                 CASE v_vehicle_size
                   WHEN 'small'  THEN COALESCE(sm.qty_small, 0)
                   WHEN 'large'  THEN COALESCE(sm.qty_large, 0)
                   ELSE COALESCE(sm.qty_medium, 0)
                 END
               ) AS total_qty
        FROM public.invoice_items ii
        JOIN public.service_materials sm ON sm.service_id = ii.service_id
        JOIN public.materials m ON m.id = sm.material_id
        WHERE ii.invoice_id = p_invoice_id
          AND ii.service_id IS NOT NULL
        GROUP BY sm.material_id, m.name, m.unit
        HAVING SUM(
          CASE v_vehicle_size
            WHEN 'small'  THEN COALESCE(sm.qty_small, 0)
            WHEN 'large'  THEN COALESCE(sm.qty_large, 0)
            ELSE COALESCE(sm.qty_medium, 0)
          END
        ) > 0
      LOOP
        v_deducted_qty := v_material.total_qty;

        v_usage_result := public.record_inventory_usage(
          p_material_id     := v_material.id,
          p_quantity        := v_deducted_qty,
          p_booking_id      := v_invoice.booking_id,
          p_service_id      := v_booking.service_id,
          p_vehicle_id      := v_booking.vehicle_id,
          p_notes           := 'خصم تلقائي عند تصدير الفاتورة ' || v_invoice.invoice_number,
          p_idempotency_key := 'export_' || p_invoice_id::text || '_' || v_material.id::text
        );

        IF NOT (v_usage_result->>'success')::boolean THEN
          RAISE EXCEPTION 'فشل خصم المادة "%": %', v_material.name, v_usage_result->>'error';
        END IF;

        v_materials := v_materials || jsonb_build_object(
          'material_id', v_material.id,
          'name', v_material.name,
          'unit', v_material.unit,
          'quantity', v_deducted_qty
        );
      END LOOP;
    END IF;
  END IF;

  -- Audit
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id,
    'invoice_exported',
    'invoices',
    p_invoice_id,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total', v_invoice.total,
      'payment_method', p_payment_method,
      'payment_id', v_payment_result->>'payment_id',
      'materials_deducted', v_materials,
      'exported_by', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'total', v_invoice.total,
    'payment_id', v_payment_result->>'payment_id',
    'payment_method', p_payment_method,
    'new_status', (SELECT status FROM public.invoices WHERE id = p_invoice_id),
    'materials_deducted', v_materials
  );
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.export_booking_invoice(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.export_booking_invoice(uuid, text, text) TO authenticated, service_role;