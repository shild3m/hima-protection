-- Soft delete (archive) for services.
-- Archiving hides a service from the admin list and the public site while keeping
-- every related booking, invoice, commission, and report row untouched.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_services_archived_at
  ON public.services (archived_at);
