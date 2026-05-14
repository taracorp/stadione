-- Phase 6 QA smoke: tournament schedule <-> reservation sync integrity.
-- Run after scheduling at least one tournament match from VenueTournamentReservationPage.

-- 1) Schema readiness checks
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venue_tournament_matches'
      AND column_name = 'reservation_booking_id'
  ) AS has_reservation_booking_id;

SELECT
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'venue_tournament_matches'
      AND c.conname = 'venue_tournament_matches_reservation_booking_id_fkey'
  ) AS has_reservation_fk;

SELECT
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'venue_tournament_matches'
      AND indexname = 'idx_venue_tournament_matches_reservation_booking_id'
  ) AS has_reservation_index;

-- 2) Link integrity checks
SELECT
  COUNT(*) AS orphan_reservation_links
FROM public.venue_tournament_matches tm
LEFT JOIN public.venue_bookings b ON b.id = tm.reservation_booking_id
WHERE tm.reservation_booking_id IS NOT NULL
  AND b.id IS NULL;

SELECT
  COUNT(*) AS missing_links_for_scheduled_matches
FROM public.venue_tournament_matches tm
WHERE tm.scheduled_date IS NOT NULL
  AND tm.scheduled_time IS NOT NULL
  AND tm.court_id IS NOT NULL
  AND tm.reservation_booking_id IS NULL;

-- 3) Booking consistency checks
SELECT
  COUNT(*) AS non_tournament_booking_links
FROM public.venue_tournament_matches tm
JOIN public.venue_bookings b ON b.id = tm.reservation_booking_id
WHERE b.booking_type <> 'tournament';

SELECT
  COUNT(*) AS schedule_time_mismatches
FROM public.venue_tournament_matches tm
JOIN public.venue_bookings b ON b.id = tm.reservation_booking_id
WHERE tm.scheduled_date IS NOT NULL
  AND (
    b.booking_date <> tm.scheduled_date
    OR b.start_time::text <> tm.scheduled_time::text
    OR b.court_id <> tm.court_id
  );

-- 4) Badge status distribution helper
SELECT
  CASE
    WHEN tm.scheduled_date IS NULL OR tm.scheduled_time IS NULL OR tm.court_id IS NULL THEN 'Belum dijadwalkan'
    WHEN tm.reservation_booking_id IS NULL THEN 'Sync pending'
    WHEN b.id IS NULL THEN 'Sync failed'
    WHEN b.status = 'completed' THEN 'Court released'
    WHEN b.status = 'cancelled' THEN 'Sync failed'
    ELSE 'Court blocked'
  END AS expected_badge,
  COUNT(*) AS total
FROM public.venue_tournament_matches tm
LEFT JOIN public.venue_bookings b ON b.id = tm.reservation_booking_id
GROUP BY 1
ORDER BY 1;

-- 5) Detail rows for quick manual review (latest 20)
SELECT
  tm.id AS match_id,
  tm.round_name,
  tm.scheduled_date,
  tm.scheduled_time,
  tm.court_id,
  tm.reservation_booking_id,
  b.id AS booking_id,
  b.booking_type,
  b.status AS booking_status,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.notes
FROM public.venue_tournament_matches tm
LEFT JOIN public.venue_bookings b ON b.id = tm.reservation_booking_id
ORDER BY tm.updated_at DESC NULLS LAST
LIMIT 20;
