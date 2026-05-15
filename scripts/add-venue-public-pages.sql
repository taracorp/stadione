-- Phase 10A: Public Venue Page System
-- Adds photos, facilities, reviews, and operating hours for public-facing venue displays

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VENUE PHOTOS TABLE
-- Store multiple photos per venue (gallery)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  title text,
  description text,
  photo_order integer DEFAULT 0,
  is_cover boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_photos_venue_id
  ON public.venue_photos(venue_id, photo_order, is_cover);

CREATE INDEX IF NOT EXISTS idx_venue_photos_created_at
  ON public.venue_photos(created_at DESC);

ALTER TABLE public.venue_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_photos_public_read ON public.venue_photos;
CREATE POLICY venue_photos_public_read
ON public.venue_photos
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE verification_status = 'verified')
);

DROP POLICY IF EXISTS venue_photos_staff_write ON public.venue_photos;
CREATE POLICY venue_photos_staff_write
ON public.venue_photos
FOR INSERT WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
);

DROP POLICY IF EXISTS venue_photos_staff_delete ON public.venue_photos;
CREATE POLICY venue_photos_staff_delete
ON public.venue_photos
FOR DELETE
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VENUE FACILITIES/AMENITIES TABLE
-- Track what facilities the venue offers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  facility_name text NOT NULL,
  facility_category text NOT NULL,
  available boolean DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(venue_id, facility_name)
);

CREATE INDEX IF NOT EXISTS idx_venue_facilities_venue_id
  ON public.venue_facilities(venue_id);

CREATE INDEX IF NOT EXISTS idx_venue_facilities_category
  ON public.venue_facilities(facility_category);

ALTER TABLE public.venue_facilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_facilities_public_read ON public.venue_facilities;
CREATE POLICY venue_facilities_public_read
ON public.venue_facilities
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE verification_status = 'verified')
);

DROP POLICY IF EXISTS venue_facilities_staff_write ON public.venue_facilities;
CREATE POLICY venue_facilities_staff_write
ON public.venue_facilities
FOR INSERT, UPDATE, DELETE
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
)
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VENUE REVIEWS TABLE
-- Customer reviews and ratings for venues
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text NOT NULL,
  rating numeric(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  verified_booking boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_venue_id
  ON public.venue_reviews(venue_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_rating
  ON public.venue_reviews(venue_id, rating);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_user_id
  ON public.venue_reviews(user_id, created_at DESC);

ALTER TABLE public.venue_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_reviews_public_read ON public.venue_reviews;
CREATE POLICY venue_reviews_public_read
ON public.venue_reviews
FOR SELECT
USING (status = 'approved');

DROP POLICY IF EXISTS venue_reviews_authenticated_insert ON public.venue_reviews;
CREATE POLICY venue_reviews_authenticated_insert
ON public.venue_reviews
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS venue_reviews_user_update ON public.venue_reviews;
CREATE POLICY venue_reviews_user_update
ON public.venue_reviews
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS venue_reviews_moderator_manage ON public.venue_reviews;
CREATE POLICY venue_reviews_moderator_manage
ON public.venue_reviews
FOR ALL
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR auth.jwt() ->> 'role' IN ('super_admin', 'internal_admin')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. OPERATING HOURS TABLE
-- Define venue operating hours by day of week
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_open boolean DEFAULT true,
  open_time time,
  close_time time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(venue_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_venue_operating_hours_venue_id
  ON public.venue_operating_hours(venue_id);

ALTER TABLE public.venue_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_operating_hours_public_read ON public.venue_operating_hours;
CREATE POLICY venue_operating_hours_public_read
ON public.venue_operating_hours
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE verification_status = 'verified')
);

DROP POLICY IF EXISTS venue_operating_hours_staff_write ON public.venue_operating_hours;
CREATE POLICY venue_operating_hours_staff_write
ON public.venue_operating_hours
FOR INSERT, UPDATE, DELETE
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
)
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VENUE REVIEW SUMMARY VIEW
-- Real-time aggregation of review metrics
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.venue_review_summary AS
SELECT
  v.id,
  v.name,
  v.city,
  COUNT(DISTINCT vr.id) AS total_reviews,
  ROUND(AVG(vr.rating)::numeric, 1) AS average_rating,
  COUNT(CASE WHEN vr.rating = 5 THEN 1 END) AS five_star_count,
  COUNT(CASE WHEN vr.rating = 4 THEN 1 END) AS four_star_count,
  COUNT(CASE WHEN vr.rating = 3 THEN 1 END) AS three_star_count,
  COUNT(CASE WHEN vr.rating = 2 THEN 1 END) AS two_star_count,
  COUNT(CASE WHEN vr.rating = 1 THEN 1 END) AS one_star_count,
  COUNT(CASE WHEN vr.verified_booking THEN 1 END) AS verified_booking_count
FROM public.venues v
LEFT JOIN public.venue_reviews vr ON v.id = vr.venue_id AND vr.status = 'approved'
WHERE v.verification_status = 'verified'
GROUP BY v.id, v.name, v.city;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_venue_by_id_public(p_venue_id integer)
RETURNS jsonb AS $$
DECLARE
  v_venue jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'city', v.city,
    'province', v.province,
    'address', v.address,
    'sport', v.sport,
    'price', v.price,
    'description', v.description,
    'contact_number', v.contact_number,
    'maps_url', v.maps_url,
    'is_featured', v.is_featured,
    'is_sponsored', v.is_sponsored,
    'featured_priority', v.featured_priority,
    'verification_status', v.verification_status,
    'rating', COALESCE((SELECT average_rating FROM venue_review_summary WHERE id = v.id), 0),
    'reviews_count', COALESCE((SELECT total_reviews FROM venue_review_summary WHERE id = v.id), 0)
  )
  INTO v_venue
  FROM public.venues v
  WHERE v.id = p_venue_id AND v.verification_status = 'verified';
  
  RETURN v_venue;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.search_venues_public(
  p_sport text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_min_price integer DEFAULT NULL,
  p_max_price integer DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id integer,
  name text,
  city text,
  province text,
  sport text,
  price integer,
  rating numeric,
  reviews_count bigint,
  is_featured boolean,
  featured_priority integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    v.city,
    v.province,
    v.sport,
    v.price,
    COALESCE(rs.average_rating, 0::numeric),
    COALESCE(rs.total_reviews, 0::bigint),
    v.is_featured,
    v.featured_priority
  FROM public.venues v
  LEFT JOIN public.venue_review_summary rs ON v.id = rs.id
  WHERE v.verification_status = 'verified'
    AND v.is_active = true
    AND (p_sport IS NULL OR v.sport ILIKE '%' || p_sport || '%')
    AND (p_province IS NULL OR v.province ILIKE '%' || p_province || '%')
    AND (p_city IS NULL OR v.city ILIKE '%' || p_city || '%')
    AND (p_min_price IS NULL OR v.price >= p_min_price)
    AND (p_max_price IS NULL OR v.price <= p_max_price)
  ORDER BY
    v.is_featured DESC,
    v.featured_priority DESC,
    rs.average_rating DESC,
    v.name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
