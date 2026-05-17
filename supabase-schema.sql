-- Stadione database schema and seed data
CREATE TABLE venues (id integer primary key, name text not null, city text, sport text, price integer, rating numeric, reviews integer, color text);
CREATE TABLE venue_tags (venue_id integer references venues(id), tag text not null, primary key (venue_id, tag));
CREATE TABLE tournaments (id serial primary key, name text not null, sport text, format text, teams integer, status text default 'open', prize integer, reg_fee integer default 0, registration_type text default 'individual', slot_lock_minutes integer default 15, age_min integer default 0, age_max integer default 0, start_date text, color text, host text, participants integer default 0, classification text default 'community', operator_type text default 'community', is_verified boolean default false, verification_status text default 'unverified', verification_badge text, verification_reviewed_at timestamptz);
CREATE TABLE tournament_operator_verification_requests (id serial primary key, tournament_id integer references tournaments(id) on delete cascade, requester_user_id text not null, requester_name text not null, requester_email text not null, operator_type text not null default 'community', requested_classification text not null default 'community', documents jsonb default '{}'::jsonb, status text not null default 'pending', admin_notes text, reviewed_by text, reviewed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
CREATE TABLE tournament_registrations (
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
	unique (tournament_id, user_id)
);
CREATE TABLE tournament_registration_roster (
	id bigserial primary key,
	registration_id bigint not null references tournament_registrations(id) on delete cascade,
	tournament_id integer not null references tournaments(id) on delete cascade,
	player_name text not null,
	player_identifier text not null,
	date_of_birth date,
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);
CREATE TABLE app_roles (
	role text primary key,
	display_name text,
	description text,
	parent_role text references app_roles(role),
	hierarchy_level integer default 0,
	scope_type text default 'platform',
	is_system boolean default true,
	created_at timestamptz default now()
);
CREATE TABLE app_permissions (
	permission text primary key,
	display_name text,
	description text,
	module text,
	created_at timestamptz default now()
);
CREATE TABLE role_permissions (
	role text not null references app_roles(role) on delete cascade,
	permission text not null references app_permissions(permission) on delete cascade,
	created_at timestamptz default now(),
	created_by uuid references auth.users(id),
	primary key (role, permission)
);
CREATE TABLE user_roles (user_id uuid not null references auth.users(id) on delete cascade, role text not null references app_roles(role) on delete cascade, granted_at timestamptz default now(), granted_by uuid references auth.users(id), primary key (user_id, role));
CREATE TABLE admin_audit_logs (
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
CREATE TABLE tournament_standings (tournament_id integer references tournaments(id), pos integer, team text, p integer, w integer, d integer, l integer, gf integer, ga integer, pts integer, primary key (tournament_id, pos));
CREATE TABLE tournament_schedule (tournament_id integer references tournaments(id), entry_id integer primary key, date text, home text, away text, score text, status text);
CREATE TABLE tournament_bracket_rounds (id serial primary key, tournament_id integer references tournaments(id), round_order integer, name text);
CREATE TABLE tournament_bracket_matches (id serial primary key, round_id integer references tournament_bracket_rounds(id), p1 text, p2 text, s1 integer, s2 integer, w integer);
CREATE TABLE news (id integer primary key, category text, title text, excerpt text, author text, date text, read_time text, featured boolean, color text);
CREATE TABLE coaches (id integer primary key, name text, sport text, exp integer, rating numeric, sessions integer, price integer, initial text);
CREATE TABLE coach_certs (coach_id integer references coaches(id), cert text, primary key(coach_id, cert));
CREATE TABLE coach_extra (coach_id integer primary key references coaches(id), bio text, location text);
CREATE TABLE coach_languages (coach_id integer references coaches(id), language text, primary key(coach_id, language));
CREATE TABLE coach_schedule (coach_id integer references coaches(id), schedule_line text, primary key(coach_id, schedule_line));
CREATE TABLE coach_programs (coach_id integer references coaches(id), program_id integer, name text, price integer, duration text, description text, primary key(coach_id, program_id));
CREATE TABLE chats (id integer primary key, coach_id integer references coaches(id), name text, sport text, initial text, online boolean, last_msg text, time text, unread integer);
CREATE TABLE chat_messages (chat_id integer references chats(id), message_id integer, sender text, text text, time text, primary key(chat_id, message_id));

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

-- RLS for role-backed verification workflow
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_operator_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registration_roster ENABLE ROW LEVEL SECURITY;

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

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Payment proof objects are publicly readable"
	ON storage.objects FOR SELECT
	USING (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated users can upload payment proofs"
	ON storage.objects FOR INSERT
	WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

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

CREATE OR REPLACE FUNCTION public.admin_create_user_account(
	p_email text,
	p_password text,
	p_full_name text DEFAULT NULL,
	p_role text DEFAULT 'general_user'
)
RETURNS TABLE (
	user_id uuid,
	email text,
	full_name text,
	role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
	v_email text := lower(trim(COALESCE(p_email, '')));
	v_password text := COALESCE(p_password, '');
	v_full_name text := NULLIF(trim(COALESCE(p_full_name, '')), '');
	v_role text := lower(trim(COALESCE(p_role, 'general_user')));
	v_user_id uuid := gen_random_uuid();
BEGIN
	IF NOT public.has_app_role('super_admin') THEN
		RAISE EXCEPTION 'Unauthorized';
	END IF;

	IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
		RAISE EXCEPTION 'Invalid email';
	END IF;

	IF length(v_password) < 8 THEN
		RAISE EXCEPTION 'Password must be at least 8 characters';
	END IF;

	IF NOT EXISTS (SELECT 1 FROM public.app_roles ar WHERE ar.role = v_role) THEN
		RAISE EXCEPTION 'Role % is not registered in app_roles', v_role;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM auth.users u
		WHERE lower(u.email::text) = v_email
	) THEN
		RAISE EXCEPTION 'Email % is already registered', v_email;
	END IF;

	INSERT INTO auth.users (
		id,
		instance_id,
		aud,
		role,
		email,
		encrypted_password,
		email_confirmed_at,
		raw_user_meta_data,
		raw_app_meta_data,
		is_super_admin,
		created_at,
		updated_at,
		confirmation_token,
		recovery_token,
		email_change_token_new,
		email_change
	) VALUES (
		v_user_id,
		'00000000-0000-0000-0000-000000000000',
		'authenticated',
		'authenticated',
		v_email,
		crypt(v_password, gen_salt('bf')),
		now(),
		jsonb_build_object('name', v_full_name),
		jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
		false,
		now(),
		now(),
		'',
		'',
		'',
		''
	);

	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_name = 'profiles'
	) THEN
		INSERT INTO public.profiles (id, email, name, created_at)
		VALUES (v_user_id, v_email, COALESCE(v_full_name, split_part(v_email, '@', 1)), now())
		ON CONFLICT (id) DO UPDATE
		SET email = EXCLUDED.email,
		    name = EXCLUDED.name;
	END IF;

	INSERT INTO public.user_roles (user_id, role, granted_by)
	VALUES (v_user_id, v_role, auth.uid())
	ON CONFLICT ON CONSTRAINT user_roles_pkey DO UPDATE
	SET granted_by = EXCLUDED.granted_by,
	    granted_at = now();

	RETURN QUERY
	SELECT
		v_user_id,
		v_email,
		COALESCE(v_full_name, split_part(v_email, '@', 1)),
		v_role;
END;
$$;

-- Data inserts
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (1,'GOR Senayan Mini Soccer','Jakarta Pusat','Sepakbola',450000,4.8,234,'#0F4D2A');
INSERT INTO venue_tags (venue_id,tag) VALUES (1,'Outdoor');
INSERT INTO venue_tags (venue_id,tag) VALUES (1,'Floodlight');
INSERT INTO venue_tags (venue_id,tag) VALUES (1,'Parkir');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (2,'Padel Club Kemang','Jakarta Selatan','Padel',380000,4.9,156,'#1F3A8A');
INSERT INTO venue_tags (venue_id,tag) VALUES (2,'Indoor');
INSERT INTO venue_tags (venue_id,tag) VALUES (2,'AC');
INSERT INTO venue_tags (venue_id,tag) VALUES (2,'Lockers');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (3,'Aquatic Center Kelapa Gading','Jakarta Utara','Renang',75000,4.6,412,'#0E7490');
INSERT INTO venue_tags (venue_id,tag) VALUES (3,'Olympic');
INSERT INTO venue_tags (venue_id,tag) VALUES (3,'Heated');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (4,'Futsal Arena Tebet','Jakarta Selatan','Futsal',220000,4.7,89,'#92400E');
INSERT INTO venue_tags (venue_id,tag) VALUES (4,'Indoor');
INSERT INTO venue_tags (venue_id,tag) VALUES (4,'Vinyl');
INSERT INTO venue_tags (venue_id,tag) VALUES (4,'AC');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (5,'Lapangan Cilandak Sport Park','Jakarta Selatan','Sepakbola',850000,4.9,178,'#0F4D2A');
INSERT INTO venue_tags (venue_id,tag) VALUES (5,'Rumput Sintetis');
INSERT INTO venue_tags (venue_id,tag) VALUES (5,'Locker');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (6,'Splash Pool Bintaro','Tangsel','Renang',60000,4.5,256,'#0E7490');
INSERT INTO venue_tags (venue_id,tag) VALUES (6,'Family');
INSERT INTO venue_tags (venue_id,tag) VALUES (6,'Cafe');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (7,'Padel Garage BSD','Tangsel','Padel',320000,4.7,92,'#1F3A8A');
INSERT INTO venue_tags (venue_id,tag) VALUES (7,'Outdoor');
INSERT INTO venue_tags (venue_id,tag) VALUES (7,'Lighting');
INSERT INTO venues (id,name,city,sport,price,rating,reviews,color) VALUES (8,'Futsal Stadium Cibubur','Jakarta Timur','Futsal',180000,4.4,145,'#92400E');
INSERT INTO venue_tags (venue_id,tag) VALUES (8,'Indoor');
INSERT INTO venue_tags (venue_id,tag) VALUES (8,'Cafe');
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status,verification_badge,verification_reviewed_at) VALUES (1,'Liga Futsal Jakarta 2026','Futsal','Liga',12,'Berlangsung',50000000,'15 Mar 2026','#92400E','StadioneSports',156,'official','federation',true,'approved','Verified Federation',now());
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (1,1,'FC Senayan United',8,7,1,0,32,8,22);
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (1,2,'Tebet Tigers FC',8,6,1,1,28,11,19);
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (1,3,'Kemang Kings',8,5,2,1,24,14,17);
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (1,4,'Cilandak Warriors',8,4,2,2,19,15,14);
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (1,5,'BSD Eagles',8,3,2,3,17,18,11);
INSERT INTO tournament_standings (tournament_id,pos,team,p,w,d,l,gf,ga,pts) VALUES (1,6,'Cibubur FC',8,2,1,5,12,22,7);
INSERT INTO tournament_schedule (tournament_id,entry_id,date,home,away,score,status) VALUES (1,101,'12 Mei','FC Senayan United','Tebet Tigers FC',NULL,'live');
INSERT INTO tournament_schedule (tournament_id,entry_id,date,home,away,score,status) VALUES (1,102,'13 Mei','Kemang Kings','Cilandak Warriors',NULL,'upcoming');
INSERT INTO tournament_schedule (tournament_id,entry_id,date,home,away,score,status) VALUES (1,103,'14 Mei','BSD Eagles','Cibubur FC',NULL,'upcoming');
INSERT INTO tournament_schedule (tournament_id,entry_id,date,home,away,score,status) VALUES (1,104,'08 Mei','Tebet Tigers FC','Kemang Kings','3-2','done');
INSERT INTO tournament_schedule (tournament_id,entry_id,date,home,away,score,status) VALUES (1,105,'07 Mei','FC Senayan United','BSD Eagles','4-0','done');
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status,verification_badge,verification_reviewed_at) VALUES (2,'Stadione Padel Open','Padel','Knockout',16,'Pendaftaran',25000000,'20 Jun 2026','#1F3A8A','Padel Club Kemang',24,'community','academy',false,'pending','Community Host',NULL);
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status,verification_badge,verification_reviewed_at) VALUES (3,'Liga Esports Mobile Legends','Esports','Liga',24,'Berlangsung',100000000,'01 Apr 2026','#7C3AED','Stadione × MPL',312,'official','eo',true,'approved','Verified EO',now());
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status,verification_badge,verification_reviewed_at) VALUES (4,'Tennis Singles Championship','Tennis','Knockout',32,'Pendaftaran',30000000,'10 Jul 2026','#15803D','Senayan Tennis Club',28,'community','community',false,'unverified','Community Host',NULL);
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status,verification_badge,verification_reviewed_at) VALUES (5,'Liga Badminton Antar-Klub','Badminton','Liga',8,'Berlangsung',15000000,'05 Apr 2026','#B91C1C','PB Jakarta',64,'official','federation',true,'approved','Verified Federation',now());
INSERT INTO tournaments (id,name,sport,format,teams,status,prize,start_date,color,host,participants,classification,operator_type,is_verified,verification_status,verification_badge,verification_reviewed_at) VALUES (6,'Pingpong Open Tournament','Pingpong','Knockout',16,'Pendaftaran',8000000,'25 May 2026','#EA580C','Komunitas TM Jakarta',12,'fun_game','community',false,'unverified','Community Host',NULL);
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (1,'Sepakbola','Timnas U-23 Cetak Sejarah, Lolos Final Piala AFF','Garuda Muda menundukkan Vietnam 2-1 lewat gol dramatis di babak tambahan.','Rendy Pratama','07 Mei 2026','4 mnt',true,'#E11D2E');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (2,'Futsal','Liga Futsal Profesional Resmi Bergulir Bulan Depan','Format baru, 16 klub, hadiah total 2 miliar rupiah.','Maya Hartono','06 Mei 2026','3 mnt',false,'#92400E');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (3,'Badminton','Jonatan Christie Juara Singapore Open 2026','Comeback dramatis dari set pertama untuk mengamankan gelar.','Bagas Nurhakim','05 Mei 2026','5 mnt',false,'#B91C1C');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (4,'Padel','Demam Padel Indonesia: 200+ Klub Baru di 2026','Olahraga raket asal Spanyol ini meledak popularitasnya.','Sarah Kusuma','04 Mei 2026','6 mnt',false,'#1F3A8A');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (5,'Esports','MPL Season 13 Catat Penonton Tertinggi Sepanjang Sejarah','Final EVOS vs RRQ tembus 5 juta concurrent viewers.','Dimas Pradana','04 Mei 2026','4 mnt',false,'#7C3AED');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (6,'Tennis','Indonesia Open Tennis Datangkan Pemain Top 50 Dunia','Turnamen ATP Challenger tahun ini lebih bergengsi.','Lisa Andriani','03 Mei 2026','3 mnt',false,'#15803D');
INSERT INTO news (id,category,title,excerpt,author,date,read_time,featured,color) VALUES (7,'Renang','Atlet Renang Nasional Pecahkan Rekor Asia 200m Gaya Bebas','Catatan baru di kejuaraan terbuka di Tokyo.','Aldi Surya','02 Mei 2026','4 mnt',false,'#0E7490');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (1,'Coach Bambang Sutrisno','Sepakbola',12,4.9,234,250000,'BS');
INSERT INTO coach_certs (coach_id,cert) VALUES (1,'AFC C-License');
INSERT INTO coach_certs (coach_id,cert) VALUES (1,'Mantan Pemain Persija');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (2,'Coach Ratna Dewi','Renang',8,4.8,412,180000,'RD');
INSERT INTO coach_certs (coach_id,cert) VALUES (2,'SI Pelatih Nasional');
INSERT INTO coach_certs (coach_id,cert) VALUES (2,'Olimpiade 2016');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (3,'Coach Andre Wijaya','Padel',6,5,89,350000,'AW');
INSERT INTO coach_certs (coach_id,cert) VALUES (3,'Padel Pro Spain');
INSERT INTO coach_certs (coach_id,cert) VALUES (3,'Top 100 ATP Padel');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (4,'Coach Dewi Lestari','Badminton',15,4.9,567,220000,'DL');
INSERT INTO coach_certs (coach_id,cert) VALUES (4,'PB Djarum Alumni');
INSERT INTO coach_certs (coach_id,cert) VALUES (4,'BWF Coach Level 2');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (5,'Coach Rizky Pratama','Futsal',9,4.7,178,200000,'RP');
INSERT INTO coach_certs (coach_id,cert) VALUES (5,'AFC Futsal C-License');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (6,'Coach Maria Santoso','Tennis',11,4.8,290,280000,'MS');
INSERT INTO coach_certs (coach_id,cert) VALUES (6,'ITF Level 2');
INSERT INTO coach_certs (coach_id,cert) VALUES (6,'Ex-Davis Cup Coach');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (7,'Coach Hendra Kurniawan','Pingpong',7,4.6,145,150000,'HK');
INSERT INTO coach_certs (coach_id,cert) VALUES (7,'ITTF Level 1');
INSERT INTO coach_certs (coach_id,cert) VALUES (7,'PORDA Champion');
INSERT INTO coaches (id,name,sport,exp,rating,sessions,price,initial) VALUES (8,'Coach Galih Eka','Esports',5,4.9,412,120000,'GE');
INSERT INTO coach_certs (coach_id,cert) VALUES (8,'Mythic Glory ML');
INSERT INTO coach_certs (coach_id,cert) VALUES (8,'Coach RRQ Hoshi');
INSERT INTO coach_extra (coach_id,bio,location) VALUES (1,'Mantan pemain profesional Persija Jakarta dengan 12 tahun pengalaman bermain di liga 1. Setelah pensiun, fokus mengembangkan generasi muda sepakbola Indonesia melalui pendekatan teknis modern dan psikologi olahraga.','Jakarta Selatan');
INSERT INTO coach_languages (coach_id,language) VALUES (1,'Indonesia');
INSERT INTO coach_languages (coach_id,language) VALUES (1,'English');
INSERT INTO coach_schedule (coach_id,schedule_line) VALUES (1,'Sen-Jum: 06:00 - 21:00');
INSERT INTO coach_schedule (coach_id,schedule_line) VALUES (1,'Sabtu: 07:00 - 19:00');
INSERT INTO coach_schedule (coach_id,schedule_line) VALUES (1,'Minggu: 08:00 - 17:00');
INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (1,1,'Sesi Privat 1-on-1',250000,'60 menit','Latihan privat fokus teknik dan stamina');
INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (1,2,'Sesi Berdua',175000,'60 menit','Latihan untuk dua orang, biaya per orang');
INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (1,3,'Latihan Tim (Max 12)',1200000,'90 menit','Latihan kolektif untuk satu tim');
INSERT INTO coach_extra (coach_id,bio,location) VALUES (3,'Pelatih padel bersertifikasi Spanyol. Pernah bermain di sirkuit ATP Padel hingga peringkat 100 dunia. Berfokus pada teknik dasar yang kuat dan strategi bermain berpasangan.','Jakarta Selatan & BSD');
INSERT INTO coach_languages (coach_id,language) VALUES (3,'Indonesia');
INSERT INTO coach_languages (coach_id,language) VALUES (3,'English');
INSERT INTO coach_languages (coach_id,language) VALUES (3,'Español');
INSERT INTO coach_schedule (coach_id,schedule_line) VALUES (3,'Sen-Jum: 14:00 - 22:00');
INSERT INTO coach_schedule (coach_id,schedule_line) VALUES (3,'Sab-Min: 08:00 - 21:00');
INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (3,1,'Sesi Privat',350000,'60 menit','Privat dengan analisis video');
INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (3,2,'Klinik Pemula',200000,'90 menit','Group max 4 orang, kenalan dasar');
INSERT INTO coach_programs (coach_id,program_id,name,price,duration,description) VALUES (3,3,'Strategi Pasangan',500000,'90 menit','Khusus pasangan tetap, taktik');
INSERT INTO chats (id,coach_id,name,sport,initial,online,last_msg,time,unread) VALUES (1,1,'Coach Bambang Sutrisno','Sepakbola','BS',true,'Sip, sampai ketemu besok jam 7 ya!','5 mnt',0);
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (1,1,'coach','Halo Aldi! Gimana kondisi kakimu setelah latihan kemarin?','14:30');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (1,2,'me','Udah lebih baik coach, masih sedikit pegal tapi udah bisa lari pelan','14:32');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (1,3,'coach','Bagus. Besok kita fokus ke teknik finishing ya. Bawa shin guard juga.','14:33');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (1,4,'coach','Oh iya, latihan stretching 10 menit sebelum tidur. Penting buat recovery.','14:33');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (1,5,'me','Siap coach. Jam 7 di lapangan biasa kan?','14:35');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (1,6,'coach','Sip, sampai ketemu besok jam 7 ya!','14:36');
INSERT INTO chats (id,coach_id,name,sport,initial,online,last_msg,time,unread) VALUES (2,3,'Coach Andre Wijaya','Padel','AW',false,'Boleh, slot Sabtu sore masih kosong','2 jam',2);
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (2,1,'me','Coach, masih ada slot weekend ini?','12:15');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (2,2,'coach','Boleh, slot Sabtu sore masih kosong','12:30');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (2,3,'coach','Jam 16:00 atau 17:00. Mau yang mana?','12:31');
INSERT INTO chats (id,coach_id,name,sport,initial,online,last_msg,time,unread) VALUES (3,2,'Coach Ratna Dewi','Renang','RD',true,'Latihan nafas hari ini bagus banget!','1 hari',0);
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (3,1,'me','Coach, hari ini saya berhasil 50m tanpa berhenti!','08:30');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (3,2,'coach','Wah keren! Itu progres besar','08:42');
INSERT INTO chat_messages (chat_id,message_id,sender,text,time) VALUES (3,3,'coach','Latihan nafas hari ini bagus banget! Pertahankan ya','08:45');
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (2,1,'Quarter Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (1,'Andre & Maya','Bagas & Lina',6,4,0);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (1,'Reza & Dani','Riko & Sari',7,5,0);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (1,'Aldi & Putri','Bayu & Tia',6,7,1);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (1,'Yoga & Mega','Rendy & Nia',6,3,0);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (2,2,'Semi Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (2,'Andre & Maya','Reza & Dani',6,5,0);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (2,'Bayu & Tia','Yoga & Mega',NULL,NULL,NULL);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (2,3,'Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (3,'Andre & Maya','TBD',NULL,NULL,NULL);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (4,1,'Quarter Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (4,'Rendy P.','Aldi K.',2,1,0);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (4,'Maya H.','Sari D.',2,0,0);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (4,'Bagas N.','Reza A.',1,2,1);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (4,'Tito S.','Dimas P.',2,1,0);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (4,2,'Semi Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (5,'Rendy P.','Maya H.',NULL,NULL,NULL);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (5,'Reza A.','Tito S.',NULL,NULL,NULL);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (4,3,'Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (6,'TBD','TBD',NULL,NULL,NULL);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (6,1,'Semi Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (7,'Hendra K.','Putra A.',3,1,0);
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (7,'Galih E.','Bayu L.',2,3,1);
INSERT INTO tournament_bracket_rounds (tournament_id,round_order,name) VALUES (6,2,'Final');
INSERT INTO tournament_bracket_matches (round_id,p1,p2,s1,s2,w) VALUES (8,'Hendra K.','Bayu L.',NULL,NULL,NULL);
