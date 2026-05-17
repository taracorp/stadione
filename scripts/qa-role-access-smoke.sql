-- QA smoke queries for role and permission based page access.
-- Run in Supabase SQL Editor.

-- 1) Role and permission snapshot for a specific user.
-- Replace the email value as needed.
WITH target_user AS (
  SELECT id, email
  FROM auth.users
  WHERE email = 'taradfworkspace@gmail.com'
  LIMIT 1
)
SELECT
  tu.email,
  ur.role,
  COALESCE(array_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL), ARRAY[]::text[]) AS permissions
FROM target_user tu
LEFT JOIN user_roles ur ON ur.user_id = tu.id
LEFT JOIN role_permissions rp ON rp.role = ur.role
GROUP BY tu.email, ur.role
ORDER BY ur.role;

-- 2) Canonical role permission matrix snapshot.
WITH canonical_roles AS (
  SELECT unnest(ARRAY[
    'platform_admin',
    'moderator',
    'reporter',
    'tournament_host',
    'venue_partner',
    'assistant_referee',
    'timekeeper',
    'member',
    'fans',
    'supporter'
  ]) AS role
)
SELECT
  cr.role,
  COUNT(rp.permission) AS permission_count,
  COALESCE(array_agg(rp.permission ORDER BY rp.permission) FILTER (WHERE rp.permission IS NOT NULL), ARRAY[]::text[]) AS permissions
FROM canonical_roles cr
LEFT JOIN role_permissions rp ON rp.role = cr.role
GROUP BY cr.role
ORDER BY cr.role;

-- 3) Permission gate readiness per page (permission-only perspective).
-- This complements app-side role fallback checks.
WITH page_requirements AS (
  SELECT * FROM (VALUES
    ('newsroom', 'news.create'),
    ('newsroom', 'news.edit'),
    ('newsroom', 'news.publish'),
    ('newsroom', 'news.feature'),
    ('moderation', 'users.moderate'),
    ('moderation', 'audit.read'),
    ('analytics', 'analytics.global.read'),
    ('analytics', 'audit.read'),
    ('analytics', 'payment.verify'),
    ('admin-verification-queue', 'operator.verify'),
    ('community-manager', 'tournament.create'),
    ('community-manager', 'tournament.edit'),
    ('sponsor-manager', 'tournament.sponsorship.manage'),
    ('tournament-manager', 'tournament.create'),
    ('tournament-manager', 'tournament.edit'),
    ('tournament-manager', 'tournament.schedule.manage'),
    ('tournament-manager', 'payment.verify'),
    ('tournament-manager', 'registration.approve'),
    ('tournament-manager', 'registration.reject'),
    ('training-manager', 'tournament.create'),
    ('training-manager', 'tournament.edit'),
    ('venue-manager', 'tournament.create'),
    ('venue-manager', 'tournament.edit')
  ) AS t(page_key, permission)
),
roles AS (
  SELECT unnest(ARRAY[
    'platform_admin',
    'moderator',
    'reporter',
    'tournament_host',
    'venue_partner',
    'assistant_referee',
    'timekeeper',
    'member',
    'fans',
    'supporter'
  ]) AS role
),
role_permission_hits AS (
  SELECT
    r.role,
    pr.page_key,
    COUNT(*) FILTER (WHERE rp.permission IS NOT NULL) AS matched_permissions
  FROM roles r
  CROSS JOIN page_requirements pr
  LEFT JOIN role_permissions rp
    ON rp.role = r.role
   AND rp.permission = pr.permission
  GROUP BY r.role, pr.page_key
)
SELECT
  role,
  page_key,
  matched_permissions,
  CASE WHEN matched_permissions > 0 THEN true ELSE false END AS permission_gate_ready
FROM role_permission_hits
ORDER BY role, page_key;

-- 4) Verify user creation RPC hardening (must be super_admin only).
SELECT
  CASE
    WHEN pg_get_functiondef('public.admin_create_user_account(text,text,text,text)'::regprocedure) LIKE '%IF NOT public.has_app_role(''super_admin'') THEN%'
    THEN 'OK: super_admin guard detected'
    ELSE 'CHECK: super_admin guard not detected'
  END AS admin_create_user_guard_status;
