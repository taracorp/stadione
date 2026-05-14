-- Supabase RPC Functions for Gamification System

-- Function: Award points to user
CREATE OR REPLACE FUNCTION award_points(
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
) AS $$
DECLARE
  v_new_points INT;
  v_new_tier TEXT;
BEGIN
  -- Ensure stats row exists for legacy users.
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  -- Update user stats
  UPDATE user_stats
  SET points = points + p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING points INTO v_new_points;

  -- Determine new tier
  v_new_tier := CASE
    WHEN v_new_points >= 5000 THEN 'Platinum'
    WHEN v_new_points >= 2000 THEN 'Gold'
    WHEN v_new_points >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  -- Update tier
  UPDATE user_stats
  SET tier_level = v_new_tier
  WHERE user_id = p_user_id;

  -- Log activity
  INSERT INTO activity_log (user_id, activity_type, points_earned, reference_id, metadata)
  VALUES (p_user_id, p_activity_type, p_points, p_reference_id, p_metadata);

  RETURN QUERY SELECT v_new_points, v_new_tier, p_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Award coins from transaction
CREATE OR REPLACE FUNCTION award_coins_from_transaction(
  p_user_id UUID,
  p_transaction_amount BIGINT
)
RETURNS TABLE (
  new_coins INT,
  coins_earned INT
) AS $$
DECLARE
  v_coins_earned INT;
  v_new_coins INT;
BEGIN
  -- Ensure stats row exists for legacy users.
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (p_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  -- Calculate coins (1 coin per 10,000 currency)
  v_coins_earned := (p_transaction_amount / 10000)::INT;

  -- Ensure at least 1 coin if transaction is over 10,000
  IF v_coins_earned < 1 AND p_transaction_amount >= 10000 THEN
    v_coins_earned := 1;
  END IF;

  -- Update user stats
  UPDATE user_stats
  SET coins = coins + v_coins_earned,
      total_spent = total_spent + p_transaction_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING coins INTO v_new_coins;

  -- Log activity
  INSERT INTO activity_log (user_id, activity_type, points_earned, metadata)
  VALUES (p_user_id, 'transaction', v_coins_earned, 
    jsonb_build_object('coins_earned', v_coins_earned, 'transaction_amount', p_transaction_amount));

  RETURN QUERY SELECT v_new_coins, v_coins_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Get user gamification stats
CREATE OR REPLACE FUNCTION get_user_gamification_stats(p_user_id UUID)
RETURNS TABLE (
  coins INT,
  points INT,
  tier_level TEXT,
  total_spent BIGINT,
  total_activities INT,
  articles_read INT,
  quizzes_correct INT,
  tournaments_joined INT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function: Check player suspension status
CREATE OR REPLACE FUNCTION is_player_suspended(
  p_player_id BIGINT,
  p_match_id INT
)
RETURNS TABLE (
  is_suspended BOOLEAN,
  suspension_reason TEXT,
  yellow_cards INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ps.is_active, FALSE),
    COALESCE(ps.suspension_reason, ''),
    COALESCE(ps.yellow_card_count, 0)
  FROM player_suspensions ps
  WHERE ps.player_id = p_player_id
    AND ps.is_active = TRUE
    AND (p_match_id IS NULL OR p_match_id >= COALESCE(ps.suspension_from_match, 0))
    AND (p_match_id IS NULL OR p_match_id <= COALESCE(ps.suspension_until_match, 999999))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-suspend player on red card
CREATE OR REPLACE FUNCTION handle_red_card(
  p_player_id BIGINT,
  p_tournament_id INT,
  p_match_id INT
)
RETURNS TABLE (
  suspension_created BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_suspension_id BIGINT;
BEGIN
  -- Create suspension record
  INSERT INTO player_suspensions (
    player_id,
    tournament_id,
    suspension_reason,
    yellow_card_count,
    suspension_from_match,
    suspension_until_match,
    is_active
  )
  VALUES (
    p_player_id,
    p_tournament_id,
    'red_card',
    0,
    p_match_id + 1,
    p_match_id + 1,
    TRUE
  )
  RETURNING id INTO v_suspension_id;

  -- Update player status to suspended
  UPDATE tournament_players
  SET status = 'suspended'
  WHERE id = p_player_id;

  RETURN QUERY SELECT TRUE, 'Player automatically suspended for red card. Banned next match.';
END;
$$ LANGUAGE plpgsql;

-- Function: Handle yellow card accumulation
CREATE OR REPLACE FUNCTION handle_yellow_card(
  p_player_id BIGINT,
  p_tournament_id INT,
  p_match_id INT
)
RETURNS TABLE (
  suspension_created BOOLEAN,
  yellow_card_count INT,
  message TEXT
) AS $$
DECLARE
  v_yellow_cards INT;
  v_suspension_until INT;
BEGIN
  -- Check existing yellow cards
  SELECT COALESCE(MAX(yellow_card_count), 0) + 1 INTO v_yellow_cards
  FROM player_suspensions
  WHERE player_id = p_player_id
    AND tournament_id = p_tournament_id
    AND suspension_reason = 'yellow_card_accumulation';

  -- If 2 yellows = red, suspend for 1 match
  IF v_yellow_cards >= 2 THEN
    v_suspension_until := p_match_id + 1;
    
    INSERT INTO player_suspensions (
      player_id,
      tournament_id,
      suspension_reason,
      yellow_card_count,
      suspension_from_match,
      suspension_until_match,
      is_active
    )
    VALUES (
      p_player_id,
      p_tournament_id,
      'yellow_card_accumulation',
      v_yellow_cards,
      p_match_id + 1,
      p_match_id + 1,
      TRUE
    );

    UPDATE tournament_players
    SET status = 'suspended'
    WHERE id = p_player_id;

    RETURN QUERY SELECT TRUE, v_yellow_cards, 
      'Player suspended! 2 yellow cards = 1 match ban.';
  ELSE
    INSERT INTO player_suspensions (
      player_id,
      tournament_id,
      suspension_reason,
      yellow_card_count,
      is_active
    )
    VALUES (
      p_player_id,
      p_tournament_id,
      'yellow_card_accumulation',
      v_yellow_cards,
      FALSE
    );

    RETURN QUERY SELECT FALSE, v_yellow_cards,
      'Yellow card recorded. ' || (2 - v_yellow_cards) || ' more until suspension.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Initialize user stats on signup
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (NEW.id, 0, 0, 'Bronze');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create user_stats on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_stats();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION award_points TO anon, authenticated;
GRANT EXECUTE ON FUNCTION award_coins_from_transaction TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_gamification_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_player_suspended TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_red_card TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_yellow_card TO anon, authenticated;
