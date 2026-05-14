import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Activity, Calendar, FileText, Save, Send, CheckCircle } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, StatCard, StatusBadge, inputCls, textareaCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';
import { getOfficialMatchCapabilities } from '../../../utils/permissions.js';

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function deriveStatisticsFromEvents(players = [], lineups = [], events = []) {
  const maxMinute = events.reduce((acc, item) => {
    const minute = Number(item?.minute);
    if (!Number.isFinite(minute)) return acc;
    return Math.max(acc, minute);
  }, 0);
  const effectiveMaxMinute = maxMinute > 0 ? maxMinute : 90;

  const playerByName = {};
  const stateById = {};

  players.forEach((player) => {
    const label = player?.player_name || player?.jersey_name;
    if (label) playerByName[normalizeName(label)] = player;
    stateById[player.id] = {
      player_id: player.id,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      entry_minute: null,
      exit_minute: null,
    };
  });

  lineups.forEach((lineup) => {
    if (!lineup?.starting_eleven) return;
    if (!stateById[lineup.player_id]) return;
    stateById[lineup.player_id].entry_minute = 0;
  });

  const sortedEvents = [...events].sort((a, b) => {
    const minuteA = Number(a?.minute);
    const minuteB = Number(b?.minute);
    if (Number.isFinite(minuteA) && Number.isFinite(minuteB) && minuteA !== minuteB) return minuteA - minuteB;
    return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
  });

  sortedEvents.forEach((event) => {
    const mappedPlayer = playerByName[normalizeName(event?.player_name)];
    if (!mappedPlayer || !stateById[mappedPlayer.id]) return;
    const minute = Number(event?.minute);
    const stat = stateById[mappedPlayer.id];

    if (event?.event_type === 'goal') stat.goals += 1;
    if (event?.event_type === 'assist') stat.assists += 1;
    if (event?.event_type === 'yellow_card') stat.yellow_cards += 1;
    if (event?.event_type === 'red_card') stat.red_cards += 1;

    if (event?.event_type === 'sub_in' && Number.isFinite(minute)) {
      stat.entry_minute = minute;
      stat.exit_minute = null;
    }

    if (event?.event_type === 'sub_out' && Number.isFinite(minute)) {
      stat.exit_minute = minute;
    }

    if (event?.event_type === 'red_card' && Number.isFinite(minute)) {
      stat.exit_minute = minute;
    }
  });

  return Object.values(stateById)
    .map((stat) => {
      const startMinute = Number.isFinite(stat.entry_minute) ? stat.entry_minute : null;
      const endMinute = Number.isFinite(stat.exit_minute) ? stat.exit_minute : effectiveMaxMinute;
      const minutesPlayed = startMinute === null ? 0 : Math.max(0, endMinute - startMinute);
      return {
        player_id: stat.player_id,
        goals: stat.goals,
        assists: stat.assists,
        yellow_cards: stat.yellow_cards,
        red_cards: stat.red_cards,
        minutes_played: minutesPlayed,
      };
    })
    .filter((item) => item.goals || item.assists || item.yellow_cards || item.red_cards || item.minutes_played);
}

export default function MatchReportPage({ auth, onBack, onNav, matchContext }) {
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
  const [saving, setSaving] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [existingReport, setExistingReport] = useState(null);
  const [form, setForm] = useState({ homeScore: '0', awayScore: '0', attendance: '', venue: '', reportText: '', incidents: '' });
  const [message, setMessage] = useState(null);
  const capabilities = getOfficialMatchCapabilities({
    userRoles: auth?.roles || [],
    assignmentRole: matchContext?.assignmentRole,
  });

  if (!capabilities.openMatchReport) {
    return (
      <AdminLayout
        variant="official"
        kicker="/ OFFICIAL — LAPORAN"
        title={<>LAPORAN<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>pertandingan.</span></>}
        subtitle="Finalize skor akhir, narasi laga, dan kirim laporan resmi pertandingan."
        onBack={onBack}
        breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal', onClick: () => onNav('official-schedule') }, { label: 'Match Report' }]}
      >
        <EmptyState
          icon={FileText}
          title="Akses laporan ditolak"
          description="Role official aktif Anda tidak memiliki izin membuka Match Report untuk assignment ini."
          action={<ActionButton variant="outline" onClick={() => onNav('official-schedule')}>Kembali ke Jadwal</ActionButton>}
        />
      </AdminLayout>
    );
  }

  const load = useCallback(async () => {
    if (!hasMatchContext) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isVenueTournamentSource) {
        const [{ data: venueTournamentData, error: venueTournamentError }, { data: venueMatchData, error: venueMatchError }, { data: venueTeams, error: venueTeamsError }, { data: venueReportData, error: venueReportError }] = await Promise.all([
          supabase.from('venue_tournaments').select('id,name,sport_type,format,status').eq('id', venueTournamentId).maybeSingle(),
          supabase.from('venue_tournament_matches').select('id,round_name,scheduled_date,scheduled_time,home_score,away_score,status,court_id,home_team_id,away_team_id,winner_team_id').eq('id', venueMatchId).maybeSingle(),
          supabase.from('venue_tournament_teams').select('id,team_name').eq('tournament_id', venueTournamentId),
          supabase.from('venue_match_reports').select('*').eq('venue_match_id', venueMatchId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        if (venueTournamentError) throw venueTournamentError;
        if (venueMatchError) throw venueMatchError;
        if (venueTeamsError) throw venueTeamsError;
        if (venueReportError) throw venueReportError;

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
        const homeTeamName = teamMap[venueMatchData?.home_team_id]?.team_name || 'Home';
        const awayTeamName = teamMap[venueMatchData?.away_team_id]?.team_name || 'Away';
        const venueLabel = [courtName, venueMatchData?.round_name].filter(Boolean).join(' · ');

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
          home: homeTeamName,
          away: awayTeamName,
          score: `${Number(venueMatchData.home_score || 0)}-${Number(venueMatchData.away_score || 0)}`,
          status: venueMatchData.status,
          venue: venueLabel || null,
          home_team_id: venueMatchData.home_team_id,
          away_team_id: venueMatchData.away_team_id,
        } : null);
        setEvents([]);
        setPlayers([]);
        setLineups([]);
        setExistingReport(venueReportData || null);
        setForm({
          homeScore: venueReportData?.final_score_home !== undefined && venueReportData?.final_score_home !== null ? String(venueReportData.final_score_home) : String(venueMatchData?.home_score || 0),
          awayScore: venueReportData?.final_score_away !== undefined && venueReportData?.final_score_away !== null ? String(venueReportData.final_score_away) : String(venueMatchData?.away_score || 0),
          attendance: venueReportData?.attendance !== null && venueReportData?.attendance !== undefined ? String(venueReportData.attendance) : '',
          venue: venueReportData?.venue || venueLabel || '',
          reportText: venueReportData?.report_text || '',
          incidents: venueReportData?.incidents || '',
        });
        setMessage(null);
        setLoading(false);
        return;
      }

      const [{ data: tourData }, { data: scheduleData }, { data: eventData }, { data: reportData }, { data: playerData }, { data: lineupData }] = await Promise.all([
        supabase.from('tournaments').select('id,name,sport,format,host,color,status').eq('id', tournamentId).maybeSingle(),
        supabase.from('tournament_schedule').select('tournament_id,entry_id,date,home,away,score,status,venue').eq('tournament_id', tournamentId).eq('entry_id', matchEntryId).maybeSingle(),
        supabase.from('match_events').select('id,event_type,player_name,team,minute,description,created_at').eq('tournament_id', tournamentId).eq('match_entry_id', String(matchEntryId)).order('created_at', { ascending: true }),
        supabase.from('match_reports').select('*').eq('tournament_id', tournamentId).eq('match_entry_id', String(matchEntryId)).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('tournament_players').select('id,player_name,jersey_name').eq('tournament_id', tournamentId),
        supabase.from('player_lineups').select('id,tournament_id,match_id,player_id,starting_eleven').eq('tournament_id', tournamentId).eq('match_id', String(matchEntryId)),
      ]);

      setTournament(tourData || null);
      setSchedule(scheduleData || null);
      setEvents(eventData || []);
      setPlayers(playerData || []);
      setLineups(lineupData || []);
      setExistingReport(reportData || null);

      setForm({
        homeScore: reportData?.final_score_home !== undefined && reportData?.final_score_home !== null ? String(reportData.final_score_home) : String(scheduleData?.score?.split?.('-')?.[0] || 0),
        awayScore: reportData?.final_score_away !== undefined && reportData?.final_score_away !== null ? String(reportData.final_score_away) : String(scheduleData?.score?.split?.('-')?.[1] || 0),
        attendance: reportData?.attendance !== null && reportData?.attendance !== undefined ? String(reportData.attendance) : '',
        venue: reportData?.venue || scheduleData?.venue || '',
        reportText: reportData?.report_text || '',
        incidents: reportData?.incidents || '',
      });
      setMessage(null);
    } catch (err) {
      console.error('MatchReport load error:', err);
      setMessage({ type: 'error', text: 'Gagal memuat laporan pertandingan.' });
    } finally {
      setLoading(false);
    }
  }, [hasMatchContext, isVenueTournamentSource, matchEntryId, tournamentId, venueMatchId, venueTournamentId]);

  useEffect(() => { load(); }, [load]);

  const goalEvents = events.filter((event) => event.event_type === 'goal');

  async function syncMatchStatistics() {
    if (isVenueTournamentSource) return;
    const derived = deriveStatisticsFromEvents(players, lineups, events);
    if (!derived.length) return;

    const { data: existingStats } = await supabase
      .from('match_statistics')
      .select('id,player_id')
      .eq('tournament_id', tournamentId)
      .eq('match_id', String(matchEntryId));

    const existingByPlayer = new Map((existingStats || []).map((item) => [String(item.player_id), item]));

    const ops = derived.map((item) => {
      const payload = {
        tournament_id: tournamentId,
        match_id: String(matchEntryId),
        player_id: item.player_id,
        goals: item.goals,
        assists: item.assists,
        yellow_cards: item.yellow_cards,
        red_cards: item.red_cards,
        minutes_played: item.minutes_played,
        updated_at: new Date().toISOString(),
      };

      const existing = existingByPlayer.get(String(item.player_id));
      if (existing?.id) {
        return supabase.from('match_statistics').update(payload).eq('id', existing.id);
      }
      return supabase.from('match_statistics').insert(payload);
    });

    await Promise.all(ops);
  }

  async function saveReport(status = 'draft') {
    if (!auth?.id) return;
    setSaving(true);
    try {
      if (isVenueTournamentSource) {
        const homeScore = Number(form.homeScore || 0);
        const awayScore = Number(form.awayScore || 0);
        const winnerTeamId = homeScore > awayScore
          ? schedule?.home_team_id || null
          : awayScore > homeScore
            ? schedule?.away_team_id || null
            : null;

        const venuePayload = {
          venue_tournament_id: venueTournamentId,
          venue_match_id: venueMatchId,
          submitted_by: auth.id,
          submitter_name: auth.name,
          final_score_home: homeScore,
          final_score_away: awayScore,
          home_team: schedule?.home || null,
          away_team: schedule?.away || null,
          report_text: form.reportText,
          incidents: form.incidents,
          attendance: form.attendance ? Number(form.attendance) : null,
          venue: form.venue || null,
          status,
          submitted_at: status === 'submitted' ? new Date().toISOString() : existingReport?.submitted_at || null,
          updated_at: new Date().toISOString(),
        };

        if (existingReport?.id) {
          await supabase.from('venue_match_reports').update(venuePayload).eq('id', existingReport.id);
        } else {
          const { data } = await supabase.from('venue_match_reports').insert(venuePayload).select('*').single();
          setExistingReport(data || null);
        }

        if (status === 'submitted') {
          await supabase
            .from('venue_tournament_matches')
            .update({
              home_score: homeScore,
              away_score: awayScore,
              winner_team_id: winnerTeamId,
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', venueMatchId);

          if (matchContext?.assignmentId && auth?.id && capabilities.finalizeAssignment) {
            try {
              await supabase.from('match_assignments').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', matchContext.assignmentId).eq('user_id', auth.id);
            } catch (assignmentError) {
              console.warn('Assignment status update skipped:', assignmentError?.message);
            }
          }
        }

        setMessage({ type: 'success', text: status === 'submitted' ? 'Laporan venue match dikirim. Assignment ditandai selesai.' : 'Draft laporan venue match disimpan.' });
        await load();
        return;
      }

      const payload = {
        tournament_id: tournamentId,
        match_entry_id: String(matchEntryId),
        submitted_by: auth.id,
        submitter_name: auth.name,
        final_score_home: Number(form.homeScore || 0),
        final_score_away: Number(form.awayScore || 0),
        home_team: schedule?.home || null,
        away_team: schedule?.away || null,
        report_text: form.reportText,
        incidents: form.incidents,
        attendance: form.attendance ? Number(form.attendance) : null,
        venue: form.venue || null,
        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : existingReport?.submitted_at || null,
        updated_at: new Date().toISOString(),
      };

      if (existingReport?.id) {
        await supabase.from('match_reports').update(payload).eq('id', existingReport.id);
      } else {
        const { data } = await supabase.from('match_reports').insert(payload).select('*').single();
        setExistingReport(data || null);
      }

      if (status === 'submitted') {
        await supabase.from('tournament_schedule').update({ status: 'done', score: `${Number(form.homeScore || 0)}-${Number(form.awayScore || 0)}` }).eq('tournament_id', tournamentId).eq('entry_id', matchEntryId);
        await syncMatchStatistics();

        if (matchContext?.assignmentId && auth?.id && capabilities.finalizeAssignment) {
          try {
            await supabase.from('match_assignments').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', matchContext.assignmentId).eq('user_id', auth.id);
          } catch (assignmentError) {
            console.warn('Assignment status update skipped:', assignmentError?.message);
          }
        }
      }

      setMessage({ type: 'success', text: status === 'submitted' ? 'Laporan pertandingan dikirim. Assignment ditandai selesai.' : 'Draft laporan disimpan.' });
      await load();
    } catch (err) {
      console.error('Save report error:', err);
      setMessage({ type: 'error', text: 'Gagal menyimpan laporan pertandingan.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      variant="official"
      kicker="/ OFFICIAL — LAPORAN"
      title={<>LAPORAN<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>pertandingan.</span></>}
      subtitle="Finalize skor akhir, narasi laga, dan kirim laporan resmi pertandingan."
      onBack={onBack}
      breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal', onClick: () => onNav('official-schedule') }, { label: 'Match Report' }]}
    >
      {!loading && !hasMatchContext ? (
        <EmptyState
          icon={FileText}
          title="Pilih pertandingan dulu"
          description="Laporan resmi hanya bisa dibuka dari jadwal official yang sudah memiliki turnamen dan match entry."
          action={<ActionButton onClick={() => onNav('official-schedule')}>Buka Jadwal Official</ActionButton>}
        />
      ) : null}

      {!loading && hasMatchContext ? (
        <>
      {isVenueTournamentSource && (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Laporan source venue tournament sudah aktif. Timeline event official lama belum tersambung, jadi laporan memakai skor akhir, attendance, venue, dan narasi resmi match venue.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Goals" value={loading ? '—' : goalEvents.length} icon={CheckCircle} accent="emerald" />
        <StatCard label="Events" value={loading ? '—' : events.length} icon={Activity} accent="blue" />
        <StatCard label="Status" value={loading ? '—' : (existingReport?.status || 'draft')} icon={FileText} accent="violet" />
        <StatCard label="Attendance" value={loading ? '—' : (form.attendance || '—')} icon={Calendar} accent="amber" />
      </div>

      {message && (
        <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_0.95fr] gap-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-violet-600" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Form Laporan</div>
              <div className="font-display text-2xl text-neutral-900">Match summary</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {schedule?.status && <StatusBadge status={schedule.status} />}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={schedule?.home || 'Home Score'}>
                <input className={inputCls} type="number" min="0" value={form.homeScore} onChange={(e) => setForm((prev) => ({ ...prev, homeScore: e.target.value }))} />
              </Field>
              <Field label={schedule?.away || 'Away Score'}>
                <input className={inputCls} type="number" min="0" value={form.awayScore} onChange={(e) => setForm((prev) => ({ ...prev, awayScore: e.target.value }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Attendance">
                <input className={inputCls} type="number" min="0" value={form.attendance} onChange={(e) => setForm((prev) => ({ ...prev, attendance: e.target.value }))} placeholder="0" />
              </Field>
              <Field label="Venue">
                <input className={inputCls} value={form.venue} onChange={(e) => setForm((prev) => ({ ...prev, venue: e.target.value }))} placeholder="Venue pertandingan" />
              </Field>
            </div>

            <Field label="Laporan Pertandingan">
              <textarea className={textareaCls} rows={7} value={form.reportText} onChange={(e) => setForm((prev) => ({ ...prev, reportText: e.target.value }))} placeholder="Tuliskan ringkasan pertandingan, alur laga, keputusan penting, dan catatan official..." />
            </Field>

            <Field label="Incident Log">
              <textarea className={textareaCls} rows={4} value={form.incidents} onChange={(e) => setForm((prev) => ({ ...prev, incidents: e.target.value }))} placeholder="Pelanggaran, kartu, protes, atau kejadian penting..." />
            </Field>

            <div className="flex flex-wrap gap-3 justify-end pt-1">
              <ActionButton variant="outline" onClick={() => saveReport('draft')} loading={saving}>
                <Save size={14} /> Simpan Draft
              </ActionButton>
              <ActionButton onClick={() => saveReport('submitted')} loading={saving}>
                <Send size={14} /> Submit Laporan
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-blue-600" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Referensi</div>
              <div className="font-display text-2xl text-neutral-900">Event timeline</div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, index) => <div key={index} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : events.length === 0 ? (
            <EmptyState icon={Activity} title={isVenueTournamentSource ? 'Timeline venue match belum tersambung' : 'Belum ada event'} description={isVenueTournamentSource ? 'Source venue tournament memakai laporan resmi + skor akhir. Event timeline official lama belum tersedia untuk source ini.' : 'Event pertandingan akan tampil di sini sebagai referensi.'} />
          ) : (
            <div className="space-y-2 max-h-[640px] overflow-auto pr-1">
              {events.map((event) => (
                <div key={event.id} className="p-3 rounded-2xl border border-neutral-200 bg-neutral-50">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-neutral-700">{event.event_type.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-neutral-900">{event.player_name}</span>
                    {event.minute !== null && event.minute !== undefined && <span className="text-xs text-neutral-500">{event.minute}'</span>}
                  </div>
                  <div className="text-xs text-neutral-500">{event.team}{event.description ? ` · ${event.description}` : ''}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] font-black text-neutral-400 mb-2">Quick Action</div>
            <div className="flex flex-wrap gap-2">
              <ActionButton variant="outline" onClick={() => onNav('match-center', matchContext)}>
                Kembali ke Match Center <ArrowRight size={14} />
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => onNav('match-statistics', matchContext)}>
                Statistik Pertandingan <ArrowRight size={14} />
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