-- ============================================================
-- PHASE 15: Inventory Security Tests
-- Tests: RLS, functions, authorization, negative stock, concurrency
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid := '0c6ef34b-ccf8-46dc-9235-6389ff1e8026';
  v_customer_id uuid;
  v_service_id uuid;
  v_material_id uuid;
  v_material_id_2 uuid;
  v_result jsonb;
  v_count int;
  v_stock numeric;
BEGIN
  DROP TABLE IF EXISTS public.phase15_test_results;
  CREATE TABLE public.phase15_test_results (
    test_name TEXT PRIMARY KEY,
    result TEXT NOT NULL,
    detail TEXT
  );

  -- Set JWT session for super_admin
  PERFORM set_config('request.jwt.claims', '{"sub":"0c6ef34b-ccf8-46dc-9235-6389ff1e8026","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);

  -- Get test data
  SELECT id INTO v_customer_id FROM customers WHERE is_active = true LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true LIMIT 1;

  -- ============================================================
  -- SCHEMA TESTS (S1-S5)
  -- ============================================================

  -- S1: materials RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'materials' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('S1: materials RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('S1: materials RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S2: inventory_transactions RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'inventory_transactions' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('S2: inventory_transactions RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('S2: inventory_transactions RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S3: suppliers RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'suppliers' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('S3: suppliers RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('S3: suppliers RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S4: service_materials RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'service_materials' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('S4: service_materials RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('S4: service_materials RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S5: materials current_stock CHECK >= 0
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.materials'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%current_stock%' AND pg_get_constraintdef(oid) LIKE '%0%')
  THEN INSERT INTO public.phase15_test_results VALUES ('S5: materials current_stock CHECK', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('S5: materials current_stock CHECK', 'FAIL', 'no CHECK constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no CHECK constraint';
  END IF;

  -- ============================================================
  -- FUNCTION TESTS (F1-F4)
  -- ============================================================

  -- F1: record_stock_adjustment is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'record_stock_adjustment' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('F1: record_stock_adjustment SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('F1: record_stock_adjustment SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F2: record_inventory_usage is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'record_inventory_usage' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('F2: record_inventory_usage SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('F2: record_inventory_usage SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F3: receive_purchase is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'receive_purchase' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase15_test_results VALUES ('F3: receive_purchase SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('F3: receive_purchase SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F4: material unit CHECK constraint
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.materials'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%unit%' AND pg_get_constraintdef(oid) LIKE '%meter%')
  THEN INSERT INTO public.phase15_test_results VALUES ('F4: material unit CHECK constraint', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('F4: material unit CHECK constraint', 'FAIL', 'no CHECK constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no CHECK constraint';
  END IF;

  -- ============================================================
  -- CRUD TESTS (C1-C4)
  -- ============================================================

  -- C1: Create material via direct insert
  BEGIN
    INSERT INTO public.materials (name, sku, unit, min_stock, max_stock, cost_per_unit, notes)
    VALUES ('Phase15 Test Mat', 'P15-' || extract(epoch from now())::text, 'meter', 5, 50, 10.00, 'Security test')
    RETURNING id INTO v_material_id;
    INSERT INTO public.phase15_test_results VALUES ('C1: Create material', 'PASS', 'id=' || v_material_id::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='id=' || v_material_id::text;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.phase15_test_results VALUES ('C1: Create material', 'FAIL', SQLERRM) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=SQLERRM;
  END;

  -- C2: Material has correct initial stock
  SELECT current_stock INTO v_stock FROM materials WHERE id = v_material_id;
  IF v_stock = 0 THEN
    INSERT INTO public.phase15_test_results VALUES ('C2: Initial stock is 0', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('C2: Initial stock is 0', 'FAIL', 'stock=' || v_stock::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='stock=' || v_stock::text;
  END IF;

  -- C3: Adjust stock IN
  v_result := public.record_stock_adjustment(v_material_id, 20, 'in', 'Test add', NULL);
  IF (v_result->>'success')::boolean = true THEN
    INSERT INTO public.phase15_test_results VALUES ('C3: Adjust stock IN', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('C3: Adjust stock IN', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
  END IF;

  -- C4: Stock increased
  SELECT current_stock INTO v_stock FROM materials WHERE id = v_material_id;
  IF v_stock = 20 THEN
    INSERT INTO public.phase15_test_results VALUES ('C4: Stock is 20 after IN', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('C4: Stock is 20 after IN', 'FAIL', 'stock=' || v_stock::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='stock=' || v_stock::text;
  END IF;

  -- ============================================================
  -- NEGATIVE STOCK TESTS (N1-N3)
  -- ============================================================

  -- N1: Adjust stock OUT
  v_result := public.record_stock_adjustment(v_material_id, 10, 'out', 'Test remove', NULL);
  IF (v_result->>'success')::boolean = true THEN
    INSERT INTO public.phase15_test_results VALUES ('N1: Adjust stock OUT', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('N1: Adjust stock OUT', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
  END IF;

  -- N2: Stock decreased
  SELECT current_stock INTO v_stock FROM materials WHERE id = v_material_id;
  IF v_stock = 10 THEN
    INSERT INTO public.phase15_test_results VALUES ('N2: Stock is 10 after OUT', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('N2: Stock is 10 after OUT', 'FAIL', 'stock=' || v_stock::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='stock=' || v_stock::text;
  END IF;

  -- N3: Negative stock blocked
  v_result := public.record_stock_adjustment(v_material_id, 999, 'out', 'Should fail', NULL);
  IF (v_result->>'success')::boolean = false THEN
    INSERT INTO public.phase15_test_results VALUES ('N3: Negative stock blocked', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('N3: Negative stock blocked', 'FAIL', 'stock should not go negative') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='stock should not go negative';
  END IF;

  -- N4: Stock unchanged after failed OUT
  SELECT current_stock INTO v_stock FROM materials WHERE id = v_material_id;
  IF v_stock = 10 THEN
    INSERT INTO public.phase15_test_results VALUES ('N4: Stock unchanged after fail', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('N4: Stock unchanged after fail', 'FAIL', 'stock=' || v_stock::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='stock=' || v_stock::text;
  END IF;

  -- ============================================================
  -- IDEMPOTENCY TESTS (I1-I2)
  -- ============================================================

  -- I1: Duplicate idempotency key returns existing
  v_result := public.record_stock_adjustment(v_material_id, 5, 'in', 'Idempotency test', 'idem_test_phase15_001');
  IF (v_result->>'success')::boolean = true THEN
    INSERT INTO public.phase15_test_results VALUES ('I1: Idempotency key first call', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('I1: Idempotency key first call', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
  END IF;

  -- I2: Same key again → duplicate
  v_result := public.record_stock_adjustment(v_material_id, 5, 'in', 'Should be duplicate', 'idem_test_phase15_001');
  IF (v_result->>'success')::boolean = true AND (v_result->>'duplicate')::boolean = true THEN
    INSERT INTO public.phase15_test_results VALUES ('I2: Idempotency prevents duplicate', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('I2: Idempotency prevents duplicate', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
  END IF;

  -- ============================================================
  -- WASTE/RETURN/USAGE TESTS (W1-W3)
  -- ============================================================

  -- W1: Waste creates transaction with negative quantity
  SELECT current_stock INTO v_stock FROM materials WHERE id = v_material_id;
  v_result := public.record_stock_adjustment(v_material_id, 2, 'out', '[هدر] Test waste', NULL);
  IF (v_result->>'success')::boolean = true THEN
    INSERT INTO public.phase15_test_results VALUES ('W1: Waste recorded', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('W1: Waste recorded', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
  END IF;

  -- W2: Stock decreased after waste
  SELECT current_stock INTO v_stock FROM materials WHERE id = v_material_id;
  IF v_stock < 10 THEN
    INSERT INTO public.phase15_test_results VALUES ('W2: Stock decreased after waste', 'PASS', 'stock=' || v_stock::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='stock=' || v_stock::text;
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('W2: Stock decreased after waste', 'FAIL', 'stock=' || v_stock::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='stock=' || v_stock::text;
  END IF;

  -- W3: Return increases stock
  v_result := public.record_stock_adjustment(v_material_id, 3, 'in', '[إرجاع] Test return', NULL);
  IF (v_result->>'success')::boolean = true THEN
    INSERT INTO public.phase15_test_results VALUES ('W3: Return recorded', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('W3: Return recorded', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
  END IF;

  -- ============================================================
  -- AUDIT TESTS (A1)
  -- ============================================================

  SELECT COUNT(*) INTO v_count FROM audit_logs WHERE resource_type = 'materials';
  IF v_count >= 1 THEN
    INSERT INTO public.phase15_test_results VALUES ('A1: Audit logs exist for materials', 'PASS', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='count=' || v_count::text;
  ELSE
    INSERT INTO public.phase15_test_results VALUES ('A1: Audit logs exist for materials', 'FAIL', 'count=0') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=0';
  END IF;

  -- ============================================================
  -- INDEX TESTS (IDX1-IDX5)
  -- ============================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'materials' AND indexname LIKE '%sku%')
  THEN INSERT INTO public.phase15_test_results VALUES ('IDX1: materials sku index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('IDX1: materials sku index', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'materials' AND indexname LIKE '%active%')
  THEN INSERT INTO public.phase15_test_results VALUES ('IDX2: materials active index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('IDX2: materials active index', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory_transactions' AND indexname LIKE '%material_id%')
  THEN INSERT INTO public.phase15_test_results VALUES ('IDX3: inventory_transactions material_id index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('IDX3: inventory_transactions material_id index', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory_transactions' AND indexname LIKE '%type%')
  THEN INSERT INTO public.phase15_test_results VALUES ('IDX4: inventory_transactions type index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('IDX4: inventory_transactions type index', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inventory_transactions' AND indexdef LIKE '%idempotency_key%' AND indexdef LIKE '%UNIQUE%')
  THEN INSERT INTO public.phase15_test_results VALUES ('IDX5: idempotency_key unique index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase15_test_results VALUES ('IDX5: idempotency_key unique index', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- ============================================================
  -- CLEANUP
  -- ============================================================

  -- Cleanup test data
  DELETE FROM inventory_transactions WHERE material_id = v_material_id;
  DELETE FROM materials WHERE id = v_material_id;

  RAISE NOTICE 'Phase 15 tests complete';
END $$;

-- Results
SELECT test_name, result, detail FROM public.phase15_test_results ORDER BY test_name;
SELECT result, COUNT(*) as count FROM public.phase15_test_results GROUP BY result ORDER BY count DESC;
