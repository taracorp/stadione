import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, MapPin, Phone, Globe, FileText, Building2 } from 'lucide-react';
import { ActionButton, Field, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';
import { getDokuVenueConfig, saveDokuVenueConfig } from '../../../../services/supabaseService.js';

const SPORT_OPTIONS = [
  'Futsal', 'Sepak Bola', 'Mini Soccer', 'Basket', 'Voli', 'Badminton',
  'Tenis', 'Padel', 'Tenis Meja', 'Esports', 'Multi Sport',
];

export default function VenueSettingsPage({ auth, venue }) {
  const venueId = venue?.id;
  const [form, setForm] = useState({
    name: '', city: '', province: '', address: '', sport: '', price: '',
    contact_number: '', maps_url: '', description: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dokuConfig, setDokuConfig] = useState({
    environment: 'sandbox',
    business_id: '',
    brand_id: '',
    merchant_id: '',
    api_key: '',
    client_id: '',
    secret_key: '',
    doku_public_key: '',
    merchant_public_key: '',
    checkout_base_url: '',
  });
  const [dokuSaving, setDokuSaving] = useState(false);
  const [dokuLoading, setDokuLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

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

      const dokuResponse = await getDokuVenueConfig(venueId);
      if (!dokuResponse.error && dokuResponse.data) {
        setDokuConfig({
          environment: dokuResponse.data.environment || 'sandbox',
          business_id: dokuResponse.data.business_id || '',
          brand_id: dokuResponse.data.brand_id || '',
          merchant_id: dokuResponse.data.merchant_id || '',
          api_key: dokuResponse.data.api_key || '',
          client_id: dokuResponse.data.client_id || '',
          secret_key: dokuResponse.data.secret_key || '',
          doku_public_key: dokuResponse.data.doku_public_key || '',
          merchant_public_key: dokuResponse.data.merchant_public_key || '',
          checkout_base_url: dokuResponse.data.checkout_base_url || '',
        });
      }
    } catch (err) {
      console.error('Settings load error:', err.message);
    } finally {
      setLoading(false);
      setDokuLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const normalizedDokuConfig = {
    environment: dokuConfig.environment === 'production' ? 'production' : 'sandbox',
    business_id: String(dokuConfig.business_id || '').trim(),
    brand_id: String(dokuConfig.brand_id || '').trim(),
    merchant_id: String(dokuConfig.merchant_id || '').trim(),
    api_key: String(dokuConfig.api_key || '').trim(),
    client_id: String(dokuConfig.client_id || '').trim(),
    secret_key: String(dokuConfig.secret_key || '').trim(),
    doku_public_key: String(dokuConfig.doku_public_key || '').trim(),
    merchant_public_key: String(dokuConfig.merchant_public_key || '').trim(),
    checkout_base_url: String(dokuConfig.checkout_base_url || '').trim(),
  };

  const dokuMissingFields = [];
  if (!normalizedDokuConfig.checkout_base_url) dokuMissingFields.push('Checkout Base URL');
  if (normalizedDokuConfig.environment === 'production') {
    if (!normalizedDokuConfig.business_id) dokuMissingFields.push('Business ID');
    if (!normalizedDokuConfig.brand_id) dokuMissingFields.push('Brand ID');
    if (!normalizedDokuConfig.merchant_id) dokuMissingFields.push('Merchant ID');
    if (!normalizedDokuConfig.api_key) dokuMissingFields.push('API Key');
    if (!normalizedDokuConfig.client_id) dokuMissingFields.push('Client ID');
    if (!normalizedDokuConfig.secret_key) dokuMissingFields.push('Secret Key');
  }

  const dokuConfigReady = dokuMissingFields.length === 0;

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

  async function handleSaveDokuConfig() {
    if (!normalizedDokuConfig.checkout_base_url) {
      showToast('error', 'Checkout Base URL wajib diisi.');
      return;
    }

    if (!/^https?:\/\//i.test(normalizedDokuConfig.checkout_base_url)) {
      showToast('error', 'Checkout Base URL harus berupa URL valid (http/https).');
      return;
    }

    if (normalizedDokuConfig.environment === 'production' && dokuMissingFields.length > 0) {
      showToast('error', `Konfigurasi production belum lengkap: ${dokuMissingFields.join(', ')}.`);
      return;
    }

    setDokuSaving(true);
    try {
      const response = await saveDokuVenueConfig(venueId, normalizedDokuConfig);
      if (response.error) throw new Error(response.error);
      showToast('success', 'Konfigurasi DOKU berhasil disimpan.');
    } catch (err) {
      showToast('error', err.message || 'Gagal menyimpan konfigurasi DOKU.');
    } finally {
      setDokuSaving(false);
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

          {/* DOKU Payment Gateway */}
          <section className="rounded-2xl border border-neutral-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={15} className="text-emerald-600" />
              <h2 className="font-bold text-neutral-900">DOKU Payment Gateway</h2>
              <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${dokuConfigReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {dokuConfigReady ? 'Ready' : 'Perlu Dilengkapi'}
              </span>
            </div>
            {dokuLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => <div key={index} className="h-12 rounded-2xl bg-neutral-100 animate-pulse" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Business ID">
                    <input className={inputCls} value={dokuConfig.business_id} onChange={e => setDokuConfig(c => ({ ...c, business_id: e.target.value }))} placeholder="BSN-..." />
                  </Field>
                  <Field label="Brand ID">
                    <input className={inputCls} value={dokuConfig.brand_id} onChange={e => setDokuConfig(c => ({ ...c, brand_id: e.target.value }))} placeholder="BRN-..." />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Environment">
                    <select className={selectCls} value={dokuConfig.environment} onChange={e => setDokuConfig(c => ({ ...c, environment: e.target.value }))}>
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </Field>
                  <Field label="Merchant ID">
                    <input className={inputCls} value={dokuConfig.merchant_id} onChange={e => setDokuConfig(c => ({ ...c, merchant_id: e.target.value }))} placeholder="Merchant ID" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="API Key">
                    <input className={inputCls} value={dokuConfig.api_key} onChange={e => setDokuConfig(c => ({ ...c, api_key: e.target.value }))} placeholder="doku_key_..." />
                  </Field>
                  <Field label="Client ID">
                    <input className={inputCls} value={dokuConfig.client_id} onChange={e => setDokuConfig(c => ({ ...c, client_id: e.target.value }))} placeholder="Client ID" />
                  </Field>
                  <Field label="Secret Key">
                    <input type="password" className={inputCls} value={dokuConfig.secret_key} onChange={e => setDokuConfig(c => ({ ...c, secret_key: e.target.value }))} placeholder="Secret Key" />
                  </Field>
                </div>
                <Field label="DOKU Public Key">
                  <textarea
                    className={textareaCls}
                    rows={4}
                    value={dokuConfig.doku_public_key}
                    onChange={e => setDokuConfig(c => ({ ...c, doku_public_key: e.target.value }))}
                    placeholder="-----BEGIN PUBLIC KEY-----"
                  />
                </Field>
                <Field label="Merchant Public Key">
                  <textarea
                    className={textareaCls}
                    rows={4}
                    value={dokuConfig.merchant_public_key}
                    onChange={e => setDokuConfig(c => ({ ...c, merchant_public_key: e.target.value }))}
                    placeholder="-----BEGIN PUBLIC KEY-----"
                  />
                </Field>
                <Field label="DOKU Checkout API URL">
                  <input className={inputCls} value={dokuConfig.checkout_base_url} onChange={e => setDokuConfig(c => ({ ...c, checkout_base_url: e.target.value }))} placeholder="https://api-sandbox.doku.com/checkout/v2/payment-url" />
                </Field>
                {!dokuConfigReady && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Lengkapi field: {dokuMissingFields.join(', ')}
                  </div>
                )}
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Webhook endpoint function: <span className="font-mono">doku-webhook-handler</span>
                </div>
                <div className="flex justify-end">
                  <ActionButton onClick={handleSaveDokuConfig} loading={dokuSaving}>
                    <Save size={14} /> Simpan Konfigurasi DOKU
                  </ActionButton>
                </div>
              </>
            )}
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
        </>
      )}
    </div>
  );
}
