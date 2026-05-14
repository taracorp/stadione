-- Official reporting storage for venue tournament matches.

CREATE TABLE IF NOT EXISTS public.venue_match_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_tournament_id uuid REFERENCES public.venue_tournaments(id) ON DELETE CASCADE,
  venue_match_id uuid NOT NULL REFERENCES public.venue_tournament_matches(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_name text,
  final_score_home integer DEFAULT 0,
  final_score_away integer DEFAULT 0,
  home_team text,
  away_team text,
  report_text text,
  incidents text,
  attendance integer,
  venue text,
  status text NOT NULL DEFAULT 'draft',
  admin_notes text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_match_reports_status_check CHECK (status IN ('draft', 'submitted', 'reviewed'))
);

CREATE INDEX IF NOT EXISTS idx_venue_match_reports_match
ON public.venue_match_reports(venue_match_id, status);

CREATE INDEX IF NOT EXISTS idx_venue_match_reports_tournament
ON public.venue_match_reports(venue_tournament_id);
