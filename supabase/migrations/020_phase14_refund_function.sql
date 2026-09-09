-- ============================================================
-- PHASE 14: Invoice Refund Function
-- Purpose: Refund a paid or partially_paid invoice
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_invoice(
  p_invoice_id  uuid,
  p_reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid;
  v_invoice    record;
  v_refund_amount numeric;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.has_permission(v_caller_id, 'invoices', 'update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No permission: invoices.update');
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status NOT IN ('paid', 'partially_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refund invoice with status: ' || v_invoice.status);
  END IF;

  v_refund_amount := v_invoice.paid_amount;

  UPDATE public.invoices
  SET status = 'refunded',
      notes = COALESCE(p_reason, notes),
      updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'invoice_refunded', 'invoices', p_invoice_id,
    jsonb_build_object(
      'refund_amount', v_refund_amount,
      'reason', p_reason,
      'previous_status', v_invoice.status,
      'previous_paid_amount', v_invoice.paid_amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'refund_amount', v_refund_amount,
    'new_status', 'refunded'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_invoice(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.refund_invoice(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_invoice(uuid, text) TO authenticated, service_role;
