import React, { useState, useEffect } from 'react';
import { Users, Trophy, Users2, Newspaper, Activity, ShieldCheck, TrendingUp, Sparkles, BarChart3, Tag, UserCog } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

export default function PlatformDashboard({ auth, onBack, onNav }) {
  const [stats, setStats] = useState({ users: 0, tournaments: 0, communities: 0, articles: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [
          { count: users },
          { count: tournaments },
          { count: communities },
          { count: articles },
          { data: activity },
        ] = await Promise.all([
          supabase.from('user_stats').select('*', { count: 'exact', head: true }),
          supabase.from('tournaments').select('*', { count: 'exact', head: true }),
          supabase.from('sport_communities').select('*', { count: 'exact', head: true }),
          supabase.from('news').select('*', { count: 'exact', head: true }),
          supabase
            .from('user_activity_log')
            .select('id,activity_title,activity_description,activity_type,activity_date,activity_category')
            .order('created_at', { ascending: false })
            .limit(8),
        ]);
        setStats({
          users: users || 0,
          tournaments: tournaments || 0,
          communities: communities || 0,
          articles: articles || 0,
        });
        setRecentActivity(activity || []);
      } catch (err) {
        console.error('PlatformDashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const quickActions = [
    { label: 'Dashboard', kicker: 'Platform', icon: BarChart3, active: true, onClick: null },
    { label: 'Newsroom', kicker: 'Platform', icon: Newspaper, onClick: () => onNav('newsroom') },
    { label: 'Moderasi', kicker: 'Platform', icon: ShieldCheck, onClick: () => onNav('moderation') },
    { label: 'Analytics', kicker: 'Platform', icon: TrendingUp, onClick: () => onNav('analytics') },
    { label: 'Verifikasi', kicker: 'Platform', icon: Sparkles, onClick: () => onNav('admin-verification-queue') },
    { label: 'User Management', kicker: 'Platform', icon: UserCog, onClick: () => onNav('user-management') },
    { label: 'Promo Platform', kicker: 'Platform', icon: Tag, onClick: () => onNav('platform-promo') },
    { label: 'Promo Sponsor', kicker: 'Platform', icon: Tag, onClick: () => onNav('sponsor-promo') },
  ];

  const activityTypeMap = {
    venue_booking:      { label: 'Booking Venue', color: 'bg-blue-100 text-blue-700' },
    tournament_join:    { label: 'Daftar Turnamen', color: 'bg-violet-100 text-violet-700' },
    community_join:     { label: 'Gabung Komunitas', color: 'bg-emerald-100 text-emerald-700' },
    training_enrollment:{ label: 'Daftar Pelatihan', color: 'bg-amber-100 text-amber-700' },
    article_read:       { label: 'Baca Artikel', color: 'bg-neutral-100 text-neutral-700' },
    trivia_complete:    { label: 'Trivia Selesai', color: 'bg-pink-100 text-pink-700' },
  };

  return (
    <AdminLayout
      variant="platform"
      kicker="/ PLATFORM CONSOLE"
      title={<>PLATFORM<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>dashboard.</span></>}
      subtitle="Ringkasan aktivitas platform, statistik pengguna, dan kontrol internal STADIONE."
      onBack={onBack}
    >
      {/* Quick nav */}
      <div className="flex flex-wrap gap-2 mb-8">
        {quickActions.map((qa) => {
          const Icon = qa.icon;
          return (
            <button
              key={qa.label}
              onClick={qa.onClick}
              disabled={qa.active}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold border transition
                ${qa.active
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-900 hover:text-neutral-900'}`}
            >
              <Icon size={14} />
              {qa.label}
            </button>
          );
        })}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total User" value={loading ? '—' : stats.users.toLocaleString()} sub="User terdaftar (gamification)" icon={Users} accent="violet" />
        <StatCard label="Turnamen" value={loading ? '—' : stats.tournaments.toLocaleString()} sub="Seluruh turnamen di platform" icon={Trophy} accent="emerald" />
        <StatCard label="Komunitas" value={loading ? '—' : stats.communities.toLocaleString()} sub="Komunitas olahraga aktif" icon={Users2} accent="blue" />
        <StatCard label="Artikel" value={loading ? '—' : stats.articles.toLocaleString()} sub="Total konten newsroom" icon={Newspaper} accent="amber" />
      </div>

      {/* Recent activity feed */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-500">Aktivitas terbaru</div>
              <div className="font-display text-2xl text-neutral-900 mt-0.5">Platform feed</div>
            </div>
            <Activity size={18} className="text-neutral-400" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada aktivitas" description="Aktivitas pengguna akan muncul di sini." />
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => {
                const type = activityTypeMap[item.activity_type] || { label: item.activity_type, color: 'bg-neutral-100 text-neutral-600' };
                return (
                  <div key={item.id} className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-neutral-50">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 mt-0.5 ${type.color}`}>
                      {type.label}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 text-sm truncate">{item.activity_title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5 truncate">{item.activity_description}</div>
                    </div>
                    <div className="text-xs text-neutral-400 shrink-0 ml-auto">
                      {item.activity_date ? new Date(item.activity_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick links sidebar */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5">
            <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-500 mb-4">Aksi cepat</div>
            <div className="space-y-2">
              {[
                { label: 'Buka Newsroom', sub: 'Tulis & kelola artikel', onClick: () => onNav('newsroom'), icon: Newspaper },
                { label: 'Moderasi Konten', sub: 'Tinjau laporan masuk', onClick: () => onNav('moderation'), icon: ShieldCheck },
                { label: 'Platform Analytics', sub: 'Lihat metrik platform', onClick: () => onNav('analytics'), icon: TrendingUp },
                { label: 'Verifikasi Operator', sub: 'Queue approval', onClick: () => onNav('admin-verification-queue'), icon: Sparkles },
                { label: 'Promo Platform', sub: 'Buat & kelola promo Stadione', onClick: () => onNav('platform-promo'), icon: Tag },
                { label: 'Promo Sponsor', sub: 'Kelola saldo & promo sponsor', onClick: () => onNav('sponsor-promo'), icon: Tag },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">{item.label}</div>
                      <div className="text-xs text-neutral-500">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
            <div className="text-xs uppercase tracking-[0.22em] font-black text-violet-600 mb-2">Platform status</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-neutral-900">Semua sistem normal</span>
            </div>
            <p className="text-xs text-neutral-500">STADIONE platform beroperasi penuh. Tidak ada incident aktif.</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
