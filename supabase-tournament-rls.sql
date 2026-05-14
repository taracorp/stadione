-- Stadione Tournament Verification RLS Migration
-- Apply this on existing databases to enable admin/reviewer role checks

CREATE TABLE IF NOT EXISTS app_roles (
  role text PRIMARY KEY,
  display_name text,
  description text,
  parent_role text REFERENCES app_roles(role),
  hierarchy_level integer DEFAULT 0,
  scope_type text DEFAULT 'platform',
  is_system boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_permissions (
  permission text PRIMARY KEY,
  display_name text,
  description text,
  module text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role text NOT NULL REFERENCES app_roles(role) ON DELETE CASCADE,
  permission text NOT NULL REFERENCES app_permissions(permission) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL REFERENCES app_roles(role) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES auth.users(id),
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS parent_role text REFERENCES app_roles(role);
ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS hierarchy_level integer DEFAULT 0;
ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS scope_type text DEFAULT 'platform';
ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT true;
ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

INSERT INTO app_roles (role, description) VALUES
('super_admin', 'Highest platform authority with full governance access'),
('internal_admin', 'Internal staff umbrella role'),
('news_reporter_admin', 'Manage newsroom, articles, media and highlights'),
('tournament_host_admin', 'Manage tournament operations, schedules, venues and officials'),
('registration_admin', 'Verify registrations, roster, player age and approvals'),
('verification_admin', 'Review operator verification and governance compliance'),
('finance_admin', 'Manage finance and payment verification workflows'),
('verified_operator', 'Umbrella role for validated tournament operators'),
('federation_operator', 'Official federation tournament operator'),
('eo_operator', 'Event organizer operator'),
('community_host', 'Community/academy host operator'),
('match_official', 'Umbrella role for match operations'),
('referee', 'Match authority role'),
('match_commissioner', 'Validate match flow and report'),
('statistic_operator', 'Input statistics and match event feeds'),
('venue_officer', 'Manage attendance and venue operations'),
('team_role', 'Umbrella role for team-level accounts'),
('team_official', 'Register team and submit lineup'),
('coach', 'Team coach account'),
('manager', 'Team manager account'),
('player', 'Player account role'),
('general_user', 'Default platform role for regular users'),
('admin', 'Legacy compatibility role with admin/reviewer access'),
('reviewer', 'Legacy compatibility role for verification review')
ON CONFLICT (role) DO NOTHING;

UPDATE app_roles SET display_name = 'Super Admin', parent_role = null, hierarchy_level = 0, scope_type = 'platform' WHERE role = 'super_admin';
UPDATE app_roles SET display_name = 'Internal Admin', parent_role = 'super_admin', hierarchy_level = 1, scope_type = 'platform' WHERE role = 'internal_admin';
UPDATE app_roles SET display_name = 'News Reporter Admin', parent_role = 'internal_admin', hierarchy_level = 2, scope_type = 'platform' WHERE role = 'news_reporter_admin';
UPDATE app_roles SET display_name = 'Tournament Host Admin', parent_role = 'internal_admin', hierarchy_level = 2, scope_type = 'platform' WHERE role = 'tournament_host_admin';
UPDATE app_roles SET display_name = 'Registration Admin', parent_role = 'internal_admin', hierarchy_level = 2, scope_type = 'platform' WHERE role = 'registration_admin';
UPDATE app_roles SET display_name = 'Verification Admin', parent_role = 'internal_admin', hierarchy_level = 2, scope_type = 'platform' WHERE role = 'verification_admin';
UPDATE app_roles SET display_name = 'Finance Admin', parent_role = 'internal_admin', hierarchy_level = 2, scope_type = 'platform' WHERE role = 'finance_admin';
UPDATE app_roles SET display_name = 'Verified Operator', parent_role = 'super_admin', hierarchy_level = 1, scope_type = 'operator' WHERE role = 'verified_operator';
UPDATE app_roles SET display_name = 'Federation Operator', parent_role = 'verified_operator', hierarchy_level = 2, scope_type = 'operator' WHERE role = 'federation_operator';
UPDATE app_roles SET display_name = 'EO Operator', parent_role = 'verified_operator', hierarchy_level = 2, scope_type = 'operator' WHERE role = 'eo_operator';
UPDATE app_roles SET display_name = 'Community Host', parent_role = 'verified_operator', hierarchy_level = 2, scope_type = 'operator' WHERE role = 'community_host';
UPDATE app_roles SET display_name = 'Match Official', parent_role = 'super_admin', hierarchy_level = 1, scope_type = 'match' WHERE role = 'match_official';
UPDATE app_roles SET display_name = 'Referee', parent_role = 'match_official', hierarchy_level = 2, scope_type = 'match' WHERE role = 'referee';
UPDATE app_roles SET display_name = 'Match Commissioner', parent_role = 'match_official', hierarchy_level = 2, scope_type = 'match' WHERE role = 'match_commissioner';
UPDATE app_roles SET display_name = 'Statistic Operator', parent_role = 'match_official', hierarchy_level = 2, scope_type = 'match' WHERE role = 'statistic_operator';
UPDATE app_roles SET display_name = 'Venue Officer', parent_role = 'match_official', hierarchy_level = 2, scope_type = 'match' WHERE role = 'venue_officer';
UPDATE app_roles SET display_name = 'Team Role', parent_role = 'super_admin', hierarchy_level = 1, scope_type = 'team' WHERE role = 'team_role';
UPDATE app_roles SET display_name = 'Team Official', parent_role = 'team_role', hierarchy_level = 2, scope_type = 'team' WHERE role = 'team_official';
UPDATE app_roles SET display_name = 'Coach', parent_role = 'team_role', hierarchy_level = 2, scope_type = 'team' WHERE role = 'coach';
UPDATE app_roles SET display_name = 'Manager', parent_role = 'team_role', hierarchy_level = 2, scope_type = 'team' WHERE role = 'manager';
UPDATE app_roles SET display_name = 'Player', parent_role = 'team_role', hierarchy_level = 2, scope_type = 'team' WHERE role = 'player';
UPDATE app_roles SET display_name = 'General User', parent_role = null, hierarchy_level = 3, scope_type = 'platform' WHERE role = 'general_user';
UPDATE app_roles SET display_name = 'Admin (Legacy)', parent_role = 'super_admin', hierarchy_level = 2, scope_type = 'platform' WHERE role = 'admin';
UPDATE app_roles SET display_name = 'Reviewer (Legacy)', parent_role = 'verification_admin', hierarchy_level = 3, scope_type = 'platform' WHERE role = 'reviewer';

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
ON CONFLICT (permission) DO NOTHING;

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

CREATE OR REPLACE FUNCTION public.has_app_role(p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  target_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM app_roles WHERE role = p_role) INTO target_exists;
  IF NOT target_exists THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    WITH RECURSIVE target_chain AS (
      SELECT role, parent_role
      FROM app_roles
      WHERE role = p_role
      UNION ALL
      SELECT ar.role, ar.parent_role
      FROM app_roles ar
      JOIN target_chain tc ON tc.parent_role = ar.role
    )
    SELECT 1
    FROM user_roles ur
    JOIN target_chain tc ON tc.role = ur.role
    WHERE ur.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    WITH RECURSIVE role_tree AS (
      SELECT ur.role
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      UNION ALL
      SELECT ar.role
      FROM app_roles ar
      JOIN role_tree rt ON ar.parent_role = rt.role
    )
    SELECT 1
    FROM role_permissions rp
    JOIN role_tree rt ON rt.role = rp.role
    WHERE rp.permission IN (p_permission, 'platform.all')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS TABLE(permission text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE role_tree AS (
    SELECT ur.role
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    UNION ALL
    SELECT ar.role
    FROM app_roles ar
    JOIN role_tree rt ON ar.parent_role = rt.role
  )
  SELECT DISTINCT rp.permission
  FROM role_permissions rp
  JOIN role_tree rt ON rt.role = rp.role
  UNION ALL
  SELECT 'platform.all'::text
  WHERE EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_reviewer()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.has_app_role('super_admin')
    OR public.has_app_role('admin')
    OR public.has_app_role('reviewer')
    OR public.has_permission('operator.verify');
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id bigint;
  role_snapshot text;
BEGIN
  SELECT ur.role
  INTO role_snapshot
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY ur.granted_at ASC
  LIMIT 1;

  INSERT INTO admin_audit_logs (
    actor_user_id,
    actor_role,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    auth.uid(),
    role_snapshot,
    p_action,
    p_target_type,
    p_target_id,
    COALESCE(p_details, '{}'::jsonb)
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reg_fee integer DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_type text DEFAULT 'individual';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS slot_lock_minutes integer DEFAULT 15;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS age_min integer DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS age_max integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS tournament_registrations (
  id bigserial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registrant_name text NOT NULL,
  registrant_email text NOT NULL,
  registration_type text NOT NULL DEFAULT 'individual',
  registration_status text NOT NULL DEFAULT 'draft',
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_method text,
  base_fee integer DEFAULT 0,
  unique_transfer_amount integer DEFAULT 0,
  payment_amount integer,
  payment_proof_url text,
  payment_proof_uploaded_at timestamptz,
  payment_notes text,
  admin_review_status text DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  slot_locked_at timestamptz DEFAULT now(),
  slot_expires_at timestamptz DEFAULT (now() + interval '15 minutes'),
  lock_released_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_registration_roster (
  id bigserial PRIMARY KEY,
  registration_id bigint NOT NULL REFERENCES tournament_registrations(id) ON DELETE CASCADE,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  player_identifier text NOT NULL,
  date_of_birth date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.expire_tournament_registration_slots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE tournament_registrations
  SET
    registration_status = 'cancelled',
    payment_status = CASE WHEN payment_status IN ('unpaid', 'pending') THEN 'expired' ELSE payment_status END,
    lock_released_at = now(),
    updated_at = now()
  WHERE
    registration_status IN ('draft', 'waiting_payment')
    AND slot_expires_at IS NOT NULL
    AND slot_expires_at <= now();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'expire_tournament_registration_slots_every_minute'
    ) THEN
      PERFORM cron.schedule(
        'expire_tournament_registration_slots_every_minute',
        '*/1 * * * *',
        'SELECT public.expire_tournament_registration_slots();'
      );
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_operator_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registration_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view role catalog" ON app_roles;
CREATE POLICY "Anyone can view role catalog"
  ON app_roles FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view permission catalog" ON app_permissions;
CREATE POLICY "Anyone can view permission catalog"
  ON app_permissions FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view role permission matrix" ON role_permissions;
CREATE POLICY "Anyone can view role permission matrix"
  ON role_permissions FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Super admin can manage role permission matrix" ON role_permissions;
CREATE POLICY "Super admin can manage role permission matrix"
  ON role_permissions FOR ALL
  USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'))
  WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));

DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL
  USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'))
  WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));

DROP POLICY IF EXISTS "Admins can read audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  USING (public.has_app_role('super_admin') OR public.has_permission('audit.read'));

DROP POLICY IF EXISTS "Admins can write audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can write audit logs"
  ON admin_audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (public.has_app_role('super_admin') OR public.has_permission('audit.write')));

DROP POLICY IF EXISTS "Public can view tournaments" ON tournaments;
CREATE POLICY "Public can view tournaments"
  ON tournaments FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Reviewer can update verification fields on tournaments" ON tournaments;
CREATE POLICY "Reviewer can update verification fields on tournaments"
  ON tournaments FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

DROP POLICY IF EXISTS "Requester can create verification request" ON tournament_operator_verification_requests;
CREATE POLICY "Requester can create verification request"
  ON tournament_operator_verification_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND requester_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Requester can view own verification requests" ON tournament_operator_verification_requests;
CREATE POLICY "Requester can view own verification requests"
  ON tournament_operator_verification_requests FOR SELECT
  USING (requester_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Reviewer can view verification queue" ON tournament_operator_verification_requests;
CREATE POLICY "Reviewer can view verification queue"
  ON tournament_operator_verification_requests FOR SELECT
  USING (public.is_admin_or_reviewer());

DROP POLICY IF EXISTS "Reviewer can update verification requests" ON tournament_operator_verification_requests;
CREATE POLICY "Reviewer can update verification requests"
  ON tournament_operator_verification_requests FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

DROP POLICY IF EXISTS "User can create own tournament registration" ON tournament_registrations;
CREATE POLICY "User can create own tournament registration"
  ON tournament_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User can view own tournament registrations" ON tournament_registrations;
CREATE POLICY "User can view own tournament registrations"
  ON tournament_registrations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User can update own registration before approval" ON tournament_registrations;
CREATE POLICY "User can update own registration before approval"
  ON tournament_registrations FOR UPDATE
  USING (auth.uid() = user_id AND registration_status IN ('draft', 'waiting_payment', 'rejected'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Reviewer can view registration queue" ON tournament_registrations;
CREATE POLICY "Reviewer can view registration queue"
  ON tournament_registrations FOR SELECT
  USING (public.is_admin_or_reviewer());

DROP POLICY IF EXISTS "Reviewer can update registration queue" ON tournament_registrations;
CREATE POLICY "Reviewer can update registration queue"
  ON tournament_registrations FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

DROP POLICY IF EXISTS "User can manage own roster" ON tournament_registration_roster;
CREATE POLICY "User can manage own roster"
  ON tournament_registration_roster FOR ALL
  USING (
    exists (
      select 1
      from tournament_registrations tr
      where tr.id = tournament_registration_roster.registration_id
        and tr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    exists (
      select 1
      from tournament_registrations tr
      where tr.id = tournament_registration_roster.registration_id
        and tr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Reviewer can view roster queue" ON tournament_registration_roster;
CREATE POLICY "Reviewer can view roster queue"
  ON tournament_registration_roster FOR SELECT
  USING (public.is_admin_or_reviewer());

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Payment proof objects are publicly readable" ON storage.objects;
CREATE POLICY "Payment proof objects are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

-- After running this migration, assign at least one admin manually:
-- INSERT INTO user_roles (user_id, role, granted_by)
-- SELECT id, 'super_admin', id
-- FROM auth.users
-- WHERE email = 'taradfworkspace@gmail.com'
-- ON CONFLICT (user_id, role) DO NOTHING;
