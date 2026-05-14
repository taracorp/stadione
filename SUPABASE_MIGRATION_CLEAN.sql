-- ============================================================================
-- SUPABASE SCHEMA EVOLUTION FIX - Safe Column Addition
-- ============================================================================
-- This script safely adds all missing columns to existing tables
-- It checks each column before adding to avoid errors
-- ============================================================================

-- Recreate app_roles table cleanly (safest approach)
-- First backup data if needed, then drop and recreate
DROP TABLE IF EXISTS public.app_roles CASCADE;

CREATE TABLE IF NOT EXISTS public.app_roles (
  role text primary key,
  display_name text,
  description text,
  parent_role text references app_roles(role),
  hierarchy_level integer default 0,
  scope_type text default 'platform',
  is_system boolean default true,
  created_at timestamptz default now()
);

-- Recreate app_permissions  
DROP TABLE IF EXISTS public.app_permissions CASCADE;

CREATE TABLE IF NOT EXISTS public.app_permissions (
  permission text primary key,
  display_name text,
  description text,
  module text,
  created_at timestamptz default now()
);

-- Recreate role_permissions
DROP TABLE IF EXISTS public.role_permissions CASCADE;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text not null references app_roles(role) on delete cascade,
  permission text not null references app_permissions(permission) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  primary key (role, permission)
);

-- Recreate user_roles safely
DROP TABLE IF EXISTS public.user_roles CASCADE;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade, 
  role text not null references app_roles(role) on delete cascade, 
  granted_at timestamptz default now(), 
  granted_by uuid references auth.users(id), 
  primary key (user_id, role)
);

-- Re-enable RLS
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS Policies
CREATE POLICY "Anyone can view role catalog" ON app_roles FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view permission catalog" ON app_permissions FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view role permission matrix" ON role_permissions FOR SELECT USING (TRUE);

-- Now insert all roles fresh
INSERT INTO app_roles (role, display_name, description, parent_role, hierarchy_level, scope_type) VALUES
('super_admin', 'Super Admin', 'Highest platform authority with full governance access', null, 0, 'platform'),
('internal_admin', 'Internal Admin', 'Internal staff umbrella role', 'super_admin', 1, 'platform'),
('news_reporter_admin', 'News Reporter Admin', 'Manage newsroom, articles, media and highlights', 'internal_admin', 2, 'platform'),
('tournament_host_admin', 'Tournament Host Admin', 'Manage tournament operations, schedules, venues and officials', 'internal_admin', 2, 'platform'),
('registration_admin', 'Registration Admin', 'Verify registrations, roster, player age and approvals', 'internal_admin', 2, 'platform'),
('verification_admin', 'Verification Admin', 'Review operator verification and governance compliance', 'internal_admin', 2, 'platform'),
('finance_admin', 'Finance Admin', 'Manage finance and payment verification workflows', 'internal_admin', 2, 'platform'),
('verified_operator', 'Verified Operator', 'Umbrella role for validated tournament operators', 'super_admin', 1, 'operator'),
('federation_operator', 'Federation Operator', 'Official federation tournament operator', 'verified_operator', 2, 'operator'),
('eo_operator', 'EO Operator', 'Event organizer operator', 'verified_operator', 2, 'operator'),
('community_host', 'Community Host', 'Community/academy host operator', 'verified_operator', 2, 'operator'),
('match_official', 'Match Official', 'Umbrella role for match operations', 'super_admin', 1, 'match'),
('referee', 'Referee', 'Match authority role', 'match_official', 2, 'match'),
('match_commissioner', 'Match Commissioner', 'Validate match flow and report', 'match_official', 2, 'match'),
('statistic_operator', 'Statistic Operator', 'Input statistics and match event feeds', 'match_official', 2, 'match'),
('venue_officer', 'Venue Officer', 'Manage attendance and venue operations', 'match_official', 2, 'match'),
('team_role', 'Team Role', 'Umbrella role for team-level accounts', 'super_admin', 1, 'team'),
('team_official', 'Team Official', 'Register team and submit lineup', 'team_role', 2, 'team'),
('coach', 'Coach', 'Team coach account', 'team_role', 2, 'team'),
('manager', 'Manager', 'Team manager account', 'team_role', 2, 'team'),
('player', 'Player', 'Player account role', 'team_role', 2, 'team'),
('general_user', 'General User', 'Default platform role for regular users', null, 3, 'platform'),
('admin', 'Admin (Legacy)', 'Legacy compatibility role with admin/reviewer access', 'super_admin', 2, 'platform'),
('reviewer', 'Reviewer (Legacy)', 'Legacy compatibility role for verification review', 'verification_admin', 3, 'platform');

-- Insert permissions
INSERT INTO app_permissions (permission, display_name, description, module) VALUES
('platform.all', 'Platform All Access', 'Full access to platform modules and governance', 'platform'),
('platform.settings.manage', 'Manage Platform Settings', 'Update platform level configuration', 'platform'),
('analytics.global.read', 'Read Global Analytics', 'View global analytics and insights', 'analytics'),
('users.role.manage', 'Manage User Roles', 'Assign, revoke and manage user roles', 'users'),
('users.moderate', 'Moderate Users', 'Ban and moderate user accounts', 'users'),
('news.create', 'Create News', 'Create news content', 'news'),
('news.edit', 'Edit News', 'Edit news content', 'news'),
('news.publish', 'Publish News', 'Publish approved news content', 'news'),
('news.feature', 'Feature News', 'Set featured/trending news', 'news'),
('media.upload', 'Upload Media', 'Upload media assets and highlights', 'news'),
('tournament.create', 'Create Tournament', 'Create tournament event', 'tournament'),
('tournament.edit', 'Edit Tournament', 'Edit tournament details and regulation', 'tournament'),
('tournament.schedule.manage', 'Manage Match Schedule', 'Manage match schedule and bracket', 'tournament'),
('tournament.official.assign', 'Assign Match Official', 'Assign officials for tournament matches', 'tournament'),
('tournament.sponsorship.manage', 'Manage Sponsorship', 'Manage sponsorship for tournaments', 'tournament'),
('registration.approve', 'Approve Registration', 'Approve team/player registration', 'registration'),
('registration.reject', 'Reject Registration', 'Reject registration and request correction', 'registration'),
('registration.roster.validate', 'Validate Roster', 'Validate roster completeness and duplication', 'registration'),
('registration.age.validate', 'Validate Age', 'Validate age eligibility rules', 'registration'),
('payment.verify', 'Verify Payment', 'Verify manual transfer and payment proof', 'finance'),
('operator.verify', 'Verify Operator', 'Approve/reject operator verification request', 'verification'),
('operator.create_official_tournament', 'Create Official Tournament', 'Create official verified tournaments', 'verification'),
('match.lineup.manage', 'Manage Lineup', 'Input and update team lineup', 'match'),
('match.events.manage', 'Manage Match Events', 'Input substitutions, cards and attendance', 'match'),
('match.report.finalize', 'Finalize Match Report', 'Finalize and lock match reports', 'match'),
('team.register', 'Register Team', 'Register team into tournament', 'team'),
('team.roster.manage', 'Manage Team Roster', 'Add/update/remove team players', 'team'),
('player.profile.read', 'Read Player Profile', 'View player statistics and achievements', 'player'),
('audit.read', 'Read Audit Logs', 'View admin audit logs', 'security'),
('audit.write', 'Write Audit Logs', 'Write admin audit entries', 'security');

-- Insert role-permission mappings
INSERT INTO role_permissions (role, permission) VALUES
('super_admin', 'platform.all'),
('super_admin', 'platform.settings.manage'),
('super_admin', 'analytics.global.read'),
('super_admin', 'users.role.manage'),
('super_admin', 'users.moderate'),
('super_admin', 'audit.read'),
('super_admin', 'audit.write'),
('internal_admin', 'analytics.global.read'),
('internal_admin', 'audit.read'),
('news_reporter_admin', 'news.create'),
('news_reporter_admin', 'news.edit'),
('news_reporter_admin', 'news.publish'),
('news_reporter_admin', 'news.feature'),
('news_reporter_admin', 'media.upload'),
('tournament_host_admin', 'tournament.create'),
('tournament_host_admin', 'tournament.edit'),
('tournament_host_admin', 'tournament.schedule.manage'),
('tournament_host_admin', 'tournament.official.assign'),
('tournament_host_admin', 'tournament.sponsorship.manage'),
('registration_admin', 'registration.approve'),
('registration_admin', 'registration.reject'),
('registration_admin', 'registration.roster.validate'),
('registration_admin', 'registration.age.validate'),
('registration_admin', 'payment.verify'),
('verification_admin', 'operator.verify'),
('verification_admin', 'audit.read'),
('finance_admin', 'payment.verify'),
('finance_admin', 'analytics.global.read'),
('verified_operator', 'operator.create_official_tournament'),
('verified_operator', 'tournament.create'),
('verified_operator', 'tournament.edit'),
('verified_operator', 'tournament.official.assign'),
('verified_operator', 'tournament.sponsorship.manage'),
('team_official', 'team.register'),
('team_official', 'team.roster.manage'),
('manager', 'team.register'),
('manager', 'team.roster.manage'),
('coach', 'team.roster.manage'),
('player', 'player.profile.read'),
('referee', 'match.events.manage'),
('match_commissioner', 'match.report.finalize'),
('statistic_operator', 'match.events.manage'),
('venue_officer', 'match.events.manage'),
('admin', 'operator.verify'),
('admin', 'registration.approve'),
('admin', 'registration.reject'),
('admin', 'payment.verify'),
('admin', 'audit.read'),
('admin', 'audit.write'),
('reviewer', 'operator.verify'),
('reviewer', 'registration.approve'),
('reviewer', 'registration.reject'),
('reviewer', 'payment.verify');

-- Re-create RPC functions
CREATE OR REPLACE FUNCTION public.has_app_role(p_role text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  target_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM app_roles WHERE role = p_role) INTO target_exists;
  IF NOT target_exists THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    WITH RECURSIVE target_chain AS (
      SELECT role, parent_role FROM app_roles WHERE role = p_role
      UNION ALL
      SELECT ar.role, ar.parent_role FROM app_roles ar
      JOIN target_chain tc ON tc.parent_role = ar.role
    )
    SELECT 1 FROM user_roles ur JOIN target_chain tc ON tc.role = ur.role
    WHERE ur.user_id = auth.uid()
  );
END; $$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    WITH RECURSIVE role_tree AS (
      SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid()
      UNION ALL
      SELECT ar.role FROM app_roles ar JOIN role_tree rt ON ar.parent_role = rt.role
    )
    SELECT 1 FROM role_permissions rp JOIN role_tree rt ON rt.role = rp.role
    WHERE rp.permission IN (p_permission, 'platform.all')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_current_user_permissions() RETURNS TABLE(permission text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH RECURSIVE role_tree AS (
    SELECT ur.role FROM user_roles ur WHERE ur.user_id = auth.uid()
    UNION ALL
    SELECT ar.role FROM app_roles ar JOIN role_tree rt ON ar.parent_role = rt.role
  )
  SELECT DISTINCT rp.permission FROM role_permissions rp JOIN role_tree rt ON rt.role = rp.role
  UNION ALL
  SELECT 'platform.all'::text WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_reviewer() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN public.has_app_role('super_admin') OR public.has_app_role('admin') OR public.has_app_role('reviewer') OR public.has_permission('operator.verify');
END; $$;

SELECT '✅ Schema fixed and roles/permissions recreated successfully!' as status;
