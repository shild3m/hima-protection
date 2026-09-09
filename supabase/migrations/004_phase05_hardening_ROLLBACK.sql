-- ============================================================
-- ROLLBACK: Phase 05 Hardening Migrations
-- Execute in Supabase SQL Editor to undo all changes.
-- Date: 2026-08-26
--
-- WARNING: Run this ONLY if you need to revert the migration.
-- This will remove the sequence, functions, RLS policies, and
-- permission grants. Invoice numbers will revert to TypeScript
-- generation (app-level max query).
-- ============================================================

-- Drop RLS policies on invoice_items (safe: created by migration 004)
DROP POLICY IF EXISTS "staff_select_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_insert_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_update_invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "staff_delete_invoice_items" ON public.invoice_items;

-- Drop functions (safe: created by migration 004, not by 001/002/003)
DROP FUNCTION IF EXISTS public.create_invoice(uuid, uuid, uuid, numeric, numeric, text, jsonb);
DROP FUNCTION IF EXISTS public.update_invoice(uuid, numeric, numeric, text, jsonb);
DROP FUNCTION IF EXISTS public.generate_invoice_number();

-- Drop sequence (safe: created by migration 004, not by 001/002/003)
DROP SEQUENCE IF EXISTS public.invoice_number_seq;

-- Verify rollback: invoice_items should have no policies (default deny)
SELECT policyname FROM pg_policies
WHERE tablename = 'invoice_items' AND schemaname = 'public';
-- Expected: 0 rows

-- Verify functions removed
SELECT proname FROM pg_proc
WHERE proname IN ('generate_invoice_number', 'create_invoice', 'update_invoice')
  AND pronamespace = 'public'::regnamespace;
-- Expected: 0 rows

-- Verify sequence removed
SELECT sequencename FROM pg_sequences WHERE sequencename = 'invoice_number_seq';
-- Expected: 0 rows
