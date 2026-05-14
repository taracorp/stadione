import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Edit3 } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, StatusBadge, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked-in'];

export default function VenueCalendarPage({ venue }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookings, setBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editForm, setEditForm] = useState({ booking_date: '', start_time: '', end_time: '', court_id: '' });
  const [savingSlot, setSavingSlot] = useState(false);
  const [toast, setToast] = useState(null);

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
      const [bookingResult, courtResult] = await Promise.all([
        supabase.from('venue_bookings').select('*').eq('venue_id', venue.id).eq('booking_date', selectedDate).order('start_time', { ascending: true }),
        supabase.from('venue_courts').select('*').eq('venue_id', venue.id).order('name', { ascending: true }),
      ]);

      setBookings(bookingResult.data || []);
      setCourts(courtResult.data || []);
    } catch (error) {
      console.error('VenueCalendarPage load error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [venue?.id, selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'all') return bookings;
    return bookings.filter((booking) => booking.status === statusFilter);
  }, [bookings, statusFilter]);

  const bookingsByCourt = useMemo(() => {
    return courts.map((court) => ({
      court,
      bookings: filteredBookings.filter((booking) => booking.court_id === court.id),
    }));
  }, [courts, filteredBookings]);

  const editConflict = useMemo(() => {
    if (!editingBooking || !editForm.booking_date || !editForm.start_time || !editForm.end_time || !editForm.court_id) return null;
    if (editForm.end_time <= editForm.start_time) return null;

    return bookings.find((booking) => {
      if (booking.id === editingBooking.id) return false;
      if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return false;
      if (booking.booking_date !== editForm.booking_date) return false;
      if (booking.court_id !== editForm.court_id) return false;
      return editForm.start_time < booking.end_time && editForm.end_time > booking.start_time;
    }) || null;
  }, [bookings, editingBooking, editForm.booking_date, editForm.start_time, editForm.end_time, editForm.court_id]);

  function openEditSlot(booking) {
    setEditingBooking(booking);
    setEditForm({
      booking_date: booking.booking_date,
      start_time: booking.start_time?.slice(0, 5) || '',
      end_time: booking.end_time?.slice(0, 5) || '',
      court_id: booking.court_id || '',
    });
  }

  async function saveReschedule() {
    if (!editingBooking) return;

    if (!editForm.booking_date || !editForm.start_time || !editForm.end_time || !editForm.court_id) {
      showToast('error', 'Tanggal, court, jam mulai, dan jam selesai wajib diisi.');
      return;
    }

    if (editForm.end_time <= editForm.start_time) {
      showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
      return;
    }

    if (editConflict) {
      showToast('error', `Slot bentrok dengan booking ${editConflict.customer_name} (${editConflict.start_time} - ${editConflict.end_time}).`);
      return;
    }

    setSavingSlot(true);
    try {
      await supabase
        .from('venue_bookings')
        .update({
          booking_date: editForm.booking_date,
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          court_id: editForm.court_id,
        })
        .eq('id', editingBooking.id);

      showToast('success', 'Slot booking berhasil diubah.');
      setEditingBooking(null);
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
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={CalendarDays} title="Belum ada venue" description="Daftarkan venue dulu untuk melihat kalender booking." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Kalender</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Kalender Booking Venue</h1>
        <p className="text-neutral-500 text-sm mt-1">Lihat jadwal per tanggal untuk setiap court secara cepat.</p>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-4 grid md:grid-cols-3 gap-3">
        <Field label="Tanggal">
          <input type="date" className={inputCls} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </Field>
        <Field label="Filter Status">
          <select className={selectCls} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Semua</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked-in</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <div className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center"><Clock3 size={16} /></div>
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Total Booking</p>
            <p className="text-2xl font-display text-neutral-900">{filteredBookings.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          [...Array(3)].map((_, index) => <div key={index} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />)
        ) : bookingsByCourt.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Belum ada court" description="Tambahkan court agar jadwal bisa ditampilkan di kalender." />
        ) : (
          bookingsByCourt.map(({ court, bookings: courtBookings }) => (
            <div key={court.id} className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h2 className="font-display text-2xl text-neutral-900">{court.name}</h2>
                  <p className="text-sm text-neutral-500">{court.sport_type} · Rp {Number(court.price_per_hour || 0).toLocaleString('id-ID')}/jam</p>
                </div>
                <StatusBadge status={court.status} />
              </div>

              {courtBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-sm text-neutral-500">
                  Tidak ada booking untuk court ini pada tanggal {selectedDate}.
                </div>
              ) : (
                <div className="space-y-2">
                  {courtBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-neutral-200 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-neutral-900">{booking.customer_name}</p>
                        <p className="text-sm text-neutral-500">{booking.start_time} - {booking.end_time} · {booking.booking_type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={booking.status} />
                        <button
                          type="button"
                          onClick={() => openEditSlot(booking)}
                          className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900"
                          title="Edit Slot"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Modal open={!!editingBooking} onClose={() => setEditingBooking(null)} title="Edit Slot Booking" width="max-w-xl">
        {editingBooking ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="font-semibold text-neutral-900">{editingBooking.customer_name}</p>
              <p className="text-sm text-neutral-500">{editingBooking.booking_type} · Status {editingBooking.status}</p>
            </div>

            {editConflict ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Slot bentrok dengan booking {editConflict.customer_name} ({editConflict.start_time} - {editConflict.end_time}).
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Tanggal">
                <input
                  type="date"
                  className={inputCls}
                  value={editForm.booking_date}
                  onChange={(event) => setEditForm((current) => ({ ...current, booking_date: event.target.value }))}
                />
              </Field>
              <Field label="Court">
                <select
                  className={selectCls}
                  value={editForm.court_id}
                  onChange={(event) => setEditForm((current) => ({ ...current, court_id: event.target.value }))}
                >
                  <option value="">Pilih court</option>
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
                </select>
              </Field>
              <Field label="Jam Mulai">
                <input
                  type="time"
                  className={inputCls}
                  value={editForm.start_time}
                  onChange={(event) => setEditForm((current) => ({ ...current, start_time: event.target.value }))}
                />
              </Field>
              <Field label="Jam Selesai">
                <input
                  type="time"
                  className={inputCls}
                  value={editForm.end_time}
                  onChange={(event) => setEditForm((current) => ({ ...current, end_time: event.target.value }))}
                />
              </Field>
            </div>

            <div className="flex gap-2 justify-end">
              <ActionButton variant="outline" onClick={() => setEditingBooking(null)}>Batal</ActionButton>
              <ActionButton onClick={saveReschedule} loading={savingSlot}>Simpan Slot</ActionButton>
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
