-- ============================================================
-- PHASE 24 BATCH 2B-4: M11 — Commissions RLS Dealer Isolation
-- ============================================================
-- ROOT CAUSE: The dealer role has 'commissions:read' permission,
-- which triggers the 'staff_select_all_commissions' RLS policy.
-- RLS policies are OR-ed, so this grants ALL dealers access to
-- ALL commissions, bypassing the 'dealer_select_own_commissions'
-- policy entirely.
--
-- FIX: Remove 'commissions:read' from the dealer role.
-- This makes staff_select_all_commissions NOT match for dealers,
-- so only dealer_select_own_commissions applies (dealer_id = get_dealer_id(auth.uid())).
--
-- Impact:
-- - getMyCommissions: unaffected (no permission check, uses dealer_id filter)
-- - getMyCommissionStats: unaffected (no permission check, uses dealer_id filter)
-- - getCommissions: unaffected (admin/staff only, requires commissions:read)
-- - staff_select_all_commissions: still works for staff with commissions:read
-- ============================================================

-- Remove commissions:read from dealer role
DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE name = 'dealer')
  AND permission_id = (
    SELECT id FROM public.permissions
    WHERE resource = 'commissions' AND action = 'read'
  );
