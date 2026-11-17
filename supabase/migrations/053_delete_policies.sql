-- ============================================================
-- 053: Missing RLS DELETE policies (silent delete failure)
-- ============================================================
-- Symptom : the UI reports "تم الحذف" while 0 rows are removed.
-- Cause   : RLS has SELECT/INSERT/UPDATE policies but no DELETE policy,
--           and PostgREST answers "0 rows, no error" instead of 42501,
--           so the server action sees `error === null` and reports success
--           (and even writes an `*_deleted` audit row).
-- Evidence: audit_logs contains expense_deleted entries while the
--           expense row still exists.
--
-- Scope   : only tables deleted through the *user-scoped* client
--           (requireAuth() + createClient()). Verified in code:
--             - expenses   -> createClient()      => needs DELETE policy
--             - materials  -> createClient()      => needs DELETE policy
--             - service_materials, bookings, customers, invoices, payments,
--               vehicles, offers, notifications, booking_status_history
--               -> getSupabaseAdmin() (service role, bypasses RLS)
--             - customer_notes -> already covered by 010_crm_rls.sql
--
-- Safe to re-run: every statement is idempotent.
-- Deletes NO data: this file only adds policy definitions.
-- ============================================================

-- 1) expenses — accountant/admin with expenses:delete
DROP POLICY IF EXISTS "staff_delete_expenses" ON public.expenses;
CREATE POLICY "staff_delete_expenses"
  ON public.expenses FOR DELETE
  USING (public.has_permission(auth.uid(), 'expenses', 'delete'));

-- 2) materials — inventory_manager/admin with materials:delete
DROP POLICY IF EXISTS "staff_delete_materials" ON public.materials;
CREATE POLICY "staff_delete_materials"
  ON public.materials FOR DELETE
  USING (public.has_permission(auth.uid(), 'materials', 'delete'));

-- ============================================================
-- Verification (run after the statements above)
-- Expected: exactly 2 rows
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname IN ('staff_delete_expenses', 'staff_delete_materials')
-- ORDER BY tablename;
