-- Allow draft→partially_paid and draft→paid transitions
-- When a booking auto-creates an invoice and records payment in one step,
-- the invoice goes from draft directly to partially_paid or paid.

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
    "partially_paid": ["paid", "refunded"],
    "paid": ["refunded"],
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
