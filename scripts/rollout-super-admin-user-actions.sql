-- Production rollout for compact super-admin user actions.
-- Applies indefinite block, timed disable, and permanent delete RPCs.
-- Safe to run in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_moderation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_blocked boolean NOT NULL DEFAULT false,
  is_disabled boolean NOT NULL DEFAULT false,
  disabled_until timestamptz,
  moderation_reason text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_moderation
  ADD COLUMN IF NOT EXISTS disabled_until timestamptz;

ALTER TABLE public.user_moderation ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_moderation'
      AND policyname = 'Users can read own moderation status'
  ) THEN
    CREATE POLICY "Users can read own moderation status"
      ON public.user_moderation
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_moderation'
      AND policyname = 'Admins can manage moderation status'
  ) THEN
    CREATE POLICY "Admins can manage moderation status"
      ON public.user_moderation
      FOR ALL
      USING (public.has_app_role('super_admin') OR public.has_permission('users.moderate'))
      WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.moderate'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.admin_set_user_moderation(uuid, boolean, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  roles text[],
  is_blocked boolean,
  is_disabled boolean,
  disabled_until timestamptz,
  moderation_reason text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  safe_limit integer;
BEGIN
  IF NOT (public.has_app_role('super_admin') OR public.has_permission('users.role.manage') OR public.has_permission('users.moderate')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  safe_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    COALESCE(NULLIF(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email::text, '@', 1)) AS full_name,
    COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles,
    COALESCE(um.is_blocked, false) AS is_blocked,
    COALESCE(um.is_disabled, false) AND (um.disabled_until IS NULL OR um.disabled_until > now()) AS is_disabled,
    um.disabled_until,
    um.moderation_reason,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.user_moderation um ON um.user_id = u.id
  WHERE (
    p_search IS NULL
    OR trim(p_search) = ''
    OR u.email ILIKE ('%' || trim(p_search) || '%')
    OR COALESCE(u.raw_user_meta_data->>'name', '') ILIKE ('%' || trim(p_search) || '%')
  )
  GROUP BY u.id, u.email, u.raw_user_meta_data, um.is_blocked, um.is_disabled, um.disabled_until, um.moderation_reason, u.created_at, u.last_sign_in_at
  ORDER BY u.created_at DESC
  LIMIT safe_limit OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_moderation(
  p_user_id uuid,
  p_is_blocked boolean,
  p_is_disabled boolean DEFAULT false,
  p_disabled_hours integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_disabled_until timestamptz := NULL;
BEGIN
  IF NOT (public.has_app_role('super_admin') OR public.has_permission('users.moderate')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

  IF COALESCE(p_is_disabled, false) THEN
    IF COALESCE(p_disabled_hours, 0) <= 0 THEN
      RAISE EXCEPTION 'Invalid disabled duration';
    END IF;

    v_disabled_until := now() + make_interval(hours => p_disabled_hours);
  END IF;

  INSERT INTO public.user_moderation (
    user_id,
    is_blocked,
    is_disabled,
    disabled_until,
    moderation_reason,
    updated_by,
    updated_at
  ) VALUES (
    p_user_id,
    COALESCE(p_is_blocked, false),
    COALESCE(p_is_disabled, false),
    v_disabled_until,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    auth.uid(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET is_blocked = EXCLUDED.is_blocked,
      is_disabled = EXCLUDED.is_disabled,
      disabled_until = EXCLUDED.disabled_until,
      moderation_reason = EXCLUDED.moderation_reason,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_account(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.has_app_role('super_admin') OR public.has_permission('users.moderate')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user id';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.admin_audit_logs WHERE actor_user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.tournament_operator_verification_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.tournament_operator_verification_requests WHERE requester_user_id = $1::text OR reviewed_by = $1::text' USING p_user_id;
  END IF;

  IF to_regclass('public.active_workspace_context') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.active_workspace_context WHERE user_id = $1 OR switched_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.active_workspace_context_history') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.active_workspace_context_history WHERE user_id = $1 OR switched_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_staff_audit_log') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_staff_audit_log WHERE target_user_id = $1 OR action_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_verification') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_verification WHERE submitted_by = $1 OR reviewed_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_staff') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_staff WHERE user_id = $1 OR invited_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_bookings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_bookings WHERE created_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venues') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'owner_user_id'
  ) THEN
    EXECUTE 'DELETE FROM public.venues WHERE owner_user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.training_workspace_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.training_workspace_members WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.training_parent_links') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.training_parent_links WHERE parent_user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.training_athlete_reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.training_athlete_reports WHERE created_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.training_athletes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.training_athletes WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.training_coaches') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.training_coaches WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.training_academies') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.training_academies WHERE owner_user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.news') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'news'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE 'DELETE FROM public.news WHERE created_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_activity_log') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_activity_log WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_training_enrollments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_training_enrollments WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_community_memberships_log') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_community_memberships_log WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_tournament_participations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_tournament_participations WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_articles_read') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_articles_read WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_venue_bookings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_venue_bookings WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_moderation') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_moderation WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_roles WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.profiles WHERE id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.academy_trial_bookings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.academy_trial_bookings WHERE user_id = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_refunds') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_refunds WHERE requested_by = $1 OR approved_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_payments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_payments WHERE processed_by = $1' USING p_user_id;
  END IF;

  IF to_regclass('public.venue_shifts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.venue_shifts WHERE cashier_id = $1' USING p_user_id;
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_moderation(uuid, boolean, boolean, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_account(uuid) TO authenticated;

COMMIT;