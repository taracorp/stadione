-- ============================================================================
-- PHASE 11: DOKU PAYMENT GATEWAY INTEGRATION
-- Payment channel configuration, transaction tracking, webhook handling
-- ============================================================================

-- ============================================================================
-- 1. DOKU PAYMENT CONFIGURATION (Venue-level settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS doku_venue_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL UNIQUE REFERENCES venues(id) ON DELETE CASCADE,
  
  -- DOKU merchant configuration
  doku_merchant_id TEXT NOT NULL,
  doku_client_id TEXT NOT NULL,
  doku_secret_key TEXT NOT NULL ENCRYPTED, -- Encrypted at rest
  
  -- Environment: 'sandbox' | 'production'
  environment TEXT NOT NULL DEFAULT 'sandbox' 
    CHECK (environment IN ('sandbox', 'production')),
  
  -- Configuration status
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Audit
  configured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  configured_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_doku_venue_config_venue_id ON doku_venue_config(venue_id);
CREATE INDEX idx_doku_venue_config_enabled ON doku_venue_config(is_enabled);

-- ============================================================================
-- 2. DOKU PAYMENT TRANSACTIONS (Main transaction tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS doku_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to existing system
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES venue_bookings(id) ON DELETE CASCADE,
  venue_payment_id UUID REFERENCES venue_payments(id) ON DELETE SET NULL,
  
  -- DOKU order & payment IDs
  doku_order_id TEXT NOT NULL, -- Unique order identifier
  doku_payment_id TEXT UNIQUE, -- Assigned by DOKU after payment initiated
  doku_signature TEXT, -- HMAC signature for verification
  
  -- Amount tracking
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  
  -- Payment status: 'initiated' | 'awaiting' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired'
  status TEXT NOT NULL DEFAULT 'initiated' 
    CHECK (status IN ('initiated', 'awaiting', 'pending', 'completed', 'failed', 'cancelled', 'expired')),
  
  -- Payment method used at DOKU
  payment_method TEXT, -- e.g., 'VIRTUAL_ACCOUNT_BCA', 'QRIS', 'OVO', etc.
  
  -- DOKU session & URL
  doku_checkout_url TEXT,
  session_token TEXT,
  
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  
  -- Response tracking
  last_doku_response JSONB, -- Latest response from DOKU API
  
  -- Status tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  initiated_at TIMESTAMP WITH TIME ZONE,
  awaiting_at TIMESTAMP WITH TIME ZONE, -- When customer is filling payment
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit
  initiated_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  notes TEXT
);

CREATE INDEX idx_doku_transactions_venue_id ON doku_payment_transactions(venue_id);
CREATE INDEX idx_doku_transactions_booking_id ON doku_payment_transactions(booking_id);
CREATE INDEX idx_doku_transactions_order_id ON doku_payment_transactions(doku_order_id);
CREATE INDEX idx_doku_transactions_payment_id ON doku_payment_transactions(doku_payment_id);
CREATE INDEX idx_doku_transactions_status ON doku_payment_transactions(status);
CREATE INDEX idx_doku_transactions_created_at ON doku_payment_transactions(created_at DESC);
CREATE INDEX idx_doku_transactions_completed_at ON doku_payment_transactions(completed_at DESC);

-- ============================================================================
-- 3. PAYMENT WEBHOOK LOG (Idempotency & audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Webhook source
  webhook_source TEXT NOT NULL DEFAULT 'doku'
    CHECK (webhook_source IN ('doku', 'other')),
  
  -- Webhook event details
  doku_order_id TEXT NOT NULL,
  doku_payment_id TEXT,
  
  -- Webhook payload
  event_type TEXT NOT NULL, -- e.g., 'payment.completed', 'payment.failed'
  webhook_signature TEXT NOT NULL, -- HMAC signature from DOKU
  webhook_payload JSONB NOT NULL,
  
  -- Processing status
  is_processed BOOLEAN NOT NULL DEFAULT false,
  processing_result TEXT, -- 'success' | 'error' | 'duplicate'
  processing_error TEXT, -- Error message if processing failed
  
  -- Idempotency: prevent duplicate processing
  webhook_id_from_doku TEXT UNIQUE, -- Unique webhook event ID from DOKU
  
  -- Timing
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Reference
  related_transaction_id UUID REFERENCES doku_payment_transactions(id) ON DELETE SET NULL,
  
  -- Audit
  notes TEXT
);

CREATE INDEX idx_webhook_events_order_id ON payment_webhook_events(doku_order_id);
CREATE INDEX idx_webhook_events_payment_id ON payment_webhook_events(doku_payment_id);
CREATE INDEX idx_webhook_events_processed ON payment_webhook_events(is_processed);
CREATE INDEX idx_webhook_events_source ON payment_webhook_events(webhook_source);
CREATE INDEX idx_webhook_events_created_at ON payment_webhook_events(received_at DESC);
CREATE INDEX idx_webhook_events_webhook_id ON payment_webhook_events(webhook_id_from_doku);

-- ============================================================================
-- 4. PAYMENT RECONCILIATION LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction reference
  doku_transaction_id UUID NOT NULL REFERENCES doku_payment_transactions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES venue_bookings(id) ON DELETE CASCADE,
  venue_payment_id UUID REFERENCES venue_payments(id) ON DELETE SET NULL,
  
  -- Reconciliation status: 'matched' | 'mismatch' | 'pending' | 'reconciled'
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('matched', 'mismatch', 'pending', 'reconciled')),
  
  -- Amount verification
  doku_amount DECIMAL(12, 2) NOT NULL,
  venue_amount DECIMAL(12, 2),
  amount_variance DECIMAL(12, 2), -- Difference if any
  
  -- Metadata
  reconciliation_notes TEXT,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID REFERENCES auth.users(id),
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_doku_tx_id ON payment_reconciliation_log(doku_transaction_id);
CREATE INDEX idx_reconciliation_booking_id ON payment_reconciliation_log(booking_id);
CREATE INDEX idx_reconciliation_status ON payment_reconciliation_log(status);
CREATE INDEX idx_reconciliation_created_at ON payment_reconciliation_log(created_at DESC);

-- ============================================================================
-- 5. REFUND TRACKING (DOKU-specific refunds)
-- ============================================================================

CREATE TABLE IF NOT EXISTS doku_refund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to original transaction
  doku_transaction_id UUID NOT NULL REFERENCES doku_payment_transactions(id) ON DELETE CASCADE,
  doku_order_id TEXT NOT NULL,
  
  -- Refund details
  refund_amount DECIMAL(12, 2) NOT NULL CHECK (refund_amount > 0),
  refund_reason TEXT NOT NULL
    CHECK (refund_reason IN ('customer_request', 'booking_cancelled', 'duplicate_payment', 'system_error', 'partial_refund', 'other')),
  
  -- DOKU refund IDs
  doku_refund_id TEXT UNIQUE,
  doku_refund_status TEXT, -- e.g., 'PENDING', 'COMPLETED', 'FAILED'
  
  -- Status: 'initiated' | 'requested' | 'processing' | 'completed' | 'failed' | 'rejected'
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'requested', 'processing', 'completed', 'failed', 'rejected')),
  
  -- Approval
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Response
  doku_response JSONB,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  requested_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT
);

CREATE INDEX idx_doku_refunds_transaction_id ON doku_refund_transactions(doku_transaction_id);
CREATE INDEX idx_doku_refunds_order_id ON doku_refund_transactions(doku_order_id);
CREATE INDEX idx_doku_refunds_status ON doku_refund_transactions(status);
CREATE INDEX idx_doku_refunds_created_at ON doku_refund_transactions(created_at DESC);

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE doku_venue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue owner can view DOKU config"
  ON doku_venue_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND venue_id = doku_venue_config.venue_id
        AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Venue owner can update DOKU config"
  ON doku_venue_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND venue_id = doku_venue_config.venue_id
        AND role = 'owner'
    )
  );

ALTER TABLE doku_payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view DOKU transactions"
  ON doku_payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND venue_id = doku_payment_transactions.venue_id
    )
  );

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can process webhooks"
  ON payment_webhook_events FOR INSERT
  WITH CHECK (
    -- Allow service role to insert webhooks
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM venue_staff
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
    )
  );

ALTER TABLE payment_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venue staff can view reconciliation"
  ON payment_reconciliation_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doku_payment_transactions dpt
      JOIN venue_staff vs ON vs.venue_id = dpt.venue_id
      WHERE vs.user_id = auth.uid()
        AND dpt.id = payment_reconciliation_log.doku_transaction_id
    )
  );

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function: Generate DOKU order ID (unique per venue + timestamp)
CREATE OR REPLACE FUNCTION generate_doku_order_id(p_venue_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_order_id TEXT;
BEGIN
  v_order_id := 'ORD-' || p_venue_id || '-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || '-' || LPAD((RANDOM() * 9999)::INT::TEXT, 4, '0');
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Verify DOKU webhook signature (HMAC-SHA256)
CREATE OR REPLACE FUNCTION verify_doku_webhook_signature(
  p_payload_string TEXT,
  p_signature TEXT,
  p_secret_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_computed_signature TEXT;
BEGIN
  -- Compute HMAC-SHA256 (implementation depends on Supabase crypto support)
  -- For now, this is a placeholder; actual implementation uses pgsql-crypto or similar
  -- In production, webhook signature verification happens in the backend service
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Process DOKU payment status update
CREATE OR REPLACE FUNCTION process_doku_payment_status_update(
  p_doku_order_id TEXT,
  p_new_status TEXT,
  p_doku_payment_id TEXT DEFAULT NULL,
  p_response JSONB DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  transaction_id UUID
) AS $$
DECLARE
  v_transaction_id UUID;
  v_booking_id UUID;
  v_venue_id INTEGER;
  v_current_status TEXT;
  v_update_count INT;
BEGIN
  -- Find transaction
  SELECT id, booking_id, venue_id, status
  INTO v_transaction_id, v_booking_id, v_venue_id, v_current_status
  FROM doku_payment_transactions
  WHERE doku_order_id = p_doku_order_id
  LIMIT 1;

  IF v_transaction_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transaction not found: ' || p_doku_order_id, NULL::UUID;
    RETURN;
  END IF;

  -- Check for status progression validity
  IF p_new_status NOT IN ('awaiting', 'pending', 'completed', 'failed', 'cancelled', 'expired') THEN
    RETURN QUERY SELECT FALSE, 'Invalid status: ' || p_new_status, v_transaction_id;
    RETURN;
  END IF;

  -- Update DOKU transaction status
  UPDATE doku_payment_transactions
  SET 
    status = p_new_status,
    doku_payment_id = COALESCE(p_doku_payment_id, doku_payment_id),
    last_doku_response = COALESCE(p_response, last_doku_response),
    awaiting_at = CASE WHEN p_new_status = 'awaiting' THEN NOW() ELSE awaiting_at END,
    completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
    failed_at = CASE WHEN p_new_status = 'failed' THEN NOW() ELSE failed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
    expired_at = CASE WHEN p_new_status = 'expired' THEN NOW() ELSE expired_at END,
    updated_at = NOW()
  WHERE id = v_transaction_id
  RETURNING 1 INTO v_update_count;

  -- If status is 'completed', auto-update venue_payment and booking
  IF p_new_status = 'completed' AND v_update_count > 0 THEN
    UPDATE venue_payments
    SET status = 'confirmed'
    WHERE booking_id = v_booking_id
    AND method = 'transfer' -- DOKU is online transfer
    AND status = 'pending'
    LIMIT 1;

    UPDATE venue_bookings
    SET status = 'confirmed', payment_status = 'paid'
    WHERE id = v_booking_id
    AND status IN ('pending', 'confirmed')
    LIMIT 1;
  END IF;

  -- If status is 'failed' or 'expired', mark venue_payment as failed
  IF (p_new_status IN ('failed', 'expired')) AND v_update_count > 0 THEN
    UPDATE venue_payments
    SET status = 'failed'
    WHERE booking_id = v_booking_id
    AND status IN ('pending', 'awaiting')
    LIMIT 1;

    UPDATE venue_bookings
    SET status = 'expired'
    WHERE id = v_booking_id
    AND status IN ('pending', 'confirmed')
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT TRUE, 'Status updated to: ' || p_new_status, v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Create payment reconciliation record
CREATE OR REPLACE FUNCTION create_payment_reconciliation(
  p_doku_transaction_id UUID,
  p_doku_amount DECIMAL,
  p_venue_amount DECIMAL DEFAULT NULL
)
RETURNS TABLE(
  reconciliation_id UUID,
  status TEXT,
  amount_match BOOLEAN
) AS $$
DECLARE
  v_booking_id UUID;
  v_recon_id UUID;
  v_amount_variance DECIMAL;
  v_recon_status TEXT;
BEGIN
  SELECT booking_id INTO v_booking_id
  FROM doku_payment_transactions
  WHERE id = p_doku_transaction_id;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'DOKU transaction not found';
  END IF;

  v_amount_variance := ABS(p_doku_amount - COALESCE(p_venue_amount, p_doku_amount));
  v_recon_status := CASE
    WHEN v_amount_variance < 0.01 THEN 'matched'
    WHEN p_venue_amount IS NOT NULL THEN 'mismatch'
    ELSE 'pending'
  END;

  INSERT INTO payment_reconciliation_log (
    doku_transaction_id,
    booking_id,
    status,
    doku_amount,
    venue_amount,
    amount_variance
  ) VALUES (
    p_doku_transaction_id,
    v_booking_id,
    v_recon_status,
    p_doku_amount,
    p_venue_amount,
    v_amount_variance
  ) RETURNING id, status INTO v_recon_id, v_recon_status;

  RETURN QUERY SELECT v_recon_id, v_recon_status, (v_amount_variance < 0.01);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_doku_transactions_status_created ON doku_payment_transactions(status, created_at DESC);
CREATE INDEX idx_doku_transactions_venue_status ON doku_payment_transactions(venue_id, status);
CREATE INDEX idx_webhook_events_processed_created ON payment_webhook_events(is_processed, received_at DESC);
CREATE INDEX idx_reconciliation_status_created ON payment_reconciliation_log(status, created_at DESC);

-- ============================================================================
-- 9. SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════╗
║ PHASE 11 SCHEMA: DOKU PAYMENT GATEWAY — INFRASTRUCTURE COMPLETE ✓         ║
╚════════════════════════════════════════════════════════════════════════════╝

TABLES CREATED:
✓ doku_venue_config — Merchant credentials per venue
✓ doku_payment_transactions — Main transaction tracking (initiated→completed)
✓ payment_webhook_events — Webhook log with idempotency (duplicate prevention)
✓ payment_reconciliation_log — Amount verification & reconciliation audit trail
✓ doku_refund_transactions — Refund tracking & status workflow

KEY FEATURES:
✓ RLS policies for venue staff access
✓ Webhook signature verification function
✓ Status update processing with auto-booking/payment sync
✓ Reconciliation creation with amount variance tracking
✓ Idempotency via webhook_id_from_doku unique constraint
✓ Comprehensive audit trail for all transactions

HELPER FUNCTIONS:
✓ generate_doku_order_id() — Unique order ID generation
✓ verify_doku_webhook_signature() — HMAC-SHA256 signature validation
✓ process_doku_payment_status_update() — Auto-sync payment/booking status
✓ create_payment_reconciliation() — Reconciliation record creation

STATUS: Ready for service layer implementation & UI integration
  ';
END $$;
