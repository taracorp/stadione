-- Sprint 3 E2E QA: Assignment -> Match Center -> Match Report
-- Safe script for QA verification and seed data in development/staging.
-- Replace placeholders in SECTION 0 before running.

BEGIN;

-- ======================================================
-- SECTION 0: QA INPUTS (replace values)
-- ======================================================
-- Required values:
--   :qa_user_id         => UUID user official
--   :qa_tournament_id   => integer tournament id
--   :qa_match_entry_id  => text entry id in tournament_schedule
--
-- Optional role choices:
--   referee | match_commissioner | match_official | statistic_operator | venue_officer

-- Example (psql):
-- \set qa_user_id '00000000-0000-0000-0000-000000000000'
-- \set qa_tournament_id 1
-- \set qa_match_entry_id 'M1'

-- ======================================================
-- SECTION 1: Seed assignment for E2E run
-- ======================================================
INSERT INTO match_assignments (
  tournament_id,
  match_entry_id,
  user_id,
  display_name,
  role,
  status,
  venue,
  notes,
  assigned_at,
  updated_at
)
VALUES (
  :qa_tournament_id,
  :qa_match_entry_id,
  :qa_user_id,
  'QA Official',
  'referee',
  'assigned',
  'QA Arena',
  'Seeded by sprint3 e2e script',
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- ======================================================
-- SECTION 2: Simulate status workflow
-- ======================================================
UPDATE match_assignments
SET status = 'confirmed', updated_at = now()
WHERE user_id = :qa_user_id
  AND tournament_id = :qa_tournament_id
  AND match_entry_id = :qa_match_entry_id;

-- After report submission flow, app can move assignment to completed.
UPDATE match_assignments
SET status = 'completed', updated_at = now()
WHERE user_id = :qa_user_id
  AND tournament_id = :qa_tournament_id
  AND match_entry_id = :qa_match_entry_id;

-- ======================================================
-- SECTION 3: Verify match report persisted
-- ======================================================
SELECT
  mr.id,
  mr.tournament_id,
  mr.match_entry_id,
  mr.status,
  mr.final_score_home,
  mr.final_score_away,
  mr.submitted_by,
  mr.submitted_at,
  mr.updated_at
FROM match_reports mr
WHERE mr.tournament_id = :qa_tournament_id
  AND mr.match_entry_id = :qa_match_entry_id
ORDER BY mr.updated_at DESC
LIMIT 3;

-- ======================================================
-- SECTION 4: Verify derived match statistics
-- ======================================================
SELECT
  ms.player_id,
  ms.goals,
  ms.assists,
  ms.yellow_cards,
  ms.red_cards,
  ms.minutes_played,
  ms.updated_at
FROM match_statistics ms
WHERE ms.tournament_id = :qa_tournament_id
  AND ms.match_id = :qa_match_entry_id
ORDER BY ms.updated_at DESC
LIMIT 20;

-- ======================================================
-- SECTION 5: Verify assignment final state
-- ======================================================
SELECT
  ma.id,
  ma.user_id,
  ma.role,
  ma.status,
  ma.tournament_id,
  ma.match_entry_id,
  ma.updated_at
FROM match_assignments ma
WHERE ma.user_id = :qa_user_id
  AND ma.tournament_id = :qa_tournament_id
  AND ma.match_entry_id = :qa_match_entry_id
ORDER BY ma.updated_at DESC;

COMMIT;
