import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Receipt, CreditCard, Wallet, ArrowUpRight, Download, Search, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EmptyState, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';
import { getDokuPaymentHistory } from '../../../../services/supabaseService.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtK(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return `${v}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

const RANGES = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'custom', label: 'Custom' },
];

function getRange(key, customStart, customEnd) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const todayStr = isoDate(new Date());
  switch (key) {
    case 'today': return { from: todayStr, to: todayStr };
    case '7d': return { from: isoDate(addDays(new Date(), -6)), to: todayStr };
    case '30d': return { from: isoDate(addDays(new Date(), -29)), to: todayStr };
    case 'month': return { from: isoDate(startOfMonth(new Date())), to: todayStr };
    case 'custom': return { from: customStart || isoDate(addDays(new Date(), -29)), to: customEnd || todayStr };
    default: return { from: todayStr, to: todayStr };
  }
}

// ── Custom Tooltip for chart ───────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-3 py-2 shadow-md text-sm">
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      <div className="font-bold text-neutral-900">Rp {fmt(payload[0]?.value)}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueFinancePage({ auth, venue }) {
  const venueId = venue?.id;
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [tab, setTab] = useState('overview');

  // Data
  const [bookings, setBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [dokuTransactions, setDokuTransactions] = useState([]);
  const [dokuLoading, setDokuLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => getRange(range, customStart, customEnd), [range, customStart, customEnd]);

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [bookRes, invRes, shiftRes, discRes] = await Promise.all([
        supabase
          .from('venue_bookings')
          .select('id, booking_date, total_price, payment_status, payment_method, customer_name, customer_phone, status')
          .eq('venue_id', venueId)
          .gte('booking_date', from)
          .lte('booking_date', to)
          .order('booking_date', { ascending: false }),

        supabase
          .from('venue_invoices')
          .select('id, invoice_number, customer_name, customer_phone, total, subtotal, status, issued_at, items')
          .in('booking_id',
            // We'll join after we have booking ids — for now get all invoices for this venue via booking join
            // Use RPC or just do a separate join query
            (await supabase
              .from('venue_bookings')
              .select('id')
              .eq('venue_id', venueId)
              .gte('booking_date', from)
              .lte('booking_date', to)
            ).data?.map(b => b.id) || []
          )
          .order('issued_at', { ascending: false })
          .limit(100),

        supabase
          .from('venue_shifts')
          .select('id, start_time, end_time, status, total_cash, total_qris, total_transfer, total_revenue, closed_at')
          .eq('venue_id', venueId)
          .gte('start_time', from + 'T00:00:00')
          .lte('start_time', to + 'T23:59:59')
          .order('start_time', { ascending: false }),

        supabase
          .from('membership_discount_log')
          .select('booking_id, discount_amount, original_price, final_price, discount_percent')
          .in('booking_id',
            (await supabase
              .from('venue_bookings')
              .select('id')
              .eq('venue_id', venueId)
              .gte('booking_date', from)
              .lte('booking_date', to)
            ).data?.map(b => b.id) || []
          ),
      ]);

      setBookings(bookRes.data || []);
      setInvoices(invRes.data || []);
      setShifts(shiftRes.data || []);
      setDiscounts(discRes.data || []);
    } catch (err) {
      console.error('Finance load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId, from, to]);

  const loadDokuTransactions = useCallback(async () => {
    if (!venueId) return;
    setDokuLoading(true);
    try {
      const { data } = await getDokuPaymentHistory(venueId, { limit: 100 });
      setDokuTransactions(data || []);
    } catch (err) {
      console.error('DOKU history load error:', err.message);
    } finally {
      setDokuLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'doku') loadDokuTransactions(); }, [tab, loadDokuTransactions]);

  // ── Derived metrics ───────────────────────────────────────────────────────────

  const paidBookings = useMemo(() => bookings.filter(b => b.payment_status === 'paid'), [bookings]);

  const totalRevenue = useMemo(() => paidBookings.reduce((s, b) => s + Number(b.total_price || 0), 0), [paidBookings]);
  const totalDiscount = useMemo(() => discounts.reduce((s, d) => s + Number(d.discount_amount || 0), 0), [discounts]);
  const totalInvoices = invoices.filter(i => i.status !== 'voided').length;

  const paymentMethodBreakdown = useMemo(() => {
    const methods = { cash: 0, qris: 0, transfer: 0 };
    paidBookings.forEach(b => {
      const m = b.payment_method || 'cash';
      if (methods[m] !== undefined) methods[m] += Number(b.total_price || 0);
      else methods.cash += Number(b.total_price || 0);
    });
    return methods;
  }, [paidBookings]);

  // Daily revenue chart data
  const dailyRevenue = useMemo(() => {
    const map = {};
    // Build date range keys
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const key = isoDate(d);
      map[key] = { date: key, revenue: 0, label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) };
    }
    paidBookings.forEach(b => {
      if (map[b.booking_date]) map[b.booking_date].revenue += Number(b.total_price || 0);
    });
    return Object.values(map);
  }, [paidBookings, from, to]);

  // ── filtered invoices ─────────────────────────────────────────────────────────

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return invoices;
    const q = invoiceSearch.toLowerCase();
    return invoices.filter(i =>
      i.invoice_number?.toLowerCase().includes(q) ||
      i.customer_name?.toLowerCase().includes(q) ||
      i.customer_phone?.includes(q)
    );
  }, [invoices, invoiceSearch]);

  // ── Shift revenue (from shifts table) ────────────────────────────────────────
  const closedShifts = useMemo(() => shifts.filter(s => s.status === 'closed'), [shifts]);
  const shiftRevenue = useMemo(() => closedShifts.reduce((s, sh) => s + Number(sh.total_revenue || 0), 0), [closedShifts]);

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={TrendingUp} title="Belum ada venue" description="Daftarkan venue terlebih dahulu." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Keuangan</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Laporan Keuangan</h1>
          <p className="text-neutral-500 text-sm mt-1">Pendapatan, invoice, dan riwayat shift kasir.</p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl flex-wrap">
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${range === r.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
            >{r.label}</button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className={`${inputCls} w-40`} value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-neutral-400 text-sm">—</span>
            <input type="date" className={`${inputCls} w-40`} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        )}
        {loading && <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Total Pendapatan" value={`Rp ${fmt(totalRevenue)}`} sub={`${paidBookings.length} booking lunas`} color="emerald" />
        <KpiCard icon={Receipt} label="Invoice Diterbitkan" value={totalInvoices} sub={`${invoices.filter(i => i.status === 'voided').length} dibatalkan`} color="blue" />
        <KpiCard icon={Wallet} label="Penghematan Member" value={`Rp ${fmt(totalDiscount)}`} sub={`${discounts.length} transaksi diskon`} color="violet" />
        <KpiCard icon={CreditCard} label="Shift Selesai" value={closedShifts.length} sub={shiftRevenue > 0 ? `Rp ${fmtK(shiftRevenue)} via shift` : 'No shift revenue'} color="amber" />
      </div>

      {/* Payment method breakdown */}
      <div className="grid md:grid-cols-3 gap-3">
        {[['cash', 'Tunai', 'bg-emerald-100 text-emerald-700'], ['qris', 'QRIS', 'bg-blue-100 text-blue-700'], ['transfer', 'Transfer', 'bg-violet-100 text-violet-700']].map(([key, label, cls]) => {
          const val = paymentMethodBreakdown[key] || 0;
          const pct = totalRevenue > 0 ? Math.round((val / totalRevenue) * 100) : 0;
          return (
            <div key={key} className="rounded-2xl border border-neutral-200 bg-white p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-2xl ${cls} flex items-center justify-center text-sm font-bold shrink-0`}>{pct}%</div>
              <div>
                <div className="text-xs text-neutral-400 uppercase tracking-wide mb-0.5">{label}</div>
                <div className="font-bold text-neutral-900">Rp {fmt(val)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + tabs */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center gap-1 p-3 border-b border-neutral-100 flex-wrap">
          {[['overview', 'Grafik Pendapatan'], ['invoices', 'Invoice'], ['shifts', 'Shift'], ['doku', '🌐 DOKU Online']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${tab === k ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ── Chart ── */}
          {tab === 'overview' && (
            dailyRevenue.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Belum ada data" description="Tidak ada booking lunas pada periode ini." />
            ) : (
              <div>
                <div className="text-xs text-neutral-400 mb-3">Pendapatan harian (Rp)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyRevenue} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      interval={dailyRevenue.length > 14 ? Math.floor(dailyRevenue.length / 10) : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtK}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="#10b981">
                      {dailyRevenue.map((entry, i) => (
                        <Cell key={i} fill={entry.revenue > 0 ? '#10b981' : '#e5e7eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {/* ── Invoices ── */}
          {tab === 'invoices' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Cari nomor invoice, nama, atau telepon..."
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                />
              </div>
              {filteredInvoices.length === 0 ? (
                <EmptyState icon={Receipt} title="Tidak ada invoice" description="Belum ada invoice pada periode ini." />
              ) : (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">No Invoice</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Customer</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Tanggal</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold text-right">Total</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition">
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-700">{inv.invoice_number}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-neutral-900">{inv.customer_name || '—'}</div>
                            <div className="text-xs text-neutral-400">{inv.customer_phone || ''}</div>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500 text-xs">{fmtDate(inv.issued_at)}</td>
                          <td className="px-4 py-2.5 font-semibold text-neutral-900 text-right">Rp {fmt(inv.total)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              inv.status === 'issued' || inv.status === 'printed' ? 'bg-emerald-100 text-emerald-700' :
                              inv.status === 'voided' ? 'bg-red-100 text-red-600' :
                              'bg-neutral-100 text-neutral-600'
                            }`}>{inv.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── DOKU Transactions ── */}
          {tab === 'doku' && (
            <div className="space-y-3">
              {dokuLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-neutral-500">Memuat transaksi DOKU...</span>
                </div>
              ) : dokuTransactions.length === 0 ? (
                <EmptyState icon={Globe} title="Belum ada transaksi DOKU" description="Transaksi pembayaran online via DOKU akan muncul di sini." />
              ) : (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Order ID</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Customer</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Tanggal</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold text-right">Jumlah</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Status</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Metode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dokuTransactions.map(tx => (
                        <tr key={tx.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition">
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-600 max-w-[140px] truncate">{tx.doku_order_id}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-neutral-900">{tx.customer_name || '—'}</div>
                            <div className="text-xs text-neutral-400">{tx.customer_email || ''}</div>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500 text-xs">{fmtDate(tx.created_at)}</td>
                          <td className="px-4 py-2.5 font-semibold text-neutral-900 text-right">Rp {fmt(tx.amount)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              tx.status === 'failed' || tx.status === 'expired' ? 'bg-red-100 text-red-600' :
                              tx.status === 'awaiting' || tx.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-neutral-100 text-neutral-600'
                            }`}>{tx.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-neutral-500">{tx.payment_method || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Summary */}
              {dokuTransactions.length > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <span className="text-sm font-semibold text-neutral-600">
                    {dokuTransactions.filter(t => t.status === 'completed').length} transaksi selesai
                  </span>
                  <span className="font-bold text-neutral-900">
                    Total: Rp {fmt(dokuTransactions.filter(t => t.status === 'completed').reduce((s, t) => s + Number(t.amount || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Shifts ── */}
          {tab === 'shifts' && (
            <div className="space-y-2">
              {shifts.length === 0 ? (
                <EmptyState icon={CreditCard} title="Belum ada shift" description="Shift kasir belum tercatat pada periode ini." />
              ) : (
                <>
                  {shifts.map(s => (
                    <div key={s.id} className={`rounded-2xl border p-4 flex items-center gap-4 ${s.status === 'open' ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-white'}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'open' ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-900 text-sm">
                            {new Date(s.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '}
                            {new Date(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>
                            {s.status === 'open' ? 'Aktif' : 'Selesai'}
                          </span>
                        </div>
                        {s.status === 'closed' && (
                          <div className="text-xs text-neutral-400 mt-0.5">
                            Tutup: {s.closed_at ? new Date(s.closed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                        )}
                      </div>
                      {s.status === 'closed' && (
                        <div className="text-right shrink-0">
                          <div className="font-bold text-neutral-900">Rp {fmt(s.total_revenue)}</div>
                          <div className="text-xs text-neutral-400">
                            T:{fmtK(s.total_cash)} Q:{fmtK(s.total_qris)} Tf:{fmtK(s.total_transfer)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Shift total summary */}
                  {closedShifts.length > 0 && (
                    <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-600">{closedShifts.length} shift selesai</div>
                      <div className="font-bold text-neutral-900">Total: Rp {fmt(shiftRevenue)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className={`w-9 h-9 rounded-2xl ${colors[color] || colors.emerald} flex items-center justify-center mb-3`}>
        <Icon size={15} />
      </div>
      <div className="text-xl font-bold text-neutral-900 leading-tight">{value}</div>
      <div className="text-xs text-neutral-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-neutral-400 mt-1">{sub}</div>}
    </div>
  );
}
