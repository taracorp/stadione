-- Extend official assignments so official workspace can reference venue tournament matches.

ALTER TABLE IF EXISTS public.match_assignments
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'tournament';

ALTER TABLE IF EXISTS public.match_assignments
ADD COLUMN IF NOT EXISTS venue_tournament_id uuid;

ALTER TABLE IF EXISTS public.match_assignments
ADD COLUMN IF NOT EXISTS venue_match_id uuid;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.match_assignments
    ADD CONSTRAINT match_assignments_source_type_check
    CHECK (source_type IN ('tournament', 'venue_tournament'));
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER TABLE public.match_assignments
    ADD CONSTRAINT match_assignments_venue_tournament_id_fkey
    FOREIGN KEY (venue_tournament_id)
    REFERENCES public.venue_tournaments(id)
    ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER TABLE public.match_assignments
    ADD CONSTRAINT match_assignments_venue_match_id_fkey
    FOREIGN KEY (venue_match_id)
    REFERENCES public.venue_tournament_matches(id)
    ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_match_assignments_source_type
ON public.match_assignments(source_type);

CREATE INDEX IF NOT EXISTS idx_match_assignments_venue_tournament
ON public.match_assignments(venue_tournament_id);

CREATE INDEX IF NOT EXISTS idx_match_assignments_venue_match
ON public.match_assignments(venue_match_id);

UPDATE public.match_assignments
SET source_type = COALESCE(NULLIF(source_type, ''), 'tournament')
WHERE source_type IS NULL OR source_type = '';
