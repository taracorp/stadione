-- Sync role vocabulary to unified naming while preserving legacy compatibility.
-- Safe to run multiple times.

BEGIN;

-- 1) Canonical roles for new governance vocabulary.
INSERT INTO app_roles (role, display_name, description, parent_role, hierarchy_level, scope_type, is_system)
VALUES
  ('platform_admin', 'Platform Admin', 'Platform operations and governance administrator', 'super_admin', 5, 'platform', true),
  ('moderator', 'Moderator', 'Community and content moderation role', 'platform_admin', 4, 'platform', true),
  ('reporter', 'Reporter', 'Newsroom author and publisher role', 'platform_admin', 4, 'platform', true),
  ('tournament_host', 'Tournament Host', 'Tournament workspace owner role', 'verified_operator', 3, 'operator', true),
  ('venue_partner', 'Venue Partner', 'Venue/EO workspace partner role', 'verified_operator', 3, 'operator', true),
  ('assistant_referee', 'Assistant Referee', 'Supporting match official role', 'match_official', 2, 'match', true),
  ('timekeeper', 'Timekeeper', 'Match timing and clock operations role', 'match_official', 2, 'match', true),
  ('member', 'Member', 'Registered user role', 'general_user', 1, 'platform', true),
  ('fans', 'Fans', 'Supporter/follower role for engagement', 'general_user', 1, 'platform', true),
  ('supporter', 'Supporter', 'Supporter role for club and community activity', 'general_user', 1, 'platform', true)
ON CONFLICT (role) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  parent_role = EXCLUDED.parent_role,
  hierarchy_level = EXCLUDED.hierarchy_level,
  scope_type = EXCLUDED.scope_type,
  is_system = EXCLUDED.is_system;

-- 2) Align legacy display names with unified product vocabulary.
UPDATE app_roles
SET display_name = 'Platform Admin'
WHERE role = 'internal_admin';

UPDATE app_roles
SET display_name = 'Moderator'
WHERE role IN ('admin', 'reviewer');

UPDATE app_roles
SET display_name = 'Reporter'
WHERE role = 'news_reporter_admin';

UPDATE app_roles
SET display_name = 'Tournament Host'
WHERE role = 'tournament_host_admin';

UPDATE app_roles
SET display_name = 'Venue Partner'
WHERE role = 'eo_operator';

UPDATE app_roles
SET display_name = 'Member'
WHERE role = 'general_user';

-- 3) Copy permission matrices from legacy roles into canonical roles.
INSERT INTO role_permissions (role, permission)
SELECT 'platform_admin', permission
FROM role_permissions
WHERE role = 'internal_admin'
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO role_permissions (role, permission)
SELECT 'moderator', permission
FROM role_permissions
WHERE role IN ('admin', 'reviewer')
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO role_permissions (role, permission)
SELECT 'reporter', permission
FROM role_permissions
WHERE role = 'news_reporter_admin'
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO role_permissions (role, permission)
SELECT 'tournament_host', permission
FROM role_permissions
WHERE role = 'tournament_host_admin'
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO role_permissions (role, permission)
SELECT 'venue_partner', permission
FROM role_permissions
WHERE role = 'eo_operator'
ON CONFLICT (role, permission) DO NOTHING;

-- 4) Optional compatibility grants: users keep access when UI switches to canonical roles.
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'platform_admin'
FROM user_roles
WHERE role = 'internal_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'moderator'
FROM user_roles
WHERE role IN ('admin', 'reviewer')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'reporter'
FROM user_roles
WHERE role = 'news_reporter_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'tournament_host'
FROM user_roles
WHERE role = 'tournament_host_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'venue_partner'
FROM user_roles
WHERE role = 'eo_operator'
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
