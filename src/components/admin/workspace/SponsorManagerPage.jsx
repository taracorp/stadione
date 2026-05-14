import React, { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Edit3, Trash2, Check, AlertCircle } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, inputCls, textareaCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const CATEGORIES = ['Title Sponsor', 'Official Sponsor', 'Media Partner', 'Supporting Partner', 'General'];
const STATUS_OPTIONS = ['active', 'inactive', 'pending', 'expired'];

const EMPTY_FORM = {
  name: '', category: 'Official Sponsor', website: '', contact_name: '', contact_email: '',
  status: 'active', contract_start: '', contract_end: '', notes: '', logo_url: '',
};

export default function SponsorManagerPage({ auth, onBack, onNav }) {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('sponsors')
        .select('id,name,logo_url,category,website,contact_name,contact_email,status,contract_start,contract_end,notes,created_at')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data } = await q;
      setSponsors(data || []);
    } catch (err) {
      console.error('Sponsor load error:', err);
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

  // Expiry detection
  function isExpiringSoon(dateStr) {
    if (!dateStr) return false;
    const diff = new Date(dateStr) - new Date();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }

  const active = sponsors.filter((s) => s.status === 'active').length;
  const expiringSoon = sponsors.filter((s) => s.status === 'active' && isExpiringSoon(s.contract_end)).length;

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
        <StatCard label="Tidak Aktif" value={loading ? '—' : sponsors.filter((s) => ['inactive', 'expired'].includes(s.status)).length} icon={Star} accent="neutral" />
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
