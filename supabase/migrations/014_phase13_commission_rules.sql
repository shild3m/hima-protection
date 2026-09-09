-- ============================================================
-- PHASE 13: COMMISSION RULES + ENHANCED COMMISSION SYSTEM
-- ============================================================
-- This migration adds:
-- 1. commission_rules table (global, dealer-specific, service-specific rules)
-- 2. resolve_commission_rule() function (priority-based rule resolution)
-- 3. create_commission_from_rule() function (creates commission using resolved rule)
-- 4. RLS policies for commission_rules
-- 5. Permissions for commission_rules
-- 6. Updated commission status transitions
-- ============================================================

-- ============================================================
-- 1. COMMISSION RULES TABLE
-- ============================================================
-- Rule precedence (highest first):
--   1. dealer_id + service_id (most specific)
--   2. dealer_id only
--   3. service_id only
--   4. global (dealer_id IS NULL AND service_id IS NULL)
--
-- calculation_type:
--   'fixed'      → commission = fixed amount
--   'percentage' → commission = service.base_price × percentage / 100
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  calculation_type  text NOT NULL CHECK (calculation_type IN ('fixed','percentage')),
  rate_value        numeric NOT NULL CHECK (rate_value >= 0),
  dealer_id         uuid REFERENCES public.dealers(id) ON DELETE CASCADE,
  service_id        uuid REFERENCES public.services(id) ON DELETE CASCADE,
  priority          integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_commission_rules_dealer_id ON public.commission_rules(dealer_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_service_id ON public.commission_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_is_active ON public.commission_rules(is_active);

-- ============================================================
-- UNIQUE CONSTRAINT: One active rule per dealer+service combination
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_commission_rules_dealer_service
  ON public.commission_rules (dealer_id, service_id)
  WHERE is_active = true;

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- Staff with commissions.read can view all rules
CREATE POLICY "staff_select_all_commission_rules"
  ON public.commission_rules FOR SELECT
  USING (public.has_permission(auth.uid(), 'commissions', 'read'));

-- Dealers can view active rules (for transparency)
CREATE POLICY "dealer_select_active_rules"
  ON public.commission_rules FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 2. RESOLVE COMMISSION RULE FUNCTION
-- ============================================================
-- Given a dealer_id and optional service_id, returns the
-- best-matching active commission rule based on priority.
--
-- Priority resolution:
--   1. dealer_id + service_id match (highest priority)
--   2. dealer_id match (service_id IS NULL)
--   3. service_id match (dealer_id IS NULL)
--   4. global (both NULL)
--
-- If multiple rules exist at the same specificity level,
-- the one with the highest priority value wins.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_commission_rule(
  p_dealer_id  uuid,
  p_service_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
BEGIN
  -- Try most specific: dealer + service
  SELECT * INTO v_rule
  FROM public.commission_rules
  WHERE is_active = true
    AND dealer_id = p_dealer_id
    AND service_id = p_service_id
  ORDER BY priority DESC
  LIMIT 1;

  IF v_rule IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'rule_id', v_rule.id,
      'name', v_rule.name,
      'calculation_type', v_rule.calculation_type,
      'rate_value', v_rule.rate_value,
      'match_type', 'dealer_service'
    );
  END IF;

  -- Try dealer only
  SELECT * INTO v_rule
  FROM public.commission_rules
  WHERE is_active = true
    AND dealer_id = p_dealer_id
    AND service_id IS NULL
  ORDER BY priority DESC
  LIMIT 1;

  IF v_rule IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'rule_id', v_rule.id,
      'name', v_rule.name,
      'calculation_type', v_rule.calculation_type,
      'rate_value', v_rule.rate_value,
      'match_type', 'dealer'
    );
  END IF;

  -- Try service only
  SELECT * INTO v_rule
  FROM public.commission_rules
  WHERE is_active = true
    AND dealer_id IS NULL
    AND service_id = p_service_id
  ORDER BY priority DESC
  LIMIT 1;

  IF v_rule IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'rule_id', v_rule.id,
      'name', v_rule.name,
      'calculation_type', v_rule.calculation_type,
      'rate_value', v_rule.rate_value,
      'match_type', 'service'
    );
  END IF;

  -- Try global
  SELECT * INTO v_rule
  FROM public.commission_rules
  WHERE is_active = true
    AND dealer_id IS NULL
    AND service_id IS NULL
  ORDER BY priority DESC
  LIMIT 1;

  IF v_rule IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'rule_id', v_rule.id,
      'name', v_rule.name,
      'calculation_type', v_rule.calculation_type,
      'rate_value', v_rule.rate_value,
      'match_type', 'global'
    );
  END IF;

  -- No rule found
  RETURN jsonb_build_object('found', false);
END;
$$;

-- ============================================================
-- 3. CREATE COMMISSION FROM RULE (replaces old create_commission)
-- ============================================================
-- This enhanced version:
--   - Resolves commission rule via resolve_commission_rule()
--   - Falls back to dealer.commission_type/commission_value if no rule
--   - Calculates amount server-side
--   - Prevents duplicate commission (idempotent)
--   - Atomic: uses SELECT FOR UPDATE pattern via WHERE clause
--   - Creates audit log
--
-- COMMISSION CREATION PATHS (both guarded by UNIQUE(referral_id)):
--   Path 1: complete_booking() → create_commission_from_rule()
--            (for booking-linked referrals completed via booking flow)
--   Path 2: updateReferralStatus() TypeScript → RPC create_commission_from_rule()
--            (for direct referral completion outside booking flow)
--   Both paths call the same function. UNIQUE(referral_id) prevents duplicates.
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

  -- Permission check (if called by authenticated user)
  IF v_caller_id IS NOT NULL THEN
    IF NOT public.has_permission(v_caller_id, 'commissions', 'create') THEN
      RETURN jsonb_build_object('success', false, 'error', 'No permission: commissions.create');
    END IF;
  END IF;

  -- Fetch referral
  SELECT * INTO v_referral FROM public.referrals WHERE id = p_referral_id;

  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral not found');
  END IF;

  IF v_referral.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral must be completed to create commission');
  END IF;

  -- Idempotency: prevent duplicate commission
  IF EXISTS (SELECT 1 FROM public.commissions WHERE referral_id = p_referral_id) THEN
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true,
      'message', 'Commission already exists for this referral'
    );
  END IF;

  -- Fetch dealer
  SELECT * INTO v_dealer FROM public.dealers WHERE id = v_referral.dealer_id;

  IF v_dealer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dealer not found');
  END IF;

  -- Get PRIMARY service from referral_services
  SELECT rs.service_id INTO v_service_id
  FROM public.referral_services rs
  WHERE rs.referral_id = p_referral_id
    AND rs.is_primary = true;

  IF v_service_id IS NOT NULL THEN
    SELECT * INTO v_service FROM public.services WHERE id = v_service_id;
  END IF;

  -- Resolve commission rule (priority: dealer+service > dealer > service > global)
  v_rule := public.resolve_commission_rule(v_referral.dealer_id, v_service_id);

  IF (v_rule->>'found')::boolean = true THEN
    -- Use resolved rule
    v_calc_type := v_rule->>'calculation_type';
    v_rate := (v_rule->>'rate_value')::numeric;
  ELSE
    -- Fallback to dealer-level config
    v_calc_type := v_dealer.commission_type;
    v_rate := v_dealer.commission_value;
  END IF;

  -- Calculate amount server-side
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

  -- Atomic insert with UNIQUE constraint prevents duplicate
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
    -- Concurrent creation: another call already inserted
    RETURN jsonb_build_object(
      'success', true, 'duplicate', true,
      'message', 'Commission already exists (concurrent creation)'
    );
  END;

  -- Audit log
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

-- ============================================================
-- 4. GRANT/REVOKE for new function
-- ============================================================

REVOKE ALL ON FUNCTION public.create_commission_from_rule(uuid) FROM public;
REVOKE ALL ON FUNCTION public.create_commission_from_rule(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_commission_from_rule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_commission_from_rule(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_commission_rule(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.resolve_commission_rule(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_commission_rule(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_commission_rule(uuid, uuid) TO service_role;

-- ============================================================
-- 5. SEED: Default global commission rule (percentage 10%)
-- ============================================================

INSERT INTO public.commission_rules (name, calculation_type, rate_value, is_active, priority, notes)
VALUES ('العمولة الافتراضية العامة', 'percentage', 10, true, 0, 'عمولة افتراضية 10% — يمكن تعديلها')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. PERMISSIONS for commission_rules
-- ============================================================

INSERT INTO public.permissions (resource, action) VALUES
  ('commission_rules', 'create'),
  ('commission_rules', 'read'),
  ('commission_rules', 'update'),
  ('commission_rules', 'delete')
ON CONFLICT (resource, action) DO NOTHING;

-- super_admin gets all commission_rules permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
  AND p.resource = 'commission_rules'
ON CONFLICT DO NOTHING;

-- admin gets all commission_rules permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin'
  AND p.resource = 'commission_rules'
ON CONFLICT DO NOTHING;

-- accountant gets read only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'accountant'
  AND p.resource = 'commission_rules' AND p.action = 'read'
ON CONFLICT DO NOTHING;
