-- Debug script for resolve_commission_rule (v2 - explicit variables)
-- Run this as a SEPARATE query in Supabase SQL Editor

-- Step 1: Check current function definition
SELECT pg_get_functiondef(p.oid) AS funcdef
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'resolve_commission_rule' AND n.nspname = 'public';

-- Step 2: Count active global rules (inline)
SELECT COUNT(*) AS inline_global_count
FROM public.commission_rules
WHERE is_active = true AND dealer_id IS NULL AND service_id IS NULL;

-- Step 3: Call the function with NULL params
SELECT public.resolve_commission_rule(NULL, NULL) AS result_global;

-- Step 4: Call with dealer+service
SELECT public.resolve_commission_rule(
  (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1),
  (SELECT id FROM services WHERE is_active = true LIMIT 1)
) AS result_dealer_service;

-- Step 5: Call dealer only
SELECT public.resolve_commission_rule(
  (SELECT id FROM dealers WHERE user_id = '5c9f936f-cece-42e3-b9ac-ad2a118c59de' LIMIT 1),
  NULL
) AS result_dealer_only;
