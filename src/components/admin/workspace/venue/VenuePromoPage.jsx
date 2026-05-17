import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tag, Plus, X, Pause, Play, Ban, ChevronDown, Copy, Check } from 'lucide-react';
import { EmptyState, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isoToLocal(iso) { return iso ? iso.slice(0, 10) : ''; }
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const STATUS_CLS = {
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-yellow-100 text-yellow-700',
  expired:   'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-red-100 text-red-600',
};

const EMPTY_FORM = {
  name: '',
  code: '',
  discount_type: 'percent',
  discount_value: '',
  min_booking_amount: '',
  max_discount_amount: '',
  quota_type: 'unlimited',
  quota: '',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: '',
  description: '',
};

// ── PromoFormModal ────────────────────────────────────────────────────────────
function PromoFormModal({ onClose, onSaved, venue, auth }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleNameChange = (v) => {
    set('name', v);
    if (!form.code) set('code', slugify(v));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Nama promo wajib diisi.');
    if (!form.code.trim()) return setError('Kode promo wajib diisi.');
    if (!form.discount_value || Number(form.discount_value) <= 0)
      return setError('Nilai diskon harus lebih besar dari 0.');
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100)
      return setError('Persentase diskon maksimal 100%.');
    if (!form.valid_until) return setError('Tanggal berakhir wajib diisi.');
    if (form.valid_until < form.valid_from) return setError('Tanggal berakhir harus setelah tanggal mulai.');
    if (form.quota_type === 'limited' && (!form.quota || Number(form.quota) < 1))
      return setError('Kuota harus minimal 1.');

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        promo_type: 'venue_owner',
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_booking_amount: Number(form.min_booking_amount || 0),
        max_discount_amount: form.discount_type === 'percent' && form.max_discount_amount
          ? Number(form.max_discount_amount) : null,
        quota: form.quota_type === 'limited' ? Number(form.quota) : null,
        used_count: 0,
        valid_from: form.valid_from + 'T00:00:00+07:00',
        valid_until: form.valid_until + 'T23:59:59+07:00',
        venue_id: venue.id,
        created_by: auth.id,
        status: 'active',
        active: true,
        description: form.description.trim() || null,
        // backward-compat columns
        discount_amount: form.discount_type === 'fixed' ? Number(form.discount_value) : null,
        discount_percent: form.discount_type === 'percent' ? Number(form.discount_value) : null,
      };

      const { error: dbErr } = await supabase.from('promo_codes').insert(payload);
      if (dbErr) {
        if (dbErr.code === '23505') throw new Error('Kode promo sudah digunakan. Coba kode lain.');
        throw dbErr;
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan promo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 px-5 py-4 flex items-center justify-between">
          <div className="font-display text-lg text-neutral-900">Buat Kode Promo</div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Nama Promo *</label>
            <input className={inputCls} placeholder="Contoh: Promo Akhir Pekan" value={form.name}
              onChange={(e) => handleNameChange(e.target.value)} />
          </div>

          {/* Code */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Kode Promo *</label>
            <input className={`${inputCls} font-mono uppercase`} placeholder="WEEKEND20"
              value={form.code.toUpperCase()}
              onChange={(e) => set('code', e.target.value.trim().toLowerCase())} />
            <div className="text-xs text-neutral-400 mt-1">Kode yang dipakai pelanggan saat checkout. Huruf besar/kecil tidak dibedakan.</div>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Jenis Diskon *</label>
              <select className={selectCls} value={form.discount_type}
                onChange={(e) => set('discount_type', e.target.value)}>
                <option value="percent">Persentase (%)</option>
                <option value="fixed">Nominal Tetap (Rp)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">
                Nilai Diskon * {form.discount_type === 'percent' ? '(%)' : '(Rp)'}
              </label>
              <input type="number" className={inputCls} min="0"
                placeholder={form.discount_type === 'percent' ? '20' : '50000'}
                value={form.discount_value}
                onChange={(e) => set('discount_value', e.target.value)} />
            </div>
          </div>

          {form.discount_type === 'percent' && (
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Maks Diskon (Rp) – opsional</label>
              <input type="number" className={inputCls} min="0" placeholder="Kosongkan = tanpa batas"
                value={form.max_discount_amount}
                onChange={(e) => set('max_discount_amount', e.target.value)} />
            </div>
          )}

          {/* Min booking */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Minimum Pemesanan (Rp) – opsional</label>
            <input type="number" className={inputCls} min="0" placeholder="0 = semua booking"
              value={form.min_booking_amount}
              onChange={(e) => set('min_booking_amount', e.target.value)} />
          </div>

          {/* Quota */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Kuota</label>
            <div className="flex gap-2">
              <button type="button"
                className={`flex-1 py-2 rounded-xl border text-sm font-semibold ${form.quota_type === 'unlimited' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}
                onClick={() => set('quota_type', 'unlimited')}>Tidak Terbatas</button>
              <button type="button"
                className={`flex-1 py-2 rounded-xl border text-sm font-semibold ${form.quota_type === 'limited' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}
                onClick={() => set('quota_type', 'limited')}>Terbatas</button>
            </div>
            {form.quota_type === 'limited' && (
              <input type="number" className={`${inputCls} mt-2`} min="1" placeholder="Jumlah kuota"
                value={form.quota} onChange={(e) => set('quota', e.target.value)} />
            )}
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Tanggal Mulai *</label>
              <input type="date" className={inputCls} value={form.valid_from}
                onChange={(e) => set('valid_from', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Tanggal Berakhir *</label>
              <input type="date" className={inputCls} value={form.valid_until}
                onChange={(e) => set('valid_until', e.target.value)} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Deskripsi – opsional</label>
            <input className={inputCls} placeholder="Syarat & ketentuan singkat" value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </div>

          {/* Biaya info */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Biaya promo ini ditanggung oleh venue Anda. Diskon akan diberikan kepada pelanggan saat checkout.
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-neutral-100 px-5 py-4 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">Batal</button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Buat Promo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PromoRow ──────────────────────────────────────────────────────────────────
function PromoRow({ promo, onAction, loading }) {
  const [copied, setCopied] = useState(false);
  const status = promo.status || 'active';
  const now = new Date();
  const isExpiredByDate = promo.valid_until && new Date(promo.valid_until) < now;
  const effectiveStatus = isExpiredByDate && status === 'active' ? 'expired' : status;

  const copyCode = () => {
    navigator.clipboard.writeText(promo.code?.toUpperCase() || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usedLabel = promo.quota
    ? `${promo.used_count || 0}/${promo.quota}`
    : `${promo.used_count || 0} pemakaian`;

  const discountLabel = promo.discount_type === 'percent'
    ? `${promo.discount_value}%${promo.max_discount_amount ? ` (maks Rp ${fmt(promo.max_discount_amount)})` : ''}`
    : `Rp ${fmt(promo.discount_value)}`;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-900 text-sm">{promo.name || promo.code}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[effectiveStatus] || 'bg-neutral-100 text-neutral-600'}`}>
              {effectiveStatus}
            </span>
          </div>
          {promo.description && <div className="text-xs text-neutral-400 mt-0.5">{promo.description}</div>}
        </div>
        <div className="flex gap-1 shrink-0">
          {status === 'active' && !isExpiredByDate && (
            <button title="Jeda" disabled={loading} onClick={() => onAction(promo.id, 'paused')}
              className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600 disabled:opacity-40">
              <Pause size={14} />
            </button>
          )}
          {status === 'paused' && (
            <button title="Aktifkan kembali" disabled={loading} onClick={() => onAction(promo.id, 'active')}
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 disabled:opacity-40">
              <Play size={14} />
            </button>
          )}
          {status !== 'cancelled' && status !== 'expired' && !isExpiredByDate && (
            <button title="Batalkan" disabled={loading}
              onClick={() => { if (window.confirm('Batalkan promo ini?')) onAction(promo.id, 'cancelled'); }}
              className="p-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40">
              <Ban size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <code className="bg-neutral-100 px-3 py-1 rounded-lg text-sm font-mono font-bold text-neutral-900 tracking-wider">
          {promo.code?.toUpperCase()}
        </code>
        <button onClick={copyCode} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400">
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-neutral-400">Diskon</div>
          <div className="font-semibold text-neutral-900">{discountLabel}</div>
        </div>
        <div>
          <div className="text-neutral-400">Pemakaian</div>
          <div className="font-semibold text-neutral-900">{usedLabel}</div>
        </div>
        <div>
          <div className="text-neutral-400">Berlaku</div>
          <div className="font-semibold text-neutral-900">{fmtDate(promo.valid_from)}</div>
        </div>
        <div>
          <div className="text-neutral-400">Berakhir</div>
          <div className={`font-semibold ${isExpiredByDate ? 'text-red-600' : 'text-neutral-900'}`}>
            {fmtDate(promo.valid_until) || 'Tidak terbatas'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VenuePromoPage({ auth, venue }) {
  const venueId = venue?.id;
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('active');

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    const { data } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('venue_id', venueId)
      .eq('promo_type', 'venue_owner')
      .order('created_at', { ascending: false });
    setPromos(data || []);
    setLoading(false);
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  const handleAction = useCallback(async (id, newStatus) => {
    setActionLoading(true);
    await supabase.from('promo_codes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
    setActionLoading(false);
  }, [load]);

  const activePromos = useMemo(() => promos.filter((p) => {
    const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
    return p.status === 'active' && !isExpired;
  }), [promos]);

  const archivedPromos = useMemo(() => promos.filter((p) => {
    const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
    return p.status !== 'active' || isExpired;
  }), [promos]);

  const shown = tab === 'active' ? activePromos : archivedPromos;

  if (!venueId) return null;

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Promo Venue</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Kode Promo</h1>
          <p className="text-neutral-500 text-sm mt-1">Buat dan kelola kode promo untuk pelanggan venue Anda.</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800">
          <Plus size={16} /> Buat Promo
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{activePromos.length}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Promo Aktif</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{promos.reduce((s, p) => s + (p.used_count || 0), 0)}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Total Pemakaian</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{promos.length}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Semua Promo</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-2xl w-fit">
        {[['active', 'Aktif'], ['archived', 'Arsip']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">Memuat promo...</div>
      ) : shown.length === 0 ? (
        <EmptyState icon={Tag} title={tab === 'active' ? 'Belum ada promo aktif' : 'Tidak ada promo di arsip'}
          description={tab === 'active' ? 'Klik "Buat Promo" untuk membuat kode diskon pertama Anda.' : 'Promo yang sudah berakhir atau dibatalkan akan muncul di sini.'} />
      ) : (
        <div className="space-y-3">
          {shown.map((p) => (
            <PromoRow key={p.id} promo={p} onAction={handleAction} loading={actionLoading} />
          ))}
        </div>
      )}

      {showForm && (
        <PromoFormModal venue={venue} auth={auth}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}
