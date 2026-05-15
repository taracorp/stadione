import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, AlertTriangle, CheckCircle, Clock, CalendarClock } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PRIORITY_LABELS = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi', urgent: 'Darurat' };
const STATUS_LABELS = { open: 'Terbuka', in_progress: 'Dikerjakan', resolved: 'Selesai', closed: 'Ditutup' };

function PriorityBadge({ priority }) {
  const cls = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls[priority] || cls.low}`}>{PRIORITY_LABELS[priority] || priority}</span>;
}

function StatusBadge({ status }) {
  const cls = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-neutral-200 text-neutral-600',
  };
  const icons = { open: <Clock size={10} />, in_progress: <Wrench size={10} />, resolved: <CheckCircle size={10} />, closed: <CheckCircle size={10} /> };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${cls[status] || cls.open}`}>
      {icons[status]}{STATUS_LABELS[status] || status}
    </span>
  );
}

const EMPTY_FORM = {
  court_id: '', title: '', description: '', priority: 'medium', status: 'open',
  reported_date: new Date().toISOString().slice(0, 10), estimated_cost: '', resolved_date: '',
};

const EMPTY_SCHEDULE_FORM = {
  court_id: '',
  title: '',
  description: '',
  maintenance_date: new Date().toISOString().slice(0, 10),
  start_time: '08:00',
  end_time: '10:00',
  status: 'scheduled',
  is_blocking: true,
};

const EMPTY_CHECKLIST_FORM = {
  court_id: '',
  title: '',
  check_date: new Date().toISOString().slice(0, 10),
  shift_label: 'morning',
  status: 'pending',
  assigned_to: '',
  notes: '',
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueMaintenancePage({ auth, venue }) {
  const venueId = venue?.id;
  const [items, setItems] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [repairHistory, setRepairHistory] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM);
  const [checklistForm, setChecklistForm] = useState(EMPTY_CHECKLIST_FORM);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [mRes, cRes, scheduleRes, checklistRes, historyRes, staffRes] = await Promise.all([
        supabase
          .from('venue_maintenance_logs')
          .select('*')
          .eq('venue_id', venueId)
          .order('reported_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('venue_courts')
          .select('id, name')
          .eq('venue_id', venueId)
          .order('name'),
        supabase
          .from('venue_maintenance_schedules')
          .select('*')
          .eq('venue_id', venueId)
          .order('maintenance_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('venue_cleaning_checklists')
          .select('*')
          .eq('venue_id', venueId)
          .order('check_date', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('venue_maintenance_repair_history')
          .select('*')
          .eq('venue_id', venueId)
          .order('action_at', { ascending: false })
          .limit(300),
        supabase
          .from('venue_staff')
          .select('user_id, role, status')
          .eq('venue_id', venueId)
          .eq('status', 'active')
          .order('invited_at', { ascending: false }),
      ]);

      const firstError = [
        mRes?.error,
        cRes?.error,
        scheduleRes?.error,
        checklistRes?.error,
        historyRes?.error,
        staffRes?.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setItems(mRes.data || []);
      setCourts(cRes.data || []);
      setSchedules(scheduleRes?.data || []);
      setChecklists(checklistRes?.data || []);
      setRepairHistory(historyRes?.data || []);
      setStaffMembers(staffRes?.data || []);
    } catch (err) {
      console.error('Maintenance load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setSchedule(k, v) { setScheduleForm(s => ({ ...s, [k]: v })); }
  function setChecklist(k, v) { setChecklistForm(c => ({ ...c, [k]: v })); }

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openScheduleCreate() { setScheduleForm(EMPTY_SCHEDULE_FORM); setShowScheduleForm(true); }
  function openChecklistCreate() { setChecklistForm(EMPTY_CHECKLIST_FORM); setShowChecklistForm(true); }

  function openEdit(item) {
    setEditing(item);
    setForm({
      court_id: item.court_id || '',
      title: item.title || '',
      description: item.description || '',
      priority: item.priority || 'medium',
      status: item.status || 'open',
      reported_date: item.reported_date || '',
      estimated_cost: item.estimated_cost ?? '',
      resolved_date: item.resolved_date || '',
    });
    setShowForm(true);
  }

  async function recordRepairHistory({
    maintenanceLogId,
    action,
    oldStatus = null,
    newStatus = null,
    oldEstimatedCost = null,
    newEstimatedCost = null,
    note = null,
    metadata = {},
  }) {
    if (!venueId || !maintenanceLogId || !action) return;
    try {
      const { error } = await supabase.from('venue_maintenance_repair_history').insert({
        venue_id: venueId,
        maintenance_log_id: String(maintenanceLogId),
        action,
        old_status: oldStatus,
        new_status: newStatus,
        old_estimated_cost: oldEstimatedCost,
        new_estimated_cost: newEstimatedCost,
        note,
        metadata,
        action_by: auth?.id || null,
      });
      if (error) throw error;
    } catch (err) {
      // Audit/history write is best-effort and should not block primary operation.
      console.warn('Repair history insert failed:', err.message);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        venue_id: venueId,
        court_id: form.court_id || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        reported_date: form.reported_date || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
        resolved_date: form.resolved_date || null,
        reported_by: auth?.id || null,
      };
      if (editing) {
        const { error } = await supabase.from('venue_maintenance_logs').update(payload).eq('id', editing.id);
        if (error) throw error;

        if (editing.status !== payload.status) {
          await recordRepairHistory({
            maintenanceLogId: editing.id,
            action: payload.status === 'resolved' ? 'resolved' : payload.status === 'closed' ? 'closed' : 'status_changed',
            oldStatus: editing.status,
            newStatus: payload.status,
            oldEstimatedCost: editing.estimated_cost,
            newEstimatedCost: payload.estimated_cost,
            note: 'Status diperbarui dari form maintenance.',
          });
        } else if (Number(editing.estimated_cost || 0) !== Number(payload.estimated_cost || 0)) {
          await recordRepairHistory({
            maintenanceLogId: editing.id,
            action: 'cost_updated',
            oldStatus: editing.status,
            newStatus: payload.status,
            oldEstimatedCost: editing.estimated_cost,
            newEstimatedCost: payload.estimated_cost,
            note: 'Estimasi biaya diperbarui.',
          });
        } else {
          await recordRepairHistory({
            maintenanceLogId: editing.id,
            action: 'updated',
            oldStatus: editing.status,
            newStatus: payload.status,
            oldEstimatedCost: editing.estimated_cost,
            newEstimatedCost: payload.estimated_cost,
            note: 'Detail maintenance diperbarui.',
          });
        }

        showToast('success', 'Log diperbarui');
      } else {
        const { data, error } = await supabase.from('venue_maintenance_logs').insert(payload).select('id').single();
        if (error) throw error;

        await recordRepairHistory({
          maintenanceLogId: data?.id,
          action: 'created',
          newStatus: payload.status,
          newEstimatedCost: payload.estimated_cost,
          note: 'Log maintenance dibuat.',
        });

        showToast('success', 'Log ditambahkan');
      }
      setShowForm(false);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdateStatus(id, status) {
    try {
      const target = items.find((item) => item.id === id);
      const upd = { status };
      if (status === 'resolved' || status === 'closed') upd.resolved_date = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('venue_maintenance_logs').update(upd).eq('id', id);
      if (error) throw error;

      await recordRepairHistory({
        maintenanceLogId: id,
        action: status === 'resolved' ? 'resolved' : status === 'closed' ? 'closed' : 'status_changed',
        oldStatus: target?.status || null,
        newStatus: status,
        oldEstimatedCost: target?.estimated_cost || null,
        newEstimatedCost: target?.estimated_cost || null,
        note: 'Status diperbarui dari quick action.',
      });

      load();
    } catch (err) { showToast('error', err.message); }
  }

  async function saveSchedule() {
    if (!scheduleForm.title.trim()) return;
    if (!scheduleForm.maintenance_date || !scheduleForm.start_time || !scheduleForm.end_time) {
      showToast('error', 'Tanggal dan jam maintenance wajib diisi.');
      return;
    }
    if (scheduleForm.end_time <= scheduleForm.start_time) {
      showToast('error', 'Jam selesai harus lebih besar dari jam mulai.');
      return;
    }

    setSavingSchedule(true);
    try {
      const payload = {
        venue_id: venueId,
        court_id: scheduleForm.court_id || null,
        title: scheduleForm.title.trim(),
        description: scheduleForm.description.trim() || null,
        maintenance_date: scheduleForm.maintenance_date,
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
        status: scheduleForm.status,
        is_blocking: Boolean(scheduleForm.is_blocking),
        created_by: auth?.id || null,
      };
      const { error } = await supabase.from('venue_maintenance_schedules').insert(payload);
      if (error) throw error;
      showToast('success', 'Jadwal maintenance ditambahkan.');
      setShowScheduleForm(false);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function updateScheduleStatus(id, status) {
    try {
      const { error } = await supabase.from('venue_maintenance_schedules').update({ status }).eq('id', id);
      if (error) throw error;
      load();
    } catch (err) {
      showToast('error', err.message);
    }
  }

  async function saveChecklist() {
    if (!checklistForm.title.trim()) return;
    if (!checklistForm.check_date) {
      showToast('error', 'Tanggal checklist wajib diisi.');
      return;
    }

    setSavingChecklist(true);
    try {
      const payload = {
        venue_id: venueId,
        court_id: checklistForm.court_id || null,
        title: checklistForm.title.trim(),
        check_date: checklistForm.check_date,
        shift_label: checklistForm.shift_label,
        status: checklistForm.status,
        assigned_to: checklistForm.assigned_to || null,
        notes: checklistForm.notes.trim() || null,
        created_by: auth?.id || null,
      };
      const { error } = await supabase.from('venue_cleaning_checklists').insert(payload);
      if (error) throw error;
      showToast('success', 'Checklist cleaning ditambahkan.');
      setShowChecklistForm(false);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingChecklist(false);
    }
  }

  async function updateChecklistStatus(id, status) {
    try {
      const payload = { status };
      if (status === 'completed') {
        payload.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('venue_cleaning_checklists').update(payload).eq('id', id);
      if (error) throw error;
      load();
    } catch (err) {
      showToast('error', err.message);
    }
  }

  const filtered = filterStatus === 'all' ? items : items.filter(i => i.status === filterStatus);
  const openCount = items.filter(i => i.status === 'open' || i.status === 'in_progress').length;
  const urgentCount = items.filter(i => i.priority === 'urgent' && i.status !== 'resolved' && i.status !== 'closed').length;
  const courtMap = Object.fromEntries(courts.map(c => [c.id, c.name]));
  const activeSchedules = schedules.filter((s) => s.status === 'scheduled' || s.status === 'in_progress');
  const pendingChecklists = checklists.filter((c) => c.status === 'pending' || c.status === 'in_progress');
  const historyByLog = repairHistory.reduce((acc, entry) => {
    const key = String(entry.maintenance_log_id || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={Wrench} title="Belum ada venue" description="Daftarkan venue terlebih dahulu." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Maintenance</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Log Maintenance</h1>
          <p className="text-neutral-500 text-sm mt-1">Catat dan pantau perbaikan lapangan & fasilitas.</p>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton variant="outline" onClick={openChecklistCreate}>Checklist Cleaning</ActionButton>
          <ActionButton variant="outline" onClick={openScheduleCreate}><CalendarClock size={14} /> Jadwalkan Blocking</ActionButton>
          <ActionButton onClick={openCreate}><Plus size={14} /> Tambah Log</ActionButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Masih Terbuka</div>
          <div className={`text-2xl font-bold ${openCount > 0 ? 'text-orange-600' : 'text-neutral-900'}`}>{openCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Darurat</div>
          <div className={`text-2xl font-bold ${urgentCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>{urgentCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Selesai</div>
          <div className="text-2xl font-bold text-neutral-900">{items.filter(i => i.status === 'resolved').length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Log</div>
          <div className="text-2xl font-bold text-neutral-900">{items.length}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-neutral-900">Checklist Cleaning</h2>
          <span className="text-xs text-neutral-500">Pending: {pendingChecklists.length}</span>
        </div>
        {checklists.length === 0 ? (
          <div className="text-sm text-neutral-500">Belum ada checklist cleaning.</div>
        ) : (
          <div className="space-y-2">
            {checklists.slice(0, 8).map((item) => {
              const assigned = item.assigned_to ? `${String(item.assigned_to).slice(0, 8)}…` : 'Belum di-assign';
              return (
                <div key={item.id} className="rounded-xl border border-neutral-200 p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-neutral-900">{item.title}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {(courtMap[item.court_id] || 'Semua lapangan')} · {fmtDate(item.check_date)} · {item.shift_label}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">Petugas: {assigned}</div>
                    {item.notes ? <div className="text-xs text-neutral-500 mt-1">{item.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : item.status === 'skipped' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.status}</span>
                    {item.status === 'pending' && (
                      <button onClick={() => updateChecklistStatus(item.id, 'in_progress')} className="text-xs text-yellow-600 hover:underline">Mulai</button>
                    )}
                    {(item.status === 'pending' || item.status === 'in_progress') && (
                      <button onClick={() => updateChecklistStatus(item.id, 'completed')} className="text-xs text-emerald-600 hover:underline">Selesai</button>
                    )}
                    {(item.status === 'pending' || item.status === 'in_progress') && (
                      <button onClick={() => updateChecklistStatus(item.id, 'skipped')} className="text-xs text-red-600 hover:underline">Lewati</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit flex-wrap">
        {[['all', 'Semua'], ['open', 'Terbuka'], ['in_progress', 'Dikerjakan'], ['resolved', 'Selesai']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilterStatus(k)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${filterStatus === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-neutral-900">Jadwal Blocking Maintenance</h2>
          <span className="text-xs text-neutral-500">Aktif: {activeSchedules.length}</span>
        </div>
        {schedules.length === 0 ? (
          <div className="text-sm text-neutral-500">Belum ada jadwal blocking maintenance.</div>
        ) : (
          <div className="space-y-2">
            {schedules.slice(0, 8).map((s) => (
              <div key={s.id} className="rounded-xl border border-neutral-200 p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm text-neutral-900">{s.title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {(courtMap[s.court_id] || 'Semua lapangan')} · {fmtDate(s.maintenance_date)} · {String(s.start_time || '').slice(0, 5)}-{String(s.end_time || '').slice(0, 5)}
                  </div>
                  {s.description ? <div className="text-xs text-neutral-500 mt-1">{s.description}</div> : null}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : s.status === 'cancelled' ? 'bg-neutral-200 text-neutral-600' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span>
                  {(s.status === 'scheduled' || s.status === 'in_progress') && (
                    <button onClick={() => updateScheduleStatus(s.id, 'completed')} className="text-xs text-emerald-600 hover:underline">Selesai</button>
                  )}
                  {s.status === 'scheduled' && (
                    <button onClick={() => updateScheduleStatus(s.id, 'cancelled')} className="text-xs text-red-600 hover:underline">Batalkan</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="Tidak ada log" description="Tidak ada maintenance yang ditemukan." action={<ActionButton onClick={openCreate}><Plus size={14} /> Tambah Log</ActionButton>} />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className={`rounded-2xl border p-4 flex items-start gap-4 ${item.priority === 'urgent' && item.status !== 'resolved' ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}>
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${item.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                {item.priority === 'urgent' ? <AlertTriangle size={15} /> : <Wrench size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-neutral-900">{item.title}</span>
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                </div>
                <div className="text-xs text-neutral-500 mb-1">
                  {courtMap[item.court_id] ? `${courtMap[item.court_id]} · ` : ''}{fmtDate(item.reported_date)}
                  {item.estimated_cost ? ` · Est. Rp ${Number(item.estimated_cost).toLocaleString('id-ID')}` : ''}
                  {item.resolved_date ? ` · Selesai ${fmtDate(item.resolved_date)}` : ''}
                </div>
                {item.description && <div className="text-xs text-neutral-500">{item.description}</div>}
                {(historyByLog[String(item.id)] || []).length > 0 ? (
                  <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Riwayat Perbaikan</div>
                    <div className="space-y-1">
                      {(historyByLog[String(item.id)] || []).slice(0, 3).map((entry) => (
                        <div key={entry.id} className="text-xs text-neutral-600">
                          {entry.action} · {fmtDateTime(entry.action_at)}
                          {entry.old_status || entry.new_status ? ` · ${entry.old_status || '-'} -> ${entry.new_status || '-'}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                {item.status === 'open' && (
                  <button onClick={() => quickUpdateStatus(item.id, 'in_progress')} className="text-xs text-yellow-600 hover:underline">Kerjakan</button>
                )}
                {(item.status === 'open' || item.status === 'in_progress') && (
                  <button onClick={() => quickUpdateStatus(item.id, 'resolved')} className="text-xs text-emerald-600 hover:underline">Selesai</button>
                )}
                <button onClick={() => openEdit(item)} className="text-xs text-neutral-500 hover:underline">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Log Maintenance' : 'Tambah Log Maintenance'}>
        <div className="space-y-4">
          <Field label="Judul *">
            <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="cth: AC Lapangan 2 rusak" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lapangan">
              <select className={selectCls} value={form.court_id} onChange={e => set('court_id', e.target.value)}>
                <option value="">— Pilih Lapangan —</option>
                {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Prioritas">
              <select className={selectCls} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Estimasi Biaya (Rp)">
              <input className={inputCls} type="number" min="0" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Tanggal Laporan">
              <input className={inputCls} type="date" value={form.reported_date} onChange={e => set('reported_date', e.target.value)} />
            </Field>
            <Field label="Tanggal Selesai">
              <input className={inputCls} type="date" value={form.resolved_date} onChange={e => set('resolved_date', e.target.value)} />
            </Field>
          </div>
          <Field label="Deskripsi">
            <textarea className={textareaCls} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detail kerusakan atau pekerjaan yang dilakukan" />
          </Field>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSave} loading={saving}>{editing ? 'Simpan Perubahan' : 'Tambah Log'}</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={showScheduleForm} onClose={() => setShowScheduleForm(false)} title="Jadwal Blocking Maintenance" width="max-w-xl">
        <div className="space-y-4">
          <Field label="Judul *">
            <input className={inputCls} value={scheduleForm.title} onChange={e => setSchedule('title', e.target.value)} placeholder="cth: Preventive AC Court 2" />
          </Field>
          <Field label="Deskripsi">
            <textarea className={textareaCls} rows={2} value={scheduleForm.description} onChange={e => setSchedule('description', e.target.value)} placeholder="Opsional" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lapangan">
              <select className={selectCls} value={scheduleForm.court_id} onChange={e => setSchedule('court_id', e.target.value)}>
                <option value="">Semua lapangan</option>
                {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={scheduleForm.status} onChange={e => setSchedule('status', e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Tanggal">
              <input className={inputCls} type="date" value={scheduleForm.maintenance_date} onChange={e => setSchedule('maintenance_date', e.target.value)} />
            </Field>
            <Field label="Blocking Slot">
              <select className={selectCls} value={String(scheduleForm.is_blocking)} onChange={e => setSchedule('is_blocking', e.target.value === 'true')}>
                <option value="true">Ya, blokir booking</option>
                <option value="false">Tidak, hanya pengingat</option>
              </select>
            </Field>
            <Field label="Jam Mulai">
              <input className={inputCls} type="time" value={scheduleForm.start_time} onChange={e => setSchedule('start_time', e.target.value)} />
            </Field>
            <Field label="Jam Selesai">
              <input className={inputCls} type="time" value={scheduleForm.end_time} onChange={e => setSchedule('end_time', e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowScheduleForm(false)}>Batal</ActionButton>
            <ActionButton onClick={saveSchedule} loading={savingSchedule}>Simpan Jadwal</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={showChecklistForm} onClose={() => setShowChecklistForm(false)} title="Tambah Checklist Cleaning" width="max-w-xl">
        <div className="space-y-4">
          <Field label="Judul *">
            <input className={inputCls} value={checklistForm.title} onChange={e => setChecklist('title', e.target.value)} placeholder="cth: Sapu dan pel area court" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lapangan">
              <select className={selectCls} value={checklistForm.court_id} onChange={e => setChecklist('court_id', e.target.value)}>
                <option value="">Semua lapangan</option>
                {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal">
              <input className={inputCls} type="date" value={checklistForm.check_date} onChange={e => setChecklist('check_date', e.target.value)} />
            </Field>
            <Field label="Shift">
              <select className={selectCls} value={checklistForm.shift_label} onChange={e => setChecklist('shift_label', e.target.value)}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </Field>
            <Field label="Status Awal">
              <select className={selectCls} value={checklistForm.status} onChange={e => setChecklist('status', e.target.value)}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
              </select>
            </Field>
            <Field label="Assign Ke">
              <select className={selectCls} value={checklistForm.assigned_to} onChange={e => setChecklist('assigned_to', e.target.value)}>
                <option value="">Belum di-assign</option>
                {staffMembers.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{String(s.user_id).slice(0, 8)}… ({s.role})</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Catatan">
            <textarea className={textareaCls} rows={2} value={checklistForm.notes} onChange={e => setChecklist('notes', e.target.value)} placeholder="Opsional" />
          </Field>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowChecklistForm(false)}>Batal</ActionButton>
            <ActionButton onClick={saveChecklist} loading={savingChecklist}>Simpan Checklist</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
