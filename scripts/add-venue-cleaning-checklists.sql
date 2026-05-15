-- Phase 8B: cleaning checklist system
-- Adds checklist records per venue/court/date/shift to support field operations.

CREATE TABLE IF NOT EXISTS public.venue_cleaning_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  court_id uuid REFERENCES public.venue_courts(id) ON DELETE SET NULL,
  title text NOT NULL,
  check_date date NOT NULL,
  shift_label text NOT NULL DEFAULT 'morning'
    CHECK (shift_label IN ('morning', 'afternoon', 'evening', 'night')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_cleaning_checklists_venue_date
  ON public.venue_cleaning_checklists(venue_id, check_date);

CREATE INDEX IF NOT EXISTS idx_venue_cleaning_checklists_court
  ON public.venue_cleaning_checklists(court_id, check_date);

ALTER TABLE public.venue_cleaning_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_cleaning_checklists_staff_read ON public.venue_cleaning_checklists;
CREATE POLICY venue_cleaning_checklists_staff_read
ON public.venue_cleaning_checklists
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_cleaning_checklists_staff_write ON public.venue_cleaning_checklists;
CREATE POLICY venue_cleaning_checklists_staff_write
ON public.venue_cleaning_checklists
FOR ALL
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager', 'cashier', 'staff')
  )
)
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager', 'cashier', 'staff')
  )
);

DROP TRIGGER IF EXISTS trg_venue_cleaning_checklists_updated_at ON public.venue_cleaning_checklists;
CREATE TRIGGER trg_venue_cleaning_checklists_updated_at
  BEFORE UPDATE ON public.venue_cleaning_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
