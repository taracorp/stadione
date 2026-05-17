import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, Plus, X, Tag, AlertCircle, Check, Copy, Pause, Play, Ban, Search } from 'lucide-react';
import { EmptyState, inputCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const FEE_RATE = 0.10; // 10% management fee

// Sponsor pays topup_gross, then:
//   management_fee = topup_gross * (FEE_RATE / (1 + FEE_RATE))
//   usable_balance  = topup_gross - management_fee
// i.e. to get 10jt usable, pay 11jt

function calcFee(usable) {
  const gross = Number(usable || 0) * (1 + FEE_RATE);
  const fee = gross - Number(usable || 0);
  return { gross, fee };
}

const STATUS_CLS = {
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-yellow-100 text-yellow-700',
  expired:   'bg-neutral-100 text-neutral-500',
  cancelled: 'bg-red-100 text-red-600',
};

const EMPTY_PROMO = {
  name: '', code: '', discount_type: 'percent', discount_value: '',
  min_booking_amount: '', max_discount_amount: '',
  quota_type: 'unlimited', quota: '',
  valid_from: new Date().toISOString().slice(0, 10), valid_until: '',
  description: '', target_venue_id: '',
};

// ── TopUpModal ────────────────────────────────────────────────────────────────
function TopUpModal({ onClose, onTopUpDone, auth }) {
  const [usable, setUsable] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usableNum = Number(usable || 0);
  const { gross, fee } = calcFee(usableNum);

  const handleSubmit = async () => {
    setError('');
    if (usableNum < 100000) return setError('Saldo minimum Rp 100.000.');
    try {
      setSaving(true);
      const { error: dbErr } = await supabase.from('sponsor_promo_balance').insert({
        sponsor_user_id: auth.id,
        topup_gross: gross,
        management_fee_rate: FEE_RATE,
        management_fee: fee,
        usable_balance: usableNum,
        used_balance: 0,
        status: 'active',
        notes: notes.trim() || null,
      });
      if (dbErr) throw dbErr;
      onTopUpDone();
    } catch (err) {
      setError(err.message || 'Gagal top up saldo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-neutral-100 px-5 py-4 flex items-center justify-between">
          <div className="font-display text-lg">Top Up Saldo Sponsor</div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Saldo yang Diinginkan (Rp) *</label>
            <input type="number" className={inputCls} min="100000" placeholder="10000000"
              value={usable} onChange={(e) => setUsable(e.target.value)} />
            <div className="text-xs text-neutral-400 mt-1">Ini adalah saldo yang dapat digunakan untuk promo.</div>
          </div>

          {usableNum >= 100000 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Saldo promo</span>
                <span className="font-semibold">Rp {fmt(usableNum)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Management fee (10%)</span>
                <span className="font-semibold">Rp {fmt(fee)}</span>
              </div>
              <div className="border-t border-amber-200 pt-1.5 flex justify-between font-bold text-neutral-900">
                <span>Total Dibayarkan</span>
                <span>Rp {fmt(gross)}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 space-y-1">
            <p>⚠ Saldo tidak dapat ditarik kembali (withdraw).</p>
            <p>⚠ Promo yang dibatalkan tidak mengembalikan saldo ke rekening, namun saldo dapat dibuat ulang menjadi promo baru.</p>
            <p>✅ Pembayaran ke pemilik lapangan dilakukan 7 hari setelah promo berakhir.</p>
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Catatan (opsional)</label>
            <input className={inputCls} placeholder="Catatan untuk promo / kampanye" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-neutral-100 px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600">Batal</button>
          <button onClick={handleSubmit} disabled={saving || usableNum < 100000}
            className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Memproses...' : 'Konfirmasi Top Up'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PromoFormModal ────────────────────────────────────────────────────────────
function PromoFormModal({ onClose, onSaved, auth, balances, venues }) {
  const [form, setForm] = useState(EMPTY_PROMO);
  const [selectedBalance, setSelectedBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const activeBalances = balances.filter((b) => b.status === 'active' && (b.usable_balance - b.used_balance) > 0);

  const handleSubmit = async () => {
    setError('');
    if (!selectedBalance) return setError('Pilih saldo yang akan digunakan.');
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
        promo_type: 'sponsor',
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
        sponsor_balance_id: selectedBalance,
        status: 'active',
        active: true,
        description: form.description.trim() || null,
        discount_amount: form.discount_type === 'fixed' ? Number(form.discount_value) : null,
        discount_percent: form.discount_type === 'percent' ? Number(form.discount_value) : null,
      };
      const { error: dbErr } = await supabase.from('promo_codes').insert(payload);
      if (dbErr) {
        if (dbErr.code === '23505') throw new Error('Kode promo sudah digunakan.');
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
          <div className="font-display text-lg">Buat Promo Sponsor</div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Select balance */}
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Saldo yang Digunakan *</label>
            {activeBalances.length === 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Tidak ada saldo aktif. Top up saldo terlebih dahulu.
              </div>
            ) : (
              <select className={selectCls} value={selectedBalance} onChange={(e) => setSelectedBalance(e.target.value)}>
                <option value="">Pilih saldo...</option>
                {activeBalances.map((b) => (
                  <option key={b.id} value={b.id}>
                    Rp {fmt(b.usable_balance - b.used_balance)} tersisa — top up {fmtDate(b.topup_at)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Nama Promo *</label>
            <input className={inputCls} placeholder="Nama promo sponsor" value={form.name}
              onChange={(e) => { set('name', e.target.value); if (!form.code) set('code', slugify(e.target.value)); }} />
          </div>
          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Kode Promo *</label>
            <input className={`${inputCls} font-mono uppercase`} placeholder="SPONSOR50"
              value={form.code.toUpperCase()} onChange={(e) => set('code', e.target.value.trim().toLowerCase())} />
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-semibold mb-1 block">Target Venue (kosong = semua)</label>
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
                Nilai * {form.discount_type === 'percent' ? '(%)' : '(Rp)'}
              </label>
              <input type="number" className={inputCls} min="0" value={form.discount_value}
                onChange={(e) => set('discount_value', e.target.value)} />
            </div>
          </div>

          {form.discount_type === 'percent' && (
            <div>
              <label className="text-xs text-neutral-500 font-semibold mb-1 block">Maks Diskon (Rp) – opsional</label>
              <input type="number" className={inputCls} min="0" value={form.max_discount_amount}
                onChange={(e) => set('max_discount_amount', e.target.value)} />
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
            <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            Diskon yang diberikan akan dipotong dari saldo sponsor Anda. Pembayaran ke venue dilakukan 7 hari setelah promo berakhir. Promo tidak dapat dibatalkan untuk tujuan menarik saldo.
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-neutral-100 px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600">Batal</button>
          <button onClick={handleSubmit} disabled={saving || activeBalances.length === 0}
            className="flex-1 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Buat Promo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SponsorPromoPage({ auth, onBack }) {
  const [balances, setBalances] = useState([]);
  const [promos, setPromos] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [tab, setTab] = useState('balance');

  const load = useCallback(async () => {
    if (!auth?.id) return;
    setLoading(true);
    const [balRes, promoRes, venueRes] = await Promise.all([
      supabase
        .from('sponsor_promo_balance')
        .select('*')
        .eq('sponsor_user_id', auth.id)
        .order('topup_at', { ascending: false }),
      supabase
        .from('promo_codes')
        .select('*')
        .eq('promo_type', 'sponsor')
        .eq('created_by', auth.id)
        .order('created_at', { ascending: false }),
      supabase.from('venues').select('id, name, city').eq('is_active', true).order('name'),
    ]);
    setBalances(balRes.data || []);
    setPromos(promoRes.data || []);
    setVenues(venueRes.data || []);
    setLoading(false);
  }, [auth?.id]);

  useEffect(() => { load(); }, [load]);

  const handleAction = useCallback(async (id, newStatus) => {
    setActionLoading(true);
    await supabase.from('promo_codes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
    setActionLoading(false);
  }, [load]);

  const totalUsable = useMemo(() =>
    balances.filter((b) => b.status === 'active').reduce((s, b) => s + Number(b.usable_balance || 0), 0),
    [balances]);
  const totalUsed = useMemo(() =>
    balances.reduce((s, b) => s + Number(b.used_balance || 0), 0),
    [balances]);
  const totalAvailable = useMemo(() =>
    balances.filter((b) => b.status === 'active').reduce((s, b) => s + Math.max(0, Number(b.usable_balance || 0) - Number(b.used_balance || 0)), 0),
    [balances]);

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {onBack && (
            <button onClick={onBack} className="text-xs text-neutral-400 mb-2 flex items-center gap-1 hover:text-neutral-700">
              ← Kembali
            </button>
          )}
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Sponsor</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Promo Sponsor</h1>
          <p className="text-neutral-500 text-sm mt-1">Kelola saldo dan kode promo sponsor Anda.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTopUp(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 hover:border-neutral-400">
            <Wallet size={15} /> Top Up Saldo
          </button>
          <button onClick={() => setShowPromoForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800">
            <Plus size={15} /> Buat Promo
          </button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">Saldo Tersedia</div>
          <div className="text-2xl font-bold text-violet-900">Rp {fmt(totalAvailable)}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Total Top Up</div>
          <div className="text-2xl font-bold text-neutral-900">Rp {fmt(totalUsable)}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Terpakai</div>
          <div className="text-2xl font-bold text-neutral-900">Rp {fmt(totalUsed)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-2xl w-fit">
        {[['balance', 'Saldo'], ['promos', 'Promo Saya']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-xl text-sm font-bold transition ${tab === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'balance' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-neutral-400 text-sm">Memuat...</div>
          ) : balances.length === 0 ? (
            <EmptyState icon={Wallet} title="Belum ada saldo" description='Klik "Top Up Saldo" untuk mulai menggunakan promo sponsor.' />
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    {['Tgl Top Up', 'Total Dibayar', 'Biaya Mng.', 'Saldo Promo', 'Terpakai', 'Sisa', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2 text-xs text-neutral-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => {
                    const remaining = Math.max(0, Number(b.usable_balance) - Number(b.used_balance));
                    return (
                      <tr key={b.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition">
                        <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtDate(b.topup_at)}</td>
                        <td className="px-4 py-2.5 font-semibold text-neutral-900">Rp {fmt(b.topup_gross)}</td>
                        <td className="px-4 py-2.5 text-xs text-amber-700">Rp {fmt(b.management_fee)}</td>
                        <td className="px-4 py-2.5 font-semibold text-neutral-900">Rp {fmt(b.usable_balance)}</td>
                        <td className="px-4 py-2.5 text-xs text-red-600">Rp {fmt(b.used_balance)}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-700">Rp {fmt(remaining)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            b.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            b.status === 'exhausted' ? 'bg-neutral-100 text-neutral-500' :
                            'bg-red-100 text-red-600'
                          }`}>{b.status}</span>
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

      {tab === 'promos' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-neutral-400 text-sm">Memuat...</div>
          ) : promos.length === 0 ? (
            <EmptyState icon={Tag} title="Belum ada promo" description='Klik "Buat Promo" untuk membuat kode promo dari saldo Anda.' />
          ) : (
            <div className="space-y-3">
              {promos.map((p) => {
                const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
                const effectiveStatus = isExpired && p.status === 'active' ? 'expired' : p.status;
                const isTerminal = effectiveStatus === 'expired' || effectiveStatus === 'cancelled';
                const discountLabel = p.discount_type === 'percent'
                  ? `${p.discount_value}%${p.max_discount_amount ? ` (maks Rp ${fmt(p.max_discount_amount)})` : ''}`
                  : `Rp ${fmt(p.discount_value)}`;
                const usedLabel = p.quota ? `${p.used_count || 0}/${p.quota}` : `${p.used_count || 0}`;

                return (
                  <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-900 text-sm">{p.name || p.code}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[effectiveStatus] || 'bg-neutral-100 text-neutral-600'}`}>
                            {effectiveStatus}
                          </span>
                        </div>
                        {p.description && <div className="text-xs text-neutral-400 mt-0.5">{p.description}</div>}
                      </div>
                      {!isTerminal && (
                        <div className="flex gap-1 shrink-0">
                          {p.status === 'active' && (
                            <button title="Jeda" disabled={actionLoading} onClick={() => handleAction(p.id, 'paused')}
                              className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600 disabled:opacity-40">
                              <Pause size={14} />
                            </button>
                          )}
                          {p.status === 'paused' && (
                            <button title="Aktifkan" disabled={actionLoading} onClick={() => handleAction(p.id, 'active')}
                              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 disabled:opacity-40">
                              <Play size={14} />
                            </button>
                          )}
                          {/* Note: cancelling doesn't refund balance, just marks cancelled */}
                          <button title="Batalkan (saldo tidak dikembalikan ke rekening)" disabled={actionLoading}
                            onClick={() => {
                              if (window.confirm('Batalkan promo ini? Saldo tidak dikembalikan ke rekening, namun dapat digunakan untuk promo baru.'))
                                handleAction(p.id, 'cancelled');
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-40">
                            <Ban size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <code className="block bg-neutral-100 px-3 py-1 rounded-lg text-sm font-mono font-bold text-neutral-900 w-fit tracking-wider">
                      {p.code?.toUpperCase()}
                    </code>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><div className="text-neutral-400">Diskon</div><div className="font-semibold text-neutral-900">{discountLabel}</div></div>
                      <div><div className="text-neutral-400">Pemakaian</div><div className="font-semibold text-neutral-900">{usedLabel}</div></div>
                      <div><div className="text-neutral-400">Mulai</div><div className="font-semibold text-neutral-900">{fmtDate(p.valid_from)}</div></div>
                      <div><div className="text-neutral-400">Berakhir</div><div className={`font-semibold ${isExpired ? 'text-red-600' : 'text-neutral-900'}`}>{fmtDate(p.valid_until) || '—'}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showTopUp && (
        <TopUpModal auth={auth} onClose={() => setShowTopUp(false)} onTopUpDone={() => { setShowTopUp(false); load(); }} />
      )}
      {showPromoForm && (
        <PromoFormModal auth={auth} balances={balances} venues={venues}
          onClose={() => setShowPromoForm(false)}
          onSaved={() => { setShowPromoForm(false); load(); }} />
      )}
    </div>
  );
}
