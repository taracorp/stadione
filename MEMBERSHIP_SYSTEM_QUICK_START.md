# Phase 5: Membership System — Quick Start Guide

**Current Status:** Database schema deployed & ready for UI integration

---

## 📊 Database Overview

### Core Tables

| Table | Purpose | Relationships |
|-------|---------|---------------|
| **membership_types** | Tier definitions (pricing, benefits) | 1 → many customer_memberships |
| **customer_memberships** | Active membership per customer per venue | 1 customer × 1 venue → points tracking |
| **reward_points_log** | Points transaction audit trail | logs all earn/redeem events |
| **bonus_hours** | Allocated bonus hours with expiration | per membership, redeemable per booking |
| **membership_discount_log** | Applied discounts on bookings | tracks every discount applied |

---

## 🔧 Helper Functions

### For Frontend Use

```sql
-- Get customer's active membership at a venue
SELECT * FROM get_customer_active_membership(
  p_customer_id := 'uuid-here',
  p_venue_id := 1
);
-- Returns: tier_name, discount_percent, has_priority_booking, reward_points_balance, bonus_hours_available

-- Calculate discount for a booking
SELECT * FROM calculate_membership_discount(
  p_customer_id := 'uuid-here',
  p_venue_id := 1,
  p_booking_price := 500000
);
-- Returns: discount_amount, final_price, tier_name, discount_percent
```

---

## 🎨 UI Components Needed

### Phase 5.1: Membership Management Page
**File:** `src/components/admin/workspace/venue/MembershipManagementPage.jsx`

**Purpose:** Venue Owner/Manager configures membership tiers

**Features:**
- Display membership tiers in a table (Bronze/Silver/Gold/Platinum)
- Edit tier: discount_percent, has_priority_booking, bonus_hours_per_month, annual_fee_idr
- Create new tier (if needed)
- Toggle tier active/inactive
- View tier usage stats (how many members per tier)

**Data Flow:**
```
Read: SELECT * FROM membership_types WHERE venue_id = {venueId}
Write: INSERT/UPDATE membership_types
```

---

### Phase 5.2: Membership Enrollment Page
**File:** `src/components/membership/MembershipEnrollmentPage.jsx`

**Purpose:** Customer enrolls in a membership

**Features:**
- Display available tiers with benefits
- Select tier → add to cart
- Payment page (tie-in with venue_payments table)
- Confirm payment → create customer_memberships record
- Show confirmation with membership ID & expiry date

**Data Flow:**
```
Read: SELECT * FROM membership_types WHERE venue_id = {venueId} AND is_active = true
Write via payment:
  1. Create venue_payments record (annual_fee_idr)
  2. On payment confirmed → INSERT customer_memberships
  3. Auto-allocate bonus hours: INSERT bonus_hours (for first month)
```

---

### Phase 5.3: Membership Profile Dashboard
**File:** `src/components/membership/MembershipProfilePage.jsx`

**Purpose:** Customer views their membership & rewards

**Features:**
- Display active membership tier
- Show reward points balance & how to use
- List available bonus hours with expiry dates
- Redeem bonus hour on next booking (links to booking page)
- View past booking discounts (from membership_discount_log)

**Data Flow:**
```
Read:
  - get_customer_active_membership()
  - SELECT * FROM reward_points_log WHERE membership_id = {id}
  - SELECT * FROM bonus_hours WHERE membership_id = {id}
  - SELECT * FROM membership_discount_log WHERE membership_id = {id}
```

---

## 📱 Booking Integration Points

### When Creating a Walk-In Booking

1. **Fetch active membership** (if customer has one)
   ```
   membership = get_customer_active_membership(customer_id, venue_id)
   ```

2. **Calculate discounted price**
   ```
   discounted = calculate_membership_discount(customer_id, venue_id, original_price)
   final_price = discounted.final_price
   ```

3. **On booking creation:**
   - Set `total_price = final_price` in venue_bookings
   - Insert record in membership_discount_log (for audit)
   - Log transaction in reward_points_log (customer earns points)

4. **On payment confirmation:**
   - Auto-earn reward points: `points = final_price / 100` (1 point per Rp 100 spent)
   - Insert reward_points_log with transaction_type='earned'
   - This triggers auto-update of customer_memberships.reward_points_balance

---

## 🎯 Implementation Phases

### Phase 5.1: Core Infrastructure [✅ DONE]
- Schema deployed to Supabase

### Phase 5.2: Enrollment Flow [NEXT]
- MembershipManagementPage (create/edit tiers)
- MembershipEnrollmentPage (customer signup)
- Integrate with venue_payments for membership fees

### Phase 5.3: Booking Integration [THEN]
- Apply discount to VenuePOSPage walk-in booking
- Apply discount to booking calendar page
- Reward points auto-calculation

### Phase 5.4: Customer Dashboard [FINALLY]
- MembershipProfilePage (view tier, points, bonus hours)
- Bonus hour redemption UI
- Discount history view

---

## 🔐 RLS Security Notes

- Customers can only see/manage their own memberships
- Venue staff can manage all memberships at their venue
- Owner/Manager role required to modify tiers
- All reads are filtered by venue_id or customer_id

---

## 📌 Key Business Rules

1. **One active membership per customer per venue** (enforced by UNIQUE constraint)
2. **Discount auto-applied on booking** (if customer has active membership)
3. **Points earned on every booking** (1 point per Rp 100 spent)
4. **Bonus hours expire 90 days after allocation**
5. **Membership renews annually** (tracked by renewal_date)
6. **Priority booking:** Silver/Gold/Platinum can book 2 hours before public slots

---

## 🚀 Testing Checklist

- [ ] Create test tier (Silver, 10% discount)
- [ ] Enroll test customer in membership
- [ ] Create booking → verify discount applied
- [ ] Verify reward points logged
- [ ] Verify membership_discount_log records created
- [ ] Check bonus hours allocation on enrollment
- [ ] Test bonus hour expiration logic (query expired records)
- [ ] Test points balance auto-update trigger

---

## 📚 SQL Helpers for Development

```sql
-- See all membership tiers at a venue
SELECT * FROM membership_types WHERE venue_id = 1;

-- Check customer's membership status
SELECT * FROM customer_memberships WHERE customer_id = 'uuid-here';

-- See all reward points transactions for a customer
SELECT * FROM reward_points_log rpl
JOIN customer_memberships cm ON cm.id = rpl.membership_id
WHERE cm.customer_id = 'uuid-here'
ORDER BY rpl.created_at DESC;

-- Find expired bonus hours
SELECT * FROM bonus_hours WHERE expiration_date < CURRENT_DATE;

-- See all discounts applied this month
SELECT * FROM membership_discount_log 
WHERE created_at >= DATE_TRUNC('month', NOW())
ORDER BY created_at DESC;
```
