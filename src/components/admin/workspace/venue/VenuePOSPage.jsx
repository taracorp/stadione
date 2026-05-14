import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../config/supabase';
import AdminLayout from '../../AdminLayout';

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
  const [activeShift, setActiveShift] = useState(null);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showClosingReportModal, setShowClosingReportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
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
      let amount = bookingData.total_price;

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

      const { data: user } = await supabase.auth.getUser();

      // Create payment
      const { data: payment, error: paymentErr } = await supabase
        .from('venue_payments')
        .insert({
          booking_id: bookingData.id,
          shift_id: activeShift.id,
          amount,
          method: paymentMethod,
          split_cash: paymentMethod === 'split' ? parseFloat(walkInForm.splitCash || 0) : null,
          split_qris: paymentMethod === 'split' ? parseFloat(walkInForm.splitQris || 0) : null,
          split_transfer: paymentMethod === 'split' ? parseFloat(walkInForm.splitTransfer || 0) : null,
          status: 'confirmed',
          processed_by: user.user.id,
        })
        .select();

      if (paymentErr) throw paymentErr;

      // Update booking status to paid
      const { error: updateErr } = await supabase
        .from('venue_bookings')
        .update({ status: 'paid' })
        .eq('id', bookingData.id);

      if (updateErr) throw updateErr;

      // Create invoice
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.random()).slice(2, 5)}`;
      const { error: invoiceErr } = await supabase
        .from('venue_invoices')
        .insert({
          booking_id: bookingData.id,
          payment_id: payment[0].id,
          invoice_number: invoiceNumber,
          items: [
            {
              description: `${courts.find(c => c.id === walkInForm.courtId)?.name || 'Court'} - ${bookingData.duration_hours}jam`,
              quantity: 1,
              unit_price: courts.find(c => c.id === walkInForm.courtId)?.price_per_hour || 0,
              total: bookingData.total_price,
            },
          ],
          subtotal: bookingData.total_price,
          total: bookingData.total_price,
          customer_name: bookingData.customer_name,
          customer_phone: bookingData.customer_phone,
          status: 'issued',
          issued_at: new Date().toISOString(),
        });

      if (invoiceErr) throw invoiceErr;

      setShowPaymentModal(false);
      setBookingData(null);
      setToast({ type: 'success', message: `Pembayaran berhasil! Invoice: ${invoiceNumber}` });

      // Reload active shift to get updated totals
      loadActiveShift();
    } catch (err) {
      console.error('Error processing payment:', err);
      setToast({ type: 'error', message: 'Gagal memproses pembayaran: ' + err.message });
    }
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
            disabled
            className="bg-gray-300 text-gray-500 py-3 rounded-lg font-semibold cursor-not-allowed"
          >
            📄 Lihat Invoice
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
