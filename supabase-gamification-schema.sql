-- Stadione Gamification & Tournament Management Schema
-- Add these tables to your Supabase database after running the main schema

-- User Statistics & Rewards System
CREATE TABLE user_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INT DEFAULT 0,
  points INT DEFAULT 0,
  tier_level TEXT DEFAULT 'Bronze',
  total_spent BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Log for Points Earning
CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'login', 'article_read', 'trivia_correct', 'share', 'event_join', 'checkin', 'review', 'referral'
  points_earned INT NOT NULL,
  reference_id INT, -- article_id, tournament_id, etc
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Article Reading Progress & Quiz Tracking
CREATE TABLE article_progress (
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

-- Quiz Generation & Results
CREATE TABLE article_quiz (
  id BIGSERIAL PRIMARY KEY,
  article_id INT NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL, -- 'a', 'b', 'c', or 'd'
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz Results (per user, per article)
CREATE TABLE quiz_results (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id BIGINT NOT NULL REFERENCES article_quiz(id) ON DELETE CASCADE,
  article_id INT NOT NULL,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INT DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament Player Registration
CREATE TABLE tournament_players (
  id BIGSERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id INT,
  player_number INT,
  position TEXT,
  player_name TEXT NOT NULL,
  jersey_name TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'suspended', 'removed'
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Match Statistics (Goals, Assists, Cards, etc)
CREATE TABLE match_statistics (
  id BIGSERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INT, -- if tournament has match structure
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

-- Player Lineup (for matches)
CREATE TABLE player_lineups (
  id BIGSERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id INT,
  player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  starting_eleven BOOLEAN DEFAULT FALSE,
  substituted_at INT, -- minute when subbed in/out
  lineup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspension Records (Red/Yellow Card Accumulation)
CREATE TABLE player_suspensions (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES tournament_players(id) ON DELETE CASCADE,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  suspension_reason TEXT NOT NULL, -- 'red_card', 'yellow_card_accumulation', 'misconduct'
  yellow_card_count INT DEFAULT 0,
  suspension_from_match INT,
  suspension_until_match INT,
  is_active BOOLEAN DEFAULT TRUE,
  suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_article_progress_user_article ON article_progress(user_id, article_id);
CREATE INDEX idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX idx_tournament_players_tournament_id ON tournament_players(tournament_id);
CREATE INDEX idx_tournament_players_user_id ON tournament_players(user_id);
CREATE INDEX idx_match_statistics_player_id ON match_statistics(player_id);
CREATE INDEX idx_player_suspensions_player_id ON player_suspensions(player_id);
CREATE INDEX idx_player_suspensions_tournament_id ON player_suspensions(tournament_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_suspensions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own data
CREATE POLICY "Users can view their own stats"
  ON user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON user_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own activity log"
  ON activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own article progress"
  ON article_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own article progress"
  ON article_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own article progress"
  ON article_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view quiz results for articles they read"
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
