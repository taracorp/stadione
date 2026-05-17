-- Community event attendance, feed likes/comments, and member-only chat

CREATE TABLE IF NOT EXISTS community_event_attendance (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'checked_in', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_feed_comments (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES community_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'member',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_feed_likes (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES sport_communities(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES community_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_event_attendance_user_id ON community_event_attendance (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_event_attendance_event_id ON community_event_attendance (event_id);
CREATE INDEX IF NOT EXISTS idx_community_feed_comments_post_id ON community_feed_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_feed_comments_user_id ON community_feed_comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_feed_likes_post_id ON community_feed_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_community_feed_likes_user_id ON community_feed_likes (user_id, created_at DESC);

ALTER TABLE community_event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_event_attendance' AND policyname = 'Users can view their own community event attendance'
  ) THEN
    CREATE POLICY "Users can view their own community event attendance"
      ON community_event_attendance FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_event_attendance' AND policyname = 'Joined members can manage own event attendance'
  ) THEN
    CREATE POLICY "Joined members can manage own event attendance"
      ON community_event_attendance FOR ALL
      USING (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_event_attendance.community_id
            AND community_memberships.user_id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_event_attendance.community_id
            AND community_memberships.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_feed_comments' AND policyname = 'Anyone can view community feed comments'
  ) THEN
    CREATE POLICY "Anyone can view community feed comments"
      ON community_feed_comments FOR SELECT
      USING (TRUE);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_feed_comments' AND policyname = 'Joined members can create community feed comments'
  ) THEN
    CREATE POLICY "Joined members can create community feed comments"
      ON community_feed_comments FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_feed_comments.community_id
            AND community_memberships.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_feed_likes' AND policyname = 'Users can view their own community feed likes'
  ) THEN
    CREATE POLICY "Users can view their own community feed likes"
      ON community_feed_likes FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_feed_likes' AND policyname = 'Joined members can manage own community feed likes'
  ) THEN
    CREATE POLICY "Joined members can manage own community feed likes"
      ON community_feed_likes FOR ALL
      USING (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_feed_likes.community_id
            AND community_memberships.user_id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_feed_likes.community_id
            AND community_memberships.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

DROP POLICY IF EXISTS "Authenticated users can send chat messages" ON community_chat_messages;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_chat_messages' AND policyname = 'Joined members can send community chat messages'
  ) THEN
    CREATE POLICY "Joined members can send community chat messages"
      ON community_chat_messages FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_chat_messages.community_id
            AND community_memberships.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
