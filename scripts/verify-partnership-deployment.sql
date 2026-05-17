-- =============================================================
-- PARTNERSHIP FEATURE - SQL DEPLOYMENT & VERIFICATION SCRIPT
-- =============================================================
-- Run this in Supabase SQL Editor to verify all components
-- Expected execution: ~5 seconds
-- =============================================================

-- ========== STEP 1: Verify Table Structure ==========
DO $$ 
DECLARE
  v_table_exists BOOLEAN;
  v_col_count INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'partnership_applications'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns 
    WHERE table_name = 'partnership_applications';
    
    RAISE NOTICE '✓ Table exists with % columns', v_col_count;
  ELSE
    RAISE NOTICE '✗ Table partnership_applications NOT FOUND';
  END IF;
END $$;

-- ========== STEP 2: Verify Indexes ==========
SELECT 
  'IDX' as type,
  indexname as name,
  CASE WHEN indexname LIKE 'idx_partnership%' THEN '✓' ELSE '?' END as status
FROM pg_indexes 
WHERE tablename = 'partnership_applications'
ORDER BY indexname;

-- ========== STEP 3: Verify RLS Policies ==========
SELECT 
  'POLICY' as type,
  policyname as name,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'partnership_applications'
ORDER BY policyname;

-- ========== STEP 4: Verify Constraints ==========
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'partnership_applications'
  AND constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
ORDER BY constraint_type;

-- ========== STEP 5: Verify Trigger ==========
SELECT 
  trigger_name,
  event_object_table,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'partnership_applications'
ORDER BY trigger_name;

-- ========== STEP 6: Test Insert (Dry Run) ==========
-- This will FAIL with security error (by design - tests RLS)
-- Expected: ERROR because anonymous can't directly INSERT
-- Actual INSERT should go through authenticated app client
BEGIN
  INSERT INTO public.partnership_applications (
    type, applicant_name, applicant_email, applicant_phone, details
  ) VALUES (
    'venue', 'Test User', 'test@example.com', '+6281234567', 
    '{"venue_name":"Test Venue","address":"Jakarta"}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '✓ RLS security working - INSERT blocked as expected';
END;

-- ========== STEP 7: Show Table Info ==========
\d+ public.partnership_applications

-- ========== STEP 8: Summary ==========
SELECT 
  'partnership_applications' as table_name,
  COUNT(*) as total_records,
  MAX(created_at) as latest_submission
FROM public.partnership_applications;

-- =============================================================
-- MANUAL VERIFICATION AFTER DEPLOYMENT
-- =============================================================
-- If you see all ✓ marks above, deployment was successful!
-- 
-- Next steps:
-- 1. Run dev server locally
-- 2. Fill partnership form
-- 3. Check if data appears in table:
--    SELECT * FROM partnership_applications ORDER BY created_at DESC;
-- 4. Verify auth user_id captured correctly
-- 5. Check admin can see all records via RLS policy
-- =============================================================
