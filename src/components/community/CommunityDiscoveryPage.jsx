import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, Trophy, Zap } from 'lucide-react';
import { useCommunities } from '../../hooks/useSupabase.js';
import { joinCommunity } from '../../services/supabaseService.js';

function formatRupiah(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Gratis';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeCommunityRecord(row, index = 0) {
  const fee = Number(
    row?.membership_fee_amount
    || row?.membership_fee
    || row?.monthly_fee
    || row?.fee_amount
    || 0
  );

  return {
    id: row?.id || `community-${index}`,
    name: row?.name || 'Community Hub',
    sport: row?.sport || 'General',
    city: row?.city || 'Kota belum diatur',
    province: row?.province || 'Indonesia',
    members: Number(row?.members_count || row?.membershipCount || 0),
    isJoined: Boolean(row?.isJoined),
    membershipFee: Number.isFinite(fee) && fee > 0 ? fee : 0,
    membershipPeriod: row?.membership_period || 'bulan',
    tagline: row?.tagline || 'Komunitas aktif untuk aktivitas rutin dan movement bareng.',
    movementTitle: row?.latestEvent?.title || row?.tagline || 'Belum ada movement terbaru',
    movementTime: row?.latestEvent?.event_date || row?.latestEvent?.time_label || 'Jadwal menyusul',
    points: Number(row?.leaderboard_points || row?.points || row?.members_count || 0),
  };
}

export default function CommunityDiscoveryPage({ auth, openAuth, onSelectCommunity }) {
  const [query, setQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('Semua');
  const [leaderboardMode, setLeaderboardMode] = useState('umum');
  const [leaderboardSport, setLeaderboardSport] = useState('Semua');
  const [actionMessage, setActionMessage] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const { communities, loading, refetch } = useCommunities(auth?.id || null);

  const communitySource = useMemo(
    () => (communities || []).map((item, index) => normalizeCommunityRecord(item, index)),
    [communities]
  );

  const sportOptions = useMemo(() => ['Semua', ...new Set(communitySource.map((item) => item.sport).filter(Boolean))], [communitySource]);

  const filteredCommunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return communitySource
      .filter((item) => {
        if (sportFilter !== 'Semua' && item.sport !== sportFilter) return false;
        if (!normalizedQuery) return true;
        return [item.name, item.sport, item.city, item.province].join(' ').toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => b.members - a.members);
  }, [communitySource, query, sportFilter]);

  const movementFeed = useMemo(
    () => filteredCommunities.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.name,
      movementTitle: item.movementTitle,
      movementTime: item.movementTime,
      members: item.members,
    })),
    [filteredCommunities]
  );

  const leaderboardRows = useMemo(() => {
    const base = leaderboardMode === 'kategori' && leaderboardSport !== 'Semua'
      ? communitySource.filter((item) => item.sport === leaderboardSport)
      : communitySource;

    return [...base]
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        id: item.id,
        name: item.name,
        sport: item.sport,
        points: item.points,
        members: item.members,
      }));
  }, [communitySource, leaderboardMode, leaderboardSport]);

  const handlePrimaryAction = async (community) => {
    if (!auth?.id) {
      openAuth?.('login');
      return;
    }

    if (community.membershipFee > 0) {
      onSelectCommunity?.(community);
      return;
    }

    setJoiningId(String(community.id));
    const result = await joinCommunity(auth.id, community.id);
    setActionMessage(result.message || 'Aksi gabung diproses.');
    setJoiningId('');
    if (result.success) refetch();
  };

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 lg:py-10 space-y-6">
      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-8">
        <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Komunitas</div>
        <h1 className="font-display text-5xl lg:text-7xl leading-[0.9] text-neutral-900 mb-4">Cari, Join, dan Gerakkan Movement.</h1>
        <p className="text-sm lg:text-base text-neutral-600 max-w-3xl">Temukan komunitas yang relevan, gabung membership, lalu ikut movement dan leaderboard komunitas.</p>

        <div className="mt-5 grid lg:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari komunitas, kategori, atau kota"
              className="w-full rounded-2xl border border-neutral-300 bg-neutral-50 pl-11 pr-4 py-3 text-sm"
            />
          </div>
          <button className="rounded-2xl bg-neutral-900 px-5 py-3 text-xs font-black text-white">Buat Komunitas</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sportOptions.map((item) => (
            <button
              key={item}
              onClick={() => setSportFilter(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${sportFilter === item ? 'bg-[#E11D2E] border-[#E11D2E] text-white' : 'bg-white border-neutral-300 text-neutral-700'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-3 text-xs text-neutral-500">{loading ? 'Memuat komunitas...' : `${filteredCommunities.length} komunitas ditemukan`}</div>
      </section>

      {actionMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          {actionMessage}
        </div>
      )}

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-1">/ Rekomendasi Komunitas</div>
            <div className="font-display text-3xl text-neutral-900">Komunitas untuk Anda</div>
          </div>
        </div>

        {filteredCommunities.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-500">Belum ada komunitas sesuai pencarian. Ubah kata kunci atau kategori.</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCommunities.slice(0, 6).map((community) => {
              const joinLabel = community.isJoined
                ? 'Membership Aktif'
                : community.membershipFee > 0
                  ? 'Bayar & Gabung'
                  : 'Gabung Sekarang';

              return (
                <article key={community.id} className="rounded-3xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button onClick={() => onSelectCommunity?.(community)} className="font-display text-left text-2xl leading-tight text-neutral-900 hover:text-[#E11D2E]">{community.name}</button>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase text-neutral-700">{community.sport}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mb-3">{community.city}, {community.province}</div>
                  <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{community.tagline}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="rounded-xl bg-neutral-100 px-3 py-2"><div className="text-neutral-500 uppercase font-bold tracking-wide">Member</div><div className="font-bold text-neutral-900 mt-0.5">{community.members.toLocaleString('id-ID')}</div></div>
                    <div className="rounded-xl bg-neutral-100 px-3 py-2"><div className="text-neutral-500 uppercase font-bold tracking-wide">Membership</div><div className="font-bold text-neutral-900 mt-0.5">{formatRupiah(community.membershipFee)}</div></div>
                  </div>

                  <button
                    onClick={() => handlePrimaryAction(community)}
                    disabled={community.isJoined || joiningId === String(community.id)}
                    className={`w-full rounded-2xl px-4 py-2.5 text-xs font-black ${community.isJoined ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-900 text-white hover:bg-neutral-800'} disabled:cursor-not-allowed`}
                  >
                    {joiningId === String(community.id) ? 'MEMPROSES...' : joinLabel}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap size={16} className="text-neutral-700" />
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Movement Terbaru</div>
          </div>
          <div className="space-y-3">
            {movementFeed.length === 0 ? (
              <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada movement. Gabung komunitas untuk memulai movement pertama.</div>
            ) : (
              movementFeed.map((item) => (
                <div key={`movement-${item.id}`} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="font-bold text-neutral-900 text-sm">{item.title}</div>
                  <div className="text-sm text-neutral-600 mt-1">{item.movementTitle}</div>
                  <div className="text-xs text-neutral-500 mt-1">{item.movementTime} · {item.members.toLocaleString('id-ID')} member</div>
                  <button onClick={() => onSelectCommunity?.({ id: item.id })} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-neutral-900 hover:text-[#E11D2E]">Ikut Movement <ArrowRight size={13} /></button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
          <div className="inline-flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-neutral-700" />
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Leaderboard</div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setLeaderboardMode('umum')} className={`rounded-full px-3 py-1.5 text-xs font-black border ${leaderboardMode === 'umum' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>Umum</button>
            <button onClick={() => setLeaderboardMode('kategori')} className={`rounded-full px-3 py-1.5 text-xs font-black border ${leaderboardMode === 'kategori' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>By Kategori</button>
            {leaderboardMode === 'kategori' && (
              <select value={leaderboardSport} onChange={(event) => setLeaderboardSport(event.target.value)} className="ml-auto rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs">
                {sportOptions.map((item) => <option key={`lb-${item}`} value={item}>{item}</option>)}
              </select>
            )}
          </div>

          {leaderboardRows.length === 0 ? (
            <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada data leaderboard untuk kategori ini.</div>
          ) : (
            <div className="space-y-2">
              {leaderboardRows.map((row) => (
                <div key={`rank-${row.id}`} className="rounded-2xl border border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-black flex items-center justify-center">{row.rank}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-neutral-900 truncate">{row.name}</div>
                      <div className="text-xs text-neutral-500">{row.sport}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-neutral-900">{row.points.toLocaleString('id-ID')} pts</div>
                    <div className="text-[11px] text-neutral-500">{row.members.toLocaleString('id-ID')} member</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
