-- Drop existing policies to allow recreation
DROP POLICY IF EXISTS "Anyone can view communities" ON sport_communities;
DROP POLICY IF EXISTS "Anyone can view community feed posts" ON community_feed_posts;
DROP POLICY IF EXISTS "Anyone can view community events" ON community_events;
DROP POLICY IF EXISTS "Anyone can view community chat messages" ON community_chat_messages;
DROP POLICY IF EXISTS "Users can view their own venue bookings" ON user_venue_bookings;
DROP POLICY IF EXISTS "Users can view their own articles read" ON user_articles_read;
DROP POLICY IF EXISTS "Users can view their own tournament participations" ON user_tournament_participations;
DROP POLICY IF EXISTS "Users can view their own community memberships log" ON user_community_memberships_log;
DROP POLICY IF EXISTS "Users can view their own training enrollments" ON user_training_enrollments;
DROP POLICY IF EXISTS "Users can view their own activity log" ON user_activity_log;
DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can view their own activity log data" ON activity_log;
DROP POLICY IF EXISTS "Users can insert their own activity log" ON activity_log;
DROP POLICY IF EXISTS "Users can view their own article progress" ON article_progress;
DROP POLICY IF EXISTS "Users can insert/update their own article progress" ON article_progress;
DROP POLICY IF EXISTS "Users can update their own article progress" ON article_progress;
DROP POLICY IF EXISTS "Anyone can view quiz" ON article_quiz;
DROP POLICY IF EXISTS "Users can view their own quiz results" ON quiz_results;
DROP POLICY IF EXISTS "Users can insert their own quiz results" ON quiz_results;
DROP POLICY IF EXISTS "Users can view tournament players" ON tournament_players;
DROP POLICY IF EXISTS "Users can register themselves as tournament players" ON tournament_players;
DROP POLICY IF EXISTS "Users can update their own tournament player record" ON tournament_players;
DROP POLICY IF EXISTS "Users can view match statistics" ON match_statistics;
DROP POLICY IF EXISTS "Users can view player lineups" ON player_lineups;
DROP POLICY IF EXISTS "Users can view player suspensions" ON player_suspensions;

-- Now create all policies fresh
CREATE POLICY "Anyone can view communities" ON sport_communities FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view community feed posts" ON community_feed_posts FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view community events" ON community_events FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view community chat messages" ON community_chat_messages FOR SELECT USING (TRUE);
CREATE POLICY "Users can view their own venue bookings" ON user_venue_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own articles read" ON user_articles_read FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own tournament participations" ON user_tournament_participations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own community memberships log" ON user_community_memberships_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own training enrollments" ON user_training_enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own activity log" ON user_activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own stats" ON user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own activity log data" ON activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activity log" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own article progress" ON article_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert/update their own article progress" ON article_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own article progress" ON article_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view quiz" ON article_quiz FOR SELECT USING (TRUE);
CREATE POLICY "Users can view their own quiz results" ON quiz_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own quiz results" ON quiz_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view tournament players" ON tournament_players FOR SELECT USING (TRUE);
CREATE POLICY "Users can register themselves as tournament players" ON tournament_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tournament player record" ON tournament_players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view match statistics" ON match_statistics FOR SELECT USING (TRUE);
CREATE POLICY "Users can view player lineups" ON player_lineups FOR SELECT USING (TRUE);
CREATE POLICY "Users can view player suspensions" ON player_suspensions FOR SELECT USING (TRUE);

-- PHASE 6: GAMIFICATION FUNCTIONS
CREATE OR REPLACE FUNCTION award_points(p_user_id UUID, p_points INT, p_activity_type TEXT, p_reference_id INT DEFAULT NULL, p_metadata JSONB DEFAULT NULL)
RETURNS TABLE (new_points INT, new_tier TEXT, points_awarded INT) AS $$
DECLARE v_new_points INT; v_new_tier TEXT;
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level) VALUES (p_user_id, 0, 0, 'Bronze') ON CONFLICT (user_id) DO NOTHING;
  UPDATE user_stats SET points = points + p_points, updated_at = NOW() WHERE user_id = p_user_id RETURNING points INTO v_new_points;
  v_new_tier := CASE WHEN v_new_points >= 5000 THEN 'Platinum' WHEN v_new_points >= 2000 THEN 'Gold' WHEN v_new_points >= 500 THEN 'Silver' ELSE 'Bronze' END;
  UPDATE user_stats SET tier_level = v_new_tier WHERE user_id = p_user_id;
  INSERT INTO activity_log (user_id, activity_type, points_earned, reference_id, metadata) VALUES (p_user_id, p_activity_type, p_points, p_reference_id, p_metadata);
  RETURN QUERY SELECT v_new_points, v_new_tier, p_points;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_gamification_stats(p_user_id UUID)
RETURNS TABLE (coins INT, points INT, tier_level TEXT, total_spent BIGINT, total_activities INT, articles_read INT, quizzes_correct INT, tournaments_joined INT) AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level) VALUES (p_user_id, 0, 0, 'Bronze') ON CONFLICT (user_id) DO NOTHING;
  RETURN QUERY SELECT us.coins, us.points, us.tier_level, us.total_spent, COALESCE(COUNT(DISTINCT al.id), 0)::INT, COALESCE(COUNT(DISTINCT CASE WHEN ap.read_completed THEN ap.article_id END), 0)::INT, COALESCE(COUNT(DISTINCT CASE WHEN qr.is_correct THEN qr.quiz_id END), 0)::INT, COALESCE(COUNT(DISTINCT tp.tournament_id), 0)::INT FROM user_stats us LEFT JOIN activity_log al ON us.user_id = al.user_id LEFT JOIN article_progress ap ON us.user_id = ap.user_id LEFT JOIN quiz_results qr ON us.user_id = qr.user_id LEFT JOIN tournament_players tp ON us.user_id = tp.user_id AND tp.status = 'active' WHERE us.user_id = p_user_id GROUP BY us.coins, us.points, us.tier_level, us.total_spent;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION initialize_user_stats() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level) VALUES (NEW.id, 0, 0, 'Bronze') ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION initialize_user_stats();

GRANT EXECUTE ON FUNCTION award_points TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_gamification_stats TO anon, authenticated;

SELECT '✅ All tables, policies, and functions created successfully!' as status;
