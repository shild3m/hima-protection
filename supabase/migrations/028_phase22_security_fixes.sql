-- ============================================================
-- PHASE 22: Security & Integrity Fixes (FINAL)
-- ============================================================
-- Reviewed and adjusted per security audit findings.
-- Idempotent: uses DROP IF EXISTS before CREATE.
-- Dashboard functions are guarded with existence checks.
--
-- Sections:
--   C7:   RLS on RBAC tables (roles, permissions, role_permissions)
--   C8:   Dashboard functions security (search_path + REVOKE/GRANT)
--   C10:  DROP get_app_test_ids (test helper, not needed in production)
--   H12:  Commission rules dealer isolation
--   DB1:  Commission status state machine trigger
--   DB2:  Booking slot uniqueness (partial unique index)
--   DB3:  Invoice status state machine trigger
-- ============================================================


-- ============================================================
-- C7: ENABLE RLS ON RBAC TABLES
-- ============================================================

-- roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_select_roles ON public.roles;
CREATE POLICY "admin_select_roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles', 'read')
    OR public.has_permission(auth.uid(), 'staff', 'read')
  );

-- permissions table
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_select_permissions ON public.permissions;
CREATE POLICY "admin_select_permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles', 'read')
    OR public.has_permission(auth.uid(), 'staff', 'read')
  );

-- role_permissions table
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_select_role_permissions ON public.role_permissions;
CREATE POLICY "admin_select_role_permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles', 'read')
    OR public.has_permission(auth.uid(), 'staff', 'read')
  );


-- ============================================================
-- C8: SECURE DASHBOARD FUNCTIONS
-- ============================================================
-- Each function is guarded: only ALTER/REVOKE/GRANT if it exists.
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_revenue_month' AND pronargs = 1) THEN
    ALTER FUNCTION public.dashboard_revenue_month(timestamptz) SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_revenue_month(timestamptz) FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_revenue_month(timestamptz) TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_pending_payments' AND pronargs = 0) THEN
    ALTER FUNCTION public.dashboard_pending_payments() SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_pending_payments() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_pending_payments() TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_pending_commissions' AND pronargs = 0) THEN
    ALTER FUNCTION public.dashboard_pending_commissions() SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_pending_commissions() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_pending_commissions() TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_bookings_by_status' AND pronargs = 1) THEN
    ALTER FUNCTION public.dashboard_bookings_by_status(date) SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_bookings_by_status(date) FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_bookings_by_status(date) TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_revenue_chart' AND pronargs = 2) THEN
    ALTER FUNCTION public.dashboard_revenue_chart(date, date) SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_revenue_chart(date, date) FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_revenue_chart(date, date) TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_bookings_chart' AND pronargs = 2) THEN
    ALTER FUNCTION public.dashboard_bookings_chart(date, date) SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_bookings_chart(date, date) FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_bookings_chart(date, date) TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_services_chart' AND pronargs = 2) THEN
    ALTER FUNCTION public.dashboard_services_chart(date, date) SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_services_chart(date, date) FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_services_chart(date, date) TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_dealer_performance' AND pronargs = 0) THEN
    ALTER FUNCTION public.dashboard_dealer_performance() SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_dealer_performance() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_dealer_performance() TO service_role;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dashboard_low_stock_count' AND pronargs = 0) THEN
    ALTER FUNCTION public.dashboard_low_stock_count() SET search_path = public;
    REVOKE ALL ON FUNCTION public.dashboard_low_stock_count() FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.dashboard_low_stock_count() TO service_role;
  END IF;
END $$;


-- ============================================================
-- C10: DROP get_app_test_ids
-- ============================================================

DROP FUNCTION IF EXISTS public.get_app_test_ids();


-- ============================================================
-- H12: COMMISSION RULES DEALER ISOLATION
-- ============================================================

DROP POLICY IF EXISTS "dealer_select_active_rules" ON public.commission_rules;

CREATE POLICY "dealer_select_active_rules"
  ON public.commission_rules FOR SELECT
  TO authenticated
  USING (
    is_active = true AND (
      dealer_id IS NULL
      OR dealer_id = public.get_dealer_id(auth.uid())
    )
  );


-- ============================================================
-- DB1: COMMISSION STATUS STATE MACHINE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_commission_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_transitions jsonb := '{
    "pending": ["approved", "cancelled"],
    "approved": ["paid", "cancelled"],
    "paid": [],
    "cancelled": []
  }'::jsonb;
  v_valid_statuses text[] := ARRAY['pending','approved','paid','cancelled'];
  v_new_status text := NEW.status;
  v_old_status text := OLD.status;
BEGIN
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF NOT (v_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid commission status: %', v_new_status;
  END IF;

  IF NOT (v_new_status IN (SELECT jsonb_array_elements_text(v_allowed_transitions -> v_old_status))) THEN
    RAISE EXCEPTION 'Commission status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_commission_status ON public.commissions;
CREATE TRIGGER enforce_commission_status
  BEFORE UPDATE OF status ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_status_transition();


-- ============================================================
-- DB3: INVOICE STATUS STATE MACHINE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_transitions jsonb := '{
    "draft": ["issued", "cancelled"],
    "issued": ["partially_paid", "paid", "cancelled"],
    "partially_paid": ["paid", "refunded"],
    "paid": ["refunded"],
    "cancelled": [],
    "refunded": []
  }'::jsonb;
  v_valid_statuses text[] := ARRAY['draft','issued','partially_paid','paid','cancelled','refunded'];
  v_new_status text := NEW.status;
  v_old_status text := OLD.status;
BEGIN
  IF v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  IF NOT (v_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid invoice status: %', v_new_status;
  END IF;

  IF NOT (v_new_status IN (SELECT jsonb_array_elements_text(v_allowed_transitions -> v_old_status))) THEN
    RAISE EXCEPTION 'Invoice status transition from % to % is not allowed', v_old_status, v_new_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invoice_status ON public.invoices;
CREATE TRIGGER enforce_invoice_status
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_status_transition();


-- ============================================================
-- DB2: BOOKING SLOT UNIQUENESS
-- ============================================================

DROP INDEX IF EXISTS uniq_booking_active_slot;
CREATE UNIQUE INDEX uniq_booking_active_slot
  ON public.bookings (service_id, preferred_date, preferred_time)
  WHERE status NOT IN ('cancelled', 'no_show');
