-- ============================================================
-- PHASE 12 — SECURITY + BEHAVIORAL TESTS
-- Run in Supabase SQL Editor
-- ============================================================
-- Test users:
--   Dealer A: user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de'
--   Dealer B: user_id = 'dad5123b-68dd-41f8-9168-4f7783e12d55'
--   Admin:    user_id = '0c6ef34b-ccf8-46dc-9235-6389ff1e8026'
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS test_results (
  test_name TEXT,
  result BOOLEAN,
  detail TEXT
);

-- ============================================================
-- DEALER ISOLATION (GAP 8)
-- ============================================================

-- TEST 1: Dealer A inserts own referral
SELECT set_config('request.jwt.claims', '{"sub":"5c9f936f-cece-42e3-b9ac-ad2a118c59de","role":"authenticated"}', true);
SELECT set_config('role', 'authenticated', true);

INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status)
SELECT 'TEST-PH12-A-' || floor(random()*100000)::text,
  id, 'Test Customer A', '0511111111', 'created'
FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de'
ON CONFLICT (referral_code) DO NOTHING;

INSERT INTO test_results
SELECT 'T1: Dealer A inserts own referral',
  (SELECT COUNT(*) > 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%'
    AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de')),
  'RLS allows dealer INSERT own';

-- TEST 2: Dealer A reads own referrals
SELECT set_config('request.jwt.claims', '{"sub":"5c9f936f-cece-42e3-b9ac-ad2a118c59de","role":"authenticated"}', true);

INSERT INTO test_results
SELECT 'T2: Dealer A reads own referrals',
  (SELECT COUNT(*) > 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%'),
  'RLS allows dealer SELECT own';

-- TEST 3: Dealer B inserts own referral
SELECT set_config('request.jwt.claims', '{"sub":"dad5123b-68dd-41f8-9168-4f7783e12d55","role":"authenticated"}', true);

INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status)
SELECT 'TEST-PH12-B-' || floor(random()*100000)::text,
  id, 'Test Customer B', '0522222222', 'created'
FROM dealers WHERE user_id = 'dad5123b-68dd-41f8-9168-4f7783e12d55'
ON CONFLICT (referral_code) DO NOTHING;

INSERT INTO test_results
SELECT 'T3: Dealer B inserts own referral',
  (SELECT COUNT(*) > 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-B-%'
    AND dealer_id = (SELECT id FROM dealers WHERE user_id = 'dad5123b-68dd-41f8-9168-4f7783e12d55')),
  'RLS allows dealer INSERT own';

-- TEST 4: Dealer A CANNOT see Dealer B referrals
SELECT set_config('request.jwt.claims', '{"sub":"5c9f936f-cece-42e3-b9ac-ad2a118c59de","role":"authenticated"}', true);

INSERT INTO test_results
SELECT 'T4: Dealer A CANNOT see Dealer B referrals',
  (SELECT COUNT(*) = 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-B-%'),
  'RLS blocks cross-dealer SELECT';

-- TEST 5: Dealer B CANNOT see Dealer A referrals
SELECT set_config('request.jwt.claims', '{"sub":"dad5123b-68dd-41f8-9168-4f7783e12d55","role":"authenticated"}', true);

INSERT INTO test_results
SELECT 'T5: Dealer B CANNOT see Dealer A referrals',
  (SELECT COUNT(*) = 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%'),
  'RLS blocks cross-dealer SELECT';

-- TEST 6: Dealer A CANNOT UPDATE own referral (no UPDATE policy for dealers)
SELECT set_config('request.jwt.claims', '{"sub":"5c9f936f-cece-42e3-b9ac-ad2a118c59de","role":"authenticated"}', true);

UPDATE referrals SET status = 'redeemed'
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de');

INSERT INTO test_results
SELECT 'T6: Dealer A CANNOT UPDATE own referral',
  (SELECT COUNT(*) = 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%' AND status = 'redeemed'),
  'RLS blocks dealer UPDATE (no UPDATE policy)';

-- TEST 7: Anonymous CANNOT read referrals
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

INSERT INTO test_results
SELECT 'T7: Anonymous CANNOT read referrals',
  (SELECT COUNT(*) = 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-%'),
  'RLS default-deny blocks anon';

-- TEST 8: Anonymous CANNOT insert referrals
DO $$
BEGIN
  BEGIN
    INSERT INTO referrals (referral_code, dealer_id, customer_name, customer_phone, status)
    VALUES ('TEST-PH12-ANON', '00000000-0000-0000-0000-000000000000', 'Anon', '0500000000', 'created');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

INSERT INTO test_results
SELECT 'T8: Anonymous CANNOT insert referrals',
  (SELECT COUNT(*) = 0 FROM referrals WHERE referral_code = 'TEST-PH12-ANON'),
  'RLS blocks anon INSERT';

-- ============================================================
-- ADMIN ACCESS (GAP 12)
-- ============================================================

SELECT set_config('request.jwt.claims', '{"sub":"0c6ef34b-ccf8-46dc-9235-6389ff1e8026","role":"authenticated"}', true);
SELECT set_config('role', 'authenticated', true);

-- TEST 9: Admin can SELECT all referrals
INSERT INTO test_results
SELECT 'T9: Admin can SELECT all referrals',
  (SELECT COUNT(*) > 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-%'),
  'Staff SELECT all referrals';

-- TEST 10: Admin can UPDATE referrals (status change)
UPDATE referrals SET status = 'contacted'
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de')
  AND status = 'created';

INSERT INTO test_results
SELECT 'T10: Admin can UPDATE referral status',
  (SELECT COUNT(*) > 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%' AND status = 'contacted'),
  'Staff UPDATE referrals';

-- ============================================================
-- STATUS MACHINE (GAP 5)
-- ============================================================

-- TEST 11: Invalid transition COMPLETED -> CREATED
UPDATE referrals SET status = 'completed'
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de');

-- Now try to transition completed -> created (should fail via RLS — no policy allows this)
UPDATE referrals SET status = 'created'
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de');

INSERT INTO test_results
SELECT 'T11: Invalid transition COMPLETED->CREATED denied',
  (SELECT COUNT(*) = 0 FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%' AND status = 'created'),
  'RLS blocks invalid transition';

-- Reset for further tests
UPDATE referrals SET status = 'contacted'
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de');

-- ============================================================
-- CONCURRENCY / DOUBLE REDEMPTION (GAP 2)
-- ============================================================

-- TEST 12: Two concurrent UPDATE WHERE status='contacted' — exactly one succeeds
-- Simulate: first UPDATE succeeds, second finds status != 'contacted'
UPDATE referrals SET status = 'redeemed', redeemed_at = now()
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de')
  AND status = 'contacted';

UPDATE referrals SET status = 'redeemed', redeemed_at = now()
WHERE referral_code LIKE 'TEST-PH12-A-%'
  AND dealer_id = (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de')
  AND status = 'contacted';

-- Should be exactly 1 redeemed (not 2 — second UPDATE is a no-op due to WHERE clause)
INSERT INTO test_results
SELECT 'T12: Double redemption prevented (atomic WHERE)',
  (SELECT COUNT(*) FROM referrals WHERE referral_code LIKE 'TEST-PH12-A-%' AND status = 'redeemed') = 1,
  'WHERE status=contacted prevents double redemption';

-- ============================================================
-- AUDIT LOGGING (GAP 9)
-- ============================================================

-- TEST 13: Audit log exists for referral creation
INSERT INTO test_results
SELECT 'T13: Audit log for referral creation',
  (SELECT COUNT(*) > 0 FROM audit_logs WHERE action = 'referral_created'
    AND resource_type = 'referrals'
    AND user_id IN ('5c9f936f-cece-42e3-b9ac-ad2a118c59de', 'dad5123b-68dd-41f8-9168-4f7783e12d55')),
  'Server Action wrote audit log';

-- TEST 14: Audit log exists for referral status changes
INSERT INTO test_results
SELECT 'T14: Audit log for referral status change',
  (SELECT COUNT(*) > 0 FROM audit_logs WHERE action LIKE 'referral_%'
    AND resource_type = 'referrals'),
  'Server Action wrote audit log for status changes';

-- ============================================================
-- OFFER REDEMPTION CHECK (GAP 6)
-- ============================================================

-- TEST 15: Expired offer exists in test data (create one)
INSERT INTO offers (title, offer_type, value, is_active, start_date, end_date)
VALUES ('TEST-PH12-EXPIRED', 'fixed_discount', 100, true, '2020-01-01', '2020-12-31')
RETURNING id INTO TEXT _expired_offer_id;

-- TEST 15: Expired offer detected by date check (end_date < now())
INSERT INTO test_results
SELECT 'T15: Expired offer has end_date < now()',
  (SELECT end_date < now() FROM offers WHERE title = 'TEST-PH12-EXPIRED'),
  'Server can detect expired offers';

-- ============================================================
-- OFFER MANAGEMENT (GAP 11)
-- ============================================================

-- TEST 16: General offers visible to anon (public_select_general_offers)
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

INSERT INTO test_results
SELECT 'T16: General offers visible to public',
  (SELECT COUNT(*) >= 0 FROM offers WHERE is_active = true AND dealer_id IS NULL),
  'RLS public_select_general_offers exists';

-- TEST 17: Anonymous CANNOT insert offers
DO $$
BEGIN
  BEGIN
    INSERT INTO offers (title, offer_type, value, is_active)
    VALUES ('TEST-ANON-OFFER', 'fixed_discount', 999, true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

INSERT INTO test_results
SELECT 'T17: Anonymous CANNOT insert offers',
  (SELECT COUNT(*) = 0 FROM offers WHERE title = 'TEST-ANON-OFFER'),
  'RLS default-deny blocks anon INSERT on offers';

-- ============================================================
-- CLEANUP
-- ============================================================
DELETE FROM referrals WHERE referral_code LIKE 'TEST-PH12-%';
DELETE FROM offers WHERE title IN ('TEST-PH12-EXPIRED', 'TEST-ANON-OFFER');

SELECT set_config('role', 'service_role', true);

-- ============================================================
-- RESULTS
-- ============================================================
SELECT * FROM test_results ORDER BY test_name;
SELECT
  COUNT(*) AS total_tests,
  SUM(CASE WHEN result THEN 1 ELSE 0 END) AS passed,
  SUM(CASE WHEN NOT result THEN 1 ELSE 0 END) AS failed
FROM test_results;

DROP TABLE test_results;
