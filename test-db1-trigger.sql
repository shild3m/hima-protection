CREATE OR REPLACE FUNCTION public.db1_test()
RETURNS TABLE(test_num int, description text, result text, detail text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_d uuid; v_r uuid; v_c uuid; v_s text; v_b boolean;
BEGIN
  DELETE FROM public.commissions WHERE referral_id IN (SELECT id FROM public.referrals WHERE referral_code LIKE 'DB1_TEST_REF_%');
  DELETE FROM public.referrals WHERE referral_code LIKE 'DB1_TEST_REF_%';
  DELETE FROM public.dealers WHERE business_name LIKE 'DB1_TEST_%';

  -- TEST 1: pending → approved
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_1','0000000101','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_1',v_d,'T1','0000000101','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'approved' WHERE id = v_c;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 1; description := 'pending → approved';
  IF v_s = 'approved' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := v_s;
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- TEST 2: pending → cancelled
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_2','0000000102','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_2',v_d,'T2','0000000102','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'cancelled' WHERE id = v_c;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 2; description := 'pending → cancelled';
  IF v_s = 'cancelled' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := v_s;
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- TEST 3: approved → paid
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_3','0000000103','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_3',v_d,'T3','0000000103','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'approved' WHERE id = v_c;
  UPDATE public.commissions SET status = 'paid' WHERE id = v_c;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 3; description := 'approved → paid';
  IF v_s = 'paid' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := v_s;
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- TEST 4: approved → cancelled
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_4','0000000104','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_4',v_d,'T4','0000000104','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'approved' WHERE id = v_c;
  UPDATE public.commissions SET status = 'cancelled' WHERE id = v_c;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 4; description := 'approved → cancelled';
  IF v_s = 'cancelled' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := v_s;
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- TEST 5: paid → pending = BLOCKED
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_5','0000000105','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_5',v_d,'T5','0000000105','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'approved' WHERE id = v_c;
  UPDATE public.commissions SET status = 'paid' WHERE id = v_c;
  v_b := false;
  BEGIN
    UPDATE public.commissions SET status = 'pending' WHERE id = v_c;
  EXCEPTION WHEN OTHERS THEN v_b := true;
  END;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 5; description := 'paid → pending (BLOCKED)';
  IF v_b AND v_s = 'paid' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := 'blocked=' || v_b || ' status=' || COALESCE(v_s, 'NULL');
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- TEST 6: paid → cancelled = BLOCKED
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_6','0000000106','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_6',v_d,'T6','0000000106','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'approved' WHERE id = v_c;
  UPDATE public.commissions SET status = 'paid' WHERE id = v_c;
  v_b := false;
  BEGIN
    UPDATE public.commissions SET status = 'cancelled' WHERE id = v_c;
  EXCEPTION WHEN OTHERS THEN v_b := true;
  END;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 6; description := 'paid → cancelled (BLOCKED)';
  IF v_b AND v_s = 'paid' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := 'blocked=' || v_b || ' status=' || COALESCE(v_s, 'NULL');
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- TEST 7: cancelled → pending = BLOCKED
  INSERT INTO public.dealers (business_name, phone, commission_type, commission_value, is_active) VALUES ('DB1_TEST_7','0000000107','fixed',100,true) RETURNING id INTO v_d;
  INSERT INTO public.referrals (referral_code, dealer_id, customer_name, customer_phone, status) VALUES ('DB1_TEST_REF_7',v_d,'T7','0000000107','created') RETURNING id INTO v_r;
  INSERT INTO public.commissions (referral_id, dealer_id, calculation_type, rate_value, calculated_amount, status) VALUES (v_r,v_d,'fixed',100,100,'pending') RETURNING id INTO v_c;
  UPDATE public.commissions SET status = 'cancelled' WHERE id = v_c;
  v_b := false;
  BEGIN
    UPDATE public.commissions SET status = 'pending' WHERE id = v_c;
  EXCEPTION WHEN OTHERS THEN v_b := true;
  END;
  SELECT status INTO v_s FROM public.commissions WHERE id = v_c;
  test_num := 7; description := 'cancelled → pending (BLOCKED)';
  IF v_b AND v_s = 'cancelled' THEN result := 'PASS'; ELSE result := 'FAIL'; END IF;
  detail := 'blocked=' || v_b || ' status=' || COALESCE(v_s, 'NULL');
  RETURN NEXT;
  DELETE FROM public.commissions WHERE id = v_c; DELETE FROM public.referrals WHERE id = v_r; DELETE FROM public.dealers WHERE id = v_d;

  -- CLEANUP
  DELETE FROM public.commissions WHERE referral_id IN (SELECT id FROM public.referrals WHERE referral_code LIKE 'DB1_TEST_REF_%');
  DELETE FROM public.referrals WHERE referral_code LIKE 'DB1_TEST_REF_%';
  DELETE FROM public.dealers WHERE business_name LIKE 'DB1_TEST_%';
END $$;
