-- Allow a material to be permanently deleted while keeping purchase history.
-- The purchase line keeps a snapshot of the material name after its FK is cleared.

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS material_name text;

UPDATE public.purchase_items pi
SET material_name = m.name
FROM public.materials m
WHERE pi.material_id = m.id
  AND pi.material_name IS NULL;

ALTER TABLE public.purchase_items
  ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE public.purchase_items
  DROP CONSTRAINT IF EXISTS purchase_items_material_id_fkey;

ALTER TABLE public.purchase_items
  ADD CONSTRAINT purchase_items_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_material_preserve_purchases(p_material_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_name text;
  v_purchase_items integer;
  v_inventory_transactions integer;
BEGIN
  SELECT name
  INTO v_material_name
  FROM public.materials
  WHERE id = p_material_id;

  IF v_material_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المادة غير موجودة');
  END IF;

  UPDATE public.purchase_items
  SET material_name = COALESCE(material_name, v_material_name),
      material_id = NULL
  WHERE material_id = p_material_id;
  GET DIAGNOSTICS v_purchase_items = ROW_COUNT;

  DELETE FROM public.inventory_transactions
  WHERE material_id = p_material_id;
  GET DIAGNOSTICS v_inventory_transactions = ROW_COUNT;

  DELETE FROM public.materials
  WHERE id = p_material_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_items', v_purchase_items,
    'inventory_transactions', v_inventory_transactions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_material_preserve_purchases(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_material_preserve_purchases(uuid) TO service_role;
