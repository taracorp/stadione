import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../../../../context/DataContext';
import supabase from '../../../../config/supabase';

export default function MembershipEnrollmentPage({ venueId, onSuccess }) {
  const { user } = useContext(DataContext);
  const [tiers, setTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [enrollmentStep, setEnrollmentStep] = useState('select'); // select | confirm | payment | success

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    method: 'cash',
    reference_number: '',
  });

  useEffect(() => {
    if (venueId) {
      loadActiveTiers();
    }
  }, [venueId]);

  const loadActiveTiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('membership_types')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('tier_level', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSelectTier = (tier) => {
    setSelectedTier(tier);
    setEnrollmentStep('confirm');
  };

  const getTierColor = (tierName) => {
    const colors = {
      Bronze: 'from-amber-400 to-amber-600',
      Silver: 'from-slate-300 to-slate-500',
      Gold: 'from-yellow-400 to-yellow-600',
      Platinum: 'from-purple-400 to-purple-600',
    };
    return colors[tierName] || 'from-gray-400 to-gray-600';
  };

  const handleEnroll = async () => {
    if (!selectedTier || !user?.id) {
      showToast('Data tidak lengkap', 'error');
      return;
    }

    try {
      setProcessing(true);

      // Step 1: Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('venue_payments')
        .insert({
          booking_id: null, // No booking for membership
          shift_id: null,
          amount: selectedTier.annual_fee_idr,
          method: paymentData.method,
          status: 'confirmed',
          reference_number: paymentData.reference_number || null,
          processed_by: user.id,
          notes: `Membership enrollment - ${selectedTier.tier_name}`,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Step 2: Create customer membership record
      const today = new Date();
      const oneYearLater = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
      const renewalDate = new Date(today);
      renewalDate.setDate(selectedTier.monthly_renewal_date || today.getDate());

      const { data: membershipData, error: membershipError } = await supabase
        .from('customer_memberships')
        .insert({
          customer_id: user.id,
          venue_id: venueId,
          membership_type_id: selectedTier.id,
          status: 'active',
          start_date: today.toISOString().split('T')[0],
          end_date: oneYearLater.toISOString().split('T')[0],
          renewal_date: renewalDate.toISOString().split('T')[0],
          reward_points_balance: 0,
        })
        .select()
        .single();

      if (membershipError) throw membershipError;

      // Step 3: Auto-allocate bonus hours for first month
      if (selectedTier.bonus_hours_per_month > 0) {
        const expirationDate = new Date(today);
        expirationDate.setMonth(expirationDate.getMonth() + 1);

        await supabase.from('bonus_hours').insert({
          membership_id: membershipData.id,
          hours_allocated: selectedTier.bonus_hours_per_month,
          hours_used: 0,
          allocated_date: today.toISOString().split('T')[0],
          expiration_date: expirationDate.toISOString().split('T')[0],
          notes: 'Initial allocation upon membership enrollment',
        });
      }

      // Step 4: Log first transaction
      await supabase.from('reward_points_log').insert({
        membership_id: membershipData.id,
        transaction_type: 'earned',
        points_amount: 0,
        balance_before: 0,
        balance_after: 0,
        reason: 'Membership enrollment',
      });

      showToast('✅ Selamat! Anda telah berhasil mendaftar membership');
      setEnrollmentStep('success');

      // Call success callback after 2 seconds
      setTimeout(() => {
        if (onSuccess) onSuccess(membershipData);
      }, 2000);
    } catch (err) {
      showToast(err.message, 'error');
      setEnrollmentStep('confirm');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Step 1: Select Tier
  if (enrollmentStep === 'select') {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Pilih Membership Tier Anda</h2>

        {toast && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              toast.type === 'error'
                ? 'bg-red-100 text-red-900'
                : 'bg-green-100 text-green-900'
            }`}
          >
            {toast.message}
          </div>
        )}

        {tiers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Belum ada membership tier yang tersedia. Hubungi pihak venue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative border-2 rounded-lg p-4 cursor-pointer transform transition hover:scale-105 ${
                  selectedTier?.id === tier.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-400'
                }`}
                onClick={() => handleSelectTier(tier)}
              >
                {/* Tier Badge */}
                <div
                  className={`inline-block px-3 py-1 rounded-full text-white font-bold text-sm bg-gradient-to-r ${getTierColor(
                    tier.tier_name
                  )} mb-3`}
                >
                  {tier.tier_name}
                </div>

                {/* Benefits List */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">💰</span>
                    <span className="text-sm">{tier.discount_percent}% Diskon Booking</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg mr-2">⭐</span>
                    <span className="text-sm">
                      {tier.has_priority_booking ? 'Prioritas Booking' : 'Booking Standar'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg mr-2">⏰</span>
                    <span className="text-sm">{tier.bonus_hours_per_month} Jam Bonus/Bulan</span>
                  </div>
                </div>

                {/* Price */}
                <div className="border-t-2 pt-3 mt-3">
                  <p className="text-2xl font-bold text-blue-600">
                    Rp {tier.annual_fee_idr?.toLocaleString('id-ID') || 0}
                  </p>
                  <p className="text-xs text-gray-500">per tahun</p>
                </div>

                {/* Description */}
                {tier.description && (
                  <p className="text-xs text-gray-600 mt-3 italic">{tier.description}</p>
                )}

                {/* Select Button */}
                <button className="w-full mt-4 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium">
                  Pilih
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Confirm Selection
  if (enrollmentStep === 'confirm' && selectedTier) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Konfirmasi Membership</h2>

        {toast && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              toast.type === 'error'
                ? 'bg-red-100 text-red-900'
                : 'bg-green-100 text-green-900'
            }`}
          >
            {toast.message}
          </div>
        )}

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 mb-6 border-2 border-blue-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className={`text-3xl font-bold bg-gradient-to-r ${getTierColor(
                selectedTier.tier_name
              )} bg-clip-text text-transparent`}>
                {selectedTier.tier_name}
              </h3>
              <p className="text-gray-600 mt-1">Membership Tahunan</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-blue-600">
                Rp {selectedTier.annual_fee_idr?.toLocaleString('id-ID') || 0}
              </p>
              <p className="text-sm text-gray-500">per tahun</p>
            </div>
          </div>

          <div className="border-t-2 border-blue-300 pt-4">
            <h4 className="font-bold text-gray-900 mb-3">Benefit yang Anda Dapatkan:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <span className="text-xl mr-2">✓</span>
                <span>{selectedTier.discount_percent}% diskon untuk setiap booking</span>
              </li>
              {selectedTier.has_priority_booking && (
                <li className="flex items-center">
                  <span className="text-xl mr-2">✓</span>
                  <span>Prioritas booking selama jam sibuk (2 jam lebih awal)</span>
                </li>
              )}
              {selectedTier.bonus_hours_per_month > 0 && (
                <li className="flex items-center">
                  <span className="text-xl mr-2">✓</span>
                  <span>{selectedTier.bonus_hours_per_month} jam gratis setiap bulannya</span>
                </li>
              )}
              <li className="flex items-center">
                <span className="text-xl mr-2">✓</span>
                <span>Poin reward untuk setiap booking (1 poin = Rp 100)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="mb-6">
          <h4 className="font-bold text-gray-900 mb-3">Pilih Metode Pembayaran:</h4>
          <div className="space-y-2">
            {['cash', 'qris', 'transfer'].map((method) => (
              <label key={method} className="flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50"
                style={{borderColor: paymentData.method === method ? '#2563eb' : '#e5e7eb'}}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={method}
                  checked={paymentData.method === method}
                  onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                  className="w-4 h-4"
                />
                <span className="ml-3 font-medium capitalize">{
                  method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : 'Transfer Bank'
                }</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reference Number (for transfer) */}
        {paymentData.method === 'transfer' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Nomor Referensi Transfer (opsional)</label>
            <input
              type="text"
              value={paymentData.reference_number}
              onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
              placeholder="Contoh: BRI123456"
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setEnrollmentStep('select')}
            className="flex-1 px-4 py-3 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition font-medium"
            disabled={processing}
          >
            Kembali
          </button>
          <button
            onClick={handleEnroll}
            disabled={processing}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
          >
            {processing ? 'Memproses...' : '✓ Daftar Sekarang'}
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Success
  if (enrollmentStep === 'success') {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Membership Aktif!</h2>
          <p className="text-gray-600 mb-4">
            Selamat! Anda telah berhasil mendaftar sebagai member {selectedTier.tier_name}.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Membership berlaku selama 1 tahun dan dapat diperbarui kapan saja.
          </p>
          <div className="text-lg font-bold text-blue-600">
            Nikmati {selectedTier.discount_percent}% diskon dan benefit lainnya!
          </div>
        </div>
      </div>
    );
  }

  return null;
}
