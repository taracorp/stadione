-- Phase 9B: Ad analytics & ROI tracking
-- Tracks impressions, clicks, conversions, and ROI for ad campaigns

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AD IMPRESSIONS TABLE
-- Records each time an ad is displayed to a user
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.venue_ad_subscriptions(id) ON DELETE CASCADE,
  placement_channel text NOT NULL,
  user_id uuid,
  session_id text,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_ad_impressions_venue_subscription
  ON public.venue_ad_impressions(venue_id, subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_ad_impressions_channel
  ON public.venue_ad_impressions(placement_channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_ad_impressions_user
  ON public.venue_ad_impressions(user_id, created_at DESC);

ALTER TABLE public.venue_ad_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_ad_impressions_staff_read ON public.venue_ad_impressions;
CREATE POLICY venue_ad_impressions_staff_read
ON public.venue_ad_impressions
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_ad_impressions_public_insert ON public.venue_ad_impressions;
CREATE POLICY venue_ad_impressions_public_insert
ON public.venue_ad_impressions
FOR INSERT
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AD CLICKS TABLE
-- Records each time a user clicks on an ad
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_ad_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.venue_ad_subscriptions(id) ON DELETE CASCADE,
  placement_channel text NOT NULL,
  user_id uuid,
  session_id text,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_ad_clicks_venue_subscription
  ON public.venue_ad_clicks(venue_id, subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_ad_clicks_channel
  ON public.venue_ad_clicks(placement_channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_ad_clicks_user
  ON public.venue_ad_clicks(user_id, created_at DESC);

ALTER TABLE public.venue_ad_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_ad_clicks_staff_read ON public.venue_ad_clicks;
CREATE POLICY venue_ad_clicks_staff_read
ON public.venue_ad_clicks
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_ad_clicks_public_insert ON public.venue_ad_clicks;
CREATE POLICY venue_ad_clicks_public_insert
ON public.venue_ad_clicks
FOR INSERT
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AD CONVERSIONS TABLE
-- Records bookings that came from ad clicks (attribute conversion to ad)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.venue_ad_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.venue_ad_subscriptions(id) ON DELETE CASCADE,
  ad_click_id uuid REFERENCES public.venue_ad_clicks(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.venue_bookings(id) ON DELETE CASCADE,
  placement_channel text NOT NULL,
  user_id uuid,
  booking_amount_idr numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_ad_conversions_venue_subscription
  ON public.venue_ad_conversions(venue_id, subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_ad_conversions_booking
  ON public.venue_ad_conversions(booking_id);

CREATE INDEX IF NOT EXISTS idx_venue_ad_conversions_user
  ON public.venue_ad_conversions(user_id, created_at DESC);

ALTER TABLE public.venue_ad_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_ad_conversions_staff_read ON public.venue_ad_conversions;
CREATE POLICY venue_ad_conversions_staff_read
ON public.venue_ad_conversions
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_ad_conversions_staff_insert ON public.venue_ad_conversions;
CREATE POLICY venue_ad_conversions_staff_insert
ON public.venue_ad_conversions
FOR INSERT
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. AD ANALYTICS SUMMARY VIEW
-- Real-time aggregation of metrics per ad subscription
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.venue_ad_analytics_summary AS
SELECT
  sub.id AS subscription_id,
  sub.venue_id,
  sub.package_tier,
  sub.placement_scope,
  sub.monthly_fee_idr,
  COALESCE(imp_count.count, 0) AS total_impressions,
  COALESCE(click_count.count, 0) AS total_clicks,
  COALESCE(conv_count.count, 0) AS total_conversions,
  COALESCE(conv_amount.sum, 0) AS conversion_revenue_idr,
  CASE
    WHEN COALESCE(imp_count.count, 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(click_count.count, 0)::numeric / COALESCE(imp_count.count, 0)) * 100,
      2
    )
  END AS click_through_rate_percent,
  CASE
    WHEN COALESCE(click_count.count, 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(conv_count.count, 0)::numeric / COALESCE(click_count.count, 0)) * 100,
      2
    )
  END AS conversion_rate_percent,
  COALESCE(conv_amount.sum, 0) - sub.monthly_fee_idr AS net_roi_idr,
  CASE
    WHEN sub.monthly_fee_idr = 0 THEN 0
    ELSE ROUND(
      ((COALESCE(conv_amount.sum, 0) - sub.monthly_fee_idr) / sub.monthly_fee_idr * 100),
      2
    )
  END AS roi_percent,
  sub.created_at,
  sub.starts_at,
  sub.ends_at
FROM public.venue_ad_subscriptions sub
LEFT JOIN (
  SELECT subscription_id, COUNT(*) as count
  FROM public.venue_ad_impressions
  GROUP BY subscription_id
) imp_count ON sub.id = imp_count.subscription_id
LEFT JOIN (
  SELECT subscription_id, COUNT(*) as count
  FROM public.venue_ad_clicks
  GROUP BY subscription_id
) click_count ON sub.id = click_count.subscription_id
LEFT JOIN (
  SELECT subscription_id, COUNT(*) as count, SUM(booking_amount_idr) as sum
  FROM public.venue_ad_conversions
  GROUP BY subscription_id
) conv_count ON sub.id = conv_count.subscription_id
LEFT JOIN (
  SELECT subscription_id, SUM(booking_amount_idr) as sum
  FROM public.venue_ad_conversions
  GROUP BY subscription_id
) conv_amount ON sub.id = conv_amount.subscription_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TIME-SERIES ANALYTICS VIEW (7-day breakdown)
-- For trend visualization on dashboard
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.venue_ad_analytics_daily AS
SELECT
  sub.venue_id,
  sub.id AS subscription_id,
  DATE(imp.created_at) AS date,
  COALESCE(COUNT(DISTINCT imp.id), 0) AS impressions,
  COALESCE(COUNT(DISTINCT click.id), 0) AS clicks,
  COALESCE(COUNT(DISTINCT conv.id), 0) AS conversions,
  COALESCE(SUM(conv.booking_amount_idr), 0) AS revenue_idr
FROM public.venue_ad_subscriptions sub
LEFT JOIN public.venue_ad_impressions imp 
  ON sub.id = imp.subscription_id 
  AND imp.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.venue_ad_clicks click 
  ON sub.id = click.subscription_id 
  AND click.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.venue_ad_conversions conv 
  ON sub.id = conv.subscription_id 
  AND conv.created_at >= NOW() - INTERVAL '30 days'
WHERE sub.status IN ('active', 'expired')
GROUP BY sub.venue_id, sub.id, DATE(imp.created_at)
ORDER BY sub.venue_id, DATE(imp.created_at) DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_ad_impression(
  p_venue_id integer,
  p_subscription_id uuid,
  p_placement_channel text,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_device_type text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_impression_id uuid;
BEGIN
  INSERT INTO public.venue_ad_impressions
    (venue_id, subscription_id, placement_channel, user_id, session_id, device_type)
  VALUES
    (p_venue_id, p_subscription_id, p_placement_channel, p_user_id, p_session_id, p_device_type)
  RETURNING id INTO v_impression_id;
  
  RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_ad_click(
  p_venue_id integer,
  p_subscription_id uuid,
  p_placement_channel text,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_device_type text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_click_id uuid;
BEGIN
  INSERT INTO public.venue_ad_clicks
    (venue_id, subscription_id, placement_channel, user_id, session_id, device_type)
  VALUES
    (p_venue_id, p_subscription_id, p_placement_channel, p_user_id, p_session_id, p_device_type)
  RETURNING id INTO v_click_id;
  
  RETURN v_click_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_ad_conversion(
  p_venue_id integer,
  p_subscription_id uuid,
  p_ad_click_id uuid,
  p_booking_id uuid,
  p_placement_channel text,
  p_user_id uuid DEFAULT NULL,
  p_booking_amount_idr numeric DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
  v_conversion_id uuid;
BEGIN
  INSERT INTO public.venue_ad_conversions
    (venue_id, subscription_id, ad_click_id, booking_id, placement_channel, user_id, booking_amount_idr)
  VALUES
    (p_venue_id, p_subscription_id, p_ad_click_id, p_booking_id, p_placement_channel, p_user_id, p_booking_amount_idr)
  RETURNING id INTO v_conversion_id;
  
  RETURN v_conversion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
