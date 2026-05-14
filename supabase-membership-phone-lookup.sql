-- ============================================================================
-- MEMBERSHIP PHONE LOOKUP FUNCTIONS
-- Allow POS cashiers to look up customer membership by phone number
-- ============================================================================

-- Function: Get active membership by customer phone at a venue
-- Used by POS system for walk-in customers (cashier knows customer phone)
CREATE OR REPLACE FUNCTION get_membership_by_phone(
  p_phone TEXT,
  p_venue_id INTEGER
)
RETURNS TABLE (
  membership_id UUID,
  customer_id UUID,
  tier_name TEXT,
  discount_percent DECIMAL(5,2),
  has_priority_booking BOOLEAN,
  bonus_hours_per_month INTEGER,
  reward_points_balance INTEGER,
  start_date DATE,
  end_date DATE,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id AS membership_id,
    cm.customer_id,
    mt.tier_name,
    mt.discount_percent,
    mt.has_priority_booking,
    mt.bonus_hours_per_month,
    cm.reward_points_balance,
    cm.start_date,
    cm.end_date,
    cm.status::TEXT
  FROM customer_memberships cm
  JOIN membership_types mt ON mt.id = cm.membership_type_id
  JOIN auth.users u ON u.id = cm.customer_id
  WHERE (u.phone = p_phone OR u.raw_user_meta_data->>'phone' = p_phone)
    AND cm.venue_id = p_venue_id
    AND cm.status = 'active'
    AND cm.end_date >= CURRENT_DATE
  ORDER BY cm.start_date DESC
  LIMIT 1;
END;
$$;

-- Function: Get available bonus hours for a customer by phone at a venue
CREATE OR REPLACE FUNCTION get_bonus_hours_by_phone(
  p_phone TEXT,
  p_venue_id INTEGER
)
RETURNS TABLE (
  bonus_hour_id UUID,
  membership_id UUID,
  hours_allocated INTEGER,
  hours_used DECIMAL(6,2),
  hours_remaining DECIMAL(6,2),
  allocated_date DATE,
  expiration_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bh.id AS bonus_hour_id,
    bh.membership_id,
    bh.hours_allocated,
    bh.hours_used,
    (bh.hours_allocated - bh.hours_used) AS hours_remaining,
    bh.allocated_date,
    bh.expiration_date
  FROM bonus_hours bh
  JOIN customer_memberships cm ON cm.id = bh.membership_id
  JOIN auth.users u ON u.id = cm.customer_id
  WHERE (u.phone = p_phone OR u.raw_user_meta_data->>'phone' = p_phone)
    AND cm.venue_id = p_venue_id
    AND cm.status = 'active'
    AND bh.expiration_date >= CURRENT_DATE
    AND (bh.hours_allocated - bh.hours_used) > 0
  ORDER BY bh.expiration_date ASC;
END;
$$;

-- Grant execute to authenticated users (cashiers, managers, etc.)
GRANT EXECUTE ON FUNCTION get_membership_by_phone TO authenticated;
GRANT EXECUTE ON FUNCTION get_bonus_hours_by_phone TO authenticated;
