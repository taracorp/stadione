import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle, Clock, Activity, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import AdminLayout, { ActionButton, StatCard, EmptyState, StatusBadge } from '../AdminLayout.jsx';
import { fetchOfficialAssignments, updateOfficialAssignmentStatus } from '../../../services/supabaseService.js';
import { getOfficialMatchCapabilities } from '../../../utils/permissions.js';

const FILTERS = ['all', 'assigned', 'confirmed', 'completed', 'cancelled'];

export default function OfficialSchedulePage({ auth, onBack, onNav }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const load = useCallback(async () => {
    if (!auth?.id) return;
    setLoading(true);
    setError('');
    try {
      const assignData = await fetchOfficialAssignments({ userId: auth.id, status: filter, throwOnError: true });
      setAssignments(assignData);
      setSelectedId((prevSelectedId) => {
        if (assignData.length === 0) return null;
        if (prevSelectedId && assignData.some((item) => item.id === prevSelectedId)) return prevSelectedId;
        return assignData[0].id;
      });
    } catch (err) {
      console.error('OfficialSchedule load error:', err);
      setAssignments([]);
      setSelectedId(null);
      setError('Gagal memuat jadwal assignment dari server. Coba lagi beberapa saat.');
    } finally {
      setLoading(false);
    }
  }, [auth, filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(assignment, status) {
    if (!assignment?.id || !auth?.id) return;

    setActionLoading(true);
    setActionMessage(null);
    try {
      await updateOfficialAssignmentStatus({ assignmentId: assignment.id, userId: auth.id, status, throwOnError: true });
      setActionMessage({ type: 'success', text: `Status assignment diperbarui menjadi ${status}.` });
      await load();
    } catch (err) {
      console.error('OfficialSchedule status update error:', err);
      setActionMessage({ type: 'error', text: 'Gagal memperbarui status assignment. Silakan coba ulang.' });
    } finally {
      setActionLoading(false);
    }
  }

  const upcoming = assignments.filter((a) => ['assigned', 'confirmed'].includes(a.status)).length;
  const completed = assignments.filter((a) => a.status === 'completed').length;
  const selectedAssignment = assignments.find((item) => item.id === selectedId) || null;
  const selectedCaps = getOfficialMatchCapabilities({
    userRoles: auth?.roles || [],
    assignmentRole: selectedAssignment?.role,
  });

  const roleColors = {
    referee: 'bg-violet-100 text-violet-700',
    assistant_referee: 'bg-blue-100 text-blue-700',
    match_commissioner: 'bg-amber-100 text-amber-700',
    match_official: 'bg-emerald-100 text-emerald-700',
    statistic_operator: 'bg-pink-100 text-pink-700',
    venue_officer: 'bg-neutral-100 text-neutral-700',
    timekeeper: 'bg-red-100 text-red-700',
  };

  const sourceColors = {
    Tournament: 'bg-neutral-900 text-white',
    'Venue Tournament': 'bg-emerald-100 text-emerald-700',
  };

  if (!auth?.id) {
    return (
      <AdminLayout
        variant="official"
        kicker="/ OFFICIAL — JADWAL"
        title={<>JADWAL<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>pertandingan.</span></>}
        subtitle="Semua penugasan pertandingan Anda. Konfirmasi kehadiran dan buka Match Center."
        onBack={onBack}
        breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal' }]}
      >
        <EmptyState
          icon={Calendar}
          title="Masuk dulu"
          description="Jadwal official hanya tampil untuk akun yang sudah login dan memiliki penugasan."
          action={<ActionButton onClick={() => onNav('profile')}>Ke Profil</ActionButton>}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      variant="official"
      kicker="/ OFFICIAL — JADWAL"
      title={<>JADWAL<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>pertandingan.</span></>}
      subtitle="Semua penugasan pertandingan Anda. Konfirmasi kehadiran dan buka Match Center."
      onBack={onBack}
      breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal' }]}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Akan Datang" value={loading ? '—' : upcoming} icon={Clock} accent="blue" />
        <StatCard label="Selesai" value={loading ? '—' : completed} icon={CheckCircle} accent="emerald" />
        <StatCard label="Total Penugasan" value={loading ? '—' : assignments.length} icon={Calendar} accent="violet" />
      </div>

      {actionMessage && (
        <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${actionMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {actionMessage.text}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.14em] transition border ${filter === f ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'}`}>
            {f === 'all' ? 'Semua' : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Jadwal belum bisa dimuat"
          description={error}
          action={(
            <ActionButton variant="outline" onClick={load}>
              <RefreshCw size={14} /> Muat Ulang
            </ActionButton>
          )}
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Belum ada penugasan"
          description={filter === 'all' ? 'Anda belum mendapat penugasan pertandingan dari operator tournament.' : `Tidak ada penugasan dengan status "${filter}".`}
        />
      ) : (
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-3">
            {assignments.map((a) => {
              const isSelected = a.id === selectedId;
              const rowCaps = getOfficialMatchCapabilities({ userRoles: auth?.roles || [], assignmentRole: a.role });
              const canOpenCenter = rowCaps.openMatchCenter && a.source_ready !== false && ['assigned', 'confirmed', 'completed'].includes(a.status);

              return (
                <div key={a.id} className={`p-4 rounded-2xl border bg-white transition ${isSelected ? 'border-neutral-900 shadow-sm' : 'border-neutral-200 hover:border-neutral-300'}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Activity size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-neutral-900">{a.tournament_name}</span>
                        <StatusBadge status={a.status} />
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${sourceColors[a.source_label] || 'bg-neutral-100 text-neutral-600'}`}>
                          {a.source_label || 'Tournament'}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] ${roleColors[a.role] || 'bg-neutral-100 text-neutral-600'}`}>
                          {a.role?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-500">{a.tournament_sport} · Match {a.match_entry_id}</div>
                      {a.round_name && <div className="text-xs text-neutral-400 mt-0.5">{a.round_name}</div>}
                      {a.venue && <div className="text-xs text-neutral-400 mt-0.5"><Calendar size={10} className="inline mr-1" />{a.venue}</div>}
                      {a.notes && <div className="text-xs text-neutral-400 italic mt-0.5">"{a.notes}"</div>}
                      {a.source_ready === false && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
                          Assignment venue tournament sudah tampil di official workspace. Match Center detail masih mengikuti engine tournament utama.
                        </div>
                      )}
                      <div className="text-xs text-neutral-400 mt-1">
                        Ditugaskan {new Date(a.assigned_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      <button onClick={() => setSelectedId(a.id)} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-neutral-300 hover:border-neutral-900 transition">
                        Detail
                      </button>
                      {canOpenCenter && (
                        <button
                          onClick={() => onNav('match-center', { assignmentId: a.id, tournamentId: a.tournament_id, matchEntryId: a.match_entry_id, assignmentRole: a.role, assignmentStatus: a.status, tournamentName: a.tournament_name })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition"
                        >
                          Match Center <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 h-fit lg:sticky lg:top-20">
            {!selectedAssignment ? (
              <EmptyState
                icon={Calendar}
                title="Pilih assignment"
                description="Klik salah satu assignment untuk melihat detail, role aktif, dan aksi lanjutan."
              />
            ) : (
              <>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400 mb-1">Detail Assignment</div>
                <div className="font-display text-2xl text-neutral-900 mb-2">{selectedAssignment.tournament_name}</div>
                <div className="text-sm text-neutral-500 mb-4">Match {selectedAssignment.match_entry_id} · {selectedAssignment.tournament_sport || 'Sport'}</div>

                <div className="space-y-3 text-sm">
                  <div className="rounded-2xl border border-neutral-200 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Source</div>
                    <div className="font-semibold text-neutral-800">{selectedAssignment.source_label || 'Tournament'}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Status</div>
                    <StatusBadge status={selectedAssignment.status} />
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Peran Assignment</div>
                    <div className="font-semibold text-neutral-800">{selectedAssignment.role?.replace(/_/g, ' ') || '-'}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Venue</div>
                    <div className="font-semibold text-neutral-800">{selectedAssignment.venue || 'Belum diisi'}</div>
                  </div>
                  {selectedAssignment.round_name && (
                    <div className="rounded-2xl border border-neutral-200 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Ronde</div>
                      <div className="font-semibold text-neutral-800">{selectedAssignment.round_name}</div>
                    </div>
                  )}
                  {selectedAssignment.notes && (
                    <div className="rounded-2xl border border-neutral-200 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Catatan Operator</div>
                      <div className="text-neutral-700">{selectedAssignment.notes}</div>
                    </div>
                  )}
                  {selectedAssignment.source_ready === false && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                      Assignment dari venue tournament sudah masuk ke daftar official. Integrasi Match Center detail masih menunggu penyatuan engine event, lineup, dan report lintas source.
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-2">
                  {selectedAssignment.status === 'assigned' && (
                    <ActionButton onClick={() => updateStatus(selectedAssignment, 'confirmed')} loading={actionLoading}>
                      Konfirmasi Penugasan
                    </ActionButton>
                  )}

                  {['assigned', 'confirmed', 'completed'].includes(selectedAssignment.status) && selectedCaps.openMatchCenter && selectedAssignment.source_ready !== false && (
                    <ActionButton
                      variant="outline"
                      onClick={() => onNav('match-center', {
                        assignmentId: selectedAssignment.id,
                        tournamentId: selectedAssignment.tournament_id,
                        matchEntryId: selectedAssignment.match_entry_id,
                        assignmentRole: selectedAssignment.role,
                        assignmentStatus: selectedAssignment.status,
                        tournamentName: selectedAssignment.tournament_name,
                      })}
                    >
                      Buka Match Center <ChevronRight size={14} />
                    </ActionButton>
                  )}

                  {selectedAssignment.status === 'confirmed' && selectedCaps.finalizeAssignment && (
                    <ActionButton variant="outline" onClick={() => updateStatus(selectedAssignment, 'completed')} loading={actionLoading}>
                      Tandai Completed
                    </ActionButton>
                  )}

                  {selectedAssignment.status === 'assigned' && (
                    <ActionButton variant="ghost" onClick={() => updateStatus(selectedAssignment, 'declined')} loading={actionLoading}>
                      Tolak Assignment
                    </ActionButton>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
