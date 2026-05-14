import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileBadge2, ShieldCheck } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, StatCard, inputCls, selectCls, textareaCls } from '../AdminLayout.jsx';
import { submitVenueRegistrationRequest } from '../../../services/supabaseService.js';

const SPORTS = ['Futsal', 'Padel', 'Badminton', 'Sepak Bola', 'Mini Soccer', 'Basket', 'Tennis', 'Renang', 'Esports'];

const INITIAL_FORM = {
  name: '',
  sport: 'Futsal',
  province: '',
  city: '',
  address: '',
  contactNumber: '',
  mapsUrl: '',
  description: '',
  verificationType: 'individual',
  ktpUrl: '',
  selfieUrl: '',
  nibUrl: '',
  npwpUrl: '',
  legalitasUrl: '',
  notes: '',
};

export default function VenueRegistrationPage({ auth, onBack, onNav }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const requiredDocumentHint = useMemo(() => {
    if (form.verificationType === 'company') {
      return 'Isi URL dokumen NIB, NPWP, dan legalitas usaha untuk pengajuan perusahaan.';
    }
    return 'Isi URL dokumen KTP dan selfie dengan KTP untuk pengajuan individual.';
  }, [form.verificationType]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!auth?.id) return 'Anda harus login untuk mendaftarkan venue.';
    if (!form.name.trim()) return 'Nama venue wajib diisi.';
    if (!form.province.trim()) return 'Provinsi wajib diisi.';
    if (!form.city.trim()) return 'Kota wajib diisi.';
    if (!form.address.trim()) return 'Alamat wajib diisi.';
    if (!form.contactNumber.trim()) return 'Nomor kontak wajib diisi.';
    if (!form.mapsUrl.trim()) return 'Google Maps URL wajib diisi.';

    if (form.verificationType === 'company') {
      if (!form.nibUrl.trim() || !form.npwpUrl.trim() || !form.legalitasUrl.trim()) {
        return 'Dokumen perusahaan belum lengkap.';
      }
    } else if (!form.ktpUrl.trim() || !form.selfieUrl.trim()) {
      return 'Dokumen individual belum lengkap.';
    }

    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await submitVenueRegistrationRequest({
        ownerUserId: auth.id,
        requesterName: auth.name?.trim() || auth.email?.split('@')[0] || 'Pengguna',
        requesterEmail: auth.email?.trim() || '',
        name: form.name.trim(),
        sport: form.sport,
        province: form.province.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        contactNumber: form.contactNumber.trim(),
        mapsUrl: form.mapsUrl.trim(),
        description: form.description.trim(),
        verificationType: form.verificationType,
        ktpUrl: form.ktpUrl.trim(),
        selfieUrl: form.selfieUrl.trim(),
        nibUrl: form.nibUrl.trim(),
        npwpUrl: form.npwpUrl.trim(),
        legalitasUrl: form.legalitasUrl.trim(),
        notes: form.notes.trim(),
      });

      if (!result?.venueId) {
        setError('Gagal menyimpan registrasi venue. Coba lagi.');
        return;
      }

      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  if (!auth?.id) {
    return (
      <AdminLayout
        variant="workspace"
        kicker="/ VENUE REGISTRATION"
        title={<>DAFTAR<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>venue.</span></>}
        subtitle="Daftarkan venue Anda untuk mengaktifkan Venue OS."
        onBack={onBack}
      >
        <EmptyState
          icon={ShieldCheck}
          title="Masuk dulu"
          description="Registrasi venue hanya tersedia untuk akun yang sudah login."
          action={<ActionButton onClick={() => onNav('profile')}>Buka Profil</ActionButton>}
        />
      </AdminLayout>
    );
  }

  if (success) {
    return (
      <AdminLayout
        variant="workspace"
        kicker="/ VENUE REGISTRATION"
        title={<>REGISTRASI<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>terkirim.</span></>}
        subtitle="Venue Anda sudah masuk antrian review."
        onBack={onBack}
      >
        <div className="max-w-3xl mx-auto px-5 lg:px-8 py-10">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="font-display text-3xl text-neutral-900 mb-3">Registrasi venue berhasil dikirim</h2>
            <p className="text-neutral-600 max-w-xl mx-auto mb-6">
              Tim platform akan meninjau data venue dan dokumen Anda. Selama status masih pending,
              Venue OS tetap bisa dibuka untuk melihat status verifikasi awal.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <ActionButton onClick={() => onNav('venue-workspace')}>Buka Venue Workspace</ActionButton>
              <ActionButton variant="outline" onClick={() => onNav('workspace-console')}>Kembali ke Workspace</ActionButton>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      variant="workspace"
      kicker="/ VENUE REGISTRATION"
      title={<>DAFTAR<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>venue.</span></>}
      subtitle="Lengkapi data venue dan dokumen verifikasi untuk mengaktifkan Venue OS."
      onBack={onBack}
      breadcrumbs={[{ label: 'Workspace Console', onClick: () => onNav('workspace-console') }, { label: 'Daftar Venue' }]}
    >
      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="Pemilik" value={auth.name || 'Pengguna'} sub={auth.email || '-'} icon={ShieldCheck} accent="emerald" />
          <StatCard label="Tipe Verifikasi" value={form.verificationType === 'company' ? 'Perusahaan' : 'Individual'} icon={FileBadge2} accent="blue" />
          <StatCard label="Status Awal" value="Pending Review" icon={CheckCircle2} accent="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-6">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Data Venue</p>
              <h2 className="font-display text-3xl text-neutral-900">Profil venue</h2>
              <p className="text-sm text-neutral-500 mt-1">Isi data operasional utama venue yang akan tampil di Venue OS.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nama Venue">
                <input className={inputCls} value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Contoh: Stadione Arena Padel" />
              </Field>
              <Field label="Sport Utama">
                <select className={selectCls} value={form.sport} onChange={(event) => updateField('sport', event.target.value)}>
                  {SPORTS.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
                </select>
              </Field>
              <Field label="Provinsi">
                <input className={inputCls} value={form.province} onChange={(event) => updateField('province', event.target.value)} placeholder="DI Yogyakarta" />
              </Field>
              <Field label="Kota">
                <input className={inputCls} value={form.city} onChange={(event) => updateField('city', event.target.value)} placeholder="Sleman" />
              </Field>
            </div>

            <Field label="Alamat Lengkap">
              <textarea className={textareaCls} rows={4} value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Alamat lengkap venue" />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nomor Kontak">
                <input className={inputCls} value={form.contactNumber} onChange={(event) => updateField('contactNumber', event.target.value)} placeholder="08xxxxxxxxxx" />
              </Field>
              <Field label="Google Maps URL">
                <input className={inputCls} value={form.mapsUrl} onChange={(event) => updateField('mapsUrl', event.target.value)} placeholder="https://maps.app.goo.gl/..." />
              </Field>
            </div>

            <Field label="Deskripsi Venue" hint="Opsional, untuk catatan singkat venue.">
              <textarea className={textareaCls} rows={5} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Jelaskan fasilitas utama venue Anda" />
            </Field>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 space-y-5 h-fit">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Verifikasi</p>
              <h2 className="font-display text-3xl text-neutral-900">Dokumen</h2>
              <p className="text-sm text-neutral-500 mt-1">{requiredDocumentHint}</p>
            </div>

            <Field label="Tipe Pemilik">
              <select className={selectCls} value={form.verificationType} onChange={(event) => updateField('verificationType', event.target.value)}>
                <option value="individual">Individual</option>
                <option value="company">Perusahaan</option>
              </select>
            </Field>

            {form.verificationType === 'company' ? (
              <>
                <Field label="URL NIB"><input className={inputCls} value={form.nibUrl} onChange={(event) => updateField('nibUrl', event.target.value)} placeholder="https://..." /></Field>
                <Field label="URL NPWP"><input className={inputCls} value={form.npwpUrl} onChange={(event) => updateField('npwpUrl', event.target.value)} placeholder="https://..." /></Field>
                <Field label="URL Legalitas Usaha"><input className={inputCls} value={form.legalitasUrl} onChange={(event) => updateField('legalitasUrl', event.target.value)} placeholder="https://..." /></Field>
              </>
            ) : (
              <>
                <Field label="URL KTP"><input className={inputCls} value={form.ktpUrl} onChange={(event) => updateField('ktpUrl', event.target.value)} placeholder="https://..." /></Field>
                <Field label="URL Selfie + KTP"><input className={inputCls} value={form.selfieUrl} onChange={(event) => updateField('selfieUrl', event.target.value)} placeholder="https://..." /></Field>
              </>
            )}

            <Field label="Catatan Tambahan" hint="Opsional, akan terlihat oleh reviewer.">
              <textarea className={textareaCls} rows={4} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Contoh: venue akan buka penuh mulai bulan depan" />
            </Field>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div className="flex gap-3 flex-wrap pt-2">
              <ActionButton loading={saving} onClick={handleSubmit}>
                Kirim Registrasi
              </ActionButton>
              <ActionButton variant="outline" onClick={onBack}>
                Batal
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
