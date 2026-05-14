import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Tag, Copy, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDiscount(promo) {
  if (promo.discount_type === 'percent') return `${promo.discount_value}%`;
  return `Rp ${Number(promo.discount_value).toLocaleString('id-ID')}`;
}

const APPLIES_LABELS = { all: 'Semua Pelanggan', member_only: 'Member Saja', new_customer: 'Pelanggan Baru' };

const EMPTY_FORM = {
  title: '', description: '', promo_code: '', discount_type: 'percent', discount_value: '',
  min_booking_hours: 1, max_discount_idr: '', valid_from: '', valid_until: '',
  usage_limit: '', applies_to: 'all', is_active: true,
};

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueAdsPage({ auth, venue }) {
  const venueId = venue?.id;
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(null);
  const [filterActive, setFilterActive] = useState('all');

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_promotions')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromos(data || []);
    } catch (err) {
      console.error('Promos load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, promo_code: randomCode() });
    setShowForm(true);
  }

  function openEdit(promo) {
    setEditing(promo);
    setForm({
      title: promo.title || '',
      description: promo.description || '',
      promo_code: promo.promo_code || '',
      discount_type: promo.discount_type || 'percent',
      discount_value: promo.discount_value ?? '',
      min_booking_hours: promo.min_booking_hours ?? 1,
      max_discount_idr: promo.max_discount_idr ?? '',
      valid_from: promo.valid_from || '',
      valid_until: promo.valid_until || '',
      usage_limit: promo.usage_limit ?? '',
      applies_to: promo.applies_to || 'all',
      is_active: promo.is_active ?? true,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.discount_value) return;
    setSaving(true);
    try {
      const payload = {
        venue_id: venueId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        promo_code: form.promo_code.trim().toUpperCase() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_booking_hours: Number(form.min_booking_hours) || 1,
        max_discount_idr: form.max_discount_idr ? Number(form.max_discount_idr) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        applies_to: form.applies_to,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('venue_promotions').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('success', 'Promo diperbarui.');
      } else {
        const { error } = await supabase.from('venue_promotions').insert(payload);
        if (error) throw error;
        showToast('success', 'Promo berhasil dibuat.');
      }
      setShowForm(false);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo) {
    try {
      await supabase.from('venue_promotions').update({ is_active: !promo.is_active }).eq('id', promo.id);
      load();
    } catch (err) { showToast('error', err.message); }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function isExpired(promo) {
    if (!promo.valid_until) return false;
    return new Date(promo.valid_until) < new Date();
  }

  const now = new Date();
  const filtered = promos.filter(p => {
    if (filterActive === 'active') return p.is_active && !isExpired(p);
    if (filterActive === 'inactive') return !p.is_active || isExpired(p);
    return true;
  });

  const activeCount = promos.filter(p => p.is_active && !isExpired(p)).length;
  const totalUsage = promos.reduce((s, p) => s + (p.usage_count || 0), 0);

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={Megaphone} title="Belum ada venue" description="Daftarkan venue terlebih dahulu." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg text-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Promosi</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Promosi & Diskon</h1>
          <p className="text-neutral-500 text-sm mt-1">Buat kode promo dan diskon untuk menarik pelanggan.</p>
        </div>
        <ActionButton onClick={openCreate}><Plus size={14} /> Buat Promo</ActionButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Promo</div>
          <div className="text-2xl font-bold text-neutral-900">{promos.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Aktif</div>
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Pemakaian</div>
          <div className="text-2xl font-bold text-neutral-900">{totalUsage}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Member Only</div>
          <div className="text-2xl font-bold text-neutral-900">{promos.filter(p => p.applies_to === 'member_only').length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit">
        {[['all', 'Semua'], ['active', 'Aktif'], ['inactive', 'Nonaktif']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilterActive(k)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${filterActive === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Tag} title="Belum ada promo" description="Buat kode promo pertama untuk venue Anda." action={<ActionButton onClick={openCreate}><Plus size={14} /> Buat Promo</ActionButton>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(promo => {
            const expired = isExpired(promo);
            return (
              <div key={promo.id} className={`rounded-2xl border p-4 flex items-start gap-4 ${!promo.is_active || expired ? 'border-neutral-200 bg-neutral-50 opacity-75' : 'border-emerald-200 bg-white'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${promo.is_active && !expired ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                  <Tag size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-neutral-900">{promo.title}</span>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{fmtDiscount(promo)} OFF</span>
                    <span className="text-xs text-neutral-400">{APPLIES_LABELS[promo.applies_to]}</span>
                    {expired && <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Kadaluarsa</span>}
                  </div>
                  {promo.description && <div className="text-xs text-neutral-500 mb-1">{promo.description}</div>}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-neutral-500">
                    {promo.promo_code && (
                      <button type="button" onClick={() => copyCode(promo.promo_code)}
                        className="flex items-center gap-1 font-mono bg-neutral-100 px-2 py-0.5 rounded hover:bg-neutral-200 transition">
                        {copied === promo.promo_code ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                        {promo.promo_code}
                      </button>
                    )}
                    {promo.valid_from && <span>Mulai {fmtDate(promo.valid_from)}</span>}
                    {promo.valid_until && <span>Berakhir {fmtDate(promo.valid_until)}</span>}
                    <span>Dipakai {promo.usage_count || 0}{promo.usage_limit ? `/${promo.usage_limit}` : 'x'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => toggleActive(promo)} title={promo.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                    {promo.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-neutral-400" />}
                  </button>
                  <button onClick={() => openEdit(promo)} className="text-xs text-neutral-500 hover:underline">Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Promo' : 'Buat Promo Baru'}>
        <div className="space-y-4">
          <Field label="Nama Promo *">
            <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="cth: Diskon Weekend 20%" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jenis Diskon">
              <select className={selectCls} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
                <option value="percent">Persen (%)</option>
                <option value="fixed">Nominal (Rp)</option>
              </select>
            </Field>
            <Field label={`Nilai Diskon ${form.discount_type === 'percent' ? '(%)' : '(Rp)'} *`}>
              <input className={inputCls} type="number" min="0" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? '20' : '50000'} />
            </Field>
            <Field label="Kode Promo">
              <div className="flex gap-1">
                <input className={inputCls} value={form.promo_code} onChange={e => set('promo_code', e.target.value.toUpperCase())} placeholder="HEMAT20" />
                <button type="button" onClick={() => set('promo_code', randomCode())} className="px-2 py-1.5 text-xs bg-neutral-100 hover:bg-neutral-200 rounded-xl shrink-0 font-semibold">Acak</button>
              </div>
            </Field>
            <Field label="Berlaku Untuk">
              <select className={selectCls} value={form.applies_to} onChange={e => set('applies_to', e.target.value)}>
                {Object.entries(APPLIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Mulai">
              <input className={inputCls} type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Tanggal Berakhir">
              <input className={inputCls} type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
            </Field>
            <Field label="Maks. Diskon (Rp)">
              <input className={inputCls} type="number" min="0" value={form.max_discount_idr} onChange={e => set('max_discount_idr', e.target.value)} placeholder="— Tidak terbatas —" />
            </Field>
            <Field label="Batas Pemakaian">
              <input className={inputCls} type="number" min="0" value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} placeholder="— Tidak terbatas —" />
            </Field>
          </div>
          <Field label="Deskripsi">
            <textarea className={textareaCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Keterangan tambahan untuk pelanggan" />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-700">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            Aktifkan promo sekarang
          </label>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSave} loading={saving}>{editing ? 'Simpan Perubahan' : 'Buat Promo'}</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
