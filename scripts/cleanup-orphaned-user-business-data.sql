-- Cleanup legacy business rows that can outlive auth user deletion.
-- Safe to run repeatedly.

DELETE FROM public.tournament_operator_verification_requests
WHERE requester_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id::text = tournament_operator_verification_requests.requester_user_id
  );

UPDATE public.tournament_operator_verification_requests
SET reviewed_by = NULL
WHERE reviewed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id::text = tournament_operator_verification_requests.reviewed_by
  );

UPDATE public.partnership_applications
SET reviewed_by = NULL
WHERE reviewed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = partnership_applications.reviewed_by
  );

UPDATE public.venue_verification
SET reviewed_by = NULL
WHERE reviewed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = venue_verification.reviewed_by
  );

UPDATE public.role_permissions
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = role_permissions.created_by
  );

UPDATE public.reward_points_log
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = reward_points_log.created_by
  );

UPDATE public.training_athlete_reports
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = training_athlete_reports.created_by
  );

UPDATE public.venue_ad_subscriptions
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = venue_ad_subscriptions.created_by
  );

UPDATE public.venue_bookings
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = venue_bookings.created_by
  );

UPDATE public.venue_cleaning_checklists
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = venue_cleaning_checklists.created_by
  );

UPDATE public.venue_maintenance_schedules
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = venue_maintenance_schedules.created_by
  );

UPDATE public.venue_tournaments
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = venue_tournaments.created_by
  );