-- ============================================================
-- PHASE 24 BATCH 2B-1: Notification RPC Authorization
-- ============================================================
-- Adds auth.uid() check inside RPC functions.
-- Removes unnecessary service_role GRANT.
-- Defense-in-depth: Server Action + RPC both enforce auth.
-- ============================================================

-- ============================================================
-- create_notification: Add auth check
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id    uuid,
  p_type       text,
  p_title      text,
  p_message    text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_id uuid;
  v_has_manage boolean;
BEGIN
  -- Auth check: caller must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Authorization check: caller must have notifications:manage
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.role_permissions rp ON rp.role_id = s.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE s.user_id = v_caller_id
      AND s.is_active = true
      AND p.resource = 'notifications'
      AND p.action = 'manage'
  ) INTO v_has_manage;

  IF NOT v_has_manage THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is required');
  END IF;

  IF p_type IS NULL OR p_type = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'type is required');
  END IF;

  IF p_title IS NULL OR p_title = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'title is required');
  END IF;

  -- Idempotency: if same type+reference+user exists within 5 minutes, skip
  IF p_reference_type IS NOT NULL AND p_reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = p_type
        AND reference_type = p_reference_type
        AND reference_id = p_reference_id
        AND user_id = p_user_id
        AND created_at > now() - interval '5 minutes'
    ) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, reference_type, reference_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_reference_type, p_reference_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- ============================================================
-- create_notifications_for_role: Add auth check
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notifications_for_role(
  p_resource    text,
  p_action      text,
  p_type        text,
  p_title       text,
  p_message     text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id   uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_count integer := 0;
  v_row   record;
  v_has_manage boolean;
BEGIN
  -- Auth check: caller must be authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Authorization check: caller must have notifications:manage
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN public.role_permissions rp ON rp.role_id = s.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE s.user_id = v_caller_id
      AND s.is_active = true
      AND p.resource = 'notifications'
      AND p.action = 'manage'
  ) INTO v_has_manage;

  IF NOT v_has_manage THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  FOR v_row IN
    SELECT DISTINCT s.user_id
    FROM public.staff s
    WHERE s.is_active = true
      AND s.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = s.role_id
          AND p.resource = p_resource
          AND p.action = p_action
      )
  LOOP
    PERFORM public.create_notification(
      v_row.user_id, p_type, p_title, p_message,
      p_reference_type, p_reference_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- Remove unnecessary service_role GRANTs
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.create_notifications_for_role(text, text, text, text, text, text, uuid) FROM service_role;
