import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, ShieldCheck, Target, Trophy, Users, Activity } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, StatCard, StatusBadge } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

function labelPlayer(player) {
  return player?.player_name || player?.jersey_name || `Player #${player?.id}`;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

export default function MatchStatisticsPage({ auth, onBack, onNav, matchContext }) {
  const sourceType = matchContext?.sourceType || matchContext?.source_type || (matchContext?.venueMatchId || matchContext?.venue_match_id ? 'venue_tournament' : 'tournament');
  const tournamentId = matchContext?.tournamentId || matchContext?.tournament_id || null;
  const matchEntryId = matchContext?.matchEntryId || matchContext?.match_entry_id || null;
  const venueTournamentId = matchContext?.venueTournamentId || matchContext?.venue_tournament_id || null;
  const venueMatchId = matchContext?.venueMatchId || matchContext?.venue_match_id || matchEntryId || null;
  const isVenueTournamentSource = sourceType === 'venue_tournament';
  const hasMatchContext = isVenueTournamentSource
    ? Boolean(venueTournamentId && venueMatchId)
    : Boolean(tournamentId && matchEntryId);

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState([]);
  const [events, setEvents] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [report, setReport] = useState(null);

  const load = useCallback(async () => {
    if (!hasMatchContext) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isVenueTournamentSource) {
        const [{ data: venueTournamentData, error: venueTournamentError }, { data: venueMatchData, error: venueMatchError }, { data: venueTeams, error: venueTeamsError }, { data: venueReportData, error: venueReportError }, { data: venueEventData, error: venueEventError }] = await Promise.all([
          supabase.from('venue_tournaments').select('id,name,sport_type,format,status').eq('id', venueTournamentId).maybeSingle(),
          supabase.from('venue_tournament_matches').select('id,round_name,scheduled_date,scheduled_time,home_score,away_score,status,court_id,home_team_id,away_team_id').eq('id', venueMatchId).maybeSingle(),
          supabase.from('venue_tournament_teams').select('id,team_name').eq('tournament_id', venueTournamentId),
          supabase.from('venue_match_reports').select('*').eq('venue_match_id', venueMatchId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('venue_match_events').select('id,event_type,player_name,team,minute,description,created_at').eq('venue_match_id', venueMatchId).order('created_at', { ascending: true }),
        ]);

        if (venueTournamentError) throw venueTournamentError;
        if (venueMatchError) throw venueMatchError;
        if (venueTeamsError) throw venueTeamsError;
        if (venueReportError) throw venueReportError;
        if (venueEventError) throw venueEventError;

        let courtName = '';
        if (venueMatchData?.court_id) {
          const { data: courtData, error: courtError } = await supabase.from('venue_courts').select('id,name').eq('id', venueMatchData.court_id).maybeSingle();
          if (courtError) throw courtError;
          courtName = courtData?.name || '';
        }

        const teamMap = (venueTeams || []).reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});

        setTournament(venueTournamentData ? {
          id: venueTournamentData.id,
          name: venueTournamentData.name,
          sport: venueTournamentData.sport_type,
          format: venueTournamentData.format,
          status: venueTournamentData.status,
        } : null);
        setSchedule(venueMatchData ? {
          tournament_id: venueTournamentId,
          entry_id: String(venueMatchData.id),
          date: venueMatchData.scheduled_date,
          home: teamMap[venueMatchData.home_team_id]?.team_name || 'Home',
          away: teamMap[venueMatchData.away_team_id]?.team_name || 'Away',
          score: `${Number(venueMatchData.home_score || 0)}-${Number(venueMatchData.away_score || 0)}`,
          status: venueMatchData.status,
          venue: [courtName, venueMatchData.round_name].filter(Boolean).join(' · '),
        } : null);
        setReport(venueReportData || null);
        setStats([]);
        setEvents(venueEventData || []);
        setPlayers([]);
        setLineups([]);
        setLoading(false);
        return;
      }

      const [{ data: tourData }, { data: scheduleData }, { data: statsData }, { data: eventData }, { data: playerData }, { data: lineupData }] = await Promise.all([
        supabase.from('tournaments').select('id,name,sport,format,host,status').eq('id', tournamentId).maybeSingle(),
        supabase.from('tournament_schedule').select('tournament_id,entry_id,date,home,away,score,status').eq('tournament_id', tournamentId).eq('entry_id', matchEntryId).maybeSingle(),
        supabase.from('match_statistics').select('id,tournament_id,match_id,player_id,goals,assists,yellow_cards,red_cards,minutes_played,rating,created_at').eq('tournament_id', tournamentId).eq('match_id', String(matchEntryId)),
        supabase.from('match_events').select('id,event_type,player_name,team,minute,description,created_at').eq('tournament_id', tournamentId).eq('match_entry_id', String(matchEntryId)).order('created_at', { ascending: true }),
        supabase.from('tournament_players').select('id,tournament_id,user_id,player_number,position,player_name,jersey_name,status').eq('tournament_id', tournamentId),
        supabase.from('player_lineups').select('id,tournament_id,match_id,player_id,starting_eleven').eq('tournament_id', tournamentId).eq('match_id', String(matchEntryId)),
      ]);

      setTournament(tourData || null);
      setSchedule(scheduleData || null);
      setStats(statsData || []);
      setEvents(eventData || []);
      setPlayers(playerData || []);
      setLineups(lineupData || []);
      setReport(null);
    } catch (err) {
      console.error('MatchStatistics load error:', err);
    } finally {
      setLoading(false);
    }
  }, [hasMatchContext, isVenueTournamentSource, matchEntryId, tournamentId, venueMatchId, venueTournamentId]);

  useEffect(() => { load(); }, [load]);

  const scoreSummary = useMemo(() => {
    const home = schedule?.home || 'Home';
    const away = schedule?.away || 'Away';
    const summary = { [home]: 0, [away]: 0 };
    events.forEach((event) => {
      if (event.event_type === 'goal' && event.team) summary[event.team] = (summary[event.team] || 0) + 1;
    });
    return summary;
  }, [events, schedule]);

  const playerMap = useMemo(() => {
    const map = new Map();
    players.forEach((player) => map.set(String(player.id), player));
    return map;
  }, [players]);

  const enrichedStats = useMemo(() => {
    if (isVenueTournamentSource) {
      const [homeGoals = 0, awayGoals = 0] = String(schedule?.score || '0-0').split('-').map((value) => Number(value || 0));
      const yellowCards = events.filter((event) => event.event_type === 'yellow_card').length;
      const redCards = events.filter((event) => event.event_type === 'red_card').length;
      const assists = events.filter((event) => event.event_type === 'assist').length;
      return [
        {
          player_label: schedule?.home || 'Home',
          goals: homeGoals,
          assists,
          yellow_cards: yellowCards,
          red_cards: redCards,
          minutes_played: 90,
          rating: report?.status === 'submitted' ? 'final' : 'draft',
        },
        {
          player_label: schedule?.away || 'Away',
          goals: awayGoals,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          minutes_played: 90,
          rating: report?.status === 'submitted' ? 'final' : 'draft',
        },
      ];
    }

    if (stats.length > 0) {
      return stats
        .map((stat) => ({
          ...stat,
          player_label: labelPlayer(playerMap.get(String(stat.player_id))),
        }))
        .sort((a, b) => (b.goals || 0) - (a.goals || 0) || (b.assists || 0) - (a.assists || 0));
    }

    const maxMinute = events.reduce((acc, item) => {
      const minute = Number(item?.minute);
      if (!Number.isFinite(minute)) return acc;
      return Math.max(acc, minute);
    }, 0);
    const effectiveMaxMinute = maxMinute > 0 ? maxMinute : 90;

    const nameToPlayer = {};
    const eventCount = {};

    players.forEach((player) => {
      const label = labelPlayer(player);
      nameToPlayer[normalizeName(label)] = player;
      eventCount[player.id] = {
        player_label: label,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        minutes_played: 0,
        rating: 0,
        entry_minute: null,
        exit_minute: null,
      };
    });

    lineups.forEach((lineup) => {
      if (!lineup?.starting_eleven) return;
      if (!eventCount[lineup.player_id]) return;
      eventCount[lineup.player_id].entry_minute = 0;
    });

    const sortedEvents = [...events].sort((a, b) => {
      const minuteA = Number(a?.minute);
      const minuteB = Number(b?.minute);
      if (Number.isFinite(minuteA) && Number.isFinite(minuteB) && minuteA !== minuteB) return minuteA - minuteB;
      return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
    });

    sortedEvents.forEach((event) => {
      const mappedPlayer = nameToPlayer[normalizeName(event?.player_name)] || null;
      const key = mappedPlayer?.id;
      if (!key || !eventCount[key]) return;
      const row = eventCount[key];
      const minute = Number(event?.minute);

      if (event.event_type === 'goal') row.goals += 1;
      if (event.event_type === 'assist') row.assists += 1;
      if (event.event_type === 'yellow_card') row.yellow_cards += 1;
      if (event.event_type === 'red_card') row.red_cards += 1;
      if (event.event_type === 'sub_in' && Number.isFinite(minute)) {
        row.entry_minute = minute;
        row.exit_minute = null;
      }
      if (event.event_type === 'sub_out' && Number.isFinite(minute)) row.exit_minute = minute;
      if (event.event_type === 'red_card' && Number.isFinite(minute)) row.exit_minute = minute;
    });

    return Object.values(eventCount)
      .map((row) => {
        const startMinute = Number.isFinite(row.entry_minute) ? row.entry_minute : null;
        const endMinute = Number.isFinite(row.exit_minute) ? row.exit_minute : effectiveMaxMinute;
        return {
          ...row,
          minutes_played: startMinute === null ? 0 : Math.max(0, endMinute - startMinute),
        };
      })
      .filter((row) => row.goals || row.assists || row.yellow_cards || row.red_cards || row.minutes_played)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  }, [events, isVenueTournamentSource, lineups, playerMap, players, report?.status, schedule?.away, schedule?.home, schedule?.score, stats]);

  const totalGoals = scoreSummary[schedule?.home || 'Home'] + scoreSummary[schedule?.away || 'Away'];
  const yellowTotal = events.filter((event) => event.event_type === 'yellow_card').length;
  const redTotal = events.filter((event) => event.event_type === 'red_card').length;

  return (
    <AdminLayout
      variant="official"
      kicker="/ OFFICIAL — STATISTIK"
      title={<>STATISTIK<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>pertandingan.</span></>}
      subtitle="Ringkasan statistik per laga dan performa pemain."
      onBack={onBack}
      breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal', onClick: () => onNav('official-schedule') }, { label: 'Match Statistics' }]}
    >
      {!loading && !hasMatchContext ? (
        <EmptyState
          icon={BarChart3}
          title="Pilih pertandingan dulu"
          description="Statistik pertandingan hanya tersedia jika Anda membuka halaman ini dari jadwal official."
          action={<ActionButton onClick={() => onNav('official-schedule')}>Buka Jadwal Official</ActionButton>}
        />
      ) : null}

      {!loading && hasMatchContext ? (
        <>
      {isVenueTournamentSource && (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Statistik source venue tournament sudah memakai skor match, timeline event venue, dan laporan resmi venue. Statistik pemain detail akan menyusul setelah engine roster lintas source disatukan.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Goals" value={loading ? '—' : totalGoals} icon={Target} accent="emerald" />
        <StatCard label={isVenueTournamentSource ? 'Attendance' : 'Yellow Cards'} value={loading ? '—' : (isVenueTournamentSource ? (report?.attendance || '—') : yellowTotal)} icon={ShieldCheck} accent="amber" />
        <StatCard label={isVenueTournamentSource ? 'Report' : 'Red Cards'} value={loading ? '—' : (isVenueTournamentSource ? (report?.status || 'draft') : redTotal)} icon={ShieldCheck} accent="red" />
        <StatCard label={isVenueTournamentSource ? 'Tim' : 'Pemain'} value={loading ? '—' : (isVenueTournamentSource ? 2 : players.length)} icon={Users} accent="violet" />
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-400 mb-1">Match Stats</div>
            <div className="font-display text-3xl text-neutral-900 leading-none">{schedule?.home || 'Home'} vs {schedule?.away || 'Away'}</div>
            <div className="text-sm text-neutral-500 mt-2">{tournament?.name || 'Turnamen'} · {schedule?.date || 'Tanggal belum tersedia'}</div>
          </div>
          <div className="flex items-center gap-2">
            {schedule?.status && <StatusBadge status={schedule.status} />}
            {schedule?.score && <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.14em] bg-neutral-100 text-neutral-700">{schedule.score}</span>}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Venue</div>
            <div className="font-semibold text-neutral-900">{schedule?.venue || 'Belum diisi'}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Assignment</div>
            <div className="font-semibold text-neutral-900">{matchContext?.assignmentRole || 'Match Official'}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">{isVenueTournamentSource ? 'Report Status' : 'Event Count'}</div>
            <div className="font-semibold text-neutral-900">{isVenueTournamentSource ? (report?.status || 'draft') : `${events.length} event tercatat`}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-violet-600" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Leaderboard</div>
                <div className="font-display text-2xl text-neutral-900">{isVenueTournamentSource ? 'Team performance' : 'Player performance'}</div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, index) => <div key={index} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : enrichedStats.length === 0 ? (
            <EmptyState icon={BarChart3} title={isVenueTournamentSource ? 'Belum ada ringkasan venue match' : 'Belum ada statistik'} description={isVenueTournamentSource ? 'Submit laporan venue match untuk melihat ringkasan skor dan attendance di sini.' : 'Statistik match akan muncul setelah data dimasukkan.'} />
          ) : (
            <div className="space-y-2">
              {enrichedStats.map((row, index) => (
                <div key={`${row.player_label}-${index}`} className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="font-semibold text-neutral-900">{index + 1}. {row.player_label}</div>
                      <div className="text-xs text-neutral-500">{row.minutes_played || 0} menit · Rating {row.rating || '-'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] bg-emerald-100 text-emerald-700">G {row.goals || 0}</span>
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] bg-blue-100 text-blue-700">A {row.assists || 0}</span>
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] bg-amber-100 text-amber-700">Y {row.yellow_cards || 0}</span>
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] bg-rose-100 text-rose-700">R {row.red_cards || 0}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full bg-neutral-900" style={{ width: `${Math.min(100, ((row.goals || 0) * 40) + ((row.assists || 0) * 25) + 20)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-blue-600" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Timeline</div>
                <div className="font-display text-2xl text-neutral-900">Match events</div>
              </div>
            </div>

            {events.length === 0 ? (
              <EmptyState icon={Activity} title={isVenueTournamentSource ? 'Timeline event venue belum tersedia' : 'Tidak ada event'} description={isVenueTournamentSource ? 'Tambahkan event live dari Match Center venue untuk melihat timeline di sini.' : undefined} />
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {events.map((event) => (
                  <div key={event.id} className="p-3 rounded-2xl border border-neutral-200 bg-neutral-50">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-neutral-700">{event.event_type.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-neutral-900">{event.player_name}</span>
                      {event.minute !== null && event.minute !== undefined && <span className="text-xs text-neutral-500">{event.minute}'</span>}
                    </div>
                    <div className="text-xs text-neutral-500">{event.team}{event.description ? ` · ${event.description}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} className="text-emerald-600" />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Summary</div>
                <div className="font-display text-2xl text-neutral-900">Score snapshot</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">{schedule?.home || 'Home'}</div>
                <div className="font-display text-4xl text-neutral-900">{scoreSummary[schedule?.home || 'Home'] || 0}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">{schedule?.away || 'Away'}</div>
                <div className="font-display text-4xl text-neutral-900">{scoreSummary[schedule?.away || 'Away'] || 0}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton variant="outline" onClick={() => onNav('match-center', matchContext)}>
                Kembali ke Match Center <ArrowRight size={14} />
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => onNav('match-report', matchContext)}>
                Buka Laporan <ArrowRight size={14} />
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => onNav('official-schedule')}>
                Kembali ke Jadwal <ArrowRight size={14} />
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
        </>
      ) : null}
    </AdminLayout>
  );
}