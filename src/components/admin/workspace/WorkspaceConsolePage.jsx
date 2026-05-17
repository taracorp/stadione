import React, { useEffect, useState } from 'react';
import { Building2, MapPin, ShieldCheck, Trophy, Users, Dumbbell } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, StatCard } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const ACTIONS = [
  { key: 'tournament-manager', label: 'Kelola Turnamen', sub: 'Pendaftaran, verifikasi, dan aturan pertandingan', icon: Trophy },
  { key: 'community-manager', label: 'Kelola Komunitas', sub: 'Membership, event, dan feed komunitas', icon: Users },
  { key: 'venue-workspace', label: 'Kelola Venue', sub: 'Venue OS untuk venue, lapangan, booking, dan staf', icon: MapPin },
  { key: 'training-manager', label: 'Kelola Pelatihan', sub: 'Coach, program, dan booking trial', icon: Dumbbell },
  { key: 'sponsor-manager', label: 'Kelola Sponsor', sub: 'Partnership dan kontrak sponsor', icon: ShieldCheck },
];

export default function WorkspaceConsolePage({ auth, onBack, onNav }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ tournaments: 0, communities: 0, venues: 0, sponsors: 0 });
  const [sponsorAlerts, setSponsorAlerts] = useState({ unread: 0, pending: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          supabase.from('tournaments').select('*', { count: 'exact', head: true }),
          supabase.from('sport_communities').select('*', { count: 'exact', head: true }),
          supabase.from('venues').select('*', { count: 'exact', head: true }),
          supabase.from('sponsors').select('*', { count: 'exact', head: true }),
          supabase
            .from('admin_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('admin_user_id', auth?.id || '')
            .eq('is_read', false),
          supabase
            .from('partnership_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);

        const tournaments = results[0].status === 'fulfilled' ? results[0].value?.count : 0;
        const communities = results[1].status === 'fulfilled' ? results[1].value?.count : 0;
        const venues = results[2].status === 'fulfilled' ? results[2].value?.count : 0;
        const sponsors = results[3].status === 'fulfilled' ? results[3].value?.count : 0;
        const unread = results[4].status === 'fulfilled' ? results[4].value?.count : 0;
        const pending = results[5].status === 'fulfilled' ? results[5].value?.count : 0;

        setStats({
          tournaments: tournaments || 0,
          communities: communities || 0,
          venues: venues || 0,
          sponsors: sponsors || 0,
        });
        setSponsorAlerts({ unread: unread || 0, pending: pending || 0 });
      } catch (err) {
        console.error('WorkspaceConsolePage load error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [auth?.id]);

  useEffect(() => {
    if (!auth?.id) return;

    const reload = async () => {
      try {
        const [{ count: unread }, { count: pending }] = await Promise.all([
          supabase
            .from('admin_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('admin_user_id', auth.id)
            .eq('is_read', false),
          supabase
            .from('partnership_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);
        setSponsorAlerts({ unread: unread || 0, pending: pending || 0 });
      } catch (err) {
        console.error('WorkspaceConsolePage realtime reload error:', err);
      }
    };

    const channel = supabase
      .channel(`workspace_console_sponsor:${auth.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notifications', filter: `admin_user_id=eq.${auth.id}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partnership_applications' }, reload)
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [auth?.id]);

  if (!auth?.id) {
    return (
      <AdminLayout
        variant="workspace"
        kicker="/ WORKSPACE CONSOLE"
        title={<>WORKSPACE<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>console.</span></>}
        subtitle="Pusat operasi untuk mengelola aset, turnamen, komunitas, dan pelatihan."
        onBack={onBack}
      >
        <EmptyState
          icon={Building2}
          title="Masuk dulu"
          description="Workspace console hanya bisa dibuka saat akun sudah login."
          action={<ActionButton onClick={() => onNav('profile')}>Buka Profil</ActionButton>}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ WORKSPACE CONSOLE"
      title={<>WORKSPACE<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>console.</span></>}
      subtitle="Pusat operasi untuk mengelola aset, turnamen, komunitas, dan pelatihan."
      onBack={onBack}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Turnamen" value={loading ? '—' : stats.tournaments} icon={Trophy} accent="emerald" />
        <StatCard label="Komunitas" value={loading ? '—' : stats.communities} icon={Users} accent="blue" />
        <StatCard label="Venue" value={loading ? '—' : stats.venues} icon={MapPin} accent="amber" />
        <StatCard label="Sponsor" value={loading ? '—' : stats.sponsors} icon={ShieldCheck} accent="violet" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const sponsorBadgeCount = sponsorAlerts.unread > 0 ? sponsorAlerts.unread : sponsorAlerts.pending;
          const showSponsorBadge = action.key === 'sponsor-manager' && sponsorBadgeCount > 0;
          return (
            <button
              key={action.key}
              onClick={() => onNav(action.key)}
              className="relative w-full rounded-3xl border border-neutral-200 bg-white p-6 text-left hover:border-neutral-900 transition"
            >
              {showSponsorBadge && (
                <div className="absolute top-4 right-4 min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                  {sponsorBadgeCount > 99 ? '99+' : sponsorBadgeCount}
                </div>
              )}
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4">
                <Icon size={18} />
              </div>
              <div className="font-display text-2xl text-neutral-900 mb-2">{action.label}</div>
              <p className="text-sm text-neutral-500 leading-relaxed">{action.sub}</p>
            </button>
          );
        })}
      </div>
    </AdminLayout>
  );
}