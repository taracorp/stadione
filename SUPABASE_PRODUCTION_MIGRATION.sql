-- ============================================================================
-- STADIONE PRODUCTION MIGRATION - APPLY ALL TABLES & FUNCTIONS
-- ============================================================================
-- This consolidated migration combines all 8 SQL files in the correct order
-- Apply this to production Supabase database
-- 
-- INSTRUCTIONS:
-- 1. Log in to: https://supabase.com/dashboard/projects
-- 2. Open project: stadione (bkjsqfcjylgmxlauatwt)
-- 3. Go to: SQL Editor → New Query
-- 4. Copy ALL text from this file
-- 5. Paste into SQL editor
-- 6. Click "Run" (or Ctrl+Enter)
-- 7. Wait for completion (may take 1-2 minutes)
-- 8. Check "Table Editor" to verify tables exist
--
-- NOTE: If you hit editor size limits, split into 2 queries:
-- - Query 1: Lines 1-1000
-- - Query 2: Lines 1001-end
-- ============================================================================

-- ============================================================================
-- PHASE 1: CORE SCHEMA (supabase-schema.sql)
-- ============================================================================

-- Venues & Tags
CREATE TABLE IF NOT EXISTS venues (
  id integer primary key, 
  name text not null, 
  city text, 
  sport text, 
  price integer, 
  rating numeric, 
  reviews integer, 
  color text
);

CREATE TABLE IF NOT EXISTS venue_tags (
  venue_id integer references venues(id), 
  tag text not null, 
  primary key (venue_id, tag)
);

-- Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
  id serial primary key, 
  name text not null, 
  sport text, 
  format text, 
  teams integer, 
  status text default 'open', 
  prize integer, 
  reg_fee integer default 0, 
  registration_type text default 'individual', 
  slot_lock_minutes integer default 15, 
  age_min integer default 0, 
  age_max integer default 0, 
  start_date text, 
  color text, 
  host text, 
  participants integer default 0, 
  classification text default 'community', 
  operator_type text default 'community', 
  is_verified boolean default false, 
  verification_status text default 'unverified', 
  verification_badge text, 
  verification_reviewed_at timestamptz
);

-- Tournament Verification Requests
CREATE TABLE IF NOT EXISTS tournament_operator_verification_requests (
  id serial primary key, 
  tournament_id integer references tournaments(id) on delete cascade, 
  requester_user_id text not null, 
  requester_name text not null, 
  requester_email text not null, 
  operator_type text not null default 'community', 
  requested_classification text not null default 'community', 
  documents jsonb default '{}'::jsonb, 
  status text not null default 'pending', 
  admin_notes text, 
  reviewed_by text, 
  reviewed_at timestamptz, 
  created_at timestamptz default now(), 
  updated_at timestamptz default now()
);

-- Tournament Registrations
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id bigserial primary key,
  tournament_id integer not null references tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  registrant_name text not null,
  registrant_email text not null,
  registration_type text not null default 'individual',
  registration_status text not null default 'draft',
  payment_status text not null default 'unpaid',
  payment_method text,
  base_fee integer default 0,
  unique_transfer_amount integer default 0,
  payment_amount integer,
  payment_proof_url text,
  payment_proof_uploaded_at timestamptz,
  payment_notes text,
  admin_review_status text default 'pending',
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  slot_locked_at timestamptz default now(),
  slot_expires_at timestamptz default (now() + interval '15 minutes'),
  lock_released_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  team_id bigint,
  unique (tournament_id, user_id)
);

-- Registration Roster
CREATE TABLE IF NOT EXISTS tournament_registration_roster (
  id bigserial primary key,
  registration_id bigint not null references tournament_registrations(id) on delete cascade,
  tournament_id integer not null references tournaments(id) on delete cascade,
  player_name text not null,
  player_identifier text not null,
  date_of_birth date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS app_roles (
  role text primary key,
  display_name text,
  description text,
  parent_role text references app_roles(role),
  hierarchy_level integer default 0,
  scope_type text default 'platform',
  is_system boolean default true,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS app_permissions (
  permission text primary key,
  display_name text,
  description text,
  module text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role text not null references app_roles(role) on delete cascade,
  permission text not null references app_permissions(permission) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  primary key (role, permission)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid not null references auth.users(id) on delete cascade, 
  role text not null references app_roles(role) on delete cascade, 
  granted_at timestamptz default now(), 
  granted_by uuid references auth.users(id), 
  primary key (user_id, role)
);

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigserial primary key,
  actor_user_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- Tournament Standings, Schedule, Brackets
CREATE TABLE IF NOT EXISTS tournament_standings (
  tournament_id integer references tournaments(id), 
  pos integer, 
  team text, 
  p integer, 
  w integer, 
  d integer, 
  l integer, 
  gf integer, 
  ga integer, 
  pts integer, 
  primary key (tournament_id, pos)
);

CREATE TABLE IF NOT EXISTS tournament_schedule (
  tournament_id integer references tournaments(id), 
  entry_id integer primary key, 
  date text, 
  home text, 
  away text, 
  score text, 
  status text
);

CREATE TABLE IF NOT EXISTS tournament_bracket_rounds (
  id serial primary key, 
  tournament_id integer references tournaments(id), 
  round_order integer, 
  name text
);

CREATE TABLE IF NOT EXISTS tournament_bracket_matches (
  id serial primary key, 
  round_id integer references tournament_bracket_rounds(id), 
  p1 text, 
  p2 text, 
  s1 integer, 
  s2 integer, 
  w integer
);

-- News, Coaches, Chat
CREATE TABLE IF NOT EXISTS news (
  id integer primary key, 
  category text, 
  title text, 
  excerpt text, 
  author text, 
  date text, 
  read_time text, 
  featured boolean, 
  color text
);

CREATE TABLE IF NOT EXISTS coaches (
  id integer primary key, 
  name text, 
  sport text, 
  exp integer, 
  rating numeric, 
  sessions integer, 
  price integer, 
  initial text
);

CREATE TABLE IF NOT EXISTS coach_certs (
  coach_id integer references coaches(id), 
  cert text, 
  primary key(coach_id, cert)
);

CREATE TABLE IF NOT EXISTS coach_extra (
  coach_id integer primary key references coaches(id), 
  bio text, 
  location text
);

CREATE TABLE IF NOT EXISTS coach_languages (
  coach_id integer references coaches(id), 
  language text, 
  primary key(coach_id, language)
);

CREATE TABLE IF NOT EXISTS coach_schedule (
  coach_id integer references coaches(id), 
  schedule_line text, 
  primary key(coach_id, schedule_line)
);

CREATE TABLE IF NOT EXISTS coach_programs (
  coach_id integer references coaches(id), 
  program_id integer, 
  name text, 
  price integer, 
  duration text, 
  description text, 
  primary key(coach_id, program_id)
);

CREATE TABLE IF NOT EXISTS chats (
  id integer primary key, 
  coach_id integer references coaches(id), 
  name text, 
  sport text, 
  initial text, 
  online boolean, 
  last_msg text, 
  time text, 
  unread integer
);

CREATE TABLE IF NOT EXISTS chat_messages (
  chat_id integer references chats(id), 
  message_id integer, 
  sender text, 
  text text, 
  time text, 
  primary key(chat_id, message_id)
);

-- Insert App Roles
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
ON CONFLICT (role) DO NOTHING;

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
ON CONFLICT (permission) DO NOTHING;

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

-- RPC Functions for Role Management
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

-- Enable RLS on Core Tables
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_operator_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registration_roster ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Roles & Permissions
CREATE POLICY "Anyone can view role catalog"
  ON app_roles FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can view permission catalog"
  ON app_permissions FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can view role permission matrix"
  ON role_permissions FOR SELECT
  USING (TRUE);

CREATE POLICY "Super admin can manage role permission matrix"
  ON role_permissions FOR ALL
  USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'))
  WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL
  USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'))
  WITH CHECK (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));

CREATE POLICY "Admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  USING (public.has_app_role('super_admin') OR public.has_permission('audit.read'));

CREATE POLICY "Admins can write audit logs"
  ON admin_audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (public.has_app_role('super_admin') OR public.has_permission('audit.write')));

CREATE POLICY "Public can view tournaments"
  ON tournaments FOR SELECT
  USING (TRUE);

CREATE POLICY "Reviewer can update verification fields on tournaments"
  ON tournaments FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

CREATE POLICY "Requester can create verification request"
  ON tournament_operator_verification_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND requester_user_id = auth.uid()::text);

CREATE POLICY "Requester can view own verification requests"
  ON tournament_operator_verification_requests FOR SELECT
  USING (requester_user_id = auth.uid()::text);

CREATE POLICY "Reviewer can view verification queue"
  ON tournament_operator_verification_requests FOR SELECT
  USING (public.is_admin_or_reviewer());

CREATE POLICY "Reviewer can update verification requests"
  ON tournament_operator_verification_requests FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

CREATE POLICY "User can create own tournament registration"
  ON tournament_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User can view own tournament registrations"
  ON tournament_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User can update own registration before approval"
  ON tournament_registrations FOR UPDATE
  USING (auth.uid() = user_id AND registration_status IN ('draft', 'waiting_payment', 'rejected'))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Reviewer can view registration queue"
  ON tournament_registrations FOR SELECT
  USING (public.is_admin_or_reviewer());

CREATE POLICY "Reviewer can update registration queue"
  ON tournament_registrations FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

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

CREATE POLICY "Reviewer can view roster queue"
  ON tournament_registration_roster FOR SELECT
  USING (public.is_admin_or_reviewer());

-- Storage for Payment Proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Payment proof objects are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

-- Member Verification Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-verification-docs', 'member-verification-docs', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS "Member verification documents are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload member verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update member verification documents" ON storage.objects;

CREATE POLICY "Member verification documents are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-verification-docs');

CREATE POLICY "Authenticated users can upload member verification documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'member-verification-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member verification documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'member-verification-docs' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'member-verification-docs' AND auth.uid() IS NOT NULL);

-- Sample Data
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (1,'GOR Senayan Mini Soccer','Jakarta Pusat','Sepakbola',450000,4.8,234,'#0F4D2A');
INSERT INTO venue_tags (venue_id,tag) VALUES (1,'Outdoor');
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status) VALUES (1,'Liga Futsal Jakarta 2026','Futsal','Liga',12,'Berlangsung',50000000,'15 Mar 2026','#92400E','StadioneSports',156,'official','federation',true,'approved');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (1,'Sepakbola','Timnas U-23 Cetak Sejarah, Lolos Final Piala AFF','Garuda Muda menundukkan Vietnam 2-1 lewat gol dramatis di babak tambahan.','Rendy Pratama','07 Mei 2026','4 mnt',true,'#E11D2E');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (1,'Coach Bambang Sutrisno','Sepakbola',12,4.9,234,250000,'BS');

-- ============================================================================
-- PHASE 2: COMMUNITY TABLES (supabase-community.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sport_communities (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  sport TEXT NOT NULL,
  members_count INT DEFAULT 0,
  activity_level TEXT DEFAULT 'New',
  gender TEXT DEFAULT 'Putra/Putri',
  skill_level TEXT DEFAULT 'Beginner',
  community_type TEXT DEFAULT 'Trending',
  tagline TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_memberships (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_feed_posts (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'member',
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_events (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'sparring',
  status TEXT DEFAULT 'upcoming',
  event_date TEXT,
  time_label TEXT,
  location TEXT,
  attendees_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT DEFAULT 'member',
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_trial_bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  academy_name TEXT NOT NULL,
  academy_city TEXT,
  participant_name TEXT,
  participant_age TEXT,
  trial_date TEXT,
  trial_time TEXT,
  contact_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_memberships_user_id ON community_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_community_id ON community_memberships (community_id);

ALTER TABLE sport_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_trial_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view communities"
  ON sport_communities FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can view community feed posts"
  ON community_feed_posts FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can view community events"
  ON community_events FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can view community chat messages"
  ON community_chat_messages FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can view their own community memberships"
  ON community_memberships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can join communities"
  ON community_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own academy trial bookings"
  ON academy_trial_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can book academy trials"
  ON academy_trial_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON sport_communities TO anon, authenticated;
GRANT SELECT, INSERT ON community_memberships TO authenticated;
GRANT SELECT ON community_feed_posts TO anon, authenticated;
GRANT SELECT ON community_events TO anon, authenticated;
GRANT SELECT ON community_chat_messages TO anon, authenticated;
GRANT SELECT, INSERT ON academy_trial_bookings TO authenticated;

-- ============================================================================
-- PHASE 3: ACTIVITY TRACKING TABLES (supabase-activity-rls-fix.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_venue_bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id BIGINT NOT NULL,
  venue_name TEXT,
  venue_city TEXT,
  booking_date TEXT NOT NULL,
  booking_time TEXT,
  duration_hours INT DEFAULT 1,
  sport TEXT,
  status TEXT DEFAULT 'confirmed',
  booking_created_at TIMESTAMPTZ DEFAULT NOW(),
  booking_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_articles_read (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id BIGINT,
  article_title TEXT,
  article_category TEXT,
  read_date TIMESTAMPTZ DEFAULT NOW(),
  read_duration_seconds INT,
  completion_percentage INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_tournament_participations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id BIGINT NOT NULL,
  tournament_name TEXT,
  sport TEXT,
  registration_type TEXT DEFAULT 'individual',
  registration_status TEXT DEFAULT 'registered',
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  tournament_start_date TEXT,
  status TEXT DEFAULT 'registered',
  result_placement INT,
  result_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_community_memberships_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  community_name TEXT,
  sport TEXT,
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  posts_count INT DEFAULT 0,
  events_attended INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_training_enrollments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id BIGINT,
  academy_name TEXT,
  academy_city TEXT,
  program_name TEXT,
  sport TEXT,
  enrollment_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'enrolled',
  progress_percentage INT DEFAULT 0,
  classes_attended INT DEFAULT 0,
  total_classes INT DEFAULT 0,
  completion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_category TEXT,
  activity_title TEXT NOT NULL,
  activity_description TEXT,
  activity_date TIMESTAMPTZ DEFAULT NOW(),
  activity_metadata JSONB,
  status TEXT DEFAULT 'active',
  is_completed BOOLEAN DEFAULT FALSE,
  completion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_venue_bookings_user_created ON user_venue_bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_articles_read_user_date ON user_articles_read (user_id, read_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_tournament_participations_user ON user_tournament_participations (user_id, registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_community_memberships_log_user ON user_community_memberships_log (user_id, joined_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_training_enrollments_user ON user_training_enrollments (user_id, enrollment_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_date ON user_activity_log (user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_type ON user_activity_log (activity_type, user_id);

ALTER TABLE user_venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_articles_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tournament_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_community_memberships_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own venue bookings"
  ON user_venue_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own articles read"
  ON user_articles_read FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tournament participations"
  ON user_tournament_participations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own community memberships log"
  ON user_community_memberships_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own training enrollments"
  ON user_training_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own activity log"
  ON user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- PHASE 4: REGISTRATION SCHEMA (supabase-registration-schema.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tournament_id BIGINT NOT NULL,
  coordinator_id UUID NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  city TEXT,
  province TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  team_id BIGINT NOT NULL REFERENCES public.teams(id),
  user_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  player_identifier TEXT,
  date_of_birth DATE,
  position TEXT,
  jersey_name TEXT,
  status TEXT DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  age_valid BOOLEAN,
  gender_valid BOOLEAN,
  identity_valid BOOLEAN,
  suspension_flag BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.registrations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tournament_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  team_id BIGINT REFERENCES public.teams(id),
  registrant_name TEXT NOT NULL,
  registrant_email TEXT NOT NULL,
  registration_type TEXT NOT NULL,
  registration_status TEXT DEFAULT 'idle',
  payment_status TEXT DEFAULT 'unpaid',
  base_fee DECIMAL(15,2),
  unique_transfer_amount DECIMAL(15,2),
  slot_expires_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  payment_proof_url TEXT,
  payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
  awaiting_review BOOLEAN DEFAULT FALSE,
  admin_review_at TIMESTAMP WITH TIME ZONE,
  admin_reviewed_by UUID,
  admin_notes TEXT,
  roster_complete BOOLEAN DEFAULT FALSE,
  min_players_met BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.registration_history (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  registration_id BIGINT NOT NULL REFERENCES public.registrations(id),
  action TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT,
  old_status TEXT,
  new_status TEXT,
  details JSONB,
  notes TEXT
);

CREATE INDEX idx_registrations_tournament ON public.registrations(tournament_id);
CREATE INDEX idx_registrations_user ON public.registrations(user_id);
CREATE INDEX idx_registrations_team ON public.registrations(team_id);
CREATE INDEX idx_registrations_status ON public.registrations(registration_status);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_status ON public.team_members(status);
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_teams_coordinator ON public.teams(coordinator_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 5: GAMIFICATION SCHEMA (supabase-gamification-schema.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INT DEFAULT 0,
  points INT DEFAULT 0,
  tier_level TEXT DEFAULT 'Bronze',
  total_spent BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  points_earned INT NOT NULL,
  reference_id INT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id INT NOT NULL,
  scroll_depth_percent INT DEFAULT 0,
  read_completed BOOLEAN DEFAULT FALSE,
  quiz_attempted BOOLEAN DEFAULT FALSE,
  quiz_correct BOOLEAN DEFAULT FALSE,
  reading_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reading_completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS article_quiz (
  id BIGSERIAL PRIMARY KEY,
  article_id INT NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id BIGINT NOT NULL REFERENCES article_quiz(id) ON DELETE CASCADE,
  article_id INT NOT NULL,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INT DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id BIGSERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id INT,
  player_number INT,
  position TEXT,
  player_name TEXT NOT NULL,
  jersey_name TEXT,
  status TEXT DEFAULT 'active',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_statistics (
  id BIGSERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INT,
  player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  goals INT DEFAULT 0,
  assists INT DEFAULT 0,
  yellow_cards INT DEFAULT 0,
  red_cards INT DEFAULT 0,
  minutes_played INT DEFAULT 0,
  rating NUMERIC(3,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_lineups (
  id BIGSERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INT,
  player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  starting_eleven BOOLEAN DEFAULT FALSE,
  substituted_at INT,
  lineup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_suspensions (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  suspension_reason TEXT NOT NULL,
  yellow_card_count INT DEFAULT 0,
  suspension_from_match INT,
  suspension_until_match INT,
  is_active BOOLEAN DEFAULT TRUE,
  suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_progress_user_article ON article_progress(user_id, article_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament_id ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_user_id ON tournament_players(user_id);
CREATE INDEX IF NOT EXISTS idx_match_statistics_player_id ON match_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_player_suspensions_player_id ON player_suspensions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_suspensions_tournament_id ON player_suspensions(tournament_id);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats"
  ON user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
  ON user_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own activity log"
  ON activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity log"
  ON activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own article progress"
  ON article_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own article progress"
  ON article_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own article progress"
  ON article_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view quiz results"
  ON quiz_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results"
  ON quiz_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view tournament players"
  ON tournament_players FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can register themselves as tournament players"
  ON tournament_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tournament player record"
  ON tournament_players FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view match statistics"
  ON match_statistics FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can view player lineups"
  ON player_lineups FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can view player suspensions"
  ON player_suspensions FOR SELECT
  USING (TRUE);

-- ============================================================================
-- PHASE 6: GAMIFICATION RPC FUNCTIONS (supabase-gamification-functions.sql)
-- ============================================================================

CREATE OR REPLACE FUNCTION award_points(
  p_user_id UUID,
  p_points INT,
  p_activity_type TEXT,
  p_reference_id INT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE (
  new_points INT,
  new_tier TEXT,
  points_awarded INT
) AS $$
DECLARE
  v_new_points INT;
  v_new_tier TEXT;
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_stats
  SET points = points + p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING points INTO v_new_points;

  v_new_tier := CASE
    WHEN v_new_points >= 5000 THEN 'Platinum'
    WHEN v_new_points >= 2000 THEN 'Gold'
    WHEN v_new_points >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE user_stats
  SET tier_level = v_new_tier
  WHERE user_id = p_user_id;

  INSERT INTO activity_log (user_id, activity_type, points_earned, reference_id, metadata)
  VALUES (p_user_id, p_activity_type, p_points, p_reference_id, p_metadata);

  RETURN QUERY SELECT v_new_points, v_new_tier, p_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION award_coins_from_transaction(
  p_user_id UUID,
  p_transaction_amount BIGINT
)
RETURNS TABLE (
  new_coins INT,
  coins_earned INT
) AS $$
DECLARE
  v_coins_earned INT;
  v_new_coins INT;
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  v_coins_earned := (p_transaction_amount / 10000)::INT;

  IF v_coins_earned < 1 AND p_transaction_amount >= 10000 THEN
    v_coins_earned := 1;
  END IF;

  UPDATE user_stats
  SET coins = coins + v_coins_earned,
      total_spent = total_spent + p_transaction_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING coins INTO v_new_coins;

  INSERT INTO activity_log (user_id, activity_type, points_earned, metadata)
  VALUES (p_user_id, 'transaction', v_coins_earned, 
    jsonb_build_object('coins_earned', v_coins_earned, 'transaction_amount', p_transaction_amount));

  RETURN QUERY SELECT v_new_coins, v_coins_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_gamification_stats(p_user_id UUID)
RETURNS TABLE (
  coins INT,
  points INT,
  tier_level TEXT,
  total_spent BIGINT,
  total_activities INT,
  articles_read INT,
  quizzes_correct INT,
  tournaments_joined INT
) AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    us.coins,
    us.points,
    us.tier_level,
    us.total_spent,
    COALESCE(COUNT(DISTINCT al.id), 0)::INT,
    COALESCE(COUNT(DISTINCT CASE WHEN ap.read_completed THEN ap.article_id END), 0)::INT,
    COALESCE(COUNT(DISTINCT CASE WHEN qr.is_correct THEN qr.quiz_id END), 0)::INT,
    COALESCE(COUNT(DISTINCT tp.tournament_id), 0)::INT
  FROM user_stats us
  LEFT JOIN activity_log al ON us.user_id = al.user_id
  LEFT JOIN article_progress ap ON us.user_id = ap.user_id
  LEFT JOIN quiz_results qr ON us.user_id = qr.user_id
  LEFT JOIN tournament_players tp ON us.user_id = tp.user_id AND tp.status = 'active'
  WHERE us.user_id = p_user_id
  GROUP BY us.coins, us.points, us.tier_level, us.total_spent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_player_suspended(
  p_player_id BIGINT,
  p_match_id INT
)
RETURNS TABLE (
  is_suspended BOOLEAN,
  suspension_reason TEXT,
  yellow_cards INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ps.is_active, FALSE),
    COALESCE(ps.suspension_reason, ''),
    COALESCE(ps.yellow_card_count, 0)
  FROM player_suspensions ps
  WHERE ps.player_id = p_player_id
    AND ps.is_active = TRUE
    AND (p_match_id IS NULL OR p_match_id >= COALESCE(ps.suspension_from_match, 0))
    AND (p_match_id IS NULL OR p_match_id <= COALESCE(ps.suspension_until_match, 999999))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (NEW.id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_stats();

GRANT EXECUTE ON FUNCTION award_points TO anon, authenticated;
GRANT EXECUTE ON FUNCTION award_coins_from_transaction TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_gamification_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_player_suspended TO anon, authenticated;

-- ============================================================================
-- FINAL: Verification Complete
-- ============================================================================

-- Test: Check that tables exist
-- SELECT to_regclass('public.venues') IS NOT NULL as venues_exists,
--        to_regclass('public.tournaments') IS NOT NULL as tournaments_exists,
--        to_regclass('public.user_stats') IS NOT NULL as user_stats_exists,
--        to_regclass('public.user_roles') IS NOT NULL as user_roles_exists;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
