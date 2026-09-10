-- ============================================================
-- PHASE: Secure Delete Token
-- Store hashed delete tokens in DB (raw token NEVER stored).
-- Super admin can change tokens from the admin panel.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/write system_settings
CREATE POLICY "super_admin_all_system_settings"
  ON public.system_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = true
    )
  );

-- Insert default booking delete secret (SHA-256 of a random token)
-- The raw token is: 6497a8f8da3d6bec0e015f5a1c4b9727a7d8327c75060b502c013de1e3370d6f
-- This is the pre-computed SHA-256 hash of that token.
INSERT INTO public.system_settings (key, value)
VALUES (
  'booking_delete_secret',
  '7f2a7ba5bcf48ff19dd1aadf62e3e439dfa2512cdf8c41d3e569afe94e0b06cd'
)
ON CONFLICT (key) DO NOTHING;
