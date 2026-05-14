import React, { useState, useEffect, useMemo, useContext } from 'react';
import { supabase } from '../../../../config/supabase';
import AdminLayout from '../../AdminLayout';
import { DataContext } from '../../../../context/DataContext';
import { useMembership } from '../../../../hooks/useMembership';

// Simple Toast component inline
const Toast = ({ type, message, onClose }) => (
  <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg text-white font-semibold ${
    type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
  } animate-fade-in`} style={{animation: 'fadeIn 0.3s ease-in'}}>
    {message}
    <button onClick={onClose} className="ml-3">✕</button>
  </div>
);

// Simple Modal component inline
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const VenuePOSPage = ({ venueId: propVenueId }) => {
  // venueId can come from props or from parent context
  const venueId = propVenueId;
  const { user } = useContext(DataContext);
  const { calculateDiscount, applyDiscountToBooking, earnRewardPoints, getMembershipByPhone, getBonusHoursByPhone, useBonusHour } = useMembership();
  
  const [activeShift, setActiveShift] = useState(null);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClosingReportModal, setShowClosingReportModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  
  // Walk-in form state
  const [walkInForm, setWalkInForm] = useState({
    customerName: '',
    customerPhone: '',
    courtId: '',
    startTime: '',
    endTime: '',
    paymentMethod: 'cash',
    splitCash: '',
    splitQris: '',
    splitTransfer: '',
  });

  const [courts, setCourts] = useState([]);
  const [bookingData, setBookingData] = useState(null);
  const [membershipDiscount, setMembershipDiscount] = useState(null);
  const [customerMembership, setCustomerMembership] = useState(null);
  const [availableBonusHours, setAvailableBonusHours] = useState([]);
  const [selectedBonusHourId, setSelectedBonusHourId] = useState(null);
  const [bonusHoursToUse, setBonusHoursToUse] = useState(0);

  // Fetch active shift
  useEffect(() => {
    loadActiveShift();
    loadCourts();
  }, [venueId]);

  const loadActiveShift = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_shifts')
        .select('*')
        .eq('venue_id', venueId)
        .eq('status', 'open')
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) throw error;
      setActiveShift(data?.[0] || null);
    } catch (err) {
      console.error('Error loading active shift:', err);
      setToast({ type: 'error', message: 'Gagal memuat shift aktif' });
    } finally {
      setLoading(false);
    }
  };

  const loadCourts = async () => {
    try {
      const { data, error } = await supabase
        .from('venue_courts')
        .select('*')
        .eq('venue_id', venueId)
        .eq('status', 'available')
        .order('name');

      if (error) throw error;
      setCourts(data || []);
    } catch (err) {
      console.error('Error loading courts:', err);
    }
  };

  // Start shift
  const handleStartShift = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('venue_shifts')
        .insert({
          venue_id: venueId,
          branch_id: activeShift?.branch_id || venueId, // Fallback to venue_id
          cashier_id: user.user.id,
          start_time: new Date().toISOString(),
          status: 'open',
        })
        .select();

      if (error) throw error;
      
      setActiveShift(data[0]);
      setShowStartShiftModal(false);
      setToast({ type: 'success', message: 'Shift dimulai' });
    } catch (err) {
      console.error('Error starting shift:', err);
      setToast({ type: 'error', message: 'Gagal memulai shift: ' + err.message });
    }
  };

  // End shift & generate closing report
  const handleEndShift = async () => {
    try {
      if (!activeShift) return;

      // Get payment summary
      const { data: payments, error: paymentErr } = await supabase
        .from('venue_payments')
        .select('method, amount')
        .eq('shift_id', activeShift.id)
        .eq('status', 'confirmed');

      if (paymentErr) throw paymentErr;

      // Calculate totals
      const summary = {
        totalCash: 0,
        totalQris: 0,
        totalTransfer: 0,
        totalRevenue: 0,
      };

      (payments || []).forEach(payment => {
        if (payment.method === 'cash') summary.totalCash += payment.amount;
        if (payment.method === 'qris') summary.totalQris += payment.amount;
        if (payment.method === 'transfer') summary.totalTransfer += payment.amount;
        summary.totalRevenue += payment.amount;
      });

      // Close shift
      const { error: updateErr } = await supabase
        .from('venue_shifts')
        .update({
          status: 'closed',
          end_time: new Date().toISOString(),
          total_cash: summary.totalCash,
          total_qris: summary.totalQris,
          total_transfer: summary.totalTransfer,
          total_revenue: summary.totalRevenue,
          closed_at: new Date().toISOString(),
        })
        .eq('id', activeShift.id);

      if (updateErr) throw updateErr;

      setActiveShift(null);
      setShowClosingReportModal(false);
      setToast({ type: 'success', message: 'Shift ditutup, laporan tersimpan' });
    } catch (err) {
      console.error('Error ending shift:', err);
      setToast({ type: 'error', message: 'Gagal menutup shift: ' + err.message });
    }
  };

  // Create walk-in booking
  const handleCreateWalkInBooking = async () => {
    try {
      if (!walkInForm.customerName || !walkInForm.courtId || !walkInForm.startTime || !walkInForm.endTime) {
        setToast({ type: 'error', message: 'Isi semua field yang wajib' });
        return;
      }

      if (!activeShift) {
        setToast({ type: 'error', message: 'Belum ada shift aktif. Buka shift dulu' });
        return;
      }

      const selectedCourt = courts.find(c => c.id === walkInForm.courtId);
      if (!selectedCourt) {
        setToast({ type: 'error', message: 'Lapangan tidak valid' });
        return;
      }

      // Calculate duration and price
      const start = new Date(walkInForm.startTime);
      const end = new Date(walkInForm.endTime);
      const durationHours = (end - start) / (1000 * 60 * 60);

      if (durationHours <= 0) {
        setToast({ type: 'error', message: 'Waktu akhir harus lebih besar dari waktu mulai' });
        return;
      }

      const totalPrice = selectedCourt.price_per_hour * durationHours;

      // Check overlap
      const { data: existingBookings, error: checkErr } = await supabase
        .from('venue_bookings')
        .select('*')
        .eq('court_id', walkInForm.courtId)
        .in('status', ['pending', 'paid', 'checked-in'])
        .gte('start_time', walkInForm.startTime)
        .lt('start_time', walkInForm.endTime);

      if (checkErr) throw checkErr;

      if (existingBookings && existingBookings.length > 0) {
        setToast({ type: 'error', message: 'Lapangan sudah dibooking pada jam tersebut' });
        return;
      }

      // Create booking
      const { data: booking, error: bookingErr } = await supabase
        .from('venue_bookings')
        .insert({
          venue_id: venueId,
          branch_id: activeShift.branch_id,
          court_id: walkInForm.courtId,
          customer_name: walkInForm.customerName,
          customer_phone: walkInForm.customerPhone,
          start_time: walkInForm.startTime,
          end_time: walkInForm.endTime,
          duration_hours: durationHours,
          total_price: totalPrice,
          status: 'pending',
          booking_type: 'walk-in',
        })
        .select();

      if (bookingErr) throw bookingErr;

      // Store booking data for payment
      setBookingData(booking[0]);
      
      // Check for membership and calculate discount + bonus hours by customer phone
      try {
        const [discountInfo, membershipInfo] = await Promise.all([
          calculateDiscount(venueId, totalPrice),
          walkInForm.customerPhone 
            ? getMembershipByPhone(walkInForm.customerPhone, venueId)
            : Promise.resolve(null),
        ]);
        setMembershipDiscount(discountInfo);
        setCustomerMembership(membershipInfo);

        // Fetch bonus hours if membership found
        if (membershipInfo && walkInForm.customerPhone) {
          const bonusHrs = await getBonusHoursByPhone(walkInForm.customerPhone, venueId);
          setAvailableBonusHours(bonusHrs);
        } else {
          setAvailableBonusHours([]);
        }
      } catch (err) {
        console.error('Error fetching membership info:', err);
        setMembershipDiscount(null);
        setCustomerMembership(null);
        setAvailableBonusHours([]);
      }
      // Reset bonus hour selection
      setSelectedBonusHourId(null);
      setBonusHoursToUse(0);
      
      setShowWalkInForm(false);
      setShowPaymentModal(true);
      
      // Reset form
      setWalkInForm({
        customerName: '',
        customerPhone: '',
        courtId: '',
        startTime: '',
        endTime: '',
        paymentMethod: 'cash',
        splitCash: '',
        splitQris: '',
        splitTransfer: '',
      });

      setToast({ type: 'success', message: 'Booking dibuat, lanjut ke pembayaran' });
    } catch (err) {
      console.error('Error creating booking:', err);
      setToast({ type: 'error', message: 'Gagal membuat booking: ' + err.message });
    }
  };

  // Process payment
  const handleProcessPayment = async () => {
    try {
      if (!bookingData || !activeShift) return;

      const paymentMethod = walkInForm.paymentMethod;
      // Chain: base → membership discount → bonus hour deduction
      const afterDiscount = membershipDiscount?.final_price || bookingData.total_price;

      // Calculate bonus hour deduction
      let bonusDeduction = 0;
      if (selectedBonusHourId && bonusHoursToUse > 0) {
        const selectedCourt = courts.find(c => c.id === walkInForm.courtId);
        const hourlyRate = selectedCourt?.price_per_hour || 0;
        // Cap bonus hours to actual booking duration
        const actualHoursToUse = Math.min(bonusHoursToUse, bookingData.duration_hours);
        bonusDeduction = Math.min(hourlyRate * actualHoursToUse, afterDiscount);
      }

      const finalPrice = Math.max(0, afterDiscount - bonusDeduction);
      let amount = finalPrice;

      // Validate split payment
      if (paymentMethod === 'split') {
        const cash = parseFloat(walkInForm.splitCash || 0);
        const qris = parseFloat(walkInForm.splitQris || 0);
        const transfer = parseFloat(walkInForm.splitTransfer || 0);
        const total = cash + qris + transfer;

        if (Math.abs(total - amount) > 0.01) {
          setToast({ type: 'error', message: `Total split payment harus Rp ${amount.toLocaleString('id-ID')}` });
          return;
        }
      }

      const { data: userData } = await supabase.auth.getUser();

      // Create payment with discounted + bonus-reduced amount
      const { data: payment, error: paymentErr } = await supabase
        .from('venue_payments')
        .insert({
          booking_id: bookingData.id,
          shift_id: activeShift.id,
          amount,
          method: amount === 0 ? 'cash' : paymentMethod,
          split_cash: paymentMethod === 'split' ? parseFloat(walkInForm.splitCash || 0) : null,
          split_qris: paymentMethod === 'split' ? parseFloat(walkInForm.splitQris || 0) : null,
          split_transfer: paymentMethod === 'split' ? parseFloat(walkInForm.splitTransfer || 0) : null,
          status: 'confirmed',
          processed_by: userData.user.id,
        })
        .select();

      if (paymentErr) throw paymentErr;

      // Update booking status to paid and apply final price
      const { error: updateErr } = await supabase
        .from('venue_bookings')
        .update({ 
          status: 'paid',
          ...(finalPrice !== bookingData.total_price && { total_price: finalPrice }),
        })
        .eq('id', bookingData.id);

      if (updateErr) throw updateErr;

      // Log membership discount if applied
      if (membershipDiscount?.discount_percent > 0) {
        await applyDiscountToBooking(
          bookingData.id,
          venueId,
          bookingData.total_price,
          membershipDiscount
        );
      }

      // Apply bonus hours if used
      if (selectedBonusHourId && bonusHoursToUse > 0) {
        const actualHoursToUse = Math.min(bonusHoursToUse, bookingData.duration_hours);
        await useBonusHour(selectedBonusHourId, bookingData.id, actualHoursToUse);
      }

      // Create invoice
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.random()).slice(2, 5)}`;
      const selectedCourt = courts.find(c => c.id === walkInForm.courtId);
      const invoiceItems = [
        {
          description: `${selectedCourt?.name || 'Court'} - ${bookingData.duration_hours}jam${membershipDiscount?.discount_percent > 0 ? ` (${membershipDiscount.discount_percent}% member diskon)` : ''}`,
          quantity: 1,
          unit_price: selectedCourt?.price_per_hour || 0,
          total: bookingData.total_price,
        },
      ];
      if (bonusDeduction > 0) {
        invoiceItems.push({
          description: `Bonus Hours Redemption (${bonusHoursToUse} jam)`,
          quantity: 1,
          unit_price: -bonusDeduction,
          total: -bonusDeduction,
        });
      }
      const { error: invoiceErr } = await supabase
        .from('venue_invoices')
        .insert({
          booking_id: bookingData.id,
          payment_id: payment[0].id,
          invoice_number: invoiceNumber,
          items: invoiceItems,
          subtotal: bookingData.total_price,
          tax: 0,
          total: finalPrice,
          customer_name: bookingData.customer_name,
          customer_phone: bookingData.customer_phone,
          status: 'issued',
          issued_at: new Date().toISOString(),
        });

      if (invoiceErr) throw invoiceErr;

      // Earn reward points if membership exists (only on amount paid, not bonus-covered part)
      if ((customerMembership?.membership_id || membershipDiscount?.tier_name) && finalPrice > 0) {
        try {
          const membershipId = customerMembership?.membership_id;
          if (membershipId) {
            await earnRewardPoints(membershipId, bookingData.id, finalPrice, 'Reward points earned from booking');
          }
        } catch (err) {
          console.error('Error earning reward points:', err);
        }
      }

      // Build success message
      const savingsParts = [];
      if (membershipDiscount?.discount_percent > 0) savingsParts.push(`Diskon: Rp ${membershipDiscount.discount_amount.toLocaleString('id-ID')}`);
      if (bonusDeduction > 0) savingsParts.push(`Bonus Hours: Rp ${bonusDeduction.toLocaleString('id-ID')}`);
      const savingsMsg = savingsParts.length > 0 ? ` (${savingsParts.join(', ')})` : '';

      setLastReceipt({
        invoiceNumber,
        booking: bookingData,
        selectedCourt: courts.find(c => c.id === walkInForm.courtId) || null,
        paymentMethod: paymentMethod === 'split' ? 'split' : (amount === 0 ? 'cash' : paymentMethod),
        finalPrice,
        bonusDeduction,
        membershipDiscount,
        createdAt: new Date().toISOString(),
      });

      setShowPaymentModal(false);
      setShowReceiptModal(true);
      setBookingData(null);
      setMembershipDiscount(null);
      setCustomerMembership(null);
      setAvailableBonusHours([]);
      setSelectedBonusHourId(null);
      setBonusHoursToUse(0);
      setToast({ type: 'success', message: `Pembayaran berhasil! Invoice: ${invoiceNumber}${savingsMsg}` });

      loadActiveShift();
    } catch (err) {
      console.error('Error processing payment:', err);
      setToast({ type: 'error', message: 'Gagal memproses pembayaran: ' + err.message });
    }
  };

  const printThermalReceipt = (receipt = lastReceipt) => {
    if (!receipt) return;

    const lines = [
      'STADIONE',
      '------------------------------',
      `Invoice: ${receipt.invoiceNumber}`,
      `Customer: ${receipt.booking?.customer_name || '-'}`,
      `Court: ${receipt.selectedCourt?.name || '-'}`,
      `Durasi: ${receipt.booking?.duration_hours || 0} jam`,
      `Metode: ${receipt.paymentMethod}`,
      '------------------------------',
      `Total: Rp ${Number(receipt.booking?.total_price || 0).toLocaleString('id-ID')}`,
      receipt.membershipDiscount?.discount_percent > 0 ? `Diskon Member: -Rp ${Number(receipt.membershipDiscount?.discount_amount || 0).toLocaleString('id-ID')}` : null,
      receipt.bonusDeduction > 0 ? `Bonus Hours: -Rp ${Number(receipt.bonusDeduction || 0).toLocaleString('id-ID')}` : null,
      `Dibayar: Rp ${Number(receipt.finalPrice || 0).toLocaleString('id-ID')}`,
      '------------------------------',
      new Date(receipt.createdAt || Date.now()).toLocaleString('id-ID'),
    ].filter(Boolean);

    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      setToast({ type: 'error', message: 'Popup print diblokir browser' });
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>${receipt.invoiceNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: monospace; margin: 0; padding: 12px; width: 80mm; }
            pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.35; margin: 0; }
          </style>
        </head>
        <body>
          <pre>${lines.join('\n')}</pre>
          <script>
            window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };
          </script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const computedTotalPrice = useMemo(() => {
    if (!walkInForm.startTime || !walkInForm.endTime) return 0;
    const start = new Date(walkInForm.startTime);
    const end = new Date(walkInForm.endTime);
    const hours = (end - start) / (1000 * 60 * 60);
    const court = courts.find(c => c.id === walkInForm.courtId);
    return hours > 0 && court ? court.price_per_hour * hours : 0;
  }, [walkInForm.startTime, walkInForm.endTime, walkInForm.courtId, courts]);

  return (
    <AdminLayout title="POS & Cashier System">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Active Shift Status */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white mb-6">
        {activeShift ? (
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm opacity-90">SHIFT AKTIF</div>
              <div className="text-3xl font-bold">
                Rp {activeShift.total_revenue?.toLocaleString('id-ID') || '0'}
              </div>
              <div className="text-sm mt-2">
                Dimulai: {new Date(activeShift.start_time).toLocaleTimeString('id-ID')}
              </div>
            </div>
            <button
              onClick={() => setShowClosingReportModal(true)}
              className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded font-semibold transition"
            >
              Tutup Shift
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm opacity-90">TIDAK ADA SHIFT AKTIF</div>
              <div className="text-xl">Buka shift untuk mulai kasir</div>
            </div>
            <button
              onClick={() => setShowStartShiftModal(true)}
              className="bg-green-500 hover:bg-green-600 px-6 py-2 rounded font-semibold transition"
            >
              Buka Shift
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {activeShift && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setShowWalkInForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition"
          >
            + Walk-In Booking
          </button>
          <button
            onClick={() => lastReceipt ? setShowReceiptModal(true) : setToast({ type: 'error', message: 'Belum ada invoice terakhir untuk dicetak' })}
            className="bg-gray-900 hover:bg-black text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
            disabled={!lastReceipt}
          >
            🖨️ Cetak Invoice Thermal
          </button>
        </div>
      )}

      {/* Shift Summary */}
      {activeShift && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-gray-500 text-sm">Cash</div>
            <div className="text-xl font-bold">Rp {activeShift.total_cash?.toLocaleString('id-ID') || '0'}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-gray-500 text-sm">QRIS</div>
            <div className="text-xl font-bold">Rp {activeShift.total_qris?.toLocaleString('id-ID') || '0'}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-gray-500 text-sm">Transfer</div>
            <div className="text-xl font-bold">Rp {activeShift.total_transfer?.toLocaleString('id-ID') || '0'}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 bg-gradient-to-br from-emerald-50">
            <div className="text-gray-500 text-sm font-semibold">Total Revenue</div>
            <div className="text-2xl font-bold text-emerald-600">
              Rp {activeShift.total_revenue?.toLocaleString('id-ID') || '0'}
            </div>
          </div>
        </div>
      )}

      {/* Walk-In Form Modal */}
      <Modal
        isOpen={showWalkInForm}
        onClose={() => setShowWalkInForm(false)}
        title="Booking Walk-In"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold mb-1">Nama Customer *</label>
            <input
              type="text"
              value={walkInForm.customerName}
              onChange={(e) => setWalkInForm({...walkInForm, customerName: e.target.value})}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Nama customer"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">No. Telepon</label>
            <input
              type="tel"
              value={walkInForm.customerPhone}
              onChange={(e) => setWalkInForm({...walkInForm, customerPhone: e.target.value})}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="08xx-xxxx-xxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Lapangan *</label>
            <select
              value={walkInForm.courtId}
              onChange={(e) => setWalkInForm({...walkInForm, courtId: e.target.value})}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">-- Pilih Lapangan --</option>
              {courts.map(court => (
                <option key={court.id} value={court.id}>
                  {court.name} - Rp {court.price_per_hour?.toLocaleString('id-ID')}/jam
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Jam Mulai *</label>
              <input
                type="datetime-local"
                value={walkInForm.startTime}
                onChange={(e) => setWalkInForm({...walkInForm, startTime: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Jam Selesai *</label>
              <input
                type="datetime-local"
                value={walkInForm.endTime}
                onChange={(e) => setWalkInForm({...walkInForm, endTime: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-sm text-gray-600">Total Harga</div>
            <div className="text-2xl font-bold text-blue-600">
              Rp {computedTotalPrice.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setShowWalkInForm(false)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded-lg font-semibold transition"
            >
              Batal
            </button>
            <button
              onClick={handleCreateWalkInBooking}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold transition"
            >
              Lanjut ke Pembayaran
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Pembayaran"
      >
        {bookingData && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-2">Booking Summary</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-semibold">{bookingData.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Durasi:</span>
                  <span className="font-semibold">{bookingData.duration_hours} jam</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-base">
                  <span>Total Harga:</span>
                  <span>Rp {bookingData.total_price?.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Membership Discount Display */}
            {membershipDiscount && membershipDiscount.discount_percent > 0 && (
              <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-green-900">🎁 Membership Discount Applied!</div>
                  <span className="text-xs bg-green-200 px-2 py-1 rounded">{membershipDiscount.tier_name}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Original Price:</span>
                    <span>Rp {bookingData.total_price?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-semibold">
                    <span>Diskon ({membershipDiscount.discount_percent}%):</span>
                    <span>-Rp {membershipDiscount.discount_amount?.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="border-t border-green-300 pt-2 mt-2 flex justify-between font-bold text-base">
                    <span>Final Price:</span>
                    <span className="text-green-600">Rp {membershipDiscount.final_price?.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bonus Hours Redemption */}
            {availableBonusHours.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="text-sm font-semibold text-blue-900 mb-2">⏰ Bonus Hours Tersedia</div>
                <div className="space-y-2 mb-3">
                  {availableBonusHours.map(bh => (
                    <label key={bh.bonus_hour_id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="bonusHour"
                        value={bh.bonus_hour_id}
                        checked={selectedBonusHourId === bh.bonus_hour_id}
                        onChange={() => {
                          setSelectedBonusHourId(bh.bonus_hour_id);
                          // Default to max usable hours (capped to available & booking duration)
                          const maxHours = bookingData ? Math.min(bh.hours_remaining, bookingData.duration_hours) : bh.hours_remaining;
                          setBonusHoursToUse(Math.floor(maxHours));
                        }}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-blue-800">
                        {bh.hours_remaining} jam tersisa — kedaluwarsa {new Date(bh.expiration_date).toLocaleDateString('id-ID')}
                      </span>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="bonusHour"
                      value=""
                      checked={selectedBonusHourId === null}
                      onChange={() => { setSelectedBonusHourId(null); setBonusHoursToUse(0); }}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-blue-800">Tidak pakai bonus hours</span>
                  </label>
                </div>
                {selectedBonusHourId && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-blue-900">Jam yang dipakai:</label>
                    <input
                      type="number"
                      min="0"
                      max={bookingData ? Math.min(
                        availableBonusHours.find(bh => bh.bonus_hour_id === selectedBonusHourId)?.hours_remaining || 0,
                        bookingData.duration_hours
                      ) : 0}
                      step="0.5"
                      value={bonusHoursToUse}
                      onChange={(e) => setBonusHoursToUse(parseFloat(e.target.value) || 0)}
                      className="border rounded-lg px-3 py-1 w-20 text-center"
                    />
                    <span className="text-sm text-blue-700">
                      {(() => {
                        const selectedCourt = courts.find(c => c.id === walkInForm.courtId);
                        const hourlyRate = selectedCourt?.price_per_hour || 0;
                        const afterDiscount = membershipDiscount?.final_price || bookingData?.total_price || 0;
                        const deduction = Math.min(hourlyRate * bonusHoursToUse, afterDiscount);
                        return `= -Rp ${deduction.toLocaleString('id-ID')}`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Price Summary */}
            {(membershipDiscount?.discount_percent > 0 || (selectedBonusHourId && bonusHoursToUse > 0)) && (() => {
              const selectedCourt = courts.find(c => c.id === walkInForm.courtId);
              const hourlyRate = selectedCourt?.price_per_hour || 0;
              const afterDiscount = membershipDiscount?.final_price || bookingData?.total_price || 0;
              const bonusDeduction = selectedBonusHourId
                ? Math.min(hourlyRate * bonusHoursToUse, afterDiscount)
                : 0;
              const finalAmt = Math.max(0, afterDiscount - bonusDeduction);
              return (
                <div className="bg-gray-900 text-white rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Total yang harus dibayar</div>
                  <div className="text-2xl font-bold">Rp {finalAmt.toLocaleString('id-ID')}</div>
                  {finalAmt === 0 && <div className="text-xs text-green-400 mt-1">✓ Ditanggung penuh oleh benefit membership</div>}
                </div>
              );
            })()}

            <div>
              <label className="block text-sm font-semibold mb-2">Metode Pembayaran</label>
              <select
                value={walkInForm.paymentMethod}
                onChange={(e) => setWalkInForm({...walkInForm, paymentMethod: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="cash">💵 Cash</option>
                <option value="qris">📱 QRIS</option>
                <option value="transfer">🏦 Transfer Bank</option>
                <option value="split">🔀 Split Payment</option>
              </select>
            </div>

            {walkInForm.paymentMethod === 'split' && (
              <div className="space-y-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div>
                  <label className="block text-sm font-semibold mb-1">Cash</label>
                  <input
                    type="number"
                    value={walkInForm.splitCash}
                    onChange={(e) => setWalkInForm({...walkInForm, splitCash: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">QRIS</label>
                  <input
                    type="number"
                    value={walkInForm.splitQris}
                    onChange={(e) => setWalkInForm({...walkInForm, splitQris: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Transfer</label>
                  <input
                    type="number"
                    value={walkInForm.splitTransfer}
                    onChange={(e) => setWalkInForm({...walkInForm, splitTransfer: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded-lg font-semibold transition"
              >
                Batal
              </button>
              <button
                onClick={handleProcessPayment}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
              >
                Proses Pembayaran
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Thermal Receipt Modal */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Invoice Thermal"
      >
        {lastReceipt && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 font-mono text-sm">
              <div className="text-center font-bold mb-2">STADIONE</div>
              <div className="text-center text-xs mb-3">INVOICE THERMAL</div>
              <div className="space-y-1">
                <div>Invoice: {lastReceipt.invoiceNumber}</div>
                <div>Customer: {lastReceipt.booking?.customer_name || '-'}</div>
                <div>Court: {lastReceipt.selectedCourt?.name || '-'}</div>
                <div>Durasi: {lastReceipt.booking?.duration_hours || 0} jam</div>
                <div>Metode: {lastReceipt.paymentMethod}</div>
                <div className="border-t border-dashed border-gray-300 pt-2 mt-2">Total: Rp {Number(lastReceipt.booking?.total_price || 0).toLocaleString('id-ID')}</div>
                {lastReceipt.membershipDiscount?.discount_percent > 0 && (
                  <div>Diskon: -Rp {Number(lastReceipt.membershipDiscount.discount_amount || 0).toLocaleString('id-ID')}</div>
                )}
                {lastReceipt.bonusDeduction > 0 && (
                  <div>Bonus Hours: -Rp {Number(lastReceipt.bonusDeduction || 0).toLocaleString('id-ID')}</div>
                )}
                <div className="border-t border-dashed border-gray-300 pt-2 mt-2 font-bold">Dibayar: Rp {Number(lastReceipt.finalPrice || 0).toLocaleString('id-ID')}</div>
                <div className="text-[10px] text-center pt-2">{new Date(lastReceipt.createdAt || Date.now()).toLocaleString('id-ID')}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => printThermalReceipt(lastReceipt)}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-2 rounded-lg font-semibold transition"
              >
                Print Thermal
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded-lg font-semibold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Closing Report Modal */}
      <Modal
        isOpen={showClosingReportModal}
        onClose={() => setShowClosingReportModal(false)}
        title="Tutup Shift - Laporan Closing"
      >
        {activeShift && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-gray-600 mb-3">RINGKASAN SHIFT</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Mulai:</span>
                  <span className="font-semibold">{new Date(activeShift.start_time).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash:</span>
                  <span className="font-semibold">Rp {activeShift.total_cash?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>QRIS:</span>
                  <span className="font-semibold">Rp {activeShift.total_qris?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transfer:</span>
                  <span className="font-semibold">Rp {activeShift.total_transfer?.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
                  <span>TOTAL REVENUE:</span>
                  <span className="text-emerald-600">Rp {activeShift.total_revenue?.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 text-sm">
              <div className="font-semibold text-yellow-900">⚠️ Konfirmasi</div>
              <div className="text-yellow-800 mt-1">
                Pastikan fisik kas sudah dihitung dan cocok dengan laporan ini sebelum menutup shift.
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setShowClosingReportModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded-lg font-semibold transition"
              >
                Batal
              </button>
              <button
                onClick={handleEndShift}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition"
              >
                Konfirmasi & Tutup Shift
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};

export default VenuePOSPage;
