-- ============================================================
-- BOOKING WARRANTY
-- Purpose: Track warranty start & end dates per completed booking
-- Only super_admin / admin can modify via updateBookingWarranty action
-- ============================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS warranty_start_date date,
  ADD COLUMN IF NOT EXISTS warranty_end_date date;