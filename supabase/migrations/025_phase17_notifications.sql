-- ============================================================
-- PHASE 17: NOTIFICATION SYSTEM
-- Migration 025: create_notification function + idempotency
--
-- SAFETY:
-- - CREATE OR REPLACE (idempotent)
-- - Does NOT modify existing tables or columns
-- - Does NOT weaken existing RLS
-- - Additive only
-- ============================================================

-- Idempotency index: prevent duplicate notifications for same event
CREATE INDEX IF NOT EXISTS idx_notifications_event_dedup
  ON public.notifications(type, reference_type, reference_id, user_id);

-- ============================================================
-- create_notification: SECURITY DEFINER function
-- Called by business logic to create notifications atomically
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
  v_id uuid;
BEGIN
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
-- create_notifications_for_role: Broadcast to all users with a permission
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
  v_count integer := 0;
  v_row   record;
BEGIN
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
-- mark_notification_read: Mark single notification as read
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_notif     record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_notif FROM public.notifications WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Notification not found');
  END IF;

  IF v_notif.user_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  UPDATE public.notifications
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id AND is_read = false;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- mark_all_notifications_read: Mark all user's notifications as read
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_count     integer;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.notifications
  SET is_read = true, read_at = now()
  WHERE user_id = v_caller_id AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_notifications_for_role(text, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_notifications_for_role(text, text, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notifications_for_role(text, text, text, text, text, text, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.create_notifications_for_role(text, text, text, text, text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM public;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM anon;
