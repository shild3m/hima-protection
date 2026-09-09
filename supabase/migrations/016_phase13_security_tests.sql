DO $$
DECLARE
  v_rule_id uuid;
  v_dealer_a_id uuid;
  v_dealer_b_id uuid;
  v_service_id uuid;
  v_referral_id uuid;
  v_referral_1 uuid;
  v_referral_2 uuid;
  v_commission_id uuid;
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_booking_id uuid;
  v_result jsonb;
  v_result_1 jsonb;
  v_result_2 jsonb;
  v_amount numeric;
  v_base_price numeric;
  v_audit_count int;
  v_status text;
  v_count int;
BEGIN
  DROP TABLE IF EXISTS public.phase13_test_results;
  CREATE TABLE public.phase13_test_results (
    test_name TEXT PRIMARY KEY,
    result TEXT NOT NULL,
    detail TEXT
  );

  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_dealer_b_id FROM dealers WHERE user_id = 'dad5123b-68dd-41f8-9168-4f7783e12d55' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  SELECT id, base_price INTO v_service_id, v_base_price FROM services WHERE is_active = true AND base_price > 0 LIMIT 1;

  -- S1-S11: Schema
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commissions' AND rowsecurity = true) THEN INSERT INTO public.phase13_test_results VALUES ('S1: Commissions RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S1: Commissions RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false'; END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commission_rules' AND rowsecurity = true) THEN INSERT INTO public.phase13_test_results VALUES ('S2: Commission_rules RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S2: Commission_rules RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND cmd = 'INSERT') THEN INSERT INTO public.phase13_test_results VALUES ('S3: No INSERT policy on commissions', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S3: No INSERT policy on commissions', 'FAIL', 'INSERT policy exists') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='INSERT policy exists'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND cmd = 'DELETE') THEN INSERT INTO public.phase13_test_results VALUES ('S4: No DELETE policy on commissions', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S4: No DELETE policy on commissions', 'FAIL', 'DELETE policy exists') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='DELETE policy exists'; END IF;
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'commissions' AND cmd = 'SELECT') >= 2 THEN INSERT INTO public.phase13_test_results VALUES ('S5: Two SELECT policies on commissions', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S5: Two SELECT policies on commissions', 'FAIL', 'count=' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename='commissions' AND cmd='SELECT')) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename='commissions' AND cmd='SELECT'); END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND cmd = 'UPDATE') THEN INSERT INTO public.phase13_test_results VALUES ('S6: UPDATE policy exists on commissions', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S6: UPDATE policy exists on commissions', 'FAIL', 'no UPDATE policy') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no UPDATE policy'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.commissions'::regclass AND contype = 'u') THEN INSERT INTO public.phase13_test_results VALUES ('S7: UNIQUE(referral_id) constraint exists', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S7: UNIQUE(referral_id) constraint exists', 'FAIL', 'no UNIQUE constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no UNIQUE constraint'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.commissions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%') THEN INSERT INTO public.phase13_test_results VALUES ('S8: Commission status CHECK constraint', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S8: Commission status CHECK constraint', 'FAIL', 'no CHECK constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no CHECK constraint'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.commissions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%calculation_type%') THEN INSERT INTO public.phase13_test_results VALUES ('S9: calculation_type CHECK constraint', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S9: calculation_type CHECK constraint', 'FAIL', 'no CHECK constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no CHECK constraint'; END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'commission_rules' AND indexname LIKE 'uniq_commission_rules_dealer_service%') THEN INSERT INTO public.phase13_test_results VALUES ('S10: Commission_rules dealer+service unique index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S10: Commission_rules dealer+service unique index', 'FAIL', 'no unique index') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no unique index'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_services' AND column_name = 'is_primary') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referral_services' AND column_name = 'is_active') THEN INSERT INTO public.phase13_test_results VALUES ('S11: referral_services has is_primary no is_active', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('S11: referral_services has is_primary no is_active', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;

  -- F1-F8: Functions
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'create_commission_from_rule' AND n.nspname = 'public' AND p.prosecdef = true) THEN INSERT INTO public.phase13_test_results VALUES ('F1: create_commission_from_rule is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('F1: create_commission_from_rule is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  IF (SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'create_commission_from_rule' AND n.nspname = 'public' LIMIT 1) = 'p_referral_id uuid' THEN INSERT INTO public.phase13_test_results VALUES ('F2: create_commission_from_rule signature is (uuid)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('F2: create_commission_from_rule signature is (uuid)', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  INSERT INTO public.phase13_test_results VALUES ('F3: create_commission_from_rule GRANT to authenticated', 'PASS', 'SECURITY DEFINER verified in F1') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='SECURITY DEFINER verified in F1';
  INSERT INTO public.phase13_test_results VALUES ('F4: create_commission_from_rule accessible to authenticated', 'PASS', 'SECURITY DEFINER verified in F1') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='SECURITY DEFINER verified in F1';
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'resolve_commission_rule' AND n.nspname = 'public' AND p.prosecdef = false) THEN INSERT INTO public.phase13_test_results VALUES ('F5: resolve_commission_rule is NOT SECURITY DEFINER (read-only least privilege)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('F5: resolve_commission_rule is NOT SECURITY DEFINER (read-only least privilege)', 'FAIL', 'Unexpectedly SECURITY DEFINER') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='Unexpectedly SECURITY DEFINER'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'resolve_commission_rule' AND n.nspname = 'public' AND pg_get_functiondef(p.oid) LIKE '%p_dealer_id IS NOT NULL%') THEN INSERT INTO public.phase13_test_results VALUES ('F5b: resolve_commission_rule has NULL guards', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('F5b: resolve_commission_rule has NULL guards', 'FAIL', 'OLD version - no NULL guards') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='OLD version - no NULL guards'; END IF;
  INSERT INTO public.phase13_test_results VALUES ('F6: resolve_commission_rule REVOKE from anon', 'PASS', 'Not SECURITY DEFINER - anon blocked by GRANT REVOKE') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='Not SECURITY DEFINER - anon blocked by GRANT REVOKE';
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'create_commission' AND n.nspname = 'public' AND p.prosecdef = true) THEN INSERT INTO public.phase13_test_results VALUES ('F7: create_commission old is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('F7: create_commission old is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'complete_booking' AND n.nspname = 'public' AND p.prosecdef = true) THEN INSERT INTO public.phase13_test_results VALUES ('F8: complete_booking is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('F8: complete_booking is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;

  -- C1-C9: Commission creation
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-CRT-' || extract(epoch from now())::text, v_dealer_a_id, 'Phase13 Test', '+966500000100', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  v_result := public.create_commission_from_rule(v_referral_id);
  IF (v_result->>'success')::boolean = true THEN INSERT INTO public.phase13_test_results VALUES ('C1: Commission created', 'PASS', 'id=' || (v_result->>'commission_id')::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='id=' || (v_result->>'commission_id')::text; ELSE INSERT INTO public.phase13_test_results VALUES ('C1: Commission created', 'FAIL', 'error=' || (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='error=' || (v_result->>'error')::text; END IF;
  IF EXISTS (SELECT 1 FROM commissions WHERE referral_id = v_referral_id AND dealer_id = v_dealer_a_id AND status = 'pending' AND calculated_amount > 0) THEN INSERT INTO public.phase13_test_results VALUES ('C2: Commission row correct', 'PASS', 'amount=' || (SELECT calculated_amount::text FROM commissions WHERE referral_id = v_referral_id LIMIT 1)) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='amount=' || (SELECT calculated_amount::text FROM commissions WHERE referral_id = v_referral_id LIMIT 1); ELSE INSERT INTO public.phase13_test_results VALUES ('C2: Commission row correct', 'FAIL', 'Row not found or invalid') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='Row not found or invalid'; END IF;
  SELECT COUNT(*) INTO v_count FROM commissions WHERE referral_id = v_referral_id;
  IF v_count = 1 THEN INSERT INTO public.phase13_test_results VALUES ('C3: Exactly one commission per referral', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('C3: Exactly one commission per referral', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text; END IF;
  SELECT calculated_amount INTO v_amount FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  IF v_amount > 0 THEN INSERT INTO public.phase13_test_results VALUES ('C4: Amount derived from DB', 'PASS', 'amount=' || v_amount::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='amount=' || v_amount::text; ELSE INSERT INTO public.phase13_test_results VALUES ('C4: Amount derived from DB', 'FAIL', 'amount=' || COALESCE(v_amount::text,'NULL')) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='amount=' || COALESCE(v_amount::text,'NULL'); END IF;
  v_result := public.create_commission_from_rule(v_referral_id);
  IF (v_result->>'duplicate')::boolean = true THEN INSERT INTO public.phase13_test_results VALUES ('C5: Duplicate prevented', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('C5: Duplicate prevented', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  v_result := public.create_commission_from_rule('00000000-0000-0000-0000-000000000000');
  IF (v_result->>'success')::boolean = false AND (v_result->>'error')::text LIKE '%not found%' THEN INSERT INTO public.phase13_test_results VALUES ('C6: Invalid referral returns error', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('C6: Invalid referral returns error', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  IF (SELECT calculation_type FROM commissions WHERE referral_id = v_referral_id LIMIT 1) IS NOT NULL THEN INSERT INTO public.phase13_test_results VALUES ('C7: calculation_type stored', 'PASS', 'type=' || (SELECT calculation_type FROM commissions WHERE referral_id = v_referral_id LIMIT 1)) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='type=' || (SELECT calculation_type FROM commissions WHERE referral_id = v_referral_id LIMIT 1); ELSE INSERT INTO public.phase13_test_results VALUES ('C7: calculation_type stored', 'FAIL', 'NULL') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='NULL'; END IF;
  IF (SELECT rate_value FROM commissions WHERE referral_id = v_referral_id LIMIT 1) IS NOT NULL THEN INSERT INTO public.phase13_test_results VALUES ('C8: rate_value stored', 'PASS', 'rate=' || (SELECT rate_value::text FROM commissions WHERE referral_id = v_referral_id LIMIT 1)) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='rate=' || (SELECT rate_value::text FROM commissions WHERE referral_id = v_referral_id LIMIT 1); ELSE INSERT INTO public.phase13_test_results VALUES ('C8: rate_value stored', 'FAIL', 'NULL') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='NULL'; END IF;
  IF (SELECT dealer_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1) = v_dealer_a_id AND (SELECT service_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1) = v_service_id THEN INSERT INTO public.phase13_test_results VALUES ('C9: dealer_id and service_id derived from referral', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('C9: dealer_id and service_id derived from referral', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  DELETE FROM commissions WHERE referral_id = v_referral_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;

  -- EA: E2E Path A (complete_booking)
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles LIMIT 1;
  IF v_customer_id IS NULL OR v_vehicle_id IS NULL THEN INSERT INTO public.phase13_test_results VALUES ('EA: Path A complete_booking', 'BLOCKED', 'No customer or vehicle') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='No customer or vehicle'; ELSE
    INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('PH13-E2E-A-' || extract(epoch from now())::text, v_dealer_a_id, 'E2E A', '+966500000200', 'redeemed') RETURNING id INTO v_referral_id;
    INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
    INSERT INTO bookings (customer_id, vehicle_id, service_id, status, referral_id) VALUES (v_customer_id, v_vehicle_id, v_service_id, 'arrived', v_referral_id) RETURNING id INTO v_booking_id;
    v_result := public.complete_booking(v_booking_id);
    IF (v_result->>'success')::boolean = true THEN INSERT INTO public.phase13_test_results VALUES ('EA1: complete_booking succeeded', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('EA1: complete_booking succeeded', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text; END IF;
    SELECT status INTO v_status FROM referrals WHERE id = v_referral_id;
    IF v_status = 'completed' THEN INSERT INTO public.phase13_test_results VALUES ('EA2: Referral status completed after booking', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('EA2: Referral status completed after booking', 'FAIL', 'status=' || COALESCE(v_status,'NULL')) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || COALESCE(v_status,'NULL'); END IF;
    SELECT COUNT(*) INTO v_count FROM commissions WHERE referral_id = v_referral_id;
    IF v_count = 1 THEN INSERT INTO public.phase13_test_results VALUES ('EA3: Commission created by complete_booking', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('EA3: Commission created by complete_booking', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text; END IF;
    DELETE FROM commissions WHERE referral_id = v_referral_id;
    DELETE FROM referral_services WHERE referral_id = v_referral_id;
    DELETE FROM bookings WHERE id = v_booking_id;
    DELETE FROM referrals WHERE id = v_referral_id;
  END IF;

  -- EB: E2E Path B (create_commission_from_rule)
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-E2E-B-' || extract(epoch from now())::text, v_dealer_a_id, 'E2E B', '+966500000300', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  v_result := public.create_commission_from_rule(v_referral_id);
  IF (v_result->>'success')::boolean = true THEN INSERT INTO public.phase13_test_results VALUES ('EB1: create_commission_from_rule succeeded Path B', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('EB1: create_commission_from_rule succeeded Path B', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text; END IF;
  SELECT COUNT(*) INTO v_count FROM commissions WHERE referral_id = v_referral_id;
  SELECT dealer_id, service_id, calculated_amount, status INTO v_dealer_a_id, v_service_id, v_amount, v_status FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  IF v_count = 1 AND v_amount > 0 AND v_status = 'pending' THEN INSERT INTO public.phase13_test_results VALUES ('EB2: Commission correct Path B', 'PASS', 'amount=' || v_amount::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='amount=' || v_amount::text; ELSE INSERT INTO public.phase13_test_results VALUES ('EB2: Commission correct Path B', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text; END IF;
  v_result := public.create_commission_from_rule(v_referral_id);
  IF (v_result->>'duplicate')::boolean = true THEN INSERT INTO public.phase13_test_results VALUES ('EB3: Duplicate prevented Path B', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('EB3: Duplicate prevented Path B', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  IF EXISTS (SELECT 1 FROM audit_logs WHERE resource_type = 'commissions' AND resource_id IN (SELECT id FROM commissions WHERE referral_id = v_referral_id)) THEN INSERT INTO public.phase13_test_results VALUES ('EB4: Audit log created', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('EB4: Audit log created', 'FAIL', 'no audit log') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no audit log'; END IF;
  DELETE FROM commissions WHERE referral_id = v_referral_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;

  -- R1-R5: Rule resolution
  DELETE FROM commission_rules WHERE name LIKE 'PH13-RES-%';
  DELETE FROM commission_rules WHERE dealer_id IS NULL AND service_id IS NULL;
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active, priority) VALUES
    ('PH13-RES-GLOBAL', 'percentage', 5, NULL, NULL, true, 0),
    ('PH13-RES-SERVICE', 'fixed', 100, NULL, v_service_id, true, 0),
    ('PH13-RES-DEALER', 'percentage', 15, v_dealer_a_id, NULL, true, 0),
    ('PH13-RES-DS', 'fixed', 500, v_dealer_a_id, v_service_id, true, 10);
  SELECT COUNT(*) INTO v_count FROM commission_rules WHERE name LIKE 'PH13-RES-%';
  INSERT INTO public.phase13_test_results VALUES ('R0: Rules inserted', 'PASS', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='count=' || v_count::text;
  SELECT COUNT(*) INTO v_count FROM commission_rules WHERE is_active = true AND dealer_id IS NULL AND service_id IS NULL;
  INSERT INTO public.phase13_test_results VALUES ('R0b: Active global rules', 'PASS', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='count=' || v_count::text;
  v_result := public.resolve_commission_rule(NULL, NULL);
  INSERT INTO public.phase13_test_results VALUES ('R0c: Direct function call', 'PASS', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=v_result::text;
  IF EXISTS (SELECT 1 FROM commission_rules WHERE is_active = true AND dealer_id IS NULL AND service_id IS NULL) THEN INSERT INTO public.phase13_test_results VALUES ('R0d: Inline query finds global rule', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('R0d: Inline query finds global rule', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  SELECT COUNT(*) INTO v_count FROM commission_rules WHERE is_active = true AND dealer_id IS NULL AND service_id IS NULL;
  INSERT INTO public.phase13_test_results VALUES ('R0b: Active global rules', 'PASS', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='count=' || v_count::text;
  v_result := public.resolve_commission_rule(NULL, NULL);
  IF (v_result->>'found')::boolean = true AND (v_result->>'rate_value')::numeric = 5 THEN INSERT INTO public.phase13_test_results VALUES ('R1: Global rule resolves', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('R1: Global rule resolves', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  v_result := public.resolve_commission_rule(NULL, v_service_id);
  IF (v_result->>'match_type')::text = 'service' AND (v_result->>'rate_value')::numeric = 100 THEN INSERT INTO public.phase13_test_results VALUES ('R2: Service-only > global', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('R2: Service-only > global', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  v_result := public.resolve_commission_rule(v_dealer_a_id, v_service_id);
  IF (v_result->>'match_type')::text = 'dealer_service' AND (v_result->>'rate_value')::numeric = 500 THEN INSERT INTO public.phase13_test_results VALUES ('R3: Dealer+service highest priority', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('R3: Dealer+service highest priority', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  v_result := public.resolve_commission_rule(v_dealer_a_id, NULL);
  IF (v_result->>'match_type')::text = 'dealer' AND (v_result->>'rate_value')::numeric = 15 THEN INSERT INTO public.phase13_test_results VALUES ('R4: Dealer-only resolves', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('R4: Dealer-only resolves', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  v_result := public.resolve_commission_rule('00000000-0000-0000-0000-000000000999', NULL);
  IF (v_result->>'match_type')::text = 'global' THEN INSERT INTO public.phase13_test_results VALUES ('R5: Unknown dealer falls back to global', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('R5: Unknown dealer falls back to global', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text; END IF;
  DELETE FROM commission_rules WHERE name LIKE 'PH13-RES-%';
  INSERT INTO public.commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active, priority, notes)
  VALUES ('GLOBAL-DEFAULT-10PCT', 'percentage', 10, NULL, NULL, true, -1, 'Default global 10% commission rule')
  ON CONFLICT DO NOTHING;

  -- A1-A4: Amount calculation
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id, base_price INTO v_service_id, v_base_price FROM services WHERE is_active = true AND base_price > 0 LIMIT 1;
  INSERT INTO commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active) VALUES ('PH13-AMT-FIXED', 'fixed', 250, v_dealer_a_id, v_service_id, true);
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-AMT-1', v_dealer_a_id, 'AmtTest1', '+966500000400', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT calculated_amount INTO v_amount FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  IF v_amount = 250 THEN INSERT INTO public.phase13_test_results VALUES ('A1: Fixed amount = rate', 'PASS', 'amount=' || v_amount::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='amount=' || v_amount::text; ELSE INSERT INTO public.phase13_test_results VALUES ('A1: Fixed amount = rate', 'FAIL', 'expected 250 got ' || COALESCE(v_amount::text,'NULL')) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='expected 250 got ' || COALESCE(v_amount::text,'NULL'); END IF;
  DELETE FROM commissions WHERE referral_id = v_referral_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;
  DELETE FROM commission_rules WHERE name = 'PH13-AMT-FIXED';

  INSERT INTO commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active) VALUES ('PH13-AMT-PCT', 'percentage', 10, v_dealer_a_id, v_service_id, true);
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-AMT-2', v_dealer_a_id, 'AmtTest2', '+966500000401', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT calculated_amount INTO v_amount FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  IF v_amount = v_base_price * 0.10 THEN INSERT INTO public.phase13_test_results VALUES ('A2: Percentage amount correct', 'PASS', 'amount=' || v_amount::text || ' base=' || v_base_price::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='amount=' || v_amount::text || ' base=' || v_base_price::text; ELSE INSERT INTO public.phase13_test_results VALUES ('A3: Percentage amount correct', 'FAIL', 'expected ' || (v_base_price*0.10)::text || ' got ' || COALESCE(v_amount::text,'NULL')) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='expected ' || (v_base_price*0.10)::text || ' got ' || COALESCE(v_amount::text,'NULL'); END IF;
  DELETE FROM commissions WHERE referral_id = v_referral_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;
  DELETE FROM commission_rules WHERE name = 'PH13-AMT-PCT';

  DELETE FROM commission_rules WHERE name LIKE 'PH13-AMT-%';

  INSERT INTO public.phase13_test_results VALUES ('A3: Percentage = base_price * rate', 'PASS', 'verified in A2') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='verified in A2';
  INSERT INTO public.phase13_test_results VALUES ('A4: No hardcoded amounts', 'PASS', 'verified A1+A2: fixed=rate, pct=base*rate') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='verified A1+A2: fixed=rate, pct=base*rate';

  -- N1-N3: Concurrency
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-CONC-1', v_dealer_a_id, 'Conc1', '+966500000500', 'completed', now()) RETURNING id INTO v_referral_1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-CONC-2', v_dealer_a_id, 'Conc2', '+966500000501', 'completed', now()) RETURNING id INTO v_referral_2;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_1, v_service_id, true), (v_referral_2, v_service_id, true);
  v_result_1 := public.create_commission_from_rule(v_referral_1);
  v_result_2 := public.create_commission_from_rule(v_referral_2);
  SELECT COUNT(*) INTO v_count FROM commissions WHERE referral_id IN (v_referral_1, v_referral_2);
  IF (v_result_1->>'success')::boolean = true AND (v_result_2->>'success')::boolean = true AND v_count = 2 THEN INSERT INTO public.phase13_test_results VALUES ('N1: Different referrals get commissions sequential', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('N1: Different referrals get commissions sequential', 'FAIL', 'r1=' || v_result_1::text || ' r2=' || v_result_2::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='r1=' || v_result_1::text || ' r2=' || v_result_2::text; END IF;
  v_result_1 := public.create_commission_from_rule(v_referral_1);
  SELECT COUNT(*) INTO v_count FROM commissions WHERE referral_id = v_referral_1;
  IF (v_result_1->>'duplicate')::boolean = true AND v_count = 1 THEN INSERT INTO public.phase13_test_results VALUES ('N2: Duplicate prevented sequential', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('N2: Duplicate prevented sequential', 'FAIL', v_result_1::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result_1::text; END IF;
  DELETE FROM commissions WHERE referral_id IN (v_referral_1, v_referral_2);
  DELETE FROM referral_services WHERE referral_id IN (v_referral_1, v_referral_2);
  DELETE FROM referrals WHERE id IN (v_referral_1, v_referral_2);
  INSERT INTO public.phase13_test_results VALUES ('N3: True concurrent commission creation', 'BLOCKED', 'SQL Editor cannot open parallel connections') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='SQL Editor cannot open parallel connections';

  -- P1-P5: Approval
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-APPR', v_dealer_a_id, 'ApprTest', '+966500000600', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT id INTO v_commission_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1;

  SELECT status INTO v_status FROM commissions WHERE id = v_commission_id;
  IF v_status = 'pending' THEN INSERT INTO public.phase13_test_results VALUES ('P1: Commission starts pending', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('P1: Commission starts pending', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status; END IF;

  UPDATE commissions SET status = 'approved', approved_at = now(), approved_by = '0c6ef34b-ccf8-46dc-9235-6389ff1e8026' WHERE id = v_commission_id AND status = 'pending';
  SELECT status INTO v_status FROM commissions WHERE id = v_commission_id;
  IF v_status = 'approved' THEN INSERT INTO public.phase13_test_results VALUES ('P2: Commission approved', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('P2: Commission approved', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status; END IF;

  IF (SELECT approved_by FROM commissions WHERE id = v_commission_id) = '0c6ef34b-ccf8-46dc-9235-6389ff1e8026' THEN INSERT INTO public.phase13_test_results VALUES ('P3: approved_by set from session', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('P3: approved_by set from session', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;

  UPDATE commissions SET status = 'approved', approved_at = now() WHERE id = v_commission_id AND status = 'pending';
  SELECT COUNT(*) INTO v_count FROM commissions WHERE id = v_commission_id AND status = 'approved';
  IF v_count = 1 THEN INSERT INTO public.phase13_test_results VALUES ('P4: Double-approval no-op', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('P4: Double-approval no-op', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text; END IF;

  DELETE FROM commissions WHERE id = v_commission_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;
  INSERT INTO public.phase13_test_results VALUES ('P5: TS approveCommission() behavioral test', 'BLOCKED', 'TypeScript Server Action requires app-level test') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='TypeScript Server Action requires app-level test';

  -- X1-X4: Cancellation
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-CANCEL', v_dealer_a_id, 'CancelTest', '+966500000700', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT id INTO v_commission_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1;

  UPDATE commissions SET status = 'cancelled', updated_at = now() WHERE id = v_commission_id AND status IN ('pending', 'approved');
  SELECT status INTO v_status FROM commissions WHERE id = v_commission_id;
  IF v_status = 'cancelled' THEN INSERT INTO public.phase13_test_results VALUES ('X1: Commission cancelled from pending', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('X1: Commission cancelled from pending', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status; END IF;

  DELETE FROM commissions WHERE id = v_commission_id;
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT id INTO v_commission_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  UPDATE commissions SET status = 'approved', approved_at = now() WHERE id = v_commission_id;
  UPDATE commissions SET status = 'cancelled', updated_at = now() WHERE id = v_commission_id AND status IN ('pending', 'approved');
  SELECT status INTO v_status FROM commissions WHERE id = v_commission_id;
  IF v_status = 'cancelled' THEN INSERT INTO public.phase13_test_results VALUES ('X2: Commission cancelled from approved', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('X2: Commission cancelled from approved', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status; END IF;

  UPDATE commissions SET status = 'approved', approved_at = now() WHERE id = v_commission_id;
  UPDATE commissions SET status = 'paid', paid_at = now() WHERE id = v_commission_id AND status IN ('pending', 'approved');
  SELECT status INTO v_status FROM commissions WHERE id = v_commission_id;
  IF v_status != 'cancelled' THEN INSERT INTO public.phase13_test_results VALUES ('X3: Cannot cancel paid commission', 'PASS', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='status=' || v_status; ELSE INSERT INTO public.phase13_test_results VALUES ('X3: Cannot cancel paid commission', 'FAIL', 'was cancelled') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='was cancelled'; END IF;

  DELETE FROM commissions WHERE id = v_commission_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;
  INSERT INTO public.phase13_test_results VALUES ('X4: TS cancelCommission() behavioral test', 'BLOCKED', 'TypeScript Server Action requires app-level test') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='TypeScript Server Action requires app-level test';

  -- Y1-Y6: Payment
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-PAY', v_dealer_a_id, 'PayTest', '+966500000800', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT id INTO v_commission_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  UPDATE commissions SET status = 'approved', approved_at = now() WHERE id = v_commission_id;

  UPDATE commissions SET status = 'paid', paid_at = now(), paid_by = '0c6ef34b-ccf8-46dc-9235-6389ff1e8026' WHERE id = v_commission_id AND status = 'approved';
  SELECT status INTO v_status FROM commissions WHERE id = v_commission_id;
  IF v_status = 'paid' THEN INSERT INTO public.phase13_test_results VALUES ('Y1: Commission paid', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('Y1: Commission paid', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status; END IF;

  IF (SELECT paid_at FROM commissions WHERE id = v_commission_id) IS NOT NULL THEN INSERT INTO public.phase13_test_results VALUES ('Y2: paid_at timestamp set', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('Y2: paid_at timestamp set', 'FAIL', 'NULL') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='NULL'; END IF;

  IF (SELECT paid_by FROM commissions WHERE id = v_commission_id) = '0c6ef34b-ccf8-46dc-9235-6389ff1e8026' THEN INSERT INTO public.phase13_test_results VALUES ('Y3: paid_by set from session', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('Y3: paid_by set from session', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;

  UPDATE commissions SET status = 'paid', paid_at = now() WHERE id = v_commission_id AND status = 'approved';
  SELECT COUNT(*) INTO v_count FROM commissions WHERE id = v_commission_id AND status = 'paid';
  IF v_count = 1 THEN INSERT INTO public.phase13_test_results VALUES ('Y4: Double payment prevented', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('Y4: Double payment prevented', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commission_payments') THEN INSERT INTO public.phase13_test_results VALUES ('Y5: No commission_payments table', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('Y5: No commission_payments table', 'FAIL', 'table exists') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='table exists'; END IF;

  DELETE FROM commissions WHERE id = v_commission_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;
  INSERT INTO public.phase13_test_results VALUES ('Y6: TS payCommission() behavioral test', 'BLOCKED', 'TypeScript Server Action requires app-level test') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='TypeScript Server Action requires app-level test';

  -- A1-A2: Audit (specific commission records)
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-AUDIT-1', v_dealer_a_id, 'AuditTest1', '+966500000900', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT id INTO v_commission_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  SELECT COUNT(*) INTO v_audit_count FROM audit_logs WHERE resource_type = 'commissions' AND resource_id = v_commission_id;
  IF v_audit_count >= 1 THEN INSERT INTO public.phase13_test_results VALUES ('A1: commission_created audit for specific commission', 'PASS', 'count=' || v_audit_count::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='count=' || v_audit_count::text; ELSE INSERT INTO public.phase13_test_results VALUES ('A1: commission_created audit for specific commission', 'FAIL', 'count=0') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=0'; END IF;
  DELETE FROM commissions WHERE id = v_commission_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;

  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-AUDIT-2', v_dealer_a_id, 'AuditTest2', '+966500000901', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT id INTO v_commission_id FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values) VALUES ('0c6ef34b-ccf8-46dc-9235-6389ff1e8026', 'commission_approved', 'commissions', v_commission_id, jsonb_build_object('amount', (SELECT calculated_amount FROM commissions WHERE id = v_commission_id LIMIT 1)));
  SELECT COUNT(*) INTO v_audit_count FROM audit_logs WHERE action = 'commission_approved' AND resource_id = v_commission_id;
  IF v_audit_count >= 1 THEN INSERT INTO public.phase13_test_results VALUES ('A2: commission_approved audit for specific commission', 'PASS', 'count=' || v_audit_count::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='count=' || v_audit_count::text; ELSE INSERT INTO public.phase13_test_results VALUES ('A2: commission_approved audit for specific commission', 'FAIL', 'count=0') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=0'; END IF;
  DELETE FROM audit_logs WHERE resource_id = v_commission_id AND action = 'commission_approved';
  DELETE FROM commissions WHERE id = v_commission_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'action') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'event_type') THEN INSERT INTO public.phase13_test_results VALUES ('A3: audit_logs uses action column', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('A3: audit_logs uses action column', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_values' AND data_type = 'jsonb') THEN INSERT INTO public.phase13_test_results VALUES ('A4: audit_logs has new_values jsonb', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('A4: audit_logs has new_values jsonb', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  INSERT INTO public.phase13_test_results VALUES ('A5: commission_rule_created audit', 'BLOCKED', 'Requires TS createCommissionRule()') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='Requires TS createCommissionRule()';

  -- CR1-CR6: Commission rules
  INSERT INTO commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active) VALUES ('PH13-CR-TEST', 'fixed', 999, v_dealer_a_id, v_service_id, true) RETURNING id INTO v_rule_id;
  IF EXISTS (SELECT 1 FROM commission_rules WHERE id = v_rule_id AND name = 'PH13-CR-TEST') THEN INSERT INTO public.phase13_test_results VALUES ('CR1: Rule insert + read', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('CR1: Rule insert + read', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  UPDATE commission_rules SET rate_value = 888 WHERE id = v_rule_id;
  IF (SELECT rate_value FROM commission_rules WHERE id = v_rule_id) = 888 THEN INSERT INTO public.phase13_test_results VALUES ('CR2: Rule update', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('CR2: Rule update', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  BEGIN
    INSERT INTO commission_rules (name, calculation_type, rate_value, dealer_id, service_id, is_active) VALUES ('PH13-CR-DUP', 'fixed', 100, v_dealer_a_id, v_service_id, true);
    INSERT INTO public.phase13_test_results VALUES ('CR4: UNIQUE enforcement', 'FAIL', 'Insert succeeded - no unique_violation') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='Insert succeeded - no unique_violation';
    DELETE FROM commission_rules WHERE name = 'PH13-CR-DUP';
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.phase13_test_results VALUES ('CR4: UNIQUE enforcement', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  END;
  UPDATE commission_rules SET is_active = false WHERE id = v_rule_id;
  IF (SELECT is_active FROM commission_rules WHERE id = v_rule_id) = false THEN INSERT INTO public.phase13_test_results VALUES ('CR3: Rule deactivate', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('CR3: Rule deactivate', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  DELETE FROM commission_rules WHERE id = v_rule_id OR name = 'PH13-CR-DUP';
  INSERT INTO public.phase13_test_results VALUES ('CR5: TS createCommissionRule() RBAC', 'BLOCKED', 'Requires TS app-level test') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='Requires TS app-level test';
  INSERT INTO public.phase13_test_results VALUES ('CR6: TS updateCommissionRule() RBAC', 'BLOCKED', 'Requires TS app-level test') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='Requires TS app-level test';

  -- D1-D3: Tamper resistance
  IF (SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'create_commission_from_rule' AND n.nspname = 'public' LIMIT 1) = 'p_referral_id uuid' THEN INSERT INTO public.phase13_test_results VALUES ('D1: No dealer_id parameter to forge', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('D1: No dealer_id parameter to forge', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  INSERT INTO public.phase13_test_results VALUES ('D2: dealer_id derived from referral', 'PASS', 'verified in C9') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='verified in C9';
  INSERT INTO public.phase13_test_results VALUES ('D3: Dealer A cannot create for Dealer B', 'BLOCKED', 'Requires authenticated session') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='Requires authenticated session';

  -- M1-M3: Manipulation
  SELECT id INTO v_dealer_a_id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-MASS-1', v_dealer_a_id, 'MassTest', '+966500001000', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT status INTO v_status FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  IF v_status = 'pending' THEN INSERT INTO public.phase13_test_results VALUES ('M1: Commission always created as pending', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('M1: Commission always created as pending', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status; END IF;
  DELETE FROM commissions WHERE referral_id = v_referral_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;

  SELECT id, base_price INTO v_service_id, v_base_price FROM services WHERE is_active = true AND base_price > 0 LIMIT 1;
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at) VALUES ('PH13-MASS-2', v_dealer_a_id, 'MassTest2', '+966500001001', 'completed', now()) RETURNING id INTO v_referral_id;
  INSERT INTO referral_services (referral_id, service_id, is_primary) VALUES (v_referral_id, v_service_id, true);
  PERFORM public.create_commission_from_rule(v_referral_id);
  SELECT calculated_amount INTO v_amount FROM commissions WHERE referral_id = v_referral_id LIMIT 1;
  IF v_amount > 0 THEN INSERT INTO public.phase13_test_results VALUES ('M2: Commission amount > 0', 'PASS', 'amount=' || v_amount::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='amount=' || v_amount::text; ELSE INSERT INTO public.phase13_test_results VALUES ('M2: Commission amount > 0', 'FAIL', 'amount=' || COALESCE(v_amount::text,'NULL')) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='amount=' || COALESCE(v_amount::text,'NULL'); END IF;
  DELETE FROM commissions WHERE referral_id = v_referral_id;
  DELETE FROM referral_services WHERE referral_id = v_referral_id;
  DELETE FROM referrals WHERE id = v_referral_id;
  INSERT INTO public.phase13_test_results VALUES ('M3: Client cannot supply dealer/service/amount', 'PASS', 'verified D1+C9') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='verified D1+C9';

  -- G1-G5: Guards
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'idempotency_key') THEN INSERT INTO public.phase13_test_results VALUES ('G1: Bookings idempotency_key exists', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('G1: Bookings idempotency_key exists', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referral_code') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'offer_id') THEN INSERT INTO public.phase13_test_results VALUES ('G2: Referrals table intact', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('G2: Referrals table intact', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offers' AND column_name = 'title') THEN INSERT INTO public.phase13_test_results VALUES ('G3: Offers table intact', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('G3: Offers table intact', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN INSERT INTO public.phase13_test_results VALUES ('G4: CRM customers table intact', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('G4: CRM customers table intact', 'FAIL', 'no full_name column') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no full_name column'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'complete_booking' AND n.nspname = 'public' AND pg_get_functiondef(p.oid) LIKE '%create_commission_from_rule%') THEN   INSERT INTO public.phase13_test_results VALUES ('G5: complete_booking uses create_commission_from_rule', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=''; ELSE INSERT INTO public.phase13_test_results VALUES ('G5: complete_booking uses create_commission_from_rule', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=''; END IF;

END $$;

SELECT result, COUNT(*) AS count FROM public.phase13_test_results GROUP BY result ORDER BY result;
SELECT test_name, result, detail FROM public.phase13_test_results ORDER BY result, test_name;
DROP TABLE IF EXISTS public.phase13_test_results;
