import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Clock3, Edit3, Plus, Search } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, Modal, StatusBadge, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked-in'];

const BOOKING_EMPTY = {
  branch_id: '',
  court_id: '',
  booking_type: 'walk-in',
  customer_name: '',
  customer_phone: '',
  booking_date: new Date().toISOString().slice(0, 10),
  start_time: '18:00',
  end_time: '19:00',
  duration_hours: 1,
  total_price: '',
  payment_method: 'cash',
  payment_status: 'unpaid',
  status: 'pending',
  notes: '',
};

export default function VenueBookingsPage({ auth, venue }) {
  return <VenueBookingsWorkspace auth={auth} venue={venue} />;
}

function VenueBookingsWorkspace({ auth, venue }) {
  const [bookings, setBookings] = useState([]);
  const [branches, setBranches] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BOOKING_EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editingSlot, setEditingSlot] = useState(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({ booking_date: '', start_time: '', end_time: '', court_id: '' });
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState(null);
  const [discountInfo, setDiscountInfo] = useState({});

  function showToast(type, message) {
    setToast({ type, message });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    if (!venue?.id || !supabase) return;

    setLoading(true);
    try {
      const [bookingResult, branchResult, courtResult] = await Promise.all([
        supabase.from('venue_bookings').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
        supabase.from('venue_branches').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
        supabase.from('venue_courts').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
      ]);

      const bookingData = bookingResult.data || [];
      setBookings(bookingData);
      setBranches(branchResult.data || []);
      setCourts(courtResult.data || []);

      // Load discount info for all bookings
      if (bookingData.length > 0) {
        const { data: discountData } = await supabase
          .from('membership_discount_log')
          .select('*')
          .in('booking_id', bookingData.map(b => b.id));
        
        const discountMap = {};
        (discountData || []).forEach(discount => {
          discountMap[discount.booking_id] = discount;
        });
        setDiscountInfo(discountMap);
      }

      if (!form.branch_id && branchResult.data?.[0]?.id) {
        setForm((current) => ({ ...current, branch_id: branchResult.data[0].id, court_id: courtResult.data?.[0]?.id || '' }));
      }
    } catch (error) {
      console.error('VenueBookingsPage load error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [venue?.id, form.branch_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFormError('');
  }, [form.customer_name, form.branch_id, form.court_id, form.booking_date, form.start_time, form.end_time]);

  const availableCourts = useMemo(() => {
    if (!form.branch_id) return courts;
    return courts.filter((court) => !court.branch_id || court.branch_id === form.branch_id);
  }, [courts, form.branch_id]);

  useEffect(() => {
    if (!form.branch_id) return;
    const hasCourt = availableCourts.some((court) => court.id === form.court_id);
    if (!hasCourt) {
      setForm((current) => ({ ...current, court_id: availableCourts[0]?.id || '' }));
    }
  }, [availableCourts, form.branch_id, form.court_id]);

  const selectedCourt = useMemo(() => courts.find((court) => court.id === form.court_id) || null, [courts, form.court_id]);

  const computedDurationHours = useMemo(() => {
    if (!form.start_time || !form.end_time) return 0;
    const [startHour, startMinute] = form.start_time.split(':').map((value) => Number(value));
    const [endHour, endMinute] = form.end_time.split(':').map((value) => Number(value));
    const startMinutes = (startHour * 60) + startMinute;
    const endMinutes = (endHour * 60) + endMinute;
    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || endMinutes <= startMinutes) return 0;
    return Number(((endMinutes - startMinutes) / 60).toFixed(2));
  }, [form.start_time, form.end_time]);

  const computedTotalPrice = useMemo(() => {
    const hourlyRate = Number(selectedCourt?.price_per_hour || 0);
    if (!hourlyRate || !computedDurationHours) return 0;
    return Math.round(hourlyRate * computedDurationHours);
  }, [selectedCourt?.price_per_hour, computedDurationHours]);

  const conflictBooking = useMemo(() => {
    if (!form.booking_date || !form.court_id || !computedDurationHours) return null;

    return bookings.find((booking) => {
      if (booking.court_id !== form.court_id || booking.booking_date !== form.booking_date) return false;
      if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return false;
      return form.start_time < booking.end_time && form.end_time > booking.start_time;
    }) || null;
  }, [bookings, form.booking_date, form.court_id, form.start_time, form.end_time, computedDurationHours]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      const haystack = `${booking.customer_name || ''} ${booking.customer_phone || ''} ${booking.notes || ''}`.toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [bookings, statusFilter, search]);

  const selectedSlotCourt = useMemo(() => courts.find((court) => court.id === slotForm.court_id) || null, [courts, slotForm.court_id]);

  const slotDurationHours = useMemo(() => {
    if (!slotForm.start_time || !slotForm.end_time) return 0;
    const [startHour, startMinute] = slotForm.start_time.split(':').map((value) => Number(value));
    const [endHour, endMinute] = slotForm.end_time.split(':').map((value) => Number(value));
    const startMinutes = (startHour * 60) + startMinute;
    const endMinutes = (endHour * 60) + endMinute;
    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || endMinutes <= startMinutes) return 0;
    return Number(((endMinutes - startMinutes) / 60).toFixed(2));
  }, [slotForm.start_time, slotForm.end_time]);

  const slotTotalPrice = useMemo(() => {
    const hourlyRate = Number(selectedSlotCourt?.price_per_hour || 0);
    if (!hourlyRate || !slotDurationHours) return 0;
    return Math.round(hourlyRate * slotDurationHours);
  }, [selectedSlotCourt?.price_per_hour, slotDurationHours]);

  const slotConflict = useMemo(() => {
    if (!editingSlot || !slotForm.booking_date || !slotForm.court_id || !slotDurationHours) return null;

    return bookings.find((booking) => {
      if (booking.id === editingSlot.id) return false;
      if (booking.court_id !== slotForm.court_id || booking.booking_date !== slotForm.booking_date) return false;
      if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return false;
      return slotForm.start_time < booking.end_time && slotForm.end_time > booking.start_time;
    }) || null;
  }, [bookings, editingSlot, slotForm.booking_date, slotForm.court_id, slotForm.start_time, slotForm.end_time, slotDurationHours]);

  function openSlotEditor(booking) {
    setEditingSlot(booking);
    setSlotForm({
      booking_date: booking.booking_date || new Date().toISOString().slice(0, 10),
      start_time: booking.start_time ? String(booking.start_time).slice(0, 5) : '',
      end_time: booking.end_time ? String(booking.end_time).slice(0, 5) : '',
      court_id: booking.court_id || '',
    });
  }

  function closeSlotEditor() {
    setEditingSlot(null);
    setSlotForm({ booking_date: '', start_time: '', end_time: '', court_id: '' });
  }

  async function saveBooking() {
    if (!venue?.id || !form.customer_name.trim() || !form.branch_id || !form.court_id) return;

    if (!computedDurationHours) {
      const message = 'Jam selesai harus lebih besar dari jam mulai.';
      setFormError(message);
      showToast('error', message);
      return;
    }

    if (conflictBooking) {
      const message = `Slot bentrok dengan booking ${conflictBooking.customer_name} (${conflictBooking.start_time} - ${conflictBooking.end_time}).`;
      setFormError(message);
      showToast('error', message);
      return;
    }

    setSaving(true);
    try {
      const normalizedStatus = form.payment_status === 'paid' && form.status === 'pending' ? 'confirmed' : form.status;

      await supabase.from('venue_bookings').insert({
        venue_id: venue.id,
        branch_id: form.branch_id,
        court_id: form.court_id,
        booking_type: form.booking_type,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        booking_date: form.booking_date,
        start_time: form.start_time,
        end_time: form.end_time,
        duration_hours: computedDurationHours,
        total_price: computedTotalPrice,
        payment_method: form.payment_method,
        payment_status: form.payment_status,
        status: normalizedStatus,
        notes: form.notes.trim() || null,
        created_by: auth?.id || null,
      });

      setFormError('');
      showToast('success', 'Booking berhasil disimpan.');
      setForm((current) => ({ ...BOOKING_EMPTY, branch_id: current.branch_id || branches[0]?.id || '', court_id: current.court_id || courts[0]?.id || '' }));
      await load();
    } catch (error) {
      const rawMessage = error?.message || 'Gagal menyimpan booking.';
      const mappedMessage = rawMessage.includes('Court sudah dibooking')
        ? 'Slot bentrok: court sudah dibooking pada jam tersebut. Silakan pilih jam atau court lain.'
        : rawMessage;
      setFormError(mappedMessage);
      showToast('error', mappedMessage);
    } finally {
      setSaving(false);
    }
  }

  async function updateBooking(bookingId, updates) {
    try {
      await supabase.from('venue_bookings').update(updates).eq('id', bookingId);
      showToast('success', 'Status booking berhasil diperbarui.');
      setSelected(null);
      await load();
    } catch (error) {
      const rawMessage = error?.message || 'Gagal memperbarui booking.';
      const mappedMessage = rawMessage.includes('Court sudah dibooking')
        ? 'Update ditolak: slot bentrok dengan booking lain.'
        : rawMessage;
      showToast('error', mappedMessage);
    }
  }

  async function saveRescheduleSlot() {
    if (!editingSlot) return;

    if (!slotForm.booking_date || !slotForm.court_id || !slotForm.start_time || !slotForm.end_time) {
      showToast('error', 'Tanggal, court, jam mulai, dan jam selesai wajib diisi.');
      return;
    }

    if (!slotDurationHours) {
      showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
      return;
    }

    if (slotConflict) {
      showToast('error', `Reschedule ditolak: bentrok dengan ${slotConflict.customer_name} (${slotConflict.start_time} - ${slotConflict.end_time}).`);
      return;
    }

    setSavingSlot(true);
    try {
      await supabase
        .from('venue_bookings')
        .update({
          booking_date: slotForm.booking_date,
          start_time: slotForm.start_time,
          end_time: slotForm.end_time,
          court_id: slotForm.court_id,
          branch_id: selectedSlotCourt?.branch_id || editingSlot.branch_id,
          duration_hours: slotDurationHours,
          total_price: slotTotalPrice,
        })
        .eq('id', editingSlot.id);

      showToast('success', 'Slot booking berhasil diubah.');
      closeSlotEditor();
      await load();
    } catch (error) {
      const rawMessage = error?.message || 'Gagal mengubah slot booking.';
      const mappedMessage = rawMessage.includes('Court sudah dibooking')
        ? 'Reschedule ditolak: slot bentrok dengan booking lain.'
        : rawMessage;
      showToast('error', mappedMessage);
    } finally {
      setSavingSlot(false);
    }
  }

  if (!venue?.id) {
    return <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8"><EmptyState icon={BookOpen} title="Belum ada venue" description="Daftarkan venue dulu untuk mulai mengelola booking." /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Booking</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Manajemen Booking</h1>
        <p className="text-neutral-500 text-sm mt-1">Buat booking pertama, cek daftar hari ini, dan ubah status booking venue.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: bookings.length, icon: CalendarDays },
          { label: 'Pending', value: bookings.filter((item) => item.status === 'pending').length, icon: Clock3 },
          { label: 'Checked-in', value: bookings.filter((item) => item.status === 'checked-in').length, icon: CheckCircle2 },
          { label: 'Paid', value: bookings.filter((item) => item.payment_status === 'paid').length, icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4"><Icon size={16} /></div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">{item.label}</p>
              <p className="text-3xl font-display text-neutral-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Booking Pertama</p>
              <h2 className="font-display text-2xl text-neutral-900">Walk-in booking</h2>
            </div>
            <ActionButton onClick={saveBooking} loading={saving}><Plus size={14} /> Simpan</ActionButton>
          </div>
            {formError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
            ) : null}
            {conflictBooking ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Court sudah terpakai di slot itu: {conflictBooking.customer_name} ({conflictBooking.start_time} - {conflictBooking.end_time}).
              </div>
            ) : null}
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Cabang">
              <select className={selectCls} value={form.branch_id} onChange={(event) => setForm((current) => ({ ...current, branch_id: event.target.value }))}>
                <option value="">Pilih cabang</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </Field>
            <Field label="Court">
              <select className={selectCls} value={form.court_id} onChange={(event) => setForm((current) => ({ ...current, court_id: event.target.value }))}>
                <option value="">Pilih court</option>
                  {availableCourts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
              </select>
            </Field>
            <Field label="Customer Name"><input className={inputCls} value={form.customer_name} onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} /></Field>
            <Field label="Customer Phone"><input className={inputCls} value={form.customer_phone} onChange={(event) => setForm((current) => ({ ...current, customer_phone: event.target.value }))} /></Field>
            <Field label="Booking Date"><input className={inputCls} type="date" value={form.booking_date} onChange={(event) => setForm((current) => ({ ...current, booking_date: event.target.value }))} /></Field>
            <Field label="Type">
              <select className={selectCls} value={form.booking_type} onChange={(event) => setForm((current) => ({ ...current, booking_type: event.target.value }))}>
                <option value="walk-in">Walk-in</option>
                <option value="online">Online</option>
                <option value="tournament">Tournament</option>
                <option value="membership">Membership</option>
                <option value="recurring">Recurring</option>
              </select>
            </Field>
            <Field label="Start Time"><input className={inputCls} type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} /></Field>
            <Field label="End Time"><input className={inputCls} type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} /></Field>
            <Field label="Duration Hours"><input className={inputCls} type="number" value={computedDurationHours} readOnly /></Field>
            <Field label="Total Price"><input className={inputCls} type="number" value={computedTotalPrice} readOnly /></Field>
            <Field label="Payment Method">
              <select className={selectCls} value={form.payment_method} onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}>
                <option value="cash">Cash</option>
                <option value="qris">QRIS</option>
                <option value="split">Split</option>
                <option value="transfer">Transfer</option>
                <option value="pending">Pending</option>
              </select>
            </Field>
            <Field label="Payment Status">
              <select className={selectCls} value={form.payment_status} onChange={(event) => setForm((current) => ({ ...current, payment_status: event.target.value }))}>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </Field>
            <Field label="Booking Status">
              <select className={selectCls} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked-in">Checked-in</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>
          <Field label="Notes"><textarea className={textareaCls} rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Daftar Booking</p>
              <h2 className="font-display text-2xl text-neutral-900">Riwayat & hari ini</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'pending', 'confirmed', 'checked-in', 'completed', 'cancelled'].map((status) => (
                <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${statusFilter === status ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-500 border-neutral-200'}`}>
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input className={`${inputCls} pl-10`} placeholder="Cari customer / notes" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
            {loading ? (
              [...Array(3)].map((_, index) => <div key={index} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />)
            ) : filteredBookings.length === 0 ? (
              <EmptyState icon={BookOpen} title="Belum ada booking" description="Buat booking pertama di form sebelah kiri." />
            ) : filteredBookings.map((booking) => {
              const discount = discountInfo[booking.id];
              return (
                <div key={booking.id} className={`w-full rounded-2xl border p-4 text-left hover:border-neutral-900 transition ${discount ? 'border-green-200 bg-green-50' : 'border-neutral-200'}`}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <button type="button" onClick={() => setSelected(booking)} className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{booking.customer_name}</span>
                        {discount && (
                          <span className="text-xs font-semibold bg-green-200 text-green-900 px-2 py-1 rounded">
                            🎁 {discount.discount_percent}% OFF
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-neutral-500">{booking.booking_date} · {booking.start_time} - {booking.end_time}</div>
                    </button>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={booking.status} />
                      <button
                        type="button"
                        onClick={() => openSlotEditor(booking)}
                        className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900"
                        title="Edit Slot"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-neutral-500">
                    {booking.booking_type} · {booking.payment_method} · Rp {Number(booking.total_price || 0).toLocaleString('id-ID')}
                    {discount && (
                      <span className="ml-2 text-green-600 font-semibold">
                        (Diskon: Rp {discount.discount_amount?.toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detail Booking" width="max-w-2xl">
        {selected && (() => {
          const discount = discountInfo[selected.id];
          return (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-neutral-900">{selected.customer_name}</div>
                  <div className="text-sm text-neutral-500">{selected.booking_date} · {selected.start_time} - {selected.end_time}</div>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {discount && (
                <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-green-900">🎁 Membership Discount Applied</span>
                    <span className="text-sm font-semibold bg-green-200 px-2 py-1 rounded">{discount.tier_name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Original: Rp {Number(discount.original_price || 0).toLocaleString('id-ID')}</div>
                    <div className="text-green-600 font-semibold">Discount: Rp {Number(discount.discount_amount || 0).toLocaleString('id-ID')}</div>
                    <div className="col-span-2 font-bold text-green-700">Final: Rp {Number(discount.final_price || 0).toLocaleString('id-ID')}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-neutral-200 p-4"><div className="text-neutral-400 text-xs uppercase mb-1">Payment</div><div className="font-semibold text-neutral-900">{selected.payment_method} · {selected.payment_status}</div></div>
                <div className="rounded-2xl border border-neutral-200 p-4"><div className="text-neutral-400 text-xs uppercase mb-1">Total</div><div className="font-semibold text-neutral-900">Rp {Number(selected.total_price || 0).toLocaleString('id-ID')}</div></div>
                <div className="rounded-2xl border border-neutral-200 p-4"><div className="text-neutral-400 text-xs uppercase mb-1">Type</div><div className="font-semibold text-neutral-900">{selected.booking_type}</div></div>
                <div className="rounded-2xl border border-neutral-200 p-4"><div className="text-neutral-400 text-xs uppercase mb-1">Phone</div><div className="font-semibold text-neutral-900">{selected.customer_phone || '-'}</div></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ActionButton variant="outline" onClick={() => { openSlotEditor(selected); setSelected(null); }}>Edit Slot</ActionButton>
                <ActionButton onClick={() => updateBooking(selected.id, { status: 'checked-in' })}>Check-In</ActionButton>
                <ActionButton variant="outline" onClick={() => updateBooking(selected.id, { status: 'completed', payment_status: 'paid' })}>Complete + Paid</ActionButton>
                <ActionButton variant="outline" onClick={() => updateBooking(selected.id, { payment_status: 'paid', status: selected.status === 'pending' ? 'confirmed' : selected.status })}>Mark Paid</ActionButton>
                <ActionButton variant="danger" onClick={() => updateBooking(selected.id, { status: 'cancelled' })}>Cancel</ActionButton>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!editingSlot} onClose={closeSlotEditor} title="Reschedule Slot" width="max-w-xl">
        {editingSlot ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="font-semibold text-neutral-900">{editingSlot.customer_name}</div>
              <div className="text-sm text-neutral-500">{editingSlot.booking_type} · Status {editingSlot.status}</div>
            </div>

            {slotConflict ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Slot bentrok dengan {slotConflict.customer_name} ({slotConflict.start_time} - {slotConflict.end_time}).
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Tanggal">
                <input type="date" className={inputCls} value={slotForm.booking_date} onChange={(event) => setSlotForm((current) => ({ ...current, booking_date: event.target.value }))} />
              </Field>
              <Field label="Court">
                <select className={selectCls} value={slotForm.court_id} onChange={(event) => setSlotForm((current) => ({ ...current, court_id: event.target.value }))}>
                  <option value="">Pilih court</option>
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
                </select>
              </Field>
              <Field label="Jam Mulai">
                <input type="time" className={inputCls} value={slotForm.start_time} onChange={(event) => setSlotForm((current) => ({ ...current, start_time: event.target.value }))} />
              </Field>
              <Field label="Jam Selesai">
                <input type="time" className={inputCls} value={slotForm.end_time} onChange={(event) => setSlotForm((current) => ({ ...current, end_time: event.target.value }))} />
              </Field>
              <Field label="Durasi (jam)">
                <input type="number" className={inputCls} readOnly value={slotDurationHours} />
              </Field>
              <Field label="Total Harga">
                <input type="number" className={inputCls} readOnly value={slotTotalPrice} />
              </Field>
            </div>

            <div className="flex gap-2 justify-end">
              <ActionButton variant="outline" onClick={closeSlotEditor}>Batal</ActionButton>
              <ActionButton onClick={saveRescheduleSlot} loading={savingSlot}>Simpan Slot</ActionButton>
            </div>
          </div>
        ) : null}
      </Modal>

      {toast ? (
        <div className={`fixed right-4 top-4 z-[70] max-w-sm rounded-2xl px-4 py-3 text-sm text-white shadow-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
