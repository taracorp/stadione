import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CircleSlash, Edit3, Grid3x3, Trash2 } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, StatusBadge, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';

const BRANCH_EMPTY = { name: '', address: '', province: '', city: '', maps_url: '', contact_number: '' };
const COURT_EMPTY = {
  branch_id: '',
  name: '',
  sport_type: 'Futsal',
  surface_type: '',
  capacity: 2,
  indoor: true,
  has_lighting: true,
  has_ac: false,
  price_per_hour: '',
  status: 'available',
  notes: '',
};

export default function VenueCourtsPage({ auth, venue }) {
  return <VenueCourtsWorkspace venue={venue} />;
}

function VenueCourtsWorkspace({ venue }) {
  const [branches, setBranches] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchForm, setBranchForm] = useState(BRANCH_EMPTY);
  const [courtForm, setCourtForm] = useState(COURT_EMPTY);
  const [savingBranch, setSavingBranch] = useState(false);
  const [savingCourt, setSavingCourt] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [editingCourt, setEditingCourt] = useState(null);

  const load = useCallback(async () => {
    if (!venue?.id || !supabase) return;

    setLoading(true);
    try {
      const [branchResult, courtResult] = await Promise.all([
        supabase.from('venue_branches').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
        supabase.from('venue_courts').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
      ]);

      setBranches(branchResult.data || []);
      setCourts(courtResult.data || []);

      if (!courtForm.branch_id && branchResult.data?.[0]?.id) {
        setCourtForm((current) => ({ ...current, branch_id: branchResult.data[0].id }));
      }
    } catch (error) {
      console.error('VenueCourtsPage load error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [venue?.id, courtForm.branch_id]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    branches: branches.length,
    courts: courts.length,
    available: courts.filter((item) => item.status === 'available').length,
  }), [branches.length, courts]);

  async function saveBranch() {
    if (!venue?.id || !branchForm.name.trim() || !branchForm.address.trim()) return;
    setSavingBranch(true);
    try {
      const payload = {
        venue_id: venue.id,
        name: branchForm.name.trim(),
        address: branchForm.address.trim(),
        province: branchForm.province.trim() || null,
        city: branchForm.city.trim() || null,
        maps_url: branchForm.maps_url.trim() || null,
        contact_number: branchForm.contact_number.trim() || null,
      };

      if (editingBranch) {
        await supabase.from('venue_branches').update(payload).eq('id', editingBranch.id);
      } else {
        await supabase.from('venue_branches').insert(payload);
      }

      setBranchForm(BRANCH_EMPTY);
      setEditingBranch(null);
      await load();
    } finally {
      setSavingBranch(false);
    }
  }

  async function saveCourt() {
    if (!venue?.id || !courtForm.name.trim() || !courtForm.branch_id) return;
    setSavingCourt(true);
    try {
      const payload = {
        venue_id: venue.id,
        branch_id: courtForm.branch_id,
        name: courtForm.name.trim(),
        sport_type: courtForm.sport_type,
        surface_type: courtForm.surface_type.trim() || null,
        capacity: Number(courtForm.capacity || 2),
        indoor: Boolean(courtForm.indoor),
        has_lighting: Boolean(courtForm.has_lighting),
        has_ac: Boolean(courtForm.has_ac),
        price_per_hour: Number(courtForm.price_per_hour || 0),
        status: courtForm.status,
        notes: courtForm.notes.trim() || null,
      };

      if (editingCourt) {
        await supabase.from('venue_courts').update(payload).eq('id', editingCourt.id);
      } else {
        await supabase.from('venue_courts').insert(payload);
      }

      setCourtForm((current) => ({ ...COURT_EMPTY, branch_id: current.branch_id || branches[0]?.id || '' }));
      setEditingCourt(null);
      await load();
    } finally {
      setSavingCourt(false);
    }
  }

  async function removeBranch(branchId) {
    await supabase.from('venue_branches').delete().eq('id', branchId);
    await load();
  }

  async function removeCourt(courtId) {
    await supabase.from('venue_courts').delete().eq('id', courtId);
    await load();
  }

  async function toggleCourtStatus(court) {
    const nextStatus = court.status === 'available' ? 'maintenance' : 'available';
    await supabase.from('venue_courts').update({ status: nextStatus }).eq('id', court.id);
    await load();
  }

  function editBranch(branch) {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name || '',
      address: branch.address || '',
      province: branch.province || '',
      city: branch.city || '',
      maps_url: branch.maps_url || '',
      contact_number: branch.contact_number || '',
    });
  }

  function editCourt(court) {
    setEditingCourt(court);
    setCourtForm({
      branch_id: court.branch_id || '',
      name: court.name || '',
      sport_type: court.sport_type || 'Futsal',
      surface_type: court.surface_type || '',
      capacity: court.capacity || 2,
      indoor: Boolean(court.indoor),
      has_lighting: Boolean(court.has_lighting),
      has_ac: Boolean(court.has_ac),
      price_per_hour: court.price_per_hour || '',
      status: court.status || 'available',
      notes: court.notes || '',
    });
  }

  if (!venue?.id) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={Building2} title="Belum ada venue" description="Daftarkan venue dulu untuk mulai mengelola branch dan court." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Lapangan</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Manajemen Branch & Court</h1>
        <p className="text-neutral-500 text-sm mt-1">Kelola cabang, lapangan, dan status operasional venue.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cabang', value: loading ? '—' : stats.branches },
          { label: 'Lapangan', value: loading ? '—' : stats.courts },
          { label: 'Available', value: loading ? '—' : stats.available },
          { label: 'Aktif', value: venue?.is_active ? 'Ya' : 'Tidak' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">{item.label}</p>
            <p className="text-3xl font-display text-neutral-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Branch</p>
              <h2 className="font-display text-2xl text-neutral-900">Cabang venue</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nama Cabang"><input className={inputCls} value={branchForm.name} onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="Kota"><input className={inputCls} value={branchForm.city} onChange={(event) => setBranchForm((current) => ({ ...current, city: event.target.value }))} /></Field>
            <Field label="Provinsi"><input className={inputCls} value={branchForm.province} onChange={(event) => setBranchForm((current) => ({ ...current, province: event.target.value }))} /></Field>
            <Field label="No Kontak"><input className={inputCls} value={branchForm.contact_number} onChange={(event) => setBranchForm((current) => ({ ...current, contact_number: event.target.value }))} /></Field>
          </div>
          <Field label="Alamat"><textarea className={textareaCls} rows={3} value={branchForm.address} onChange={(event) => setBranchForm((current) => ({ ...current, address: event.target.value }))} /></Field>
          <Field label="Google Maps URL"><input className={inputCls} value={branchForm.maps_url} onChange={(event) => setBranchForm((current) => ({ ...current, maps_url: event.target.value }))} /></Field>
          <div className="flex gap-2 flex-wrap">
            <ActionButton onClick={saveBranch} loading={savingBranch}>{editingBranch ? 'Simpan Cabang' : 'Tambah Cabang'}</ActionButton>
            {editingBranch ? <ActionButton variant="outline" onClick={() => { setEditingBranch(null); setBranchForm(BRANCH_EMPTY); }}>Batal</ActionButton> : null}
          </div>

          <div className="space-y-2 pt-2">
            {branches.length === 0 ? (
              <EmptyState icon={Building2} title="Belum ada cabang" description="Cabang venue akan muncul di sini setelah dibuat." />
            ) : branches.map((branch) => (
              <div key={branch.id} className="rounded-2xl border border-neutral-200 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-900">{branch.name}</div>
                  <div className="text-sm text-neutral-500">{branch.city || '-'} · {branch.province || '-'}</div>
                  <div className="text-xs text-neutral-400 mt-1">{branch.address}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => editBranch(branch)} className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900"><Edit3 size={14} /></button>
                  <button type="button" onClick={() => removeBranch(branch.id)} className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-red-500 text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Court</p>
              <h2 className="font-display text-2xl text-neutral-900">Lapangan venue</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Cabang">
              <select className={selectCls} value={courtForm.branch_id} onChange={(event) => setCourtForm((current) => ({ ...current, branch_id: event.target.value }))}>
                <option value="">Pilih cabang</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </Field>
            <Field label="Nama Court"><input className={inputCls} value={courtForm.name} onChange={(event) => setCourtForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="Sport Type"><input className={inputCls} value={courtForm.sport_type} onChange={(event) => setCourtForm((current) => ({ ...current, sport_type: event.target.value }))} /></Field>
            <Field label="Surface Type"><input className={inputCls} value={courtForm.surface_type} onChange={(event) => setCourtForm((current) => ({ ...current, surface_type: event.target.value }))} /></Field>
            <Field label="Kapasitas"><input className={inputCls} type="number" value={courtForm.capacity} onChange={(event) => setCourtForm((current) => ({ ...current, capacity: event.target.value }))} /></Field>
            <Field label="Harga / Jam"><input className={inputCls} type="number" value={courtForm.price_per_hour} onChange={(event) => setCourtForm((current) => ({ ...current, price_per_hour: event.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { key: 'indoor', label: 'Indoor' },
              { key: 'has_lighting', label: 'Lighting' },
              { key: 'has_ac', label: 'AC' },
            ].map((field) => (
              <label key={field.key} className="rounded-2xl border border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
                <span className="font-medium text-neutral-700">{field.label}</span>
                <input type="checkbox" checked={Boolean(courtForm[field.key])} onChange={(event) => setCourtForm((current) => ({ ...current, [field.key]: event.target.checked }))} />
              </label>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Status">
              <select className={selectCls} value={courtForm.status} onChange={(event) => setCourtForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="cleaning">Cleaning</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Catatan"><input className={inputCls} value={courtForm.notes} onChange={(event) => setCourtForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ActionButton onClick={saveCourt} loading={savingCourt}>{editingCourt ? 'Simpan Court' : 'Tambah Court'}</ActionButton>
            {editingCourt ? <ActionButton variant="outline" onClick={() => { setEditingCourt(null); setCourtForm((current) => ({ ...COURT_EMPTY, branch_id: current.branch_id || branches[0]?.id || '' })); }}>Batal</ActionButton> : null}
          </div>

          <div className="space-y-2 pt-2">
            {courts.length === 0 ? (
              <EmptyState icon={Grid3x3} title="Belum ada court" description="Lapangan venue akan muncul di sini setelah dibuat." />
            ) : courts.map((court) => {
              const branch = branches.find((item) => item.id === court.branch_id);
              return (
                <div key={court.id} className="rounded-2xl border border-neutral-200 p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-neutral-900">{court.name}</span>
                      <StatusBadge status={court.status} />
                    </div>
                    <div className="text-sm text-neutral-500">{court.sport_type} · {branch?.name || 'Tanpa cabang'}</div>
                    <div className="text-xs text-neutral-400 mt-1">Rp {Number(court.price_per_hour || 0).toLocaleString('id-ID')} / jam</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button type="button" onClick={() => toggleCourtStatus(court)} className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900"><CircleSlash size={14} /></button>
                    <button type="button" onClick={() => editCourt(court)} className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-neutral-900"><Edit3 size={14} /></button>
                    <button type="button" onClick={() => removeCourt(court.id)} className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:border-red-500 text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
