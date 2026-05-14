-- Fix RLS and privileges for user activity history tables
-- Run this once in Supabase SQL Editor after supabase-community.sql

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
  community_id BIGINT NOT NULL,
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

ALTER TABLE IF EXISTS user_venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_articles_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_tournament_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_community_memberships_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_venue_bookings' AND policyname = 'Users can insert their own venue bookings'
  ) THEN
    CREATE POLICY "Users can insert their own venue bookings"
      ON user_venue_bookings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_articles_read' AND policyname = 'Users can insert their own articles read'
  ) THEN
    CREATE POLICY "Users can insert their own articles read"
      ON user_articles_read FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_tournament_participations' AND policyname = 'Users can insert their own tournament participations'
  ) THEN
    CREATE POLICY "Users can insert their own tournament participations"
      ON user_tournament_participations FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_community_memberships_log' AND policyname = 'Users can insert their own community memberships log'
  ) THEN
    CREATE POLICY "Users can insert their own community memberships log"
      ON user_community_memberships_log FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_training_enrollments' AND policyname = 'Users can insert their own training enrollments'
  ) THEN
    CREATE POLICY "Users can insert their own training enrollments"
      ON user_training_enrollments FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_activity_log' AND policyname = 'Users can insert their own activity log'
  ) THEN
    CREATE POLICY "Users can insert their own activity log"
      ON user_activity_log FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

GRANT SELECT, INSERT ON user_venue_bookings TO authenticated;
GRANT SELECT, INSERT ON user_articles_read TO authenticated;
GRANT SELECT, INSERT ON user_tournament_participations TO authenticated;
GRANT SELECT, INSERT ON user_community_memberships_log TO authenticated;
GRANT SELECT, INSERT ON user_training_enrollments TO authenticated;
GRANT SELECT, INSERT ON user_activity_log TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE user_venue_bookings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_articles_read_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_tournament_participations_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_community_memberships_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_training_enrollments_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_activity_log_id_seq TO authenticated;
