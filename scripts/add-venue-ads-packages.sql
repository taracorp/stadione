-- Phase 9A: ads package subscription system
-- Adds purchasable ad package records (Bronze/Silver/Gold/Platinum) for venue owners.

CREATE TABLE IF NOT EXISTS public.venue_ad_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  package_tier text NOT NULL CHECK (package_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  monthly_fee_idr numeric(12, 2) NOT NULL CHECK (monthly_fee_idr > 0),
  placement_scope text[] NOT NULL DEFAULT '{}',
  ctr_target_percent numeric(5, 2),
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'active', 'suspended', 'rejected', 'expired', 'cancelled')),
  starts_at date,
  ends_at date,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_ad_subscriptions_venue_status
  ON public.venue_ad_subscriptions(venue_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_ad_subscriptions_tier
  ON public.venue_ad_subscriptions(package_tier, status);

ALTER TABLE public.venue_ad_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_ad_subscriptions_staff_read ON public.venue_ad_subscriptions;
CREATE POLICY venue_ad_subscriptions_staff_read
ON public.venue_ad_subscriptions
FOR SELECT
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS venue_ad_subscriptions_manager_insert ON public.venue_ad_subscriptions;
CREATE POLICY venue_ad_subscriptions_manager_insert
ON public.venue_ad_subscriptions
FOR INSERT
WITH CHECK (
  venue_id IN (SELECT id FROM public.venues WHERE owner_user_id = auth.uid())
  OR venue_id IN (
    SELECT venue_id
    FROM public.venue_staff
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'manager')
  )
);

DROP POLICY IF EXISTS venue_ad_subscriptions_manager_update ON public.venue_ad_subscriptions;
CREATE POLICY venue_ad_subscriptions_manager_update
ON public.venue_ad_subscriptions
FOR UPDATE
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

DROP TRIGGER IF EXISTS trg_venue_ad_subscriptions_updated_at ON public.venue_ad_subscriptions;
CREATE TRIGGER trg_venue_ad_subscriptions_updated_at
  BEFORE UPDATE ON public.venue_ad_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
