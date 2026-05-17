/**
 * STADIONE — Super Admin Control Center
 * Sports Operating System Control Tower
 *
 * Architecture:
 *   Global Overview → Verification Queue → Workspace Ecosystem
 *   → Official Center → Alerts & Monitoring → Watchlist
 *   → Live Activity Feed → Global Search → System Monitoring
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, ShieldCheck, Building2, Flag, Bell,
  Bookmark, Activity, Search, Cpu, ChevronRight, ChevronDown,
  ArrowLeft, Menu, X, Users, Trophy, MapPin, GraduationCap,
  Star, AlertTriangle, CheckCircle, XCircle, Clock, Eye,
  TrendingUp, TrendingDown, Zap, Globe, UserCog, FileText,
  AlertCircle, BarChart3, Settings, LogOut, ExternalLink,
  Play, Pause, Circle, Target, Layers, RefreshCcw, Filter,
  Download, MoreVertical, ChevronLeft, Sparkles,
} from 'lucide-react';
import { supabase } from '../../../config/supabase.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview',      label: 'Global Overview',       icon: LayoutDashboard, accent: 'violet' },
  { id: 'verification',  label: 'Verification Queue',    icon: ShieldCheck,     accent: 'amber', badge: true },
  { id: 'workspace',     label: 'Workspace Ecosystem',   icon: Building2,       accent: 'emerald' },
  { id: 'official',      label: 'Official Center',       icon: Flag,            accent: 'blue' },
  { id: 'alerts',        label: 'Alerts & Monitoring',   icon: Bell,            accent: 'red', badge: true },
  { id: 'watchlist',     label: 'Watchlist',             icon: Bookmark,        accent: 'neutral' },
  { id: 'activity',      label: 'Live Activity Feed',    icon: Activity,        accent: 'green' },
  { id: 'search',        label: 'Global Search',         icon: Search,          accent: 'neutral' },
  { id: 'system',        label: 'System Monitoring',     icon: Cpu,             accent: 'neutral' },
];

const ACCENT = {
  violet:  { pill: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500',  bar: 'bg-violet-600' },
  amber:   { pill: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500',   bar: 'bg-amber-500' },
  emerald: { pill: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  blue:    { pill: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500',    bar: 'bg-blue-500' },
  red:     { pill: 'bg-red-100 text-red-700',        dot: 'bg-red-500',     bar: 'bg-red-500' },
  green:   { pill: 'bg-green-100 text-green-700',    dot: 'bg-green-500',   bar: 'bg-green-500' },
  neutral: { pill: 'bg-neutral-100 text-neutral-700',dot: 'bg-neutral-400', bar: 'bg-neutral-500' },
};

// ─── Shared Utilities ────────────────────────────────────────────────────────

const fmt = (n) => Number(n || 0).toLocaleString('id-ID');
const fmtRp = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
};
const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
};

// ─── Atom Components ─────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] font-black text-neutral-400 mb-3">{children}</div>
  );
}

function Badge({ children, color = 'neutral' }) {
  const cls = ACCENT[color]?.pill || ACCENT.neutral.pill;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${cls}`}>{children}</span>;
}

function StatusDot({ status }) {
  const map = {
    active:   'bg-green-500',
    pending:  'bg-amber-500',
    rejected: 'bg-red-500',
    inactive: 'bg-neutral-400',
    live:     'bg-green-400 animate-pulse',
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status] || map.inactive}`} />;
}

function MetricCard({ label, value, sub, icon: Icon, accent = 'neutral', onClick }) {
  const { pill, dot } = ACCENT[accent] || ACCENT.neutral;
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border border-neutral-200 p-5 text-left hover:border-neutral-400 transition group w-full ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pill}`}>
          <Icon size={16} />
        </div>
        <ChevronRight size={14} className="text-neutral-300 group-hover:text-neutral-600 transition" />
      </div>
      <div className="font-display text-3xl text-neutral-900 leading-none mb-1">{value}</div>
      <div className="text-xs font-bold text-neutral-900 mb-0.5">{label}</div>
      {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
    </button>
  );
}

function EmptyState({ icon: Icon = Sparkles, title = 'Belum ada data', sub = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={32} className="text-neutral-300 mb-3" />
      <div className="font-bold text-neutral-600 mb-1">{title}</div>
      {sub && <div className="text-sm text-neutral-400">{sub}</div>}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// ─── Module: Global Overview ─────────────────────────────────────────────────

function ModuleOverview({ onNav, badges }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [
          { count: users },
          { count: tournaments },
          { data: venues },
          { count: communities },
          { count: academies },
          { data: recentAct },
          { count: pendingVerif },
          { count: flagged },
        ] = await Promise.all([
          supabase.from('user_stats').select('*', { count: 'exact', head: true }),
          supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'Berlangsung'),
          supabase.from('venues').select('id', { count: 'exact', head: false }).limit(1),
          supabase.from('sport_communities').select('*', { count: 'exact', head: true }),
          supabase.from('sport_communities').select('*', { count: 'exact', head: true }).eq('type', 'academy'),
          supabase.from('user_activity_log').select('id,activity_title,activity_type,created_at').order('created_at', { ascending: false }).limit(6),
          supabase.from('tournament_verification_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
          supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        if (!alive) return;
        setStats({
          users: users || 0,
          tournaments: tournaments || 0,
          venues: Array.isArray(venues) ? venues.length : 0,
          communities: communities || 0,
          academies: academies || 0,
          revenueToday: 0,
          pendingVerif: pendingVerif || 0,
          flagged: flagged || 0,
        });
        setActivity(recentAct || []);
      } catch {
        if (alive) setStats({ users: 0, tournaments: 0, venues: 0, communities: 0, academies: 0, revenueToday: 0, pendingVerif: 0, flagged: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const metrics = stats ? [
    { label: 'Active Users',         value: fmt(stats.users),       sub: 'User terdaftar', icon: Users,       accent: 'violet',  nav: 'user-management' },
    { label: 'Active Tournament',     value: fmt(stats.tournaments), sub: 'Sedang berlangsung', icon: Trophy,  accent: 'amber',   nav: 'workspace' },
    { label: 'Active Venue',          value: fmt(stats.venues),      sub: 'Venue aktif', icon: MapPin,         accent: 'emerald', nav: 'workspace' },
    { label: 'Active Community',      value: fmt(stats.communities), sub: 'Komunitas olahraga', icon: Users,   accent: 'blue',    nav: 'workspace' },
    { label: 'Active Academy',        value: fmt(stats.academies),   sub: 'Akademi & pelatihan', icon: GraduationCap, accent: 'green', nav: 'workspace' },
    { label: 'Revenue Today',         value: fmtRp(stats.revenueToday), sub: 'Hari ini', icon: TrendingUp,    accent: 'neutral', nav: 'system' },
    { label: 'Pending Verification',  value: fmt(stats.pendingVerif),sub: 'Menunggu review', icon: Clock,      accent: 'amber',   nav: 'verification' },
    { label: 'Flagged Report',        value: fmt(stats.flagged),     sub: 'Laporan aktif', icon: AlertTriangle, accent: 'red',   nav: 'alerts' },
  ] : [];

  const actTypeMap = {
    venue_booking:       { label: 'Booking Venue', color: 'blue' },
    tournament_join:     { label: 'Daftar Turnamen', color: 'violet' },
    community_join:      { label: 'Gabung Komunitas', color: 'emerald' },
    training_enrollment: { label: 'Daftar Pelatihan', color: 'amber' },
    trivia_complete:     { label: 'Trivia Selesai', color: 'neutral' },
    article_read:        { label: 'Baca Artikel', color: 'neutral' },
  };

  return (
    <div>
      <SectionLabel>/ GLOBAL OVERVIEW</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-1">CONTROL CENTER</h2>
      <p className="text-sm text-neutral-500 mb-8">Ringkasan strategis ekosistem STADIONE secara real-time.</p>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[...Array(8)].map((_, i) => <div key={i} className="h-32 bg-neutral-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} onClick={() => onNav(m.nav)} />
          ))}
        </div>
      )}

      {/* Priority Actions */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-amber-600" />
            <span className="font-bold text-sm text-amber-900">Priority Action</span>
          </div>
          <div className="font-display text-3xl text-amber-900 mb-1">{fmt(stats?.pendingVerif || 0)}</div>
          <p className="text-xs text-amber-700 mb-3">Operator menunggu verifikasi. Setiap hari tanpa review = potensi churn partner.</p>
          <button onClick={() => onNav('verification')} className="px-4 py-2 bg-amber-600 text-white rounded-full text-xs font-bold hover:bg-amber-700 transition">
            Buka Verification Queue →
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="font-bold text-sm text-red-900">Active Alerts</span>
          </div>
          <div className="font-display text-3xl text-red-900 mb-1">{fmt(stats?.flagged || 0)}</div>
          <p className="text-xs text-red-700 mb-3">Laporan konten & anomali yang belum ditindaklanjuti.</p>
          <button onClick={() => onNav('alerts')} className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700 transition">
            Lihat Alerts →
          </button>
        </div>
      </div>

      {/* Live Activity */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-bold text-sm">Live Activity Feed</span>
          </div>
          <button onClick={() => onNav('activity')} className="text-xs font-bold text-neutral-500 hover:text-neutral-900">
            Lihat semua →
          </button>
        </div>
        <div className="divide-y divide-neutral-50">
          {activity.length === 0 ? (
            <EmptyState title="Belum ada aktivitas" />
          ) : activity.map((a) => {
            const t = actTypeMap[a.activity_type] || { label: a.activity_type || 'Aktivitas', color: 'neutral' };
            return (
              <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                <Badge color={t.color}>{t.label}</Badge>
                <span className="text-sm text-neutral-700 flex-1 truncate">{a.activity_title || '—'}</span>
                <span className="text-[11px] text-neutral-400 shrink-0">{timeAgo(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Module: Verification Queue ───────────────────────────────────────────────

const VERIF_CATS = [
  { id: 'all',            label: 'Semua',          icon: Layers },
  { id: 'venue',          label: 'Venue',           icon: MapPin },
  { id: 'academy',        label: 'Academy',         icon: GraduationCap },
  { id: 'tournament_host',label: 'Tournament Host', icon: Trophy },
  { id: 'coach',          label: 'Coach',           icon: Star },
  { id: 'sponsor',        label: 'Sponsor',         icon: Zap },
  { id: 'official',       label: 'Official',        icon: Flag },
];

function ModuleVerification({ onInspect }) {
  const [cat, setCat] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        let q = supabase
          .from('tournament_verification_requests')
          .select('id,operator_name,operator_email,business_type,status,created_at,documents,notes')
          .in('status', ['pending', 'under_review'])
          .order('created_at', { ascending: true });
        const { data } = await q;
        if (alive) setItems(data || []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const filtered = cat === 'all' ? items : items.filter(i => i.business_type === cat);

  const handleDecision = async (decision) => {
    if (!selected) return;
    setProcessing(true);
    try {
      await supabase
        .from('tournament_verification_requests')
        .update({ status: decision, reviewer_notes: notes, reviewed_at: new Date().toISOString() })
        .eq('id', selected.id);
      setItems(prev => prev.filter(i => i.id !== selected.id));
      setFeedback({ type: 'success', msg: `Berhasil ${decision === 'approved' ? 'disetujui' : 'ditolak'}.` });
      setSelected(null);
      setNotes('');
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Gagal memproses. Coba lagi.' });
    } finally {
      setProcessing(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="flex gap-5 min-h-[600px]">
      {/* Left: list */}
      <div className="flex-1 min-w-0">
        <SectionLabel>/ VERIFICATION QUEUE</SectionLabel>
        <h2 className="font-display text-4xl text-neutral-900 leading-none mb-4">APPROVAL QUEUE</h2>

        {/* Category tabs */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {VERIF_CATS.map((c) => {
            const Icon = c.icon;
            const count = c.id === 'all' ? items.length : items.filter(i => i.business_type === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  cat === c.id ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <Icon size={12} /> {c.label}
                {count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${cat === c.id ? 'bg-white text-neutral-900' : 'bg-amber-500 text-white'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {feedback.msg}
          </div>
        )}

        {loading ? <LoadingRow /> : filtered.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Queue kosong" sub="Semua permohonan sudah diproses." />
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`w-full text-left rounded-2xl border p-4 flex items-center gap-4 transition ${
                  selected?.id === item.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
              >
                <StatusDot status="pending" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-neutral-900 truncate">{item.operator_name || '—'}</div>
                  <div className="text-[11px] text-neutral-500">{item.operator_email || '—'} · {timeAgo(item.created_at)}</div>
                </div>
                <Badge color="amber">{item.business_type || 'unknown'}</Badge>
                <ChevronRight size={14} className="text-neutral-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-80 shrink-0 bg-white rounded-2xl border border-neutral-200 p-5 h-fit sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-sm text-neutral-900">Detail Permohonan</span>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-neutral-100 rounded-full"><X size={14} /></button>
          </div>

          <div className="space-y-3 mb-5 text-sm">
            {[
              { l: 'Nama Operator', v: selected.operator_name || '—' },
              { l: 'Email', v: selected.operator_email || '—' },
              { l: 'Tipe Bisnis', v: selected.business_type || '—' },
              { l: 'Status', v: selected.status || '—' },
              { l: 'Diajukan', v: timeAgo(selected.created_at) },
            ].map(({ l, v }) => (
              <div key={l}>
                <div className="text-[10px] uppercase tracking-wider font-black text-neutral-400 mb-0.5">{l}</div>
                <div className="font-semibold text-neutral-900">{v}</div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider font-black text-neutral-400 mb-1.5">Catatan Reviewer</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Tambahkan catatan (opsional)..."
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              disabled={processing}
              onClick={() => handleDecision('approved')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={14} /> {processing ? 'Memproses...' : 'Setujui & Aktifkan Workspace'}
            </button>
            <button
              disabled={processing}
              onClick={() => handleDecision('rejected')}
              className="w-full py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <XCircle size={14} /> Tolak
            </button>
            <button
              onClick={() => onInspect({ type: 'operator', data: selected })}
              className="w-full py-2 rounded-xl border border-neutral-200 text-neutral-600 text-xs font-bold hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              <Eye size={12} /> Quick Inspect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Module: Workspace Ecosystem ─────────────────────────────────────────────

const WORKSPACE_TYPES = [
  { id: 'tournament', label: 'Tournament Workspace',  icon: Trophy,         accent: 'amber',   table: 'tournaments',         countField: null },
  { id: 'venue',      label: 'Venue Workspace',       icon: MapPin,         accent: 'emerald', table: 'venues',              countField: null },
  { id: 'community',  label: 'Community Workspace',   icon: Users,          accent: 'blue',    table: 'sport_communities',   countField: null },
  { id: 'training',   label: 'Training Workspace',    icon: GraduationCap,  accent: 'violet',  table: 'coaches',             countField: null },
  { id: 'sponsorship',label: 'Sponsorship Workspace', icon: Zap,            accent: 'neutral', table: null,                  countField: null },
];

function WorkspaceCard({ ws, count, loading, onClick }) {
  const Icon = ws.icon;
  const { pill } = ACCENT[ws.accent] || ACCENT.neutral;
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-neutral-200 p-6 text-left hover:border-neutral-900 transition group w-full"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${pill}`}>
        <Icon size={18} />
      </div>
      <div className="font-display text-3xl text-neutral-900 mb-1">{loading ? '—' : fmt(count)}</div>
      <div className="font-bold text-sm text-neutral-900 mb-0.5">{ws.label}</div>
      <div className="flex items-center gap-1 mt-3 text-xs font-bold text-neutral-500 group-hover:text-neutral-900 transition">
        Buka overview <ChevronRight size={12} />
      </div>
    </button>
  );
}

function ModuleWorkspace({ onNav }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const results = await Promise.all(
          WORKSPACE_TYPES.filter(w => w.table).map(w =>
            supabase.from(w.table).select('*', { count: 'exact', head: true }).then(r => [w.id, r.count || 0])
          )
        );
        if (!alive) return;
        setCounts(Object.fromEntries(results));
      } catch {
        if (alive) setCounts({});
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const loadDetail = useCallback(async (ws) => {
    if (!ws.table) { setDetail([]); return; }
    setDetailLoading(true);
    const { data } = await supabase.from(ws.table).select('id,name,status,created_at').order('created_at', { ascending: false }).limit(8);
    setDetail(data || []);
    setDetailLoading(false);
  }, []);

  const handleSelect = (ws) => {
    setSelected(ws);
    loadDetail(ws);
  };

  return (
    <div>
      <SectionLabel>/ WORKSPACE ECOSYSTEM</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-6">ECOSYSTEM MAP</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {WORKSPACE_TYPES.map(ws => (
          <WorkspaceCard
            key={ws.id}
            ws={ws}
            count={counts[ws.id] || 0}
            loading={loading}
            onClick={() => handleSelect(ws)}
          />
        ))}
      </div>

      {/* Drill-down panel */}
      {selected && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <selected.icon size={16} className="text-neutral-600" />
              <span className="font-bold text-sm">{selected.label}</span>
              <Badge color={selected.accent}>{fmt(counts[selected.id] || 0)} total</Badge>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-neutral-100 rounded-full"><X size={14} /></button>
          </div>
          <div className="p-5">
            {/* Sub-metrics */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { l: 'Total Aktif', v: fmt(counts[selected.id] || 0) },
                { l: 'Pending Issue', v: '—' },
                { l: 'Suspended', v: '—' },
              ].map(({ l, v }) => (
                <div key={l} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <div className="text-[10px] uppercase tracking-wider font-black text-neutral-400 mb-1">{l}</div>
                  <div className="font-display text-2xl text-neutral-900">{v}</div>
                </div>
              ))}
            </div>

            {/* Entity list */}
            <div className="text-[10px] uppercase tracking-wider font-black text-neutral-400 mb-2">Entitas Terbaru</div>
            {detailLoading ? <LoadingRow /> : detail.length === 0 ? (
              <EmptyState title="Belum ada data" />
            ) : (
              <div className="space-y-1.5">
                {detail.map(entity => (
                  <div key={entity.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-neutral-200">
                    <StatusDot status={entity.status === 'Berlangsung' || entity.status === 'active' ? 'active' : 'inactive'} />
                    <span className="flex-1 text-sm font-semibold text-neutral-900 truncate">{entity.name || entity.id}</span>
                    <Badge color="neutral">{entity.status || '—'}</Badge>
                    <span className="text-[11px] text-neutral-400">{timeAgo(entity.created_at)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Deep drill nav */}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 mb-2">Masuk ke workspace penuh:</p>
              <div className="flex flex-wrap gap-2">
                {selected.id === 'venue' && (
                  <>
                    <button onClick={() => onNav('venue-dashboard')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Dashboard Venue</button>
                    <button onClick={() => onNav('venue-bookings')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Bookings</button>
                    <button onClick={() => onNav('venue-finance')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Finance</button>
                  </>
                )}
                {selected.id === 'tournament' && (
                  <>
                    <button onClick={() => onNav('tournament-manager')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Tournament Manager</button>
                    <button onClick={() => onNav('official-center')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Official Center</button>
                  </>
                )}
                {selected.id === 'community' && (
                  <button onClick={() => onNav('community-manager')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Community Manager</button>
                )}
                {selected.id === 'training' && (
                  <button onClick={() => onNav('training-manager')} className="px-3 py-1.5 rounded-full text-xs font-bold bg-neutral-100 hover:bg-neutral-200">Training Manager</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Module: Official Center ──────────────────────────────────────────────────

const OFFICIAL_SECTIONS = [
  { id: 'referee',     label: 'Referee',          icon: Flag },
  { id: 'match',       label: 'Match Official',   icon: Target },
  { id: 'assignment',  label: 'Assignment',        icon: Users },
  { id: 'report',      label: 'Match Report',      icon: FileText },
  { id: 'statistics',  label: 'Statistics',        icon: BarChart3 },
  { id: 'disciplinary',label: 'Disciplinary',      icon: AlertTriangle },
  { id: 'performance', label: 'Performance Review',icon: TrendingUp },
];

function ModuleOfficial({ onNav }) {
  return (
    <div>
      <SectionLabel>/ OFFICIAL CENTER</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-2">CROSS-WORKSPACE OFFICIAL</h2>
      <p className="text-sm text-neutral-500 mb-6">Official Center beroperasi lintas workspace — tidak menginduk ke satu turnamen.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {OFFICIAL_SECTIONS.map(sec => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => onNav('official-center')}
              className="bg-white rounded-2xl border border-neutral-200 p-5 text-left hover:border-neutral-900 transition group"
            >
              <Icon size={20} className="text-blue-600 mb-3" />
              <div className="font-bold text-sm text-neutral-900">{sec.label}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <div className="font-bold text-blue-900 mb-2">Flow Operasional Official</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-800">
          {['Tournament Match', 'Official Assignment', 'Match Operation', 'Match Report', 'Statistics Sync', 'Athlete Profile Updated'].map((step, i, arr) => (
            <React.Fragment key={step}>
              <span className="bg-white px-2 py-1 rounded-lg border border-blue-200">{step}</span>
              {i < arr.length - 1 && <ChevronRight size={12} className="text-blue-400 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
        <button onClick={() => onNav('official-center')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition">
          Buka Official Center →
        </button>
      </div>
    </div>
  );
}

// ─── Module: Alerts & Monitoring ─────────────────────────────────────────────

const ALERT_TYPES = [
  { id: 'fraud',    label: 'Fraud Activity',           icon: AlertCircle,   color: 'red' },
  { id: 'payout',   label: 'Pending Payout',           icon: TrendingDown,  color: 'amber' },
  { id: 'report',   label: 'Match Report Incomplete',  icon: FileText,      color: 'amber' },
  { id: 'venue',    label: 'Suspended Venue',          icon: MapPin,        color: 'red' },
  { id: 'community',label: 'High Report Community',    icon: Users,         color: 'amber' },
  { id: 'payment',  label: 'Failed Payment',           icon: XCircle,       color: 'red' },
];

function ModuleAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data } = await supabase
          .from('content_reports')
          .select('id,report_type,description,status,created_at,reporter_id')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20);
        if (alive) setAlerts(data || []);
      } catch {
        if (alive) setAlerts([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <SectionLabel>/ ALERTS & MONITORING</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-6">ANOMALY FEED</h2>

      {/* Alert type summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {ALERT_TYPES.map(a => {
          const Icon = a.icon;
          const { pill } = ACCENT[a.color] || ACCENT.neutral;
          return (
            <div key={a.id} className={`rounded-2xl border p-4 ${a.color === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={a.color === 'red' ? 'text-red-600' : 'text-amber-600'} />
                <span className={`text-xs font-bold ${a.color === 'red' ? 'text-red-900' : 'text-amber-900'}`}>{a.label}</span>
              </div>
              <div className={`font-display text-2xl ${a.color === 'red' ? 'text-red-900' : 'text-amber-900'}`}>—</div>
            </div>
          );
        })}
      </div>

      {/* Live alert list */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <span className="font-bold text-sm">Content Reports Aktif</span>
          <Badge color="red">{alerts.length} pending</Badge>
        </div>
        <div className="divide-y divide-neutral-50">
          {loading ? <div className="p-5"><LoadingRow /></div> : alerts.length === 0 ? (
            <EmptyState icon={CheckCircle} title="Tidak ada alert aktif" sub="Ekosistem berjalan normal." />
          ) : alerts.map(a => (
            <div key={a.id} className="px-5 py-3 flex items-center gap-3">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span className="flex-1 text-sm text-neutral-700 truncate">{a.description || a.report_type || 'Laporan konten'}</span>
              <Badge color="amber">{a.status}</Badge>
              <span className="text-[11px] text-neutral-400 shrink-0">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Module: Watchlist ────────────────────────────────────────────────────────

const DEFAULT_WATCHLIST = [
  { id: 'w1', label: 'Liga Garuda', type: 'tournament', status: 'active' },
  { id: 'w2', label: 'DRW Sports Center', type: 'venue', status: 'active' },
  { id: 'w3', label: 'Garuda Academy', type: 'academy', status: 'active' },
  { id: 'w4', label: 'PSSI DIY League', type: 'tournament', status: 'active' },
];

function ModuleWatchlist({ onInspect }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_watchlist') || 'null') || DEFAULT_WATCHLIST; }
    catch { return DEFAULT_WATCHLIST; }
  });
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('tournament');

  const save = (next) => {
    setItems(next);
    try { localStorage.setItem('sa_watchlist', JSON.stringify(next)); } catch {}
  };

  const add = () => {
    if (!newLabel.trim()) return;
    save([...items, { id: `w${Date.now()}`, label: newLabel.trim(), type: newType, status: 'active' }]);
    setNewLabel('');
  };

  const remove = (id) => save(items.filter(i => i.id !== id));

  const typeIcon = { tournament: Trophy, venue: MapPin, academy: GraduationCap, community: Users, coach: Star };

  return (
    <div>
      <SectionLabel>/ WATCHLIST</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-2">MONITORED ENTITIES</h2>
      <p className="text-sm text-neutral-500 mb-6">Pin entitas penting untuk monitoring cepat dan akses langsung.</p>

      {/* Add form */}
      <div className="flex gap-2 mb-5">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Nama entitas..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900"
        />
        <select
          value={newType}
          onChange={e => setNewType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-neutral-900"
        >
          {Object.keys(typeIcon).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={add} className="px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-bold hover:bg-neutral-700">
          + Tambah
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {items.map(item => {
          const Icon = typeIcon[item.type] || Globe;
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-neutral-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-neutral-900 truncate">{item.label}</div>
                <div className="text-[11px] text-neutral-500 capitalize">{item.type}</div>
              </div>
              <StatusDot status={item.status} />
              <button
                onClick={() => onInspect({ type: item.type, data: { name: item.label, id: item.id } })}
                className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900"
                title="Quick Inspect"
              >
                <Eye size={13} />
              </button>
              <button onClick={() => remove(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Module: Live Activity Feed ───────────────────────────────────────────────

function ModuleActivity() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef(null);

  const loadFeed = useCallback(async () => {
    const { data } = await supabase
      .from('user_activity_log')
      .select('id,activity_title,activity_description,activity_type,activity_date,created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setFeed(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (paused) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(loadFeed, 15000);
    return () => clearInterval(intervalRef.current);
  }, [paused, loadFeed]);

  const actTypeMap = {
    venue_booking:       { label: 'Booking Venue',      color: 'blue' },
    tournament_join:     { label: 'Daftar Turnamen',    color: 'violet' },
    community_join:      { label: 'Gabung Komunitas',   color: 'emerald' },
    training_enrollment: { label: 'Daftar Pelatihan',   color: 'amber' },
    trivia_complete:     { label: 'Trivia Selesai',     color: 'neutral' },
    article_read:        { label: 'Baca Artikel',       color: 'neutral' },
    payment_success:     { label: 'Pembayaran Berhasil',color: 'green' },
    user_register:       { label: 'User Baru',          color: 'violet' },
  };

  return (
    <div>
      <SectionLabel>/ LIVE ACTIVITY FEED</SectionLabel>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-4xl text-neutral-900 leading-none">REALTIME OPS</h2>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${paused ? 'bg-neutral-400' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-xs font-semibold text-neutral-500">{paused ? 'Paused' : 'Live · refresh 15s'}</span>
          <button
            onClick={() => setPaused(p => !p)}
            className="p-2 rounded-xl hover:bg-neutral-100 border border-neutral-200"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button onClick={loadFeed} className="p-2 rounded-xl hover:bg-neutral-100 border border-neutral-200">
            <RefreshCcw size={13} />
          </button>
        </div>
      </div>

      {loading ? <LoadingRow /> : feed.length === 0 ? (
        <EmptyState icon={Activity} title="Belum ada aktivitas" />
      ) : (
        <div className="space-y-1.5">
          {feed.map((a) => {
            const t = actTypeMap[a.activity_type] || { label: a.activity_type || 'Aktivitas', color: 'neutral' };
            const ts = a.activity_date || a.created_at;
            const timeStr = ts ? new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-neutral-100 hover:border-neutral-200 transition">
                <span className="font-display text-base text-neutral-400 w-20 shrink-0">{timeStr}</span>
                <Badge color={t.color}>{t.label}</Badge>
                <span className="text-sm text-neutral-700 flex-1 truncate">{a.activity_title || '—'}</span>
                <span className="text-[11px] text-neutral-400 shrink-0">{timeAgo(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Module: Global Search ────────────────────────────────────────────────────

const SEARCH_SCOPES = [
  { id: 'user',       label: 'User',       table: 'user_stats',       fields: 'id,email,name' },
  { id: 'tournament', label: 'Turnamen',   table: 'tournaments',      fields: 'id,name,sport,status' },
  { id: 'venue',      label: 'Venue',      table: 'venues',           fields: 'id,name,sport,city' },
  { id: 'community',  label: 'Komunitas',  table: 'sport_communities',fields: 'id,name,sport' },
  { id: 'coach',      label: 'Pelatih',    table: 'coaches',          fields: 'id,name,sport' },
];

function ModuleSearch({ onInspect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const q = query.trim();
    const searches = SEARCH_SCOPES.map(async scope => {
      try {
        const fieldList = scope.fields.split(',');
        const nameField = fieldList.find(f => f === 'name' || f === 'email') || fieldList[0];
        const { data } = await supabase
          .from(scope.table)
          .select(scope.fields)
          .ilike(nameField, `%${q}%`)
          .limit(5);
        return [scope.id, data || []];
      } catch {
        return [scope.id, []];
      }
    });
    const all = await Promise.all(searches);
    setResults(Object.fromEntries(all));
    setLoading(false);
  };

  const totalResults = Object.values(results).flat().length;

  return (
    <div>
      <SectionLabel>/ GLOBAL SEARCH</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-6">FIND ANYTHING</h2>

      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Cari user, venue, turnamen, pelatih, invoice..."
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-neutral-200 text-sm focus:outline-none focus:border-neutral-900 bg-white"
          />
        </div>
        <button
          onClick={doSearch}
          disabled={loading || !query.trim()}
          className="px-6 py-3 rounded-2xl bg-neutral-900 text-white text-sm font-bold disabled:opacity-50 hover:bg-neutral-700 transition"
        >
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : 'Cari'}
        </button>
      </div>

      {/* Scope hints */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {SEARCH_SCOPES.map(s => (
          <span key={s.id} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-600">
            {s.label}
          </span>
        ))}
      </div>

      {searched && !loading && (
        <div className="mb-4 text-sm text-neutral-500">
          {totalResults === 0 ? `Tidak ada hasil untuk "${query}"` : `${totalResults} hasil ditemukan untuk "${query}"`}
        </div>
      )}

      {loading && <LoadingRow />}

      {!loading && searched && (
        <div className="space-y-4">
          {SEARCH_SCOPES.map(scope => {
            const rows = results[scope.id] || [];
            if (rows.length === 0) return null;
            return (
              <div key={scope.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
                  <span className="font-bold text-sm text-neutral-900">{scope.label}</span>
                  <Badge color="neutral">{rows.length} hasil</Badge>
                </div>
                <div className="divide-y divide-neutral-50">
                  {rows.map(row => (
                    <div key={row.id} className="px-4 py-3 flex items-center gap-3 hover:bg-neutral-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-neutral-900 truncate">{row.name || row.email || row.id}</div>
                        {row.sport && <div className="text-[11px] text-neutral-500">{row.sport}{row.city ? ` · ${row.city}` : ''}{row.status ? ` · ${row.status}` : ''}</div>}
                      </div>
                      <button
                        onClick={() => onInspect({ type: scope.id, data: row })}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Module: System Monitoring ────────────────────────────────────────────────

function ModuleSystem({ auth, onNav }) {
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data } = await supabase
          .from('user_activity_log')
          .select('id,activity_title,activity_type,activity_category,created_at,user_id')
          .order('created_at', { ascending: false })
          .limit(20);
        if (alive) setAuditLog(data || []);
      } catch {
        if (alive) setAuditLog([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const systemModules = [
    { label: 'Audit Logs',        icon: FileText,      desc: 'Semua aktivitas tercatat dengan aktor & timestamp', color: 'neutral' },
    { label: 'Activity Logs',     icon: Activity,      desc: 'Log aktivitas user platform', color: 'neutral' },
    { label: 'Fraud Detection',   icon: AlertCircle,   desc: 'Anomali transaksi & auth', color: 'red' },
    { label: 'Payment Monitoring',icon: BarChart3,     desc: 'Status pembayaran & payout', color: 'amber' },
    { label: 'API Health',        icon: Cpu,           desc: 'Supabase connection & latency', color: 'green' },
    { label: 'Moderation Queue',  icon: ShieldCheck,   desc: 'Laporan konten pending', color: 'amber' },
  ];

  return (
    <div>
      <SectionLabel>/ SYSTEM MONITORING</SectionLabel>
      <h2 className="font-display text-4xl text-neutral-900 leading-none mb-6">SYS MONITOR</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {systemModules.map(m => {
          const Icon = m.icon;
          const { pill } = ACCENT[m.color] || ACCENT.neutral;
          return (
            <div key={m.label} className={`rounded-2xl border p-4 ${m.color === 'red' ? 'bg-red-50 border-red-200' : m.color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-neutral-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${pill}`}>
                <Icon size={14} />
              </div>
              <div className="font-bold text-sm text-neutral-900 mb-1">{m.label}</div>
              <div className="text-[11px] text-neutral-500">{m.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Audit log table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <span className="font-bold text-sm">Audit Log Terbaru</span>
          <button onClick={() => onNav('analytics')} className="text-xs font-bold text-neutral-500 hover:text-neutral-900">
            Analytics lengkap →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider font-bold text-neutral-500">
              <tr>
                <th className="text-left px-4 py-3">Aksi</th>
                <th className="text-left px-4 py-3">Tipe</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {loading ? (
                <tr><td colSpan={4} className="p-4"><LoadingRow /></td></tr>
              ) : auditLog.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-neutral-400">Belum ada log</td></tr>
              ) : auditLog.map(a => (
                <tr key={a.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-semibold text-neutral-900 max-w-[200px] truncate">{a.activity_title || '—'}</td>
                  <td className="px-4 py-2.5"><Badge color="neutral">{a.activity_type || '—'}</Badge></td>
                  <td className="px-4 py-2.5 text-neutral-500 font-mono">{String(a.user_id || '—').slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 text-neutral-400">{timeAgo(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Inspect Panel ─────────────────────────────────────────────────────

function QuickInspectPanel({ entity, onClose, onFullDetail }) {
  if (!entity) return null;

  const { type, data } = entity;
  const name = data?.name || data?.operator_name || data?.email || data?.id || '—';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white border-l border-neutral-200 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-black text-neutral-400 mb-0.5">Quick Inspect</div>
            <div className="font-bold text-sm text-neutral-900">{name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-full">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <Badge color="neutral">{type}</Badge>
          </div>

          {/* Entity stats */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {[
              { l: 'Status', v: data?.status || '—' },
              { l: 'ID', v: String(data?.id || '—').slice(0, 8) + '…' },
              { l: 'Dibuat', v: timeAgo(data?.created_at) },
              { l: 'Tipe', v: type },
            ].map(({ l, v }) => (
              <div key={l} className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                <div className="text-[9px] uppercase tracking-wider font-black text-neutral-400 mb-0.5">{l}</div>
                <div className="font-semibold text-xs text-neutral-900 truncate">{v}</div>
              </div>
            ))}
          </div>

          {type === 'venue' && (
            <div className="space-y-2 mb-5">
              <SectionLabel>Venue Metrics</SectionLabel>
              {[
                { l: 'Revenue Today', v: '—' },
                { l: 'Occupancy', v: '—' },
                { l: 'Active Booking', v: '—' },
                { l: 'Pending Issue', v: '—' },
                { l: 'Staff Active', v: '—' },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-neutral-500">{l}</span>
                  <span className="font-semibold text-neutral-900">{v}</span>
                </div>
              ))}
            </div>
          )}

          {type === 'tournament' && (
            <div className="space-y-2 mb-5">
              <SectionLabel>Tournament Metrics</SectionLabel>
              {[
                { l: 'Sport', v: data?.sport || '—' },
                { l: 'Status', v: data?.status || '—' },
                { l: 'Peserta', v: '—' },
                { l: 'Official Assigned', v: '—' },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-neutral-500">{l}</span>
                  <span className="font-semibold text-neutral-900">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => onFullDetail(entity)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-bold hover:bg-neutral-700 transition flex items-center justify-center gap-2"
            >
              <ExternalLink size={13} /> Open Full Detail
            </button>
            <button className="w-full py-2.5 rounded-xl border border-amber-300 text-amber-700 text-sm font-bold hover:bg-amber-50 transition flex items-center justify-center gap-2">
              <AlertTriangle size={13} /> Suspend
            </button>
            <button className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-bold hover:bg-neutral-50 transition flex items-center justify-center gap-2">
              <FileText size={13} /> Audit Trail
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ active, onNav, badges, collapsed, onToggle, auth, onBack }) {
  return (
    <aside
      className={`bg-neutral-950 text-white flex flex-col transition-all duration-300 shrink-0 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ minHeight: '100vh' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-neutral-800">
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm text-white leading-none tracking-widest">STADIONE</div>
            <div className="text-[9px] text-neutral-500 uppercase tracking-[0.2em] mt-0.5">Control Center</div>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-neutral-800 transition shrink-0">
          <Menu size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const badgeCount = item.id === 'verification' ? badges.verification : item.id === 'alerts' ? badges.alerts : 0;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition relative ${
                isActive ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
              title={collapsed ? item.label : undefined}
            >
              {isActive && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-white rounded-r" />}
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="text-sm font-semibold truncate">{item.label}</span>}
              {badgeCount > 0 && !collapsed && (
                <span className="ml-auto bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{badgeCount > 99 ? '99+' : badgeCount}</span>
              )}
              {badgeCount > 0 && collapsed && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-neutral-800 py-3">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-neutral-400 hover:text-white hover:bg-white/5 transition"
          title={collapsed ? 'Kembali' : undefined}
        >
          <ArrowLeft size={16} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">Kembali</span>}
        </button>
        {auth && !collapsed && (
          <div className="px-4 pt-2 pb-1">
            <div className="text-[10px] text-neutral-500 truncate">{auth.email}</div>
            <div className="text-[10px] font-bold text-neutral-400 mt-0.5">Super Admin</div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Root: SuperAdminControlCenter ───────────────────────────────────────────

export default function SuperAdminControlCenter({ auth, onBack, onNav: parentNav }) {
  const [activeModule, setActiveModule] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectEntity, setInspectEntity] = useState(null);
  const [badges, setBadges] = useState({ verification: 0, alerts: 0 });

  // Load badge counts once
  useEffect(() => {
    async function loadBadges() {
      try {
        const [{ count: v }, { count: a }] = await Promise.all([
          supabase.from('tournament_verification_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
          supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        setBadges({ verification: v || 0, alerts: a || 0 });
      } catch {}
    }
    loadBadges();
  }, []);

  const handleNav = (moduleId) => {
    // If it's a workspace sub-route, delegate to parent
    const controlModules = new Set(NAV_ITEMS.map(n => n.id));
    if (controlModules.has(moduleId)) {
      setActiveModule(moduleId);
    } else {
      parentNav?.(moduleId);
    }
  };

  const handleInspect = (entity) => setInspectEntity(entity);
  const handleCloseInspect = () => setInspectEntity(null);
  const handleFullDetail = (entity) => {
    setInspectEntity(null);
    if (entity?.type === 'venue') parentNav?.('venue-dashboard');
    else if (entity?.type === 'tournament') parentNav?.('tournament-manager');
  };

  const moduleProps = { onNav: handleNav, onInspect: handleInspect, auth, badges };

  const renderModule = () => {
    switch (activeModule) {
      case 'overview':     return <ModuleOverview      {...moduleProps} />;
      case 'verification': return <ModuleVerification  {...moduleProps} />;
      case 'workspace':    return <ModuleWorkspace     {...moduleProps} />;
      case 'official':     return <ModuleOfficial      {...moduleProps} />;
      case 'alerts':       return <ModuleAlerts        {...moduleProps} />;
      case 'watchlist':    return <ModuleWatchlist     {...moduleProps} />;
      case 'activity':     return <ModuleActivity      {...moduleProps} />;
      case 'search':       return <ModuleSearch        {...moduleProps} />;
      case 'system':       return <ModuleSystem        {...moduleProps} />;
      default:             return <ModuleOverview      {...moduleProps} />;
    }
  };

  return (
    <div className="flex bg-neutral-100 min-h-screen">
      {/* Sidebar */}
      <Sidebar
        active={activeModule}
        onNav={handleNav}
        badges={badges}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        auth={auth}
        onBack={onBack}
      />

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-neutral-200 px-6 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.22em] font-black text-neutral-400">
              {NAV_ITEMS.find(n => n.id === activeModule)?.label || 'Control Center'}
            </div>
          </div>
          <button
            onClick={() => handleNav('search')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-500 hover:border-neutral-400 transition"
          >
            <Search size={14} /> Search anything...
          </button>
          {auth && (
            <div className="flex items-center gap-2 pl-2 border-l border-neutral-200">
              <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
                {String(auth.name || 'SA').slice(0, 2).toUpperCase()}
              </div>
              {!sidebarCollapsed && <span className="text-xs font-semibold text-neutral-700">{auth.name?.split(' ')[0]}</span>}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {renderModule()}
        </div>
      </main>

      {/* Quick Inspect Panel */}
      {inspectEntity && (
        <QuickInspectPanel
          entity={inspectEntity}
          onClose={handleCloseInspect}
          onFullDetail={handleFullDetail}
        />
      )}
    </div>
  );
}
