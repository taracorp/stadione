import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Trophy, Activity, BarChart3, Newspaper } from 'lucide-react';
import AdminLayout, { StatCard } from '../AdminLayout.jsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '../../../config/supabase.js';

const CHART_COLORS = ['#7c3aed', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899'];

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
}

export default function AnalyticsPage({ auth, onBack, onNav }) {
  const [loading, setLoading] = useState(true);
  const [activityByType, setActivityByType] = useState([]);
  const [activityByMonth, setActivityByMonth] = useState([]);
  const [tournamentBySport, setTournamentBySport] = useState([]);
  const [communitySummary, setCommunitySummary] = useState([]);
  const [totals, setTotals] = useState({ users: 0, activity: 0, tournaments: 0, communities: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [
          { count: users },
          { count: totalActivity },
          { count: tournaments },
          { count: communities },
          { data: activityLog },
          { data: tournamentsData },
          { data: communitiesData },
        ] = await Promise.all([
          supabase.from('user_stats').select('*', { count: 'exact', head: true }),
          supabase.from('user_activity_log').select('*', { count: 'exact', head: true }),
          supabase.from('tournaments').select('*', { count: 'exact', head: true }),
          supabase.from('sport_communities').select('*', { count: 'exact', head: true }),
          supabase.from('user_activity_log').select('activity_type,activity_date,created_at').order('created_at', { ascending: true }).limit(500),
          supabase.from('tournaments').select('sport,classification,status'),
          supabase.from('sport_communities').select('sport,activity_level,members_count'),
        ]);

        setTotals({ users: users || 0, activity: totalActivity || 0, tournaments: tournaments || 0, communities: communities || 0 });

        // Activity by type
        const typeCount = {};
        (activityLog || []).forEach((a) => {
          const t = a.activity_type || 'other';
          typeCount[t] = (typeCount[t] || 0) + 1;
        });
        setActivityByType(
          Object.entries(typeCount)
            .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
        );

        // Activity by month (last 8 months)
        const monthCount = {};
        (activityLog || []).forEach((a) => {
          const key = formatMonth(a.created_at);
          if (key) monthCount[key] = (monthCount[key] || 0) + 1;
        });
        setActivityByMonth(
          Object.entries(monthCount)
            .slice(-8)
            .map(([month, aktivitas]) => ({ month, aktivitas }))
        );

        // Tournaments by sport
        const sportCount = {};
        (tournamentsData || []).forEach((t) => {
          const s = t.sport || 'Lainnya';
          sportCount[s] = (sportCount[s] || 0) + 1;
        });
        setTournamentBySport(
          Object.entries(sportCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
        );

        // Communities summary
        const levelCount = {};
        (communitiesData || []).forEach((c) => {
          const l = c.activity_level || 'Medium';
          levelCount[l] = (levelCount[l] || 0) + 1;
        });
        setCommunitySummary(Object.entries(levelCount).map(([name, value]) => ({ name, value })));
      } catch (err) {
        console.error('AnalyticsPage load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AdminLayout
      variant="platform"
      kicker="/ PLATFORM — ANALYTICS"
      title={<>PLATFORM<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>analytics.</span></>}
      subtitle="Metrik operasional platform: aktivitas pengguna, turnamen, komunitas, dan tren konten."
      onBack={onBack}
      breadcrumbs={[{ label: 'Platform Console', onClick: () => onNav('platform-console') }, { label: 'Analytics' }]}
    >
      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total User" value={loading ? '—' : totals.users.toLocaleString()} icon={Users} accent="violet" />
        <StatCard label="Total Aktivitas" value={loading ? '—' : totals.activity.toLocaleString()} icon={Activity} accent="blue" />
        <StatCard label="Turnamen" value={loading ? '—' : totals.tournaments.toLocaleString()} icon={Trophy} accent="emerald" />
        <StatCard label="Komunitas" value={loading ? '—' : totals.communities.toLocaleString()} icon={Users} accent="amber" />
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 rounded-3xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Activity trend over time */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={16} className="text-violet-500" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Tren Aktivitas</div>
                <div className="font-display text-xl text-neutral-900">Aktivitas per Bulan</div>
              </div>
            </div>
            {activityByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activityByMonth} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorAkt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Area type="monotone" dataKey="aktivitas" stroke="#7c3aed" strokeWidth={2} fill="url(#colorAkt)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-neutral-400 text-center py-10">Belum ada data aktivitas.</p>}
          </div>

          {/* Activity by type */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={16} className="text-blue-500" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Aktivitas</div>
                <div className="font-display text-xl text-neutral-900">Breakdown per Tipe</div>
              </div>
            </div>
            {activityByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activityByType} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {activityByType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-neutral-400 text-center py-10">Belum ada data.</p>}
          </div>

          {/* Tournaments by sport */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={16} className="text-emerald-500" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Turnamen</div>
                <div className="font-display text-xl text-neutral-900">Distribusi per Cabor</div>
              </div>
            </div>
            {tournamentBySport.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tournamentBySport} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {tournamentBySport.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-neutral-400 text-center py-10">Belum ada data turnamen.</p>}
          </div>

          {/* Communities by activity level */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users size={16} className="text-amber-500" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Komunitas</div>
                <div className="font-display text-xl text-neutral-900">Tingkat Aktivitas</div>
              </div>
            </div>
            {communitySummary.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={communitySummary}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {communitySummary.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-neutral-400 text-center py-10">Belum ada data komunitas.</p>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
