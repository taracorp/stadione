-- Perbaikan RLS khusus tabel user_tournament_participations
-- Jalankan di Supabase SQL Editor untuk mengizinkan user insert/read datanya sendiri.

ALTER TABLE IF EXISTS public.user_tournament_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own tournament participations" ON public.user_tournament_participations;
DROP POLICY IF EXISTS "Users can view their own tournament participations" ON public.user_tournament_participations;

CREATE POLICY "Users can insert their own tournament participations"
  ON public.user_tournament_participations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tournament participations"
  ON public.user_tournament_participations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.user_tournament_participations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_tournament_participations_id_seq TO authenticated;
