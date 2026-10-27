-- ============================================================
-- 043: Performance indexes for the admin panel hot paths
-- ============================================================
-- Every admin screen orders by `created_at DESC` (or `updated_at`) and filters
-- by `is_active`; without these indexes Postgres falls back to a full scan +
-- sort on each page load. All statements are idempotent.
-- ============================================================

-- ── Customers: list page + CRM ordering ─────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_created_at
  ON public.customers(created_at DESC);

-- ── Materials: paged list ordered by created_at ─────────────
CREATE INDEX IF NOT EXISTS idx_materials_created_at
  ON public.materials(created_at DESC);

-- Materials dropdown: filter is_active + order by name
CREATE INDEX IF NOT EXISTS idx_materials_active_name
  ON public.materials(is_active, name);

-- ── Suppliers: paged list ordered by created_at ─────────────
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at
  ON public.suppliers(created_at DESC);

-- Suppliers dropdown: filter is_active + order by name
CREATE INDEX IF NOT EXISTS idx_suppliers_active_name
  ON public.suppliers(is_active, name);

-- ── Purchases: paged list ordered by created_at ─────────────
CREATE INDEX IF NOT EXISTS idx_purchases_created_at
  ON public.purchases(created_at DESC);

-- ── Invoices: dashboard / reports ordered by updated_at ─────
CREATE INDEX IF NOT EXISTS idx_invoices_updated_at
  ON public.invoices(updated_at DESC);

-- ── Inventory: per-material movement history ────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_material_created
  ON public.inventory_transactions(material_id, created_at DESC);

-- ── Services: public + admin ordered list ───────────────────
CREATE INDEX IF NOT EXISTS idx_services_active_order
  ON public.services(is_active, display_order);

-- ── Notifications: per-user unread/created feed ─────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- Refresh planner statistics so the new indexes are picked up immediately.
ANALYZE public.customers;
ANALYZE public.materials;
ANALYZE public.suppliers;
ANALYZE public.purchases;
ANALYZE public.invoices;
ANALYZE public.inventory_transactions;
ANALYZE public.services;
ANALYZE public.notifications;
