-- ============================================================
-- PHASE: Booking Status Simplify
-- Reduce the booking state machine to:
--   new → contacted → in_progress → completed
--   cancelled reachable from new/contacted/in_progress
-- Removed: confirmed, arrived, no_show
-- Plus: super_admin may undo a cancellation (cancelled → non-terminal).
-- Mirrors src/app/actions/bookings.ts VALID_TRANSITIONS + revert rule.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_booking_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_transitions jsonb := '{
    "new": ["contacted", "cancelled"],
    "contacted": ["in_progress", "cancelled"],
    "in_progress": ["completed"],
    "completed": [],
    "cancelled": []
  }'::jsonb;
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

  -- Super-admin undo: a cancelled booking may be returned to any non-terminal state.
  IF v_old_status = 'cancelled' AND v_is_super_admin
     AND v_new_status IN ('new', 'contacted', 'in_progress') THEN
    RETURN NEW;
  END IF;

  IF NOT (v_new_status IN (SELECT jsonb_array_elements_text(v_allowed_transitions -> v_old_status))) THEN
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