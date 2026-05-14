-- Stadione Community backend schema
-- Run this in Supabase SQL Editor to enable Community page membership persistence

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

INSERT INTO sport_communities (id, name, province, city, sport, members_count, activity_level, gender, skill_level, community_type, tagline, verified)
SELECT 1, 'Padel Jogja Community', 'DIY', 'Sleman', 'Padel', 1200, 'Active', 'Putra/Putri', 'Intermediate', 'Trending', 'Sparring mingguan, event fun game, dan matchmaking lawan dekat rumah.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sport_communities WHERE id = 1);

INSERT INTO sport_communities (id, name, province, city, sport, members_count, activity_level, gender, skill_level, community_type, tagline, verified)
SELECT 2, 'Jogja Runners Club', 'DIY', 'Yogyakarta', 'Lari', 860, 'Active', 'Putra/Putri', 'Beginner', 'Terdekat', 'Lari pagi, long run, tempo run, dan sharing rute aman di kota.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sport_communities WHERE id = 2);

INSERT INTO sport_communities (id, name, province, city, sport, members_count, activity_level, gender, skill_level, community_type, tagline, verified)
SELECT 3, 'Bandung Badminton Crew', 'Jawa Barat', 'Bandung', 'Badminton', 540, 'New', 'Putra', 'Advanced', 'Baru', 'Cari sparring, latihan teknik, dan turnamen komunitas akhir pekan.', FALSE
WHERE NOT EXISTS (SELECT 1 FROM sport_communities WHERE id = 3);

INSERT INTO sport_communities (id, name, province, city, sport, members_count, activity_level, gender, skill_level, community_type, tagline, verified)
SELECT 4, 'Jaksel Football Meetup', 'DKI Jakarta', 'Jakarta Selatan', 'Sepakbola', 2100, 'Active', 'Putra', 'Intermediate', 'Event Minggu Ini', 'Open game, mini tournament, dan komunitas yang aktif tiap minggu.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sport_communities WHERE id = 4);

INSERT INTO sport_communities (id, name, province, city, sport, members_count, activity_level, gender, skill_level, community_type, tagline, verified)
SELECT 5, 'Bali Cyclist Social', 'Bali', 'Denpasar', 'Sepeda', 430, 'New', 'Putra/Putri', 'Beginner', 'Komunitas Baru', 'Ride santai, endurance weekend, dan rute komunitas di Bali.', FALSE
WHERE NOT EXISTS (SELECT 1 FROM sport_communities WHERE id = 5);

INSERT INTO sport_communities (id, name, province, city, sport, members_count, activity_level, gender, skill_level, community_type, tagline, verified)
SELECT 6, 'Supporter Merah Putih', 'Jawa Tengah', 'Semarang', 'Supporter', 1250, 'Active', 'Putra/Putri', 'Beginner', 'Trending', 'Nobar, away day, dan diskusi seputar tim favorit.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sport_communities WHERE id = 6);

INSERT INTO community_feed_posts (community_id, author_name, author_role, content, likes_count, comments_count)
SELECT 1, 'Ayu', 'moderator', 'Sparring Jumat malam fixed jam 19:00. Siapa join?', 34, 8
WHERE NOT EXISTS (
  SELECT 1 FROM community_feed_posts
  WHERE community_id = 1 AND author_name = 'Ayu' AND content = 'Sparring Jumat malam fixed jam 19:00. Siapa join?'
);

INSERT INTO community_feed_posts (community_id, author_name, author_role, content, likes_count, comments_count)
SELECT 1, 'Raka', 'member', 'Ada video tips smash dari coach lokal. Bagus banget buat intermediate.', 22, 5
WHERE NOT EXISTS (
  SELECT 1 FROM community_feed_posts
  WHERE community_id = 1 AND author_name = 'Raka' AND content = 'Ada video tips smash dari coach lokal. Bagus banget buat intermediate.'
);

INSERT INTO community_feed_posts (community_id, author_name, author_role, content, likes_count, comments_count)
SELECT 2, 'Dina', 'member', 'Long run minggu ini rute baru lewat selatan kota. Pace santai aja.', 18, 3
WHERE NOT EXISTS (
  SELECT 1 FROM community_feed_posts
  WHERE community_id = 2 AND author_name = 'Dina' AND content = 'Long run minggu ini rute baru lewat selatan kota. Pace santai aja.'
);

INSERT INTO community_feed_posts (community_id, author_name, author_role, content, likes_count, comments_count)
SELECT 4, 'Andi', 'moderator', 'Mini tournament komunitas dibuka 8 slot, daftar sebelum Rabu.', 41, 12
WHERE NOT EXISTS (
  SELECT 1 FROM community_feed_posts
  WHERE community_id = 4 AND author_name = 'Andi' AND content = 'Mini tournament komunitas dibuka 8 slot, daftar sebelum Rabu.'
);

INSERT INTO community_feed_posts (community_id, author_name, author_role, content, likes_count, comments_count)
SELECT 6, 'Fajar', 'member', 'Nobar final minggu ini di kafe langganan, booking meja bareng ya.', 29, 7
WHERE NOT EXISTS (
  SELECT 1 FROM community_feed_posts
  WHERE community_id = 6 AND author_name = 'Fajar' AND content = 'Nobar final minggu ini di kafe langganan, booking meja bareng ya.'
);

INSERT INTO community_events (community_id, title, description, event_type, status, event_date, time_label, location, attendees_count)
SELECT 1, 'Padel Friday Sparring', 'Sparring level intermediate dan advanced.', 'sparring', 'upcoming', 'Jumat, 17 Mei', '19:00', 'Sleman Padel Court', 48
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE community_id = 1 AND title = 'Padel Friday Sparring');

INSERT INTO community_events (community_id, title, description, event_type, status, event_date, time_label, location, attendees_count)
SELECT 2, 'Jogja Sunrise Run', 'Lari bareng untuk beginner dan pace santai.', 'running', 'upcoming', 'Minggu, 19 Mei', '05:30', 'Alun-Alun Selatan', 31
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE community_id = 2 AND title = 'Jogja Sunrise Run');

INSERT INTO community_events (community_id, title, description, event_type, status, event_date, time_label, location, attendees_count)
SELECT 4, 'Jaksel Friendly Match', 'Matchmaking lawan selevel untuk open game mingguan.', 'match', 'live', 'Sabtu, 18 Mei', '16:00', 'Lapangan Bintaro', 64
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE community_id = 4 AND title = 'Jaksel Friendly Match');

INSERT INTO community_events (community_id, title, description, event_type, status, event_date, time_label, location, attendees_count)
SELECT 6, 'Supporter Night Watch', 'Nobar pertandingan dan diskusi tim favorit.', 'watch_party', 'upcoming', 'Sabtu, 18 Mei', '20:00', 'Semarang Fanbase Hub', 85
WHERE NOT EXISTS (SELECT 1 FROM community_events WHERE community_id = 6 AND title = 'Supporter Night Watch');

INSERT INTO community_chat_messages (community_id, sender_name, sender_role, message)
SELECT 1, 'Ayu', 'moderator', 'Reminder: datang 15 menit lebih awal untuk warming up.'
WHERE NOT EXISTS (SELECT 1 FROM community_chat_messages WHERE community_id = 1 AND sender_name = 'Ayu' AND message = 'Reminder: datang 15 menit lebih awal untuk warming up.');

INSERT INTO community_chat_messages (community_id, sender_name, sender_role, message)
SELECT 1, 'Raka', 'member', 'Siap, saya bawa bola cadangan juga.'
WHERE NOT EXISTS (SELECT 1 FROM community_chat_messages WHERE community_id = 1 AND sender_name = 'Raka' AND message = 'Siap, saya bawa bola cadangan juga.');

INSERT INTO community_chat_messages (community_id, sender_name, sender_role, message)
SELECT 2, 'Dina', 'member', 'Siapa yang join recovery run pagi ini?'
WHERE NOT EXISTS (SELECT 1 FROM community_chat_messages WHERE community_id = 2 AND sender_name = 'Dina' AND message = 'Siapa yang join recovery run pagi ini?');

INSERT INTO community_chat_messages (community_id, sender_name, sender_role, message)
SELECT 4, 'Andi', 'moderator', 'Slot match ke-2 masih kosong, drop nama tim di sini.'
WHERE NOT EXISTS (SELECT 1 FROM community_chat_messages WHERE community_id = 4 AND sender_name = 'Andi' AND message = 'Slot match ke-2 masih kosong, drop nama tim di sini.');

INSERT INTO community_chat_messages (community_id, sender_name, sender_role, message)
SELECT 6, 'Fajar', 'member', 'Nobar jam 8 ya, jangan telat.'
WHERE NOT EXISTS (SELECT 1 FROM community_chat_messages WHERE community_id = 6 AND sender_name = 'Fajar' AND message = 'Nobar jam 8 ya, jangan telat.');

INSERT INTO academy_trial_bookings (academy_name, academy_city, participant_name, participant_age, trial_date, trial_time, contact_number, notes, status)
SELECT 'Garuda Football Academy', 'Sleman', 'Aldi Pratama', '12', 'Sabtu, 25 Mei', '08:00', '081234567890', 'Ingin trial ku8-ku16 dan cek level dasar.', 'confirmed'
WHERE NOT EXISTS (
  SELECT 1 FROM academy_trial_bookings
  WHERE academy_name = 'Garuda Football Academy'
    AND participant_name = 'Aldi Pratama'
    AND trial_date = 'Sabtu, 25 Mei'
    AND trial_time = '08:00'
);

CREATE INDEX IF NOT EXISTS idx_community_memberships_user_id ON community_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_community_id ON community_memberships (community_id);
CREATE INDEX IF NOT EXISTS idx_community_feed_posts_community_created_at ON community_feed_posts (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_events_community_created_at ON community_events (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_chat_messages_community_sent_at ON community_chat_messages (community_id, sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_academy_trial_bookings_user_created_at ON academy_trial_bookings (user_id, created_at DESC);

ALTER TABLE sport_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_trial_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sport_communities' AND policyname = 'Anyone can view communities'
  ) THEN
    CREATE POLICY "Anyone can view communities"
      ON sport_communities FOR SELECT
      USING (TRUE);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_feed_posts' AND policyname = 'Anyone can view community feed posts'
  ) THEN
    CREATE POLICY "Anyone can view community feed posts"
      ON community_feed_posts FOR SELECT
      USING (TRUE);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_events' AND policyname = 'Anyone can view community events'
  ) THEN
    CREATE POLICY "Anyone can view community events"
      ON community_events FOR SELECT
      USING (TRUE);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_chat_messages' AND policyname = 'Anyone can view community chat messages'
  ) THEN
    CREATE POLICY "Anyone can view community chat messages"
      ON community_chat_messages FOR SELECT
      USING (TRUE);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_memberships' AND policyname = 'Users can view their own community memberships'
  ) THEN
    CREATE POLICY "Users can view their own community memberships"
      ON community_memberships FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'academy_trial_bookings' AND policyname = 'Users can view their own academy trial bookings'
  ) THEN
    CREATE POLICY "Users can view their own academy trial bookings"
      ON academy_trial_bookings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'academy_trial_bookings' AND policyname = 'Users can book academy trials'
  ) THEN
    CREATE POLICY "Users can book academy trials"
      ON academy_trial_bookings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_memberships' AND policyname = 'Users can join communities'
  ) THEN
    CREATE POLICY "Users can join communities"
      ON community_memberships FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- ========== USER ACTIVITY HISTORY TABLES ==========
-- Comprehensive tracking of all user activities across the platform

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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_venue_bookings_user_created ON user_venue_bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_articles_read_user_date ON user_articles_read (user_id, read_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_tournament_participations_user ON user_tournament_participations (user_id, registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_community_memberships_log_user ON user_community_memberships_log (user_id, joined_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_training_enrollments_user ON user_training_enrollments (user_id, enrollment_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_date ON user_activity_log (user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_type ON user_activity_log (activity_type, user_id);

-- Enable RLS for all activity tables
ALTER TABLE user_venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_articles_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tournament_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_community_memberships_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own activity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_venue_bookings' AND policyname = 'Users can view their own venue bookings'
  ) THEN
    CREATE POLICY "Users can view their own venue bookings"
      ON user_venue_bookings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_articles_read' AND policyname = 'Users can view their own articles read'
  ) THEN
    CREATE POLICY "Users can view their own articles read"
      ON user_articles_read FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_tournament_participations' AND policyname = 'Users can view their own tournament participations'
  ) THEN
    CREATE POLICY "Users can view their own tournament participations"
      ON user_tournament_participations FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_community_memberships_log' AND policyname = 'Users can view their own community memberships log'
  ) THEN
    CREATE POLICY "Users can view their own community memberships log"
      ON user_community_memberships_log FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_training_enrollments' AND policyname = 'Users can view their own training enrollments'
  ) THEN
    CREATE POLICY "Users can view their own training enrollments"
      ON user_training_enrollments FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_activity_log' AND policyname = 'Users can view their own activity log'
  ) THEN
    CREATE POLICY "Users can view their own activity log"
      ON user_activity_log FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

GRANT SELECT ON sport_communities TO anon, authenticated;
GRANT SELECT, INSERT ON community_memberships TO authenticated;
GRANT SELECT ON community_feed_posts TO anon, authenticated;
GRANT SELECT ON community_events TO anon, authenticated;
GRANT SELECT ON community_chat_messages TO anon, authenticated;
GRANT SELECT, INSERT ON academy_trial_bookings TO authenticated;
