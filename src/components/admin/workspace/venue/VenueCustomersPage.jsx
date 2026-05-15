import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Search, Phone, Mail, Star, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { EmptyState, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n) { return Number(n || 0).toLocaleString('id-ID'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function deriveLoyalty(score) {
  if (score >= 120) return { tier: 'Champion', nextTarget: null, tone: 'bg-amber-100 text-amber-700' };
  if (score >= 80) return { tier: 'Elite', nextTarget: 120, tone: 'bg-indigo-100 text-indigo-700' };
  if (score >= 40) return { tier: 'Regular', nextTarget: 80, tone: 'bg-blue-100 text-blue-700' };
  return { tier: 'Newcomer', nextTarget: 40, tone: 'bg-neutral-100 text-neutral-700' };
}

// ── CustomerRow ───────────────────────────────────────────────────────────────

function CustomerRow({ customer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-neutral-50 transition"
      >
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
          {(customer.name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-900">{customer.name || 'Unknown'}</span>
            {customer.membership && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {customer.membership.tier_name}
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${customer.loyaltyTone}`}>
              Loyalty {customer.loyaltyTier}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5 flex-wrap">
            {customer.phone && <span className="flex items-center gap-1"><Phone size={10} />{customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1"><Mail size={10} />{customer.email}</span>}
            <span className="flex items-center gap-1"><Calendar size={10} />{customer.bookingCount} booking</span>
            {customer.favoriteCourtName && <span>Court favorit: {customer.favoriteCourtName}</span>}
            <span className="flex items-center gap-1"><Star size={10} />Rp {fmt(customer.totalSpent)}</span>
          </div>
        </div>
        <div className="shrink-0 text-neutral-300">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-4 bg-neutral-50 space-y-3">
          <div className="grid sm:grid-cols-5 gap-3">
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Booking</div>
              <div className="font-bold text-neutral-900">{customer.bookingCount}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Dihabiskan</div>
              <div className="font-bold text-neutral-900">Rp {fmt(customer.totalSpent)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Booking Terakhir</div>
              <div className="font-bold text-neutral-900">{fmtDate(customer.lastBooking)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Court Favorit</div>
              <div className="font-bold text-neutral-900">{customer.favoriteCourtName || '—'}</div>
              {customer.favoriteCourtCount > 0 && (
                <div className="text-xs text-neutral-500">{customer.favoriteCourtCount} booking</div>
              )}
            </div>
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Loyalty</div>
              <div className="font-bold text-neutral-900">{customer.loyaltyTier}</div>
              <div className="text-xs text-neutral-500">Skor {customer.loyaltyScore}</div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Loyalty Program</div>
            {customer.loyaltyNextTarget ? (
              <div className="text-xs text-neutral-700">
                Butuh <span className="font-semibold">{customer.loyaltyNextTarget - customer.loyaltyScore}</span> skor lagi untuk naik tier.
              </div>
            ) : (
              <div className="text-xs text-neutral-700">Tier tertinggi sudah tercapai. Eligible untuk reward prioritas venue.</div>
            )}
          </div>
          {customer.membership && (
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
              <div className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">Membership Aktif</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><span className="text-neutral-400">Tier: </span><span className="font-semibold">{customer.membership.tier_name}</span></div>
                <div><span className="text-neutral-400">Diskon: </span><span className="font-semibold">{customer.membership.discount_percent}%</span></div>
                <div><span className="text-neutral-400">Points: </span><span className="font-semibold">{fmt(customer.membership.reward_points_balance)}</span></div>
                <div><span className="text-neutral-400">Berlaku: </span><span className="font-semibold">{fmtDate(customer.membership.end_date)}</span></div>
              </div>
            </div>
          )}
          {customer.recentBookings?.length > 0 && (
            <div>
              <div className="text-xs text-neutral-400 uppercase tracking-wide mb-2">5 Booking Terakhir</div>
              <div className="space-y-1">
                {customer.recentBookings.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs text-neutral-600 py-1 border-b border-neutral-100 last:border-0">
                    <span>{fmtDate(b.booking_date)} · {b.start_time?.slice(0,5)}–{b.end_time?.slice(0,5)} · {b.court_name || 'Court'}</span>
                    <span className={`font-semibold ${b.payment_status === 'paid' ? 'text-emerald-700' : 'text-yellow-600'}`}>Rp {fmt(b.total_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueCustomersPage({ auth, venue }) {
  const venueId = venue?.id;
  const [allBookings, setAllBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('totalSpent');

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [bookRes, memRes, courtRes] = await Promise.all([
        supabase
          .from('venue_bookings')
          .select('id, court_id, customer_name, customer_phone, customer_email, booking_date, start_time, end_time, total_price, payment_status, status')
          .eq('venue_id', venueId)
          .order('booking_date', { ascending: false }),

        supabase
          .from('customer_memberships')
          .select('customer_id, reward_points_balance, start_date, end_date, status, membership_types(tier_name, discount_percent)')
          .eq('venue_id', venueId)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString().slice(0, 10)),

        supabase
          .from('venue_courts')
          .select('id, name')
          .eq('venue_id', venueId),
      ]);
      setAllBookings(bookRes.data || []);
      setMemberships(memRes.data || []);
      setCourts(courtRes.data || []);
    } catch (err) {
      console.error('Customers load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  // ── Build customer profiles from bookings ─────────────────────────────────

  const courtNameById = useMemo(() => {
    const map = {};
    for (const court of courts) {
      map[court.id] = court.name;
    }
    return map;
  }, [courts]);

  const customers = useMemo(() => {
    const map = {};
    for (const b of allBookings) {
      const key = b.customer_phone || b.customer_name || 'unknown';
      if (!map[key]) {
        map[key] = {
          id: key,
          name: b.customer_name,
          phone: b.customer_phone,
          email: b.customer_email,
          bookingCount: 0,
          totalSpent: 0,
          lastBooking: null,
          recentBookings: [],
          favoriteCourtName: null,
          favoriteCourtCount: 0,
          loyaltyScore: 0,
          loyaltyTier: 'Newcomer',
          loyaltyNextTarget: 40,
          loyaltyTone: 'bg-neutral-100 text-neutral-700',
          courtUsage: {},
          membership: null,
        };
      }
      const c = map[key];
      c.bookingCount++;
      if (b.payment_status === 'paid') c.totalSpent += Number(b.total_price || 0);
      if (!c.lastBooking || b.booking_date > c.lastBooking) c.lastBooking = b.booking_date;
      const courtName = courtNameById[b.court_id] || 'Court tidak ditemukan';
      if (b.court_id) {
        const currentUsage = c.courtUsage[b.court_id] || { count: 0, name: courtName };
        c.courtUsage[b.court_id] = {
          count: currentUsage.count + 1,
          name: currentUsage.name,
        };
      }
      if (c.recentBookings.length < 5) c.recentBookings.push({ ...b, court_name: courtName });
    }

    // Attach membership data (matched by phone via raw_user_meta_data — best effort)
    // We store memberships by customer_id (UUID), but bookings store customer_phone
    // For now, we'll surface membership separately or skip joining here
    // Future: join via auth.users phone lookup

    return Object.values(map).map((customer) => {
      const favoriteEntry = Object.values(customer.courtUsage).sort((a, b) => b.count - a.count)[0] || null;
      const loyaltyScore = Math.min(180, Math.round((customer.bookingCount * 6) + (customer.totalSpent / 250000)));
      const loyalty = deriveLoyalty(loyaltyScore);
      return {
        ...customer,
        favoriteCourtName: favoriteEntry?.name || null,
        favoriteCourtCount: Number(favoriteEntry?.count || 0),
        loyaltyScore,
        loyaltyTier: loyalty.tier,
        loyaltyNextTarget: loyalty.nextTarget,
        loyaltyTone: loyalty.tone,
      };
    });
  }, [allBookings, courtNameById]);

  const sorted = useMemo(() => {
    return [...customers].sort((a, b) => {
      if (sortBy === 'totalSpent') return b.totalSpent - a.totalSpent;
      if (sortBy === 'bookingCount') return b.bookingCount - a.bookingCount;
      if (sortBy === 'lastBooking') return (b.lastBooking || '').localeCompare(a.lastBooking || '');
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [customers, sortBy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [sorted, search]);

  // Summary stats
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const repeat = customers.filter(c => c.bookingCount > 1).length;
  const activeMemberships = memberships.length;

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={Users} title="Belum ada venue" description="Daftarkan venue terlebih dahulu." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Customer</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Manajemen Customer</h1>
        <p className="text-neutral-500 text-sm mt-1">Profil customer berdasarkan riwayat booking.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Customer</div>
          <div className="text-2xl font-bold text-neutral-900">{totalCustomers}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Pelanggan Setia</div>
          <div className="text-2xl font-bold text-neutral-900">{repeat}</div>
          <div className="text-xs text-neutral-400">&gt;1 kali booking</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Member Aktif</div>
          <div className="text-2xl font-bold text-neutral-900">{activeMemberships}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Pendapatan</div>
          <div className="text-2xl font-bold text-neutral-900">Rp {Number(totalRevenue / 1_000_000).toFixed(1)}jt</div>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Cari nama, telepon, atau email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className={`${selectCls} w-44`} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="totalSpent">Terbesar Dihabiskan</option>
          <option value="bookingCount">Terbanyak Booking</option>
          <option value="lastBooking">Booking Terbaru</option>
          <option value="name">Nama A–Z</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada customer" description="Belum ada customer yang pernah booking di venue ini." />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => <CustomerRow key={c.id} customer={c} />)}
        </div>
      )}
    </div>
  );
}
