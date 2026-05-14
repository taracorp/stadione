-- ============================================================
-- VENUE WORKSPACE SQL MIGRATION
-- Venue Management Workspace — Sports Venue Operating System
-- Phase 1: Foundation & Schema
-- ============================================================

-- ============================================================
-- 1. EXTEND VENUES TABLE
-- ============================================================

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- ============================================================
-- 2. VENUE BRANCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  province TEXT,
  city TEXT,
  maps_url TEXT,
  contact_number TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_branches_venue_id ON venue_branches(venue_id);

-- ============================================================
-- 3. VENUE COURTS
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES venue_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  surface_type TEXT,
  capacity INTEGER DEFAULT 2,
  indoor BOOLEAN NOT NULL DEFAULT true,
  has_lighting BOOLEAN NOT NULL DEFAULT false,
  has_ac BOOLEAN NOT NULL DEFAULT false,
  price_per_hour NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'maintenance', 'cleaning', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_courts_venue_id ON venue_courts(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_courts_branch_id ON venue_courts(branch_id);
CREATE INDEX IF NOT EXISTS idx_venue_courts_status ON venue_courts(status);

-- ============================================================
-- 3B. VENUE BOOKINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES venue_branches(id) ON DELETE SET NULL,
  court_id UUID REFERENCES venue_courts(id) ON DELETE SET NULL,
  booking_type TEXT NOT NULL DEFAULT 'walk-in'
    CHECK (booking_type IN ('online', 'walk-in', 'tournament', 'membership', 'recurring')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC(6, 2) DEFAULT 1,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'qris', 'split', 'transfer', 'pending')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'checked-in', 'completed', 'cancelled', 'expired')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue_id ON venue_bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_branch_id ON venue_bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_court_id ON venue_bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_date ON venue_bookings(booking_date);

ALTER TABLE venue_bookings
  DROP CONSTRAINT IF EXISTS chk_venue_bookings_time_order;

ALTER TABLE venue_bookings
  ADD CONSTRAINT chk_venue_bookings_time_order CHECK (start_time < end_time);

CREATE OR REPLACE FUNCTION prevent_overlapping_venue_bookings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.court_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('pending', 'confirmed', 'checked-in') THEN
    IF EXISTS (
      SELECT 1
      FROM venue_bookings existing_booking
      WHERE existing_booking.court_id = NEW.court_id
        AND existing_booking.booking_date = NEW.booking_date
        AND existing_booking.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND existing_booking.status IN ('pending', 'confirmed', 'checked-in')
        AND (NEW.start_time, NEW.end_time) OVERLAPS (existing_booking.start_time, existing_booking.end_time)
    ) THEN
      RAISE EXCEPTION 'Court sudah dibooking pada jam tersebut';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venue_bookings_no_overlap ON venue_bookings;
CREATE TRIGGER trg_venue_bookings_no_overlap
  BEFORE INSERT OR UPDATE ON venue_bookings
  FOR EACH ROW EXECUTE FUNCTION prevent_overlapping_venue_bookings();

CREATE OR REPLACE FUNCTION expire_old_venue_bookings(p_venue_id INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE venue_bookings
  SET status = 'expired',
      updated_at = NOW()
  WHERE status IN ('pending', 'confirmed', 'checked-in')
    AND (
      booking_date < CURRENT_DATE
      OR (booking_date = CURRENT_DATE AND end_time <= CURRENT_TIME)
    )
    AND (p_venue_id IS NULL OR venue_id = p_venue_id);

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION expire_old_venue_bookings(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_old_venue_bookings(INTEGER) TO authenticated;

-- ============================================================
-- 4. VENUE STAFF
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'disabled', 'archived')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_staff_venue_id ON venue_staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_staff_user_id ON venue_staff(user_id);

-- ============================================================
-- 5. VENUE VERIFICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (verification_type IN ('individual', 'company')),
  -- Individual docs
  ktp_url TEXT,
  selfie_url TEXT,
  -- Company docs
  nib_url TEXT,
  npwp_url TEXT,
  legalitas_url TEXT,
  -- Review
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_verification_venue_id ON venue_verification(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_verification_status ON venue_verification(status);

-- ============================================================
-- 6. VENUE STAFF AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_staff_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_staff_audit_venue_id ON venue_staff_audit_log(venue_id);

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

-- venues: owner can see and edit their own venue
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_owner_all" ON venues;
CREATE POLICY "venue_owner_all" ON venues
  FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "venue_staff_read" ON venues;
CREATE POLICY "venue_staff_read" ON venues
  FOR SELECT
  USING (
    id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "venue_public_read" ON venues;
CREATE POLICY "venue_public_read" ON venues
  FOR SELECT
  USING (is_active = true AND verification_status = 'verified');

-- venue_branches
ALTER TABLE venue_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_branches_staff_read" ON venue_branches;
CREATE POLICY "venue_branches_staff_read" ON venue_branches
  FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "venue_branches_owner_write" ON venue_branches;
CREATE POLICY "venue_branches_owner_write" ON venue_branches
  FOR ALL
  USING (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  );

-- venue_courts
ALTER TABLE venue_courts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_courts_staff_read" ON venue_courts;
CREATE POLICY "venue_courts_staff_read" ON venue_courts
  FOR SELECT
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "venue_courts_manager_write" ON venue_courts;
CREATE POLICY "venue_courts_manager_write" ON venue_courts
  FOR ALL
  USING (
    venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'manager')
    )
    OR
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'manager')
    )
    OR
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "venue_courts_public_read" ON venue_courts;
CREATE POLICY "venue_courts_public_read" ON venue_courts
  FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues WHERE is_active = true AND verification_status = 'verified'
    )
  );

-- venue_bookings
ALTER TABLE venue_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_bookings_staff_read" ON venue_bookings;
CREATE POLICY "venue_bookings_staff_read" ON venue_bookings
  FOR SELECT
  USING (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
    OR venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "venue_bookings_staff_write" ON venue_bookings;
CREATE POLICY "venue_bookings_staff_write" ON venue_bookings
  FOR ALL
  USING (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
    OR venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager', 'cashier', 'staff')
    )
  )
  WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
    OR venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager', 'cashier', 'staff')
    )
  );

-- venue_staff
ALTER TABLE venue_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_staff_owner_all" ON venue_staff;
CREATE POLICY "venue_staff_owner_all" ON venue_staff
  FOR ALL
  USING (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
    OR
    venue_id IN (
      SELECT venue_id FROM venue_staff vs2
      WHERE vs2.user_id = auth.uid() AND vs2.status = 'active' AND vs2.role = 'manager'
    )
  )
  WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
    OR
    venue_id IN (
      SELECT venue_id FROM venue_staff vs2
      WHERE vs2.user_id = auth.uid() AND vs2.status = 'active' AND vs2.role = 'manager'
    )
  );

DROP POLICY IF EXISTS "venue_staff_self_read" ON venue_staff;
CREATE POLICY "venue_staff_self_read" ON venue_staff
  FOR SELECT
  USING (user_id = auth.uid());

-- venue_verification
ALTER TABLE venue_verification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_verification_submitter" ON venue_verification;
CREATE POLICY "venue_verification_submitter" ON venue_verification
  FOR ALL
  USING (submitted_by = auth.uid())
  WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "venue_verification_reviewer_read" ON venue_verification;
CREATE POLICY "venue_verification_reviewer_read" ON venue_verification
  FOR SELECT
  USING (public.is_admin_or_reviewer());

DROP POLICY IF EXISTS "venue_verification_reviewer_update" ON venue_verification;
CREATE POLICY "venue_verification_reviewer_update" ON venue_verification
  FOR UPDATE
  USING (public.is_admin_or_reviewer())
  WITH CHECK (public.is_admin_or_reviewer());

-- venue_staff_audit_log
ALTER TABLE venue_staff_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_audit_owner_read" ON venue_staff_audit_log;
CREATE POLICY "venue_audit_owner_read" ON venue_staff_audit_log
  FOR SELECT
  USING (
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
    OR
    venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "venue_audit_staff_insert" ON venue_staff_audit_log;
CREATE POLICY "venue_audit_staff_insert" ON venue_staff_audit_log
  FOR INSERT
  WITH CHECK (
    venue_id IN (
      SELECT venue_id FROM venue_staff
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    venue_id IN (SELECT id FROM venues WHERE owner_user_id = auth.uid())
  );

-- ============================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_venue_branches_updated_at ON venue_branches;
CREATE TRIGGER trg_venue_branches_updated_at
  BEFORE UPDATE ON venue_branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_venue_courts_updated_at ON venue_courts;
CREATE TRIGGER trg_venue_courts_updated_at
  BEFORE UPDATE ON venue_courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_venue_staff_updated_at ON venue_staff;
CREATE TRIGGER trg_venue_staff_updated_at
  BEFORE UPDATE ON venue_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_venue_bookings_updated_at ON venue_bookings;
CREATE TRIGGER trg_venue_bookings_updated_at
  BEFORE UPDATE ON venue_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
