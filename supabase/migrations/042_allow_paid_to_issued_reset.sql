-- Allow paid→issued and partially_paid→issued for booking payment reset flow
-- When a booking goes back from completed to in_progress, the existing invoice
-- needs to be reset to "issued" before recording a new payment.

CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_transitions jsonb := '{
    "draft": ["issued", "partially_paid", "paid", "cancelled"],
    "issued": ["partially_paid", "paid", "cancelled"],
    "partially_paid": ["paid", "issued", "refunded"],
    "paid": ["issued", "refunded"],
    "cancelled": [],
    "refunded": []
  }'::jsonb;
  v_valid_statuses text[] := ARRAY['draft','issued','partially_paid','paid','cancelled','refunded'];
  v_new_status text := NEW.status;
  v_old_status text := OLD.status;
BEGIN
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF NOT (v_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid invoice status: %', v_new_status;
  END IF;

  IF NOT (v_new_status IN (SELECT jsonb_array_elements_text(v_allowed_transitions -> v_old_status))) THEN
    RAISE EXCEPTION 'Invoice status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  RETURN NEW;
END;
$$;
