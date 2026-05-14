import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle, ClipboardList, Plus, Save, ShieldCheck, Sparkles, Trash2, Trophy, Users } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, StatCard, StatusBadge, inputCls, selectCls, textareaCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';
import { buildSubstitutionState, getTournamentSubstitutionRules, validateSubstitutionEvent } from '../../../services/substitutionRuleEngine.js';
import { getOfficialMatchCapabilities } from '../../../utils/permissions.js';

const EVENT_OPTIONS = [
  { value: 'goal', label: 'Goal' },
  { value: 'assist', label: 'Assist' },
  { value: 'yellow_card', label: 'Yellow Card' },
  { value: 'red_card', label: 'Red Card' },
  { value: 'sub_in', label: 'Substitution In' },
  { value: 'sub_out', label: 'Substitution Out' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'lineup_approval', label: 'Approve Lineup' },
];

function getPlayerLabel(player) {
  return player?.player_name || player?.jersey_name || player?.name || `Player #${player?.id}`;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function isMissingSubstitutionRulesColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('substitution_rules')
    && (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'));
}

export default function MatchCenterPage({ auth, onBack, onNav, matchContext }) {
  const matchEntryId = matchContext?.matchEntryId || matchContext?.match_entry_id || matchContext?.match_id || matchContext?.entryId || null;
  const tournamentId = matchContext?.tournamentId || matchContext?.tournament_id || null;
  const hasMatchContext = Boolean(tournamentId && matchEntryId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [lineupDraft, setLineupDraft] = useState({});
  const [eventForm, setEventForm] = useState({ eventType: 'goal', playerId: '', minute: '', team: '', description: '' });
  const [message, setMessage] = useState(null);
  const capabilities = useMemo(() => getOfficialMatchCapabilities({
    userRoles: auth?.roles || [],
    assignmentRole: matchContext?.assignmentRole,
  }), [auth?.roles, matchContext?.assignmentRole]);

  const load = useCallback(async () => {
    if (!hasMatchContext) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [{ data: tourData }, { data: scheduleData }, { data: eventData }, { data: playerData }, { data: lineupData }] = await Promise.all([
        (async () => {
          let result = await supabase
            .from('tournaments')
            .select('id,name,sport,format,host,color,status,participants,substitution_rules')
            .eq('id', tournamentId)
            .maybeSingle();

          if (result.error && isMissingSubstitutionRulesColumnError(result.error)) {
            result = await supabase
              .from('tournaments')
              .select('id,name,sport,format,host,color,status,participants')
              .eq('id', tournamentId)
              .maybeSingle();
          }

          if (result.error) throw result.error;
          return result;
        })(),
        supabase.from('tournament_schedule').select('tournament_id,entry_id,date,home,away,score,status').eq('tournament_id', tournamentId).eq('entry_id', matchEntryId).maybeSingle(),
        supabase.from('match_events').select('id,tournament_id,match_entry_id,event_type,player_id,player_name,player_number,team,minute,description,recorded_by,created_at').eq('tournament_id', tournamentId).eq('match_entry_id', String(matchEntryId)).order('created_at', { ascending: true }),
        supabase.from('tournament_players').select('id,tournament_id,user_id,player_number,position,player_name,jersey_name,status,registered_at').eq('tournament_id', tournamentId),
        supabase.from('player_lineups').select('id,tournament_id,match_id,player_id,starting_eleven,substituted_at,lineup_created_at').eq('tournament_id', tournamentId).eq('match_id', String(matchEntryId)),
      ]);

      setTournament(tourData || null);
      setSchedule(scheduleData || null);
      setEvents(eventData || []);
      setPlayers(playerData || []);
      setLineups(lineupData || []);

      const lineupMap = {};
      (lineupData || []).forEach((entry) => {
        lineupMap[String(entry.player_id)] = Boolean(entry.starting_eleven);
      });
      (playerData || []).forEach((player) => {
        if (lineupMap[String(player.id)] === undefined) lineupMap[String(player.id)] = false;
      });
      setLineupDraft(lineupMap);

      const initialGoals = (eventData || []).filter((event) => event.event_type === 'goal').reduce((acc, event) => {
        acc[event.team] = (acc[event.team] || 0) + 1;
        return acc;
      }, {});

      setEventForm((prev) => ({
        ...prev,
        team: scheduleData?.home || prev.team || '',
      }));

      setMessage(null);
      setSchedule((prevSchedule) => {
        if (prevSchedule || !scheduleData) return scheduleData || prevSchedule;
        return scheduleData;
      });

      setTournament((prevTournament) => prevTournament || tourData || null);
      setEventForm((prev) => ({
        ...prev,
        minute: prev.minute,
      }));

      // Prime score summary from existing score or event goals.
      setSchedule((current) => ({
        ...current,
        venue: current?.venue || '',
      }));

      if (scheduleData?.score) {
        const [homeScore, awayScore] = String(scheduleData.score).split('-');
        setMessage({ type: 'success', text: `Skor tersimpan: ${homeScore} - ${awayScore}` });
      } else if (Object.keys(initialGoals).length > 0) {
        setMessage({ type: 'success', text: 'Event gol sudah terbaca dari timeline pertandingan.' });
      }
    } catch (err) {
      console.error('MatchCenter load error:', err);
      setMessage({ type: 'error', text: 'Gagal memuat data match center. Periksa tabel Supabase.' });
    } finally {
      setLoading(false);
    }
  }, [hasMatchContext, matchEntryId, tournamentId]);

  useEffect(() => { load(); }, [load]);

  const scoreSummary = useMemo(() => {
    const home = schedule?.home || 'Home';
    const away = schedule?.away || 'Away';
    const summary = { [home]: 0, [away]: 0 };
    events.forEach((event) => {
      if (event.event_type === 'goal' && event.team) {
        summary[event.team] = (summary[event.team] || 0) + 1;
      }
    });
    return summary;
  }, [events, schedule]);

  const lineupCount = Object.values(lineupDraft).filter(Boolean).length;
  const substitutionRules = useMemo(() => getTournamentSubstitutionRules(tournament), [tournament]);
  const substitutionState = useMemo(
    () => buildSubstitutionState({ players, lineups, events }),
    [players, lineups, events]
  );
  const eventCounts = {
    goal: events.filter((event) => event.event_type === 'goal').length,
    cards: events.filter((event) => ['yellow_card', 'red_card'].includes(event.event_type)).length,
    subs: events.filter((event) => ['sub_in', 'sub_out'].includes(event.event_type)).length,
  };

  const substitutionRecommendation = useMemo(() => {
    if (!players.length) return null;

    const maxMinute = events.reduce((acc, item) => {
      const minute = Number(item?.minute);
      if (!Number.isFinite(minute)) return acc;
      return Math.max(acc, minute);
    }, 0);
    const currentMinute = maxMinute > 0 ? maxMinute : 60;

    const sortedEvents = [...events].sort((a, b) => {
      const minuteA = Number(a?.minute);
      const minuteB = Number(b?.minute);
      if (Number.isFinite(minuteA) && Number.isFinite(minuteB) && minuteA !== minuteB) return minuteA - minuteB;
      return new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime();
    });

    const playerByName = {};
    const onFieldById = {};
    const entryMinuteById = {};
    const eventSummaryById = {};

    players.forEach((player) => {
      const nameKey = normalizeName(getPlayerLabel(player));
      if (nameKey) playerByName[nameKey] = player;
      onFieldById[player.id] = false;
      entryMinuteById[player.id] = null;
      eventSummaryById[player.id] = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
    });

    lineups.forEach((lineup) => {
      if (!lineup?.starting_eleven) return;
      onFieldById[lineup.player_id] = true;
      entryMinuteById[lineup.player_id] = 0;
    });

    sortedEvents.forEach((item) => {
      const mappedPlayer = playerByName[normalizeName(item?.player_name)];
      if (!mappedPlayer) return;

      const minute = Number(item?.minute);
      const summary = eventSummaryById[mappedPlayer.id] || { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
      if (item?.event_type === 'goal') summary.goals += 1;
      if (item?.event_type === 'assist') summary.assists += 1;
      if (item?.event_type === 'yellow_card') summary.yellowCards += 1;
      if (item?.event_type === 'red_card') summary.redCards += 1;
      eventSummaryById[mappedPlayer.id] = summary;

      if (item?.event_type === 'sub_in') {
        onFieldById[mappedPlayer.id] = true;
        if (Number.isFinite(minute)) entryMinuteById[mappedPlayer.id] = minute;
      }

      if (item?.event_type === 'sub_out') {
        onFieldById[mappedPlayer.id] = false;
      }

      if (item?.event_type === 'red_card') {
        onFieldById[mappedPlayer.id] = false;
      }
    });

    const teamName = eventForm.team || schedule?.home || schedule?.away || 'home';

    const subOutCandidates = players
      .filter((player) => onFieldById[player.id])
      .map((player) => {
        const entryMinute = Number.isFinite(entryMinuteById[player.id]) ? entryMinuteById[player.id] : 0;
        const minutesPlayed = Math.max(0, currentMinute - entryMinute);
        const summary = eventSummaryById[player.id] || { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
        const riskScore = (summary.yellowCards * 28) + (summary.redCards * 60) + Math.min(45, minutesPlayed * 0.8);
        return { player, minutesPlayed, summary, score: riskScore };
      })
      .sort((a, b) => b.score - a.score);

    const subInCandidates = players
      .filter((player) => !onFieldById[player.id])
      .map((player) => {
        const summary = eventSummaryById[player.id] || { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };
        const allowCheck = validateSubstitutionEvent({
          rules: substitutionRules,
          state: substitutionState,
          eventType: 'sub_in',
          selectedPlayer: player,
          team: teamName,
          minute: currentMinute,
        });

        if (!allowCheck.allow) return null;

        const contribution = (summary.goals * 25) + (summary.assists * 14);
        const discipline = Math.max(0, 20 - (summary.yellowCards * 8) - (summary.redCards * 15));
        const score = contribution + discipline;
        return { player, summary, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return {
      minute: currentMinute,
      out: subOutCandidates[0] || null,
      in: subInCandidates[0] || null,
    };
  }, [eventForm.team, events, lineups, players, schedule?.away, schedule?.home, substitutionRules, substitutionState]);

  async function saveLineup() {
    if (!auth?.id || !capabilities.manageLineup) return;
    setSaving(true);
    try {
      const ops = players.map(async (player) => {
        const existing = lineups.find((entry) => String(entry.player_id) === String(player.id));
        const payload = {
          tournament_id: tournamentId,
          match_id: String(matchEntryId),
          player_id: player.id,
          starting_eleven: Boolean(lineupDraft[String(player.id)]),
          substituted_at: null,
          lineup_created_at: new Date().toISOString(),
        };

        if (existing) {
          return supabase.from('player_lineups').update(payload).eq('id', existing.id);
        }
        return supabase.from('player_lineups').insert(payload);
      });

      await Promise.all(ops);
      setMessage({ type: 'success', text: 'Lineup berhasil disimpan.' });
      await load();
    } catch (err) {
      console.error('Save lineup error:', err);
      setMessage({ type: 'error', text: 'Gagal menyimpan lineup.' });
    } finally {
      setSaving(false);
    }
  }

  async function addEvent() {
    if (!auth?.id || !eventForm.playerId || !capabilities.recordEvents) return;
    setSaving(true);
    try {
      const selectedPlayer = players.find((player) => String(player.id) === String(eventForm.playerId));
      const minuteValue = eventForm.minute ? Number(eventForm.minute) : null;
      const validation = validateSubstitutionEvent({
        rules: substitutionRules,
        state: substitutionState,
        eventType: eventForm.eventType,
        selectedPlayer,
        team: eventForm.team || schedule?.home || 'home',
        minute: minuteValue,
      });

      if (!validation.allow) {
        try {
          await supabase.from('match_rule_violations').insert({
            tournament_id: tournamentId,
            match_entry_id: String(matchEntryId),
            violation_code: validation.code || 'substitution_rule_violation',
            severity: 'error',
            event_type: eventForm.eventType,
            player_name: getPlayerLabel(selectedPlayer),
            team: eventForm.team || schedule?.home || 'home',
            minute: minuteValue,
            details: {
              event_type: eventForm.eventType,
              player_id: selectedPlayer?.id || null,
              player_user_id: selectedPlayer?.user_id || null,
            },
            blocked: true,
            recorded_by: auth.id,
          });
        } catch (violationError) {
          console.warn('Rule violation log skipped:', violationError?.message || violationError);
        }

        setMessage({ type: 'error', text: validation.message || 'Event substitusi melanggar aturan turnamen.' });
        setSaving(false);
        return;
      }

      await supabase.from('match_events').insert({
        tournament_id: tournamentId,
        match_entry_id: String(matchEntryId),
        event_type: eventForm.eventType,
        player_id: selectedPlayer?.user_id || null,
        player_name: getPlayerLabel(selectedPlayer),
        player_number: selectedPlayer?.player_number || null,
        team: eventForm.team || schedule?.home || 'home',
        minute: minuteValue,
        description: eventForm.description || null,
        recorded_by: auth.id,
      });
      setEventForm({ eventType: 'goal', playerId: '', minute: '', team: schedule?.home || '', description: '' });
      setMessage({ type: 'success', text: 'Event pertandingan tersimpan.' });
      await load();
    } catch (err) {
      console.error('Add event error:', err);
      setMessage({ type: 'error', text: 'Gagal menyimpan event.' });
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(eventId) {
    if (!capabilities.recordEvents) return;
    try {
      await supabase.from('match_events').delete().eq('id', eventId);
      await load();
    } catch (err) {
      console.error('Delete event error:', err);
    }
  }

  const canOpenReport = Boolean(tournamentId && matchEntryId);

  if (!capabilities.openMatchCenter) {
    return (
      <AdminLayout
        variant="official"
        kicker="/ OFFICIAL — MATCH CENTER"
        title={<>MATCH<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>center.</span></>}
        subtitle="Input lineup, event pertandingan, attendance, dan lanjutkan ke laporan resmi."
        onBack={onBack}
        breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal', onClick: () => onNav('official-schedule') }, { label: 'Match Center' }]}
      >
        <EmptyState
          icon={ShieldCheck}
          title="Akses Match Center ditolak"
          description="Role official aktif Anda tidak memiliki izin membuka Match Center untuk assignment ini."
          action={<ActionButton variant="outline" onClick={() => onNav('official-schedule')}>Kembali ke Jadwal</ActionButton>}
        />
      </AdminLayout>
    );
  }

  if (!hasMatchContext) {
    return (
      <AdminLayout
        variant="official"
        kicker="/ OFFICIAL — MATCH CENTER"
        title={<>MATCH<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>center.</span></>}
        subtitle="Input lineup, event pertandingan, attendance, dan lanjutkan ke laporan resmi."
        onBack={onBack}
        breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal', onClick: () => onNav('official-schedule') }, { label: 'Match Center' }]}
      >
        <EmptyState
          icon={Activity}
          title="Pilih pertandingan dulu"
          description="Match Center butuh konteks turnamen dan entry pertandingan dari jadwal official."
          action={<ActionButton onClick={() => onNav('official-schedule')}>Buka Jadwal Official</ActionButton>}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      variant="official"
      kicker="/ OFFICIAL — MATCH CENTER"
      title={<>MATCH<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>center.</span></>}
      subtitle="Input lineup, event pertandingan, attendance, dan lanjutkan ke laporan resmi."
      onBack={onBack}
      breadcrumbs={[{ label: 'Official Center', onClick: () => onNav('official-center') }, { label: 'Jadwal', onClick: () => onNav('official-schedule') }, { label: 'Match Center' }]}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Goal" value={loading ? '—' : eventCounts.goal} icon={Trophy} accent="emerald" />
        <StatCard label="Cards" value={loading ? '—' : eventCounts.cards} icon={ShieldCheck} accent="amber" />
        <StatCard label="Substitusi" value={loading ? '—' : eventCounts.subs} icon={Activity} accent="blue" />
        <StatCard label="Starting XI" value={loading ? '—' : lineupCount} icon={Users} accent="violet" />
      </div>

      {message && (
        <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {message.text}
        </div>
      )}

      {substitutionRecommendation && (substitutionRecommendation.out || substitutionRecommendation.in) && (
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] font-black text-violet-600 mb-1">Hybrid Recommendation</div>
              <div className="font-display text-2xl text-neutral-900">Saran substitusi menit {substitutionRecommendation.minute}'</div>
              <div className="text-sm text-neutral-600 mt-1">Assistive suggestion berbasis event live + rule engine (hard-block tetap aktif).</div>
            </div>
            <Sparkles size={18} className="text-violet-600" />
          </div>

          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Sub Out</div>
              {substitutionRecommendation.out ? (
                <>
                  <div className="font-semibold text-neutral-900">{getPlayerLabel(substitutionRecommendation.out.player)}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Main {Math.round(substitutionRecommendation.out.minutesPlayed)} menit · YC {substitutionRecommendation.out.summary.yellowCards}
                  </div>
                  <button
                    onClick={() => setEventForm((prev) => ({
                      ...prev,
                      eventType: 'sub_out',
                      playerId: String(substitutionRecommendation.out.player.id),
                      minute: String(substitutionRecommendation.minute),
                      team: prev.team || schedule?.home || '',
                    }))}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white"
                  >
                    Gunakan untuk Form
                  </button>
                </>
              ) : (
                <div className="text-sm text-neutral-500">Tidak ada kandidat sub-out yang layak saat ini.</div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Sub In</div>
              {substitutionRecommendation.in ? (
                <>
                  <div className="font-semibold text-neutral-900">{getPlayerLabel(substitutionRecommendation.in.player)}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    G/A: {substitutionRecommendation.in.summary.goals}/{substitutionRecommendation.in.summary.assists} · YC {substitutionRecommendation.in.summary.yellowCards}
                  </div>
                  <button
                    onClick={() => setEventForm((prev) => ({
                      ...prev,
                      eventType: 'sub_in',
                      playerId: String(substitutionRecommendation.in.player.id),
                      minute: String(substitutionRecommendation.minute),
                      team: prev.team || schedule?.home || '',
                    }))}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white"
                  >
                    Gunakan untuk Form
                  </button>
                </>
              ) : (
                <div className="text-sm text-neutral-500">Tidak ada kandidat sub-in valid sesuai rule saat ini.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-400 mb-1">Pertandingan</div>
            <div className="text-sm text-neutral-500 mt-2">
              {tournament?.name || matchContext?.tournamentName || 'Turnamen'} · Match {matchEntryId}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {schedule?.status && <StatusBadge status={schedule.status} />}
            {matchContext?.assignmentRole && <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-[0.14em] bg-neutral-100 text-neutral-700">{matchContext.assignmentRole}</span>}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Skor Live</div>
            <div className="font-display text-3xl">{scoreSummary[schedule?.home || 'Home'] || 0} - {scoreSummary[schedule?.away || 'Away'] || 0}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Venue</div>
            <div className="font-semibold text-neutral-900">{schedule?.venue || 'Belum diisi'}</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-400 mb-1">Tanggal</div>
            <div className="font-semibold text-neutral-900">{schedule?.date || 'Belum tersedia'}</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={16} className="text-blue-600" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Lineup</div>
              <div className="font-display text-2xl text-neutral-900">Approve starting eleven</div>
            </div>
            <div className="ml-auto">
              <ActionButton onClick={saveLineup} loading={saving} disabled={!capabilities.manageLineup}>
                <Save size={14} /> Simpan Lineup
              </ActionButton>
            </div>
          </div>

          {players.length === 0 ? (
            <EmptyState icon={Users} title="Belum ada player tournament" description="Tambahkan player melalui turnamen atau roster." />
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
              {players.map((player) => {
                const label = getPlayerLabel(player);
                const isStarting = Boolean(lineupDraft[String(player.id)]);
                return (
                  <label key={player.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition cursor-pointer ${isStarting ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}`}>
                    <input
                      type="checkbox"
                      checked={isStarting}
                      onChange={(e) => setLineupDraft((prev) => ({ ...prev, [String(player.id)]: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-neutral-900 truncate">{label}</div>
                        {player.player_number && <span className="text-[10px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-neutral-600">#{player.player_number}</span>}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">{player.position || 'Player'} · {player.status || 'active'}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={16} className="text-emerald-600" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Live Input</div>
              <div className="font-display text-2xl text-neutral-900">Tambah event pertandingan</div>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Jenis Event">
              <select className={selectCls} value={eventForm.eventType} onChange={(e) => setEventForm((prev) => ({ ...prev, eventType: e.target.value }))}>
                {EVENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>

            <Field label="Player">
              <select className={selectCls} value={eventForm.playerId} onChange={(e) => setEventForm((prev) => ({ ...prev, playerId: e.target.value }))}>
                <option value="">Pilih player</option>
                {players.map((player) => <option key={player.id} value={player.id}>{getPlayerLabel(player)}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Menit">
                <input className={inputCls} type="number" value={eventForm.minute} onChange={(e) => setEventForm((prev) => ({ ...prev, minute: e.target.value }))} placeholder="45" />
              </Field>
              <Field label="Tim">
                <input className={inputCls} value={eventForm.team} onChange={(e) => setEventForm((prev) => ({ ...prev, team: e.target.value }))} placeholder={schedule?.home || 'Home team'} />
              </Field>
            </div>

            <Field label="Catatan / Deskripsi">
              <textarea className={textareaCls} rows={3} value={eventForm.description} onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Tambahkan detail event..." />
            </Field>

            <div className="flex flex-wrap gap-3 justify-end pt-1">
              <ActionButton onClick={addEvent} loading={saving} disabled={!eventForm.playerId || !capabilities.recordEvents}>
                <Save size={14} /> Simpan Event
              </ActionButton>
              <ActionButton variant="outline" onClick={() => onNav('match-report', matchContext)} disabled={!canOpenReport || !capabilities.openMatchReport}>
                Buka Laporan <ArrowRight size={14} />
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => onNav('match-statistics', matchContext)} disabled={!canOpenReport || !capabilities.openMatchStatistics}>
                Statistik <ArrowRight size={14} />
              </ActionButton>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-violet-600" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400">Feed</div>
            <div className="font-display text-2xl text-neutral-900">Live events</div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, index) => <div key={index} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <EmptyState icon={Activity} title="Belum ada event" description="Input event pertandingan akan muncul di sini." />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-4 rounded-2xl border border-neutral-200 bg-neutral-50">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 text-[11px] font-black uppercase">
                  {event.event_type.replace(/_/g, ' ').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="font-semibold text-neutral-900">{event.player_name}</div>
                    <StatusBadge status={event.event_type} />
                    {event.minute !== null && event.minute !== undefined && <span className="text-xs text-neutral-500">{event.minute}'</span>}
                  </div>
                  <div className="text-sm text-neutral-600">{event.team}{event.description ? ` · ${event.description}` : ''}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{new Date(event.created_at).toLocaleString('id-ID')}</div>
                </div>
                <button onClick={() => removeEvent(event.id)} disabled={!capabilities.recordEvents} className="w-8 h-8 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 justify-end">
        <ActionButton variant="outline" onClick={() => onNav('match-report', matchContext)} disabled={!capabilities.openMatchReport}>
          Buka Laporan <ArrowRight size={14} />
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => onNav('match-statistics', matchContext)} disabled={!capabilities.openMatchStatistics}>
          Buka Statistik <ArrowRight size={14} />
        </ActionButton>
      </div>
    </AdminLayout>
  );
}