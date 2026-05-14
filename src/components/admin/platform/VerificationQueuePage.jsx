import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, ShieldCheck, XCircle } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, Modal, StatCard, StatusBadge, textareaCls } from '../AdminLayout.jsx';
import {
  fetchCurrentUserPermissions,
  fetchVerificationQueue,
  fetchVenueVerificationQueue,
  reviewTournamentVerificationRequest,
  reviewVenueVerificationRequest,
} from '../../../services/supabaseService.js';
import { canAccessFeature } from '../../../utils/permissions.js';

export default function VerificationQueuePage({ auth, onBack, onNav }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueFilter, setQueueFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const permissions = await fetchCurrentUserPermissions();
      const canReview = canAccessFeature(permissions, 'reviewVerificationQueue');
      setAllowed(canReview);

      if (!canReview) {
        setQueue([]);
        return;
      }

      const [tournamentQueue, venueQueue] = await Promise.all([
        fetchVerificationQueue(),
        fetchVenueVerificationQueue(),
      ]);

      const normalizedTournamentQueue = (tournamentQueue || []).map((item) => ({
        ...item,
        queueType: 'tournament',
      }));
      const normalizedVenueQueue = (venueQueue || []).map((item) => ({
        ...item,
        queueType: 'venue',
        venue_name: item.venues?.name || 'Venue',
        venue_city: item.venues?.city || '-',
      }));

      setQueue([...normalizedVenueQueue, ...normalizedTournamentQueue]);
    } catch (err) {
      console.error('VerificationQueuePage load error:', err);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReview(decision) {
    if (!selected) return;

    setSaving(true);
    try {
      const ok = selected.queueType === 'venue'
        ? await reviewVenueVerificationRequest({
            requestId: selected.id,
            venueId: selected.venue_id,
            decision,
            reviewerId: auth?.id,
            adminNotes,
          })
        : await reviewTournamentVerificationRequest({
            requestId: selected.id,
            tournamentId: selected.tournament_id,
            decision,
            reviewerId: auth?.id,
            adminNotes,
            operatorType: selected.operator_type,
            requestedClassification: selected.requested_classification,
          });

      if (!ok) return;

      setSelected(null);
      setAdminNotes('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = queue.filter((item) => item.status === 'pending').length;
  const reviewCount = queue.filter((item) => item.status === 'under_review').length;
  const venueCount = queue.filter((item) => item.queueType === 'venue').length;
  const operatorCount = queue.filter((item) => item.queueType === 'tournament').length;
  const filteredQueue = queueFilter === 'all'
    ? queue
    : queue.filter((item) => item.queueType === queueFilter);

  return (
    <AdminLayout
      variant="platform"
      kicker="/ PLATFORM — VERIFIKASI"
      title={<>VERIFIKASI<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>workspace.</span></>}
      subtitle="Tinjau request verifikasi operator dan venue dari satu queue platform."
      onBack={onBack}
      breadcrumbs={[{ label: 'Platform Console', onClick: () => onNav('platform-console') }, { label: 'Verifikasi' }]}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pending" value={loading ? '—' : pendingCount} icon={Clock} accent="amber" />
        <StatCard label="Under Review" value={loading ? '—' : reviewCount} icon={ShieldCheck} accent="blue" />
        <StatCard label="Venue Queue" value={loading ? '—' : venueCount} icon={ShieldCheck} accent="emerald" />
        <StatCard label="Total Queue" value={loading ? '—' : queue.length} icon={CheckCircle} accent="violet" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'Semua', count: queue.length },
          { key: 'venue', label: 'Venue', count: venueCount },
          { key: 'tournament', label: 'Operator', count: operatorCount },
        ].map((tab) => {
          const active = queueFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setQueueFilter(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
            >
              {tab.label} <span className={`ml-1 text-xs ${active ? 'text-white/80' : 'text-neutral-400'}`}>({tab.count})</span>
            </button>
          );
        })}
      </div>

      {!loading && !allowed ? (
        <EmptyState
          icon={ShieldCheck}
          title="Akses tidak tersedia"
          description="Akun ini belum memiliki izin untuk membuka queue verifikasi operator."
        />
      ) : loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, index) => <div key={index} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : filteredQueue.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="Queue kosong"
          description={queueFilter === 'all'
            ? 'Tidak ada request verifikasi yang menunggu review saat ini.'
            : `Tidak ada request tipe ${queueFilter === 'venue' ? 'venue' : 'operator'} saat ini.`}
        />
      ) : (
        <div className="space-y-3">
          {filteredQueue.map((item) => (
            <div key={`${item.queueType}-${item.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-neutral-900">{item.venue_name || item.organization_name || item.requester_name || 'Operator'}</span>
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-neutral-400">
                      {item.queueType === 'venue' ? 'Venue' : 'Operator'}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-500">
                    {item.queueType === 'venue'
                      ? `${item.verification_type || 'individual'} · ${item.venue_city || '-'}`
                      : `${item.operator_type || 'operator'} · ${item.requester_email || '-'}`}
                  </div>
                  {item.tournament_name && <div className="text-xs text-neutral-400 mt-1">Turnamen: {item.tournament_name}</div>}
                  {item.queueType === 'venue' && <div className="text-xs text-neutral-400 mt-1">Venue ID: {item.venue_id}</div>}
                  {item.notes && <div className="text-xs text-neutral-400 mt-1 italic">"{item.notes}"</div>}
                </div>
                <ActionButton size="sm" onClick={() => { setSelected(item); setAdminNotes(item.admin_notes || item.notes || ''); }}>
                  Review
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.queueType === 'venue' ? 'Review Verifikasi Venue' : 'Review Verifikasi Operator'}>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="font-semibold text-neutral-900">{selected.venue_name || selected.organization_name || selected.requester_name || 'Operator'}</div>
              <div className="text-sm text-neutral-500 mt-1">
                {selected.queueType === 'venue'
                  ? `${selected.verification_type || 'individual'} · ${selected.venue_city || '-'}`
                  : `${selected.operator_type || 'operator'} · ${selected.requester_email || '-'}`}
              </div>
            </div>
            <Field label="Catatan Admin">
              <textarea
                className={textareaCls}
                rows={4}
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                placeholder="Tuliskan alasan approval atau rejection..."
              />
            </Field>
            <div className="flex gap-2 flex-wrap">
              <ActionButton onClick={() => handleReview('approved')} loading={saving}>
                <CheckCircle size={14} /> Approve
              </ActionButton>
              <ActionButton variant="danger" onClick={() => handleReview('rejected')} loading={saving}>
                <XCircle size={14} /> Reject
              </ActionButton>
              <div className="ml-auto">
                <ActionButton variant="outline" onClick={() => setSelected(null)}>Tutup</ActionButton>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}