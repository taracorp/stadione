import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Clock3, CreditCard, Users2 } from 'lucide-react';
import { supabase } from '../../../../config/supabase.js';

const ACTIVE_OCCUPANCY_STATUSES = ['pending', 'confirmed', 'checked-in', 'completed'];
const OPERATING_HOURS_PER_DAY = 16;

const INITIAL_METRICS = {
  branches: 0,
  courts: 0,
  staff: 0,
  todayBookings: 0,
  todayRevenue: 0,
  monthRevenue: 0,
  occupancyToday: 0,
  occupancyTrend: [],
  peakHourLabel: 'Belum ada data',
  peakHourBookings: 0,
  peakHourTop: [],
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toMoney(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function toPct(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function timeToMinutes(value) {
  if (!value) return 0;
  const str = String(value);
  const parts = str.split(':');
  const hour = Number(parts[0] || 0);
  const minute = Number(parts[1] || 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
  return (hour * 60) + minute;
}

function normalizeHour(hour) {
  const h = Number(hour || 0);
  if (Number.isNaN(h)) return 0;
  return Math.max(0, Math.min(23, h));
}

function formatHourLabel(hour) {
  const start = normalizeHour(hour);
  const end = (start + 1) % 24;
  return `${String(start).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00`;
}

function calcOccupancyPercent(bookedMinutes, courtsCount) {
  const safeCourts = Math.max(1, Number(courtsCount || 0));
  const totalMinutes = safeCourts * OPERATING_HOURS_PER_DAY * 60;
  if (!totalMinutes) return 0;
  return Math.min(100, (Number(bookedMinutes || 0) / totalMinutes) * 100);
}

function computeAnalytics(bookings, courtsCount, today) {
  const todayDate = new Date(today);
  const todayKey = isoDate(todayDate);
  const monthStartKey = isoDate(startOfMonth(todayDate));

  const paidBookings = bookings.filter((booking) => booking.payment_status === 'paid');
  const todayRevenue = paidBookings
    .filter((booking) => booking.booking_date === todayKey)
    .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
  const monthRevenue = paidBookings
    .filter((booking) => booking.booking_date >= monthStartKey && booking.booking_date <= todayKey)
    .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);

  const occupancyBookings = bookings.filter((booking) => ACTIVE_OCCUPANCY_STATUSES.includes(String(booking.status || '').toLowerCase()));
  const todayBookedMinutes = occupancyBookings
    .filter((booking) => booking.booking_date === todayKey)
    .reduce((sum, booking) => {
      const start = timeToMinutes(booking.start_time);
      const end = timeToMinutes(booking.end_time);
      return sum + Math.max(end - start, 0);
    }, 0);

  const occupancyToday = calcOccupancyPercent(todayBookedMinutes, courtsCount);
  const occupancyTrend = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDays(todayDate, -offset);
    const key = isoDate(date);
    const bookedMinutes = occupancyBookings
      .filter((booking) => booking.booking_date === key)
      .reduce((sum, booking) => {
        const start = timeToMinutes(booking.start_time);
        const end = timeToMinutes(booking.end_time);
        return sum + Math.max(end - start, 0);
      }, 0);
    occupancyTrend.push({
      key,
      shortLabel: date.toLocaleDateString('id-ID', { weekday: 'short' }),
      occupancy: calcOccupancyPercent(bookedMinutes, courtsCount),
    });
  }

  const hourCounter = Array.from({ length: 24 }, () => 0);
  occupancyBookings.forEach((booking) => {
    const start = Math.max(0, Math.floor(timeToMinutes(booking.start_time) / 60));
    const endRaw = Math.ceil(timeToMinutes(booking.end_time) / 60);
    const end = Math.min(24, Math.max(start + 1, endRaw));
    for (let hour = start; hour < end; hour += 1) {
      hourCounter[hour] += 1;
    }
  });

  const topHours = hourCounter
    .map((count, hour) => ({ hour, count, label: formatHourLabel(hour) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    todayRevenue,
    monthRevenue,
    occupancyToday,
    occupancyTrend,
    peakHourLabel: topHours[0]?.label || 'Belum ada data',
    peakHourBookings: topHours[0]?.count || 0,
    peakHourTop: topHours,
  };
}

export default function VenueDashboard({ auth, venue, onNav }) {
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      if (!supabase || !venue?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const today = isoDate(new Date());
        const monthStart = isoDate(startOfMonth(new Date()));
        const [branchResult, courtResult, staffResult, bookingResult, analyticsBookingResult] = await Promise.all([
          supabase.from('venue_branches').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id),
          supabase.from('venue_courts').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id),
          supabase.from('venue_staff').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id).eq('status', 'active'),
          supabase.from('venue_bookings').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id).eq('booking_date', today),
          supabase
            .from('venue_bookings')
            .select('booking_date, start_time, end_time, total_price, payment_status, status')
            .eq('venue_id', venue.id)
            .gte('booking_date', monthStart)
            .lte('booking_date', today),
        ]);

        const courtsCount = courtResult.error ? 0 : Number(courtResult.count || 0);
        const analytics = computeAnalytics(analyticsBookingResult.data || [], courtsCount, new Date());

        setMetrics({
          branches: branchResult.error ? 0 : Number(branchResult.count || 0),
          courts: courtsCount,
          staff: staffResult.error ? 0 : Number(staffResult.count || 0),
          todayBookings: bookingResult.error ? 0 : Number(bookingResult.count || 0),
          todayRevenue: analytics.todayRevenue,
          monthRevenue: analytics.monthRevenue,
          occupancyToday: analytics.occupancyToday,
          occupancyTrend: analytics.occupancyTrend,
          peakHourLabel: analytics.peakHourLabel,
          peakHourBookings: analytics.peakHourBookings,
          peakHourTop: analytics.peakHourTop,
        });
      } catch (error) {
        console.error('VenueDashboard metrics error:', error.message);
        setMetrics(INITIAL_METRICS);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [venue?.id]);

  const setupSteps = useMemo(() => ([
    {
      key: 'branches',
      label: 'Tambah cabang',
      description: 'Buat branch utama venue agar operasional bisa dipisah per lokasi.',
      done: metrics.branches > 0,
      action: () => onNav('settings'),
    },
    {
      key: 'courts',
      label: 'Tambah lapangan',
      description: 'Daftarkan court atau field agar kalender dan booking bisa aktif.',
      done: metrics.courts > 0,
      action: () => onNav('courts'),
    },
    {
      key: 'staff',
      label: 'Undang staf',
      description: 'Tambahkan owner, manager, cashier, atau staff sesuai kebutuhan venue.',
      done: metrics.staff > 0,
      action: () => onNav('staff'),
    },
  ]), [metrics.branches, metrics.courts, metrics.staff, onNav]);

  const completionCount = setupSteps.filter((step) => step.done).length;
  const verificationTone = venue?.verification_status === 'verified'
    ? {
        wrapper: 'border-emerald-200 bg-emerald-50',
        title: 'text-emerald-800',
        body: 'text-emerald-700',
        icon: CheckCircle2,
        headline: 'Venue sudah terverifikasi',
        text: 'Venue Anda aktif dan siap dipakai untuk menyiapkan branch, court, dan staf.',
      }
    : venue?.verification_status === 'pending'
      ? {
          wrapper: 'border-amber-200 bg-amber-50',
          title: 'text-amber-800',
          body: 'text-amber-700',
          icon: Clock3,
          headline: 'Venue sedang direview',
          text: 'Dokumen Anda sedang ditinjau oleh tim kami. Sambil menunggu, Anda bisa menyiapkan struktur operasional venue.',
        }
      : {
          wrapper: 'border-red-200 bg-red-50',
          title: 'text-red-800',
          body: 'text-red-700',
          icon: CircleAlert,
          headline: 'Venue belum terverifikasi',
          text: 'Lengkapi registrasi dan dokumen verifikasi agar Venue OS dapat diaktifkan penuh.',
        };
  const VerificationIcon = verificationTone.icon;

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Dashboard</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900 leading-tight">
          {venue?.name || 'Venue Saya'}
        </h1>
        <p className="text-neutral-500 mt-1">Ringkasan operasional venue hari ini.</p>
      </div>

      <div className={`rounded-3xl border p-5 mb-6 ${verificationTone.wrapper}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center flex-shrink-0">
            <VerificationIcon size={22} className={verificationTone.title} />
          </div>
          <div>
            <p className={`font-semibold mb-1 ${verificationTone.title}`}>{verificationTone.headline}</p>
            <p className={`text-sm ${verificationTone.body}`}>{verificationTone.text}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Setup Wizard</p>
                <h2 className="font-display text-3xl text-neutral-900">Aktivasi Venue OS</h2>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Progress</div>
                <div className="font-display text-3xl text-neutral-900">{completionCount}/3</div>
              </div>
            </div>

            <div className="space-y-3">
              {setupSteps.map((step, index) => (
                <button
                  key={step.key}
                  onClick={step.action}
                  className="w-full text-left rounded-2xl border border-neutral-200 bg-neutral-50 hover:bg-white hover:border-neutral-300 transition p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${step.done ? 'bg-emerald-600 text-white' : 'bg-white text-neutral-500 border border-neutral-200'}`}>
                      {step.done ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-neutral-900">{step.label}</span>
                        <span className={`text-[10px] uppercase tracking-[0.18em] font-bold ${step.done ? 'text-emerald-600' : 'text-neutral-400'}`}>
                          {step.done ? 'Selesai' : 'Perlu tindakan'}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500">{step.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Cabang', value: loading ? '—' : metrics.branches, note: 'Venue branches', icon: Users2 },
              { label: 'Lapangan', value: loading ? '—' : metrics.courts, note: 'Court aktif', icon: CheckCircle2 },
              { label: 'Staf Aktif', value: loading ? '—' : metrics.staff, note: 'Akun venue staff', icon: Users2 },
              { label: 'Booking Hari Ini', value: loading ? '—' : metrics.todayBookings, note: 'Jadwal venue', icon: CalendarClock },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4">
                    <Icon size={16} />
                  </div>
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">{item.label}</p>
                  <p className="text-3xl font-display text-neutral-900">{item.value}</p>
                  <p className="text-xs text-neutral-400 mt-1">{item.note}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Financial Report</p>
                <p className="text-xs text-neutral-400 uppercase tracking-wide">Daily + Monthly Revenue</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Hari ini</p>
                <p className="text-lg font-display text-neutral-900">{loading ? '—' : toMoney(metrics.todayRevenue)}</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Bulan ini</p>
                <p className="text-lg font-display text-neutral-900">{loading ? '—' : toMoney(metrics.monthRevenue)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarClock size={18} />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Occupancy Analytics</p>
                <p className="text-xs text-neutral-400 uppercase tracking-wide">Trend 7 Hari</p>
              </div>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <p className="text-3xl font-display text-neutral-900">{loading ? '—' : toPct(metrics.occupancyToday)}</p>
              <p className="text-xs text-neutral-500 mb-1">utilisasi hari ini</p>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {(metrics.occupancyTrend || []).map((point) => (
                <div key={point.key} className="flex flex-col items-center gap-1">
                  <div className="w-full h-16 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-end">
                    <div className="w-full bg-emerald-500" style={{ height: `${Math.max(5, Math.min(100, Math.round(point.occupancy)))}%` }} />
                  </div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{point.shortLabel}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Clock3 size={18} />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">Peak Hour Analysis</p>
                <p className="text-xs text-neutral-400 uppercase tracking-wide">Jam terpadat bulan berjalan</p>
              </div>
            </div>
            <p className="text-2xl font-display text-neutral-900">{loading ? '—' : metrics.peakHourLabel}</p>
            <p className="text-sm text-neutral-500 mt-1">
              {loading ? 'Memuat data sesi...' : `${metrics.peakHourBookings} sesi booking pada jam puncak.`}
            </p>
            <div className="mt-3 space-y-2">
              {(metrics.peakHourTop || []).slice(0, 3).map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <p className="text-sm text-neutral-700">{row.label}</p>
                  <p className="text-sm font-semibold text-neutral-900">{row.count} sesi</p>
                </div>
              ))}
              {!loading && (!metrics.peakHourTop || metrics.peakHourTop.length === 0) && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                  Belum ada data booking untuk dianalisis.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
