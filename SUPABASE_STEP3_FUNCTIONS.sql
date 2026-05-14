-- ============================================================================
-- STADIONE STEP 3: Gamification Functions and Triggers
-- ============================================================================

-- award_points function
CREATE OR REPLACE FUNCTION award_points(
  p_user_id UUID,
  p_activity_type TEXT,
  p_points INT,
  p_reference_id INT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_points INT;
  v_new_tier TEXT;
BEGIN
  -- Insert activity log entry
  INSERT INTO activity_log (user_id, activity_type, points_earned, reference_id, metadata)
  VALUES (p_user_id, p_activity_type, p_points, p_reference_id, p_metadata);

  -- Update user stats
  INSERT INTO user_stats (user_id, points, coins)
  VALUES (p_user_id, p_points, 0)
  ON CONFLICT (user_id) DO UPDATE
  SET points = user_stats.points + p_points,
      coins = user_stats.coins + CASE WHEN p_activity_type = 'purchase' THEN 0 ELSE GREATEST(0, p_points / 10) END,
      updated_at = NOW();

  -- Get new points total
  SELECT points INTO v_new_points FROM user_stats WHERE user_id = p_user_id;

  -- Update tier based on points
  v_new_tier := CASE
    WHEN v_new_points >= 10000 THEN 'Diamond'
    WHEN v_new_points >= 5000 THEN 'Platinum'
    WHEN v_new_points >= 2000 THEN 'Gold'
    WHEN v_new_points >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE user_stats SET tier_level = v_new_tier WHERE user_id = p_user_id;

  RETURN v_new_points;
END;
$$;

-- get_user_gamification_stats function
CREATE OR REPLACE FUNCTION get_user_gamification_stats(p_user_id UUID)
RETURNS TABLE(
  points INT,
  coins INT,
  tier_level TEXT,
  total_activities BIGINT,
  activities_this_month BIGINT,
  points_this_month BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(us.points, 0),
    COALESCE(us.coins, 0),
    COALESCE(us.tier_level, 'Bronze'),
    COUNT(al.id),
    COUNT(al.id) FILTER (WHERE al.created_at >= DATE_TRUNC('month', NOW())),
    COALESCE(SUM(al.points_earned) FILTER (WHERE al.created_at >= DATE_TRUNC('month', NOW())), 0)
  FROM user_stats us
  LEFT JOIN activity_log al ON al.user_id = p_user_id
  WHERE us.user_id = p_user_id
  GROUP BY us.points, us.coins, us.tier_level;
END;
$$;

-- Initialize user stats trigger function
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_stats (user_id, coins, points, tier_level)
  VALUES (NEW.id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_stats();

-- Grant permissions
GRANT EXECUTE ON FUNCTION award_points TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_gamification_stats TO anon, authenticated;

-- Admin utility functions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id bigint;
  role_snapshot text;
BEGIN
  SELECT ur.role INTO role_snapshot
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY ur.granted_at ASC
  LIMIT 1;

  INSERT INTO admin_audit_logs (actor_user_id, actor_role, action, target_type, target_id, details)
  VALUES (auth.uid(), role_snapshot, p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_tournament_registration_slots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE tournament_registrations
  SET
    registration_status = 'cancelled',
    payment_status = CASE
      WHEN payment_status IN ('unpaid', 'pending') THEN 'expired'
      ELSE payment_status
    END,
    lock_released_at = now(),
    updated_at = now()
  WHERE
    registration_status IN ('draft', 'waiting_payment')
    AND slot_expires_at IS NOT NULL
    AND slot_expires_at <= now();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

SELECT '✅ Step 3 Complete: Gamification functions and triggers created successfully!' as status;
