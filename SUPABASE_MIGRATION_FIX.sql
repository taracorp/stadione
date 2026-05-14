-- ============================================================================
-- SUPABASE MIGRATION FIX - Add missing columns to existing tables
-- ============================================================================
-- This script handles schema evolution for existing tables
-- Run this if you get "column does not exist" errors
-- ============================================================================

-- Add missing columns to app_roles if they don't exist
ALTER TABLE IF EXISTS app_roles 
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS hierarchy_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS scope_type text DEFAULT 'platform',
ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT true;

-- Add missing columns to app_permissions if they don't exist  
ALTER TABLE IF EXISTS app_permissions
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS module text;

-- Add missing columns to user_roles if they don't exist
ALTER TABLE IF EXISTS user_roles
ADD COLUMN IF NOT EXISTS granted_by uuid,
ADD COLUMN IF NOT EXISTS granted_at timestamptz DEFAULT now();

-- Add missing columns to admin_audit_logs if they don't exist
ALTER TABLE IF EXISTS admin_audit_logs
ADD COLUMN IF NOT EXISTS ip_address inet,
ADD COLUMN IF NOT EXISTS user_agent text;

-- Add missing columns to tournament_registrations if they don't exist
ALTER TABLE IF EXISTS tournament_registrations
ADD COLUMN IF NOT EXISTS base_fee integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_transfer_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_amount integer,
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_notes text,
ADD COLUMN IF NOT EXISTS admin_review_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS slot_locked_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS slot_expires_at timestamptz DEFAULT (now() + interval '15 minutes'),
ADD COLUMN IF NOT EXISTS lock_released_at timestamptz,
ADD COLUMN IF NOT EXISTS team_id bigint;

-- Now try INSERT with ON CONFLICT to handle duplicates
-- Clear existing data if needed (optional, comment out if you want to preserve)
-- TRUNCATE TABLE app_roles CASCADE;
-- TRUNCATE TABLE app_permissions CASCADE;
-- TRUNCATE TABLE role_permissions CASCADE;

-- Insert App Roles (only if not already present)
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
('reviewer', 'Reviewer (Legacy)', 'Legacy compatibility role for verification review', 'verification_admin', 3, 'platform')
ON CONFLICT (role) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  parent_role = EXCLUDED.parent_role,
  hierarchy_level = EXCLUDED.hierarchy_level,
  scope_type = EXCLUDED.scope_type;

-- Insert App Permissions
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
('audit.write', 'Write Audit Logs', 'Write admin audit entries', 'security')
ON CONFLICT (permission) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- Insert Role Permissions
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
('reviewer', 'payment.verify')
ON CONFLICT (role, permission) DO NOTHING;

-- Success message
SELECT 'Migration fix completed successfully!' as status;
