import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Edit3, GripVertical } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, StatusBadge, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked-in'];
const VIEW_LABELS = { day: 'Harian', week: 'Mingguan', month: 'Bulanan' };
const PRIORITY_SLOT_START = '17:00';
const PRIORITY_SLOT_END = '20:00';

function toDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function parseDate(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey, days) {
  const date = parseDate(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function startOfWeek(dateKey) {
  const date = parseDate(dateKey);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toDateKey(date);
}

function startOfMonth(dateKey) {
  const date = parseDate(dateKey);
  date.setDate(1);
  return toDateKey(date);
}

function endOfMonth(dateKey) {
  const date = parseDate(dateKey);
  date.setMonth(date.getMonth() + 1, 0);
  return toDateKey(date);
}

function formatShortDate(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatTime(timeValue) {
  return String(timeValue || '').slice(0, 5);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function isPriorityWindow(startTime, endTime) {
  return String(startTime) < PRIORITY_SLOT_END && String(endTime) > PRIORITY_SLOT_START;
}

export default function VenueCalendarPage({ venue }) {
  const [view, setView] = useState('week');
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [bookings, setBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dragBookingId, setDragBookingId] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editForm, setEditForm] = useState({ booking_date: '', start_time: '', end_time: '', court_id: '' });
  const [savingSlot, setSavingSlot] = useState(false);
  const [toast, setToast] = useState(null);
  const [discountInfo, setDiscountInfo] = useState({});

  const range = useMemo(() => {
    if (view === 'day') return { start: selectedDate, end: selectedDate };
    if (view === 'month') return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    const start = startOfWeek(selectedDate);
    return { start, end: addDays(start, 6) };
  }, [selectedDate, view]);

  const visibleDays = useMemo(() => {
    const days = [];
    let cursor = range.start;
    while (cursor <= range.end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [range.end, range.start]);

  const monthGridDays = useMemo(() => {
    const first = parseDate(startOfMonth(selectedDate));
    const startOffset = (first.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < startOffset; i += 1) days.push(null);

    const cursor = parseDate(startOfMonth(selectedDate));
    const monthEnd = parseDate(endOfMonth(selectedDate));
    while (cursor <= monthEnd) {
      days.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [selectedDate]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === 'all') return bookings;
    return bookings.filter((booking) => booking.status === statusFilter);
  }, [bookings, statusFilter]);

  const dayBookingsByCourt = useMemo(() => courts.map((court) => ({
    court,
    bookings: filteredBookings.filter((booking) => booking.court_id === court.id && booking.booking_date === selectedDate),
  })), [courts, filteredBookings, selectedDate]);

  const monthBookingsByDate = useMemo(() => {
    const map = {};
    visibleDays.forEach((day) => { map[day] = []; });
    filteredBookings.forEach((booking) => {
      if (!map[booking.booking_date]) map[booking.booking_date] = [];
      map[booking.booking_date].push(booking);
    });
    return map;
  }, [filteredBookings, visibleDays]);

  const totalDiscountBookings = useMemo(() => (
    Object.keys(discountInfo).filter((id) => filteredBookings.some((booking) => String(booking.id) === String(id))).length
  ), [discountInfo, filteredBookings]);

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
      await supabase.rpc('expire_old_venue_bookings', { p_venue_id: venue.id });

      const [bookingResult, courtResult] = await Promise.all([
        supabase
          .from('venue_bookings')
          .select('*')
          .eq('venue_id', venue.id)
          .gte('booking_date', range.start)
          .lte('booking_date', range.end)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('venue_courts')
          .select('*')
          .eq('venue_id', venue.id)
          .order('name', { ascending: true }),
      ]);

      const bookingData = bookingResult.data || [];
      setBookings(bookingData);
      setCourts(courtResult.data || []);

      if (bookingData.length > 0) {
        const { data: discountData } = await supabase
          .from('membership_discount_log')
          .select('*')
          .in('booking_id', bookingData.map((booking) => booking.id));

        const discountMap = {};
        (discountData || []).forEach((discount) => {
          discountMap[discount.booking_id] = discount;
        });
        setDiscountInfo(discountMap);
      } else {
        setDiscountInfo({});
      }
    } catch (error) {
      console.error('VenueCalendarPage load error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start, venue?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const editConflict = useMemo(() => {
    if (!editingBooking || !editForm.booking_date || !editForm.start_time || !editForm.end_time || !editForm.court_id) return null;
    if (editForm.end_time <= editForm.start_time) return null;

    return bookings.find((booking) => {
      if (booking.id === editingBooking.id) return false;
      if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return false;
      if (booking.booking_date !== editForm.booking_date) return false;
      if (booking.court_id !== editForm.court_id) return false;
      return overlaps(editForm.start_time, editForm.end_time, booking.start_time, booking.end_time);
    }) || null;
  }, [bookings, editingBooking, editForm.booking_date, editForm.start_time, editForm.end_time, editForm.court_id]);

  async function findConflict(bookingId, targetDate, targetCourtId, targetStartTime, targetEndTime) {
    const { data, error } = await supabase
      .from('venue_bookings')
      .select('id, customer_name, start_time, end_time, status')
      .eq('venue_id', venue.id)
      .eq('booking_date', targetDate)
      .eq('court_id', targetCourtId)
      .in('status', ACTIVE_BOOKING_STATUSES);

    if (error) throw error;

    return (data || []).find((booking) => booking.id !== bookingId && overlaps(targetStartTime, targetEndTime, booking.start_time, booking.end_time)) || null;
  }

  async function rescheduleBooking(booking, targetDate, targetCourtId, targetStartTime = formatTime(booking.start_time), targetEndTime = formatTime(booking.end_time)) {
    if (!targetDate || !targetCourtId || !targetStartTime || !targetEndTime) {
      showToast('error', 'Target jadwal belum lengkap.');
      return;
    }

    if (targetEndTime <= targetStartTime) {
      showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
      return;
    }

    setSavingSlot(true);
    try {
      const conflict = await findConflict(booking.id, targetDate, targetCourtId, targetStartTime, targetEndTime);
      if (conflict) {
        showToast('error', `Slot bentrok dengan booking ${conflict.customer_name} (${formatTime(conflict.start_time)} - ${formatTime(conflict.end_time)}).`);
        return;
      }

      const { error } = await supabase
        .from('venue_bookings')
        .update({ booking_date: targetDate, court_id: targetCourtId, start_time: targetStartTime, end_time: targetEndTime })
        .eq('id', booking.id);

      if (error) throw error;

      showToast('success', 'Booking berhasil dipindahkan.');
      setEditingBooking(null);
      setDragBookingId(null);
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

  function openEditSlot(booking) {
    setEditingBooking(booking);
    setEditForm({
      booking_date: booking.booking_date,
      start_time: formatTime(booking.start_time),
      end_time: formatTime(booking.end_time),
      court_id: booking.court_id || '',
    });
  }

  function prevPeriod() {
    if (view === 'day') return setSelectedDate((current) => addDays(current, -1));
    if (view === 'week') return setSelectedDate((current) => addDays(current, -7));
    return setSelectedDate((current) => addDays(current, -30));
  }

  function nextPeriod() {
    if (view === 'day') return setSelectedDate((current) => addDays(current, 1));
    if (view === 'week') return setSelectedDate((current) => addDays(current, 7));
    return setSelectedDate((current) => addDays(current, 30));
  }

  function today() {
    setSelectedDate(toDateKey(new Date()));
  }

  function handleDragStart(booking) {
    setDragBookingId(booking.id);
  }

  async function handleDrop(targetDate, targetCourtId, booking) {
    if (!booking) return;
    await rescheduleBooking(booking, targetDate, targetCourtId, formatTime(booking.start_time), formatTime(booking.end_time));
  }

  if (!venue?.id) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={CalendarDays} title="Belum ada venue" description="Daftarkan venue dulu untuk melihat kalender booking." />
      </div>
    );
  }

  function BookingCard({ booking, compact = false }) {
    const discount = discountInfo[booking.id];
    const tone = booking.status === 'expired' ? 'border-red-200 bg-red-50' : discount ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-white';
    const priorityBooking = isPriorityWindow(booking.start_time, booking.end_time);

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(booking)}
        onDragEnd={() => setDragBookingId(null)}
        onClick={() => openEditSlot(booking)}
        className={`group cursor-grab active:cursor-grabbing rounded-2xl border p-3 transition hover:shadow-sm ${tone} ${compact ? 'text-xs' : 'text-sm'}`}
        title="Seret untuk pindahkan booking"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-neutral-900 truncate">{booking.customer_name}</p>
              {discount && <span className="text-[10px] font-bold bg-green-200 text-green-900 px-1.5 py-0.5 rounded-full">🎁 {discount.discount_percent}%</span>}
              {priorityBooking && <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded-full">Priority</span>}
            </div>
            <p className="text-neutral-500 mt-0.5">{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</p>
          </div>
          <div className="flex items-center gap-1 text-neutral-400">
            <GripVertical size={12} className="opacity-60" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openEditSlot(booking);
              }}
              className="w-8 h-8 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900 hover:text-neutral-900 transition"
              title="Edit slot"
            >
              <Edit3 size={13} />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <StatusBadge status={booking.status} />
          {discount && <span className="text-[11px] text-green-700 font-semibold">Rp {Number(discount.discount_amount || 0).toLocaleString('id-ID')} hemat</span>}
        </div>
      </div>
    );
  }

  function DropZone({ children, onDrop, className = '' }) {
    return (
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDrop();
        }}
        className={className}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {toast ? (
        <div className={`fixed right-4 top-4 z-[70] max-w-sm rounded-2xl px-4 py-3 text-sm text-white shadow-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Kalender</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Kalender Booking Venue</h1>
        <p className="text-neutral-500 text-sm mt-1">Weekly, monthly, drag-and-drop rebooking, dan cleanup expired booking otomatis.</p>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Field label="Tanggal">
              <input type="date" className={inputCls} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </Field>
            <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl">
              {Object.entries(VIEW_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${view === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton variant="outline" onClick={prevPeriod}>Sebelumnya</ActionButton>
            <ActionButton variant="outline" onClick={today}>Hari Ini</ActionButton>
            <ActionButton variant="outline" onClick={nextPeriod}>Berikutnya</ActionButton>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
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
          <div className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-3 col-span-full md:col-span-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">👑</div>
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Member Discount</p>
              <p className="text-2xl font-display text-neutral-900">{totalDiscountBookings}</p>
            </div>
          </div>
        </div>

        {view === 'day' && (
          <div className="space-y-4">
            {dayBookingsByCourt.map(({ court, bookings: courtBookings }) => (
              <div key={court.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-display text-2xl text-neutral-900">{court.name}</h2>
                    <p className="text-sm text-neutral-500">{court.sport_type} · Rp {Number(court.price_per_hour || 0).toLocaleString('id-ID')}/jam</p>
                  </div>
                  <StatusBadge status={court.status} />
                </div>
                {courtBookings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-sm text-neutral-500">Tidak ada booking untuk court ini pada tanggal {selectedDate}.</div>
                ) : (
                  <div className="space-y-2">
                    {courtBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {view === 'week' && (
          <div className="grid lg:grid-cols-7 gap-3">
            {visibleDays.map((day) => {
              const dayBookings = filteredBookings.filter((booking) => booking.booking_date === day);
              return (
                <DropZone
                  key={day}
                  onDrop={() => {
                    const booking = bookings.find((item) => item.id === dragBookingId);
                    if (booking) handleDrop(day, booking.court_id, booking);
                  }}
                  className="min-h-[140px] rounded-2xl border border-neutral-200 p-2 bg-white hover:border-neutral-400 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-xs font-black uppercase tracking-[0.18em] ${day === selectedDate ? 'text-emerald-600' : 'text-neutral-400'}`}>{formatShortDate(day)}</span>
                    <span className="text-[11px] text-neutral-400">{dayBookings.length}</span>
                  </div>
                  <div className="space-y-2">
                    {dayBookings.slice(0, 3).map((booking) => <BookingCard key={booking.id} booking={booking} compact />)}
                    {dayBookings.length > 3 && <div className="text-xs text-neutral-500 px-2">+{dayBookings.length - 3} booking lain</div>}
                  </div>
                </DropZone>
              );
            })}
          </div>
        )}

        {view === 'month' && (
          <div className="grid grid-cols-7 gap-3">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((label) => (
              <div key={label} className="text-xs font-bold uppercase tracking-widest text-neutral-400 px-2">{label}</div>
            ))}
            {monthGridDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="min-h-[120px] rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50" />;
              const dayBookings = monthBookingsByDate[day] || [];
              return (
                <div key={day} className={`min-h-[120px] rounded-2xl border p-3 ${day === selectedDate ? 'border-emerald-400 bg-emerald-50' : 'border-neutral-200 bg-white'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">{formatShortDate(day)}</span>
                    <span className="text-[11px] text-neutral-400">{dayBookings.length}</span>
                  </div>
                  <div className="space-y-2">
                    {dayBookings.slice(0, 2).map((booking) => <BookingCard key={booking.id} booking={booking} compact />)}
                    {dayBookings.length > 2 && <div className="text-xs text-neutral-500 px-2">+{dayBookings.length - 2} booking lain</div>}
                  </div>
                </div>
              );
            })}
          </div>
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
                Slot bentrok dengan booking {editConflict.customer_name} ({formatTime(editConflict.start_time)} - {formatTime(editConflict.end_time)}).
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Tanggal">
                <input type="date" className={inputCls} value={editForm.booking_date} onChange={(event) => setEditForm((current) => ({ ...current, booking_date: event.target.value }))} />
              </Field>
              <Field label="Court">
                <select className={selectCls} value={editForm.court_id} onChange={(event) => setEditForm((current) => ({ ...current, court_id: event.target.value }))}>
                  <option value="">Pilih court</option>
                  {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
                </select>
              </Field>
              <Field label="Jam Mulai">
                <input type="time" className={inputCls} value={editForm.start_time} onChange={(event) => setEditForm((current) => ({ ...current, start_time: event.target.value }))} />
              </Field>
              <Field label="Jam Selesai">
                <input type="time" className={inputCls} value={editForm.end_time} onChange={(event) => setEditForm((current) => ({ ...current, end_time: event.target.value }))} />
              </Field>
            </div>

            <div className="flex gap-2 justify-end">
              <ActionButton variant="outline" onClick={() => setEditingBooking(null)}>Batal</ActionButton>
              <ActionButton onClick={() => rescheduleBooking(editingBooking, editForm.booking_date, editForm.court_id, editForm.start_time, editForm.end_time)} loading={savingSlot}>Simpan Slot</ActionButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
