-- Sprint 3 foundation: official profiles and assignment workflow.
-- Idempotent and safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS official_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  official_type text,
  license_level text,
  certification_no text,
  certification_body text,
  valid_from date,
  valid_until date,
  availability_note text,
  home_city text,
  profile_status text NOT NULL DEFAULT 'active' CHECK (profile_status IN ('active', 'inactive', 'suspended')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id integer REFERENCES tournaments(id) ON DELETE CASCADE,
  match_entry_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'completed', 'cancelled', 'declined')),
  venue text,
  notes text,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_official_profiles_status ON official_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_match_assignments_user ON match_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_match_assignments_match ON match_assignments(tournament_id, match_entry_id);
CREATE INDEX IF NOT EXISTS idx_match_assignments_status ON match_assignments(status);

ALTER TABLE official_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Official can read own profile" ON official_profiles;
CREATE POLICY "Official can read own profile"
  ON official_profiles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Official can upsert own profile" ON official_profiles;
CREATE POLICY "Official can upsert own profile"
  ON official_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read official profiles" ON official_profiles;
CREATE POLICY "Admins can read official profiles"
  ON official_profiles FOR SELECT
  USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));

DROP POLICY IF EXISTS "Official can read own assignments" ON match_assignments;
CREATE POLICY "Official can read own assignments"
  ON match_assignments FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Official can update own assignment status" ON match_assignments;
CREATE POLICY "Official can update own assignment status"
  ON match_assignments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('assigned', 'confirmed', 'completed', 'cancelled', 'declined'));

DROP POLICY IF EXISTS "Platform admins manage assignments" ON match_assignments;
CREATE POLICY "Platform admins manage assignments"
  ON match_assignments FOR ALL
  USING (
    public.has_app_role('super_admin')
    OR public.has_permission('operator.verify')
    OR public.has_permission('registration.approve')
  )
  WITH CHECK (
    public.has_app_role('super_admin')
    OR public.has_permission('operator.verify')
    OR public.has_permission('registration.approve')
  );

COMMIT;
