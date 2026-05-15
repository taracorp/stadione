-- Staff Action Audit Log
-- Tracks all staff actions for compliance and accountability

CREATE TABLE IF NOT EXISTS staff_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'booking_update', 'payment_change', 'staff_invite', etc.
  action_description TEXT NOT NULL,
  target_type VARCHAR(50), -- 'booking', 'payment', 'staff', 'customer', etc.
  target_id UUID, -- ID of the affected record
  old_values JSONB, -- Previous state (optional)
  new_values JSONB, -- New state (optional)
  metadata JSONB, -- Additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for efficient queries
  INDEX idx_staff_action_logs_venue_id (venue_id),
  INDEX idx_staff_action_logs_staff_user_id (staff_user_id),
  INDEX idx_staff_action_logs_action_type (action_type),
  INDEX idx_staff_action_logs_created_at (created_at),
  INDEX idx_staff_action_logs_target (target_type, target_id)
);

-- RLS Policies for staff action logs
ALTER TABLE staff_action_logs ENABLE ROW LEVEL SECURITY;

-- Staff can read logs for their venue
CREATE POLICY "staff_action_logs_venue_staff_select"
  ON staff_action_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = staff_action_logs.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

-- Only system/service can insert logs (staff actions are logged by backend functions)
CREATE POLICY "staff_action_logs_insert"
  ON staff_action_logs FOR INSERT
  WITH CHECK (false); -- Disable direct inserts, use functions instead

-- Function to log staff actions
CREATE OR REPLACE FUNCTION log_staff_action(
  p_venue_id UUID,
  p_staff_user_id UUID,
  p_action_type VARCHAR(50),
  p_action_description TEXT,
  p_target_type VARCHAR(50) DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Verify staff has access to venue
  IF NOT EXISTS (
    SELECT 1 FROM venue_staff
    WHERE venue_id = p_venue_id
    AND user_id = p_staff_user_id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Staff member does not have access to this venue';
  END IF;

  INSERT INTO staff_action_logs (
    venue_id,
    staff_user_id,
    action_type,
    action_description,
    target_type,
    target_id,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    p_venue_id,
    p_staff_user_id,
    p_action_type,
    p_action_description,
    p_target_type,
    p_target_id,
    p_old_values,
    p_new_values,
    p_metadata,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;