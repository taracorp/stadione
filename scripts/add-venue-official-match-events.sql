-- Official live event storage for venue tournament matches.

CREATE TABLE IF NOT EXISTS public.venue_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_tournament_id uuid REFERENCES public.venue_tournaments(id) ON DELETE CASCADE,
  venue_match_id uuid NOT NULL REFERENCES public.venue_tournament_matches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  team text,
  player_name text,
  minute integer,
  description text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_match_events_event_type_check CHECK (
    event_type IN ('goal', 'assist', 'yellow_card', 'red_card', 'sub_in', 'sub_out', 'attendance', 'lineup_approval')
  )
);

CREATE INDEX IF NOT EXISTS idx_venue_match_events_match
ON public.venue_match_events(venue_match_id, created_at);

CREATE INDEX IF NOT EXISTS idx_venue_match_events_tournament
ON public.venue_match_events(venue_tournament_id);
