-- Official lineup storage for venue tournament matches.

CREATE TABLE IF NOT EXISTS public.venue_match_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_tournament_id uuid REFERENCES public.venue_tournaments(id) ON DELETE CASCADE,
  venue_match_id uuid NOT NULL REFERENCES public.venue_tournament_matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.venue_tournament_teams(id) ON DELETE SET NULL,
  player_key text NOT NULL,
  player_name text NOT NULL,
  starting_eleven boolean NOT NULL DEFAULT false,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_match_lineups_unique_player UNIQUE (venue_match_id, player_key)
);

CREATE INDEX IF NOT EXISTS idx_venue_match_lineups_match
ON public.venue_match_lineups(venue_match_id);

CREATE INDEX IF NOT EXISTS idx_venue_match_lineups_tournament
ON public.venue_match_lineups(venue_tournament_id);
