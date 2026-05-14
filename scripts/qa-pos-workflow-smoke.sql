-- ============================================================================
-- POS & CASHIER SYSTEM SMOKE TEST
-- Tests: Shift creation, walk-in booking, payment processing, invoice generation
-- ============================================================================

BEGIN;

-- Setup: Get test venue and cashier user
WITH test_data AS (
  SELECT 
    v.id as venue_id,
    vb.id as branch_id,
    vc.id as court_id,
    au.id as cashier_id,
    '2026-05-14'::DATE as test_date
  FROM venues v
  JOIN venue_branches vb ON vb.venue_id = v.id
  JOIN venue_courts vc ON vc.branch_id = vb.id
  JOIN auth.users au ON au.email LIKE '%@test%' LIMIT 1
)

-- Test 1: Start a shift
INSERT INTO venue_shifts (venue_id, branch_id, cashier_id, start_time, status)
SELECT test_data.venue_id, test_data.branch_id, test_data.cashier_id, NOW(), 'open'
FROM test_data
RETURNING id as shift_id, status;

-- Test 2: Create walk-in booking (with overlap protection)
WITH shift_info AS (
  SELECT id, cashier_id FROM venue_shifts 
  WHERE status = 'open' 
  ORDER BY start_time DESC 
  LIMIT 1
),
test_booking AS (
  INSERT INTO venue_bookings (
    venue_id, 
    branch_id, 
    court_id, 
    customer_name, 
    customer_phone,
    start_time, 
    end_time, 
    duration_hours,
    total_price, 
    status, 
    booking_type
  )
  SELECT 
    v.id,
    vb.id,
    vc.id,
    'Test Customer POS',
    '081234567890',
    NOW(),
    NOW() + INTERVAL '2 hours',
    2,
    vc.price_per_hour * 2,
    'pending',
    'walk-in'
  FROM venues v
  JOIN venue_branches vb ON vb.venue_id = v.id
  JOIN venue_courts vc ON vc.branch_id = vb.id
  WHERE v.id IN (SELECT venue_id FROM shift_info)
  LIMIT 1
  RETURNING id as booking_id, total_price
)
SELECT * FROM test_booking;

-- Test 3: Process payment (cash)
WITH latest_booking AS (
  SELECT id as booking_id, total_price
  FROM venue_bookings 
  WHERE customer_name = 'Test Customer POS'
  ORDER BY created_at DESC 
  LIMIT 1
),
latest_shift AS (
  SELECT id as shift_id, cashier_id
  FROM venue_shifts 
  WHERE status = 'open'
  ORDER BY start_time DESC 
  LIMIT 1
),
user_id AS (
  SELECT id FROM auth.users LIMIT 1
)
INSERT INTO venue_payments (
  booking_id,
  shift_id,
  amount,
  method,
  status,
  processed_by
)
SELECT 
  lb.booking_id,
  ls.shift_id,
  lb.total_price,
  'cash',
  'confirmed',
  u.id
FROM latest_booking lb, latest_shift ls, user_id u
RETURNING id as payment_id, method, amount, status;

-- Test 4: Update booking to paid
UPDATE venue_bookings 
SET status = 'paid'
WHERE customer_name = 'Test Customer POS' AND status = 'pending'
RETURNING id, customer_name, status;

-- Test 5: Generate invoice
WITH latest_payment AS (
  SELECT vp.id as payment_id, vp.booking_id, vb.customer_name, vb.total_price
  FROM venue_payments vp
  JOIN venue_bookings vb ON vb.id = vp.booking_id
  WHERE vb.customer_name = 'Test Customer POS'
  ORDER BY vp.created_at DESC
  LIMIT 1
)
INSERT INTO venue_invoices (
  booking_id,
  payment_id,
  invoice_number,
  items,
  subtotal,
  total,
  customer_name,
  status,
  issued_at
)
SELECT 
  lp.booking_id,
  lp.payment_id,
  'INV-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD((
    SELECT COUNT(*) + 1 FROM venue_invoices 
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
  )::TEXT, 3, '0'),
  jsonb_build_array(
    jsonb_build_object(
      'description', 'Court rental - 2 hours',
      'quantity', 1,
      'unit_price', lp.total_price,
      'total', lp.total_price
    )
  ),
  lp.total_price,
  lp.total_price,
  lp.customer_name,
  'issued',
  NOW()
FROM latest_payment lp
RETURNING id as invoice_id, invoice_number, total;

-- Test 6: Verify shift totals (should auto-calculate)
SELECT 
  id as shift_id,
  status,
  total_cash,
  total_qris,
  total_transfer,
  total_revenue,
  CASE 
    WHEN total_cash > 0 THEN '✓ Shift totals calculated correctly'
    ELSE '✗ Shift totals not updated'
  END as calculation_status
FROM venue_shifts 
WHERE status = 'open'
ORDER BY start_time DESC 
LIMIT 1;

-- Test 7: Split payment validation
WITH shift_info AS (
  SELECT id as shift_id FROM venue_shifts 
  WHERE status = 'open'
  ORDER BY start_time DESC LIMIT 1
),
test_split_booking AS (
  INSERT INTO venue_bookings (
    venue_id, branch_id, court_id, customer_name, customer_phone,
    start_time, end_time, duration_hours, total_price, status, booking_type
  )
  SELECT 
    v.id, vb.id, vc.id,
    'Test Split Payment',
    '081999888777',
    NOW() + INTERVAL '4 hours',
    NOW() + INTERVAL '5 hours',
    1,
    vc.price_per_hour,
    'pending',
    'walk-in'
  FROM venues v
  JOIN venue_branches vb ON vb.venue_id = v.id
  JOIN venue_courts vc ON vc.branch_id = vb.id
  LIMIT 1
  RETURNING id as booking_id, total_price
)
INSERT INTO venue_payments (
  booking_id, shift_id, amount, method,
  split_cash, split_qris, split_transfer,
  status, processed_by
)
SELECT 
  tsb.booking_id,
  si.shift_id,
  tsb.total_price,
  'split',
  tsb.total_price * 0.4,  -- 40% cash
  tsb.total_price * 0.3,  -- 30% QRIS
  tsb.total_price * 0.3,  -- 30% transfer
  'confirmed',
  (SELECT id FROM auth.users LIMIT 1)
FROM test_split_booking tsb, shift_info si
RETURNING method, split_cash, split_qris, split_transfer;

-- Test 8: Close shift and verify totals
UPDATE venue_shifts
SET 
  status = 'closed',
  end_time = NOW(),
  closed_at = NOW()
WHERE status = 'open'
ORDER BY start_time DESC
LIMIT 1
RETURNING 
  id as shift_id,
  status,
  start_time,
  end_time,
  EXTRACT(MINUTE FROM (end_time - start_time)) || ' minutes' as duration,
  total_cash,
  total_qris,
  total_transfer,
  total_revenue;

-- Test Results Summary
SELECT 
  'POS Workflow Tests' as test_suite,
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_shifts,
  COUNT(CASE WHEN status = 'issued' THEN 1 END) as invoices_issued,
  COUNT(CASE WHEN method IN ('cash', 'qris', 'transfer', 'split') THEN 1 END) as payments_processed
FROM (
  SELECT 'shift' as type, status FROM venue_shifts WHERE customer_name IS NULL LIMIT 1
  UNION ALL
  SELECT 'invoice' as type, status FROM venue_invoices LIMIT 1
  UNION ALL
  SELECT 'payment' as type, method as status FROM venue_payments LIMIT 1
) as results;

ROLLBACK;

-- ============================================================================
-- NOTE: This is an idempotent smoke test (wrapped in BEGIN/ROLLBACK)
-- All test data is rolled back after verification
-- Run this regularly to validate POS schema integrity
-- ============================================================================
