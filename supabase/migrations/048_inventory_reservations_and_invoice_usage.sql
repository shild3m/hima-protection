-- ============================================================
-- MIGRATION 048: Inventory reservations and invoice consumption
--
-- A booking reserves the material needed by its services when it enters
-- in_progress/completed. The physical stock is consumed exactly once when
-- the linked invoice is issued/exported.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  material_id  uuid NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  invoice_id   uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  quantity     numeric NOT NULL CHECK (quantity > 0),
  status       text NOT NULL DEFAULT 'reserved'
               CHECK (status IN ('reserved', 'consumed', 'released', 'returned')),
  reserved_at  timestamptz NOT NULL DEFAULT now(),
  consumed_at  timestamptz,
  released_at  timestamptz,
  returned_at  timestamptz,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_active
  ON public.inventory_reservations(booking_id, material_id)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_material_status
  ON public.inventory_reservations(material_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_booking_status
  ON public.inventory_reservations(booking_id, status);

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_select_inventory_reservations
  ON public.inventory_reservations;

CREATE POLICY staff_select_inventory_reservations
  ON public.inventory_reservations FOR SELECT
  USING (public.has_permission(auth.uid(), 'inventory', 'read'));

-- Reserve all material requirements for a booking. The material rows are
-- locked in a stable order so two bookings cannot reserve the same stock race.
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

    IF v_material IS NULL OR NOT v_material.is_active OR v_available < v_req.required_quantity THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'material_id', v_req.material_id,
        'name', COALESCE(v_material.name, 'مادة غير موجودة'),
        'unit', COALESCE(v_material.unit, ''),
        'required', v_req.required_quantity,
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
        p_booking_id, v_req.material_id, v_req.required_quantity, 'reserved', v_caller_id
      );
    ELSE
      UPDATE public.inventory_reservations
      SET quantity = v_req.required_quantity,
          reserved_at = now(),
          created_by = v_caller_id
      WHERE id = v_existing.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'status', 'reserved');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_booking_materials(
  p_booking_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT public.has_permission(v_caller_id, 'bookings', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية تحديث الحجوزات');
  END IF;

  UPDATE public.inventory_reservations
  SET status = 'released', released_at = now()
  WHERE booking_id = p_booking_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'released', v_count);
END;
$$;

-- Internal atomic consumption helper. It is called only by the invoice RPCs.
CREATE OR REPLACE FUNCTION public.consume_booking_invoice_materials(
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_vehicle_size text;
  v_req record;
  v_material record;
  v_booking_id uuid;
  v_vehicle_id uuid;
  v_existing_tx uuid;
  v_reservation record;
  v_materials jsonb := '[]'::jsonb;
  v_key text;
BEGIN
  SELECT i.id, i.booking_id, i.vehicle_id
  INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL OR v_invoice.booking_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'materials', v_materials);
  END IF;

  v_booking_id := v_invoice.booking_id;
  v_vehicle_id := v_invoice.vehicle_id;

  SELECT COALESCE(v.size, 'medium')
  INTO v_vehicle_size
  FROM public.bookings b
  LEFT JOIN public.vehicles v ON v.id = COALESCE(v_vehicle_id, b.vehicle_id)
  WHERE b.id = v_booking_id;

  FOR v_req IN
    SELECT sm.material_id,
           SUM(
             ii.quantity * CASE v_vehicle_size
               WHEN 'small' THEN COALESCE(sm.qty_small, sm.expected_quantity, 0)
               WHEN 'large' THEN COALESCE(sm.qty_large, sm.expected_quantity, 0)
               ELSE COALESCE(sm.qty_medium, sm.expected_quantity, 0)
             END
           ) AS required_quantity
    FROM public.invoice_items ii
    JOIN public.service_materials sm ON sm.service_id = ii.service_id
    WHERE ii.invoice_id = p_invoice_id
      AND ii.service_id IS NOT NULL
    GROUP BY sm.material_id
    HAVING SUM(
      ii.quantity * CASE v_vehicle_size
        WHEN 'small' THEN COALESCE(sm.qty_small, sm.expected_quantity, 0)
        WHEN 'large' THEN COALESCE(sm.qty_large, sm.expected_quantity, 0)
        ELSE COALESCE(sm.qty_medium, sm.expected_quantity, 0)
      END
    ) > 0
    ORDER BY sm.material_id
  LOOP
    v_key := 'invoice_' || p_invoice_id::text || '_' || v_req.material_id::text;

    -- Backward compatibility: old exports used export_<invoice>_<material>.
    SELECT id INTO v_existing_tx
    FROM public.inventory_transactions
    WHERE idempotency_key IN (
      v_key,
      'export_' || p_invoice_id::text || '_' || v_req.material_id::text
    )
    LIMIT 1;

    SELECT id, name, unit, current_stock, is_active
    INTO v_material
    FROM public.materials
    WHERE id = v_req.material_id
    FOR UPDATE;

    IF v_existing_tx IS NOT NULL THEN
      UPDATE public.inventory_reservations
      SET status = 'consumed', invoice_id = p_invoice_id, consumed_at = COALESCE(consumed_at, now())
      WHERE booking_id = v_booking_id
        AND material_id = v_req.material_id
        AND status = 'reserved';

      v_materials := v_materials || jsonb_build_array(jsonb_build_object(
        'material_id', v_req.material_id,
        'name', COALESCE(v_material.name, 'مادة'),
        'unit', COALESCE(v_material.unit, ''),
        'quantity', v_req.required_quantity,
        'duplicate', true
      ));
      CONTINUE;
    END IF;

    IF v_material IS NULL OR NOT v_material.is_active
       OR v_material.current_stock < v_req.required_quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK|%|%|%',
        COALESCE(v_material.name, 'مادة غير موجودة'),
        v_req.required_quantity,
        COALESCE(v_material.current_stock, 0);
    END IF;

    UPDATE public.materials
    SET current_stock = current_stock - v_req.required_quantity,
        updated_at = now()
    WHERE id = v_req.material_id;

    INSERT INTO public.inventory_transactions (
      material_id, quantity, type, reference_type, reference_id,
      vehicle_id, booking_id, notes, idempotency_key, created_by
    ) VALUES (
      v_req.material_id, -v_req.required_quantity, 'usage', 'invoice', p_invoice_id,
      v_vehicle_id, v_booking_id,
      'خصم تلقائي عند إصدار الفاتورة', v_key, auth.uid()
    );

    SELECT id, quantity
    INTO v_reservation
    FROM public.inventory_reservations
    WHERE booking_id = v_booking_id
      AND material_id = v_req.material_id
      AND status = 'reserved'
    ORDER BY reserved_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_reservation.id IS NOT NULL THEN
      UPDATE public.inventory_reservations
      SET status = 'consumed', invoice_id = p_invoice_id, consumed_at = now()
      WHERE id = v_reservation.id;
    END IF;

    v_materials := v_materials || jsonb_build_array(jsonb_build_object(
      'material_id', v_req.material_id,
      'name', v_material.name,
      'unit', v_material.unit,
      'quantity', v_req.required_quantity
    ));
  END LOOP;

  RETURN jsonb_build_object('success', true, 'materials', v_materials);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_invoice_with_materials(
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
  v_material_result jsonb;
BEGIN
  SELECT id, invoice_number, status, booking_id
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;

  IF NOT public.has_permission(v_caller_id, 'invoices', 'update')
     AND NOT (
       v_invoice.booking_id IS NOT NULL
       AND public.has_permission(v_caller_id, 'bookings', 'update')
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية إصدار الفواتير');
  END IF;

  IF v_invoice.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'يمكن إصدار الفواتير المسودة فقط');
  END IF;

  v_material_result := public.consume_booking_invoice_materials(p_invoice_id);

  UPDATE public.invoices
  SET status = 'issued', issued_at = now(), updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'materials_deducted', v_material_result->'materials'
  );
END;
$$;

-- Atomic export path: issue + consume materials + full payment.
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

  IF v_invoice.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'يمكن تصدير الفواتير المسودة فقط');
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments WHERE idempotency_key = v_key) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'تم تصدير هذه الفاتورة مسبقاً');
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

-- Refund the invoice and return consumed materials only while the booking is
-- not completed. A completed service means the materials were physically used.
CREATE OR REPLACE FUNCTION public.refund_invoice_with_materials(
  p_invoice_id uuid,
  p_reason text DEFAULT NULL
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
    RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية استرجاع الفواتير');
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;

  IF v_invoice.status NOT IN ('paid', 'partially_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن استرجاع هذه الفاتورة');
  END IF;

  SELECT status INTO v_booking_status
  FROM public.bookings
  WHERE id = v_invoice.booking_id;

  IF v_booking_status IS DISTINCT FROM 'completed' THEN
    FOR v_tx IN
      SELECT it.*
      FROM public.inventory_transactions it
      WHERE (
          (it.reference_type = 'invoice' AND it.reference_id = p_invoice_id)
          OR it.idempotency_key LIKE 'export_' || p_invoice_id::text || '_%'
        )
        AND it.quantity < 0
        AND it.type = 'usage'
      ORDER BY it.created_at
    LOOP
      v_return_key := 'refund_' || p_invoice_id::text || '_' || v_tx.material_id::text;

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
        COALESCE(p_reason, 'إرجاع مواد عند استرجاع الفاتورة'), v_return_key, v_caller_id
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

  UPDATE public.invoices
  SET status = 'refunded', notes = COALESCE(p_reason, notes), updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'invoice_refunded', 'invoices', p_invoice_id,
    jsonb_build_object(
      'reason', p_reason,
      'previous_status', v_invoice.status,
      'materials_returned', v_returned,
      'booking_status', v_booking_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'new_status', 'refunded',
    'materials_returned', v_returned
  );
END;
$$;

-- Availability for the inventory page.
CREATE OR REPLACE FUNCTION public.get_inventory_availability()
RETURNS TABLE (
  id uuid,
  name text,
  sku text,
  unit text,
  current_stock numeric,
  reserved_stock numeric,
  available_stock numeric,
  min_stock numeric,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventory', 'read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id,
         m.name,
         m.sku,
         m.unit,
         m.current_stock,
         COALESCE(SUM(ir.quantity) FILTER (WHERE ir.status = 'reserved'), 0)::numeric,
         (m.current_stock - COALESCE(SUM(ir.quantity) FILTER (WHERE ir.status = 'reserved'), 0))::numeric,
         m.min_stock,
         m.is_active
  FROM public.materials m
  LEFT JOIN public.inventory_reservations ir ON ir.material_id = m.id
  GROUP BY m.id, m.name, m.sku, m.unit, m.current_stock, m.min_stock, m.is_active
  ORDER BY m.name;
END;
$$;

-- Manual stock-out operations must not consume units reserved for bookings.
CREATE OR REPLACE FUNCTION public.record_stock_adjustment(
  p_material_id uuid,
  p_quantity numeric,
  p_direction text,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_material record;
  v_reserved numeric;
  v_available numeric;
  v_adjusted_qty numeric;
  v_tx_id uuid;
BEGIN
  IF NOT public.has_permission(v_caller_id, 'inventory', 'adjust') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: inventory.adjust');
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_direction NOT IN ('in', 'out') THEN
    RETURN jsonb_build_object('success', false, 'error', 'بيانات تعديل المخزون غير صحيحة');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx_id
    FROM public.inventory_transactions
    WHERE idempotency_key = p_idempotency_key;
    IF v_tx_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'duplicate', true);
    END IF;
  END IF;

  SELECT id, name, current_stock, min_stock, is_active
  INTO v_material
  FROM public.materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF v_material IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material not found');
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_reserved
  FROM public.inventory_reservations
  WHERE material_id = p_material_id AND status = 'reserved';

  v_available := v_material.current_stock - v_reserved;

  IF NOT v_material.is_active OR (p_direction = 'out' AND v_available < p_quantity) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock. Available: ' || GREATEST(v_available, 0) || ' of ' || v_material.name
    );
  END IF;

  v_adjusted_qty := CASE WHEN p_direction = 'in' THEN p_quantity ELSE -p_quantity END;

  UPDATE public.materials
  SET current_stock = current_stock + v_adjusted_qty, updated_at = now()
  WHERE id = p_material_id;

  INSERT INTO public.inventory_transactions (
    material_id, quantity, type, notes, idempotency_key, created_by
  ) VALUES (
    p_material_id, v_adjusted_qty, 'adjustment', p_notes, p_idempotency_key, v_caller_id
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'stock_adjustment', 'materials', p_material_id,
    jsonb_build_object('quantity', p_quantity, 'direction', p_direction,
                       'remaining_stock', v_material.current_stock + v_adjusted_qty,
                       'reserved_stock', v_reserved, 'notes', p_notes)
  );

  IF v_material.current_stock + v_adjusted_qty <= v_material.min_stock THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT DISTINCT s.user_id, 'low_stock', 'تنبيه: مخزون منخفض',
      'المادة ' || v_material.name || ' مخزونها ' || (v_material.current_stock + v_adjusted_qty),
      'materials', p_material_id
    FROM public.staff s
    WHERE s.is_active = true
      AND EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = s.role_id
          AND p.resource = 'inventory' AND p.action = 'read'
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'material_id', p_material_id,
    'quantity_adjusted', p_quantity,
    'direction', p_direction,
    'remaining_stock', v_material.current_stock + v_adjusted_qty,
    'available_stock', v_material.current_stock + v_adjusted_qty - v_reserved
  );
END;
$$;

-- Manual usage must also respect units reserved for active bookings.
CREATE OR REPLACE FUNCTION public.record_inventory_usage(
  p_material_id uuid,
  p_quantity numeric,
  p_booking_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_material record;
  v_reserved numeric;
  v_available numeric;
  v_tx_id uuid;
BEGIN
  IF NOT public.has_permission(v_caller_id, 'inventory', 'usage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: inventory.usage');
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be > 0');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_tx_id
    FROM public.inventory_transactions
    WHERE idempotency_key = p_idempotency_key;
    IF v_tx_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'duplicate', true);
    END IF;
  END IF;

  SELECT id, name, unit, current_stock, min_stock, is_active
  INTO v_material
  FROM public.materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF v_material IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material not found');
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_reserved
  FROM public.inventory_reservations
  WHERE material_id = p_material_id
    AND status = 'reserved'
    AND (p_booking_id IS NULL OR booking_id <> p_booking_id);

  v_available := v_material.current_stock - v_reserved;

  IF NOT v_material.is_active OR v_available < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock. Available: ' || GREATEST(v_available, 0) || ' of ' || v_material.name
    );
  END IF;

  UPDATE public.materials
  SET current_stock = current_stock - p_quantity, updated_at = now()
  WHERE id = p_material_id;

  INSERT INTO public.inventory_transactions (
    material_id, quantity, type, reference_type, reference_id,
    vehicle_id, booking_id, service_id, notes, idempotency_key, created_by
  ) VALUES (
    p_material_id, -p_quantity, 'usage', 'booking', p_booking_id,
    p_vehicle_id, p_booking_id, p_service_id, p_notes, p_idempotency_key, v_caller_id
  )
  RETURNING id INTO v_tx_id;

  IF v_material.current_stock - p_quantity <= v_material.min_stock THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT s.user_id, 'low_stock', 'Low Stock Alert',
      'Material ' || v_material.name || ' stock is ' || (v_material.current_stock - p_quantity),
      'materials', p_material_id
    FROM public.staff s
    WHERE s.is_active = true
      AND EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = s.role_id
          AND p.resource = 'inventory' AND p.action = 'read'
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'material_id', p_material_id,
    'quantity_deducted', p_quantity,
    'remaining_stock', v_material.current_stock - p_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_booking_materials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_booking_materials(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_booking_materials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_booking_materials(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_booking_invoice_materials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_booking_invoice_materials(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.issue_invoice_with_materials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_invoice_with_materials(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.export_invoice_with_materials(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_invoice_with_materials(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.refund_invoice_with_materials(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice_with_materials(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_inventory_availability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_availability() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_stock_adjustment(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_adjustment(uuid, numeric, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_inventory_usage(uuid, numeric, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inventory_usage(uuid, numeric, uuid, uuid, uuid, text, text) TO authenticated, service_role;

COMMIT;
