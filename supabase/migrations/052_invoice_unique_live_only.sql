BEGIN;

DROP INDEX IF EXISTS public.invoices_booking_id_unique;

CREATE UNIQUE INDEX invoices_booking_id_unique
  ON public.invoices (booking_id)
  WHERE booking_id IS NOT NULL
    AND status IN ('draft', 'issued', 'partially_paid', 'paid');

COMMIT;
