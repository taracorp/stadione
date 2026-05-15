-- Phase 8A: maintenance schedule & court blocking
-- Adds time-slot based maintenance schedules that can block booking/reschedule flow.

CREATE TABLE IF NOT EXISTS public.venue_maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  court_id uuid REFERENCES public.venue_courts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  maintenance_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  is_blocking boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_venue_maintenance_schedules_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_venue_maintenance_schedules_venue_date
  ON public.venue_maintenance_schedules(venue_id, maintenance_date);

CREATE INDEX IF NOT EXISTS idx_venue_maintenance_schedules_court
  ON public.venue_maintenance_schedules(court_id, maintenance_date);

ALTER TABLE public.venue_maintenance_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_maintenance_schedules_staff_read ON public.venue_maintenance_schedules;
CREATE POLICY venue_maintenance_schedules_staff_read
ON public.venue_maintenance_schedules
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_maintenance_schedules_manager_write ON public.venue_maintenance_schedules;
CREATE POLICY venue_maintenance_schedules_manager_write
ON public.venue_maintenance_schedules
FOR ALL
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
)
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
);

DROP TRIGGER IF EXISTS trg_venue_maintenance_schedules_updated_at ON public.venue_maintenance_schedules;
CREATE TRIGGER trg_venue_maintenance_schedules_updated_at
  BEFORE UPDATE ON public.venue_maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
