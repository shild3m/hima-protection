-- ============================================================
-- 044: More performance indexes for admin list screens
-- ============================================================
-- These tables are paged/sorted on columns that had no index yet, so Postgres
-- had to scan the whole table and sort it on every request. Idempotent.
-- ============================================================

-- ── Staff / users list (ordered by created_at) ───────────────
CREATE INDEX IF NOT EXISTS idx_staff_created_at
  ON public.staff(created_at DESC);

-- ── Vehicles list (ordered by created_at) ────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at
  ON public.vehicles(created_at DESC);

-- ── Dealers list (sortable, defaults to created_at) ──────────
CREATE INDEX IF NOT EXISTS idx_dealers_created_at
  ON public.dealers(created_at DESC);

-- ── Commissions list + per-dealer drill-down ────────────────
CREATE INDEX IF NOT EXISTS idx_commissions_created_at
  ON public.commissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commissions_dealer_created
  ON public.commissions(dealer_id, created_at DESC);

-- ── Bookings: status filter + newest-first ordering ─────────
CREATE INDEX IF NOT EXISTS idx_bookings_status_created
  ON public.bookings(status, created_at DESC);

-- ── Invoices: status filter + newest-first ordering ─────────
CREATE INDEX IF NOT EXISTS idx_invoices_status_created
  ON public.invoices(status, created_at DESC);

-- ── Referrals: per-dealer drill-down ordered by date ────────
CREATE INDEX IF NOT EXISTS idx_referrals_dealer_created
  ON public.referrals(dealer_id, created_at DESC);

-- ── Invoices by customer (CRM customer page) ────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_customer_created
  ON public.invoices(customer_id, created_at DESC);

-- Refresh planner statistics so the new indexes are picked up immediately.
ANALYZE public.staff;
ANALYZE public.vehicles;
ANALYZE public.dealers;
ANALYZE public.commissions;
ANALYZE public.bookings;
ANALYZE public.invoices;
ANALYZE public.referrals;
