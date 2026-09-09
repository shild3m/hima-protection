-- Phase 13 App-Level Test Setup
-- Creates test data and returns IDs for Node.js testing

-- 1. Create helper function to return test IDs
CREATE OR REPLACE FUNCTION public.get_app_test_ids()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'dealer_a', (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1),
    'dealer_b', (SELECT id FROM dealers WHERE user_id = 'dad5123b-68dd-41f8-9168-4f7783e12d55' LIMIT 1),
    'service', (SELECT id FROM services WHERE is_active = true AND base_price > 0 LIMIT 1),
    'ref_d3a', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-D3-A-%' ORDER BY created_at DESC LIMIT 1),
    'ref_d3b', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-D3-B-%' ORDER BY created_at DESC LIMIT 1),
    'ref_p5', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-P5-%' ORDER BY created_at DESC LIMIT 1),
    'ref_x4', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-X4-%' ORDER BY created_at DESC LIMIT 1),
    'ref_y6', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-Y6-%' ORDER BY created_at DESC LIMIT 1),
    'ref_y6d', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-Y6D-%' ORDER BY created_at DESC LIMIT 1),
    'ref_n3', (SELECT id FROM referrals WHERE referral_code LIKE 'APP-N3-%' ORDER BY created_at DESC LIMIT 1)
  );
$$;

-- 2. Create test referrals (using SECURITY DEFINER to bypass RLS)
DO $$
DECLARE
  v_dealer_a uuid;
  v_dealer_b uuid;
  v_svc uuid;
BEGIN
  SELECT id INTO v_dealer_a FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1;
  SELECT id INTO v_dealer_b FROM dealers WHERE user_id = 'dad5123b-68dd-41f8-9168-4f7783e12d55' LIMIT 1;
  SELECT id INTO v_svc FROM services WHERE is_active = true AND base_price > 0 LIMIT 1;

  -- Clean old test data
  DELETE FROM commissions WHERE referral_id IN (SELECT id FROM referrals WHERE referral_code LIKE 'APP-%');
  DELETE FROM referral_services WHERE referral_id IN (SELECT id FROM referrals WHERE referral_code LIKE 'APP-%');
  DELETE FROM referrals WHERE referral_code LIKE 'APP-%';

  -- D3-B: Dealer B ref
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-D3-B-' || now()::text, v_dealer_b, 'App D3 B', '+96650999300', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-D3-B-%' ORDER BY created_at DESC LIMIT 1;

  -- D3-A: Dealer A ref
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-D3-A-' || now()::text, v_dealer_a, 'App D3 A', '+96650999301', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-D3-A-%' ORDER BY created_at DESC LIMIT 1;

  -- P5
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-P5-' || now()::text, v_dealer_a, 'App P5', '+96650999500', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-P5-%' ORDER BY created_at DESC LIMIT 1;

  -- X4
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-X4-' || now()::text, v_dealer_a, 'App X4', '+96650999600', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-X4-%' ORDER BY created_at DESC LIMIT 1;

  -- Y6
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-Y6-' || now()::text, v_dealer_a, 'App Y6', '+96650999700', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-Y6-%' ORDER BY created_at DESC LIMIT 1;

  -- Y6D
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-Y6D-' || now()::text, v_dealer_a, 'App Y6D', '+96650999701', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-Y6D-%' ORDER BY created_at DESC LIMIT 1;

  -- N3
  INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status, completed_at)
  VALUES ('APP-N3-' || now()::text, v_dealer_a, 'App N3', '+96650999800', 'completed', now());
  INSERT INTO referral_services (referral_id, service_id, is_primary)
  SELECT id, v_svc, true FROM referrals WHERE referral_code LIKE 'APP-N3-%' ORDER BY created_at DESC LIMIT 1;

  RAISE NOTICE 'Test data created successfully';
END $$;

-- 3. Verify
SELECT referral_code, dealer_id, id FROM referrals WHERE referral_code LIKE 'APP-%' ORDER BY referral_code;
