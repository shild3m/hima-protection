-- Migration 012: Add missing RLS policies for dealers table
--
-- Context:
--   The dealers table already exists with SELECT policies:
--   - dealer_select_own: dealer can see own row (user_id = auth.uid())
--   - staff_select_all_dealers: staff with dealers.read can see all
--
--   Missing: INSERT/UPDATE/DELETE policies for admin management.
--   Without INSERT policy, admins cannot create dealers via the application.
--   UPDATE/DELETE have no restrictive policy, so they work for authenticated users.

-- Admin/Staff can INSERT dealers
DROP POLICY IF EXISTS "staff_insert_dealers" ON public.dealers;
CREATE POLICY "staff_insert_dealers"
  ON public.dealers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'dealers', 'create'));

-- Admin/Staff can UPDATE dealers
DROP POLICY IF EXISTS "staff_update_dealers" ON public.dealers;
CREATE POLICY "staff_update_dealers"
  ON public.dealers FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'dealers', 'update'));

-- Admin/Staff can DELETE dealers
DROP POLICY IF EXISTS "staff_delete_dealers" ON public.dealers;
CREATE POLICY "staff_delete_dealers"
  ON public.dealers FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'dealers', 'delete'));
