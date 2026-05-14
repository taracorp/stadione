-- Hardening baseline permission for canonical roles.
-- Safe to run multiple times.

BEGIN;

-- If venue_partner has no permission yet, copy tournament_host permissions as baseline workspace capability.
INSERT INTO role_permissions (role, permission)
SELECT 'venue_partner', source.permission
FROM role_permissions source
WHERE source.role = 'tournament_host'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions target
    WHERE target.role = 'venue_partner'
  )
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;

BEGIN;

-- If assistant_referee has no permission yet, copy from referee baseline.
INSERT INTO role_permissions (role, permission)
SELECT 'assistant_referee', source.permission
FROM role_permissions source
WHERE source.role = 'referee'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions target
    WHERE target.role = 'assistant_referee'
  )
ON CONFLICT (role, permission) DO NOTHING;

-- If timekeeper has no permission yet, copy from statistic_operator baseline.
INSERT INTO role_permissions (role, permission)
SELECT 'timekeeper', source.permission
FROM role_permissions source
WHERE source.role = 'statistic_operator'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions target
    WHERE target.role = 'timekeeper'
  )
ON CONFLICT (role, permission) DO NOTHING;

-- If member/fans/supporter have no permission yet, use player read baseline.
INSERT INTO role_permissions (role, permission)
SELECT target_role.role, source.permission
FROM (VALUES ('member'), ('fans'), ('supporter')) AS target_role(role)
CROSS JOIN role_permissions source
WHERE source.role = 'player'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions target
    WHERE target.role = target_role.role
  )
ON CONFLICT (role, permission) DO NOTHING;

-- Add explicit modern permissions for canonical platform roles used by permission-first page gates.
INSERT INTO role_permissions (role, permission)
VALUES
  ('moderator', 'users.moderate'),
  ('platform_admin', 'users.moderate'),
  ('platform_admin', 'analytics.global.read'),
  ('platform_admin', 'operator.verify')
ON CONFLICT (role, permission) DO NOTHING;

COMMIT;
