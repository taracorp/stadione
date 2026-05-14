-- ============================================================================
-- STADIONE FINAL MIGRATION: All Tables and Policies (Robust Version)
-- ============================================================================
-- Step 1: Create all tables first (no policies yet)
-- ============================================================================

-- Community Tables
CREATE TABLE IF NOT EXISTS sport_communities (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, province TEXT NOT NULL, city TEXT NOT NULL,
  sport TEXT NOT NULL, members_count INT DEFAULT 0, activity_level TEXT DEFAULT 'New',
  gender TEXT DEFAULT 'Putra/Putri', skill_level TEXT DEFAULT 'Beginner',
  community_type TEXT DEFAULT 'Trending', tagline TEXT, verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_memberships (
  id BIGSERIAL PRIMARY KEY, community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_feed_posts (
  id BIGSERIAL PRIMARY KEY, community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL, author_role TEXT DEFAULT 'member', content TEXT NOT NULL,
  likes_count INT DEFAULT 0, comments_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_events (
  id BIGSERIAL PRIMARY KEY, community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, event_type TEXT DEFAULT 'sparring', status TEXT DEFAULT 'upcoming',
  event_date TEXT, time_label TEXT, location TEXT, attendees_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_chat_messages (
  id BIGSERIAL PRIMARY KEY, community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL, sender_role TEXT DEFAULT 'member', message TEXT NOT NULL, sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_trial_bookings (
  id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  academy_name TEXT NOT NULL, academy_city TEXT, participant_name TEXT, participant_age TEXT,
  trial_date TEXT, trial_time TEXT, contact_number TEXT, notes TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Tracking Tables
CREATE TABLE IF NOT EXISTS user_venue_bookings (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id BIGINT NOT NULL, venue_name TEXT, venue_city TEXT, booking_date TEXT NOT NULL,
  booking_time TEXT, duration_hours INT DEFAULT 1, sport TEXT, status TEXT DEFAULT 'confirmed',
  booking_created_at TIMESTAMPTZ DEFAULT NOW(), booking_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_articles_read (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id BIGINT, article_title TEXT, article_category TEXT, read_date TIMESTAMPTZ DEFAULT NOW(),
  read_duration_seconds INT, completion_percentage INT DEFAULT 100, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_tournament_participations (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id BIGINT NOT NULL, tournament_name TEXT, sport TEXT, registration_type TEXT DEFAULT 'individual',
  registration_status TEXT DEFAULT 'registered', registration_date TIMESTAMPTZ DEFAULT NOW(),
  tournament_start_date TEXT, status TEXT DEFAULT 'registered', result_placement INT, result_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_community_memberships_log (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE, community_name TEXT, sport TEXT,
  joined_date TIMESTAMPTZ DEFAULT NOW(), status TEXT DEFAULT 'active', posts_count INT DEFAULT 0,
  events_attended INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_training_enrollments (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id BIGINT, academy_name TEXT, academy_city TEXT, program_name TEXT, sport TEXT,
  enrollment_date TIMESTAMPTZ DEFAULT NOW(), status TEXT DEFAULT 'enrolled', progress_percentage INT DEFAULT 0,
  classes_attended INT DEFAULT 0, total_classes INT DEFAULT 0, completion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, activity_category TEXT, activity_title TEXT NOT NULL, activity_description TEXT,
  activity_date TIMESTAMPTZ DEFAULT NOW(), activity_metadata JSONB, status TEXT DEFAULT 'active',
  is_completed BOOLEAN DEFAULT FALSE, completion_date TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registration Tables
CREATE TABLE IF NOT EXISTS public.teams (
  id BIGSERIAL PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tournament_id BIGINT NOT NULL, coordinator_id UUID NOT NULL, name TEXT NOT NULL, logo_url TEXT,
  city TEXT, province TEXT, status TEXT DEFAULT 'active', notes TEXT
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id BIGSERIAL PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  team_id BIGINT NOT NULL REFERENCES public.teams(id), user_id UUID NOT NULL, player_name TEXT NOT NULL, player_identifier TEXT,
  date_of_birth DATE, position TEXT, jersey_name TEXT, status TEXT DEFAULT 'pending', verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID, age_valid BOOLEAN, gender_valid BOOLEAN, identity_valid BOOLEAN, suspension_flag BOOLEAN DEFAULT FALSE, notes TEXT
);

CREATE TABLE IF NOT EXISTS public.registrations (
  id BIGSERIAL PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tournament_id BIGINT NOT NULL, user_id UUID NOT NULL, team_id BIGINT REFERENCES public.teams(id),
  registrant_name TEXT NOT NULL, registrant_email TEXT NOT NULL, registration_type TEXT NOT NULL,
  registration_status TEXT DEFAULT 'idle', payment_status TEXT DEFAULT 'unpaid', base_fee DECIMAL(15,2),
  unique_transfer_amount DECIMAL(15,2), slot_expires_at TIMESTAMP WITH TIME ZONE, payment_method TEXT,
  payment_proof_url TEXT, payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE, awaiting_review BOOLEAN DEFAULT FALSE,
  admin_review_at TIMESTAMP WITH TIME ZONE, admin_reviewed_by UUID, admin_notes TEXT,
  roster_complete BOOLEAN DEFAULT FALSE, min_players_met BOOLEAN DEFAULT FALSE, notes TEXT
);

CREATE TABLE IF NOT EXISTS public.registration_history (
  id BIGSERIAL PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  registration_id BIGINT NOT NULL REFERENCES public.registrations(id), action TEXT NOT NULL,
  actor_id UUID, actor_type TEXT, old_status TEXT, new_status TEXT, details JSONB, notes TEXT
);

-- Gamification Tables
CREATE TABLE IF NOT EXISTS user_stats (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INT DEFAULT 0, points INT DEFAULT 0, tier_level TEXT DEFAULT 'Bronze', total_spent BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, points_earned INT NOT NULL, reference_id INT, metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_progress (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id INT NOT NULL, scroll_depth_percent INT DEFAULT 0, read_completed BOOLEAN DEFAULT FALSE,
  quiz_attempted BOOLEAN DEFAULT FALSE, quiz_correct BOOLEAN DEFAULT FALSE,
  reading_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), reading_completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS article_quiz (
  id BIGSERIAL PRIMARY KEY, article_id INT NOT NULL, question TEXT NOT NULL,
  option_a TEXT NOT NULL, option_b TEXT NOT NULL, option_c TEXT NOT NULL, option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL, explanation TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id BIGINT NOT NULL REFERENCES article_quiz(id) ON DELETE CASCADE, article_id INT NOT NULL,
  selected_answer TEXT NOT NULL, is_correct BOOLEAN NOT NULL, points_awarded INT DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id BIGSERIAL PRIMARY KEY, tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, team_id INT, player_number INT, position TEXT,
  player_name TEXT NOT NULL, jersey_name TEXT, status TEXT DEFAULT 'active',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_statistics (
  id BIGSERIAL PRIMARY KEY, tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INT, player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  goals INT DEFAULT 0, assists INT DEFAULT 0, yellow_cards INT DEFAULT 0, red_cards INT DEFAULT 0,
  minutes_played INT DEFAULT 0, rating NUMERIC(3,1), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_lineups (
  id BIGSERIAL PRIMARY KEY, tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INT, player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  starting_eleven BOOLEAN DEFAULT FALSE, substituted_at INT, lineup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_suspensions (
  id BIGSERIAL PRIMARY KEY, player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE, suspension_reason TEXT NOT NULL,
  yellow_card_count INT DEFAULT 0, suspension_from_match INT, suspension_until_match INT,
  is_active BOOLEAN DEFAULT TRUE, suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes (all with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_community_memberships_user_id ON community_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_community_id ON community_memberships (community_id);
CREATE INDEX IF NOT EXISTS idx_user_venue_bookings_user_created ON user_venue_bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_articles_read_user_date ON user_articles_read (user_id, read_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_tournament_participations_user ON user_tournament_participations (user_id, registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_community_memberships_log_user ON user_community_memberships_log (user_id, joined_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_training_enrollments_user ON user_training_enrollments (user_id, enrollment_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_date ON user_activity_log (user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_type ON user_activity_log (activity_type, user_id);
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
CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON public.registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON public.registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_teams_coordinator ON public.teams(coordinator_id);

-- Enable RLS on all tables
ALTER TABLE sport_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_trial_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_articles_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tournament_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_community_memberships_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_suspensions ENABLE ROW LEVEL SECURITY;

SELECT '✅ Step 1 Complete: All tables created successfully!' as status;
