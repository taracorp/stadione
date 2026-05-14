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
