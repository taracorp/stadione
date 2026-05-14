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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ count: tournaments }, { count: communities }, { count: venues }, { count: sponsors }] = await Promise.all([
          supabase.from('tournaments').select('*', { count: 'exact', head: true }),
          supabase.from('sport_communities').select('*', { count: 'exact', head: true }),
          supabase.from('venues').select('*', { count: 'exact', head: true }),
          supabase.from('sponsors').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          tournaments: tournaments || 0,
          communities: communities || 0,
          venues: venues || 0,
          sponsors: sponsors || 0,
        });
      } catch (err) {
        console.error('WorkspaceConsolePage load error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

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
          return (
            <button
              key={action.key}
              onClick={() => onNav(action.key)}
              className="w-full rounded-3xl border border-neutral-200 bg-white p-6 text-left hover:border-neutral-900 transition"
            >
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