import React, { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, ShieldCheck, Shield, User, AlertTriangle } from 'lucide-react';
import { ActionButton, EmptyState, Field, Modal, inputCls, selectCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', cashier: 'Kasir', staff: 'Staf' };
const STATUS_LABELS = { active: 'Aktif', suspended: 'Ditangguhkan', disabled: 'Dinonaktifkan', archived: 'Diarsipkan' };

const ROLE_ICON = { owner: ShieldCheck, manager: Shield, cashier: User, staff: User };

function RoleBadge({ role }) {
  const cls = {
    owner: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    cashier: 'bg-yellow-100 text-yellow-700',
    staff: 'bg-neutral-100 text-neutral-600',
  };
  const Icon = ROLE_ICON[role] || User;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${cls[role] || cls.staff}`}>
      <Icon size={10} />{ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusDot({ status }) {
  const cls = { active: 'bg-emerald-500', suspended: 'bg-yellow-500', disabled: 'bg-red-500', archived: 'bg-neutral-400' };
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      <span className={`w-1.5 h-1.5 rounded-full ${cls[status] || 'bg-neutral-400'}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueStaffPage({ auth, venue }) {
  const venueId = venue?.id;
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editRole, setEditRole] = useState('staff');
  const [editStatus, setEditStatus] = useState('active');
  const [editLoading, setEditLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [filterStatus, setFilterStatus] = useState('active');

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_staff')
        .select('*')
        .eq('venue_id', venueId)
        .order('invited_at', { ascending: false });
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error('Staff load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      // Look up user_id from email via RPC
      const { data, error: lookupErr } = await supabase.rpc('find_user_id_by_email', { p_email: inviteEmail.trim() });
      if (lookupErr) throw lookupErr;
      if (!data || data.length === 0) {
        showToast('error', 'Pengguna dengan email tersebut tidak ditemukan. Pastikan mereka sudah mendaftar di Stadione.');
        setInviteLoading(false);
        return;
      }
      const { user_id } = data[0];

      // Check already a staff member
      const exists = staff.find(s => s.user_id === user_id);
      if (exists) {
        showToast('error', 'Pengguna ini sudah terdaftar sebagai staf di venue ini.');
        setInviteLoading(false);
        return;
      }

      const { error: insertErr } = await supabase.from('venue_staff').insert({
        venue_id: venueId,
        user_id,
        role: inviteRole,
        status: 'active',
        invited_by: auth?.id || null,
      });
      if (insertErr) throw insertErr;

      showToast('success', `Staf berhasil ditambahkan dengan peran ${ROLE_LABELS[inviteRole]}.`);
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('staff');
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setInviteLoading(false);
    }
  }

  function openEdit(member) {
    setEditing(member);
    setEditRole(member.role);
    setEditStatus(member.status);
    setShowEdit(true);
  }

  async function handleEditSave() {
    if (!editing) return;
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('venue_staff')
        .update({ role: editRole, status: editStatus })
        .eq('id', editing.id);
      if (error) throw error;
      showToast('success', 'Data staf diperbarui.');
      setShowEdit(false);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setEditLoading(false);
    }
  }

  const filtered = filterStatus === 'all' ? staff : staff.filter(s => s.status === filterStatus);
  const activeCount = staff.filter(s => s.status === 'active').length;
  const suspCount = staff.filter(s => s.status === 'suspended').length;

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={UserCog} title="Belum ada venue" description="Daftarkan venue terlebih dahulu." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg text-sm max-w-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Staf</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Manajemen Staf</h1>
          <p className="text-neutral-500 text-sm mt-1">Kelola akses dan peran tim operasional venue.</p>
        </div>
        <ActionButton onClick={() => setShowInvite(true)}><Plus size={14} /> Tambah Staf</ActionButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Staf</div>
          <div className="text-2xl font-bold text-neutral-900">{staff.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Aktif</div>
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Ditangguhkan</div>
          <div className={`text-2xl font-bold ${suspCount > 0 ? 'text-yellow-600' : 'text-neutral-900'}`}>{suspCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Manager</div>
          <div className="text-2xl font-bold text-neutral-900">{staff.filter(s => s.role === 'manager').length}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit flex-wrap">
        {[['active', 'Aktif'], ['suspended', 'Ditangguhkan'], ['all', 'Semua']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilterStatus(k)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${filterStatus === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Staff list */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserCog} title="Belum ada staf" description="Tambahkan anggota tim yang sudah mendaftar di Stadione." action={<ActionButton onClick={() => setShowInvite(true)}><Plus size={14} /> Tambah Staf</ActionButton>} />
      ) : (
        <div className="rounded-2xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wide">User ID</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wide">Peran</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wide">Ditambahkan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(member => (
                <tr key={member.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400">
                        <User size={14} />
                      </div>
                      <span className="font-mono text-xs text-neutral-500 truncate max-w-[120px]">{member.user_id?.slice(0, 8)}…</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={member.role} /></td>
                  <td className="px-4 py-3"><StatusDot status={member.status} /></td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{fmtDate(member.invited_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(member)} className="text-xs text-emerald-600 hover:underline font-semibold">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Tambah Anggota Staf">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Pengguna harus sudah memiliki akun di Stadione sebelum dapat ditambahkan sebagai staf.
          </div>
          <Field label="Email Pengguna *">
            <input className={inputCls} type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@contoh.com" />
          </Field>
          <Field label="Peran">
            <select className={selectCls} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="manager">Manager</option>
              <option value="cashier">Kasir</option>
              <option value="staff">Staf</option>
            </select>
          </Field>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowInvite(false)}>Batal</ActionButton>
            <ActionButton onClick={handleInvite} loading={inviteLoading}>Tambah Staf</ActionButton>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Staf">
        <div className="space-y-4">
          <Field label="Peran">
            <select className={selectCls} value={editRole} onChange={e => setEditRole(e.target.value)}>
              <option value="manager">Manager</option>
              <option value="cashier">Kasir</option>
              <option value="staff">Staf</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={selectCls} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowEdit(false)}>Batal</ActionButton>
            <ActionButton onClick={handleEditSave} loading={editLoading}>Simpan</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
