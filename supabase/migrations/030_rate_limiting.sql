-- ============================================================
-- PHASE 24 BATCH 2A: Rate Limiting (Final Design v3)
-- ============================================================
-- Fixed Window, atomic UPSERT, auth.uid() identity.
-- SECURITY DEFINER. RLS denied for all direct access.
-- Server-controlled allowlist: caller passes action only.
-- Window/max are hardcoded per action inside this function.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_window_idx
  ON public.rate_limits (key, window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limits_deny_all ON public.rate_limits
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_key text;
  v_window_seconds int;
  v_max_requests int;
  v_window_start timestamptz;
  v_new_count int;
  v_allowed boolean;
BEGIN
  -- 1. Identity: auth.uid() only
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for rate limiting';
  END IF;

  -- 2. Validate action name
  IF p_action IS NULL OR length(p_action) = 0 OR length(p_action) > 100 THEN
    RAISE EXCEPTION 'Invalid action name';
  END IF;

  -- 3. Server-controlled allowlist: window/max determined by action
  CASE p_action
    WHEN 'staff:create'      THEN v_window_seconds := 60;  v_max_requests := 10;
    WHEN 'staff:update'      THEN v_window_seconds := 60;  v_max_requests := 10;
    WHEN 'bookings:update'   THEN v_window_seconds := 60;  v_max_requests := 30;
    WHEN 'invoices:create'   THEN v_window_seconds := 60;  v_max_requests := 15;
    WHEN 'invoices:update'   THEN v_window_seconds := 60;  v_max_requests := 15;
    WHEN 'payments:create'   THEN v_window_seconds := 60;  v_max_requests := 10;
    WHEN 'purchases:create'  THEN v_window_seconds := 60;  v_max_requests := 10;
    WHEN 'purchases:update'  THEN v_window_seconds := 60;  v_max_requests := 10;
    WHEN 'materials:create'  THEN v_window_seconds := 60;  v_max_requests := 15;
    WHEN 'materials:update'  THEN v_window_seconds := 60;  v_max_requests := 15;
    ELSE
      RAISE EXCEPTION 'Unknown rate limit action: %', p_action;
  END CASE;

  -- 4. Build key: action + user identity
  v_key := p_action || ':' || v_user_id::text;

  -- 5. Fixed window aligned to epoch
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / v_window_seconds) * v_window_seconds
  );

  -- 6. Atomic UPSERT
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (v_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_new_count;

  v_allowed := (v_new_count <= v_max_requests);

  -- 7. Cleanup: bounded delete of own expired windows (max 10 rows)
  DELETE FROM public.rate_limits
  WHERE id IN (
    SELECT id FROM public.rate_limits
    WHERE key = v_key
      AND window_start < now() - (v_window_seconds * 3 || ' seconds')::interval
    LIMIT 10
  );

  -- 8. Return result
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current', v_new_count,
    'limit', v_max_requests
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text) TO authenticated;
REVOKE ALL ON FUNCTION public.check_rate_limit(text) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(text) FROM public;
