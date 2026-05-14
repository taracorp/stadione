-- Phase 6 QA smoke: official assignment integration for venue tournament source.
-- Designed to verify the seeded smoke data and future reruns of the same integration shape.

-- 1) Source-aware assignment schema readiness
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_assignments'
      AND column_name = 'source_type'
  ) AS has_source_type,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_assignments'
      AND column_name = 'venue_tournament_id'
  ) AS has_venue_tournament_id,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_assignments'
      AND column_name = 'venue_match_id'
  ) AS has_venue_match_id;

-- 2) Venue report storage readiness
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'venue_match_reports'
  ) AS has_venue_match_reports_table;

-- 3) Latest venue tournament official assignments
SELECT
  ma.id AS assignment_id,
  ma.user_id,
  ma.role,
  ma.status,
  ma.source_type,
  ma.match_entry_id,
  ma.venue_tournament_id,
  ma.venue_match_id,
  COALESCE(vt.name, ma.display_name) AS tournament_name,
  vt.sport_type,
  vm.round_name,
  vm.scheduled_date,
  vm.scheduled_time,
  vc.name AS court_name,
  vb.status AS booking_status,
  ma.venue,
  ma.notes
FROM public.match_assignments ma
LEFT JOIN public.venue_tournaments vt ON vt.id = ma.venue_tournament_id
LEFT JOIN public.venue_tournament_matches vm ON vm.id = ma.venue_match_id
LEFT JOIN public.venue_courts vc ON vc.id = vm.court_id
LEFT JOIN public.venue_bookings vb ON vb.id = vm.reservation_booking_id
WHERE ma.source_type = 'venue_tournament'
ORDER BY ma.assigned_at DESC NULLS LAST
LIMIT 20;

-- 4) Integrity checks for venue tournament assignments
SELECT
  COUNT(*) AS orphan_venue_assignment_links
FROM public.match_assignments ma
LEFT JOIN public.venue_tournaments vt ON vt.id = ma.venue_tournament_id
LEFT JOIN public.venue_tournament_matches vm ON vm.id = ma.venue_match_id
WHERE ma.source_type = 'venue_tournament'
  AND (
    ma.venue_tournament_id IS NULL
    OR ma.venue_match_id IS NULL
    OR vt.id IS NULL
    OR vm.id IS NULL
  );

SELECT
  COUNT(*) AS venue_assignments_without_confirmed_booking
FROM public.match_assignments ma
JOIN public.venue_tournament_matches vm ON vm.id = ma.venue_match_id
LEFT JOIN public.venue_bookings vb ON vb.id = vm.reservation_booking_id
WHERE ma.source_type = 'venue_tournament'
  AND (vb.id IS NULL OR vb.status <> 'confirmed');

-- 5) Smoke seed lookup for quick rerun verification
SELECT
  ma.id AS assignment_id,
  vt.name AS tournament_name,
  vm.id AS match_id,
  vm.round_name,
  vm.scheduled_date,
  vm.scheduled_time,
  vb.id AS booking_id,
  vb.status AS booking_status,
  vr.id AS report_id,
  vr.status AS report_status
FROM public.match_assignments ma
JOIN public.venue_tournaments vt ON vt.id = ma.venue_tournament_id
JOIN public.venue_tournament_matches vm ON vm.id = ma.venue_match_id
LEFT JOIN public.venue_bookings vb ON vb.id = vm.reservation_booking_id
LEFT JOIN public.venue_match_reports vr ON vr.venue_match_id = vm.id
WHERE ma.notes ILIKE '%Phase 6 official smoke assignment%'
ORDER BY ma.assigned_at DESC NULLS LAST
LIMIT 10;
