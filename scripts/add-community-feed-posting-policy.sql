-- Allow joined community members to create feed posts

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'community_feed_posts' AND policyname = 'Joined members can create community feed posts'
  ) THEN
    CREATE POLICY "Joined members can create community feed posts"
      ON community_feed_posts FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM community_memberships
          WHERE community_memberships.community_id = community_feed_posts.community_id
            AND community_memberships.user_id = auth.uid()
        )
      );
  END IF;
END
$$;
