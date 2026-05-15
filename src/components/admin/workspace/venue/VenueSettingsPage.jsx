import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, MapPin, Phone, Globe, FileText, Building2, CreditCard, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { ActionButton, Field, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';
import { getDokuVenueConfig, createDokuVenueConfig } from '../../../../services/supabaseService.js';

const SPORT_OPTIONS = [
  'Futsal', 'Sepak Bola', 'Mini Soccer', 'Basket', 'Voli', 'Badminton',
  'Tenis', 'Padel', 'Tenis Meja', 'Esports', 'Multi Sport',
];

export default function VenueSettingsPage({ auth, venue }) {
  const venueId = venue?.id;
  const isOwner = auth?.role === 'owner';
  const [form, setForm] = useState({
    name: '', city: '', province: '', address: '', sport: '', price: '',
    contact_number: '', maps_url: '', description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // DOKU config state
  const [dokuForm, setDokuForm] = useState({
    doku_merchant_id: '',
    doku_client_id: '',
    doku_secret_key: '',
    environment: 'sandbox',
    is_enabled: false,
  });
  const [dokuLoading, setDokuLoading] = useState(false);
  const [dokuSaving, setDokuSaving] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const loadDokuConfig = useCallback(async () => {
    if (!venueId) return;
    setDokuLoading(true);
    try {
      const { data } = await getDokuVenueConfig(venueId);
      if (data) {
        setDokuForm({
          doku_merchant_id: data.doku_merchant_id || '',
          doku_client_id: data.doku_client_id || '',
          doku_secret_key: data.doku_secret_key || '',
          environment: data.environment || 'sandbox',
          is_enabled: data.is_enabled || false,
        });
      }
    } catch (err) {
      console.error('Error loading DOKU config:', err.message);
    } finally {
      setDokuLoading(false);
    }
  }, [venueId]);

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('name, city, province, address, sport, price, contact_number, maps_url, description')
        .eq('id', venueId)
        .single();
      if (error) throw error;
      setForm({
        name: data.name || '',
        city: data.city || '',
        province: data.province || '',
        address: data.address || '',
        sport: data.sport || '',
        price: data.price ?? '',
        contact_number: data.contact_number || '',
        maps_url: data.maps_url || '',
        description: data.description || '',
      });
    } catch (err) {
      console.error('Settings load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); loadDokuConfig(); }, [load, loadDokuConfig]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setDoku(k, v) { setDokuForm(f => ({ ...f, [k]: v })); }

  async function handleSaveDokuConfig() {
    if (!dokuForm.doku_merchant_id.trim() || !dokuForm.doku_client_id.trim() || !dokuForm.doku_secret_key.trim()) {
      showToast('error', 'Merchant ID, Client ID, dan Secret Key wajib diisi.');
      return;
    }
    setDokuSaving(true);
    try {
      const { error } = await createDokuVenueConfig(venueId, {
        ...dokuForm,
        doku_merchant_id: dokuForm.doku_merchant_id.trim(),
        doku_client_id: dokuForm.doku_client_id.trim(),
        doku_secret_key: dokuForm.doku_secret_key.trim(),
        configured_by: auth?.id,
      });
      if (error) throw new Error(error);
      showToast('success', 'Konfigurasi DOKU berhasil disimpan.');
    } catch (err) {
      showToast('error', 'Gagal menyimpan: ' + err.message);
    } finally {
      setDokuSaving(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('error', 'Nama venue tidak boleh kosong.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('venues').update({
        name: form.name.trim(),
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        address: form.address.trim() || null,
        sport: form.sport || null,
        price: form.price ? Number(form.price) : null,
        contact_number: form.contact_number.trim() || null,
        maps_url: form.maps_url.trim() || null,
        description: form.description.trim() || null,
      }).eq('id', venueId);
      if (error) throw error;
      showToast('success', 'Pengaturan venue berhasil disimpan.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <p className="text-neutral-500 text-sm">Venue belum tersedia.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 lg:px-8 py-8 space-y-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg text-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Konfigurasi</p>
        <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Pengaturan Venue</h1>
        <p className="text-neutral-500 text-sm mt-1">Informasi dasar venue Anda yang tampil ke publik.</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : (
        <>
          {/* Informasi Dasar */}
          <section className="rounded-2xl border border-neutral-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={15} className="text-emerald-600" />
              <h2 className="font-bold text-neutral-900">Informasi Dasar</h2>
            </div>
            <Field label="Nama Venue *">
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="cth: GOR Stadione Utama" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cabang Olahraga">
                <select className={selectCls} value={form.sport} onChange={e => set('sport', e.target.value)}>
                  <option value="">— Pilih Olahraga —</option>
                  {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Harga per Jam (Rp)">
                <input className={inputCls} type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="cth: 150000" />
              </Field>
            </div>
            <Field label="Deskripsi">
              <textarea className={textareaCls} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ceritakan tentang venue Anda kepada calon pelanggan..." />
            </Field>
          </section>

          {/* Lokasi */}
          <section className="rounded-2xl border border-neutral-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={15} className="text-emerald-600" />
              <h2 className="font-bold text-neutral-900">Lokasi</h2>
            </div>
            <Field label="Alamat Lengkap">
              <textarea className={textareaCls} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Jl. Contoh No. 1, Kelurahan, Kecamatan" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kota">
                <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} placeholder="cth: Jakarta Selatan" />
              </Field>
              <Field label="Provinsi">
                <input className={inputCls} value={form.province} onChange={e => set('province', e.target.value)} placeholder="cth: DKI Jakarta" />
              </Field>
            </div>
            <Field label="Link Google Maps">
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input className={`${inputCls} pl-8`} value={form.maps_url} onChange={e => set('maps_url', e.target.value)} placeholder="https://maps.google.com/..." />
              </div>
            </Field>
          </section>

          {/* Kontak */}
          <section className="rounded-2xl border border-neutral-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone size={15} className="text-emerald-600" />
              <h2 className="font-bold text-neutral-900">Kontak</h2>
            </div>
            <Field label="Nomor Telepon / WhatsApp">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input className={`${inputCls} pl-8`} value={form.contact_number} onChange={e => set('contact_number', e.target.value)} placeholder="cth: 08123456789" />
              </div>
            </Field>
          </section>

          {/* Venue ID info */}
          <section className="rounded-2xl border border-neutral-200 p-5 bg-neutral-50">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={13} className="text-neutral-400" />
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Info Sistem</span>
            </div>
            <div className="text-xs text-neutral-500 space-y-1">
              <div>ID Venue: <span className="font-mono text-neutral-700">{venueId}</span></div>
            </div>
          </section>

          <div className="flex justify-end">
            <ActionButton onClick={handleSave} loading={saving}>
              <Save size={14} /> Simpan Pengaturan
            </ActionButton>
          </div>

          {/* ─── DOKU Payment Gateway Config ─────────────────────────── */}
          <div className="pt-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Payment Gateway</p>
            <h2 className="font-display text-2xl text-neutral-900">Konfigurasi DOKU</h2>
            <p className="text-neutral-500 text-sm mt-1">Aktifkan pembayaran online melalui DOKU untuk booking venue Anda.</p>
          </div>

          {!isOwner ? (
            <section className="rounded-2xl border border-neutral-200 p-5 bg-amber-50 flex gap-3">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">Konfigurasi DOKU hanya bisa diubah oleh <strong>Owner</strong> venue.</p>
            </section>
          ) : (
            <section className="rounded-2xl border border-neutral-200 p-6 space-y-5">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-emerald-600" />
                <h3 className="font-bold text-neutral-900">Kredensial DOKU</h3>
                {dokuForm.is_enabled && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Aktif
                  </span>
                )}
              </div>

              {dokuLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-neutral-500">Memuat konfigurasi DOKU...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="DOKU Merchant ID *">
                      <input
                        className={inputCls}
                        value={dokuForm.doku_merchant_id}
                        onChange={e => setDoku('doku_merchant_id', e.target.value)}
                        placeholder="cth: MCH-XXXXXXXX"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="DOKU Client ID *">
                      <input
                        className={inputCls}
                        value={dokuForm.doku_client_id}
                        onChange={e => setDoku('doku_client_id', e.target.value)}
                        placeholder="cth: CLIENT-XXXXXXXX"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="DOKU Secret Key *">
                      <div className="relative">
                        <input
                          className={`${inputCls} pr-10`}
                          type={showSecretKey ? 'text' : 'password'}
                          value={dokuForm.doku_secret_key}
                          onChange={e => setDoku('doku_secret_key', e.target.value)}
                          placeholder="Secret key dari dashboard DOKU"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecretKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          {showSecretKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Environment">
                      <select
                        className={selectCls}
                        value={dokuForm.environment}
                        onChange={e => setDoku('environment', e.target.value)}
                      >
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </Field>
                    <Field label="Status">
                      <div className="flex items-center gap-3 h-10">
                        <button
                          type="button"
                          onClick={() => setDoku('is_enabled', !dokuForm.is_enabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            dokuForm.is_enabled ? 'bg-emerald-600' : 'bg-neutral-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              dokuForm.is_enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-sm text-neutral-700">
                          {dokuForm.is_enabled ? 'Diaktifkan' : 'Dinonaktifkan'}
                        </span>
                      </div>
                    </Field>
                  </div>

                  {dokuForm.environment === 'production' && (
                    <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">
                        Mode <strong>Production</strong> akan memproses pembayaran nyata. Pastikan semua kredensial sudah terverifikasi di dashboard DOKU.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <ActionButton onClick={handleSaveDokuConfig} loading={dokuSaving}>
                      <Save size={14} /> Simpan Konfigurasi DOKU
                    </ActionButton>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
