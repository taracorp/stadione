-- ============================================================================
-- STADIONE STEP 2: Drop all conflicting policies then create fresh ones
-- ============================================================================

-- Drop all policies (safe - IF EXISTS handles missing tables/policies)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view communities" ON sport_communities';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can join communities" ON sport_communities';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view community feed posts" ON community_feed_posts';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create feed posts" ON community_feed_posts';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view community events" ON community_events';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view community chat messages" ON community_chat_messages';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can send chat messages" ON community_chat_messages';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own venue bookings" ON user_venue_bookings';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create venue bookings" ON user_venue_bookings';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own articles read" ON user_articles_read';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can log articles read" ON user_articles_read';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own tournament participations" ON user_tournament_participations';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can join tournaments" ON user_tournament_participations';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own community memberships" ON user_community_memberships_log';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own training enrollments" ON user_training_enrollments';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own activity log" ON user_activity_log';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create activity log entries" ON user_activity_log';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_log';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own article progress" ON article_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own article progress" ON article_progress';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view quiz questions" ON article_quiz';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own quiz results" ON quiz_results';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view tournament players" ON tournament_players';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view match statistics" ON match_statistics';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view player lineups" ON player_lineups';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view player suspensions" ON player_suspensions';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view tournament registrations" ON registrations';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view team members" ON team_members';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view teams" ON teams';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Create all RLS Policies fresh
-- ============================================================================

-- sport_communities
CREATE POLICY "Anyone can view communities" ON sport_communities FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can join communities" ON sport_communities FOR SELECT TO authenticated USING (TRUE);

-- community_feed_posts
CREATE POLICY "Anyone can view community feed posts" ON community_feed_posts FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can create feed posts" ON community_feed_posts FOR INSERT TO authenticated WITH CHECK (TRUE);

-- community_events
CREATE POLICY "Anyone can view community events" ON community_events FOR SELECT USING (TRUE);

-- community_chat_messages
CREATE POLICY "Anyone can view community chat messages" ON community_chat_messages FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can send chat messages" ON community_chat_messages FOR INSERT TO authenticated WITH CHECK (TRUE);

-- user_venue_bookings
CREATE POLICY "Users can view their own venue bookings" ON user_venue_bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create venue bookings" ON user_venue_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_articles_read
CREATE POLICY "Users can view their own articles read" ON user_articles_read FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can log articles read" ON user_articles_read FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_tournament_participations
CREATE POLICY "Users can view their own tournament participations" ON user_tournament_participations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can join tournaments" ON user_tournament_participations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_community_memberships_log
CREATE POLICY "Users can view their own community memberships" ON user_community_memberships_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_training_enrollments
CREATE POLICY "Users can view their own training enrollments" ON user_training_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_activity_log
CREATE POLICY "Users can view their own activity log" ON user_activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create activity log entries" ON user_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_stats
CREATE POLICY "Users can view their own stats" ON user_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- activity_log
CREATE POLICY "Users can view their own activity logs" ON activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- article_progress
CREATE POLICY "Users can view their own article progress" ON article_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own article progress" ON article_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- article_quiz
CREATE POLICY "Anyone can view quiz questions" ON article_quiz FOR SELECT USING (TRUE);

-- quiz_results
CREATE POLICY "Users can view their own quiz results" ON quiz_results FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- tournament_players
CREATE POLICY "Users can view tournament players" ON tournament_players FOR SELECT USING (TRUE);

-- match_statistics
CREATE POLICY "Users can view match statistics" ON match_statistics FOR SELECT USING (TRUE);

-- player_lineups
CREATE POLICY "Users can view player lineups" ON player_lineups FOR SELECT USING (TRUE);

-- player_suspensions
CREATE POLICY "Users can view player suspensions" ON player_suspensions FOR SELECT USING (TRUE);

-- registrations
CREATE POLICY "Anyone can view tournament registrations" ON registrations FOR SELECT USING (TRUE);

-- team_members
CREATE POLICY "Users can view team members" ON team_members FOR SELECT USING (TRUE);

-- teams
CREATE POLICY "Users can view teams" ON teams FOR SELECT USING (TRUE);

SELECT '✅ Step 2 Complete: All RLS policies created successfully!' as status;
