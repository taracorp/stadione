import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, ShieldCheck, Trophy, Zap } from 'lucide-react';
import { useCommunityDetail, useRecommendedCommunities } from '../../hooks/useSupabase.js';
import { joinCommunity, toggleCommunityBookmark, toggleCommunityEventAttendance } from '../../services/supabaseService.js';

function formatRupiah(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Gratis';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeCommunityRecord(row) {
  if (!row) return null;

  const membershipFee = Number(
    row?.membership_fee_amount
    || row?.membership_fee
    || row?.monthly_fee
    || row?.fee_amount
    || 0
  );

  const members = Number(row?.membershipCount || row?.members_count || 0);

  return {
    ...row,
    id: row?.id,
    name: row?.name || 'Community Hub',
    sport: row?.sport || 'General',
    city: row?.city || 'Kota belum diatur',
    province: row?.province || 'Indonesia',
    isJoined: Boolean(row?.isJoined),
    isBookmarked: Boolean(row?.isBookmarked),
    members,
    membershipFee: Number.isFinite(membershipFee) && membershipFee > 0 ? membershipFee : 0,
    membershipPeriod: row?.membership_period || 'bulan',
    badges: Array.isArray(row?.badges) ? row.badges : [],
    tagline: row?.tagline || 'Komunitas aktif untuk saling bertumbuh lewat movement olahraga.',
    events: Array.isArray(row?.events) ? row.events : [],
  };
}

export default function CommunityDetailPage({
  communityId,
  initialCommunity,
  auth,
  openAuth,
  onBack,
  onSelectCommunity,
  onMembershipCheckout,
  onCommunityRead,
}) {
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState('umum');
  const [leaderboardSport, setLeaderboardSport] = useState('Semua');
  const { community, loading, refetch } = useCommunityDetail(communityId || initialCommunity?.id, auth?.id || null);
  const { communities: recommendedCommunities } = useRecommendedCommunities(auth?.id || null, {
    limit: 6,
    excludeCommunityId: communityId || initialCommunity?.id,
  });

  const currentCommunity = useMemo(
    () => normalizeCommunityRecord(community || initialCommunity),
    [community, initialCommunity]
  );

  const leaderboardSource = useMemo(() => {
    const normalized = (recommendedCommunities || []).map((item) => normalizeCommunityRecord(item)).filter(Boolean);
    return [currentCommunity, ...normalized].filter(Boolean);
  }, [currentCommunity, recommendedCommunities]);

  const sportOptions = useMemo(
    () => ['Semua', ...new Set(leaderboardSource.map((item) => item.sport).filter(Boolean))],
    [leaderboardSource]
  );

  const leaderboardRows = useMemo(() => {
    const filtered = leaderboardMode === 'kategori' && leaderboardSport !== 'Semua'
      ? leaderboardSource.filter((item) => item.sport === leaderboardSport)
      : leaderboardSource;

    return [...filtered]
      .sort((a, b) => (Number(b.members || 0) - Number(a.members || 0)))
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        id: item.id,
        name: item.name,
        sport: item.sport,
        members: Number(item.members || 0),
        points: Number(item.members || 0),
      }));
  }, [leaderboardMode, leaderboardSource, leaderboardSport]);

  useEffect(() => {
    if (currentCommunity?.id && typeof onCommunityRead === 'function') {
      onCommunityRead(currentCommunity.id);
    }
  }, [currentCommunity?.id, onCommunityRead]);

  const ensureAuth = () => {
    if (auth?.id) return true;
    openAuth?.('login');
    return false;
  };

  const handleJoinMembership = async () => {
    if (!currentCommunity?.id || !ensureAuth()) return;

    if (currentCommunity.membershipFee > 0) {
      if (typeof onMembershipCheckout === 'function') {
        onMembershipCheckout(currentCommunity);
        return;
      }
      setActionMessage('Membership berbayar siap. Silakan lanjutkan ke pembayaran.');
      return;
    }

    setActionLoading(true);
    const result = await joinCommunity(auth.id, currentCommunity.id);
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi gabung diproses.');
    if (result.success) refetch();
  };

  const handleBookmark = async () => {
    if (!currentCommunity?.id || !ensureAuth()) return;

    setActionLoading(true);
    const result = await toggleCommunityBookmark(auth.id, currentCommunity);
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi bookmark diproses.');
    if (result.success) refetch();
  };

  const handleAttendMovement = async (event) => {
    if (!currentCommunity?.id || !event?.id || !ensureAuth()) return;

    if (!currentCommunity.isJoined) {
      setActionMessage('Gabung komunitas dulu sebelum ikut movement.');
      return;
    }

    setActionLoading(true);
    const result = await toggleCommunityEventAttendance({
      community: currentCommunity,
      event,
      userId: auth.id,
    });
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi movement diproses.');
    if (result.success) refetch();
  };

  if (loading && !currentCommunity) {
    return <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 text-center text-neutral-500">Memuat profil komunitas...</div>;
  }

  if (!currentCommunity) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700">
          <ArrowLeft size={14} /> KEMBALI
        </button>
        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 text-neutral-500">Komunitas tidak ditemukan.</div>
      </div>
    );
  }

  const joinLabel = currentCommunity.isJoined
    ? 'Membership Aktif'
    : currentCommunity.membershipFee > 0
      ? 'Bayar & Gabung'
      : 'Gabung Sekarang';

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 lg:py-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 hover:border-neutral-900">
          <ArrowLeft size={14} /> KEMBALI KE KOMUNITAS
        </button>
        <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Profil Komunitas</div>
      </div>

      {actionMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          {actionMessage}
        </div>
      )}

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-8">
        <div className="grid lg:grid-cols-[1.35fr_0.85fr] gap-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {currentCommunity.badges.slice(0, 3).map((badge) => (
                <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-700">
                  <ShieldCheck size={12} />
                  {badge}
                </span>
              ))}
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-700">{currentCommunity.sport}</span>
            </div>

            <h1 className="font-display text-5xl lg:text-6xl leading-[0.9] text-neutral-900">{currentCommunity.name}</h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-neutral-500"><MapPin size={14} /> {currentCommunity.city}, {currentCommunity.province}</div>
            <p className="mt-4 text-base text-neutral-600 leading-relaxed max-w-3xl">{currentCommunity.tagline}</p>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Member</div><div className="mt-1 text-lg font-black text-neutral-900">{currentCommunity.members.toLocaleString('id-ID')}</div></div>
              <div className="rounded-xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Membership</div><div className="mt-1 text-lg font-black text-neutral-900">{formatRupiah(currentCommunity.membershipFee)}</div></div>
              <div className="rounded-xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Periode</div><div className="mt-1 text-lg font-black text-neutral-900">/{currentCommunity.membershipPeriod}</div></div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Membership</div>
            <div className="font-display text-3xl text-neutral-900 mb-1">{formatRupiah(currentCommunity.membershipFee)}</div>
            <div className="text-xs text-neutral-500 mb-4">per {currentCommunity.membershipPeriod}</div>

            <div className="space-y-2 text-sm text-neutral-600 mb-4">
              <div>1. Akses movement komunitas.</div>
              <div>2. Bisa ikut leaderboard internal.</div>
              <div>3. Update event dan pengumuman prioritas.</div>
            </div>

            <button
              onClick={handleJoinMembership}
              disabled={actionLoading || currentCommunity.isJoined}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-black ${currentCommunity.isJoined ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-900 text-white hover:bg-neutral-800'} disabled:cursor-not-allowed`}
            >
              {actionLoading ? 'MEMPROSES...' : joinLabel}
            </button>

            <button
              onClick={handleBookmark}
              disabled={actionLoading}
              className="mt-3 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-xs font-black text-neutral-900 hover:border-neutral-900"
            >
              Simpan Komunitas
            </button>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap size={16} className="text-neutral-700" />
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Movement Terbaru</div>
          </div>
          <div className="space-y-3">
            {currentCommunity.events.length === 0 ? (
              <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada movement terbaru untuk komunitas ini.</div>
            ) : (
              currentCommunity.events.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="font-bold text-neutral-900 text-sm">{event.title}</div>
                  <div className="text-sm text-neutral-600 mt-1">{event.description || 'Event komunitas untuk meningkatkan aktivitas member.'}</div>
                  <div className="mt-2 text-xs text-neutral-500 inline-flex items-center gap-1"><CalendarDays size={12} /> {event.event_date || 'Tanggal menyusul'} · {event.time_label || 'Waktu menyusul'}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-neutral-500">{Number(event.attendees_count || 0).toLocaleString('id-ID')} peserta</div>
                    <button
                      onClick={() => handleAttendMovement(event)}
                      disabled={actionLoading}
                      className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white disabled:bg-neutral-300"
                    >
                      Ikut Movement
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-neutral-700" />
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Leaderboard Mini</div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setLeaderboardMode('umum')} className={`rounded-full px-3 py-1.5 text-xs font-black border ${leaderboardMode === 'umum' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>Umum</button>
            <button onClick={() => setLeaderboardMode('kategori')} className={`rounded-full px-3 py-1.5 text-xs font-black border ${leaderboardMode === 'kategori' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>By Kategori</button>
            {leaderboardMode === 'kategori' && (
              <select value={leaderboardSport} onChange={(event) => setLeaderboardSport(event.target.value)} className="ml-auto rounded-xl border border-neutral-300 bg-white px-2.5 py-1.5 text-xs">
                {sportOptions.map((item) => <option key={`sport-${item}`} value={item}>{item}</option>)}
              </select>
            )}
          </div>

          {leaderboardRows.length === 0 ? (
            <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada data leaderboard.</div>
          ) : (
            <div className="space-y-2">
              {leaderboardRows.map((row) => (
                <div key={`row-${row.id}`} className="rounded-2xl border border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
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

          {recommendedCommunities.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Komunitas Terkait</div>
              <div className="space-y-2">
                {recommendedCommunities.slice(0, 2).map((item) => (
                  <button key={`related-${item.id}`} onClick={() => onSelectCommunity?.(item)} className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left">
                    <div className="font-semibold text-sm text-neutral-900">{item.name}</div>
                    <div className="text-xs text-neutral-500">{item.city} · {item.sport}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-neutral-800">Lihat profil <ArrowRight size={12} /></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
