-- ============================================================
-- PHASE 16: PURCHASE ITEMS INSERT POLICY
-- Migration 024: Allow authorized users to INSERT purchase_items
--
-- Purpose: Enable createPurchase to store items at creation time.
-- Previously purchase_items were only inserted via the
-- receive_purchase() SECURITY DEFINER function.
--
-- SAFETY: Additive RLS policy only. No table structure changes.
-- ============================================================

CREATE POLICY staff_insert_purchase_items ON public.purchase_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'purchases', 'create'));

CREATE POLICY staff_delete_purchase_items ON public.purchase_items
  FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'purchases', 'update'));
