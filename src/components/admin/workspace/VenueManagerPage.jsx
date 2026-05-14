import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit3, Trash2, Tag, Calendar, Check } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, inputCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const SPORTS = ['Futsal', 'Basket', 'Volley', 'Badminton', 'Tennis', 'Padel', 'Sepak Bola', 'Berenang', 'Lainnya'];
const VENUE_COLORS = ['#E11D2E', '#1D4ED8', '#059669', '#D97706', '#7C3AED', '#0284C7', '#DB2777', '#1F2937'];

const EMPTY_FORM = { name: '', city: '', sport: 'Futsal', price: '', rating: 5, color: '#E11D2E', tags: '' };

export default function VenueManagerPage({ auth, onBack, onNav }) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Bookings
  const [venueBookings, setVenueBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [tab, setTab] = useState('venues'); // venues | bookings

  const loadVenues = useCallback(async () => {
    setLoading(true);
    try {
      const { data: venueData } = await supabase.from('venues').select('id,name,city,sport,price,rating,reviews,color');
      const { data: tagData } = await supabase.from('venue_tags').select('venue_id,tag');
      const tagMap = {};
      (tagData || []).forEach((t) => {
        if (!tagMap[t.venue_id]) tagMap[t.venue_id] = [];
        tagMap[t.venue_id].push(t.tag);
      });
      setVenues((venueData || []).map((v) => ({ ...v, tags: tagMap[v.id] || [] })));
    } catch (err) {
      console.error('Venue load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const { data } = await supabase
        .from('user_venue_bookings')
        .select('id,user_id,venue_name,venue_city,booking_date,booking_time,duration_hours,sport,status,booking_created_at')
        .order('booking_created_at', { ascending: false })
        .limit(40);
      setVenueBookings(data || []);
    } catch (err) {
      console.error('Venue bookings load error:', err);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVenues();
    loadBookings();
  }, [loadVenues, loadBookings]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(venue) {
    setEditTarget(venue);
    setForm({
      name: venue.name || '',
      city: venue.city || '',
      sport: venue.sport || 'Futsal',
      price: venue.price || '',
      rating: venue.rating || 5,
      color: venue.color || '#E11D2E',
      tags: Array.isArray(venue.tags) ? venue.tags.join(', ') : '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.city.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim(),
        sport: form.sport,
        price: parseInt(form.price) || 0,
        rating: parseFloat(form.rating) || 5,
        color: form.color,
      };

      let venueId = editTarget?.id;
      if (editTarget) {
        await supabase.from('venues').update(payload).eq('id', editTarget.id);
      } else {
        const { data: latestVenue } = await supabase
          .from('venues')
          .select('id')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVenueId = Number(latestVenue?.id || 0) + 1;
        const { data } = await supabase.from('venues').insert({ id: nextVenueId, ...payload, reviews: 0 }).select('id').single();
        venueId = data?.id;
      }

      // Sync tags
      if (venueId) {
        await supabase.from('venue_tags').delete().eq('venue_id', venueId);
        const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
        if (tags.length > 0) {
          await supabase.from('venue_tags').insert(tags.map((tag) => ({ venue_id: venueId, tag })));
        }
      }

      setShowForm(false);
      loadVenues();
    } catch (err) {
      console.error('Venue save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('venue_tags').delete().eq('venue_id', deleteTarget.id);
    await supabase.from('venues').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    loadVenues();
  }

  const confirmedBookings = venueBookings.filter((b) => b.status === 'confirmed').length;

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ WORKSPACE — VENUE"
      title={<>KELOLA<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>venue.</span></>}
      subtitle="Tambah dan kelola venue olahraga serta pantau booking yang masuk."
      onBack={onBack}
      breadcrumbs={[{ label: 'Workspace', onClick: () => onNav('workspace-console') }, { label: 'Kelola Venue' }]}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit mb-6">
        {[['venues', 'Venue'], ['bookings', 'Booking']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* VENUES TAB */}
      {tab === 'venues' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Venue" value={loading ? '—' : venues.length} icon={MapPin} accent="emerald" />
            <StatCard label="Booking Confirmed" value={bookingsLoading ? '—' : confirmedBookings} icon={Calendar} accent="blue" />
            <StatCard label="Total Booking" value={bookingsLoading ? '—' : venueBookings.length} icon={Check} accent="violet" />
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="font-display text-2xl text-neutral-900">Semua Venue</div>
            <ActionButton size="sm" onClick={openCreate}><Plus size={14} /> Tambah Venue</ActionButton>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : venues.length === 0 ? (
            <EmptyState icon={MapPin} title="Belum ada venue" action={<ActionButton onClick={openCreate}><Plus size={14} /> Tambah Venue</ActionButton>} />
          ) : (
            <div className="space-y-3">
              {venues.map((v) => (
                <div key={v.id} className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: v.color || '#E11D2E' }}>
                    <MapPin size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-900">{v.name}</div>
                    <div className="text-sm text-neutral-500">{v.sport} · {v.city} · Rp {v.price?.toLocaleString('id-ID')}/jam</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {v.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600">
                          <Tag size={8} />{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(v)} className="w-8 h-8 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 flex items-center justify-center transition">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(v)} className="w-8 h-8 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* BOOKINGS TAB */}
      {tab === 'bookings' && (
        <>
          {bookingsLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : venueBookings.length === 0 ? (
            <EmptyState icon={Calendar} title="Belum ada booking" description="Booking venue akan muncul di sini." />
          ) : (
            <div className="space-y-3">
              {venueBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-neutral-900">{b.venue_name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="text-sm text-neutral-500">{b.sport} · {b.venue_city}</div>
                    <div className="text-xs text-neutral-400 mt-1">{b.booking_date} · {b.booking_time} · {b.duration_hours}jam</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* FORM MODAL */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editTarget ? 'Edit Venue' : 'Tambah Venue'}>
        <div className="space-y-4">
          <Field label="Nama Venue">
            <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama venue..." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kota">
              <input className={inputCls} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Jakarta" />
            </Field>
            <Field label="Cabang Olahraga">
              <select className={selectCls} value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}>
                {SPORTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Harga per Jam (Rp)">
              <input className={inputCls} type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="150000" />
            </Field>
            <Field label="Rating (1–5)">
              <input className={inputCls} type="number" min="1" max="5" step="0.1" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} />
            </Field>
          </div>
          <Field label="Warna Aksen">
            <div className="flex flex-wrap gap-2 mt-1">
              {VENUE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition ${form.color === c ? 'border-neutral-900 scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
          <Field label="Tags (pisah koma)" hint="Contoh: Parkir, AC, Tribun">
            <input className={inputCls} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Parkir, AC, Tribun..." />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSave} loading={saving} disabled={!form.name.trim() || !form.city.trim()}>
              <Check size={14} /> {editTarget ? 'Simpan' : 'Tambah Venue'}
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Venue?">
        <p className="text-sm text-neutral-600 mb-5">Venue <span className="font-semibold">"{deleteTarget?.name}"</span> dan semua tagnya akan dihapus.</p>
        <div className="flex justify-end gap-3">
          <ActionButton variant="outline" onClick={() => setDeleteTarget(null)}>Batal</ActionButton>
          <ActionButton variant="danger" onClick={handleDelete}><Trash2 size={14} /> Hapus</ActionButton>
        </div>
      </Modal>
    </AdminLayout>
  );
}
