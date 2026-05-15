-- Phase 9B: featured badge & placement metadata for public venue listing
-- Adds featured flags and priority sorting fields to venues.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_badge_label text DEFAULT 'Featured Venue',
  ADD COLUMN IF NOT EXISTS featured_until date;

CREATE INDEX IF NOT EXISTS idx_venues_featured_priority
  ON public.venues(is_featured DESC, featured_priority DESC, rating DESC);
