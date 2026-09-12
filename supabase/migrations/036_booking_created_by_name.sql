-- ============================================================
-- Track who created each booking (display name snapshot)
-- ============================================================
-- bookings.created_by (uuid -> auth.users) already exists.
-- This adds created_by_name so the UI can show who created a
-- booking without extra joins (snapshot at creation time).
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS created_by_name text;