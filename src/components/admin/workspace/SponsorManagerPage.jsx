import React, { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Edit3, Trash2, Check, AlertCircle } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, inputCls, textareaCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const CATEGORIES = ['Title Sponsor', 'Official Sponsor', 'Media Partner', 'Supporting Partner', 'General'];
const STATUS_OPTIONS = ['active', 'inactive', 'pending', 'expired'];
const PARTNERSHIP_REVIEW_STATUS = ['pending', 'reviewing', 'approved', 'rejected', 'on_hold'];

const EMPTY_FORM = {
  name: '', category: 'Official Sponsor', website: '', contact_name: '', contact_email: '',
  status: 'active', contract_start: '', contract_end: '', notes: '', logo_url: '',
};

export default function SponsorManagerPage({ auth, onBack, onNav }) {
  const [sponsors, setSponsors] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewSavingId, setReviewSavingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('sponsors')
        .select('id,name,logo_url,category,website,contact_name,contact_email,status,contract_start,contract_end,notes,created_at')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);

      const [{ data: sponsorData }, { data: appData }] = await Promise.all([
        q,
        supabase
          .from('partnership_applications')
          .select('id,type,status,applicant_name,applicant_email,applicant_phone,details,created_at,admin_notes')
          .order('created_at', { ascending: false })
          .limit(80),
      ]);

      setSponsors(sponsorData || []);
      setApplications(appData || []);
    } catch (err) {
      console.error('Sponsor load error:', err);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditTarget(s);
    setForm({
      name: s.name || '',
      category: s.category || 'Official Sponsor',
      website: s.website || '',
      contact_name: s.contact_name || '',
      contact_email: s.contact_email || '',
      status: s.status || 'active',
      contract_start: s.contract_start || '',
      contract_end: s.contract_end || '',
      notes: s.notes || '',
      logo_url: s.logo_url || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        website: form.website.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        status: form.status,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        notes: form.notes.trim() || null,
        logo_url: form.logo_url.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editTarget) {
        await supabase.from('sponsors').update(payload).eq('id', editTarget.id);
      } else {
        await supabase.from('sponsors').insert({ ...payload, created_by: auth?.id || null });
      }
      setShowForm(false);
      load();
    } catch (err) {
      console.error('Sponsor save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('sponsors').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  async function handleReviewStatus(applicationId, status) {
    if (!applicationId || !PARTNERSHIP_REVIEW_STATUS.includes(status)) return;
    setReviewSavingId(applicationId);
    try {
      await supabase
        .from('partnership_applications')
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: auth?.id || null })
        .eq('id', applicationId);
      await load();
    } catch (err) {
      console.error('Partnership status update error:', err);
    } finally {
      setReviewSavingId('');
    }
  }

  // Expiry detection
  function isExpiringSoon(dateStr) {
    if (!dateStr) return false;
    const diff = new Date(dateStr) - new Date();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }

  const active = sponsors.filter((s) => s.status === 'active').length;
  const expiringSoon = sponsors.filter((s) => s.status === 'active' && isExpiringSoon(s.contract_end)).length;
  const pendingApplications = applications.filter((item) => item.status === 'pending').length;

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ WORKSPACE — SPONSOR"
      title={<>KELOLA<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>sponsor.</span></>}
      subtitle="Kelola partnership, kontrak sponsor, dan data mitra bisnis STADIONE."
      onBack={onBack}
      breadcrumbs={[{ label: 'Workspace', onClick: () => onNav('workspace-console') }, { label: 'Kelola Sponsor' }]}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Sponsor" value={loading ? '—' : sponsors.length} icon={Star} accent="emerald" />
        <StatCard label="Kontrak Aktif" value={loading ? '—' : active} icon={Check} accent="blue" />
        <StatCard label="Segera Expired" value={loading ? '—' : expiringSoon} icon={AlertCircle} accent="amber" />
        <div className="relative">
          <StatCard label="Request Partnership" value={loading ? '—' : pendingApplications} icon={AlertCircle} accent="violet" />
          {pendingApplications > 0 && (
            <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
              {pendingApplications > 99 ? '99+' : pendingApplications}
            </div>
          )}
        </div>
      </div>

      {/* Partnership applications */}
      <div className="mb-8">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">/ Request Partnership Masuk</div>
        {loading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={`app-skeleton-${i}`} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
        ) : applications.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-5 text-sm text-neutral-500">Belum ada request partnership masuk.</div>
        ) : (
          <div className="space-y-2">
            {applications.slice(0, 15).map((item) => (
              <div key={item.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-sm text-neutral-900">{item.applicant_name}</div>
                      <StatusBadge status={item.status} />
                      <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-neutral-400">{item.type}</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{item.applicant_email}{item.applicant_phone ? ` · ${item.applicant_phone}` : ''}</div>
                    <div className="text-[11px] text-neutral-400 mt-1">{new Date(item.created_at).toLocaleString('id-ID')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-xl border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                      value={item.status}
                      disabled={reviewSavingId === item.id}
                      onChange={(event) => handleReviewStatus(item.id, event.target.value)}
                    >
                      {PARTNERSHIP_REVIEW_STATUS.map((status) => <option key={`${item.id}-${status}`} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter + add */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {['all', ...STATUS_OPTIONS].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.14em] transition border ${statusFilter === f ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'}`}>
              {f === 'all' ? 'Semua' : f}
            </button>
          ))}
        </div>
        <ActionButton size="sm" onClick={openCreate}><Plus size={14} /> Tambah Sponsor</ActionButton>
      </div>

      {/* Sponsor list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : sponsors.length === 0 ? (
        <EmptyState icon={Star} title="Belum ada sponsor" description="Tambah sponsor atau partner pertama." action={<ActionButton onClick={openCreate}><Plus size={14} /> Tambah Sponsor</ActionButton>} />
      ) : (
        <div className="space-y-3">
          {sponsors.map((s) => (
            <div key={s.id} className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
              {s.logo_url ? (
                <img src={s.logo_url} alt={s.name} className="w-12 h-12 rounded-2xl object-contain border border-neutral-200 shrink-0 bg-white p-1" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0">
                  <Star size={20} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-neutral-900">{s.name}</span>
                  <StatusBadge status={s.status} />
                  {isExpiringSoon(s.contract_end) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      <AlertCircle size={9} /> Segera expired
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-500">{s.category}</div>
                {s.website && <div className="text-xs text-blue-500 mt-0.5 truncate">{s.website}</div>}
                {(s.contract_start || s.contract_end) && (
                  <div className="text-xs text-neutral-400 mt-1">
                    Kontrak: {s.contract_start || '—'} → {s.contract_end || '—'}
                  </div>
                )}
                {s.contact_name && <div className="text-xs text-neutral-400">{s.contact_name}{s.contact_email ? ` · ${s.contact_email}` : ''}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(s)} className="w-8 h-8 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 flex items-center justify-center transition">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => setDeleteTarget(s)} className="w-8 h-8 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORM MODAL */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editTarget ? 'Edit Sponsor' : 'Tambah Sponsor'} width="max-w-xl">
        <div className="space-y-4">
          <Field label="Nama Sponsor">
            <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama perusahaan sponsor..." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kategori">
              <select className={selectCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Website">
            <input className={inputCls} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." />
          </Field>
          <Field label="URL Logo (opsional)">
            <input className={inputCls} value={form.logo_url} onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nama Kontak">
              <input className={inputCls} value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Nama PIC..." />
            </Field>
            <Field label="Email Kontak">
              <input className={inputCls} type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="email@..." />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Mulai Kontrak">
              <input className={inputCls} type="date" value={form.contract_start} onChange={(e) => setForm((f) => ({ ...f, contract_start: e.target.value }))} />
            </Field>
            <Field label="Akhir Kontrak">
              <input className={inputCls} type="date" value={form.contract_end} onChange={(e) => setForm((f) => ({ ...f, contract_end: e.target.value }))} />
            </Field>
          </div>
          <Field label="Catatan (opsional)">
            <textarea className={textareaCls} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Informasi tambahan..." />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
              <Check size={14} /> {editTarget ? 'Simpan' : 'Tambah Sponsor'}
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* DELETE */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Sponsor?">
        <p className="text-sm text-neutral-600 mb-5">Sponsor <span className="font-semibold">"{deleteTarget?.name}"</span> akan dihapus permanen.</p>
        <div className="flex justify-end gap-3">
          <ActionButton variant="outline" onClick={() => setDeleteTarget(null)}>Batal</ActionButton>
          <ActionButton variant="danger" onClick={handleDelete}><Trash2 size={14} /> Hapus</ActionButton>
        </div>
      </Modal>
    </AdminLayout>
  );
}
