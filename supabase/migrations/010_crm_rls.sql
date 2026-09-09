-- Phase 10: CRM + Vehicles
-- Add RLS policies for customer_notes and booking_status_history

-- ============================================================
-- CUSTOMER NOTES RLS
-- ============================================================
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_customer_notes"
  ON public.customer_notes FOR SELECT
  USING (public.has_permission(auth.uid(), 'customers', 'read'));

CREATE POLICY "staff_insert_customer_notes"
  ON public.customer_notes FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'customers', 'create')
    AND auth.uid() = created_by
  );

CREATE POLICY "staff_update_customer_notes"
  ON public.customer_notes FOR UPDATE
  USING (public.has_permission(auth.uid(), 'customers', 'update'));

CREATE POLICY "staff_delete_customer_notes"
  ON public.customer_notes FOR DELETE
  USING (public.has_permission(auth.uid(), 'customers', 'delete'));

-- ============================================================
-- BOOKING STATUS HISTORY RLS
-- ============================================================
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_booking_status_history"
  ON public.booking_status_history FOR SELECT
  USING (public.has_permission(auth.uid(), 'bookings', 'read'));

CREATE POLICY "staff_insert_booking_status_history"
  ON public.booking_status_history FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'bookings', 'update'));

-- ============================================================
-- BOOKING ITEMS RLS
-- ============================================================
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_booking_items"
  ON public.booking_items FOR SELECT
  USING (public.has_permission(auth.uid(), 'bookings', 'read'));

CREATE POLICY "staff_insert_booking_items"
  ON public.booking_items FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'bookings', 'create'));

CREATE POLICY "staff_update_booking_items"
  ON public.booking_items FOR UPDATE
  USING (public.has_permission(auth.uid(), 'bookings', 'update'));

CREATE POLICY "staff_delete_booking_items"
  ON public.booking_items FOR DELETE
  USING (public.has_permission(auth.uid(), 'bookings', 'update'));
