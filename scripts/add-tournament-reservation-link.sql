-- Add explicit reservation link for tournament match scheduling sync.
-- This allows UI/backend to track booking sync state without parsing notes marker.

ALTER TABLE IF EXISTS public.venue_tournament_matches
ADD COLUMN IF NOT EXISTS reservation_booking_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'venue_tournament_matches'
  ) THEN
    BEGIN
      ALTER TABLE public.venue_tournament_matches
      ADD CONSTRAINT venue_tournament_matches_reservation_booking_id_fkey
      FOREIGN KEY (reservation_booking_id)
      REFERENCES public.venue_bookings(id)
      ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_venue_tournament_matches_reservation_booking_id
ON public.venue_tournament_matches(reservation_booking_id);

-- Backfill relation for legacy rows that still rely on notes marker format.
UPDATE public.venue_tournament_matches tm
SET reservation_booking_id = b.id
FROM public.venue_bookings b
WHERE tm.reservation_booking_id IS NULL
  AND b.booking_type = 'tournament'
  AND b.notes IS NOT NULL
  AND b.notes LIKE '%[TOURNAMENT_MATCH:%]%'
  AND split_part(split_part(b.notes, '[TOURNAMENT_MATCH:', 2), ']', 1) = tm.id::text;
