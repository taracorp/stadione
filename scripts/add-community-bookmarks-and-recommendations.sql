-- Community bookmarks and recommendation feedback
-- Run this in Supabase SQL Editor after the base community schema

CREATE TABLE IF NOT EXISTS community_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_recommendation_feedback (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL DEFAULT 'accepted' CHECK (verdict IN ('accepted', 'dismissed', 'viewed')),
  source TEXT DEFAULT 'community_discovery',
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_bookmarks_user_id ON community_bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_community_id ON community_bookmarks (community_id);
CREATE INDEX IF NOT EXISTS idx_community_recommendation_feedback_user_id ON community_recommendation_feedback (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_recommendation_feedback_community_id ON community_recommendation_feedback (community_id);

ALTER TABLE community_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_recommendation_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_bookmarks' AND policyname = 'Users can view their own community bookmarks'
  ) THEN
    CREATE POLICY "Users can view their own community bookmarks"
      ON community_bookmarks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_bookmarks' AND policyname = 'Users can insert their own community bookmarks'
  ) THEN
    CREATE POLICY "Users can insert their own community bookmarks"
      ON community_bookmarks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_bookmarks' AND policyname = 'Users can delete their own community bookmarks'
  ) THEN
    CREATE POLICY "Users can delete their own community bookmarks"
      ON community_bookmarks FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_recommendation_feedback' AND policyname = 'Users can view their own community recommendation feedback'
  ) THEN
    CREATE POLICY "Users can view their own community recommendation feedback"
      ON community_recommendation_feedback FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_recommendation_feedback' AND policyname = 'Users can insert their own community recommendation feedback'
  ) THEN
    CREATE POLICY "Users can insert their own community recommendation feedback"
      ON community_recommendation_feedback FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_recommendation_feedback' AND policyname = 'Users can update their own community recommendation feedback'
  ) THEN
    CREATE POLICY "Users can update their own community recommendation feedback"
      ON community_recommendation_feedback FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
