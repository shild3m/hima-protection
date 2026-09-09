-- ============================================================
-- PHASE 06: Inventory Module — Database Migration
-- ============================================================
-- Purpose: Add missing RLS SELECT policies + stock adjustment RPC
-- Affected tables: purchase_items (RLS only), service_materials (RLS only)
-- New function: record_stock_adjustment
-- ============================================================

-- 1. purchase_items: allow staff with purchases:read to view items
CREATE POLICY staff_select_purchase_items ON purchase_items
  FOR SELECT USING (
    has_permission(auth.uid(), 'purchases', 'read')
  );

-- 2. service_materials: allow staff with materials:read to view mappings
CREATE POLICY staff_select_service_materials ON service_materials
  FOR SELECT USING (
    has_permission(auth.uid(), 'materials', 'read')
  );

-- 3. Stock adjustment RPC (atomic direction-aware adjustment)
CREATE OR REPLACE FUNCTION record_stock_adjustment(
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
AS $function$
DECLARE
  v_caller_id    uuid;
  v_material     record;
  v_adjusted_qty numeric;
  v_rows_updated integer;
  v_txn_id       uuid;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization
  IF NOT has_permission(v_caller_id, 'inventory', 'adjust') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: inventory.adjust');
  END IF;

  -- Input validation
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be > 0');
  END IF;

  IF p_direction IS NULL OR p_direction NOT IN ('in', 'out') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Direction must be in or out');
  END IF;

  IF p_material_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Material ID is required');
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn_id
    FROM inventory_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_txn_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true, 'transaction_id', v_txn_id,
        'duplicate', true, 'message', 'Transaction already recorded'
      );
    END IF;
  END IF;

  -- Calculate adjusted quantity
  IF p_direction = 'in' THEN
    v_adjusted_qty := p_quantity;
  ELSE
    v_adjusted_qty := -p_quantity;
  END IF;

  -- Atomic stock update with negative stock prevention
  UPDATE materials
  SET current_stock = current_stock + v_adjusted_qty
  WHERE id = p_material_id
    AND is_active = true
    AND (p_direction = 'in' OR current_stock >= p_quantity);

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    SELECT current_stock, name INTO v_material
    FROM materials WHERE id = p_material_id;

    IF v_material IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Material not found');
    END IF;

    IF p_direction = 'out' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient stock. Available: ' || v_material.current_stock || ' of ' || v_material.name
      );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Material is inactive or not found');
  END IF;

  -- Insert inventory transaction
  INSERT INTO inventory_transactions (
    material_id, quantity, type, notes, idempotency_key, created_by
  ) VALUES (
    p_material_id, v_adjusted_qty, 'adjustment', p_notes, p_idempotency_key, v_caller_id
  )
  RETURNING id INTO v_txn_id;

  -- Read updated material state
  SELECT current_stock, min_stock, name INTO v_material
  FROM materials WHERE id = p_material_id;

  -- Audit logging
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'stock_adjustment', 'materials', p_material_id,
    jsonb_build_object(
      'quantity', p_quantity,
      'direction', p_direction,
      'remaining_stock', v_material.current_stock,
      'notes', p_notes
    )
  );

  -- Low-stock notification (permission-based, no hard-coded roles)
  IF v_material.current_stock <= v_material.min_stock THEN
    INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
    SELECT DISTINCT s.user_id, 'low_stock', 'تنبيه: مخزون منخفض',
      'المادة ' || v_material.name || ' مخزونها ' || v_material.current_stock || ' ( عند الحد الأدنى)',
      'materials', p_material_id
    FROM staff s
    WHERE s.is_active = true
      AND EXISTS (
        SELECT 1
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = s.role_id
          AND p.resource = 'inventory' AND p.action = 'read'
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'material_id', p_material_id,
    'quantity_adjusted', p_quantity,
    'direction', p_direction,
    'remaining_stock', v_material.current_stock
  );
END;
$function$;

-- 4. GRANT/REVOKE
REVOKE ALL ON FUNCTION record_stock_adjustment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_stock_adjustment TO authenticated;
GRANT EXECUTE ON FUNCTION record_stock_adjustment TO service_role;
REVOKE EXECUTE ON FUNCTION record_stock_adjustment FROM anon;
