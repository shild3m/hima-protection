-- Freeze the service name on bookings so later renames don't alter old bookings.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_name_snapshot text;

-- Backfill existing bookings with the current service name.
UPDATE public.bookings b
SET service_name_snapshot = s.name
FROM public.services s
WHERE b.service_id = s.id
  AND (b.service_name_snapshot IS NULL OR b.service_name_snapshot = '');