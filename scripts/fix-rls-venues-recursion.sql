-- Fix recursive RLS dependency between public.venues and public.venue_staff
-- Root cause: venues SELECT policy references venue_staff, while venue_staff ALL policy references venues.

CREATE OR REPLACE FUNCTION public.can_manage_venue_staff(_venue_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = _venue_id
        AND v.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.venue_staff vs
      WHERE vs.venue_id = _venue_id
        AND vs.user_id = auth.uid()
        AND vs.status = 'active'
        AND vs.role = 'manager'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_venue_staff(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_venue_staff(integer) TO authenticated;

DROP POLICY IF EXISTS venue_staff_owner_all ON public.venue_staff;

CREATE POLICY venue_staff_owner_all
ON public.venue_staff
AS PERMISSIVE
FOR ALL
TO public
USING (public.can_manage_venue_staff(venue_id) OR user_id = auth.uid())
WITH CHECK (public.can_manage_venue_staff(venue_id) OR user_id = auth.uid());
