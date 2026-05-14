-- Hotfix: ensure gamification points can be awarded under RLS
-- Run this in Supabase SQL Editor (project database)

-- 1) Add missing INSERT policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_stats'
      AND policyname = 'Users can insert their own stats'
  ) THEN
    CREATE POLICY "Users can insert their own stats"
      ON public.user_stats FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_log'
      AND policyname = 'Users can insert their own activity log'
  ) THEN
    CREATE POLICY "Users can insert their own activity log"
      ON public.activity_log FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- 2) Recreate RPC functions with SECURITY DEFINER and auto-init user_stats row
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_points INT,
  p_activity_type TEXT,
  p_reference_id INT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE (
  new_points INT,
  new_tier TEXT,
  points_awarded INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_points INT;
  v_new_tier TEXT;
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_stats
  SET points = points + p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING points INTO v_new_points;

  v_new_tier := CASE
    WHEN v_new_points >= 5000 THEN 'Platinum'
    WHEN v_new_points >= 2000 THEN 'Gold'
    WHEN v_new_points >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE user_stats
  SET tier_level = v_new_tier
  WHERE user_id = p_user_id;

  INSERT INTO activity_log (user_id, activity_type, points_earned, reference_id, metadata)
  VALUES (p_user_id, p_activity_type, p_points, p_reference_id, p_metadata);

  RETURN QUERY SELECT v_new_points, v_new_tier, p_points;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_gamification_stats(p_user_id UUID)
RETURNS TABLE (
  coins INT,
  points INT,
  tier_level TEXT,
  total_spent BIGINT,
  total_activities INT,
  articles_read INT,
  quizzes_correct INT,
  tournaments_joined INT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    us.coins,
    us.points,
    us.tier_level,
    us.total_spent,
    COALESCE(COUNT(DISTINCT al.id), 0)::INT,
    COALESCE(COUNT(DISTINCT CASE WHEN ap.read_completed THEN ap.article_id END), 0)::INT,
    COALESCE(COUNT(DISTINCT CASE WHEN qr.is_correct THEN qr.quiz_id END), 0)::INT,
    COALESCE(COUNT(DISTINCT tp.tournament_id), 0)::INT
  FROM user_stats us
  LEFT JOIN activity_log al ON us.user_id = al.user_id
  LEFT JOIN article_progress ap ON us.user_id = ap.user_id
  LEFT JOIN quiz_results qr ON us.user_id = qr.user_id
  LEFT JOIN tournament_players tp ON us.user_id = tp.user_id AND tp.status = 'active'
  WHERE us.user_id = p_user_id
  GROUP BY us.coins, us.points, us.tier_level, us.total_spent;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_coins_from_transaction(
  p_user_id UUID,
  p_transaction_amount BIGINT
)
RETURNS TABLE (
  new_coins INT,
  coins_earned INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coins_earned INT;
  v_new_coins INT;
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  v_coins_earned := (p_transaction_amount / 10000)::INT;

  IF v_coins_earned < 1 AND p_transaction_amount >= 10000 THEN
    v_coins_earned := 1;
  END IF;

  UPDATE user_stats
  SET coins = coins + v_coins_earned,
      total_spent = total_spent + p_transaction_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING coins INTO v_new_coins;

  INSERT INTO activity_log (user_id, activity_type, points_earned, metadata)
  VALUES (p_user_id, 'transaction', v_coins_earned,
    jsonb_build_object('coins_earned', v_coins_earned, 'transaction_amount', p_transaction_amount));

  RETURN QUERY SELECT v_new_coins, v_coins_earned;
END;
$$;

-- 3) Keep execute grants intact
GRANT EXECUTE ON FUNCTION public.award_points(UUID, INT, TEXT, INT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_gamification_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_coins_from_transaction(UUID, BIGINT) TO anon, authenticated;
