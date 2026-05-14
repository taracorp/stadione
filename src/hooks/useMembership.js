import { useContext, useCallback } from 'react';
import { DataContext } from '../context/DataContext';
import supabase from '../config/supabase';

/**
 * Hook for membership-related operations
 * Handles discount calculations, bonus hour tracking, and reward points
 */
export const useMembership = () => {
  const { user } = useContext(DataContext);

  /**
   * Get active membership for a customer at a venue
   */
  const getActiveMembership = useCallback(
    async (venueId) => {
      if (!user?.id) return null;

      try {
        const { data, error } = await supabase
          .rpc('get_customer_active_membership', {
            p_customer_id: user.id,
            p_venue_id: venueId,
          });

        if (error) throw error;
        return data?.[0] || null;
      } catch (err) {
        console.error('Error fetching membership:', err);
        return null;
      }
    },
    [user?.id]
  );

  /**
   * Calculate discount for a booking price
   */
  const calculateDiscount = useCallback(
    async (venueId, bookingPrice) => {
      if (!user?.id) {
        return {
          discount_amount: 0,
          final_price: bookingPrice,
          tier_name: null,
          discount_percent: 0,
        };
      }

      try {
        const { data, error } = await supabase
          .rpc('calculate_membership_discount', {
            p_customer_id: user.id,
            p_venue_id: venueId,
            p_booking_price: bookingPrice,
          });

        if (error) throw error;
        return data?.[0] || {
          discount_amount: 0,
          final_price: bookingPrice,
          tier_name: null,
          discount_percent: 0,
        };
      } catch (err) {
        console.error('Error calculating discount:', err);
        return {
          discount_amount: 0,
          final_price: bookingPrice,
          tier_name: null,
          discount_percent: 0,
        };
      }
    },
    [user?.id]
  );

  /**
   * Apply discount to a booking (log it and update prices)
   * Should be called after booking is created but before payment
   */
  const applyDiscountToBooking = useCallback(
    async (bookingId, venueId, originalPrice, membership) => {
      if (!membership) return null;

      try {
        const discountAmount = (originalPrice * membership.discount_percent) / 100;
        const finalPrice = originalPrice - discountAmount;

        // Log the discount
        const { data, error } = await supabase
          .from('membership_discount_log')
          .insert({
            booking_id: bookingId,
            membership_id: membership.membership_id,
            tier_name: membership.tier_name,
            discount_percent: membership.discount_percent,
            original_price: originalPrice,
            discount_amount: discountAmount,
            final_price: finalPrice,
            reward_points_earned: Math.floor(finalPrice / 100),
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error applying discount:', err);
        return null;
      }
    },
    []
  );

  /**
   * Earn reward points on a booking
   * Automatically called when booking is confirmed/paid
   */
  const earnRewardPoints = useCallback(
    async (membershipId, bookingId, bookingPrice, reason = 'Booking completed') => {
      try {
        // Calculate points: 1 point per Rp 100
        const pointsEarned = Math.floor(bookingPrice / 100);

        // Get current balance
        const { data: currentMembership, error: fetchError } = await supabase
          .from('customer_memberships')
          .select('reward_points_balance')
          .eq('id', membershipId)
          .single();

        if (fetchError) throw fetchError;
        const balanceBefore = currentMembership?.reward_points_balance || 0;
        const balanceAfter = balanceBefore + pointsEarned;

        // Log transaction
        const { data, error } = await supabase
          .from('reward_points_log')
          .insert({
            membership_id: membershipId,
            transaction_type: 'earned',
            points_amount: pointsEarned,
            booking_id: bookingId,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reason: reason,
          })
          .select()
          .single();

        if (error) throw error;
        // Note: trigger will auto-update customer_memberships.reward_points_balance
        return data;
      } catch (err) {
        console.error('Error earning reward points:', err);
        return null;
      }
    },
    []
  );

  /**
   * Check if customer has priority booking access
   */
  const hasPriorityBooking = useCallback(
    (membership) => {
      return membership?.has_priority_booking || false;
    },
    []
  );

  /**
   * Get available bonus hours
   */
  const getAvailableBonusHours = useCallback(async (membershipId) => {
    try {
      const { data, error } = await supabase
        .from('bonus_hours')
        .select('*')
        .eq('membership_id', membershipId)
        .gt('expiration_date', new Date().toISOString().split('T')[0])
        .order('expiration_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching bonus hours:', err);
      return [];
    }
  }, []);

  /**
   * Use a bonus hour on a booking
   */
  const useBonusHour = useCallback(
    async (bonusHourId, bookingId, hoursToUse = 1) => {
      try {
        const { data: bonusHour, error: fetchError } = await supabase
          .from('bonus_hours')
          .select('hours_used')
          .eq('id', bonusHourId)
          .single();

        if (fetchError) throw fetchError;

        const newHoursUsed = (bonusHour?.hours_used || 0) + hoursToUse;

        const { data, error } = await supabase
          .from('bonus_hours')
          .update({
            hours_used: newHoursUsed,
            booking_id: bookingId,
            used_at: new Date().toISOString(),
          })
          .eq('id', bonusHourId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error using bonus hour:', err);
        return null;
      }
    },
    []
  );

  /**
   * Get active membership for a customer by phone number (for POS walk-in use)
   */
  const getMembershipByPhone = useCallback(async (phone, venueId) => {
    if (!phone || !venueId) return null;
    try {
      const { data, error } = await supabase
        .rpc('get_membership_by_phone', {
          p_phone: phone.trim(),
          p_venue_id: venueId,
        });
      if (error) throw error;
      return data?.[0] || null;
    } catch (err) {
      console.error('Error fetching membership by phone:', err);
      return null;
    }
  }, []);

  /**
   * Get available bonus hours for a customer by phone number (for POS walk-in use)
   */
  const getBonusHoursByPhone = useCallback(async (phone, venueId) => {
    if (!phone || !venueId) return [];
    try {
      const { data, error } = await supabase
        .rpc('get_bonus_hours_by_phone', {
          p_phone: phone.trim(),
          p_venue_id: venueId,
        });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching bonus hours by phone:', err);
      return [];
    }
  }, []);

  return {
    getActiveMembership,
    calculateDiscount,
    applyDiscountToBooking,
    earnRewardPoints,
    hasPriorityBooking,
    getAvailableBonusHours,
    useBonusHour,
    getMembershipByPhone,
    getBonusHoursByPhone,
  };
};
