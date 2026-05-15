-- Customer Favorite Courts
-- Allows customers to mark courts as favorites for easier booking

CREATE TABLE IF NOT EXISTS customer_favorite_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES venue_courts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one favorite per customer-court combination
  UNIQUE(customer_id, court_id),

  -- Index for efficient queries
  INDEX idx_customer_favorite_courts_customer_id (customer_id),
  INDEX idx_customer_favorite_courts_venue_id (venue_id)
);

-- RLS Policies for customer favorite courts
ALTER TABLE customer_favorite_courts ENABLE ROW LEVEL SECURITY;

-- Customers can read/write their own favorites
CREATE POLICY "customer_favorite_courts_select"
  ON customer_favorite_courts FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "customer_favorite_courts_insert"
  ON customer_favorite_courts FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "customer_favorite_courts_delete"
  ON customer_favorite_courts FOR DELETE
  USING (auth.uid() = customer_id);

-- Venue staff can read favorites for their venue
CREATE POLICY "customer_favorite_courts_venue_staff_select"
  ON customer_favorite_courts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_staff
      WHERE venue_staff.venue_id = customer_favorite_courts.venue_id
      AND venue_staff.user_id = auth.uid()
      AND venue_staff.status = 'active'
    )
  );