-- ============================================================
-- Promo Code System – Full Migration
-- Covers: venue_owner, platform, sponsor promo types
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Enhance existing promo_codes table
-- (backward-compat: keeps old columns, adds new ones)
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS name                text,
  ADD COLUMN IF NOT EXISTS description         text,
  ADD COLUMN IF NOT EXISTS promo_type          text NOT NULL DEFAULT 'venue_owner'
      CHECK (promo_type IN ('venue_owner','platform','sponsor')),
  ADD COLUMN IF NOT EXISTS discount_type       text NOT NULL DEFAULT 'fixed'
      CHECK (discount_type IN ('fixed','percent')),
  ADD COLUMN IF NOT EXISTS discount_value      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_booking_amount  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_discount_amount integer,          -- cap for percent type
  ADD COLUMN IF NOT EXISTS quota               integer,          -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS used_count          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_until         timestamptz,
  ADD COLUMN IF NOT EXISTS venue_id            uuid REFERENCES venues(id),  -- NULL = all venues
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','paused','expired','cancelled')),
  ADD COLUMN IF NOT EXISTS sponsor_balance_id  uuid,             -- FK added below after table creation
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

-- 2. sponsor_promo_balance
-- Sponsor pays topup_gross = usable_balance + management_fee
-- management_fee = usable_balance * management_fee_rate (default 10%)
-- so topup_gross = usable_balance * 1.10
CREATE TABLE IF NOT EXISTS sponsor_promo_balance (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_user_id      uuid NOT NULL REFERENCES auth.users(id),
  topup_gross          numeric NOT NULL CHECK (topup_gross > 0),     -- total charged to sponsor
  management_fee_rate  numeric NOT NULL DEFAULT 0.10,
  management_fee       numeric NOT NULL,                              -- topup_gross * fee_rate/(1+fee_rate)
  usable_balance       numeric NOT NULL,                              -- topup_gross - management_fee
  used_balance         numeric NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','exhausted','cancelled')),
  notes                text,
  topup_at             timestamptz DEFAULT now(),
  expires_at           timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Add FK from promo_codes → sponsor_promo_balance
ALTER TABLE promo_codes
  ADD CONSTRAINT IF NOT EXISTS promo_codes_sponsor_balance_id_fkey
    FOREIGN KEY (sponsor_balance_id) REFERENCES sponsor_promo_balance(id);

-- 3. promo_code_usage – records each redemption
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   uuid NOT NULL REFERENCES promo_codes(id),
  booking_id      uuid NOT NULL REFERENCES venue_bookings(id),
  user_id         uuid REFERENCES auth.users(id),
  discount_amount numeric NOT NULL DEFAULT 0,
  used_at         timestamptz DEFAULT now()
);

-- 4. promo_payouts – tracks 7-day settlements to venues
CREATE TABLE IF NOT EXISTS promo_payouts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id          uuid NOT NULL REFERENCES promo_codes(id),
  venue_id               uuid NOT NULL REFERENCES venues(id),
  total_discount_covered numeric NOT NULL DEFAULT 0,
  payout_amount          numeric NOT NULL DEFAULT 0,    -- = total_discount_covered for platform & sponsor
  payout_status          text NOT NULL DEFAULT 'pending'
      CHECK (payout_status IN ('pending','scheduled','paid','cancelled')),
  payout_due_at          timestamptz,                   -- valid_until + 7 days
  paid_at                timestamptz,
  paid_by                uuid REFERENCES auth.users(id),
  notes                  text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS promo_codes_code_idx          ON promo_codes (lower(code));
CREATE INDEX IF NOT EXISTS promo_codes_venue_id_idx      ON promo_codes (venue_id);
CREATE INDEX IF NOT EXISTS promo_codes_status_idx        ON promo_codes (status);
CREATE INDEX IF NOT EXISTS promo_code_usage_promo_idx    ON promo_code_usage (promo_code_id);
CREATE INDEX IF NOT EXISTS promo_code_usage_booking_idx  ON promo_code_usage (booking_id);
CREATE INDEX IF NOT EXISTS promo_payouts_status_idx      ON promo_payouts (payout_status);
CREATE INDEX IF NOT EXISTS sponsor_balance_user_idx      ON sponsor_promo_balance (sponsor_user_id);

-- ============================================================
-- TRIGGER: auto-increment used_count + expire on quota hit
-- ============================================================
CREATE OR REPLACE FUNCTION handle_promo_usage_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE promo_codes
  SET
    used_count = used_count + 1,
    status = CASE
      WHEN quota IS NOT NULL AND (used_count + 1) >= quota THEN 'expired'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.promo_code_id;

  -- Update sponsor balance used amount if applicable
  UPDATE sponsor_promo_balance spb
  SET
    used_balance = used_balance + NEW.discount_amount,
    status = CASE
      WHEN (used_balance + NEW.discount_amount) >= usable_balance THEN 'exhausted'
      ELSE status
    END,
    updated_at = now()
  FROM promo_codes pc
  WHERE pc.id = NEW.promo_code_id
    AND pc.sponsor_balance_id = spb.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_promo_code_usage_insert ON promo_code_usage;
CREATE TRIGGER on_promo_code_usage_insert
  AFTER INSERT ON promo_code_usage
  FOR EACH ROW EXECUTE FUNCTION handle_promo_usage_insert();

-- ============================================================
-- TRIGGER: auto-create payout record when promo expires
-- (for platform & sponsor promos only)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_promo_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only act when status transitions to expired/cancelled for non-venue-owner promos
  IF NEW.status IN ('expired','cancelled')
     AND OLD.status NOT IN ('expired','cancelled')
     AND NEW.promo_type IN ('platform','sponsor')
     AND NEW.venue_id IS NOT NULL
  THEN
    INSERT INTO promo_payouts (
      promo_code_id, venue_id, total_discount_covered,
      payout_amount, payout_status, payout_due_at, created_at
    )
    SELECT
      NEW.id,
      NEW.venue_id,
      COALESCE((SELECT SUM(discount_amount) FROM promo_code_usage WHERE promo_code_id = NEW.id), 0),
      COALESCE((SELECT SUM(discount_amount) FROM promo_code_usage WHERE promo_code_id = NEW.id), 0),
      'pending',
      COALESCE(NEW.valid_until, now()) + INTERVAL '7 days',
      now()
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_promo_status_change ON promo_codes;
CREATE TRIGGER on_promo_status_change
  AFTER UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION handle_promo_status_change();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- promo_codes
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Public can read active promos (for booking validation)
DROP POLICY IF EXISTS promo_codes_public_read ON promo_codes;
CREATE POLICY promo_codes_public_read ON promo_codes
  FOR SELECT USING (status = 'active');

-- Venue owner can CRUD their own venue promos
DROP POLICY IF EXISTS promo_codes_venue_owner_all ON promo_codes;
CREATE POLICY promo_codes_venue_owner_all ON promo_codes
  FOR ALL USING (
    promo_type = 'venue_owner'
    AND venue_id IN (
      SELECT id FROM venues WHERE owner_user_id = auth.uid()
    )
  );

-- Platform admin can CRUD all promos
DROP POLICY IF EXISTS promo_codes_platform_admin_all ON promo_codes;
CREATE POLICY promo_codes_platform_admin_all ON promo_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','platform_admin','internal_admin','finance_admin')
    )
  );

-- Sponsor can CRUD their own promos
DROP POLICY IF EXISTS promo_codes_sponsor_all ON promo_codes;
CREATE POLICY promo_codes_sponsor_all ON promo_codes
  FOR ALL USING (
    promo_type = 'sponsor'
    AND created_by = auth.uid()
  );

-- sponsor_promo_balance
ALTER TABLE sponsor_promo_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsor_balance_own_read ON sponsor_promo_balance;
CREATE POLICY sponsor_balance_own_read ON sponsor_promo_balance
  FOR SELECT USING (sponsor_user_id = auth.uid());

DROP POLICY IF EXISTS sponsor_balance_own_insert ON sponsor_promo_balance;
CREATE POLICY sponsor_balance_own_insert ON sponsor_promo_balance
  FOR INSERT WITH CHECK (sponsor_user_id = auth.uid());

DROP POLICY IF EXISTS sponsor_balance_platform_all ON sponsor_promo_balance;
CREATE POLICY sponsor_balance_platform_all ON sponsor_promo_balance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','platform_admin','internal_admin','finance_admin')
    )
  );

-- promo_code_usage
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promo_usage_own_read ON promo_code_usage;
CREATE POLICY promo_usage_own_read ON promo_code_usage
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS promo_usage_insert_authenticated ON promo_code_usage;
CREATE POLICY promo_usage_insert_authenticated ON promo_code_usage
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS promo_usage_platform_read ON promo_code_usage;
CREATE POLICY promo_usage_platform_read ON promo_code_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','platform_admin','internal_admin','finance_admin')
    )
  );

-- Venue owner can read usage for their promos
DROP POLICY IF EXISTS promo_usage_venue_owner_read ON promo_code_usage;
CREATE POLICY promo_usage_venue_owner_read ON promo_code_usage
  FOR SELECT USING (
    promo_code_id IN (
      SELECT pc.id FROM promo_codes pc
        JOIN venues v ON v.id = pc.venue_id
        WHERE v.owner_user_id = auth.uid()
    )
  );

-- promo_payouts
ALTER TABLE promo_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promo_payouts_platform_all ON promo_payouts;
CREATE POLICY promo_payouts_platform_all ON promo_payouts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','platform_admin','internal_admin','finance_admin')
    )
  );

DROP POLICY IF EXISTS promo_payouts_venue_read ON promo_payouts;
CREATE POLICY promo_payouts_venue_read ON promo_payouts
  FOR SELECT USING (
    venue_id IN (
      SELECT id FROM venues WHERE owner_user_id = auth.uid()
    )
  );
