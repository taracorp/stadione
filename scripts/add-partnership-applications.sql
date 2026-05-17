-- ============================================================
-- Partnership Applications Table
-- Run this in Supabase SQL Editor (already applied to prod)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partnership_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('venue','coach','community','team_operator','eo_operator','sponsor')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','approved','rejected','on_hold')),

  -- Applicant info
  applicant_name      text NOT NULL,
  applicant_email     text NOT NULL,
  applicant_phone     text,
  applicant_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Partnership-type-specific details (flexible JSONB per category)
  details       jsonb DEFAULT '{}',

  -- Admin review fields
  admin_notes   text,
  reviewed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partnership_apps_type   ON public.partnership_applications(type);
CREATE INDEX IF NOT EXISTS idx_partnership_apps_status ON public.partnership_applications(status);
CREATE INDEX IF NOT EXISTS idx_partnership_apps_email  ON public.partnership_applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_partnership_apps_user   ON public.partnership_applications(applicant_user_id);

-- Row Level Security
ALTER TABLE public.partnership_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or anonymous) can submit
DROP POLICY IF EXISTS partnership_apps_insert ON public.partnership_applications;
CREATE POLICY partnership_apps_insert ON public.partnership_applications
  FOR INSERT WITH CHECK (true);

-- Applicant can view own submissions
DROP POLICY IF EXISTS partnership_apps_own_select ON public.partnership_applications;
CREATE POLICY partnership_apps_own_select ON public.partnership_applications
  FOR SELECT USING (
    applicant_user_id = auth.uid()
    OR applicant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can manage all applications
DROP POLICY IF EXISTS partnership_apps_admin_all ON public.partnership_applications;
CREATE POLICY partnership_apps_admin_all ON public.partnership_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','verification_admin','registration_admin')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_partnership_apps_updated_at ON public.partnership_applications;
CREATE TRIGGER trg_partnership_apps_updated_at
  BEFORE UPDATE ON public.partnership_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
