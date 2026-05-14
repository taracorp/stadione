import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueMaintenancePage({ auth, venue }) {
  const venueId = venue?.id;
  const [items, setItems] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState(null);
  const [editing, setEditing] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
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
      ]);
      setItems(mRes.data || []);
      setCourts(cRes.data || []);
    } catch (err) {
      console.error('Maintenance load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }

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
        showToast('success', 'Log diperbarui');
      } else {
        const { error } = await supabase.from('venue_maintenance_logs').insert(payload);
        if (error) throw error;
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
      const upd = { status };
      if (status === 'resolved' || status === 'closed') upd.resolved_date = new Date().toISOString().slice(0, 10);
      await supabase.from('venue_maintenance_logs').update(upd).eq('id', id);
      load();
    } catch (err) { showToast('error', err.message); }
  }

  const filtered = filterStatus === 'all' ? items : items.filter(i => i.status === filterStatus);
  const openCount = items.filter(i => i.status === 'open' || i.status === 'in_progress').length;
  const urgentCount = items.filter(i => i.priority === 'urgent' && i.status !== 'resolved' && i.status !== 'closed').length;
  const courtMap = Object.fromEntries(courts.map(c => [c.id, c.name]));

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
        <ActionButton onClick={openCreate}><Plus size={14} /> Tambah Log</ActionButton>
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

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit flex-wrap">
        {[['all', 'Semua'], ['open', 'Terbuka'], ['in_progress', 'Dikerjakan'], ['resolved', 'Selesai']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilterStatus(k)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${filterStatus === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {l}
          </button>
        ))}
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
    </div>
  );
}
