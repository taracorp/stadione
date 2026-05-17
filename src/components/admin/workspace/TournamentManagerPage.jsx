import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, Eye, CheckCircle, XCircle, Users, Clock, Filter, Settings } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, textareaCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';
import { getTournamentSubstitutionRules, getSubstitutionPresetForSport } from '../../../services/substitutionRuleEngine.js';

const REG_FILTER_OPTIONS = ['all', 'waiting_payment', 'payment_uploaded', 'approved', 'rejected'];
const SPORT_PREFERENCES_NOTE_PREFIX = '[SPORT_PREFS]';

function parseSportPreferencesAdminNote(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith(SPORT_PREFERENCES_NOTE_PREFIX)) {
    return { preferences: null, adminNote: raw };
  }

  const payload = raw.slice(SPORT_PREFERENCES_NOTE_PREFIX.length);
  const firstBreak = payload.indexOf('\n');
  const jsonText = (firstBreak >= 0 ? payload.slice(0, firstBreak) : payload).trim();
  const adminNote = (firstBreak >= 0 ? payload.slice(firstBreak + 1) : '').trim();

  try {
    const parsed = JSON.parse(jsonText || '{}');
    if (!parsed || typeof parsed !== 'object') {
      return { preferences: null, adminNote };
    }
    return { preferences: parsed, adminNote };
  } catch (_) {
    return { preferences: null, adminNote: raw };
  }
}

function composeAdminNoteWithPreferences(existingValue, adminNote) {
  const parsed = parseSportPreferencesAdminNote(existingValue);
  if (!parsed.preferences) {
    return adminNote || null;
  }
  const serialized = `${SPORT_PREFERENCES_NOTE_PREFIX}${JSON.stringify(parsed.preferences)}`;
  return adminNote ? `${serialized}\n${adminNote}` : serialized;
}

function summarizeSportPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return '';
  const segments = [];

  if (preferences.mainSport) {
    const mainRole = [preferences.mainPosition, preferences.secondPosition].filter(Boolean).join(' / ');
    segments.push(mainRole ? `Utama: ${preferences.mainSport} (${mainRole})` : `Utama: ${preferences.mainSport}`);
  }

  const additional = Array.isArray(preferences.additionalSports) ? preferences.additionalSports : [];
  if (additional.length > 0) {
    const additionalText = additional
      .map((item) => {
        const sport = String(item?.sport || '').trim();
        if (!sport) return '';
        const role = [String(item?.mainPosition || '').trim(), String(item?.secondPosition || '').trim()].filter(Boolean).join(' / ');
        return role ? `${sport} (${role})` : sport;
      })
      .filter(Boolean)
      .join(', ');

    if (additionalText) {
      segments.push(`Tambahan: ${additionalText}`);
    }
  }

  return segments.join(' • ');
}

function isMissingSubstitutionRulesColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('substitution_rules')
    && (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'));
}

export default function TournamentManagerPage({ auth, onBack, onNav }) {
  const [tab, setTab] = useState('tournaments'); // 'tournaments' | 'registrations'
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regFilter, setRegFilter] = useState('all');

  // Review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewRoster, setViewRoster] = useState(null);
  const [roster, setRoster] = useState([]);
  const [ruleTarget, setRuleTarget] = useState(null);
  const [ruleDraft, setRuleDraft] = useState(null);
  const [savingRules, setSavingRules] = useState(false);

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('tournaments')
        .select('id,name,sport,status,classification,is_verified,verification_status,host,participants,start_date,format,reg_fee,substitution_rules')
        .order('id', { ascending: false });

      if (error && isMissingSubstitutionRulesColumnError(error)) {
        const fallback = await supabase
          .from('tournaments')
          .select('id,name,sport,status,classification,is_verified,verification_status,host,participants,start_date,format,reg_fee')
          .order('id', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      setTournaments(data || []);
    } catch (err) {
      console.error('TournamentManager load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('tournament_registrations')
        .select('id,tournament_id,registrant_name,registrant_email,registration_type,registration_status,payment_status,admin_review_status,admin_notes,created_at,base_fee,unique_transfer_amount')
        .order('created_at', { ascending: false });
      if (regFilter !== 'all') q = q.eq('registration_status', regFilter);
      const { data } = await q;
      setRegistrations(data || []);
    } catch (err) {
      console.error('Registration load error:', err);
    } finally {
      setLoading(false);
    }
  }, [regFilter]);

  useEffect(() => {
    if (tab === 'tournaments') loadTournaments();
    else loadRegistrations();
  }, [tab, loadTournaments, loadRegistrations]);

  async function handleRegistrationReview(status) {
    if (!reviewTarget) return;
    setSaving(true);
    try {
      const mergedAdminNotes = composeAdminNoteWithPreferences(reviewTarget.admin_notes, adminNotes.trim());
      await supabase.from('tournament_registrations').update({
        registration_status: status === 'approved' ? 'approved' : 'rejected',
        admin_review_status: status,
        admin_notes: mergedAdminNotes,
        reviewed_by: auth?.id || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', reviewTarget.id);
      setReviewTarget(null);
      setAdminNotes('');
      loadRegistrations();
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function openRoster(registrationId, name) {
    setViewRoster({ id: registrationId, name });
    const { data } = await supabase.from('tournament_registration_roster').select('*').eq('registration_id', registrationId);
    setRoster(data || []);
  }

  function openRuleModal(tournament) {
    setRuleTarget(tournament);
    setRuleDraft(getTournamentSubstitutionRules(tournament));
  }

  async function saveSubstitutionRules() {
    if (!ruleTarget?.id || !ruleDraft) return;
    setSavingRules(true);
    try {
      let { error } = await supabase
        .from('tournaments')
        .update({ substitution_rules: ruleDraft, updated_at: new Date().toISOString() })
        .eq('id', ruleTarget.id);

      if (error && isMissingSubstitutionRulesColumnError(error)) {
        console.warn('Kolom substitution_rules belum tersedia. Simpan aturan substitusi dilewati sementara.');
        setRuleTarget(null);
        setRuleDraft(null);
        return;
      }

      if (error) throw error;
      setRuleTarget(null);
      setRuleDraft(null);
      loadTournaments();
    } catch (err) {
      console.error('Save substitution rules error:', err);
    } finally {
      setSavingRules(false);
    }
  }

  const approved = registrations.filter((r) => r.registration_status === 'approved').length;
  const pending = registrations.filter((r) => ['waiting_payment', 'payment_uploaded'].includes(r.registration_status)).length;

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ WORKSPACE — TURNAMEN"
      title={<>KELOLA<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>turnamen.</span></>}
      subtitle="Kelola semua turnamen dan proses pendaftaran tim."
      onBack={onBack}
      breadcrumbs={[{ label: 'Workspace', onClick: () => onNav('workspace-console') }, { label: 'Kelola Turnamen' }]}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit mb-6">
        {[['tournaments', 'Turnamen'], ['registrations', 'Pendaftaran']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* === TOURNAMENTS TAB === */}
      {tab === 'tournaments' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <div className="font-display text-2xl text-neutral-900">Semua Turnamen</div>
            <ActionButton size="sm" onClick={() => onNav('create-tournament')}>
              <Plus size={14} /> Buat Turnamen
            </ActionButton>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : tournaments.length === 0 ? (
            <EmptyState icon={Trophy} title="Belum ada turnamen" description="Buat turnamen pertama Anda." action={<ActionButton onClick={() => onNav('create-tournament')}><Plus size={14} /> Buat Turnamen</ActionButton>} />
          ) : (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <div key={t.id} className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Trophy size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-neutral-900 truncate">{t.name}</span>
                      <StatusBadge status={t.status?.toLowerCase() === 'buka pendaftaran' ? 'active' : t.status?.toLowerCase() === 'selesai' ? 'completed' : 'pending'} />
                      {t.is_verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          <CheckCircle size={9} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-neutral-500">{t.sport} · {t.classification} · {t.format}</div>
                    <div className="text-xs text-neutral-400 mt-0.5">Host: {t.host} · {t.participants} peserta</div>
                  </div>
                  <button
                    onClick={() => onNav('tournament-detail', t)}
                    className="shrink-0 w-8 h-8 rounded-xl hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition"
                    title="Lihat Detail"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    onClick={() => openRuleModal(t)}
                    className="shrink-0 w-8 h-8 rounded-xl hover:bg-violet-50 flex items-center justify-center text-neutral-400 hover:text-violet-700 transition"
                    title="Atur Aturan Substitusi"
                  >
                    <Settings size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === REGISTRATIONS TAB === */}
      {tab === 'registrations' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Pending Review" value={pending} icon={Clock} accent="amber" />
            <StatCard label="Approved" value={approved} icon={CheckCircle} accent="emerald" />
            <StatCard label="Total" value={registrations.length} icon={Users} accent="blue" />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Filter size={14} className="text-neutral-400" />
            {REG_FILTER_OPTIONS.map((f) => (
              <button key={f} onClick={() => setRegFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.14em] transition border ${regFilter === f ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-900'}`}>
                {f === 'all' ? 'Semua' : f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : registrations.length === 0 ? (
            <EmptyState icon={Users} title="Tidak ada pendaftaran" description="Belum ada tim yang mendaftar dengan status ini." />
          ) : (
            <div className="space-y-3">
              {registrations.map((reg) => {
                const parsedNotes = parseSportPreferencesAdminNote(reg.admin_notes);
                const sportSummary = summarizeSportPreferences(parsedNotes.preferences);

                return (
                  <div key={reg.id} className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-neutral-900">{reg.registrant_name}</span>
                        <StatusBadge status={reg.registration_status} />
                      </div>
                      <div className="text-sm text-neutral-500">{reg.registrant_email}</div>
                      <div className="text-xs text-neutral-400 mt-1">
                        Tipe: {reg.registration_type} · Biaya: Rp {reg.unique_transfer_amount?.toLocaleString('id-ID') || reg.base_fee?.toLocaleString('id-ID') || '0'}
                      </div>
                      {sportSummary && <div className="text-xs text-blue-600 mt-1">Preferensi olahraga: {sportSummary}</div>}
                      {parsedNotes.adminNote && <div className="text-xs text-neutral-400 mt-0.5 italic">Catatan: {parsedNotes.adminNote}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openRoster(reg.id, reg.registrant_name)} title="Lihat Roster" className="w-8 h-8 rounded-xl hover:bg-blue-50 text-neutral-400 hover:text-blue-600 flex items-center justify-center transition">
                        <Users size={14} />
                      </button>
                      {['waiting_payment', 'payment_uploaded'].includes(reg.registration_status) && (
                        <button
                          onClick={() => {
                            setReviewTarget(reg);
                            setAdminNotes(parseSportPreferencesAdminNote(reg.admin_notes).adminNote || '');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* REVIEW MODAL */}
      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Review Pendaftaran">
        {reviewTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-1">
              <div className="font-semibold text-neutral-900">{reviewTarget.registrant_name}</div>
              <div className="text-sm text-neutral-500">{reviewTarget.registrant_email}</div>
              <div className="text-xs text-neutral-400">Status: {reviewTarget.registration_status}</div>
            </div>
            <Field label="Catatan Admin (opsional)">
              <textarea className={textareaCls} rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Tulis catatan review..." />
            </Field>
            <div className="flex gap-2">
              <ActionButton onClick={() => handleRegistrationReview('approved')} loading={saving}>
                <CheckCircle size={14} /> Approve
              </ActionButton>
              <ActionButton variant="danger" onClick={() => handleRegistrationReview('rejected')} loading={saving}>
                <XCircle size={14} /> Reject
              </ActionButton>
              <div className="ml-auto">
                <ActionButton variant="outline" onClick={() => setReviewTarget(null)}>Batal</ActionButton>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ROSTER MODAL */}
      <Modal open={!!viewRoster} onClose={() => setViewRoster(null)} title={`Roster — ${viewRoster?.name}`}>
        {roster.length === 0 ? (
          <p className="text-sm text-neutral-500">Belum ada pemain dalam roster ini.</p>
        ) : (
          <div className="space-y-2">
            {roster.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 bg-neutral-50">
                <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{p.player_name}</div>
                  <div className="text-xs text-neutral-400">{p.player_identifier}{p.date_of_birth ? ` · ${p.date_of_birth}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!ruleTarget} onClose={() => { setRuleTarget(null); setRuleDraft(null); }} title={`Aturan Substitusi — ${ruleTarget?.name || ''}`}>
        {ruleDraft && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] font-black text-violet-700 mb-1">Rule Engine - Substitusi</div>
              <div className="text-sm text-violet-900 font-semibold">Atur aturan pergantian pemain</div>
              <div className="text-xs text-violet-800 mt-1">Preset bawaan mengikuti cabor yang dipilih, lalu bisa diubah di sini.</div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] font-black text-neutral-500 mb-1">Preset Cabor</div>
              <div className="text-sm text-neutral-700">{ruleTarget?.sport || 'Tidak diketahui'} · mode bawaan {getSubstitutionPresetForSport(ruleTarget?.sport)?.mode}</div>
            </div>

            <Field label="Mode Substitusi">
              <select
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
                value={ruleDraft.mode || 'limited'}
                onChange={(e) => setRuleDraft((prev) => ({ ...prev, mode: e.target.value }))}
              >
                <option value="limited">Terbatas</option>
                <option value="rolling">Bergulir</option>
                <option value="disabled">Nonaktif</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kuota Substitusi / Tim">
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
                  type="number"
                  min={0}
                  disabled={ruleDraft.mode === 'rolling' || ruleDraft.mode === 'disabled'}
                  value={ruleDraft.maxSubstitutionsPerTeam ?? ''}
                  onChange={(e) => setRuleDraft((prev) => ({ ...prev, maxSubstitutionsPerTeam: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </Field>
              <Field label="Izinkan pemain masuk kembali setelah keluar (re-entry)">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 mt-2">
                  <input
                    type="checkbox"
                    checked={Boolean(ruleDraft.allowReentry)}
                    onChange={(e) => setRuleDraft((prev) => ({ ...prev, allowReentry: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  Ya
                </label>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Menit per Babak">
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
                  type="number"
                  min={1}
                  disabled={ruleDraft.mode === 'disabled'}
                  value={ruleDraft.maxMinute ? Math.max(1, Math.round(Number(ruleDraft.maxMinute) / 2)) : 45}
                  onChange={(e) => {
                    const menitPerBabak = Number(e.target.value || 0);
                    setRuleDraft((prev) => ({
                      ...prev,
                      minMinute: 0,
                      maxMinute: menitPerBabak > 0 ? menitPerBabak * 2 : prev.maxMinute,
                    }));
                  }}
                />
              </Field>
              <Field label="Total Menit Pertandingan">
                <input
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm text-neutral-900"
                  type="number"
                  value={ruleDraft.maxMinute ?? 90}
                  disabled
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2">
              <ActionButton variant="outline" onClick={() => { setRuleTarget(null); setRuleDraft(null); }}>Batal</ActionButton>
              <ActionButton variant="outline" onClick={() => setRuleDraft(getSubstitutionPresetForSport(ruleTarget?.sport))}>Kembalikan ke Preset</ActionButton>
              <ActionButton onClick={saveSubstitutionRules} loading={savingRules}>Simpan Aturan</ActionButton>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
