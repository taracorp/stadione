import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tag, Plus, X, Pause, Play, Ban, Copy, Check, Wallet, ChevronRight, Search, ArrowRight } from 'lucide-react';
import { EmptyState, inputCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const STATUS_CLS = {
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-yellow-100 text-yellow-700',
  expired:   'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-red-100 text-red-600',
};

const PAYOUT_CLS = {
  pending:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  paid:      'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const EMPTY_FORM = {
  name: '', code: '', discount_type: 'percent', discount_value: '',
  min_booking_amount: '', max_discount_amount: '',
  quota_type: 'unlimited', quota: '',
  valid_from: new Date().toISOString().slice(0, 10), valid_until: '',
  description: '', target_venue_id: '',
};

// ── PromoFormModal ────────────────────────────────────────────────────────────
function PromoFormModal({ onClose, onSaved, auth, venues }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim()) return setError('Nama promo wajib diisi.');
    if (!form.code.trim()) return setError('Kode promo wajib diisi.');
    if (!form.discount_value || Number(form.discount_value) <= 0) return setError('Nilai diskon harus > 0.');
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) return setError('Maks 100%.');
    if (!form.valid_until) return setError('Tanggal berakhir wajib diisi.');
    if (form.valid_until < form.valid_from) return setError('Tanggal berakhir harus setelah mulai.');
    if (form.quota_type === 'limited' && (!form.quota || Number(form.quota) < 1))
      return setError('Kuota minimal 1.');

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        promo_type: 'platform',
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_booking_amount: Number(form.min_booking_amount || 0),
        max_discount_amount: form.discount_type === 'percent' && form.max_discount_amount ? Number(form.max_discount_amount) : null,
        quota: form.quota_type === 'limited' ? Number(form.quota) : null,
        used_count: 0,
        valid_from: form.valid_from + 'T00:00:00+07:00',
        valid_until: form.valid_until + 'T23:59:59+07:00',
        venue_id: form.target_venue_id || null,
        created_by: auth.id,
        status: 'active',
        active: true,
        description: form.description.trim() || null,
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
      setError(err.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 px-5 py-4 flex items-center justify-between">
          <div className="font-display text-lg">Buat Promo Platform</div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Nama Promo *</label>
            <input className={inputCls} placeholder="Nama promo" value={form.name}
              onChange={(e) => { set('name', e.target.value); if (!form.code) set('code', slugify(e.target.value)); }} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Kode Promo *</label>
            <input className={`${inputCls} font-mono uppercase`} placeholder="STADIONE20"
              value={form.code.toUpperCase()} onChange={(e) => set('code', e.target.value.trim().toLowerCase())} />
          </div>

          {/* Target venue */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Target Venue (kosong = semua venue)</label>
            <select className={selectCls} value={form.target_venue_id} onChange={(e) => set('target_venue_id', e.target.value)}>
              <option value="">Semua Venue</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Jenis Diskon *</label>
              <select className={selectCls} value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
                <option value="percent">Persentase (%)</option>
                <option value="fixed">Nominal Tetap (Rp)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">
                Nilai Diskon * {form.discount_type === 'percent' ? '(%)' : '(Rp)'}
              </label>
              <input type="number" className={inputCls} min="0" value={form.discount_value}
                onChange={(e) => set('discount_value', e.target.value)} />
            </div>
          </div>

          {form.discount_type === 'percent' && (
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Maks Diskon (Rp) – opsional</label>
              <input type="number" className={inputCls} min="0" placeholder="Kosongkan = tanpa batas"
                value={form.max_discount_amount} onChange={(e) => set('max_discount_amount', e.target.value)} />
            </div>
          )}

          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Min Pemesanan (Rp)</label>
            <input type="number" className={inputCls} min="0" placeholder="0 = semua"
              value={form.min_booking_amount} onChange={(e) => set('min_booking_amount', e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Kuota</label>
            <div className="flex gap-2">
              {['unlimited', 'limited'].map((v) => (
                <button key={v} type="button"
                  className={`flex-1 py-2 rounded-xl border text-sm font-semibold ${form.quota_type === v ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600'}`}
                  onClick={() => set('quota_type', v)}>
                  {v === 'unlimited' ? 'Tidak Terbatas' : 'Terbatas'}
                </button>
              ))}
            </div>
            {form.quota_type === 'limited' && (
              <input type="number" className={`${inputCls} mt-2`} min="1" placeholder="Jumlah kuota"
                value={form.quota} onChange={(e) => set('quota', e.target.value)} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Tanggal Mulai *</label>
              <input type="date" className={inputCls} value={form.valid_from} onChange={(e) => set('valid_from', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Tanggal Berakhir *</label>
              <input type="date" className={inputCls} value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Deskripsi – opsional</label>
            <input className={inputCls} placeholder="Syarat & ketentuan" value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Biaya diskon promo platform ditanggung oleh Stadione dan akan dibayarkan ke pemilik lapangan <strong>7 hari setelah promo berakhir</strong>.
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-neutral-100 px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600">Batal</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Buat Promo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PayoutRow ─────────────────────────────────────────────────────────────────
function PayoutRow({ payout, onMarkPaid, loading }) {
  const [ref, setRef] = useState('');
  return (
    <tr className="border-b border-neutral-50 hover:bg-neutral-50 transition align-top">
      <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtDate(payout.created_at)}</td>
      <td className="px-4 py-2.5 font-mono text-xs">{payout.promo_codes?.code?.toUpperCase()}</td>
      <td className="px-4 py-2.5 text-xs">{payout.venues?.name}</td>
      <td className="px-4 py-2.5 font-semibold text-neutral-900 text-right">Rp {fmt(payout.payout_amount)}</td>
      <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtDate(payout.payout_due_at)}</td>
      <td className="px-4 py-2.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PAYOUT_CLS[payout.payout_status] || 'bg-neutral-100 text-neutral-600'}`}>
          {payout.payout_status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {payout.payout_status === 'pending' || payout.payout_status === 'scheduled' ? (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <input className={`${inputCls} text-xs py-1`} placeholder="No. referensi transfer"
              value={ref} onChange={(e) => setRef(e.target.value)} />
            <button disabled={!ref.trim() || loading} onClick={() => onMarkPaid(payout.id, ref)}
              className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold disabled:opacity-40">
              {loading ? '...' : 'Tandai Lunas'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-neutral-400">{payout.transfer_reference || '—'}</span>
        )}
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlatformPromoPage({ auth, onBack }) {
  const [promos, setPromos] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('promos');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [promoRes, payoutRes, venueRes] = await Promise.all([
      supabase
        .from('promo_codes')
        .select('*')
        .eq('promo_type', 'platform')
        .order('created_at', { ascending: false }),
      supabase
        .from('promo_payouts')
        .select('*, promo_codes(code, name), venues(name, city)')
        .order('payout_due_at', { ascending: true })
        .limit(200),
      supabase
        .from('venues')
        .select('id, name, city')
        .eq('is_active', true)
        .order('name'),
    ]);
    setPromos(promoRes.data || []);
    setPayouts(payoutRes.data || []);
    setVenues(venueRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = useCallback(async (id, newStatus) => {
    setActionLoading(true);
    await supabase.from('promo_codes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
    setActionLoading(false);
  }, [load]);

  const handleMarkPaid = useCallback(async (payoutId, transferRef) => {
    setPayoutLoading(true);
    await supabase.from('promo_payouts').update({
      payout_status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: auth.id,
      transfer_reference: transferRef,
      updated_at: new Date().toISOString(),
    }).eq('id', payoutId);
    await load();
    setPayoutLoading(false);
  }, [auth.id, load]);

  const filteredPromos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter((p) =>
      (p.code || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q)
    );
  }, [promos, search]);

  const pendingPayouts = payouts.filter((p) => p.payout_status === 'pending' || p.payout_status === 'scheduled');
  const paidPayouts = payouts.filter((p) => p.payout_status === 'paid');

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {onBack && (
            <button onClick={onBack} className="text-xs text-neutral-400 mb-2 flex items-center gap-1 hover:text-neutral-700">
              ← Kembali
            </button>
          )}
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Platform Admin</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Promo Platform</h1>
          <p className="text-neutral-500 text-sm mt-1">Kelola kode promo platform Stadione dan pembayaran ke venue.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800">
          <Plus size={16} /> Buat Promo
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{promos.filter((p) => p.status === 'active').length}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Promo Aktif</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-neutral-900">{promos.reduce((s, p) => s + (p.used_count || 0), 0)}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Total Pemakaian</div>
        </div>
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-800">{pendingPayouts.length}</div>
          <div className="text-xs text-yellow-600 mt-0.5">Payout Tertunda</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-800">Rp {fmt(pendingPayouts.reduce((s, p) => s + Number(p.payout_amount || 0), 0))}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Total Payout Pending</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-2xl w-fit">
        {[['promos', 'Semua Promo'], ['payouts', `Payout (${pendingPayouts.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-xl text-sm font-bold transition ${tab === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'promos' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input className={`${inputCls} pl-9`} placeholder="Cari kode atau nama promo..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="text-center py-12 text-neutral-400 text-sm">Memuat...</div>
          ) : filteredPromos.length === 0 ? (
            <EmptyState icon={Tag} title="Belum ada promo platform" description="Klik Buat Promo untuk memulai." />
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    {['Nama', 'Kode', 'Target Venue', 'Diskon', 'Pemakaian', 'Berlaku s/d', 'Status', 'Aksi'].map((h) => (
                      <th key={h} className="px-4 py-2 text-xs text-neutral-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPromos.map((p) => {
                    const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
                    const effectiveStatus = isExpired && p.status === 'active' ? 'expired' : p.status;
                    const discountLabel = p.discount_type === 'percent'
                      ? `${p.discount_value}%` : `Rp ${fmt(p.discount_value)}`;
                    const usedLabel = p.quota ? `${p.used_count || 0}/${p.quota}` : `${p.used_count || 0}`;
                    return (
                      <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition">
                        <td className="px-4 py-2.5 font-semibold text-neutral-900 text-sm">{p.name || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-bold">{p.code?.toUpperCase()}</td>
                        <td className="px-4 py-2.5 text-xs text-neutral-600">{p.venue_id ? '(spesifik)' : 'Semua Venue'}</td>
                        <td className="px-4 py-2.5 text-xs font-semibold">{discountLabel}</td>
                        <td className="px-4 py-2.5 text-xs">{usedLabel}</td>
                        <td className="px-4 py-2.5 text-xs">{fmtDate(p.valid_until)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[effectiveStatus] || 'bg-neutral-100 text-neutral-600'}`}>
                            {effectiveStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            {p.status === 'active' && !isExpired && (
                              <button disabled={actionLoading} onClick={() => handleAction(p.id, 'paused')}
                                className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 disabled:opacity-40" title="Jeda">
                                <Pause size={13} />
                              </button>
                            )}
                            {p.status === 'paused' && (
                              <button disabled={actionLoading} onClick={() => handleAction(p.id, 'active')}
                                className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 disabled:opacity-40" title="Aktifkan">
                                <Play size={13} />
                              </button>
                            )}
                            {p.status !== 'cancelled' && !isExpired && (
                              <button disabled={actionLoading}
                                onClick={() => { if (window.confirm('Batalkan promo ini?')) handleAction(p.id, 'cancelled'); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40" title="Batalkan">
                                <Ban size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-3">
          {pendingPayouts.length === 0 && paidPayouts.length === 0 ? (
            <EmptyState icon={Wallet} title="Belum ada payout" description="Payout akan dibuat otomatis 7 hari setelah promo berakhir." />
          ) : (
            <>
              {pendingPayouts.length > 0 && (
                <>
                  <div className="text-sm font-semibold text-neutral-700">Tertunda / Dijadwalkan</div>
                  <div className="overflow-x-auto -mx-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-neutral-100">
                          {['Tgl Buat', 'Kode Promo', 'Venue', 'Jumlah', 'Jatuh Tempo', 'Status', 'Aksi'].map((h) => (
                            <th key={h} className="px-4 py-2 text-xs text-neutral-400 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPayouts.map((p) => (
                          <PayoutRow key={p.id} payout={p} onMarkPaid={handleMarkPaid} loading={payoutLoading} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {paidPayouts.length > 0 && (
                <>
                  <div className="text-sm font-semibold text-neutral-700 mt-4">Sudah Dibayar</div>
                  <div className="overflow-x-auto -mx-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-neutral-100">
                          {['Tgl Buat', 'Kode Promo', 'Venue', 'Jumlah', 'Dibayar Tgl', 'Status', ''].map((h) => (
                            <th key={h} className="px-4 py-2 text-xs text-neutral-400 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paidPayouts.map((p) => (
                          <PayoutRow key={p.id} payout={p} onMarkPaid={handleMarkPaid} loading={payoutLoading} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {showForm && (
        <PromoFormModal auth={auth} venues={venues}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}
