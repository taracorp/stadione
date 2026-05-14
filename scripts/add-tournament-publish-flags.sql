-- Tambahkan flag publikasi bagan/jadwal untuk kontrol visibilitas halaman publik.
-- Aman dijalankan berulang karena memakai IF NOT EXISTS.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS bracket_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bracket_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_published_at timestamptz;

-- Opsional: indeks ringan untuk query admin/filtering.
CREATE INDEX IF NOT EXISTS idx_tournaments_bracket_ready
  ON public.tournaments (bracket_ready);

CREATE INDEX IF NOT EXISTS idx_tournaments_schedule_ready
  ON public.tournaments (schedule_ready);
