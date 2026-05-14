import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit3, Trash2, UserCheck, UserX, Calendar, MessageSquare, Check } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, inputCls, textareaCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const SPORTS = ['Futsal', 'Basket', 'Volley', 'Badminton', 'Tennis', 'Padel', 'Sepak Bola', 'Lainnya'];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
const ACTIVITY_LEVELS = ['Low', 'Medium', 'High', 'Very High'];
const COMMUNITY_TYPES = ['Public', 'Private', 'Invite Only'];

const EMPTY_FORM = { name: '', sport: 'Futsal', city: '', province: '', tagline: '', skill_level: 'All Levels', activity_level: 'Medium', community_type: 'Public' };

export default function CommunityManagerPage({ auth, onBack, onNav }) {
  const [tab, setTab] = useState('list'); // list | members | events | posts
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Selected community for details tabs
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sport_communities')
        .select('id,name,sport,city,province,members_count,activity_level,skill_level,community_type,tagline,verified,created_at')
        .order('created_at', { ascending: false });
      setCommunities(data || []);
    } catch (err) {
      console.error('Community manager load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectCommunity(community) {
    setSelected(community);
    setTab('members');
    setDetailLoading(true);
    try {
      const [{ data: m }, { data: ev }, { data: p }] = await Promise.all([
        supabase.from('community_memberships').select('id,user_id,joined_at').eq('community_id', community.id).order('joined_at', { ascending: false }),
        supabase.from('community_events').select('id,title,description,event_type,status,event_date,time_label,location,attendees_count').eq('community_id', community.id).order('event_date', { ascending: false }),
        supabase.from('community_feed_posts').select('id,author_name,author_role,content,likes_count,comments_count,created_at').eq('community_id', community.id).order('created_at', { ascending: false }).limit(20),
      ]);
      setMembers(m || []);
      setEvents(ev || []);
      setPosts(p || []);
    } catch (err) {
      console.error('Community detail load error:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(community) {
    setEditTarget(community);
    setForm({
      name: community.name || '',
      sport: community.sport || 'Futsal',
      city: community.city || '',
      province: community.province || '',
      tagline: community.tagline || '',
      skill_level: community.skill_level || 'All Levels',
      activity_level: community.activity_level || 'Medium',
      community_type: community.community_type || 'Public',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.city.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sport: form.sport,
        city: form.city.trim(),
        province: form.province.trim(),
        tagline: form.tagline.trim() || null,
        skill_level: form.skill_level,
        activity_level: form.activity_level,
        community_type: form.community_type,
        updated_at: new Date().toISOString(),
      };
      if (editTarget) {
        await supabase.from('sport_communities').update(payload).eq('id', editTarget.id);
      } else {
        await supabase.from('sport_communities').insert({ ...payload, members_count: 0 });
      }
      setShowForm(false);
      load();
    } catch (err) {
      console.error('Community save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('sport_communities').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  async function removeMember(memberId) {
    await supabase.from('community_memberships').delete().eq('id', memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setSelected((s) => s ? { ...s, members_count: Math.max(0, s.members_count - 1) } : s);
  }

  async function deletePost(postId) {
    await supabase.from('community_feed_posts').delete().eq('id', postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ WORKSPACE — KOMUNITAS"
      title={<>KELOLA<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>komunitas.</span></>}
      subtitle="Buat dan kelola komunitas olahraga, anggota, event, dan konten feed."
      onBack={onBack}
      breadcrumbs={[{ label: 'Workspace', onClick: () => onNav('workspace-console') }, { label: 'Kelola Komunitas' }]}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Komunitas" value={loading ? '—' : communities.length} icon={Users} accent="emerald" />
        <StatCard label="Total Anggota" value={loading ? '—' : communities.reduce((s, c) => s + (c.members_count || 0), 0).toLocaleString()} icon={UserCheck} accent="blue" />
        <StatCard label="Komunitas Verified" value={loading ? '—' : communities.filter((c) => c.verified).length} icon={Check} accent="violet" />
      </div>

      {/* List header */}
      <div className="flex items-center justify-between mb-5">
        <div className="font-display text-2xl text-neutral-900">
          {selected ? (
            <span>
              <button onClick={() => { setSelected(null); setTab('list'); }} className="text-neutral-400 hover:text-neutral-900 transition">Komunitas</button>
              <span className="text-neutral-300 mx-2">/</span>
              {selected.name}
            </span>
          ) : 'Semua Komunitas'}
        </div>
        {!selected && (
          <ActionButton size="sm" onClick={openCreate}>
            <Plus size={14} /> Buat Komunitas
          </ActionButton>
        )}
      </div>

      {!selected ? (
        /* Community list */
        loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
        ) : communities.length === 0 ? (
          <EmptyState icon={Users} title="Belum ada komunitas" action={<ActionButton onClick={openCreate}><Plus size={14} /> Buat Komunitas</ActionButton>} />
        ) : (
          <div className="space-y-3">
            {communities.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => selectCommunity(c)}>
                  <div className="font-semibold text-neutral-900">{c.name}</div>
                  <div className="text-sm text-neutral-500">{c.sport} · {c.city} · {c.members_count} anggota</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{c.activity_level} activity · {c.skill_level}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 flex items-center justify-center transition">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(c)} className="w-8 h-8 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Detail tabs */
        <>
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit mb-6">
            {[['members', 'Anggota'], ['events', 'Event'], ['posts', 'Postingan']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
                {label}
              </button>
            ))}
          </div>

          {detailLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
          ) : (
            <>
              {/* Members */}
              {tab === 'members' && (
                members.length === 0 ? <EmptyState icon={Users} title="Belum ada anggota" /> : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl border border-neutral-200 bg-white">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">U</div>
                        <div className="flex-1 text-sm">
                          <span className="font-semibold text-neutral-800">User {m.user_id?.slice(0, 8)}</span>
                          <span className="text-neutral-400 ml-2">Bergabung {new Date(m.joined_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <button onClick={() => removeMember(m.id)} className="w-7 h-7 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-500 flex items-center justify-center">
                          <UserX size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Events */}
              {tab === 'events' && (
                events.length === 0 ? <EmptyState icon={Calendar} title="Belum ada event" /> : (
                  <div className="space-y-3">
                    {events.map((ev) => (
                      <div key={ev.id} className="p-4 rounded-2xl border border-neutral-200 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-neutral-900">{ev.title}</div>
                            <div className="text-sm text-neutral-500 mt-0.5">{ev.event_type} · {ev.location}</div>
                            <div className="text-xs text-neutral-400 mt-1">{ev.event_date} · {ev.time_label} · {ev.attendees_count} peserta</div>
                          </div>
                          <StatusBadge status={ev.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Posts */}
              {tab === 'posts' && (
                posts.length === 0 ? <EmptyState icon={MessageSquare} title="Belum ada postingan" /> : (
                  <div className="space-y-3">
                    {posts.map((p) => (
                      <div key={p.id} className="p-4 rounded-2xl border border-neutral-200 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-neutral-900 text-sm">{p.author_name}</span>
                              <span className="text-xs text-neutral-400">{p.author_role}</span>
                            </div>
                            <div className="text-sm text-neutral-700 leading-relaxed line-clamp-3">{p.content}</div>
                            <div className="text-xs text-neutral-400 mt-1">❤ {p.likes_count} · 💬 {p.comments_count}</div>
                          </div>
                          <button onClick={() => deletePost(p.id)} className="w-7 h-7 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-500 flex items-center justify-center shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </>
      )}

      {/* FORM MODAL */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editTarget ? 'Edit Komunitas' : 'Buat Komunitas'}>
        <div className="space-y-4">
          <Field label="Nama Komunitas">
            <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama komunitas..." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Cabang Olahraga">
              <select className={selectCls} value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}>
                {SPORTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Tipe">
              <select className={selectCls} value={form.community_type} onChange={(e) => setForm((f) => ({ ...f, community_type: e.target.value }))}>
                {COMMUNITY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kota">
              <input className={inputCls} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Jakarta" />
            </Field>
            <Field label="Provinsi">
              <input className={inputCls} value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} placeholder="DKI Jakarta" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Skill Level">
              <select className={selectCls} value={form.skill_level} onChange={(e) => setForm((f) => ({ ...f, skill_level: e.target.value }))}>
                {SKILL_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Activity Level">
              <select className={selectCls} value={form.activity_level} onChange={(e) => setForm((f) => ({ ...f, activity_level: e.target.value }))}>
                {ACTIVITY_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Tagline">
            <input className={inputCls} value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="Tagline singkat komunitas..." />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSave} loading={saving} disabled={!form.name.trim() || !form.city.trim()}>
              <Check size={14} /> {editTarget ? 'Simpan' : 'Buat Komunitas'}
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Komunitas?">
        <p className="text-sm text-neutral-600 mb-5">Komunitas <span className="font-semibold">"{deleteTarget?.name}"</span> akan dihapus permanen.</p>
        <div className="flex justify-end gap-3">
          <ActionButton variant="outline" onClick={() => setDeleteTarget(null)}>Batal</ActionButton>
          <ActionButton variant="danger" onClick={handleDelete}><Trash2 size={14} /> Hapus</ActionButton>
        </div>
      </Modal>
    </AdminLayout>
  );
}
