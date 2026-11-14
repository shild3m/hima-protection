-- ============================================================
-- MIGRATION 051: Consume materials only after the service is completed
--
-- Setting a booking to "in_progress" used to issue its invoice, and issuing
-- the invoice deducted the materials immediately. That made the reservation
-- invisible (reserved = 0) even though the work had just started.
--
-- Materials are now consumed only when the booking reaches "completed":
--   * issuing/exporting an invoice for an in-progress booking keeps the
--     reservation active and returns "deferred": true;
--   * when the booking is completed, an already issued/paid invoice is
--     consumed automatically by a trigger, inside the same transaction as the
--     status change, so a shortage still rolls the whole update back.
-- ============================================================

BEGIN;

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
  v_booking_status text;
  v_vehicle_size text;
  v_req record;
  v_material record;
  v_booking_id uuid;
  v_vehicle_id uuid;
  v_existing_tx uuid;
  v_reservation record;
  v_other_reserved numeric;
  v_available numeric;
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

  SELECT b.status
  INTO v_booking_status
  FROM public.bookings b
  WHERE b.id = v_booking_id;

  -- The service has not been completed yet: keep the reservation active and
  -- do not touch the physical stock.
  IF v_booking_status IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'deferred', true,
      'materials', v_materials
    );
  END IF;

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

    -- Units reserved for other bookings are not available to this invoice.
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_other_reserved
    FROM public.inventory_reservations
    WHERE material_id = v_req.material_id
      AND status = 'reserved'
      AND booking_id <> v_booking_id;

    v_available := COALESCE(v_material.current_stock, 0) - v_other_reserved;

    IF v_material IS NULL OR NOT v_material.is_active
       OR v_available < v_req.required_quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK|%|%|%',
        COALESCE(v_material.name, 'مادة غير موجودة'),
        v_req.required_quantity,
        GREATEST(v_available, 0);
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
      'خصم تلقائي عند إكمال الخدمة', v_key, auth.uid()
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

-- ------------------------------------------------------------
-- Consume an already issued/paid invoice when the booking is completed.
-- Runs inside the same transaction as the booking status update, so a
-- shortage rolls the status change back.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_consume_materials_on_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT i.id
    INTO v_invoice_id
    FROM public.invoices i
    WHERE i.booking_id = NEW.id
      AND i.status IN ('issued', 'partially_paid', 'paid')
    ORDER BY i.created_at DESC
    LIMIT 1;

    IF v_invoice_id IS NOT NULL THEN
      PERFORM public.consume_booking_invoice_materials(v_invoice_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consume_materials_on_booking_completion ON public.bookings;

CREATE TRIGGER consume_materials_on_booking_completion
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_consume_materials_on_booking_completion();

REVOKE ALL ON FUNCTION public.consume_booking_invoice_materials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_booking_invoice_materials(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.tg_consume_materials_on_booking_completion() FROM PUBLIC;

COMMIT;
