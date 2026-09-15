-- 039: Enforce one invoice per booking at the database level.
-- Currently the only guard is in application code (ensureDraftInvoiceForBooking),
-- so two invoices for the same booking_id are technically possible at the DB level.
-- This migration:
--   1) De-duplicates any existing duplicates (keeps the newest invoice).
--   2) Adds a partial UNIQUE index on invoices(booking_id) WHERE booking_id IS NOT NULL.
--   3) Re-enforces the same uniqueness for the auto-created draft path.

-- Clean up any pre-existing duplicates (keep the most recently created invoice).
DELETE FROM public.invoice_items i
USING public.invoices inv
WHERE i.invoice_id = inv.id
  AND inv.booking_id IS NOT NULL
  AND inv.id NOT IN (
    SELECT DISTINCT ON (booking_id) id
    FROM public.invoices
    WHERE booking_id IS NOT NULL
    ORDER BY booking_id, created_at DESC
  );

DELETE FROM public.payments p
USING public.invoices inv
WHERE p.invoice_id = inv.id
  AND inv.booking_id IS NOT NULL
  AND inv.id NOT IN (
    SELECT DISTINCT ON (booking_id) id
    FROM public.invoices
    WHERE booking_id IS NOT NULL
    ORDER BY booking_id, created_at DESC
  );

DELETE FROM public.invoices inv
WHERE inv.booking_id IS NOT NULL
  AND inv.id NOT IN (
    SELECT DISTINCT ON (booking_id) id
    FROM public.invoices
    WHERE booking_id IS NOT NULL
    ORDER BY booking_id, created_at DESC
  );

-- The hard guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_booking_id_unique
  ON public.invoices (booking_id)
  WHERE booking_id IS NOT NULL;
