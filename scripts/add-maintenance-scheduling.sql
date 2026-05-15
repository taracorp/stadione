-- Maintenance Schedules & Court Blocking
-- Schedule maintenance periods and automatically block courts during maintenance

CREATE TABLE IF NOT EXISTS venue_maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  court_id UUID REFERENCES venue_courts(id) ON DELETE CASCADE, -- NULL means all courts
  title VARCHAR(255) NOT NULL,
  description TEXT,
  maintenance_type VARCHAR(50) NOT NULL DEFAULT 'repair', -- 'repair', 'cleaning', 'inspection', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  blocks_bookings BOOLEAN DEFAULT true,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  assigned_to UUID REFERENCES auth.users(id),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure dates are valid
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),

  -- Index for efficient queries
  INDEX idx_maintenance_schedules_venue_id (venue_id),
  INDEX idx_maintenance_schedules_court_id (court_id),
  INDEX idx_maintenance_schedules_dates (start_date, end_date),
  INDEX idx_maintenance_schedules_status (status)
);

-- RLS Policies for maintenance schedules
ALTER TABLE venue_maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Venue staff can read/write maintenance schedules for their venue
CREATE POLICY "maintenance_schedules_venue_staff_select"
  ON venue_maintenance_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_maintenance_schedules.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

CREATE POLICY "maintenance_schedules_venue_staff_insert"
  ON venue_maintenance_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_maintenance_schedules.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

CREATE POLICY "maintenance_schedules_venue_staff_update"
  ON venue_maintenance_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_maintenance_schedules.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

CREATE POLICY "maintenance_schedules_venue_staff_delete"
  ON venue_maintenance_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_maintenance_schedules.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

-- Function to check if a court is blocked for maintenance during a time slot
CREATE OR REPLACE FUNCTION is_court_under_maintenance(
  p_venue_id UUID,
  p_court_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM venue_maintenance_schedules
    WHERE venue_id = p_venue_id
    AND (court_id IS NULL OR court_id = p_court_id) -- NULL means all courts
    AND blocks_bookings = true
    AND status IN ('scheduled', 'in_progress')
    AND start_date <= p_booking_date
    AND end_date >= p_booking_date
    AND (
      is_all_day = true
      OR (
        start_time IS NOT NULL
        AND end_time IS NOT NULL
        AND (
          (p_start_time < end_time AND p_end_time > start_time) -- Overlap check
          OR (p_start_time >= start_time AND p_start_time < end_time)
          OR (p_end_time > start_time AND p_end_time <= end_time)
        )
      )
    )
  );
END;
$$;