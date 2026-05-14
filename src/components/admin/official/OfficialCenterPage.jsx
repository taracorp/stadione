import React, { useEffect, useState } from 'react';
import { Activity, Calendar, ClipboardList, ShieldCheck } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, StatCard } from '../AdminLayout.jsx';
import { fetchOfficialAssignments } from '../../../services/supabaseService.js';
import { getOfficialMatchCapabilities } from '../../../utils/permissions.js';

const ACTIONS = [
  { key: 'official-schedule', label: 'Jadwal Tugas', sub: 'Lihat assignment pertandingan dan konfirmasi kehadiran', icon: Calendar },
  { key: 'match-center', label: 'Match Center', sub: 'Input lineup, event pertandingan, dan live control', icon: Activity },
  { key: 'match-report', label: 'Laporan Resmi', sub: 'Finalize skor dan submit laporan pertandingan', icon: ClipboardList },
  { key: 'match-statistics', label: 'Statistik Match', sub: 'Ringkasan performa pemain dan event', icon: ShieldCheck },
];

export default function OfficialCenterPage({ auth, onBack, onNav }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ assigned: 0, confirmed: 0, completed: 0 });
  const capabilities = getOfficialMatchCapabilities({ userRoles: auth?.roles || [] });
  const actions = ACTIONS.filter((action) => {
    if (action.key === 'match-center') return capabilities.openMatchCenter;
    if (action.key === 'match-report') return capabilities.openMatchReport;
    if (action.key === 'match-statistics') return capabilities.openMatchStatistics;

    return true;
  });

  useEffect(() => {
    async function load() {
      if (!auth?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const rows = await fetchOfficialAssignments({ userId: auth.id, status: 'all' });
        setStats({
          assigned: rows.filter((item) => item.status === 'assigned').length,
          confirmed: rows.filter((item) => item.status === 'confirmed').length,
          completed: rows.filter((item) => item.status === 'completed').length,
        });
      } catch (err) {
        console.error('OfficialCenterPage load error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [auth?.id]);

  if (!auth?.id) {
    return (
      <AdminLayout
        variant="official"
        kicker="/ OFFICIAL CENTER"
        title={<>OFFICIAL<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>center.</span></>}
        subtitle="Pusat kerja official untuk jadwal, match center, laporan, dan statistik pertandingan."
        onBack={onBack}
      >
        <EmptyState
          icon={ShieldCheck}
          title="Masuk dulu"
          description="Official center hanya tampil untuk akun yang sudah login."
          action={<ActionButton onClick={() => onNav('profile')}>Buka Profil</ActionButton>}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      variant="official"
      kicker="/ OFFICIAL CENTER"
      title={<>OFFICIAL<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>center.</span></>}
      subtitle="Pusat kerja official untuk jadwal, match center, laporan, dan statistik pertandingan."
      onBack={onBack}
    >
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Assigned" value={loading ? '—' : stats.assigned} icon={Calendar} accent="amber" />
        <StatCard label="Confirmed" value={loading ? '—' : stats.confirmed} icon={Activity} accent="blue" />
        <StatCard label="Completed" value={loading ? '—' : stats.completed} icon={ClipboardList} accent="emerald" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {actions.map((action) => {
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