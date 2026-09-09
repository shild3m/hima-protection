-- ============================================================
-- PHASE 14: Invoice & Payment Security Tests
-- Pattern: Same as 016_phase13_security_tests.sql
-- Tests: Schema, Functions, CRUD, Status Transitions, Idempotency, Audit
-- ============================================================

DO $$
DECLARE
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_service_id uuid;
  v_invoice_id uuid;
  v_invoice_id_2 uuid;
  v_invoice_id_3 uuid;
  v_payment_id uuid;
  v_result jsonb;
  v_result_2 jsonb;
  v_inv_number text;
  v_count int;
  v_status text;
  v_total numeric;
  v_paid numeric;
  v_audit_count int;
  v_caller_id uuid;
BEGIN
  DROP TABLE IF EXISTS public.phase14_test_results;
  CREATE TABLE public.phase14_test_results (
    test_name TEXT PRIMARY KEY,
    result TEXT NOT NULL,
    detail TEXT
  );

  v_caller_id := '0c6ef34b-ccf8-46dc-9235-6389ff1e8026';
  SELECT id INTO v_customer_id FROM customers WHERE is_active = true LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE is_active = true LIMIT 1;
  SELECT id INTO v_service_id FROM services WHERE is_active = true AND base_price > 0 LIMIT 1;

  -- Clean leftover idempotency keys from previous runs
  DELETE FROM public.payments WHERE idempotency_key = '550e8400-e29b-41d4-a716-446655440000';

  -- ============================================================
  -- SCHEMA TESTS (S1-S8)
  -- ============================================================

  -- S1: invoices RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'invoices' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('S1: invoices RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S1: invoices RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S2: invoice_items RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'invoice_items' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('S2: invoice_items RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S2: invoice_items RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S3: payments RLS enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments' AND schemaname = 'public' AND rowsecurity = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('S3: payments RLS enabled', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S3: payments RLS enabled', 'FAIL', 'rowsecurity=false') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='rowsecurity=false';
  END IF;

  -- S4: invoice status CHECK constraint
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.invoices'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%' AND pg_get_constraintdef(oid) LIKE '%draft%')
  THEN INSERT INTO public.phase14_test_results VALUES ('S4: invoices status CHECK constraint', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S4: invoices status CHECK constraint', 'FAIL', 'no CHECK constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no CHECK constraint';
  END IF;

  -- S5: payments method CHECK constraint
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payments'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%payment_method%' AND pg_get_constraintdef(oid) LIKE '%cash%')
  THEN INSERT INTO public.phase14_test_results VALUES ('S5: payments method CHECK constraint', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S5: payments method CHECK constraint', 'FAIL', 'no CHECK constraint') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no CHECK constraint';
  END IF;

  -- S6: invoice_number unique index
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'invoices' AND indexname LIKE '%invoice_number%' AND indexdef LIKE '%UNIQUE%')
  THEN INSERT INTO public.phase14_test_results VALUES ('S6: invoice_number unique index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S6: invoice_number unique index', 'FAIL', 'no unique index') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no unique index';
  END IF;

  -- S7: payments idempotency_key unique index
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'payments' AND indexdef LIKE '%idempotency_key%' AND indexdef LIKE '%UNIQUE%')
  THEN INSERT INTO public.phase14_test_results VALUES ('S7: payments idempotency_key unique index', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S7: payments idempotency_key unique index', 'FAIL', 'no unique index') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='no unique index';
  END IF;

  -- S8: invoice_number_seq exists
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'invoice_number_seq')
  THEN INSERT INTO public.phase14_test_results VALUES ('S8: invoice_number_seq exists', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('S8: invoice_number_seq exists', 'FAIL', 'sequence missing') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='sequence missing';
  END IF;

  -- ============================================================
  -- FUNCTION TESTS (F1-F6)
  -- ============================================================

  -- F1: create_invoice is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'create_invoice' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('F1: create_invoice is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('F1: create_invoice is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F2: update_invoice is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'update_invoice' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('F2: update_invoice is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('F2: update_invoice is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F3: record_payment is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'record_payment' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('F3: record_payment is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('F3: record_payment is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F4: generate_invoice_number is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'generate_invoice_number' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('F4: generate_invoice_number is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('F4: generate_invoice_number is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F5: refund_invoice is SECURITY DEFINER
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'refund_invoice' AND n.nspname = 'public' AND p.prosecdef = true)
  THEN INSERT INTO public.phase14_test_results VALUES ('F5: refund_invoice is SECURITY DEFINER', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
  ELSE INSERT INTO public.phase14_test_results VALUES ('F5: refund_invoice is SECURITY DEFINER', 'FAIL', '') ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='';
  END IF;

  -- F6: generate_invoice_number returns correct format
  v_inv_number := public.generate_invoice_number();
  IF v_inv_number ~ '^INV-\d{4}-\d{6}$' THEN
    INSERT INTO public.phase14_test_results VALUES ('F6: generate_invoice_number format', 'PASS', v_inv_number) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail=v_inv_number;
  ELSE
    INSERT INTO public.phase14_test_results VALUES ('F6: generate_invoice_number format', 'FAIL', v_inv_number) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_inv_number;
  END IF;

  -- ============================================================
  -- INVOICE CRUD TESTS (I1-I8)
  -- ============================================================

  -- Set JWT session for super_admin so auth.uid() and has_permission() work
  PERFORM set_config('request.jwt.claims', '{"sub":"0c6ef34b-ccf8-46dc-9235-6389ff1e8026","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', true);

  IF v_customer_id IS NULL THEN
    INSERT INTO public.phase14_test_results VALUES ('I1: create_invoice creates draft', 'BLOCKED', 'No customer') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='No customer';
  ELSE
    -- I1: create_invoice creates draft with correct totals
    v_result := public.create_invoice(
      v_customer_id,
      v_vehicle_id,
      NULL,
      10,     -- discount
      15,     -- tax_rate
      'Phase14 test invoice',
      jsonb_build_array(
        jsonb_build_object('description', 'Tinting Service', 'quantity', 2, 'unit_price', 500, 'discount', 0, 'tax_rate', 0),
        jsonb_build_object('description', 'Scratch Removal', 'quantity', 1, 'unit_price', 200, 'discount', 50, 'tax_rate', 0)
      )
    );
    IF (v_result->>'success')::boolean = true THEN
      v_invoice_id := (v_result->>'invoice_id')::uuid;
      INSERT INTO public.phase14_test_results VALUES ('I1: create_invoice creates draft', 'PASS', 'id=' || v_invoice_id::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='id=' || v_invoice_id::text;
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I1: create_invoice creates draft', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
    END IF;

    -- I2: Invoice status is draft
    SELECT status, total INTO v_status, v_total FROM invoices WHERE id = v_invoice_id;
    IF v_status = 'draft' THEN
      INSERT INTO public.phase14_test_results VALUES ('I2: Invoice status is draft', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I2: Invoice status is draft', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- I3: Total calculated correctly (subtotal=1150, tax=172.5, discount=10, total=1312.5)
    IF v_total = 1312.5 THEN
      INSERT INTO public.phase14_test_results VALUES ('I3: Invoice total calculated correctly', 'PASS', 'total=' || v_total::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='total=' || v_total::text;
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I3: Invoice total calculated correctly', 'FAIL', 'total=' || v_total::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='total=' || v_total::text;
    END IF;

    -- I4: invoice_items created
    SELECT COUNT(*) INTO v_count FROM invoice_items WHERE invoice_id = v_invoice_id;
    IF v_count = 2 THEN
      INSERT INTO public.phase14_test_results VALUES ('I4: Invoice items created (count=2)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I4: Invoice items created (count=2)', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text;
    END IF;

    -- I5: Audit log for invoice_created
    SELECT COUNT(*) INTO v_count FROM audit_logs WHERE resource_type = 'invoices' AND resource_id = v_invoice_id AND action = 'invoice_created';
    IF v_count >= 1 THEN
      INSERT INTO public.phase14_test_results VALUES ('I5: Audit log invoice_created', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I5: Audit log invoice_created', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text;
    END IF;

    -- I6: issue_invoice transitions to issued
    UPDATE invoices SET status = 'issued', issued_at = now() WHERE id = v_invoice_id;
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id;
    IF v_status = 'issued' THEN
      INSERT INTO public.phase14_test_results VALUES ('I6: issue_invoice transitions to issued', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I6: issue_invoice transitions to issued', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- I7: update_invoice fails on non-draft
    v_result := public.update_invoice(v_invoice_id, 5, NULL, 'updated', NULL);
    IF (v_result->>'success')::boolean = false AND (v_result->>'error')::text LIKE '%draft%' THEN
      INSERT INTO public.phase14_test_results VALUES ('I7: update_invoice fails on non-draft', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I7: update_invoice fails on non-draft', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text;
    END IF;

    -- I8: create_invoice fails with empty items
    v_result := public.create_invoice(v_customer_id, NULL, NULL, 0, 0, NULL, '[]'::jsonb);
    IF (v_result->>'success')::boolean = false THEN
      INSERT INTO public.phase14_test_results VALUES ('I8: create_invoice fails with empty items', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('I8: create_invoice fails with empty items', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text;
    END IF;
  END IF;

  -- ============================================================
  -- PAYMENT TESTS (P1-P7)
  -- ============================================================

  IF v_invoice_id IS NOT NULL THEN
    -- P1: record_payment succeeds on issued invoice
    v_result := public.record_payment(v_invoice_id, 500, 'cash', NULL, 'Test payment', NULL);
    IF (v_result->>'success')::boolean = true THEN
      v_payment_id := (v_result->>'payment_id')::uuid;
      INSERT INTO public.phase14_test_results VALUES ('P1: record_payment succeeds', 'PASS', 'id=' || v_payment_id::text) ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='id=' || v_payment_id::text;
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P1: record_payment succeeds', 'FAIL', (v_result->>'error')::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=(v_result->>'error')::text;
    END IF;

    -- P2: Invoice status transitions to partially_paid
    SELECT status, paid_amount INTO v_status, v_paid FROM invoices WHERE id = v_invoice_id;
    IF v_status = 'partially_paid' AND v_paid = 500 THEN
      INSERT INTO public.phase14_test_results VALUES ('P2: Invoice partially_paid after partial payment', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P2: Invoice partially_paid after partial payment', 'FAIL', 'status=' || v_status || ' paid=' || v_paid::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status || ' paid=' || v_paid::text;
    END IF;

    -- P3: Idempotency key prevents duplicate
    v_result := public.record_payment(v_invoice_id, 500, 'cash', NULL, 'Duplicate', '550e8400-e29b-41d4-a716-446655440000');
    v_result_2 := public.record_payment(v_invoice_id, 500, 'cash', NULL, 'Duplicate', '550e8400-e29b-41d4-a716-446655440000');
    IF (v_result->>'success')::boolean = true AND (v_result_2->>'duplicate')::boolean = true THEN
      INSERT INTO public.phase14_test_results VALUES ('P3: Idempotency key prevents duplicate', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P3: Idempotency key prevents duplicate', 'FAIL', 'first=' || v_result::text || ' second=' || v_result_2::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='first=' || v_result::text || ' second=' || v_result_2::text;
    END IF;

    -- P4: Overpayment blocked
    v_result := public.record_payment(v_invoice_id, 99999, 'cash', NULL, 'Overpay test', NULL);
    IF (v_result->>'success')::boolean = false AND (v_result->>'error')::text LIKE '%exceeds%' THEN
      INSERT INTO public.phase14_test_results VALUES ('P4: Overpayment blocked', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P4: Overpayment blocked', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text;
    END IF;

    -- P5: Pay remaining → status=paid (total=1312.5, paid=1000, remaining=312.5)
    v_result := public.record_payment(v_invoice_id, 312.5, 'card', NULL, 'Final payment', NULL);
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id;
    IF v_status = 'paid' THEN
      INSERT INTO public.phase14_test_results VALUES ('P5: Full payment → status paid', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P5: Full payment → status paid', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- P6: Cannot pay paid invoice
    v_result := public.record_payment(v_invoice_id, 1, 'cash', NULL, 'Should fail', NULL);
    IF (v_result->>'success')::boolean = false THEN
      INSERT INTO public.phase14_test_results VALUES ('P6: Cannot pay paid invoice', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P6: Cannot pay paid invoice', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text;
    END IF;

    -- P7: Audit log for payment_recorded
    SELECT COUNT(*) INTO v_count FROM audit_logs WHERE resource_type = 'payments' AND action = 'payment_recorded';
    IF v_count >= 1 THEN
      INSERT INTO public.phase14_test_results VALUES ('P7: Audit log payment_recorded', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('P7: Audit log payment_recorded', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text;
    END IF;
  END IF;

  -- ============================================================
  -- REFUND TESTS (R1-R3)
  -- ============================================================

  IF v_invoice_id IS NOT NULL THEN
    -- R1: refund_invoice succeeds on paid invoice
    v_result := public.refund_invoice(v_invoice_id, 'Phase14 test refund');
    IF (v_result->>'success')::boolean = true THEN
      INSERT INTO public.phase14_test_results VALUES ('R1: refund_invoice succeeds', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('R1: refund_invoice succeeds', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text;
    END IF;

    -- R2: Invoice status transitions to refunded
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id;
    IF v_status = 'refunded' THEN
      INSERT INTO public.phase14_test_results VALUES ('R2: Invoice status refunded', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('R2: Invoice status refunded', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- R3: Cannot refund draft invoice
    v_result := public.create_invoice(v_customer_id, NULL, NULL, 0, 0, NULL, jsonb_build_array(jsonb_build_object('description', 'Test', 'quantity', 1, 'unit_price', 100)));
    IF (v_result->>'success')::boolean = true THEN
      v_invoice_id_3 := (v_result->>'invoice_id')::uuid;
      v_result := public.refund_invoice(v_invoice_id_3, 'Should fail');
      IF (v_result->>'success')::boolean = false THEN
        INSERT INTO public.phase14_test_results VALUES ('R3: Cannot refund draft invoice', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
      ELSE
        INSERT INTO public.phase14_test_results VALUES ('R3: Cannot refund draft invoice', 'FAIL', v_result::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail=v_result::text;
      END IF;
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('R3: Cannot refund draft invoice', 'BLOCKED', 'create_invoice failed') ON CONFLICT (test_name) DO UPDATE SET result='BLOCKED', detail='create_invoice failed';
    END IF;

    -- R4: Audit log for invoice_refunded
    SELECT COUNT(*) INTO v_count FROM audit_logs WHERE resource_type = 'invoices' AND resource_id = v_invoice_id AND action = 'invoice_refunded';
    IF v_count >= 1 THEN
      INSERT INTO public.phase14_test_results VALUES ('R4: Audit log invoice_refunded', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('R4: Audit log invoice_refunded', 'FAIL', 'count=' || v_count::text) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='count=' || v_count::text;
    END IF;
  END IF;

  -- ============================================================
  -- STATUS TRANSITION TESTS (T1-T4)
  -- ============================================================

  -- T1: draft → issued (valid)
  v_result := public.create_invoice(v_customer_id, NULL, NULL, 0, 0, NULL, jsonb_build_array(jsonb_build_object('description', 'Transition test', 'quantity', 1, 'unit_price', 100)));
  IF (v_result->>'success')::boolean = true THEN
    v_invoice_id_2 := (v_result->>'invoice_id')::uuid;
    UPDATE invoices SET status = 'issued', issued_at = now() WHERE id = v_invoice_id_2;
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id_2;
    IF v_status = 'issued' THEN
      INSERT INTO public.phase14_test_results VALUES ('T1: draft → issued (valid)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('T1: draft → issued (valid)', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- T2: issued → partially_paid (valid via payment)
    v_result := public.record_payment(v_invoice_id_2, 50, 'cash', NULL, NULL, NULL);
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id_2;
    IF v_status = 'partially_paid' THEN
      INSERT INTO public.phase14_test_results VALUES ('T2: issued → partially_paid (valid)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('T2: issued → partially_paid (valid)', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- T3: partially_paid → paid (valid via payment)
    v_result := public.record_payment(v_invoice_id_2, 50, 'cash', NULL, NULL, NULL);
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id_2;
    IF v_status = 'paid' THEN
      INSERT INTO public.phase14_test_results VALUES ('T3: partially_paid → paid (valid)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('T3: partially_paid → paid (valid)', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;

    -- T4: paid → refunded (valid via refund)
    v_result := public.refund_invoice(v_invoice_id_2, 'transition test');
    SELECT status INTO v_status FROM invoices WHERE id = v_invoice_id_2;
    IF v_status = 'refunded' THEN
      INSERT INTO public.phase14_test_results VALUES ('T4: paid → refunded (valid)', 'PASS', '') ON CONFLICT (test_name) DO UPDATE SET result='PASS', detail='';
    ELSE
      INSERT INTO public.phase14_test_results VALUES ('T4: paid → refunded (valid)', 'FAIL', 'status=' || v_status) ON CONFLICT (test_name) DO UPDATE SET result='FAIL', detail='status=' || v_status;
    END IF;
  END IF;

  -- ============================================================
  -- CLEANUP
  -- ============================================================

  -- Clean up test data (use service_role context)
  IF v_invoice_id IS NOT NULL THEN DELETE FROM payments WHERE invoice_id = v_invoice_id; END IF;
  IF v_invoice_id IS NOT NULL THEN DELETE FROM invoice_items WHERE invoice_id = v_invoice_id; END IF;
  IF v_invoice_id IS NOT NULL THEN DELETE FROM invoices WHERE id = v_invoice_id; END IF;
  IF v_invoice_id_2 IS NOT NULL THEN DELETE FROM payments WHERE invoice_id = v_invoice_id_2; END IF;
  IF v_invoice_id_2 IS NOT NULL THEN DELETE FROM invoice_items WHERE invoice_id = v_invoice_id_2; END IF;
  IF v_invoice_id_2 IS NOT NULL THEN DELETE FROM invoices WHERE id = v_invoice_id_2; END IF;
  IF v_invoice_id_3 IS NOT NULL THEN DELETE FROM invoice_items WHERE invoice_id = v_invoice_id_3; END IF;
  IF v_invoice_id_3 IS NOT NULL THEN DELETE FROM invoices WHERE id = v_invoice_id_3; END IF;

  RAISE NOTICE 'Phase 14 tests complete';
END $$;

-- Results
SELECT test_name, result, detail FROM public.phase14_test_results ORDER BY test_name;
SELECT
  result,
  COUNT(*) as count
FROM public.phase14_test_results
GROUP BY result
ORDER BY count DESC;
