import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle, X, Clock, Filter } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, inputCls, textareaCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const FILTER_OPTIONS = ['all', 'pending', 'resolved', 'dismissed', 'escalated'];

export default function ModerationPage({ auth, onBack, onNav }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('moderation_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      setReports(data || []);
    } catch (err) {
      console.error('ModerationPage load error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(status) {
    if (!selectedReport) return;
    setSaving(true);
    try {
      await supabase.from('moderation_reports').update({
        status,
        admin_notes: adminNotes.trim() || null,
        reviewed_by: auth?.id || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', selectedReport.id);
      setSelectedReport(null);
      setAdminNotes('');
      load();
    } catch (err) {
      console.error('Moderation action error:', err);
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    pending: reports.filter((r) => r.status === 'pending').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    dismissed: reports.filter((r) => r.status === 'dismissed').length,
  };

  const contentTypeLabel = {
    post: 'Postingan', community: 'Komunitas', news: 'Berita', user: 'Pengguna', comment: 'Komentar',
  };

  return (
    <AdminLayout
      variant="platform"
      kicker="/ PLATFORM — MODERASI"
      title={<>MODERASI<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>& konten.</span></>}
      subtitle="Tinjau laporan konten dari pengguna, ambil tindakan resolve atau dismiss."
      onBack={onBack}
      breadcrumbs={[{ label: 'Platform Console', onClick: () => onNav('platform-console') }, { label: 'Moderasi' }]}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending Review" value={loading ? '—' : counts.pending} icon={Clock} accent="amber" />
        <StatCard label="Resolved" value={loading ? '—' : counts.resolved} icon={CheckCircle} accent="emerald" />
        <StatCard label="Dismissed" value={loading ? '—' : counts.dismissed} icon={X} accent="neutral" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter size={14} className="text-neutral-400" />
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.14em] transition border
              ${filter === f
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'}`}
          >
            {f === 'all' ? 'Semua' : f}
          </button>
        ))}
      </div>

      {/* Report list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={filter === 'pending' ? 'Tidak ada laporan pending' : 'Tidak ada laporan'}
          description="Semua laporan sudah ditindaklanjuti atau belum ada laporan masuk."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] uppercase tracking-[0.14em] font-black text-neutral-400">
                    {contentTypeLabel[report.content_type] || report.content_type}
                  </span>
                  <StatusBadge status={report.status} />
                </div>
                <div className="font-semibold text-neutral-900 text-sm">{report.reason}</div>
                {report.content_preview && (
                  <div className="text-xs text-neutral-500 mt-0.5 truncate">"{report.content_preview}"</div>
                )}
                {report.admin_notes && (
                  <div className="text-xs text-neutral-400 mt-1 italic">Catatan: {report.admin_notes}</div>
                )}
                <div className="text-xs text-neutral-400 mt-1">
                  {new Date(report.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {report.reviewed_at && ` · Ditinjau ${new Date(report.reviewed_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`}
                </div>
              </div>
              {report.status === 'pending' && (
                <button
                  onClick={() => { setSelectedReport(report); setAdminNotes(''); }}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition"
                >
                  Tinjau
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal open={!!selectedReport} onClose={() => setSelectedReport(null)} title="Tinjau Laporan">
        {selectedReport && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Tipe Konten</div>
              <div className="font-semibold text-neutral-900">{contentTypeLabel[selectedReport.content_type] || selectedReport.content_type} (ID: {selectedReport.content_id})</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] font-black text-amber-600 mb-1">Alasan Laporan</div>
              <div className="text-sm text-amber-900">{selectedReport.reason}</div>
              {selectedReport.content_preview && (
                <div className="text-xs text-amber-700 mt-2 italic">"{selectedReport.content_preview}"</div>
              )}
            </div>
            <Field label="Catatan Admin (opsional)">
              <textarea
                className={textareaCls}
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Tulis catatan tindakan yang diambil..."
              />
            </Field>
            <div className="flex gap-2 flex-wrap">
              <ActionButton onClick={() => handleAction('resolved')} loading={saving}>
                <CheckCircle size={14} /> Resolve
              </ActionButton>
              <ActionButton variant="outline" onClick={() => handleAction('escalated')} loading={saving}>
                <AlertCircle size={14} /> Eskalasi
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => handleAction('dismissed')} loading={saving}>
                <X size={14} /> Dismiss
              </ActionButton>
              <div className="ml-auto">
                <ActionButton variant="outline" onClick={() => setSelectedReport(null)}>Batal</ActionButton>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
