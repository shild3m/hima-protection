-- ============================================================
-- PHASE: Super-Admin Full Status Bypass
-- Allow super_admin to change booking status from any
-- non-completed status to any valid status (not just
-- the old transition rules).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_statuses text[] := ARRAY['new','contacted','in_progress','completed','cancelled'];
  v_new_status text := NEW.status;
  v_old_status text := OLD.status;
  v_is_super_admin boolean := EXISTS (
    SELECT 1 FROM public.staff
    WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
BEGIN
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF NOT (v_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid booking status: %', v_new_status;
  END IF;

  -- Super-admin bypass: can change from any non-completed status to any valid status.
  IF v_old_status != 'completed' AND v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- Normal transition check
  IF v_old_status = 'new' AND v_new_status NOT IN ('contacted', 'cancelled') THEN
    RAISE EXCEPTION 'Booking status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  IF v_old_status = 'contacted' AND v_new_status NOT IN ('in_progress', 'cancelled') THEN
    RAISE EXCEPTION 'Booking status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  IF v_old_status = 'in_progress' AND v_new_status != 'completed' THEN
    RAISE EXCEPTION 'Booking status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  IF v_old_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Booking status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_status ON public.bookings;
CREATE TRIGGER enforce_booking_status
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_status_transition();
