-- ============================================================
-- PHASE 24: Booking Status State Machine Trigger
-- ============================================================
-- Mirrors the application-level VALID_TRANSITIONS from
-- src/app/actions/bookings.ts at the database level.
--
-- Valid transitions:
--   new         → contacted, cancelled
--   contacted   → confirmed, cancelled
--   confirmed   → arrived, cancelled, no_show
--   arrived     → in_progress, cancelled
--   in_progress → completed
--   completed   → (terminal)
--   cancelled   → (terminal)
--   no_show     → (terminal)
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
    "contacted": ["confirmed", "cancelled"],
    "confirmed": ["arrived", "cancelled", "no_show"],
    "arrived": ["in_progress", "cancelled"],
    "in_progress": ["completed"],
    "completed": [],
    "cancelled": [],
    "no_show": []
  }'::jsonb;
  v_valid_statuses text[] := ARRAY['new','contacted','confirmed','arrived','in_progress','completed','cancelled','no_show'];
  v_new_status text := NEW.status;
  v_old_status text := OLD.status;
BEGIN
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF NOT (v_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid booking status: %', v_new_status;
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
