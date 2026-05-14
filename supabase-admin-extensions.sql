-- ============================================================
-- STADIONE — Admin Extensions Schema
-- Run this after supabase-schema.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. SPONSORS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsors (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  logo_url      text,
  category      text NOT NULL DEFAULT 'General', -- General, Title, Official, Media
  website       text,
  contact_name  text,
  contact_email text,
  status        text NOT NULL DEFAULT 'active',  -- active, inactive, expired, pending
  contract_start date,
  contract_end   date,
  notes          text,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage sponsors"
  ON sponsors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','finance_admin')
    )
  );

CREATE POLICY "Authenticated users can read sponsors"
  ON sponsors FOR SELECT
  USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────
-- 2. MATCH ASSIGNMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_assignments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id   integer REFERENCES tournaments(id) ON DELETE CASCADE,
  match_entry_id  text NOT NULL, -- references tournament_schedule.entry_id
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,          -- cached name for display
  role            text NOT NULL, -- referee, assistant_referee, match_commissioner, match_official, statistic_operator, venue_officer, timekeeper
  status          text NOT NULL DEFAULT 'assigned', -- assigned, confirmed, completed, cancelled
  venue           text,
  notes           text,
  assigned_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at     timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE match_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Official can read own assignments"
  ON match_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins manage assignments"
  ON match_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','tournament_host_admin')
    )
  );


-- ─────────────────────────────────────────────
-- 3. MATCH EVENTS (Live input during match)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id   integer REFERENCES tournaments(id) ON DELETE CASCADE,
  match_entry_id  text NOT NULL,
  event_type      text NOT NULL, -- goal, assist, yellow_card, red_card, sub_in, sub_out, penalty, own_goal
  player_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  player_name     text NOT NULL,
  player_number   text,
  team            text NOT NULL, -- home or away team name
  minute          integer,
  description     text,
  recorded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officials can insert match events"
  ON match_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','match_official','referee','match_commissioner','statistic_operator')
    )
  );

CREATE POLICY "Anyone authenticated can read match events"
  ON match_events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Officials can update/delete own events"
  ON match_events FOR ALL
  USING (
    recorded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin')
    )
  );


-- ─────────────────────────────────────────────
-- 4. MATCH REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_reports (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id       integer REFERENCES tournaments(id) ON DELETE CASCADE,
  match_entry_id      text NOT NULL,
  submitted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_name      text,
  final_score_home    integer DEFAULT 0,
  final_score_away    integer DEFAULT 0,
  home_team           text,
  away_team           text,
  report_text         text,
  incidents           text,  -- free text incident log
  attendance          integer DEFAULT 0,
  venue               text,
  status              text NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected
  admin_notes         text,
  reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  submitted_at        timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE match_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officials can manage own reports"
  ON match_reports FOR ALL
  USING (submitted_by = auth.uid());

CREATE POLICY "Platform admins manage all reports"
  ON match_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','verification_admin')
    )
  );

CREATE POLICY "Authenticated users can read submitted reports"
  ON match_reports FOR SELECT
  USING (auth.role() = 'authenticated' AND status IN ('submitted','approved'));


-- ─────────────────────────────────────────────
-- 5. MODERATION REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_reports (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type      text NOT NULL, -- post, community, news, user, comment
  content_id        text NOT NULL,
  content_preview   text,         -- cached excerpt for display
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending', -- pending, resolved, dismissed, escalated
  admin_notes       text,
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can report content"
  ON moderation_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Platform admins manage moderation"
  ON moderation_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','reviewer')
    )
  );

CREATE POLICY "Users can read own reports"
  ON moderation_reports FOR SELECT
  USING (reporter_user_id = auth.uid());


-- ─────────────────────────────────────────────
-- 6. ALTER TABLE news — add content columns
-- ─────────────────────────────────────────────
ALTER TABLE news ADD COLUMN IF NOT EXISTS body        text;
ALTER TABLE news ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE news ADD COLUMN IF NOT EXISTS tags        text[];
ALTER TABLE news ADD COLUMN IF NOT EXISTS published   boolean DEFAULT true;
ALTER TABLE news ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE news ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();


-- ─────────────────────────────────────────────
-- 7. INDEXES for performance
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_match_assignments_user    ON match_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_match_assignments_match   ON match_assignments(tournament_id, match_entry_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match        ON match_events(tournament_id, match_entry_id);
CREATE INDEX IF NOT EXISTS idx_match_reports_match       ON match_reports(tournament_id, match_entry_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_sponsors_status           ON sponsors(status);
