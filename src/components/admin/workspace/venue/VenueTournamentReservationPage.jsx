import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Plus, Users, Calendar, ChevronRight, Edit3, CheckCircle, Shuffle } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FORMATS = ['single_elimination', 'round_robin'];
const FORMAT_LABELS = { single_elimination: 'Single Elimination', round_robin: 'Round Robin' };
const STATUS_LABELS = {
  draft: 'Draft',
  registration_open: 'Buka Pendaftaran',
  registration_closed: 'Pendaftaran Ditutup',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

function fmt(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getScheduleEndTime(startTime, durationMinutes = 120) {
  if (!startTime) return '';
  const [hour, minute] = String(startTime).split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const total = (hour * 60) + minute + Number(durationMinutes || 120);
  const endHour = Math.floor((total % (24 * 60)) / 60);
  const endMinute = total % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function matchReservationMarker(matchId) {
  return `[TOURNAMENT_MATCH:${matchId}]`;
}

function getSyncBadgeConfig(match, reservationMap) {
  const hasSchedule = Boolean(match.scheduled_date && match.scheduled_time && match.court_id);
  if (!hasSchedule) {
    return { label: 'Belum dijadwalkan', className: 'bg-neutral-100 text-neutral-600' };
  }

  if (!match.reservation_booking_id) {
    return { label: 'Sync pending', className: 'bg-amber-100 text-amber-700' };
  }

  const reservation = reservationMap[match.reservation_booking_id];
  if (!reservation) {
    return { label: 'Sync failed', className: 'bg-red-100 text-red-700' };
  }

  if (reservation.status === 'completed') {
    return { label: 'Court released', className: 'bg-neutral-200 text-neutral-700' };
  }

  if (reservation.status === 'cancelled') {
    return { label: 'Sync failed', className: 'bg-red-100 text-red-700' };
  }

  return { label: 'Court blocked', className: 'bg-emerald-100 text-emerald-700' };
}

// ── Bracket generation ────────────────────────────────────────────────────────

function generateSingleEliminationBracket(teams) {
  const n = teams.length;
  if (n < 2) return [];
  const size = Math.pow(2, Math.ceil(Math.log2(n)));
  const padded = [...teams];
  while (padded.length < size) padded.push(null);
  const seeded = [];
  for (let i = 0; i < size / 2; i++) seeded.push({ home: padded[i], away: padded[size - 1 - i] });
  const totalRounds = Math.log2(size);
  const roundNames = ['Final', 'Semi Final', 'Quarter Final', 'Round of 16', 'Round of 32'];
  const rounds = [];
  for (let r = 0; r < totalRounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    const nameIdx = totalRounds - r - 1;
    const roundName = roundNames[nameIdx] || `Round ${r + 1}`;
    const matches = [];
    for (let m = 0; m < matchCount; m++) {
      matches.push({ match_number: m + 1, home: r === 0 ? seeded[m]?.home : null, away: r === 0 ? seeded[m]?.away : null });
    }
    rounds.push({ round_number: r + 1, round_name: roundName, matches });
  }
  return rounds;
}

function generateRoundRobinBracket(teams) {
  const n = teams.length;
  if (n < 2) return [];
  const list = n % 2 === 0 ? [...teams] : [...teams, null];
  const size = list.length;
  const rounds = [];
  for (let r = 0; r < size - 1; r++) {
    const matches = [];
    for (let m = 0; m < size / 2; m++) {
      const home = list[m];
      const away = list[size - 1 - m];
      if (home && away) matches.push({ match_number: m + 1, home, away });
    }
    rounds.push({ round_number: r + 1, round_name: `Pekan ${r + 1}`, matches });
    const fixed = list[0];
    list.splice(0, list.length, fixed, list[size - 1], ...list.slice(1, size - 1));
  }
  return rounds;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ type, message, onClose }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg flex items-center gap-3 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
      {message}
      <button onClick={onClose} className="ml-1 opacity-75 hover:opacity-100">✕</button>
    </div>
  );
}

// ── TournamentList ─────────────────────────────────────────────────────────────

function TournamentList({ venueId, onSelect, onCreate }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_tournaments')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('Error loading tournaments:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-neutral-900">Daftar Turnamen</h2>
        <ActionButton size="sm" onClick={onCreate}><Plus size={14} /> Buat Turnamen</ActionButton>
      </div>
      {tournaments.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Belum ada turnamen"
          description="Buat turnamen pertama untuk venue ini."
          action={<ActionButton onClick={onCreate}><Plus size={14} /> Buat Turnamen</ActionButton>}
        />
      ) : (
        tournaments.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-900 transition flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Trophy size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-semibold text-neutral-900 truncate">{t.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  t.status === 'registration_open' ? 'bg-emerald-100 text-emerald-700' :
                  t.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                  t.status === 'completed' ? 'bg-neutral-200 text-neutral-600' :
                  t.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{STATUS_LABELS[t.status] || t.status}</span>
              </div>
              <div className="text-sm text-neutral-500">
                {t.sport_type} · {FORMAT_LABELS[t.format] || t.format} · Maks {t.max_teams} tim
              </div>
              <div className="text-xs text-neutral-400">
                {fmtDate(t.tournament_start)} — {fmtDate(t.tournament_end)}
                {t.prize_pool > 0 && ` · Hadiah Rp ${fmt(t.prize_pool)}`}
              </div>
            </div>
            <ChevronRight size={16} className="text-neutral-400 shrink-0" />
          </button>
        ))
      )}
    </div>
  );
}

// ── CreateTournamentForm ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', sport_type: '', format: 'single_elimination', max_teams: 8,
  registration_fee: 0, prize_pool: 0, description: '', rules: '',
  registration_start: '', registration_end: '', tournament_start: '', tournament_end: '',
};

function CreateTournamentForm({ venueId, auth, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    if (!form.name.trim() || !form.sport_type.trim()) { setError('Nama turnamen dan olahraga wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const { data, error: err } = await supabase
        .from('venue_tournaments')
        .insert({
          venue_id: venueId,
          name: form.name.trim(), sport_type: form.sport_type.trim(), format: form.format,
          max_teams: Number(form.max_teams) || 8, registration_fee: Number(form.registration_fee) || 0,
          prize_pool: Number(form.prize_pool) || 0, description: form.description.trim() || null,
          rules: form.rules.trim() || null, registration_start: form.registration_start || null,
          registration_end: form.registration_end || null, tournament_start: form.tournament_start || null,
          tournament_end: form.tournament_end || null, status: 'draft', created_by: auth?.id || null,
        })
        .select().single();
      if (err) throw err;
      onCreated(data);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-neutral-900">Buat Turnamen Baru</h2>
        <ActionButton variant="outline" onClick={onCancel}>Batal</ActionButton>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nama Turnamen *"><input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="cth: Open Championship 2026" /></Field>
        <Field label="Cabang Olahraga *"><input className={inputCls} value={form.sport_type} onChange={e => set('sport_type', e.target.value)} placeholder="cth: Badminton, Futsal" /></Field>
        <Field label="Format">
          <select className={selectCls} value={form.format} onChange={e => set('format', e.target.value)}>
            {FORMATS.map(f => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
          </select>
        </Field>
        <Field label="Maks Tim">
          <select className={selectCls} value={form.max_teams} onChange={e => set('max_teams', e.target.value)}>
            {[4, 8, 16, 32, 64].map(n => <option key={n} value={n}>{n} Tim</option>)}
          </select>
        </Field>
        <Field label="Biaya Registrasi (Rp)"><input className={inputCls} type="number" min="0" value={form.registration_fee} onChange={e => set('registration_fee', e.target.value)} /></Field>
        <Field label="Total Hadiah (Rp)"><input className={inputCls} type="number" min="0" value={form.prize_pool} onChange={e => set('prize_pool', e.target.value)} /></Field>
        <Field label="Pendaftaran Mulai"><input className={inputCls} type="date" value={form.registration_start} onChange={e => set('registration_start', e.target.value)} /></Field>
        <Field label="Pendaftaran Selesai"><input className={inputCls} type="date" value={form.registration_end} onChange={e => set('registration_end', e.target.value)} /></Field>
        <Field label="Pertandingan Mulai"><input className={inputCls} type="date" value={form.tournament_start} onChange={e => set('tournament_start', e.target.value)} /></Field>
        <Field label="Pertandingan Selesai"><input className={inputCls} type="date" value={form.tournament_end} onChange={e => set('tournament_end', e.target.value)} /></Field>
      </div>
      <Field label="Deskripsi"><textarea className={textareaCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Deskripsi singkat turnamen" /></Field>
      <Field label="Peraturan"><textarea className={textareaCls} rows={3} value={form.rules} onChange={e => set('rules', e.target.value)} placeholder="Tuliskan peraturan turnamen" /></Field>
      <div className="flex gap-3 pt-2">
        <ActionButton variant="outline" onClick={onCancel}>Batal</ActionButton>
        <ActionButton onClick={handleSubmit} loading={saving}>Buat Turnamen</ActionButton>
      </div>
    </div>
  );
}

// ── TournamentDetail ──────────────────────────────────────────────────────────

function TournamentDetail({ tournament: initialTournament, venueId, auth, onBack }) {
  const [tournament, setTournament] = useState(initialTournament);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [reservationMap, setReservationMap] = useState({});
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('teams');
  const [toast, setToast] = useState(null);

  const [showAddTeam, setShowAddTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({ team_name: '', captain_name: '', captain_phone: '', captain_email: '' });
  const [teamSaving, setTeamSaving] = useState(false);

  const [scoringMatch, setScoringMatch] = useState(null);
  const [scoreForm, setScoreForm] = useState({ home_score: '', away_score: '' });
  const [scoreSaving, setScoreSaving] = useState(false);

  const [schedulingMatch, setSchedulingMatch] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ scheduled_date: '', scheduled_time: '', duration_minutes: 120, court_id: '' });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const showToast = (type, message) => { setToast({ type, message }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, matchesRes, courtsRes] = await Promise.all([
        supabase.from('venue_tournament_teams').select('*').eq('tournament_id', tournament.id).order('seed').order('registered_at'),
        supabase.from('venue_tournament_matches').select('*').eq('tournament_id', tournament.id).order('round_number').order('match_number'),
        supabase.from('venue_courts').select('id, name, branch_id').eq('venue_id', venueId).order('name'),
      ]);
      const nextMatches = matchesRes.data || [];
      const reservationIds = [...new Set(nextMatches.map(m => m.reservation_booking_id).filter(Boolean))];
      let nextReservationMap = {};

      if (reservationIds.length > 0) {
        const { data: reservationRows, error: reservationErr } = await supabase
          .from('venue_bookings')
          .select('id, status, booking_date, start_time, end_time, court_id')
          .in('id', reservationIds);
        if (reservationErr) throw reservationErr;
        nextReservationMap = (reservationRows || []).reduce((acc, row) => {
          acc[row.id] = row;
          return acc;
        }, {});
      }

      setTeams(teamsRes.data || []);
      setMatches(nextMatches);
      setReservationMap(nextReservationMap);
      setCourts(courtsRes.data || []);
    } catch (err) { console.error('Error loading detail:', err.message); }
    finally { setLoading(false); }
  }, [tournament.id, venueId]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(newStatus) {
    try {
      const { data, error } = await supabase.from('venue_tournaments').update({ status: newStatus }).eq('id', tournament.id).select().single();
      if (error) throw error;
      setTournament(data);
      showToast('success', `Status: ${STATUS_LABELS[newStatus]}`);
    } catch (err) { showToast('error', err.message); }
  }

  async function handleAddTeam() {
    if (!teamForm.team_name.trim()) return;
    setTeamSaving(true);
    try {
      const active = teams.filter(t => t.status !== 'withdrawn' && t.status !== 'disqualified');
      if (active.length >= tournament.max_teams) { showToast('error', `Maksimal ${tournament.max_teams} tim sudah tercapai`); return; }
      const { error } = await supabase.from('venue_tournament_teams').insert({
        tournament_id: tournament.id, team_name: teamForm.team_name.trim(),
        captain_name: teamForm.captain_name.trim() || null, captain_phone: teamForm.captain_phone.trim() || null,
        captain_email: teamForm.captain_email.trim() || null, status: 'confirmed',
        payment_status: tournament.registration_fee > 0 ? 'unpaid' : 'waived',
      });
      if (error) throw error;
      setTeamForm({ team_name: '', captain_name: '', captain_phone: '', captain_email: '' });
      setShowAddTeam(false);
      showToast('success', 'Tim berhasil ditambahkan');
      load();
    } catch (err) { showToast('error', err.message); }
    finally { setTeamSaving(false); }
  }

  async function updateTeamStatus(teamId, status) {
    try { await supabase.from('venue_tournament_teams').update({ status }).eq('id', teamId); load(); showToast('success', 'Status tim diperbarui'); }
    catch (err) { showToast('error', err.message); }
  }

  async function updateTeamPayment(teamId, payment_status) {
    try { await supabase.from('venue_tournament_teams').update({ payment_status }).eq('id', teamId); load(); showToast('success', 'Status pembayaran diperbarui'); }
    catch (err) { showToast('error', err.message); }
  }

  async function handleGenerateBracket() {
    const activeTeams = teams.filter(t => t.status === 'confirmed');
    if (activeTeams.length < 2) { showToast('error', 'Butuh minimal 2 tim terkonfirmasi'); return; }
    try {
      await supabase.from('venue_tournament_matches').delete().eq('tournament_id', tournament.id);
      const rounds = tournament.format === 'round_robin'
        ? generateRoundRobinBracket(activeTeams)
        : generateSingleEliminationBracket(activeTeams);
      const toInsert = [];
      for (const round of rounds) {
        for (const m of round.matches) {
          toInsert.push({
            tournament_id: tournament.id, round_number: round.round_number, round_name: round.round_name,
            match_number: m.match_number, home_team_id: m.home?.id || null, away_team_id: m.away?.id || null,
            status: m.home && m.away ? 'scheduled' : 'tbd',
          });
        }
      }
      if (toInsert.length > 0) { const { error } = await supabase.from('venue_tournament_matches').insert(toInsert); if (error) throw error; }
      await supabase.from('venue_tournaments').update({ bracket_generated: true, bracket_generated_at: new Date().toISOString() }).eq('id', tournament.id);
      showToast('success', `Bracket dibuat: ${rounds.length} ronde, ${toInsert.length} pertandingan`);
      load(); setTab('bracket');
    } catch (err) { showToast('error', 'Gagal generate bracket: ' + err.message); }
  }

  async function handleSaveScore() {
    if (!scoringMatch) return;
    const hs = parseInt(scoreForm.home_score);
    const as_ = parseInt(scoreForm.away_score);
    if (isNaN(hs) || isNaN(as_)) { showToast('error', 'Skor harus berupa angka'); return; }
    setScoreSaving(true);
    try {
      const winnerId = hs > as_ ? scoringMatch.home_team_id : as_ > hs ? scoringMatch.away_team_id : null;
      await supabase.from('venue_tournament_matches').update({ home_score: hs, away_score: as_, winner_team_id: winnerId, status: 'completed' }).eq('id', scoringMatch.id);

      // Release reserved court slot by marking linked reservation completed.
      if (scoringMatch.reservation_booking_id) {
        await supabase
          .from('venue_bookings')
          .update({ status: 'completed' })
          .eq('id', scoringMatch.reservation_booking_id);
      } else {
        const marker = matchReservationMarker(scoringMatch.id);
        await supabase
          .from('venue_bookings')
          .update({ status: 'completed' })
          .eq('venue_id', venueId)
          .eq('booking_type', 'tournament')
          .ilike('notes', `%${marker}%`);
      }

      if (tournament.format === 'single_elimination' && winnerId && scoringMatch.next_match_id) {
        const nextMatch = matches.find(m => m.id === scoringMatch.next_match_id);
        if (nextMatch) {
          const isHome = !nextMatch.home_team_id;
          await supabase.from('venue_tournament_matches').update(isHome ? { home_team_id: winnerId } : { away_team_id: winnerId }).eq('id', nextMatch.id);
        }
      }
      setScoringMatch(null);
      showToast('success', 'Skor berhasil disimpan');
      load();
    } catch (err) { showToast('error', err.message); }
    finally { setScoreSaving(false); }
  }

  async function handleSaveSchedule() {
    if (!schedulingMatch) return;

    if (!scheduleForm.scheduled_date || !scheduleForm.scheduled_time || !scheduleForm.court_id) {
      showToast('error', 'Tanggal, jam, dan lapangan wajib diisi');
      return;
    }

    const startTime = scheduleForm.scheduled_time;
    const endTime = getScheduleEndTime(startTime, scheduleForm.duration_minutes);
    if (!endTime || endTime <= startTime) {
      showToast('error', 'Durasi jadwal tidak valid');
      return;
    }

    setScheduleSaving(true);
    try {
      const marker = matchReservationMarker(schedulingMatch.id);
      const home = teamMap[schedulingMatch.home_team_id];
      const away = teamMap[schedulingMatch.away_team_id];
      const court = courts.find(c => c.id === scheduleForm.court_id);

      let existingReservation = null;
      if (schedulingMatch.reservation_booking_id) {
        const { data: linkedReservation, error: linkedReservationErr } = await supabase
          .from('venue_bookings')
          .select('id')
          .eq('id', schedulingMatch.reservation_booking_id)
          .maybeSingle();
        if (linkedReservationErr) throw linkedReservationErr;
        existingReservation = linkedReservation;
      }

      if (!existingReservation) {
        const { data: markerReservation, error: markerReservationErr } = await supabase
          .from('venue_bookings')
          .select('id')
          .eq('venue_id', venueId)
          .eq('booking_type', 'tournament')
          .ilike('notes', `%${marker}%`)
          .limit(1)
          .maybeSingle();
        if (markerReservationErr) throw markerReservationErr;
        existingReservation = markerReservation;
      }

      const { data: courtBookings, error: conflictErr } = await supabase
        .from('venue_bookings')
        .select('id, customer_name, start_time, end_time, status')
        .eq('venue_id', venueId)
        .eq('booking_date', scheduleForm.scheduled_date)
        .eq('court_id', scheduleForm.court_id)
        .in('status', ['pending', 'confirmed', 'checked-in']);

      if (conflictErr) throw conflictErr;

      const conflicting = (courtBookings || []).find(b => {
        if (existingReservation?.id && b.id === existingReservation.id) return false;
        return overlaps(startTime, endTime, b.start_time, b.end_time);
      });

      if (conflicting) {
        showToast('error', `Jadwal bentrok dengan booking ${conflicting.customer_name} (${String(conflicting.start_time).slice(0, 5)}-${String(conflicting.end_time).slice(0, 5)})`);
        setScheduleSaving(false);
        return;
      }

      const reservationPayload = {
        venue_id: venueId,
        branch_id: court?.branch_id || null,
        court_id: scheduleForm.court_id,
        booking_type: 'tournament',
        customer_name: `${home?.team_name || 'TBD'} vs ${away?.team_name || 'TBD'}`,
        customer_phone: null,
        booking_date: scheduleForm.scheduled_date,
        start_time: startTime,
        end_time: endTime,
        duration_hours: Number((Number(scheduleForm.duration_minutes || 120) / 60).toFixed(2)),
        total_price: 0,
        payment_method: 'pending',
        payment_status: 'unpaid',
        status: 'confirmed',
        notes: `${marker} Tournament: ${tournament.name} · ${schedulingMatch.round_name}`,
        created_by: auth?.id || null,
      };

      let linkedReservationId = existingReservation?.id || null;

      if (existingReservation?.id) {
        const { data: updatedReservation, error: updateReservationErr } = await supabase
          .from('venue_bookings')
          .update(reservationPayload)
          .eq('id', existingReservation.id)
          .select('id')
          .single();
        if (updateReservationErr) throw updateReservationErr;
        linkedReservationId = updatedReservation?.id || linkedReservationId;
      } else {
        const { data: insertedReservation, error: insertReservationErr } = await supabase
          .from('venue_bookings')
          .insert(reservationPayload)
          .select('id')
          .single();
        if (insertReservationErr) throw insertReservationErr;
        linkedReservationId = insertedReservation?.id || null;
      }

      await supabase.from('venue_tournament_matches').update({
        scheduled_date: scheduleForm.scheduled_date || null,
        scheduled_time: scheduleForm.scheduled_time || null,
        court_id: scheduleForm.court_id || null,
        reservation_booking_id: linkedReservationId,
      }).eq('id', schedulingMatch.id);

      setSchedulingMatch(null); showToast('success', 'Jadwal disimpan'); load();
    } catch (err) { showToast('error', err.message); }
    finally { setScheduleSaving(false); }
  }

  const teamMap = useMemo(() => { const m = {}; teams.forEach(t => { m[t.id] = t; }); return m; }, [teams]);

  const matchesByRound = useMemo(() => {
    const rounds = {};
    matches.forEach(m => { if (!rounds[m.round_number]) rounds[m.round_number] = { round_name: m.round_name, matches: [] }; rounds[m.round_number].matches.push(m); });
    return Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));
  }, [matches]);

  const confirmedTeams = teams.filter(t => t.status === 'confirmed');
  const paidTeams = teams.filter(t => t.payment_status === 'paid' || t.payment_status === 'waived');

  return (
    <div className="space-y-6">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-900 mb-2 flex items-center gap-1">← Semua Turnamen</button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl text-neutral-900">{tournament.name}</h1>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
              tournament.status === 'registration_open' ? 'bg-emerald-100 text-emerald-700' :
              tournament.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
              tournament.status === 'completed' ? 'bg-neutral-200 text-neutral-600' :
              'bg-yellow-100 text-yellow-700'
            }`}>{STATUS_LABELS[tournament.status] || tournament.status}</span>
          </div>
          <p className="text-neutral-500 text-sm mt-1">{tournament.sport_type} · {FORMAT_LABELS[tournament.format]} · {fmtDate(tournament.tournament_start)}</p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {tournament.status === 'draft' && <ActionButton size="sm" onClick={() => changeStatus('registration_open')}>Buka Pendaftaran</ActionButton>}
          {tournament.status === 'registration_open' && <ActionButton size="sm" variant="outline" onClick={() => changeStatus('registration_closed')}>Tutup Pendaftaran</ActionButton>}
          {tournament.status === 'registration_closed' && <ActionButton size="sm" onClick={() => changeStatus('ongoing')}>Mulai Turnamen</ActionButton>}
          {tournament.status === 'ongoing' && <ActionButton size="sm" onClick={() => changeStatus('completed')}>Selesaikan</ActionButton>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Tim Daftar</div>
          <div className="text-2xl font-bold text-neutral-900">{confirmedTeams.length}<span className="text-sm text-neutral-400">/{tournament.max_teams}</span></div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Sudah Bayar</div>
          <div className="text-2xl font-bold text-neutral-900">{paidTeams.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Match</div>
          <div className="text-2xl font-bold text-neutral-900">{matches.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Hadiah</div>
          <div className="text-2xl font-bold text-neutral-900">Rp {fmt(tournament.prize_pool)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit flex-wrap">
        {[['teams', 'Tim'], ['bracket', 'Bracket'], ['schedule', 'Jadwal'], ['results', 'Hasil']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TEAMS TAB ── */}
      {tab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-500">{confirmedTeams.length} / {tournament.max_teams} tim terdaftar</div>
            <ActionButton size="sm" onClick={() => setShowAddTeam(true)}><Plus size={14} /> Tambah Tim</ActionButton>
          </div>
          {loading ? (
            <div className="h-32 rounded-2xl bg-neutral-100 animate-pulse" />
          ) : teams.length === 0 ? (
            <EmptyState icon={Users} title="Belum ada tim" description="Tambahkan tim yang akan berkompetisi." />
          ) : (
            <div className="space-y-2">
              {teams.map((team, idx) => (
                <div key={team.id} className={`rounded-2xl border p-4 flex items-center gap-4 ${team.status === 'disqualified' || team.status === 'withdrawn' ? 'opacity-50 border-neutral-200' : 'border-neutral-200 bg-white'}`}>
                  <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center text-sm font-bold shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900">{team.team_name}</div>
                    <div className="text-xs text-neutral-500">{team.captain_name || '—'} · {team.captain_phone || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${team.payment_status === 'paid' || team.payment_status === 'waived' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {team.payment_status === 'waived' ? 'Gratis' : team.payment_status === 'paid' ? 'Lunas' : 'Belum Bayar'}
                    </span>
                    {team.payment_status === 'unpaid' && <button onClick={() => updateTeamPayment(team.id, 'paid')} className="text-xs text-emerald-600 hover:underline">Tandai Lunas</button>}
                    {team.status === 'confirmed' ? (
                      <button onClick={() => updateTeamStatus(team.id, 'disqualified')} className="text-xs text-red-500 hover:underline">DQ</button>
                    ) : team.status !== 'withdrawn' ? (
                      <button onClick={() => updateTeamStatus(team.id, 'confirmed')} className="text-xs text-emerald-600 hover:underline">Aktifkan</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {confirmedTeams.length >= 2 && (
            <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-emerald-900">Generate Bracket</div>
                <div className="text-sm text-emerald-700">{confirmedTeams.length} tim siap · Format: {FORMAT_LABELS[tournament.format]}</div>
              </div>
              <ActionButton onClick={handleGenerateBracket}><Shuffle size={14} /> Generate Bracket</ActionButton>
            </div>
          )}
        </div>
      )}

      {/* ── BRACKET TAB ── */}
      {tab === 'bracket' && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <EmptyState icon={Trophy} title="Bracket belum dibuat" description="Pergi ke tab Tim, lalu klik Generate Bracket." />
          ) : (
            <div className="space-y-6">
              {matchesByRound.map(([roundNum, { round_name, matches: roundMatches }]) => (
                <div key={roundNum}>
                  <div className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">{round_name}</div>
                  <div className="space-y-2">
                    {roundMatches.map(m => {
                      const home = teamMap[m.home_team_id];
                      const away = teamMap[m.away_team_id];
                      return (
                        <div key={m.id} className={`rounded-2xl border p-4 flex items-center gap-3 ${m.status === 'completed' ? 'bg-neutral-50' : 'bg-white'}`}>
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <div className={`text-sm font-semibold ${m.winner_team_id === m.home_team_id ? 'text-emerald-700' : 'text-neutral-900'}`}>
                              {home?.team_name || <span className="text-neutral-400 italic">TBD</span>}
                            </div>
                            <div className="text-center font-bold text-lg text-neutral-400 min-w-[60px]">
                              {m.status === 'completed' ? `${m.home_score ?? '—'} : ${m.away_score ?? '—'}` : 'VS'}
                            </div>
                            <div className={`text-sm font-semibold text-right ${m.winner_team_id === m.away_team_id ? 'text-emerald-700' : 'text-neutral-900'}`}>
                              {away?.team_name || <span className="text-neutral-400 italic">TBD</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {m.status === 'completed' ? (
                              <CheckCircle size={14} className="text-emerald-500" />
                            ) : home && away ? (
                              <>
                                <button type="button" onClick={() => { setScoringMatch(m); setScoreForm({ home_score: m.home_score ?? '', away_score: m.away_score ?? '' }); }} className="text-xs text-blue-600 hover:underline">Input Skor</button>
                                <span className="text-neutral-300">·</span>
                                <button type="button" onClick={() => { setSchedulingMatch(m); setScheduleForm({ scheduled_date: m.scheduled_date || '', scheduled_time: m.scheduled_time?.slice(0,5) || '', duration_minutes: 120, court_id: m.court_id || '' }); }} className="text-xs text-neutral-500 hover:underline">Jadwal</button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <EmptyState icon={Calendar} title="Belum ada pertandingan" description="Generate bracket dulu untuk membuat jadwal." />
          ) : (
            matches.filter(m => m.home_team_id && m.away_team_id)
              .sort((a, b) => a.scheduled_date && b.scheduled_date ? a.scheduled_date.localeCompare(b.scheduled_date) : a.round_number - b.round_number)
              .map(m => {
                const home = teamMap[m.home_team_id];
                const away = teamMap[m.away_team_id];
                const court = courts.find(c => c.id === m.court_id);
                const sync = getSyncBadgeConfig(m, reservationMap);
                return (
                  <div key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-neutral-900">{home?.team_name} vs {away?.team_name}</div>
                      <div className="text-sm text-neutral-500">
                        {m.round_name}
                        {m.scheduled_date && ` · ${fmtDate(m.scheduled_date)}`}
                        {m.scheduled_time && ` ${m.scheduled_time.slice(0,5)}`}
                        {court && ` · ${court.name}`}
                      </div>
                      <div className="mt-1">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sync.className}`}>{sync.label}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSchedulingMatch(m); setScheduleForm({ scheduled_date: m.scheduled_date || '', scheduled_time: m.scheduled_time?.slice(0,5) || '', duration_minutes: 120, court_id: m.court_id || '' }); }}
                      className="w-8 h-8 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900">
                      <Edit3 size={13} />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* ── RESULTS TAB ── */}
      {tab === 'results' && (
        <div className="space-y-4">
          {matches.filter(m => m.status === 'completed').length === 0 ? (
            <EmptyState icon={Trophy} title="Belum ada hasil" description="Input skor dari tab Bracket untuk mencatat hasil." />
          ) : (
            <>
              {(() => {
                const finalRound = Math.max(...matches.map(m => m.round_number));
                const finalMatch = matches.find(m => m.round_number === finalRound && m.status === 'completed');
                const champion = finalMatch ? teamMap[finalMatch.winner_team_id] : null;
                if (!champion) return null;
                return (
                  <div className="rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 p-5 text-white">
                    <div className="text-sm font-semibold opacity-80 mb-1">🏆 JUARA TURNAMEN</div>
                    <div className="text-3xl font-display">{champion.team_name}</div>
                  </div>
                );
              })()}
              <div className="space-y-2">
                {matches.filter(m => m.status === 'completed').map(m => {
                  const home = teamMap[m.home_team_id];
                  const away = teamMap[m.away_team_id];
                  return (
                    <div key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                      <div className="text-xs text-neutral-400 uppercase tracking-wide mb-2">{m.round_name}</div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className={`text-sm font-semibold ${m.winner_team_id === m.home_team_id ? 'text-emerald-700' : 'text-neutral-500'}`}>{home?.team_name}</div>
                        <div className="font-bold text-neutral-900 text-center min-w-[60px]">{m.home_score} : {m.away_score}</div>
                        <div className={`text-sm font-semibold text-right ${m.winner_team_id === m.away_team_id ? 'text-emerald-700' : 'text-neutral-500'}`}>{away?.team_name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      <Modal open={showAddTeam} onClose={() => setShowAddTeam(false)} title="Tambah Tim">
        <div className="space-y-4">
          <Field label="Nama Tim *"><input className={inputCls} value={teamForm.team_name} onChange={e => setTeamForm(f => ({ ...f, team_name: e.target.value }))} placeholder="Nama tim" /></Field>
          <Field label="Nama Kapten"><input className={inputCls} value={teamForm.captain_name} onChange={e => setTeamForm(f => ({ ...f, captain_name: e.target.value }))} placeholder="Nama kapten" /></Field>
          <Field label="No. HP Kapten"><input className={inputCls} value={teamForm.captain_phone} onChange={e => setTeamForm(f => ({ ...f, captain_phone: e.target.value }))} placeholder="08xx-xxxx-xxxx" /></Field>
          <Field label="Email Kapten"><input className={inputCls} type="email" value={teamForm.captain_email} onChange={e => setTeamForm(f => ({ ...f, captain_email: e.target.value }))} placeholder="email@contoh.com" /></Field>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowAddTeam(false)}>Batal</ActionButton>
            <ActionButton onClick={handleAddTeam} loading={teamSaving}>Tambahkan Tim</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!scoringMatch} onClose={() => setScoringMatch(null)} title="Input Skor">
        {scoringMatch && (
          <div className="space-y-4">
            <div className="text-center text-sm text-neutral-500 font-semibold">
              {teamMap[scoringMatch.home_team_id]?.team_name} vs {teamMap[scoringMatch.away_team_id]?.team_name}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={teamMap[scoringMatch.home_team_id]?.team_name || 'Home'}>
                <input className={inputCls} type="number" min="0" value={scoreForm.home_score} onChange={e => setScoreForm(f => ({ ...f, home_score: e.target.value }))} placeholder="0" />
              </Field>
              <Field label={teamMap[scoringMatch.away_team_id]?.team_name || 'Away'}>
                <input className={inputCls} type="number" min="0" value={scoreForm.away_score} onChange={e => setScoreForm(f => ({ ...f, away_score: e.target.value }))} placeholder="0" />
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <ActionButton variant="outline" onClick={() => setScoringMatch(null)}>Batal</ActionButton>
              <ActionButton onClick={handleSaveScore} loading={scoreSaving}>Simpan Skor</ActionButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!schedulingMatch} onClose={() => setSchedulingMatch(null)} title="Atur Jadwal">
        {schedulingMatch && (
          <div className="space-y-4">
            <div className="text-sm text-neutral-500 font-semibold">
              {teamMap[schedulingMatch.home_team_id]?.team_name || 'TBD'} vs {teamMap[schedulingMatch.away_team_id]?.team_name || 'TBD'} · {schedulingMatch.round_name}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal"><input className={inputCls} type="date" value={scheduleForm.scheduled_date} onChange={e => setScheduleForm(f => ({ ...f, scheduled_date: e.target.value }))} /></Field>
              <Field label="Jam"><input className={inputCls} type="time" value={scheduleForm.scheduled_time} onChange={e => setScheduleForm(f => ({ ...f, scheduled_time: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Durasi (menit)"><input className={inputCls} type="number" min="30" step="30" value={scheduleForm.duration_minutes} onChange={e => setScheduleForm(f => ({ ...f, duration_minutes: e.target.value }))} /></Field>
              <Field label="Selesai"><input className={inputCls} value={getScheduleEndTime(scheduleForm.scheduled_time, scheduleForm.duration_minutes)} readOnly /></Field>
            </div>
            <Field label="Lapangan">
              <select className={selectCls} value={scheduleForm.court_id} onChange={e => setScheduleForm(f => ({ ...f, court_id: e.target.value }))}>
                <option value="">— Pilih Lapangan —</option>
                {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Menyimpan jadwal ini akan otomatis memblokir lapangan di reservation (`booking_type: tournament`).
            </div>
            <div className="flex gap-3 pt-2">
              <ActionButton variant="outline" onClick={() => setSchedulingMatch(null)}>Batal</ActionButton>
              <ActionButton onClick={handleSaveSchedule} loading={scheduleSaving}>Simpan Jadwal</ActionButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VenueTournamentReservationPage({ auth, venue }) {
  const venueId = venue?.id;
  const [view, setView] = useState('list');
  const [selectedTournament, setSelectedTournament] = useState(null);

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={Trophy} title="Belum ada venue" description="Daftarkan venue dulu untuk mengelola turnamen." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Operasional</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Turnamen Venue</h1>
        <p className="text-neutral-500 text-sm mt-1">Buat dan kelola turnamen, bracket, jadwal, serta hasil pertandingan.</p>
      </div>

      {view === 'list' && (
        <TournamentList
          venueId={venueId}
          onSelect={t => { setSelectedTournament(t); setView('detail'); }}
          onCreate={() => setView('create')}
        />
      )}

      {view === 'create' && (
        <CreateTournamentForm
          venueId={venueId}
          auth={auth}
          onCreated={t => { setSelectedTournament(t); setView('detail'); }}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'detail' && selectedTournament && (
        <TournamentDetail
          tournament={selectedTournament}
          venueId={venueId}
          auth={auth}
          onBack={() => { setSelectedTournament(null); setView('list'); }}
        />
      )}
    </div>
  );
}
