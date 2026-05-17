-- Remove permissive feed-post insert policy so only joined members can post

DROP POLICY IF EXISTS "Authenticated users can create feed posts" ON community_feed_posts;
