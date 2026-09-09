-- ============================================================
-- PHASE 16: SUPPLIERS + PURCHASES
-- Migration 023: receive_existing_purchase function
--
-- Purpose: Receive a purchase order using EXISTING purchase_items
-- that were stored at creation time. The existing receive_purchase()
-- function inserts items from JSONB input; this new function reads
-- items already in purchase_items table.
--
-- SAFETY:
-- - CREATE OR REPLACE (idempotent, safe to run multiple times)
-- - Does NOT modify existing tables or functions
-- - Does NOT modify RLS policies
-- - Additive only
-- ============================================================

CREATE OR REPLACE FUNCTION public.receive_existing_purchase(
  p_purchase_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid;
  v_purchase   record;
  v_item       record;
  v_total      numeric := 0;
  v_item_count integer := 0;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_permission(v_caller_id, 'purchases', 'receive') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: purchases.receive');
  END IF;

  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase not found');
  END IF;

  IF v_purchase.status != 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot receive purchase with status: ' || v_purchase.status);
  END IF;

  FOR v_item IN
    SELECT pi.id, pi.material_id, pi.quantity, pi.unit_cost, m.name AS material_name
    FROM public.purchase_items pi
    JOIN public.materials m ON m.id = pi.material_id
    WHERE pi.purchase_id = p_purchase_id
  LOOP
    v_total := v_total + (v_item.quantity * v_item.unit_cost);
    v_item_count := v_item_count + 1;

    INSERT INTO public.inventory_transactions (
      material_id, quantity, type, reference_type, reference_id, notes, created_by
    ) VALUES (
      v_item.material_id, v_item.quantity, 'purchase', 'purchase', p_purchase_id,
      'Purchase received', v_caller_id
    );

    UPDATE public.materials
    SET current_stock = current_stock + v_item.quantity,
        cost_per_unit = v_item.unit_cost,
        updated_at = now()
    WHERE id = v_item.material_id;
  END LOOP;

  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No items in purchase');
  END IF;

  UPDATE public.purchases
  SET status = 'received',
      total_amount = v_total,
      received_at = now(),
      updated_at = now()
  WHERE id = p_purchase_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'purchase_received', 'purchases', p_purchase_id,
    jsonb_build_object(
      'purchase_id', p_purchase_id,
      'supplier_id', v_purchase.supplier_id,
      'items_count', v_item_count,
      'total_amount', v_total
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'items_count', v_item_count,
    'total_amount', v_total
  );
END;
$$;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.receive_existing_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_existing_purchase(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.receive_existing_purchase(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.receive_existing_purchase(uuid) FROM anon;
