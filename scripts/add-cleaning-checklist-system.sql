-- Cleaning Checklist System
-- Track recurring cleaning tasks and completion status

CREATE TABLE IF NOT EXISTS venue_cleaning_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  court_id UUID REFERENCES venue_courts(id) ON DELETE CASCADE, -- NULL means general venue cleaning
  title VARCHAR(255) NOT NULL,
  description TEXT,
  checklist_type VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'post_booking', 'custom'
  is_recurring BOOLEAN DEFAULT true,
  recurrence_pattern JSONB, -- Store complex recurrence rules
  estimated_duration_minutes INTEGER,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index for efficient queries
  INDEX idx_cleaning_checklists_venue_id (venue_id),
  INDEX idx_cleaning_checklists_court_id (court_id),
  INDEX idx_cleaning_checklists_type (checklist_type),
  INDEX idx_cleaning_checklists_active (is_active)
);

-- Cleaning checklist items/tasks
CREATE TABLE IF NOT EXISTS venue_cleaning_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES venue_cleaning_checklists(id) ON DELETE CASCADE,
  item_text VARCHAR(500) NOT NULL,
  item_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  estimated_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index for efficient queries
  INDEX idx_checklist_items_checklist_id (checklist_id)
);

-- Cleaning checklist completions/executions
CREATE TABLE IF NOT EXISTS venue_cleaning_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES venue_cleaning_checklists(id) ON DELETE CASCADE,
  court_id UUID REFERENCES venue_courts(id) ON DELETE CASCADE,
  executed_by UUID NOT NULL REFERENCES auth.users(id),
  executed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  executed_time TIME NOT NULL DEFAULT CURRENT_TIME,
  total_duration_minutes INTEGER,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'partial', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index for efficient queries
  INDEX idx_cleaning_executions_checklist_id (checklist_id),
  INDEX idx_cleaning_executions_court_id (court_id),
  INDEX idx_cleaning_executions_executed_by (executed_by),
  INDEX idx_cleaning_executions_date (executed_date)
);

-- Cleaning checklist item completions (many-to-many with executions)
CREATE TABLE IF NOT EXISTS venue_cleaning_execution_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES venue_cleaning_executions(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES venue_cleaning_checklist_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Ensure unique execution-item pairs
  UNIQUE(execution_id, checklist_item_id),
  INDEX idx_execution_items_execution_id (execution_id),
  INDEX idx_execution_items_item_id (checklist_item_id)
);

-- RLS Policies for cleaning checklists
ALTER TABLE venue_cleaning_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_cleaning_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_cleaning_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_cleaning_execution_items ENABLE ROW LEVEL SECURITY;

-- Venue staff can manage cleaning checklists
CREATE POLICY "cleaning_checklists_venue_staff_select"
  ON venue_cleaning_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_cleaning_checklists.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

CREATE POLICY "cleaning_checklists_venue_staff_insert"
  ON venue_cleaning_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_cleaning_checklists.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

CREATE POLICY "cleaning_checklists_venue_staff_update"
  ON venue_cleaning_checklists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = venue_cleaning_checklists.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );

-- Similar policies for other cleaning tables (items, executions, execution_items)
-- Following the same pattern as above for brevity

-- Function to get pending cleaning tasks for today
CREATE OR REPLACE FUNCTION get_pending_cleaning_tasks(p_venue_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  checklist_id UUID,
  court_id UUID,
  court_name VARCHAR(255),
  title VARCHAR(255),
  checklist_type VARCHAR(50),
  last_completed DATE,
  days_since_last_completion INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id,
    cl.court_id,
    COALESCE(vc.name, 'Venue General') as court_name,
    cl.title,
    cl.checklist_type,
    MAX(ce.executed_date) as last_completed,
    CASE
      WHEN MAX(ce.executed_date) IS NULL THEN 999
      ELSE p_date - MAX(ce.executed_date)
    END as days_since_last_completion
  FROM venue_cleaning_checklists cl
  LEFT JOIN venue_courts vc ON vc.id = cl.court_id
  LEFT JOIN venue_cleaning_executions ce ON ce.checklist_id = cl.id
    AND ce.status = 'completed'
  WHERE cl.venue_id = p_venue_id
    AND cl.is_active = true
    AND cl.is_recurring = true
  GROUP BY cl.id, cl.court_id, vc.name, cl.title, cl.checklist_type
  HAVING
    MAX(ce.executed_date) IS NULL
    OR (
      CASE cl.checklist_type
        WHEN 'daily' THEN p_date > MAX(ce.executed_date)
        WHEN 'weekly' THEN p_date - MAX(ce.executed_date) >= 7
        WHEN 'monthly' THEN EXTRACT(MONTH FROM p_date) != EXTRACT(MONTH FROM MAX(ce.executed_date))
        ELSE false
      END
    )
  ORDER BY days_since_last_completion DESC, cl.priority DESC;
END;
$$;