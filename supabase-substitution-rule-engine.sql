-- STADIONE Substitution & Rotation Rule Engine (Phase 1 foundation)
-- Apply after base schema files.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS substitution_rules jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tournaments.substitution_rules IS 'Rule config for substitution/rotation engine per tournament.';

CREATE TABLE IF NOT EXISTS match_rule_enforcement_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_entry_id text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, match_entry_id)
);

CREATE TABLE IF NOT EXISTS match_rule_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_entry_id text NOT NULL,
  violation_code text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  event_type text,
  player_name text,
  team text,
  minute integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocked boolean NOT NULL DEFAULT true,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_rule_state_match
  ON match_rule_enforcement_state(tournament_id, match_entry_id);

CREATE INDEX IF NOT EXISTS idx_match_rule_violations_match
  ON match_rule_violations(tournament_id, match_entry_id, created_at DESC);

ALTER TABLE match_rule_enforcement_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rule_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Officials can read match rule state" ON match_rule_enforcement_state;
CREATE POLICY "Officials can read match rule state"
  ON match_rule_enforcement_state FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Officials can write match rule state" ON match_rule_enforcement_state;
CREATE POLICY "Officials can write match rule state"
  ON match_rule_enforcement_state FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','match_official','referee','match_commissioner','statistic_operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','match_official','referee','match_commissioner','statistic_operator')
    )
  );

DROP POLICY IF EXISTS "Officials can read match rule violations" ON match_rule_violations;
CREATE POLICY "Officials can read match rule violations"
  ON match_rule_violations FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Officials can create match rule violations" ON match_rule_violations;
CREATE POLICY "Officials can create match rule violations"
  ON match_rule_violations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin','internal_admin','admin','match_official','referee','match_commissioner','statistic_operator')
    )
  );
