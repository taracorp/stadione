import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Receipt, CreditCard, Wallet, ArrowUpRight, Download, Search, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EmptyState, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';
import { fetchDokuTransactions } from '../../../../services/supabaseService.js';

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
  const [dokuSearch, setDokuSearch] = useState('');
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('all');
  const [dokuStatusFilter, setDokuStatusFilter] = useState('all');
  const [tab, setTab] = useState('overview');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [approvalRefInputs, setApprovalRefInputs] = useState({});
  const [approvalLoading, setApprovalLoading] = useState(new Set());

  // Data
  const [bookings, setBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [allConfirmedPayments, setAllConfirmedPayments] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [dokuTransactions, setDokuTransactions] = useState([]);
  const [dokuLoading, setDokuLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => getRange(range, customStart, customEnd), [range, customStart, customEnd]);

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [bookingIdsInRangeRes, allShiftIdsRes] = await Promise.all([
        supabase
          .from('venue_bookings')
          .select('id')
          .eq('venue_id', venueId)
          .gte('booking_date', from)
          .lte('booking_date', to),
        supabase
          .from('venue_shifts')
          .select('id')
          .eq('venue_id', venueId),
      ]);

      const bookingIdsInRange = bookingIdsInRangeRes.data?.map((b) => b.id) || [];
      const allShiftIds = allShiftIdsRes.data?.map((s) => s.id) || [];

      const [bookRes, invRes, shiftRes, discRes, dokuRes] = await Promise.all([
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
          .in('booking_id', bookingIdsInRange.length ? bookingIdsInRange : ['00000000-0000-0000-0000-000000000000'])
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
          .in('booking_id', bookingIdsInRange.length ? bookingIdsInRange : ['00000000-0000-0000-0000-000000000000']),

        fetchDokuTransactions(venueId),
      ]);

      const [paymentsRes, withdrawalsRes] = await Promise.all([
        allShiftIds.length
          ? supabase
              .from('venue_payments')
              .select('id, amount, method, split_cash, split_qris, split_transfer, status, created_at, shift_id, booking_id, notes')
              .in('shift_id', allShiftIds)
              .eq('status', 'confirmed')
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('venue_owner_withdrawals')
          .select('id, amount, status, bank_name, account_name, account_number, note, requested_at, processed_at, transfer_reference')
          .eq('venue_id', venueId)
          .order('requested_at', { ascending: false })
          .limit(100),
      ]);

      setBookings(bookRes.data || []);
      setInvoices(invRes.data || []);
      setShifts(shiftRes.data || []);
      setDiscounts(discRes.data || []);
      setDokuTransactions(dokuRes.data || []);
      setAllConfirmedPayments(paymentsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
    } catch (err) {
      console.error('Finance load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId, from, to]);

  useEffect(() => { load(); }, [load]);

  // ── Derived metrics ───────────────────────────────────────────────────────────

  const paidBookings = useMemo(() => bookings.filter(b => b.payment_status === 'paid'), [bookings]);

  const totalRevenue = useMemo(() => paidBookings.reduce((s, b) => s + Number(b.total_price || 0), 0), [paidBookings]);
  const totalDiscount = useMemo(() => discounts.reduce((s, d) => s + Number(d.discount_amount || 0), 0), [discounts]);
  const totalInvoices = invoices.filter(i => i.status !== 'voided').length;

  const paymentMethodBreakdown = useMemo(() => {
    const methods = {
      cash: 0,
      qris: 0,
      transfer: 0,
      doku: 0,
      voucher_full: 0,
      free_voucher: 0,
    };

    allConfirmedPayments.forEach((payment) => {
      const amount = Number(payment.amount || 0);
      const splitCash = Number(payment.split_cash || 0);
      const splitQris = Number(payment.split_qris || 0);
      const splitTransfer = Number(payment.split_transfer || 0);
      const method = String(payment.method || '').toLowerCase();

      if (method === 'split') {
        methods.cash += splitCash;
        methods.qris += splitQris;
        methods.transfer += splitTransfer;
        return;
      }

      if (method === 'cash' || method === 'qris' || method === 'transfer' || method === 'doku' || method === 'voucher_full' || method === 'free_voucher') {
        methods[method] += amount;
        return;
      }

      methods.cash += amount;
    });

    return methods;
  }, [allConfirmedPayments]);

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

  const filteredDokuTransactions = useMemo(() => {
    const q = dokuSearch.trim().toLowerCase();
    return dokuTransactions.filter((tx) => {
      const matchesStatus = dokuStatusFilter === 'all' || tx.status === dokuStatusFilter;
      const haystack = `${tx.doku_order_id || ''} ${tx.customer_name || ''} ${tx.customer_phone || ''}`.toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [dokuTransactions, dokuSearch, dokuStatusFilter]);

  const filteredVoucherPayments = useMemo(() => {
    const q = voucherSearch.trim().toLowerCase();

    return allConfirmedPayments.filter((payment) => {
      const method = String(payment.method || '').toLowerCase();
      const isVoucherMethod = method === 'voucher_full' || method === 'free_voucher';
      if (!isVoucherMethod) return false;

      const matchesType = voucherTypeFilter === 'all' || method === voucherTypeFilter;
      if (!matchesType) return false;

      const haystack = `${payment.booking_id || ''} ${payment.notes || ''} ${payment.id || ''}`.toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      return matchesSearch;
    });
  }, [allConfirmedPayments, voucherSearch, voucherTypeFilter]);

  // ── Role helpers ─────────────────────────────────────────────────────────────
  const isFinanceAdmin = useMemo(() => {
    const roles = auth?.roles || [];
    return roles.some((r) => ['super_admin', 'platform_admin', 'internal_admin', 'finance_admin'].includes(r));
  }, [auth?.roles]);

  const isOwner = useMemo(() => {
    return venue?.owner_user_id && auth?.id && venue.owner_user_id === auth.id;
  }, [venue?.owner_user_id, auth?.id]);

  const updateWithdrawalStatus = useCallback(async (withdrawalId, newStatus, transferRef) => {
    setApprovalLoading((prev) => new Set([...prev, withdrawalId]));
    try {
      const payload = { status: newStatus, processed_by: auth?.id, processed_at: new Date().toISOString() };
      if (newStatus === 'paid' && transferRef) payload.transfer_reference = String(transferRef).trim();
      const { error } = await supabase
        .from('venue_owner_withdrawals')
        .update(payload)
        .eq('id', withdrawalId);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error('updateWithdrawalStatus error:', err.message);
    } finally {
      setApprovalLoading((prev) => { const s = new Set(prev); s.delete(withdrawalId); return s; });
    }
  }, [auth?.id, load]);

  const exportBalanceCsv = useCallback(() => {
    // Build per-date breakdown from allConfirmedPayments
    const dateMap = {};
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const key = isoDate(d);
      dateMap[key] = { date: key, cash: 0, stadione: 0, voucher: 0 };
    }

    allConfirmedPayments.forEach((p) => {
      const key = (p.created_at || '').slice(0, 10);
      if (!dateMap[key]) dateMap[key] = { date: key, cash: 0, stadione: 0, voucher: 0 };
      const amount = Number(p.amount || 0);
      const splitCash = Number(p.split_cash || 0);
      const splitQris = Number(p.split_qris || 0);
      const splitTransfer = Number(p.split_transfer || 0);
      const method = String(p.method || '').toLowerCase();

      if (method === 'cash') { dateMap[key].cash += amount; }
      else if (method === 'split') {
        dateMap[key].cash += splitCash;
        const nonCash = splitQris + splitTransfer;
        dateMap[key].stadione += nonCash > 0 ? nonCash : Math.max(0, amount - splitCash);
      } else if (method === 'qris' || method === 'transfer' || method === 'doku') {
        dateMap[key].stadione += amount;
      } else if (method === 'voucher_full' || method === 'free_voucher') {
        dateMap[key].voucher += amount;
      }
    });

    const header = ['Tanggal', 'Cash Kasir (Rp)', 'Saldo Stadione (Rp)', 'Voucher / Gratis (Rp)', 'Total (Rp)'];
    const rows = Object.values(dateMap).map((row) => [
      row.date,
      row.cash,
      row.stadione,
      row.voucher,
      row.cash + row.stadione,
    ]);

    // Totals row
    const totals = rows.reduce(
      (acc, r) => [acc[0], acc[1] + r[1], acc[2] + r[2], acc[3] + r[3], acc[4] + r[4]],
      ['TOTAL', 0, 0, 0, 0],
    );
    rows.push(totals);

    // Withdraw info block
    rows.push([]);
    rows.push(['=== RINGKASAN WITHDRAW ===']);
    rows.push(['Saldo Gross Stadione (Rp)', balanceSummary.stadioneGross]);
    rows.push(['Withdraw Terkunci/Terbayar (Rp)', balanceSummary.withdrawnOrReserved]);
    rows.push(['Tersedia untuk Withdraw (Rp)', balanceSummary.availableForWithdraw]);
    rows.push(['Cash Kasir Operasional (Rp)', balanceSummary.cashierCash]);
    rows.push(['Periode', `${from} s/d ${to}`]);
    rows.push(['Diekspor pada', new Date().toLocaleString('id-ID')]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saldo-vs-cash-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [allConfirmedPayments, balanceSummary, from, to]);

  const exportVoucherCSV = useCallback(() => {
    if (!filteredVoucherPayments.length) return;

    const header = ['Waktu', 'Booking ID', 'Payment ID', 'Metode', 'Nominal', 'Catatan'];
    const rows = filteredVoucherPayments.map((p) => [
      p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : '',
      p.booking_id || '',
      p.id || '',
      p.method || '',
      Number(p.amount || 0),
      String(p.notes || '').replace(/,/g, ' '),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    const typeSuffix = voucherTypeFilter !== 'all' ? `-${voucherTypeFilter}` : '';
    link.href = url;
    link.download = `voucher-audit${typeSuffix}-${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredVoucherPayments, voucherTypeFilter]);

  const voucherSummary = useMemo(() => {
    const summary = {
      totalCount: filteredVoucherPayments.length,
      totalAmount: 0,
      voucherFullCount: 0,
      voucherFullAmount: 0,
      freeVoucherCount: 0,
      freeVoucherAmount: 0,
    };

    filteredVoucherPayments.forEach((payment) => {
      const method = String(payment.method || '').toLowerCase();
      const amount = Number(payment.amount || 0);

      summary.totalAmount += amount;

      if (method === 'voucher_full') {
        summary.voucherFullCount += 1;
        summary.voucherFullAmount += amount;
      }

      if (method === 'free_voucher') {
        summary.freeVoucherCount += 1;
        summary.freeVoucherAmount += amount;
      }
    });

    return summary;
  }, [filteredVoucherPayments]);

  // ── Shift revenue (from shifts table) ────────────────────────────────────────
  const closedShifts = useMemo(() => shifts.filter(s => s.status === 'closed'), [shifts]);
  const shiftRevenue = useMemo(() => closedShifts.reduce((s, sh) => s + Number(sh.total_revenue || 0), 0), [closedShifts]);

  const balanceSummary = useMemo(() => {
    let cashierCash = 0;
    let stadioneGross = 0;

    allConfirmedPayments.forEach((payment) => {
      const amount = Number(payment.amount || 0);
      const splitCash = Number(payment.split_cash || 0);
      const splitQris = Number(payment.split_qris || 0);
      const splitTransfer = Number(payment.split_transfer || 0);

      if (payment.method === 'cash') {
        cashierCash += amount;
        return;
      }

      if (payment.method === 'split') {
        cashierCash += splitCash;
        const resolvedNonCash = splitQris + splitTransfer;
        stadioneGross += resolvedNonCash > 0 ? resolvedNonCash : Math.max(0, amount - splitCash);
        return;
      }

      if (payment.method === 'qris' || payment.method === 'transfer' || payment.method === 'doku') {
        stadioneGross += amount;
      }
    });

    const reservedStatuses = new Set(['pending', 'approved', 'processing', 'paid']);
    const withdrawnOrReserved = withdrawals
      .filter((entry) => reservedStatuses.has(String(entry.status || '').toLowerCase()))
      .reduce((total, entry) => total + Number(entry.amount || 0), 0);

    const availableForWithdraw = Math.max(0, stadioneGross - withdrawnOrReserved);

    return {
      cashierCash,
      stadioneGross,
      withdrawnOrReserved,
      availableForWithdraw,
    };
  }, [allConfirmedPayments, withdrawals]);

  const canSubmitWithdraw = useMemo(() => {
    const amount = Number(withdrawAmount || 0);
    return (
      amount > 0
      && amount <= balanceSummary.availableForWithdraw
      && String(withdrawBankName || '').trim()
      && String(withdrawAccountName || '').trim()
      && String(withdrawAccountNumber || '').trim()
      && !withdrawSubmitting
    );
  }, [withdrawAmount, withdrawBankName, withdrawAccountName, withdrawAccountNumber, withdrawSubmitting, balanceSummary.availableForWithdraw]);

  const submitWithdrawRequest = useCallback(async () => {
    setWithdrawError('');
    const amount = Number(withdrawAmount || 0);

    if (!auth?.id) {
      setWithdrawError('Sesi owner tidak ditemukan. Silakan login ulang.');
      return;
    }

    if (!amount || amount <= 0) {
      setWithdrawError('Nominal withdraw harus lebih besar dari 0.');
      return;
    }

    if (amount > balanceSummary.availableForWithdraw) {
      setWithdrawError('Nominal withdraw melebihi saldo Stadione yang tersedia.');
      return;
    }

    try {
      setWithdrawSubmitting(true);
      const payload = {
        venue_id: venueId,
        amount,
        status: 'pending',
        bank_name: withdrawBankName.trim(),
        account_name: withdrawAccountName.trim(),
        account_number: withdrawAccountNumber.trim(),
        note: String(withdrawNote || '').trim() || null,
        requested_by: auth.id,
      };

      const { error } = await supabase
        .from('venue_owner_withdrawals')
        .insert(payload);

      if (error) throw error;

      setWithdrawAmount('');
      setWithdrawBankName('');
      setWithdrawAccountName('');
      setWithdrawAccountNumber('');
      setWithdrawNote('');
      await load();
    } catch (error) {
      setWithdrawError(error?.message || 'Gagal membuat request withdraw.');
    } finally {
      setWithdrawSubmitting(false);
    }
  }, [auth?.id, balanceSummary.availableForWithdraw, load, venueId, withdrawAccountName, withdrawAccountNumber, withdrawAmount, withdrawBankName, withdrawNote]);

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

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Saldo Stadione</div>
          <div className="text-2xl font-bold text-blue-900">Rp {fmt(balanceSummary.availableForWithdraw)}</div>
          <div className="text-xs text-blue-700 mt-1">
            Gross non-cash: Rp {fmt(balanceSummary.stadioneGross)} · Sudah/terkunci withdraw: Rp {fmt(balanceSummary.withdrawnOrReserved)}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Cash Di Kasir</div>
          <div className="text-2xl font-bold text-emerald-900">Rp {fmt(balanceSummary.cashierCash)}</div>
          <div className="text-xs text-emerald-700 mt-1">
            Nilai ini hanya catatan kas operasional venue dan tidak ikut proses withdraw Stadione.
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportBalanceCsv}
          disabled={allConfirmedPayments.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 hover:border-neutral-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Export Laporan Saldo CSV
        </button>
      </div>

      {/* Payment method breakdown */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['cash', 'Tunai', 'bg-emerald-100 text-emerald-700'],
          ['qris', 'QRIS', 'bg-blue-100 text-blue-700'],
          ['transfer', 'Transfer', 'bg-violet-100 text-violet-700'],
          ['doku', 'DOKU', 'bg-amber-100 text-amber-700'],
          ['voucher_full', 'Voucher Full', 'bg-teal-100 text-teal-700'],
          ['free_voucher', 'Free Voucher', 'bg-cyan-100 text-cyan-700'],
        ].map(([key, label, cls]) => {
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
          {[['overview', 'Grafik Pendapatan'], ['invoices', 'Invoice'], ['shifts', 'Shift'], ['doku', 'DOKU'], ['voucher', 'Voucher'], ['withdraw', 'Withdraw']].map(([k, l]) => (
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

          {tab === 'doku' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder="Cari order/customer/telepon..."
                    value={dokuSearch}
                    onChange={(e) => setDokuSearch(e.target.value)}
                  />
                </div>
                <select
                  className={`${selectCls} w-44`}
                  value={dokuStatusFilter}
                  onChange={(e) => setDokuStatusFilter(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {filteredDokuTransactions.length === 0 ? (
                <EmptyState icon={ExternalLink} title="Belum ada transaksi DOKU" description="Transaksi DOKU akan muncul setelah konfigurasi dan checkout dibuat." />
              ) : (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Order</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Customer</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Jumlah</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Status</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Waktu</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDokuTransactions.map(tx => (
                        <tr key={tx.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition">
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-700">{tx.doku_order_id || tx.id}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-neutral-900">{tx.customer_name || '—'}</div>
                            <div className="text-xs text-neutral-400">{tx.customer_phone || ''}</div>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-neutral-900">Rp {fmt(tx.amount || tx.price)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              tx.status === 'refunded' ? 'bg-violet-100 text-violet-700' :
                              tx.status === 'failed' || tx.status === 'expired' || tx.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}>{tx.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500 text-xs">{fmtDate(tx.created_at)}</td>
                          <td className="px-4 py-2.5">
                            {tx.checkout_url ? (
                              <button
                                type="button"
                                onClick={() => window.open(tx.checkout_url, '_blank')}
                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
                                title={tx.status === 'pending' ? 'Lanjutkan checkout' : 'Buka checkout'}
                              >
                                <ExternalLink size={12} />
                                {tx.status === 'pending' ? 'Lanjutkan' : 'Buka'}
                              </button>
                            ) : (
                              <span className="text-xs text-neutral-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'voucher' && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Transaksi Voucher</div>
                  <div className="text-2xl font-bold text-neutral-900">{voucherSummary.totalCount}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Nominal Voucher</div>
                  <div className="text-2xl font-bold text-neutral-900">Rp {fmt(voucherSummary.totalAmount)}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Breakdown Tipe</div>
                  <div className="text-xs text-neutral-600 space-y-1">
                    <div>Voucher Full: {voucherSummary.voucherFullCount} trx · Rp {fmt(voucherSummary.voucherFullAmount)}</div>
                    <div>Free Voucher: {voucherSummary.freeVoucherCount} trx · Rp {fmt(voucherSummary.freeVoucherAmount)}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    className={`${inputCls} pl-9`}
                    placeholder="Cari booking id / catatan voucher..."
                    value={voucherSearch}
                    onChange={(e) => setVoucherSearch(e.target.value)}
                  />
                </div>
                <select
                  className={`${selectCls} w-48`}
                  value={voucherTypeFilter}
                  onChange={(e) => setVoucherTypeFilter(e.target.value)}
                >
                  <option value="all">Semua Voucher</option>
                  <option value="voucher_full">Voucher Full</option>
                  <option value="free_voucher">Free Voucher</option>
                </select>
                <button
                  type="button"
                  disabled={filteredVoucherPayments.length === 0}
                  onClick={exportVoucherCSV}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 hover:border-neutral-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {filteredVoucherPayments.length === 0 ? (
                <EmptyState icon={Wallet} title="Belum ada transaksi voucher" description="Transaksi voucher_full/free_voucher akan tampil di sini." />
              ) : (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Waktu</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Booking ID</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Metode</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold text-right">Nominal</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVoucherPayments.map((payment) => (
                        <tr key={payment.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition">
                          <td className="px-4 py-2.5 text-neutral-500 text-xs">{fmtDate(payment.created_at)}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-neutral-700">{payment.booking_id}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${payment.method === 'voucher_full' ? 'bg-teal-100 text-teal-700' : 'bg-cyan-100 text-cyan-700'}`}>
                              {payment.method}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-neutral-900 text-right">Rp {fmt(payment.amount)}</td>
                          <td className="px-4 py-2.5 text-xs text-neutral-500">{payment.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'withdraw' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-900 mb-3">Request Withdraw Saldo Stadione</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Nominal</div>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      placeholder="Masukkan nominal"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <div className="text-xs text-neutral-400 mt-1">Maksimal: Rp {fmt(balanceSummary.availableForWithdraw)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Bank Tujuan</div>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Contoh: BCA"
                      value={withdrawBankName}
                      onChange={(e) => setWithdrawBankName(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Nama Rekening</div>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Nama pemilik rekening"
                      value={withdrawAccountName}
                      onChange={(e) => setWithdrawAccountName(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Nomor Rekening</div>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Nomor rekening"
                      value={withdrawAccountNumber}
                      onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs text-neutral-500 mb-1">Catatan (Opsional)</div>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Catatan untuk tim finance"
                      value={withdrawNote}
                      onChange={(e) => setWithdrawNote(e.target.value)}
                    />
                  </div>
                </div>

                {withdrawError ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{withdrawError}</div>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-xs text-neutral-500">
                    Withdraw hanya memotong saldo Stadione. Cash kasir tetap sebagai catatan operasional venue.
                  </div>
                  <button
                    type="button"
                    disabled={!canSubmitWithdraw}
                    onClick={submitWithdrawRequest}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold ${canSubmitWithdraw ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'}`}
                  >
                    {withdrawSubmitting ? 'Memproses...' : 'Ajukan Withdraw'}
                  </button>
                </div>
              </div>

              {withdrawals.length === 0 ? (
                <EmptyState icon={ArrowUpRight} title="Belum ada request withdraw" description="Request withdraw owner akan tercatat di sini." />
              ) : (
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Tanggal</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Nominal</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Rekening</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Status</th>
                        <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Referensi</th>
                        {(isFinanceAdmin || isOwner) && (
                          <th className="px-4 py-2 text-xs text-neutral-400 font-semibold">Aksi</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((entry) => {
                        const status = String(entry.status || '').toLowerCase();
                        const isProcessing = approvalLoading.has(entry.id);
                        const refVal = approvalRefInputs[entry.id] || '';
                        const isTerminal = status === 'paid' || status === 'rejected' || status === 'cancelled';

                        return (
                          <tr key={entry.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition align-top">
                            <td className="px-4 py-2.5 text-neutral-500 text-xs">{fmtDate(entry.requested_at)}</td>
                            <td className="px-4 py-2.5 font-semibold text-neutral-900">Rp {fmt(entry.amount)}</td>
                            <td className="px-4 py-2.5 text-neutral-700 text-xs">
                              <div className="font-semibold text-neutral-900">{entry.bank_name}</div>
                              <div>{entry.account_name} · {entry.account_number}</div>
                              {entry.note && <div className="text-neutral-400 italic mt-0.5">{entry.note}</div>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                status === 'processing' ? 'bg-violet-100 text-violet-700' :
                                status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                status === 'rejected' || status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-neutral-100 text-neutral-600'
                              }`}>{entry.status}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-neutral-500">{entry.transfer_reference || '-'}</td>
                            {(isFinanceAdmin || isOwner) && (
                              <td className="px-4 py-2.5">
                                {!isTerminal && (
                                  <div className="flex flex-col gap-1 min-w-[180px]">
                                    {/* Finance admin actions */}
                                    {isFinanceAdmin && status === 'pending' && (
                                      <div className="flex gap-1 flex-wrap">
                                        <button disabled={isProcessing} onClick={() => updateWithdrawalStatus(entry.id, 'approved')} className="px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold disabled:opacity-40">{isProcessing ? '...' : 'Setujui'}</button>
                                        <button disabled={isProcessing} onClick={() => updateWithdrawalStatus(entry.id, 'rejected')} className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold disabled:opacity-40">Tolak</button>
                                      </div>
                                    )}
                                    {isFinanceAdmin && status === 'approved' && (
                                      <div className="flex gap-1 flex-wrap">
                                        <button disabled={isProcessing} onClick={() => updateWithdrawalStatus(entry.id, 'processing')} className="px-2 py-1 text-xs rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 font-semibold disabled:opacity-40">{isProcessing ? '...' : 'Proses Transfer'}</button>
                                        <button disabled={isProcessing} onClick={() => updateWithdrawalStatus(entry.id, 'rejected')} className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold disabled:opacity-40">Tolak</button>
                                      </div>
                                    )}
                                    {isFinanceAdmin && status === 'processing' && (
                                      <div className="flex flex-col gap-1">
                                        <input
                                          type="text"
                                          placeholder="No. Ref Transfer"
                                          value={refVal}
                                          onChange={(e) => setApprovalRefInputs((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                          className={`${inputCls} text-xs py-1`}
                                        />
                                        <button
                                          disabled={isProcessing || !refVal.trim()}
                                          onClick={() => updateWithdrawalStatus(entry.id, 'paid', refVal)}
                                          className="px-2 py-1 text-xs rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold disabled:opacity-40"
                                        >{isProcessing ? '...' : 'Tandai Lunas'}</button>
                                      </div>
                                    )}
                                    {/* Owner can cancel their own pending request */}
                                    {isOwner && !isFinanceAdmin && status === 'pending' && (
                                      <button disabled={isProcessing} onClick={() => updateWithdrawalStatus(entry.id, 'cancelled')} className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold disabled:opacity-40">{isProcessing ? '...' : 'Batalkan'}</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
