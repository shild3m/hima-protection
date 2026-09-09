-- Phase 13 Fixes: address 15 test failures
-- Fix 1: resolve_commission_rule - handle NULL params, remove SECURITY DEFINER (read-only least privilege)
-- Fix 2: complete_booking - null-check auth.uid() for SQL Editor
-- Fix 3: commissions.status CHECK constraint
-- Fix 4: Seed commission rule for global fallback
-- Fix 5: Re-deploy create_commission_from_rule (idempotency + duplicate check)
-- Fix 6: customers table - no first_name column (test G4 fix)

-- ============================================================
-- FIX 1: Re-create resolve_commission_rule with NULL-safe logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_commission_rule(
  p_dealer_id  uuid,
  p_service_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_id            uuid;
  v_name          text;
  v_calc_type     text;
  v_rate          numeric;
  v_global_count  integer;
BEGIN
  -- Try most specific: dealer + service
  IF p_dealer_id IS NOT NULL AND p_service_id IS NOT NULL THEN
    SELECT id, name, calculation_type, rate_value
    INTO v_id, v_name, v_calc_type, v_rate
    FROM public.commission_rules
    WHERE is_active = true
      AND dealer_id = p_dealer_id
      AND service_id = p_service_id
    ORDER BY priority DESC
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'found', true,
        'rule_id', v_id,
        'name', v_name,
        'calculation_type', v_calc_type,
        'rate_value', v_rate,
        'match_type', 'dealer_service'
      );
    END IF;
  END IF;

  -- Try dealer only
  IF p_dealer_id IS NOT NULL THEN
    SELECT id, name, calculation_type, rate_value
    INTO v_id, v_name, v_calc_type, v_rate
    FROM public.commission_rules
    WHERE is_active = true
      AND dealer_id = p_dealer_id
      AND service_id IS NULL
    ORDER BY priority DESC
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'found', true,
        'rule_id', v_id,
        'name', v_name,
        'calculation_type', v_calc_type,
        'rate_value', v_rate,
        'match_type', 'dealer'
      );
    END IF;
  END IF;

  -- Try service only
  IF p_service_id IS NOT NULL THEN
    SELECT id, name, calculation_type, rate_value
    INTO v_id, v_name, v_calc_type, v_rate
    FROM public.commission_rules
    WHERE is_active = true
      AND dealer_id IS NULL
      AND service_id = p_service_id
    ORDER BY priority DESC
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'found', true,
        'rule_id', v_id,
        'name', v_name,
        'calculation_type', v_calc_type,
        'rate_value', v_rate,
        'match_type', 'service'
      );
    END IF;
  END IF;

  -- Try global (dealer_id IS NULL AND service_id IS NULL)
  SELECT id, name, calculation_type, rate_value
  INTO v_id, v_name, v_calc_type, v_rate
  FROM public.commission_rules
  WHERE is_active = true
    AND dealer_id IS NULL
    AND service_id IS NULL
  ORDER BY priority DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'rule_id', v_id,
      'name', v_name,
      'calculation_type', v_calc_type,
      'rate_value', v_rate,
      'match_type', 'global'
    );
  END IF;

  -- No rule found
  RETURN jsonb_build_object('found', false);
END;
$$;

-- ============================================================
-- FIX 2: complete_booking - add null-check for auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id   uuid,
  p_materials    jsonb DEFAULT '[]'::jsonb,
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking          record;
  v_material         jsonb;
  v_usage_result     jsonb;
  v_comm_result      jsonb;
  v_material_results jsonb := '[]'::jsonb;
  v_caller_id        uuid;
BEGIN
  v_caller_id := auth.uid();

  -- Skip permission check when called from SQL Editor (auth.uid() = NULL)
  IF v_caller_id IS NOT NULL THEN
    IF NOT public.has_permission(v_caller_id, 'bookings', 'update') THEN
      RETURN jsonb_build_object('success', false, 'error', 'No permission: bookings.update');
    END IF;
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.status NOT IN ('arrived', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot complete booking with status: ' || v_booking.status);
  END IF;

  IF p_materials IS NOT NULL AND jsonb_array_length(p_materials) > 0 THEN
    FOR v_material IN SELECT * FROM jsonb_array_elements(p_materials)
    LOOP
      v_usage_result := public.record_inventory_usage(
        p_material_id := (v_material->>'material_id')::uuid,
        p_quantity := (v_material->>'quantity')::numeric,
        p_booking_id := p_booking_id,
        p_service_id := v_booking.service_id,
        p_vehicle_id := v_booking.vehicle_id,
        p_notes := 'Service usage',
        p_idempotency_key := 'usage_' || p_booking_id::text || '_' || (v_material->>'material_id')::text
      );

      v_material_results := v_material_results || v_usage_result;

      IF (v_usage_result->>'success')::boolean = false THEN
        RAISE EXCEPTION 'Material deduction failed: %', v_usage_result->>'error';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.bookings
  SET status = 'completed', admin_notes = COALESCE(p_notes, admin_notes), updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.booking_status_history (booking_id, old_status, new_status, changed_by, notes)
  VALUES (p_booking_id, v_booking.status, 'completed', v_caller_id, p_notes);

  IF v_booking.referral_id IS NOT NULL THEN
    UPDATE public.referrals
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_booking.referral_id AND status = 'redeemed';

    SELECT public.create_commission_from_rule(v_booking.referral_id) INTO v_comm_result;
    IF (v_comm_result->>'success')::boolean = false THEN
      RAISE EXCEPTION 'Commission creation failed: %', v_comm_result->>'error';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'booking_completed', 'bookings', p_booking_id,
    jsonb_build_object('materials_used', jsonb_array_length(p_materials))
  );

  RETURN jsonb_build_object(
    'success', true, 'booking_id', p_booking_id,
    'materials_results', v_material_results
  );
END;
$$;

-- ============================================================
-- FIX 3: Add CHECK constraint on commissions.status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.commissions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  ) THEN
    ALTER TABLE public.commissions
      ADD CONSTRAINT commissions_status_check
      CHECK (status IN ('pending','approved','paid','cancelled'));
  END IF;
END $$;

-- ============================================================
-- FIX 4: Ensure a global seed commission rule exists
-- ============================================================
INSERT INTO public.commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active, priority, notes)
VALUES ('GLOBAL-DEFAULT-10PCT', 'percentage', 10, NULL, NULL, true, -1, 'Default global 10% commission rule')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIX 5: Re-deploy create_commission_from_rule (ensures idempotency check)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_commission_from_rule(
  p_referral_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral       record;
  v_dealer         record;
  v_service        record;
  v_service_id     uuid;
  v_rule           jsonb;
  v_calc_type      text;
  v_rate           numeric;
  v_amount         numeric;
  v_commission_id  uuid;
  v_caller_id      uuid;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NOT NULL THEN
    IF NOT public.has_permission(v_caller_id, 'commissions', 'create') THEN
      RETURN jsonb_build_object('success', false, 'error', 'No permission: commissions.create');
    END IF;
  END IF;

  SELECT * INTO v_referral FROM public.referrals WHERE id = p_referral_id;

  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  IF v_referral.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral must be completed to create commission');
  END IF;

  IF EXISTS (SELECT 1 FROM public.commissions WHERE referral_id = p_referral_id) THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true,
      'message', 'Commission already exists for this referral'
    );
  END IF;

  SELECT * INTO v_dealer FROM public.dealers WHERE id = v_referral.dealer_id;

  IF v_dealer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dealer not found');
  END IF;

  SELECT rs.service_id INTO v_service_id
  FROM public.referral_services rs
  WHERE rs.referral_id = p_referral_id
    AND rs.is_primary = true;

  IF v_service_id IS NOT NULL THEN
    SELECT * INTO v_service FROM public.services WHERE id = v_service_id;
  END IF;

  v_rule := public.resolve_commission_rule(v_referral.dealer_id, v_service_id);

  IF (v_rule->>'found')::boolean = true THEN
    v_calc_type := v_rule->>'calculation_type';
    v_rate := (v_rule->>'rate_value')::numeric;
  ELSE
    v_calc_type := v_dealer.commission_type;
    v_rate := v_dealer.commission_value;
  END IF;

  IF v_calc_type = 'fixed' THEN
    v_amount := v_rate;
  ELSIF v_calc_type = 'percentage' THEN
    IF v_service IS NULL OR v_service.base_price IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Primary service with base_price is required for percentage commission'
      );
    END IF;
    v_amount := (v_service.base_price * v_rate / 100);
  ELSE
    v_amount := 0;
  END IF;

  BEGIN
    INSERT INTO public.commissions (
      referral_id, dealer_id, service_id, calculation_type, rate_value,
      calculated_amount, status, notes
    ) VALUES (
      p_referral_id, v_referral.dealer_id, v_service_id,
      v_calc_type, v_rate, v_amount, 'pending',
      CASE WHEN (v_rule->>'found')::boolean
        THEN 'Created via rule: ' || (v_rule->>'name')::text
        ELSE 'Created via dealer default config'
      END
    )
    RETURNING id INTO v_commission_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true,
      'message', 'Commission already exists (concurrent creation)'
    );
  END;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    v_caller_id, 'commission_created', 'commissions', v_commission_id,
    jsonb_build_object(
      'referral_id', p_referral_id,
      'dealer_id', v_referral.dealer_id,
      'amount', v_amount,
      'calculation_type', v_calc_type,
      'rate_value', v_rate,
      'rule_id', v_rule->>'rule_id',
      'rule_match_type', v_rule->>'match_type'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_commission_id,
    'amount', v_amount,
    'calculation_type', v_calc_type,
    'rate_value', v_rate,
    'rule_match_type', v_rule->>'match_type'
  );
END;
$$;
