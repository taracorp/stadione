-- ============================================================================
-- STADIONE MEMBERSHIP SYSTEM SCHEMA
-- Phase 5: Customer Loyalty, Rewards, Tiers, Bonus Hours
-- ============================================================================

-- ============================================================================
-- 1. MEMBERSHIP TIERS CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  
  -- Tier name & order
  tier_name TEXT NOT NULL CHECK (tier_name IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  tier_level INTEGER NOT NULL CHECK (tier_level BETWEEN 1 AND 4),
  
  -- Benefits
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  has_priority_booking BOOLEAN DEFAULT FALSE,
  bonus_hours_per_month INTEGER DEFAULT 0 CHECK (bonus_hours_per_month >= 0),
  
  -- Pricing
  annual_fee_idr DECIMAL(12, 2) NOT NULL CHECK (annual_fee_idr > 0),
  monthly_renewal_date INTEGER CHECK (monthly_renewal_date BETWEEN 1 AND 28),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  description TEXT,
  
  UNIQUE(venue_id, tier_name)
);

CREATE INDEX idx_membership_types_venue_id ON membership_types(venue_id);
CREATE INDEX idx_membership_types_tier_level ON membership_types(tier_level);

-- ============================================================================
-- 2. CUSTOMER MEMBERSHIPS TABLE (Active memberships per customer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  membership_type_id UUID NOT NULL REFERENCES membership_types(id) ON DELETE RESTRICT,
  
  -- Membership status: 'active' | 'expired' | 'cancelled' | 'suspended'
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  
  -- Membership dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_date DATE NOT NULL,
  
  -- Account balance
  reward_points_balance INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  
  UNIQUE(customer_id, venue_id, status)
);

CREATE INDEX idx_customer_memberships_customer_id ON customer_memberships(customer_id);
CREATE INDEX idx_customer_memberships_venue_id ON customer_memberships(venue_id);
CREATE INDEX idx_customer_memberships_status ON customer_memberships(status);
CREATE INDEX idx_customer_memberships_renewal_date ON customer_memberships(renewal_date);

-- ============================================================================
-- 3. REWARD POINTS TRANSACTION LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS reward_points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
  
  -- Transaction type: 'earned' | 'redeemed' | 'expired' | 'adjustment'
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjustment')),
  
  -- Amount
  points_amount INTEGER NOT NULL CHECK (points_amount != 0),
  
  -- Reference
  booking_id UUID REFERENCES venue_bookings(id) ON DELETE SET NULL,
  
  -- Running balance
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  reason TEXT,
  notes TEXT
);

CREATE INDEX idx_reward_points_log_membership_id ON reward_points_log(membership_id);
CREATE INDEX idx_reward_points_log_booking_id ON reward_points_log(booking_id);
CREATE INDEX idx_reward_points_log_transaction_type ON reward_points_log(transaction_type);
CREATE INDEX idx_reward_points_log_created_at ON reward_points_log(created_at DESC);

-- ============================================================================
-- 4. BONUS HOURS ALLOCATION & USAGE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bonus_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES customer_memberships(id) ON DELETE CASCADE,
  
  -- Allocation
  hours_allocated INTEGER NOT NULL CHECK (hours_allocated > 0),
  hours_used INTEGER DEFAULT 0 CHECK (hours_used >= 0),
  hours_remaining INTEGER GENERATED ALWAYS AS (hours_allocated - hours_used) STORED,
  
  -- Validity
  allocated_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  
  -- Usage tracking
  booking_id UUID UNIQUE REFERENCES venue_bookings(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_bonus_hours_membership_id ON bonus_hours(membership_id);
CREATE INDEX idx_bonus_hours_booking_id ON bonus_hours(booking_id);
CREATE INDEX idx_bonus_hours_expiration_date ON bonus_hours(expiration_date);

-- ============================================================================
-- 5. MEMBERSHIP DISCOUNT APPLICATION LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_discount_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES venue_bookings(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES customer_memberships(id) ON DELETE SET NULL,
  
  -- Discount details
  tier_name TEXT NOT NULL,
  discount_percent DECIMAL(5, 2) NOT NULL,
  original_price DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) NOT NULL,
  final_price DECIMAL(12, 2) NOT NULL,
  
  -- Optional: Reward points earned
  reward_points_earned INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_membership_discount_log_booking_id ON membership_discount_log(booking_id);
CREATE INDEX idx_membership_discount_log_membership_id ON membership_discount_log(membership_id);
CREATE INDEX idx_membership_discount_log_created_at ON membership_discount_log(created_at DESC);

-- ============================================================================
-- 6. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE membership_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_discount_log ENABLE ROW LEVEL SECURITY;

-- Membership Types: Venue staff can read/manage their venue's tiers
CREATE POLICY "membership_types_venue_staff_read" 
ON membership_types FOR SELECT 
TO authenticated 
USING (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "membership_types_venue_staff_insert"
ON membership_types FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
);

CREATE POLICY "membership_types_venue_staff_update"
ON membership_types FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
)
WITH CHECK (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
);

-- Customer Memberships: Customers can read own, staff can read venue's
CREATE POLICY "customer_memberships_customer_read"
ON customer_memberships FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "customer_memberships_venue_staff_insert"
ON customer_memberships FOR INSERT
TO authenticated
WITH CHECK (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "customer_memberships_venue_staff_update"
ON customer_memberships FOR UPDATE
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  venue_id IN (
    SELECT venue_id FROM venue_staff 
    WHERE user_id = auth.uid()
  )
);

-- Reward Points: Customer can read own, staff can read venue's
CREATE POLICY "reward_points_log_read"
ON reward_points_log FOR SELECT
TO authenticated
USING (
  membership_id IN (
    SELECT id FROM customer_memberships 
    WHERE customer_id = auth.uid()
    OR venue_id IN (
      SELECT venue_id FROM venue_staff 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "reward_points_log_insert"
ON reward_points_log FOR INSERT
TO authenticated
WITH CHECK (
  membership_id IN (
    SELECT id FROM customer_memberships 
    WHERE venue_id IN (
      SELECT venue_id FROM venue_staff 
      WHERE user_id = auth.uid()
    )
  )
);

-- Bonus Hours: Customer can read own, staff can read venue's
CREATE POLICY "bonus_hours_read"
ON bonus_hours FOR SELECT
TO authenticated
USING (
  membership_id IN (
    SELECT id FROM customer_memberships 
    WHERE customer_id = auth.uid()
    OR venue_id IN (
      SELECT venue_id FROM venue_staff 
      WHERE user_id = auth.uid()
    )
  )
);

-- Discount Log: Staff can read venue's, customer can read own bookings
CREATE POLICY "membership_discount_log_read"
ON membership_discount_log FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT id FROM venue_bookings 
    WHERE created_by = auth.uid()
  )
  OR membership_id IN (
    SELECT id FROM customer_memberships 
    WHERE venue_id IN (
      SELECT venue_id FROM venue_staff 
      WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- 7. TRIGGERS FOR AUTOMATION
-- ============================================================================

-- Trigger: Update customer_memberships reward_points_balance on points log insert
CREATE OR REPLACE FUNCTION update_membership_points_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customer_memberships
  SET reward_points_balance = NEW.balance_after,
      updated_at = NOW()
  WHERE id = NEW.membership_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_membership_points_balance
AFTER INSERT ON reward_points_log
FOR EACH ROW
EXECUTE FUNCTION update_membership_points_balance();

-- Trigger: Validate bonus hours expiration
CREATE OR REPLACE FUNCTION validate_bonus_hours_not_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT is_expired FROM bonus_hours WHERE id = NEW.booking_id
  ) THEN
    RAISE EXCEPTION 'Cannot use expired bonus hours (expired %)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function: Get active membership for customer at venue
CREATE OR REPLACE FUNCTION get_customer_active_membership(
  p_customer_id UUID,
  p_venue_id INTEGER
)
RETURNS TABLE (
  membership_id UUID,
  tier_name TEXT,
  discount_percent DECIMAL,
  has_priority_booking BOOLEAN,
  reward_points_balance INTEGER,
  bonus_hours_available INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    mt.tier_name,
    mt.discount_percent,
    mt.has_priority_booking,
    cm.reward_points_balance,
    COALESCE(SUM(bh.hours_remaining), 0)::INTEGER
  FROM customer_memberships cm
  JOIN membership_types mt ON mt.id = cm.membership_type_id
  LEFT JOIN bonus_hours bh ON bh.membership_id = cm.id AND bh.expiration_date >= CURRENT_DATE
  WHERE cm.customer_id = p_customer_id
    AND cm.venue_id = p_venue_id
    AND cm.status = 'active'
    AND cm.end_date >= CURRENT_DATE
  GROUP BY cm.id, mt.tier_name, mt.discount_percent, mt.has_priority_booking, cm.reward_points_balance;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate membership discount
CREATE OR REPLACE FUNCTION calculate_membership_discount(
  p_customer_id UUID,
  p_venue_id INTEGER,
  p_booking_price DECIMAL
)
RETURNS TABLE (
  discount_amount DECIMAL,
  final_price DECIMAL,
  tier_name TEXT,
  discount_percent DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      (p_booking_price * mt.discount_percent / 100)::DECIMAL(12, 2),
      0
    ),
    p_booking_price - COALESCE(
      (p_booking_price * mt.discount_percent / 100)::DECIMAL(12, 2),
      0
    ),
    mt.tier_name,
    mt.discount_percent
  FROM customer_memberships cm
  JOIN membership_types mt ON mt.id = cm.membership_type_id
  WHERE cm.customer_id = p_customer_id
    AND cm.venue_id = p_venue_id
    AND cm.status = 'active'
    AND cm.end_date >= CURRENT_DATE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON membership_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON customer_memberships TO authenticated;
GRANT SELECT, INSERT ON reward_points_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bonus_hours TO authenticated;
GRANT SELECT, INSERT ON membership_discount_log TO authenticated;
