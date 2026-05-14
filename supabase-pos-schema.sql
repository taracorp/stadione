-- ============================================================================
-- STADIONE POS & CASHIER SYSTEM SCHEMA
-- Phase 4: Payment Processing, Shifts, Invoices, Refunds
-- ============================================================================

-- ============================================================================
-- 1. SHIFT MANAGEMENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS venue_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES venue_branches(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Shift timing
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  
  -- Status: 'open' | 'closed'
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  -- Shift summary (computed)
  total_cash DECIMAL(12, 2) DEFAULT 0,
  total_qris DECIMAL(12, 2) DEFAULT 0,
  total_transfer DECIMAL(12, 2) DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_venue_shifts_venue_id ON venue_shifts(venue_id);
CREATE INDEX idx_venue_shifts_branch_id ON venue_shifts(branch_id);
CREATE INDEX idx_venue_shifts_cashier_id ON venue_shifts(cashier_id);
CREATE INDEX idx_venue_shifts_status ON venue_shifts(status);
CREATE INDEX idx_venue_shifts_start_time ON venue_shifts(start_time DESC);

-- ============================================================================
-- 2. PAYMENT METHODS & TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS venue_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES venue_bookings(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES venue_shifts(id) ON DELETE RESTRICT,
  
  -- Payment details
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'qris', 'transfer', 'split')),
  
  -- For split payments
  split_cash DECIMAL(12, 2) DEFAULT NULL,
  split_qris DECIMAL(12, 2) DEFAULT NULL,
  split_transfer DECIMAL(12, 2) DEFAULT NULL,
  
  -- Payment status: 'pending' | 'confirmed' | 'failed' | 'refunded'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  
  -- Payment reference (for bank transfer verification)
  reference_number TEXT UNIQUE,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_venue_payments_booking_id ON venue_payments(booking_id);
CREATE INDEX idx_venue_payments_shift_id ON venue_payments(shift_id);
CREATE INDEX idx_venue_payments_method ON venue_payments(method);
CREATE INDEX idx_venue_payments_status ON venue_payments(status);
CREATE INDEX idx_venue_payments_created_at ON venue_payments(created_at DESC);

-- ============================================================================
-- 3. INVOICE SYSTEM TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS venue_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES venue_bookings(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES venue_payments(id) ON DELETE SET NULL,
  
  -- Invoice numbering
  invoice_number TEXT UNIQUE NOT NULL, -- e.g., INV-2026-05-001
  
  -- Line items
  items JSONB NOT NULL DEFAULT '[]', -- [{description, quantity, unit_price, total}, ...]
  
  -- Totals
  subtotal DECIMAL(12, 2) NOT NULL,
  tax DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  
  -- Customer info
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  
  -- Status: 'draft' | 'issued' | 'printed' | 'voided'
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'printed', 'voided')),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  issued_at TIMESTAMP WITH TIME ZONE,
  printed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_venue_invoices_booking_id ON venue_invoices(booking_id);
CREATE INDEX idx_venue_invoices_payment_id ON venue_invoices(payment_id);
CREATE INDEX idx_venue_invoices_invoice_number ON venue_invoices(invoice_number);
CREATE INDEX idx_venue_invoices_status ON venue_invoices(status);
CREATE INDEX idx_venue_invoices_created_at ON venue_invoices(created_at DESC);

-- ============================================================================
-- 4. REFUND MANAGEMENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS venue_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES venue_payments(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES venue_bookings(id) ON DELETE CASCADE,
  
  -- Refund details
  original_amount DECIMAL(12, 2) NOT NULL,
  refund_amount DECIMAL(12, 2) NOT NULL CHECK (refund_amount > 0),
  
  -- Reason codes: 'customer_request', 'booking_cancelled', 'duplicate_payment', 'system_error', 'other'
  reason TEXT NOT NULL CHECK (reason IN ('customer_request', 'booking_cancelled', 'duplicate_payment', 'system_error', 'other')),
  reason_details TEXT,
  
  -- Refund status: 'pending' | 'processed' | 'failed' | 'rejected'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'rejected')),
  
  -- Refund details
  refund_method TEXT CHECK (refund_method IN ('cash', 'qris', 'transfer')),
  reference_number TEXT,
  
  -- Approval
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_venue_refunds_payment_id ON venue_refunds(payment_id);
CREATE INDEX idx_venue_refunds_booking_id ON venue_refunds(booking_id);
CREATE INDEX idx_venue_refunds_status ON venue_refunds(status);
CREATE INDEX idx_venue_refunds_created_at ON venue_refunds(created_at DESC);
CREATE INDEX idx_venue_refunds_requested_by ON venue_refunds(requested_by);

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- venue_shifts RLS
ALTER TABLE venue_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view shifts for their venue"
  ON venue_shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.id IN (
          SELECT user_id FROM venue_staff
          WHERE venue_id = venue_shifts.venue_id
            AND role IN ('owner', 'manager', 'cashier')
        )
    )
  );

CREATE POLICY "Cashier can create shift for their venue"
  ON venue_shifts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND venue_id = venue_shifts.venue_id
        AND role IN ('cashier', 'manager', 'owner')
    )
  );

CREATE POLICY "Cashier can update their own shift"
  ON venue_shifts FOR UPDATE
  USING (
    cashier_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND venue_id = venue_shifts.venue_id
        AND role IN ('manager', 'owner')
    )
  );

-- venue_payments RLS
ALTER TABLE venue_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view payments for their venue"
  ON venue_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_bookings vb
      JOIN venue_shifts vs ON vs.id = venue_payments.shift_id
      WHERE vb.id = venue_payments.booking_id
        AND vs.venue_id IN (
          SELECT venue_id FROM venue_staff
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Cashier can create payment"
  ON venue_payments FOR INSERT
  WITH CHECK (
    processed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND role IN ('cashier', 'manager', 'owner')
    )
  );

-- venue_invoices RLS
ALTER TABLE venue_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view invoices for their venue"
  ON venue_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_bookings vb
      WHERE vb.id = venue_invoices.booking_id
        AND vb.venue_id IN (
          SELECT venue_id FROM venue_staff
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Cashier can create and update invoices"
  ON venue_invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND role IN ('cashier', 'manager', 'owner')
    )
  );

-- venue_refunds RLS
ALTER TABLE venue_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view refunds for their venue"
  ON venue_refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_bookings vb
      WHERE vb.id = venue_refunds.booking_id
        AND vb.venue_id IN (
          SELECT venue_id FROM venue_staff
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Cashier can request refund"
  ON venue_refunds FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND role IN ('cashier', 'manager', 'owner')
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function: Generate invoice number (INV-YYYY-MM-SERIAL)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_venue_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_month_count INT;
  v_invoice_number TEXT;
BEGIN
  -- Count invoices this month for the venue
  SELECT COUNT(*) + 1 INTO v_month_count
  FROM venue_invoices vi
  WHERE vi.venue_id = (SELECT id FROM venues WHERE id = p_venue_id)
    AND DATE_TRUNC('month', vi.created_at) = DATE_TRUNC('month', NOW());
  
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(v_month_count::TEXT, 3, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate shift totals
CREATE OR REPLACE FUNCTION calculate_shift_totals(p_shift_id UUID)
RETURNS TABLE(total_cash DECIMAL, total_qris DECIMAL, total_transfer DECIMAL, total_revenue DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN vp.method = 'cash' THEN vp.amount ELSE 0 END), 0::DECIMAL) as total_cash,
    COALESCE(SUM(CASE WHEN vp.method = 'qris' THEN vp.amount ELSE 0 END), 0::DECIMAL) as total_qris,
    COALESCE(SUM(CASE WHEN vp.method = 'transfer' THEN vp.amount ELSE 0 END), 0::DECIMAL) as total_transfer,
    COALESCE(SUM(vp.amount), 0::DECIMAL) as total_revenue
  FROM venue_payments vp
  WHERE vp.shift_id = p_shift_id AND vp.status = 'confirmed';
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update shift totals when payment confirmed
CREATE OR REPLACE FUNCTION update_shift_totals_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE venue_shifts
    SET (total_cash, total_qris, total_transfer, total_revenue) = (
      SELECT * FROM calculate_shift_totals(NEW.shift_id)
    )
    WHERE id = NEW.shift_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_shift_totals_on_payment
AFTER INSERT OR UPDATE ON venue_payments
FOR EACH ROW
EXECUTE FUNCTION update_shift_totals_on_payment();

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON venue_shifts TO authenticated;
GRANT SELECT, INSERT ON venue_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON venue_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON venue_refunds TO authenticated;

-- ============================================================================
-- MIGRATION NOTES:
-- 1. This schema supports multi-payment methods (Cash/QRIS/Transfer/Split)
-- 2. Shift management includes automatic total calculation
-- 3. Invoice generation with unique sequential numbering
-- 4. Refund workflow with approval chain
-- 5. All tables have RLS policies tied to venue_staff role
-- ============================================================================
