import React, { useState, useEffect, useCallback } from 'react';
import { Dumbbell, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, textareaCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const BOOKING_FILTER = ['all', 'pending', 'confirmed', 'cancelled', 'completed'];

export default function TrainingManagerPage({ auth, onBack, onNav }) {
  const [tab, setTab] = useState('coaches'); // coaches | bookings
  const [coaches, setCoaches] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState('pending');

  const [reviewTarget, setReviewTarget] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id,name,sport,exp,rating,sessions,price');
      const { data: programData } = await supabase
        .from('coach_programs')
        .select('coach_id,program_id,name,price,duration');

      const programMap = {};
      (programData || []).forEach((p) => {
        if (!programMap[p.coach_id]) programMap[p.coach_id] = [];
        programMap[p.coach_id].push(p);
      });

      setCoaches((coachData || []).map((c) => ({ ...c, programs: programMap[c.id] || [] })));
    } catch (err) {
      console.error('Training coaches load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('academy_trial_bookings')
        .select('id,user_id,academy_name,academy_city,participant_name,participant_age,trial_date,trial_time,contact_number,notes,status,created_at')
        .order('created_at', { ascending: false });
      if (bookingFilter !== 'all') q = q.eq('status', bookingFilter);
      const { data } = await q;
      setBookings(data || []);
    } catch (err) {
      console.error('Training bookings load error:', err);
    } finally {
      setLoading(false);
    }
  }, [bookingFilter]);

  useEffect(() => {
    if (tab === 'coaches') loadCoaches();
    else loadBookings();
  }, [tab, loadCoaches, loadBookings]);

  async function handleBookingAction(status) {
    if (!reviewTarget) return;
    setSaving(true);
    try {
      await supabase.from('academy_trial_bookings').update({ status, notes: adminNote.trim() || reviewTarget.notes }).eq('id', reviewTarget.id);
      setReviewTarget(null);
      setAdminNote('');
      loadBookings();
    } catch (err) {
      console.error('Booking action error:', err);
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ WORKSPACE — PELATIHAN"
      title={<>KELOLA<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>pelatihan.</span></>}
      subtitle="Kelola data pelatih, program, dan booking trial academy."
      onBack={onBack}
      breadcrumbs={[{ label: 'Workspace', onClick: () => onNav('workspace-console') }, { label: 'Kelola Pelatihan' }]}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit mb-6">
        {[['coaches', 'Pelatih'], ['bookings', 'Booking Trial']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* COACHES TAB */}
      {tab === 'coaches' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Pelatih" value={loading ? '—' : coaches.length} icon={Dumbbell} accent="emerald" />
            <StatCard label="Total Sesi" value={loading ? '—' : coaches.reduce((s, c) => s + (c.sessions || 0), 0)} icon={Users} accent="blue" />
            <StatCard label="Total Program" value={loading ? '—' : coaches.reduce((s, c) => s + (c.programs?.length || 0), 0)} icon={CheckCircle} accent="violet" />
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : coaches.length === 0 ? (
            <EmptyState icon={Dumbbell} title="Belum ada pelatih" description="Data pelatih akan muncul di sini." />
          ) : (
            <div className="space-y-3">
              {coaches.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl border border-neutral-200 bg-white">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-sm font-bold">
                      {c.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-900">{c.name}</div>
                      <div className="text-sm text-neutral-500">{c.sport} · {c.exp} pengalaman · ⭐ {c.rating}</div>
                      <div className="text-xs text-neutral-400 mt-1">Rp {c.price?.toLocaleString('id-ID')}/sesi · {c.sessions} total sesi</div>
                      {c.programs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {c.programs.map((p) => (
                            <span key={p.program_id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* BOOKINGS TAB */}
      {tab === 'bookings' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Pending" value={pendingCount} icon={Clock} accent="amber" />
            <StatCard label="Total Booking" value={bookings.length} icon={Dumbbell} accent="emerald" />
          </div>

          {/* Filter */}
          <div className="flex flex-wrap gap-2 mb-5">
            {BOOKING_FILTER.map((f) => (
              <button key={f} onClick={() => setBookingFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.14em] transition border ${bookingFilter === f ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'}`}>
                {f === 'all' ? 'Semua' : f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : bookings.length === 0 ? (
            <EmptyState icon={Dumbbell} title="Tidak ada booking" description="Belum ada booking trial dengan status ini." />
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b.id} className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-neutral-900">{b.participant_name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="text-sm text-neutral-500">{b.academy_name} · {b.academy_city}</div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {b.trial_date} · {b.trial_time} · Usia: {b.participant_age} tahun
                    </div>
                    {b.contact_number && <div className="text-xs text-neutral-400">{b.contact_number}</div>}
                    {b.notes && <div className="text-xs text-neutral-400 italic mt-0.5">"{b.notes}"</div>}
                  </div>
                  {b.status === 'pending' && (
                    <button onClick={() => { setReviewTarget(b); setAdminNote(''); }} className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition">
                      Tinjau
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* REVIEW MODAL */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Review Booking Trial">
        {reviewTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4 space-y-1">
              <div className="font-semibold text-neutral-900">{reviewTarget.participant_name}</div>
              <div className="text-sm text-neutral-500">{reviewTarget.academy_name} · {reviewTarget.trial_date} {reviewTarget.trial_time}</div>
              {reviewTarget.notes && <div className="text-xs text-neutral-400 italic">"{reviewTarget.notes}"</div>}
            </div>
            <Field label="Catatan (opsional)">
              <textarea className={textareaCls} rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Pesan untuk peserta..." />
            </Field>
            <div className="flex gap-2">
              <ActionButton onClick={() => handleBookingAction('confirmed')} loading={saving}>
                <CheckCircle size={14} /> Konfirmasi
              </ActionButton>
              <ActionButton variant="danger" onClick={() => handleBookingAction('cancelled')} loading={saving}>
                <XCircle size={14} /> Batalkan
              </ActionButton>
              <ActionButton variant="outline" onClick={() => handleBookingAction('completed')} loading={saving}>Selesai</ActionButton>
              <div className="ml-auto"><ActionButton variant="outline" onClick={() => setReviewTarget(null)}>Tutup</ActionButton></div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
