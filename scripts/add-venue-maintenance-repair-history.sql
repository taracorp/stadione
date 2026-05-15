-- Phase 8B: repair history tracking
-- Keeps timeline of maintenance log changes for audit and historical analysis.

CREATE TABLE IF NOT EXISTS public.venue_maintenance_repair_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  maintenance_log_id text NOT NULL,
  action text NOT NULL
    CHECK (action IN ('created', 'updated', 'status_changed', 'cost_updated', 'resolved', 'closed')),
  old_status text,
  new_status text,
  old_estimated_cost numeric(12, 2),
  new_estimated_cost numeric(12, 2),
  note text,
  metadata jsonb DEFAULT '{}'::jsonb,
  action_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_maintenance_repair_history_venue
  ON public.venue_maintenance_repair_history(venue_id, action_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_maintenance_repair_history_log
  ON public.venue_maintenance_repair_history(maintenance_log_id, action_at DESC);

ALTER TABLE public.venue_maintenance_repair_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_maintenance_repair_history_read ON public.venue_maintenance_repair_history;
CREATE POLICY venue_maintenance_repair_history_read
ON public.venue_maintenance_repair_history
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_maintenance_repair_history_write ON public.venue_maintenance_repair_history;
CREATE POLICY venue_maintenance_repair_history_write
ON public.venue_maintenance_repair_history
FOR INSERT
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager', 'cashier', 'staff')
  )
);
