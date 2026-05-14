-- ============================================================================
-- PHASE 4 STAGING E2E SMOKE TEST
-- Covers: shift open, walk-in booking, payment, invoice, refund, shift close
-- Run against staging and review results before production deploy.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_venue_id INTEGER;
  v_branch_id UUID;
  v_court_id UUID;
  v_cashier_id UUID;
  v_shift_id UUID;
  v_booking_id UUID;
  v_payment_id UUID;
  v_invoice_id UUID;
BEGIN
  SELECT v.id, vb.id, vc.id, au.id
  INTO v_venue_id, v_branch_id, v_court_id, v_cashier_id
  FROM venues v
  JOIN venue_branches vb ON vb.venue_id = v.id
  JOIN venue_courts vc ON vc.branch_id = vb.id
  JOIN auth.users au ON au.email LIKE '%@test%'
  LIMIT 1;

  IF v_venue_id IS NULL OR v_branch_id IS NULL OR v_court_id IS NULL OR v_cashier_id IS NULL THEN
    RAISE EXCEPTION 'Staging E2E setup incomplete: venue/branch/court/cashier not found';
  END IF;

  INSERT INTO venue_shifts (venue_id, branch_id, cashier_id, start_time, status)
  VALUES (v_venue_id, v_branch_id, v_cashier_id, NOW(), 'open')
  RETURNING id INTO v_shift_id;

  INSERT INTO venue_bookings (
    venue_id, branch_id, court_id, customer_name, customer_phone,
    booking_date, start_time, end_time, duration_hours, total_price,
    payment_method, payment_status, status, booking_type, created_by
  ) VALUES (
    v_venue_id, v_branch_id, v_court_id, 'Phase 4 E2E Customer', '081234567890',
    CURRENT_DATE, '18:00'::time, '19:00'::time, 1, 100000,
    'cash', 'unpaid', 'pending', 'walk-in', v_cashier_id
  ) RETURNING id INTO v_booking_id;

  INSERT INTO venue_payments (
    booking_id, shift_id, amount, method, status, processed_by
  ) VALUES (
    v_booking_id, v_shift_id, 100000, 'cash', 'confirmed', v_cashier_id
  ) RETURNING id INTO v_payment_id;

  INSERT INTO venue_invoices (
    booking_id, payment_id, invoice_number, items, subtotal, tax, total,
    customer_name, customer_phone, status, issued_at
  ) VALUES (
    v_booking_id,
    v_payment_id,
    'INV-E2E-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS'),
    jsonb_build_array(jsonb_build_object('description', 'Court rental', 'quantity', 1, 'unit_price', 100000, 'total', 100000)),
    100000, 0, 100000,
    'Phase 4 E2E Customer', '081234567890', 'issued', NOW()
  ) RETURNING id INTO v_invoice_id;

  UPDATE venue_bookings SET status = 'paid', payment_status = 'paid' WHERE id = v_booking_id;
  UPDATE venue_payments SET status = 'refunded', notes = 'E2E refund' WHERE id = v_payment_id;
  UPDATE venue_invoices SET status = 'voided', notes = 'E2E refund' WHERE id = v_invoice_id;
  UPDATE venue_bookings SET status = 'cancelled', payment_status = 'refunded', notes = 'E2E refund' WHERE id = v_booking_id;

  UPDATE venue_shifts
  SET status = 'closed', end_time = NOW(), closed_at = NOW(),
      total_cash = 100000, total_qris = 0, total_transfer = 0, total_revenue = 100000
  WHERE id = v_shift_id;

  RAISE NOTICE 'Phase 4 staging E2E completed successfully for venue %', v_venue_id;
END $$;

ROLLBACK;

-- Expected checks after running:
-- 1. Shift can be opened and closed.
-- 2. Booking can be paid and refunded.
-- 3. Invoice transitions to issued then voided.
-- 4. Refund notes are persisted on payment/invoice/booking.