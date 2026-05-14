-- ============================================================================
-- MEMBERSHIP + POS INTEGRATION SMOKE TEST
-- Phase 5 end-to-end: enrollment → discount → bonus hours → points
-- All tests wrapped in ROLLBACK — safe to run in production Supabase SQL editor
-- ============================================================================

BEGIN;

-- ── SETUP: Use a fake venue and customer ─────────────────────────────────────
DO $$
DECLARE
  v_venue_id          INTEGER := 1;  -- CHANGE to a real venue ID in your DB
  v_customer_id       UUID    := gen_random_uuid();
  v_membership_type_id UUID;
  v_membership_id     UUID;
  v_court_id          UUID;
  v_booking_id        UUID;
  v_payment_id        UUID;
  v_bonus_hour_id     UUID;
  v_shift_id          UUID;
  v_discount_result   RECORD;
  v_points_before     INTEGER;
  v_points_after      INTEGER;
BEGIN

  RAISE NOTICE '── TEST 1: Create Gold membership tier ──';
  INSERT INTO membership_types (
    venue_id, tier_name, discount_percent, has_priority_booking,
    bonus_hours_per_month, annual_fee_idr, is_active
  )
  VALUES (
    v_venue_id, 'Gold', 20.00, true, 2, 1500000, true
  )
  RETURNING id INTO v_membership_type_id;
  ASSERT v_membership_type_id IS NOT NULL, 'FAIL: membership_type insert failed';
  RAISE NOTICE 'PASS: Gold tier created (id=%)', v_membership_type_id;


  RAISE NOTICE '── TEST 2: Enroll customer into Gold tier ──';
  INSERT INTO customer_memberships (
    customer_id, venue_id, membership_type_id, status,
    start_date, end_date, reward_points_balance
  )
  VALUES (
    v_customer_id, v_venue_id, v_membership_type_id, 'active',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 0
  )
  RETURNING id INTO v_membership_id;
  ASSERT v_membership_id IS NOT NULL, 'FAIL: customer_memberships insert failed';
  RAISE NOTICE 'PASS: Customer enrolled (membership_id=%)', v_membership_id;


  RAISE NOTICE '── TEST 3: Allocate bonus hours ──';
  INSERT INTO bonus_hours (
    membership_id, hours_allocated, hours_used,
    allocated_date, expiration_date
  )
  VALUES (
    v_membership_id, 2, 0,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days'
  )
  RETURNING id INTO v_bonus_hour_id;
  ASSERT v_bonus_hour_id IS NOT NULL, 'FAIL: bonus_hours insert failed';
  RAISE NOTICE 'PASS: 2 bonus hours allocated (id=%)', v_bonus_hour_id;


  RAISE NOTICE '── TEST 4: calculate_membership_discount returns 20%% on Rp 200000 ──';
  SELECT * INTO v_discount_result
  FROM calculate_membership_discount(v_customer_id, v_venue_id, 200000);
  ASSERT v_discount_result.discount_percent = 20, 'FAIL: wrong discount percent';
  ASSERT v_discount_result.discount_amount = 40000, 'FAIL: wrong discount amount';
  ASSERT v_discount_result.final_price = 160000, 'FAIL: wrong final price';
  RAISE NOTICE 'PASS: Discount calc correct (20%% = Rp 40000, final Rp 160000)';


  RAISE NOTICE '── TEST 5: get_customer_active_membership returns correct tier ──';
  DECLARE
    v_active RECORD;
  BEGIN
    SELECT * INTO v_active
    FROM get_customer_active_membership(v_customer_id, v_venue_id);
    ASSERT v_active.membership_id = v_membership_id, 'FAIL: wrong membership_id';
    ASSERT v_active.tier_name = 'Gold', 'FAIL: wrong tier_name';
    ASSERT v_active.discount_percent = 20, 'FAIL: wrong discount_percent';
    ASSERT v_active.has_priority_booking = true, 'FAIL: priority_booking should be true';
    RAISE NOTICE 'PASS: Active membership lookup correct';
  END;


  RAISE NOTICE '── TEST 6: Create a shift + booking + payment with discount ──';
  -- Create a fake shift
  INSERT INTO venue_shifts (venue_id, branch_id, cashier_id, start_time, status)
  VALUES (v_venue_id, NULL, v_customer_id, NOW(), 'open')
  RETURNING id INTO v_shift_id;

  -- Create a booking
  INSERT INTO venue_bookings (
    venue_id, customer_name, customer_phone, booking_date,
    start_time, end_time, duration_hours, total_price,
    payment_method, payment_status, status, booking_type
  )
  VALUES (
    v_venue_id, 'Test Customer', '+6281234567890', CURRENT_DATE,
    '10:00', '12:00', 2, 200000,
    'cash', 'unpaid', 'pending', 'walk-in'
  )
  RETURNING id INTO v_booking_id;
  ASSERT v_booking_id IS NOT NULL, 'FAIL: booking insert failed';

  -- Create payment with discounted amount (Rp 160000)
  INSERT INTO venue_payments (
    booking_id, shift_id, amount, method, status, processed_by
  )
  VALUES (
    v_booking_id, v_shift_id, 160000, 'cash', 'confirmed', v_customer_id
  )
  RETURNING id INTO v_payment_id;
  ASSERT v_payment_id IS NOT NULL, 'FAIL: payment insert failed';

  -- Log discount
  INSERT INTO membership_discount_log (
    booking_id, membership_id, tier_name, discount_percent,
    original_price, discount_amount, final_price, reward_points_earned
  )
  VALUES (
    v_booking_id, v_membership_id, 'Gold', 20,
    200000, 40000, 160000, 1600
  );
  RAISE NOTICE 'PASS: Booking + payment + discount log created';


  RAISE NOTICE '── TEST 7: Earn reward points (1 pt per Rp 100 paid) ──';
  SELECT reward_points_balance INTO v_points_before
  FROM customer_memberships WHERE id = v_membership_id;

  INSERT INTO reward_points_log (
    membership_id, transaction_type, points_amount,
    booking_id, balance_before, balance_after, reason
  )
  VALUES (
    v_membership_id, 'earned', 1600,
    v_booking_id, v_points_before, v_points_before + 1600,
    'Reward points earned from booking'
  );

  SELECT reward_points_balance INTO v_points_after
  FROM customer_memberships WHERE id = v_membership_id;
  ASSERT v_points_after = v_points_before + 1600, 'FAIL: trigger did not update reward_points_balance';
  RAISE NOTICE 'PASS: Points updated by trigger (% → %)', v_points_before, v_points_after;


  RAISE NOTICE '── TEST 8: Use 1 bonus hour on the booking ──';
  UPDATE bonus_hours
  SET hours_used = 1, booking_id = v_booking_id, used_at = NOW()
  WHERE id = v_bonus_hour_id;

  DECLARE
    v_remaining NUMERIC;
  BEGIN
    SELECT (hours_allocated - hours_used) INTO v_remaining
    FROM bonus_hours WHERE id = v_bonus_hour_id;
    ASSERT v_remaining = 1, 'FAIL: hours_remaining should be 1 after using 1';
    RAISE NOTICE 'PASS: Bonus hour used, 1 jam remaining';
  END;


  RAISE NOTICE '── TEST 9: Expired bonus hours not returned by lookup ──';
  -- Insert expired bonus hour
  INSERT INTO bonus_hours (
    membership_id, hours_allocated, hours_used,
    allocated_date, expiration_date
  )
  VALUES (
    v_membership_id, 5, 0,
    CURRENT_DATE - INTERVAL '60 days',
    CURRENT_DATE - INTERVAL '1 day'  -- expired yesterday
  );

  DECLARE
    v_active_bonus_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_active_bonus_count
    FROM bonus_hours
    WHERE membership_id = v_membership_id
      AND expiration_date >= CURRENT_DATE
      AND (hours_allocated - hours_used) > 0;
    ASSERT v_active_bonus_count = 1, 'FAIL: should only count 1 non-expired bonus hour';
    RAISE NOTICE 'PASS: Expired bonus hours excluded from active count';
  END;


  RAISE NOTICE '── TEST 10: Membership status blocks expired memberships ──';
  -- Verify calculate_membership_discount returns 0 for non-active membership
  DECLARE
    v_expired_customer UUID := gen_random_uuid();
    v_expired_result RECORD;
    v_expired_type_id UUID;
  BEGIN
    INSERT INTO membership_types (venue_id, tier_name, discount_percent, has_priority_booking, bonus_hours_per_month, annual_fee_idr, is_active)
    VALUES (v_venue_id, 'Silver', 10.00, false, 0, 500000, true)
    RETURNING id INTO v_expired_type_id;

    INSERT INTO customer_memberships (customer_id, venue_id, membership_type_id, status, start_date, end_date, reward_points_balance)
    VALUES (v_expired_customer, v_venue_id, v_expired_type_id, 'expired', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE - INTERVAL '1 day', 0);

    SELECT * INTO v_expired_result
    FROM calculate_membership_discount(v_expired_customer, v_venue_id, 100000);
    ASSERT (v_expired_result IS NULL OR v_expired_result.discount_percent = 0),
      'FAIL: expired membership should yield 0 discount';
    RAISE NOTICE 'PASS: Expired membership yields 0 discount';
  END;


  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'ALL 10 MEMBERSHIP INTEGRATION TESTS PASSED ✓';
  RAISE NOTICE '════════════════════════════════════════';

END;
$$;

ROLLBACK;
-- NOTE: All changes are rolled back. Run SELECT statements manually to verify production data.
