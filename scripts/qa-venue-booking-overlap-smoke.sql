-- Venue booking overlap smoke test.
-- Run in Supabase SQL Editor after migration deploy.
-- This script is idempotent for repeated runs because it ends with ROLLBACK.

BEGIN;

DO $$
DECLARE
  v_venue_id INTEGER;
  v_branch_id UUID;
  v_court_id UUID;
BEGIN
  SELECT COALESCE(MAX(id), 0) + 1 INTO v_venue_id FROM public.venues;

  INSERT INTO public.venues (
    id,
    name,
    city,
    verification_status,
    is_active,
    description
  ) VALUES (
    v_venue_id,
    'QA Overlap Smoke Venue',
    'Yogyakarta',
    'verified',
    true,
    'Temporary row for overlap smoke test'
  );

  INSERT INTO public.venue_branches (
    venue_id,
    name,
    address,
    city,
    province,
    status
  ) VALUES (
    v_venue_id,
    'QA Overlap Branch',
    'Jl QA Overlap 1',
    'Sleman',
    'DI Yogyakarta',
    'active'
  ) RETURNING id INTO v_branch_id;

  INSERT INTO public.venue_courts (
    venue_id,
    branch_id,
    name,
    sport_type,
    surface_type,
    capacity,
    indoor,
    has_lighting,
    has_ac,
    price_per_hour,
    status,
    notes
  ) VALUES (
    v_venue_id,
    v_branch_id,
    'QA Overlap Court A',
    'Futsal',
    'Synthetic',
    2,
    true,
    true,
    false,
    150000,
    'available',
    'QA overlap smoke court'
  ) RETURNING id INTO v_court_id;

  INSERT INTO public.venue_bookings (
    venue_id,
    branch_id,
    court_id,
    booking_type,
    customer_name,
    booking_date,
    start_time,
    end_time,
    duration_hours,
    total_price,
    payment_method,
    payment_status,
    status,
    notes
  ) VALUES (
    v_venue_id,
    v_branch_id,
    v_court_id,
    'walk-in',
    'QA Base Booking',
    current_date,
    '10:00',
    '11:00',
    1,
    150000,
    'cash',
    'paid',
    'confirmed',
    'qa_overlap_base'
  );

  BEGIN
    INSERT INTO public.venue_bookings (
      venue_id,
      branch_id,
      court_id,
      booking_type,
      customer_name,
      booking_date,
      start_time,
      end_time,
      duration_hours,
      total_price,
      payment_method,
      payment_status,
      status,
      notes
    ) VALUES (
      v_venue_id,
      v_branch_id,
      v_court_id,
      'walk-in',
      'QA Overlap Should Fail',
      current_date,
      '10:30',
      '11:30',
      1,
      150000,
      'cash',
      'unpaid',
      'confirmed',
      'qa_overlap_should_fail'
    );

    RAISE EXCEPTION 'Overlap guard FAILED: overlapping booking inserted unexpectedly.';
  EXCEPTION
    WHEN OTHERS THEN
      IF POSITION('Court sudah dibooking pada jam tersebut' IN SQLERRM) = 0 THEN
        RAISE;
      END IF;
      RAISE NOTICE 'Overlap guard OK: %', SQLERRM;
  END;

  INSERT INTO public.venue_bookings (
    venue_id,
    branch_id,
    court_id,
    booking_type,
    customer_name,
    booking_date,
    start_time,
    end_time,
    duration_hours,
    total_price,
    payment_method,
    payment_status,
    status,
    notes
  ) VALUES (
    v_venue_id,
    v_branch_id,
    v_court_id,
    'walk-in',
    'QA Non Overlap Should Pass',
    current_date,
    '11:00',
    '12:00',
    1,
    150000,
    'cash',
    'paid',
    'confirmed',
    'qa_overlap_should_pass'
  );

  IF (
    SELECT COUNT(*)
    FROM public.venue_bookings
    WHERE venue_id = v_venue_id
      AND notes IN ('qa_overlap_base', 'qa_overlap_should_pass')
  ) <> 2 THEN
    RAISE EXCEPTION 'Smoke test FAILED: expected 2 persisted non-overlap bookings for test venue.';
  END IF;

  RAISE NOTICE 'Smoke test PASSED: overlap rejected and non-overlap accepted.';
END $$;

ROLLBACK;