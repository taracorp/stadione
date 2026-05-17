-- Smoke checks for super-admin user moderation and permanent delete rollout.
-- Run after scripts/rollout-super-admin-user-actions.sql in Supabase SQL Editor.

-- 1) Verify the moderation table now stores disable expiry.
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_moderation'
  AND column_name IN ('is_blocked', 'is_disabled', 'disabled_until', 'moderation_reason')
ORDER BY ordinal_position;

-- 2) Verify old moderation RPC signature is removed.
SELECT
  COALESCE(to_regprocedure('public.admin_set_user_moderation(uuid, boolean, boolean, text)')::text, 'missing') AS old_signature,
  COALESCE(to_regprocedure('public.admin_set_user_moderation(uuid, boolean, boolean, integer, text)')::text, 'missing') AS new_signature;

-- 3) Verify new moderation RPC contains timed disable logic.
SELECT
  CASE
    WHEN pg_get_functiondef('public.admin_set_user_moderation(uuid,boolean,boolean,integer,text)'::regprocedure) LIKE '%make_interval(hours => p_disabled_hours)%'
    THEN 'OK: timed disable logic detected'
    ELSE 'CHECK: timed disable logic missing'
  END AS moderation_duration_check;

-- 4) Verify permanent delete RPC exists and contains auth.users delete.
SELECT
  CASE
    WHEN pg_get_functiondef('public.admin_delete_user_account(uuid)'::regprocedure) LIKE '%DELETE FROM auth.users WHERE id = p_user_id%'
    THEN 'OK: permanent delete logic detected'
    ELSE 'CHECK: permanent delete logic missing'
  END AS delete_rpc_check;

-- 5) Verify list RPC returns the expected moderation columns without invoking auth-gated logic.
SELECT
  pg_get_function_result('public.admin_list_users(text,integer,integer)'::regprocedure) AS list_users_return_type,
  CASE
    WHEN pg_get_function_result('public.admin_list_users(text,integer,integer)'::regprocedure) LIKE '%disabled_until timestamp with time zone%'
    THEN 'OK: list RPC return type includes disabled_until'
    ELSE 'CHECK: list RPC return type missing disabled_until'
  END AS list_users_signature_check;