-- ============================================================
-- MIGRATION 049: Inventory reservation consistency
--
-- 1. Do not reserve materials that were already consumed for the booking.
--    This happens when an invoice is issued before the booking changes status.
-- 2. Clean up reservations that became phantom rows because of the old order.
-- 3. Make invoice export idempotent before the status check.
-- 4. Cancel an issued invoice and return its materials when the service was
--    not completed (same policy used by refund).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Reserve only what was not consumed yet.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_booking_materials(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_booking_status text;
  v_vehicle_size text;
  v_req record;
  v_material record;
  v_existing record;
  v_other_reserved numeric;
  v_consumed numeric;
  v_needed numeric;
  v_available numeric;
  v_shortages jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_permission(v_caller_id, 'bookings', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية تحديث الحجوزات');
  END IF;

  SELECT b.status, COALESCE(v.size, 'medium')
  INTO v_booking_status, v_vehicle_size
  FROM public.bookings b
  LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF v_booking_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الحجز غير موجود');
  END IF;

  -- First pass: lock and validate every required material before changing any
  -- reservation row. This prevents partial reservations on a shortage.
  FOR v_req IN
    WITH requested_services AS (
      SELECT b.service_id, 1::numeric AS service_quantity
      FROM public.bookings b
      WHERE b.id = p_booking_id
        AND b.service_id IS NOT NULL
      UNION ALL
      SELECT bi.service_id, bi.quantity::numeric
      FROM public.booking_items bi
      WHERE bi.booking_id = p_booking_id
    )
    SELECT sm.material_id,
           SUM(
             rs.service_quantity * CASE v_vehicle_size
               WHEN 'small' THEN COALESCE(sm.qty_small, sm.expected_quantity, 0)
               WHEN 'large' THEN COALESCE(sm.qty_large, sm.expected_quantity, 0)
               ELSE COALESCE(sm.qty_medium, sm.expected_quantity, 0)
             END
           ) AS required_quantity
    FROM requested_services rs
    JOIN public.service_materials sm ON sm.service_id = rs.service_id
    GROUP BY sm.material_id
    HAVING SUM(
      rs.service_quantity * CASE v_vehicle_size
        WHEN 'small' THEN COALESCE(sm.qty_small, sm.expected_quantity, 0)
        WHEN 'large' THEN COALESCE(sm.qty_large, sm.expected_quantity, 0)
        ELSE COALESCE(sm.qty_medium, sm.expected_quantity, 0)
      END
    ) > 0
    ORDER BY sm.material_id
  LOOP
    -- Net amount already consumed for this booking (usage is negative and
    -- returns are positive), including invoices issued earlier.
    SELECT COALESCE(-SUM(it.quantity), 0)
    INTO v_consumed
    FROM public.inventory_transactions it
    WHERE it.booking_id = p_booking_id
      AND it.material_id = v_req.material_id
      AND it.type IN ('usage', 'return');

    IF v_consumed >= v_req.required_quantity THEN
      CONTINUE;
    END IF;

    v_needed := v_req.required_quantity - GREATEST(v_consumed, 0);

    SELECT id, name, unit, current_stock, is_active
    INTO v_material
    FROM public.materials
    WHERE id = v_req.material_id
    FOR UPDATE;

    SELECT COALESCE(SUM(quantity), 0)
    INTO v_other_reserved
    FROM public.inventory_reservations
    WHERE material_id = v_req.material_id
      AND status = 'reserved'
      AND booking_id <> p_booking_id;

    v_available := COALESCE(v_material.current_stock, 0) - v_other_reserved;

    IF v_material IS NULL OR NOT v_material.is_active OR v_available < v_needed THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'material_id', v_req.material_id,
        'name', COALESCE(v_material.name, 'مادة غير موجودة'),
        'unit', COALESCE(v_material.unit, ''),
        'required', v_needed,
        'available', GREATEST(v_available, 0)
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_shortages) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'المخزون غير كافٍ للمواد المطلوبة',
      'shortages', v_shortages
    );
  END IF;

  -- Second pass: create or update the active reservation rows.
  FOR v_req IN
    WITH requested_services AS (
      SELECT b.service_id, 1::numeric AS service_quantity
      FROM public.bookings b
      WHERE b.id = p_booking_id
        AND b.service_id IS NOT NULL
      UNION ALL
      SELECT bi.service_id, bi.quantity::numeric
      FROM public.booking_items bi
      WHERE bi.booking_id = p_booking_id
    )
    SELECT sm.material_id,
           SUM(
             rs.service_quantity * CASE v_vehicle_size
               WHEN 'small' THEN COALESCE(sm.qty_small, sm.expected_quantity, 0)
               WHEN 'large' THEN COALESCE(sm.qty_large, sm.expected_quantity, 0)
               ELSE COALESCE(sm.qty_medium, sm.expected_quantity, 0)
             END
           ) AS required_quantity
    FROM requested_services rs
    JOIN public.service_materials sm ON sm.service_id = rs.service_id
    GROUP BY sm.material_id
    HAVING SUM(
      rs.service_quantity * CASE v_vehicle_size
        WHEN 'small' THEN COALESCE(sm.qty_small, sm.expected_quantity, 0)
        WHEN 'large' THEN COALESCE(sm.qty_large, sm.expected_quantity, 0)
        ELSE COALESCE(sm.qty_medium, sm.expected_quantity, 0)
      END
    ) > 0
    ORDER BY sm.material_id
  LOOP
    SELECT COALESCE(-SUM(it.quantity), 0)
    INTO v_consumed
    FROM public.inventory_transactions it
    WHERE it.booking_id = p_booking_id
      AND it.material_id = v_req.material_id
      AND it.type IN ('usage', 'return');

    IF v_consumed >= v_req.required_quantity THEN
      CONTINUE;
    END IF;

    v_needed := v_req.required_quantity - GREATEST(v_consumed, 0);

    SELECT id, status, quantity
    INTO v_existing
    FROM public.inventory_reservations
    WHERE booking_id = p_booking_id
      AND material_id = v_req.material_id
      AND status IN ('reserved', 'consumed')
    ORDER BY reserved_at DESC
    LIMIT 1
    FOR UPDATE;

    -- A consumed reservation is already fulfilled; do not reserve it again
    -- when the booking moves from in_progress to completed.
    IF v_existing.status = 'consumed' THEN
      CONTINUE;
    END IF;

    IF v_existing.id IS NULL THEN
      INSERT INTO public.inventory_reservations (
        booking_id, material_id, quantity, status, created_by
      ) VALUES (
        p_booking_id, v_req.material_id, v_needed, 'reserved', v_caller_id
      );
    ELSE
      UPDATE public.inventory_reservations
      SET quantity = v_needed,
          reserved_at = now(),
          created_by = v_caller_id
      WHERE id = v_existing.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'status', 'reserved');
END;
$$;

-- ------------------------------------------------------------
-- 2. Release phantom reservations from the old ordering.
-- ------------------------------------------------------------
UPDATE public.inventory_reservations ir
SET status = 'released', released_at = now()
WHERE ir.status = 'reserved'
  AND (
    SELECT COALESCE(-SUM(it.quantity), 0)
    FROM public.inventory_transactions it
    WHERE it.booking_id = ir.booking_id
      AND it.material_id = ir.material_id
      AND it.type IN ('usage', 'return')
  ) >= ir.quantity;

-- ------------------------------------------------------------
-- 3. Export is idempotent even if the invoice is no longer a draft.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_invoice_with_materials(
  p_invoice_id uuid,
  p_payment_method text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_invoice record;
  v_material_result jsonb;
  v_payment_id uuid;
  v_key text := COALESCE(p_idempotency_key, 'export_' || p_invoice_id::text);
BEGIN
  IF NOT public.has_permission(v_caller_id, 'invoices', 'update')
     OR NOT public.has_permission(v_caller_id, 'payments', 'create')
     OR NOT public.has_permission(v_caller_id, 'inventory', 'usage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا تملك الصلاحيات المطلوبة لتصدير الفاتورة');
  END IF;

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('cash', 'card', 'bank_transfer', 'online', 'tabby', 'tamara') THEN
    RETURN jsonb_build_object('success', false, 'error', 'طريقة الدفع غير صحيحة');
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE idempotency_key = v_key
      AND invoice_id = p_invoice_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'تم تصدير هذه الفاتورة مسبقاً');
  END IF;

  IF v_invoice.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'يمكن تصدير الفواتير المسودة فقط');
  END IF;

  UPDATE public.invoices
  SET status = 'issued', issued_at = now(), updated_at = now()
  WHERE id = p_invoice_id;

  v_material_result := public.consume_booking_invoice_materials(p_invoice_id);

  IF v_invoice.total <= 0 THEN
    RAISE EXCEPTION 'لا يمكن تسجيل دفعة لفاتورة قيمتها صفر';
  END IF;

  INSERT INTO public.payments (
    invoice_id, amount, payment_method, notes, idempotency_key, created_by
  ) VALUES (
    p_invoice_id, v_invoice.total, p_payment_method,
    'دفع تلقائي عند تصدير الفاتورة', v_key, v_caller_id
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.invoices
  SET paid_amount = total, status = 'paid', updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'invoice_exported', 'invoices', p_invoice_id,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total', v_invoice.total,
      'payment_method', p_payment_method,
      'payment_id', v_payment_id,
      'materials_deducted', v_material_result->'materials'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'total', v_invoice.total,
    'payment_id', v_payment_id,
    'payment_method', p_payment_method,
    'new_status', 'paid',
    'materials_deducted', v_material_result->'materials'
  );
END;
$$;

-- ------------------------------------------------------------
-- 4. Cancel an issued invoice and return materials when applicable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_invoice_with_materials(
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_invoice record;
  v_booking_status text;
  v_tx record;
  v_material record;
  v_return_key text;
  v_returned jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_permission(v_caller_id, 'invoices', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية إلغاء الفواتير');
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;

  IF v_invoice.status NOT IN ('draft', 'issued') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء هذه الفاتورة');
  END IF;

  IF v_invoice.paid_amount > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء فاتورة مدفوعة جزئيًا');
  END IF;

  IF v_invoice.status = 'issued' THEN
    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = v_invoice.booking_id;

    IF v_booking_status IS DISTINCT FROM 'completed' THEN
      FOR v_tx IN
        SELECT it.*
        FROM public.inventory_transactions it
        WHERE it.reference_type = 'invoice'
          AND it.reference_id = p_invoice_id
          AND it.quantity < 0
          AND it.type = 'usage'
        ORDER BY it.created_at
      LOOP
        v_return_key := 'cancel_' || p_invoice_id::text || '_' || v_tx.material_id::text;

        IF EXISTS (
          SELECT 1 FROM public.inventory_transactions
          WHERE idempotency_key = v_return_key
        ) THEN
          CONTINUE;
        END IF;

        SELECT id, name, unit
        INTO v_material
        FROM public.materials
        WHERE id = v_tx.material_id
        FOR UPDATE;

        IF v_material IS NULL THEN
          CONTINUE;
        END IF;

        UPDATE public.materials
        SET current_stock = current_stock + ABS(v_tx.quantity), updated_at = now()
        WHERE id = v_tx.material_id;

        INSERT INTO public.inventory_transactions (
          material_id, quantity, type, reference_type, reference_id,
          vehicle_id, booking_id, notes, idempotency_key, created_by
        ) VALUES (
          v_tx.material_id, ABS(v_tx.quantity), 'return', 'invoice', p_invoice_id,
          v_tx.vehicle_id, v_tx.booking_id,
          'إرجاع مواد عند إلغاء الفاتورة', v_return_key, v_caller_id
        );

        UPDATE public.inventory_reservations
        SET status = 'returned', invoice_id = p_invoice_id, returned_at = now()
        WHERE booking_id = v_tx.booking_id
          AND material_id = v_tx.material_id
          AND status = 'consumed';

        v_returned := v_returned || jsonb_build_array(jsonb_build_object(
          'material_id', v_tx.material_id,
          'quantity', ABS(v_tx.quantity)
        ));
      END LOOP;
    END IF;
  END IF;

  UPDATE public.invoices
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_caller_id,
      updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'invoice_cancelled', 'invoices', p_invoice_id,
    jsonb_build_object(
      'previous_status', v_invoice.status,
      'booking_status', v_booking_status,
      'materials_returned', v_returned
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'new_status', 'cancelled',
    'materials_returned', v_returned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_booking_materials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_booking_materials(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.export_invoice_with_materials(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_invoice_with_materials(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_invoice_with_materials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_with_materials(uuid) TO authenticated, service_role;

COMMIT;
