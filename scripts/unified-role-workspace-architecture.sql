-- Unified Role and Workspace Architecture rollout
-- Safe to run multiple times.

BEGIN;

-- 1) Extend role metadata for lifecycle and modeling.
ALTER TABLE app_roles
ADD COLUMN IF NOT EXISTS role_domain text DEFAULT 'system';

ALTER TABLE app_roles
ADD COLUMN IF NOT EXISTS role_status text DEFAULT 'active';

ALTER TABLE app_roles
ADD COLUMN IF NOT EXISTS deprecated_by text;

-- 2) Ensure base canonical roles exist.
INSERT INTO app_roles (role, display_name, description, parent_role, hierarchy_level, scope_type, is_system, role_domain, role_status)
VALUES
  ('support_admin', 'Support Admin', 'Customer support and operations support role', 'platform_admin', 3, 'platform', true, 'system', 'active'),
  ('academy_operator', 'Academy Operator', 'Workspace operator for academy entities', 'verified_operator', 2, 'operator', true, 'workspace', 'active'),
  ('coach_operator', 'Coach Operator', 'Workspace operator for coach business/workspace', 'verified_operator', 2, 'operator', true, 'workspace', 'active'),
  ('sponsor_partner', 'Sponsor Partner', 'Workspace partner role for sponsor/brand entities', 'verified_operator', 2, 'operator', true, 'workspace', 'active'),
  ('lineup_operator', 'Lineup Operator', 'Official role focused on lineup and substitution operations', 'match_official', 2, 'match', true, 'activity', 'active'),
  ('team_member', 'Team Member', 'Contextual umbrella role for team-level assignments', 'team_role', 2, 'team', true, 'activity', 'active'),
  ('training_role', 'Training Role', 'Umbrella role for training and academy activity roles', 'super_admin', 1, 'training', true, 'activity', 'active'),
  ('academy_owner', 'Academy Owner', 'Owner role for academy operations', 'training_role', 2, 'training', true, 'activity', 'active'),
  ('academy_admin', 'Academy Admin', 'Admin role for academy operations', 'training_role', 2, 'training', true, 'activity', 'active'),
  ('trainer', 'Trainer', 'Trainer role in academy/training context', 'training_role', 2, 'training', true, 'activity', 'active'),
  ('athlete', 'Athlete', 'Athlete role in academy/training context', 'training_role', 2, 'training', true, 'activity', 'active'),
  ('parent', 'Parent', 'Parent/guardian role in academy context', 'training_role', 2, 'training', true, 'activity', 'active'),
  ('venue_role', 'Venue Role', 'Umbrella role for venue operations', 'verified_operator', 2, 'venue', true, 'workspace', 'active'),
  ('venue_owner', 'Venue Owner', 'Owner role for venue business and governance', 'venue_role', 3, 'venue', true, 'workspace', 'active'),
  ('venue_manager', 'Venue Manager', 'Manager role for daily venue operations', 'venue_role', 3, 'venue', true, 'workspace', 'active'),
  ('cashier', 'Cashier', 'Cashier role for point-of-sale operations', 'venue_role', 3, 'venue', true, 'workspace', 'active'),
  ('venue_staff', 'Venue Staff', 'Operational staff role in venue workspace', 'venue_role', 3, 'venue', true, 'workspace', 'active')
ON CONFLICT (role) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  parent_role = EXCLUDED.parent_role,
  hierarchy_level = EXCLUDED.hierarchy_level,
  scope_type = EXCLUDED.scope_type,
  is_system = EXCLUDED.is_system,
  role_domain = EXCLUDED.role_domain,
  role_status = EXCLUDED.role_status;

-- 3) Base role normalization: member is the default user role.
INSERT INTO app_roles (role, display_name, description, parent_role, hierarchy_level, scope_type, is_system, role_domain, role_status)
VALUES
  ('member', 'Member', 'Default user role for all registered accounts', NULL, 1, 'platform', true, 'system', 'active')
ON CONFLICT (role) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  role_domain = EXCLUDED.role_domain,
  role_status = EXCLUDED.role_status;

-- 4) Mark legacy roles as deprecated (do not delete yet).
UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'platform_admin'
WHERE role = 'internal_admin';

UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'moderator'
WHERE role = 'admin';

UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'reporter'
WHERE role = 'news_reporter_admin';

UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'verification_admin'
WHERE role = 'registration_admin';

UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'tournament_host'
WHERE role = 'eo_operator';

UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'tournament_host'
WHERE role = 'tournament_host_admin';

UPDATE app_roles
SET role_status = 'deprecated', deprecated_by = 'member'
WHERE role IN ('general_user', 'fans', 'supporter');

-- 5) Add or upsert permissions needed by new roles.
INSERT INTO app_permissions (permission, display_name, description, module)
VALUES
  ('support.tickets.manage', 'Manage Support Tickets', 'Manage and resolve customer support tickets', 'support'),
  ('support.user.assist', 'Assist User Account', 'Assist account-level support tasks', 'support'),
  ('workspace.members.manage', 'Manage Workspace Members', 'Manage workspace member assignments', 'workspace'),
  ('workspace.settings.manage', 'Manage Workspace Settings', 'Manage workspace-level settings', 'workspace'),
  ('lineup.manage', 'Manage Lineup', 'Create and update match lineup and substitutions', 'match'),
  ('training.program.manage', 'Manage Training Program', 'Create and manage academy/training programs', 'training'),
  ('training.roster.manage', 'Manage Training Roster', 'Assign and manage athlete roster in training', 'training'),
  ('venue.pos.manage', 'Manage Venue POS', 'Manage point-of-sale transactions and cashier flow', 'venue'),
  ('venue.staff.manage', 'Manage Venue Staff', 'Manage venue staff and scheduling', 'venue')
ON CONFLICT (permission) DO NOTHING;

-- 6) Grant baseline permissions for new canonical roles.
INSERT INTO role_permissions (role, permission)
VALUES
  ('support_admin', 'support.tickets.manage'),
  ('support_admin', 'support.user.assist'),
  ('lineup_operator', 'lineup.manage'),
  ('academy_operator', 'workspace.members.manage'),
  ('academy_operator', 'workspace.settings.manage'),
  ('coach_operator', 'workspace.members.manage'),
  ('venue_owner', 'workspace.settings.manage'),
  ('venue_manager', 'workspace.members.manage'),
  ('cashier', 'venue.pos.manage'),
  ('venue_staff', 'venue.staff.manage'),
  ('academy_owner', 'training.program.manage'),
  ('academy_admin', 'training.program.manage'),
  ('trainer', 'training.roster.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- 7) Compatibility grants (legacy to canonical).
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'platform_admin'
FROM user_roles
WHERE role = 'internal_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'moderator'
FROM user_roles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'reporter'
FROM user_roles
WHERE role = 'news_reporter_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'verification_admin'
FROM user_roles
WHERE role = 'registration_admin'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT user_id, 'member'
FROM user_roles
WHERE role IN ('general_user', 'fans', 'supporter')
ON CONFLICT (user_id, role) DO NOTHING;

-- 8) Workspace-scoped role assignment table.
CREATE TABLE IF NOT EXISTS user_workspace_roles (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  workspace_type text NOT NULL,
  role text NOT NULL REFERENCES app_roles(role) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, workspace_id, role)
);

-- 9) Activity-scoped role assignment table.
CREATE TABLE IF NOT EXISTS user_activity_roles (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  activity_id text NOT NULL,
  role text NOT NULL REFERENCES app_roles(role) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, activity_type, activity_id, role)
);

-- 10) Interests/tags table (replace fans/supporter as permission roles).
CREATE TABLE IF NOT EXISTS user_interests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest text NOT NULL,
  source text NOT NULL DEFAULT 'profile',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, interest)
);

-- 11) Useful indexes for scale.
CREATE INDEX IF NOT EXISTS idx_user_workspace_roles_workspace
ON user_workspace_roles (workspace_id, workspace_type);

CREATE INDEX IF NOT EXISTS idx_user_workspace_roles_user
ON user_workspace_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_roles_lookup
ON user_activity_roles (activity_type, activity_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_roles_user
ON user_activity_roles (user_id);

COMMIT;
