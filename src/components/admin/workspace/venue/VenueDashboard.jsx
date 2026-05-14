import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Clock3, CreditCard, Users2 } from 'lucide-react';
import { supabase } from '../../../../config/supabase.js';

const INITIAL_METRICS = {
  branches: 0,
  courts: 0,
  staff: 0,
  todayBookings: 0,
};

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
        const today = new Date().toISOString().slice(0, 10);
        const [branchResult, courtResult, staffResult, bookingResult] = await Promise.all([
          supabase.from('venue_branches').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id),
          supabase.from('venue_courts').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id),
          supabase.from('venue_staff').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id).eq('status', 'active'),
          supabase.from('venue_bookings').select('*', { count: 'exact', head: true }).eq('venue_id', venue.id).eq('booking_date', today),
        ]);

        setMetrics({
          branches: branchResult.error ? 0 : Number(branchResult.count || 0),
          courts: courtResult.error ? 0 : Number(courtResult.count || 0),
          staff: staffResult.error ? 0 : Number(staffResult.count || 0),
          todayBookings: bookingResult.error ? 0 : Number(bookingResult.count || 0),
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
          {[
            { label: 'Revenue Hari Ini', value: 'Segera hadir', note: 'Akan aktif saat POS dan pembayaran venue tersedia.', icon: CreditCard },
            { label: 'Occupancy Rate', value: 'Segera hadir', note: 'Akan dihitung dari booking dan kalender venue.', icon: CalendarClock },
            { label: 'Peak Hour', value: 'Segera hadir', note: 'Akan muncul setelah data booking venue terkumpul.', icon: Clock3 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-3xl border border-neutral-200 bg-white p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{item.label}</p>
                    <p className="text-xs text-neutral-400 uppercase tracking-wide">Upcoming widget</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-500">{item.note}</p>
                <div className="mt-4 text-lg font-display text-neutral-900">{item.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
