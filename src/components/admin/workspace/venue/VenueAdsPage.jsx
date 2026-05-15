import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Tag, Copy, Check, ToggleLeft, ToggleRight, Sparkles, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ActionButton, EmptyState, Field, Modal, inputCls, selectCls, textareaCls } from '../../AdminLayout.jsx';
import { supabase } from '../../../../config/supabase.js';
import { fetchAdAnalyticsSummary, fetchAdAnalyticsDaily } from '../../../../services/supabaseService.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDiscount(promo) {
  if (promo.discount_type === 'percent') return `${promo.discount_value}%`;
  return `Rp ${Number(promo.discount_value).toLocaleString('id-ID')}`;
}

const APPLIES_LABELS = { all: 'Semua Pelanggan', member_only: 'Member Saja', new_customer: 'Pelanggan Baru' };

const PLACEMENT_CHANNELS = [
  { key: 'regional_highlight', label: 'Regional Highlight', description: 'Tampil pada rekomendasi wilayah kota.' },
  { key: 'featured_listing', label: 'Featured Listing', description: 'Prioritas di daftar venue booking.' },
  { key: 'homepage_banner', label: 'Homepage Banner', description: 'Slot banner pada halaman utama.' },
  { key: 'search_promoted', label: 'Search Promoted', description: 'Dorong posisi di hasil pencarian.' },
  { key: 'booking_page_top', label: 'Booking Page Top', description: 'Posisi atas pada halaman booking.' },
];

const ADS_PACKAGE_CATALOG = {
  Bronze: {
    tier: 'Bronze',
    monthly_fee_idr: 500000,
    placement_scope: ['regional_highlight'],
    ctr_target_percent: 2,
    description: 'Boost visibilitas regional untuk venue Anda.',
  },
  Silver: {
    tier: 'Silver',
    monthly_fee_idr: 1500000,
    placement_scope: ['featured_listing', 'regional_highlight'],
    ctr_target_percent: 4,
    description: 'Masuk listing featured dengan eksposur lebih tinggi.',
  },
  Gold: {
    tier: 'Gold',
    monthly_fee_idr: 3000000,
    placement_scope: ['homepage_banner', 'featured_listing', 'regional_highlight'],
    ctr_target_percent: 6,
    description: 'Prioritas homepage banner untuk jangkauan maksimal.',
  },
  Platinum: {
    tier: 'Platinum',
    monthly_fee_idr: 5000000,
    placement_scope: ['multi_placement', 'homepage_banner', 'search_promoted', 'regional_highlight'],
    ctr_target_percent: 10,
    description: 'Paket premium dengan multi-placement dan prioritas tertinggi.',
  },
};

const EMPTY_FORM = {
  title: '', description: '', promo_code: '', discount_type: 'percent', discount_value: '',
  min_booking_hours: 1, max_discount_idr: '', valid_from: '', valid_until: '',
  usage_limit: '', applies_to: 'all', is_active: true,
};

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VenueAdsPage({ auth, venue }) {
  const venueId = venue?.id;
  const [promos, setPromos] = useState([]);
  const [adSubscriptions, setAdSubscriptions] = useState([]);
  const [venueProfile, setVenueProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(null);
  const [filterActive, setFilterActive] = useState('all');
  const [buyingTier, setBuyingTier] = useState('');
  const [savingFeatured, setSavingFeatured] = useState(false);
  const [savingPlacement, setSavingPlacement] = useState(false);
  const [placementDraft, setPlacementDraft] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState([]);
  const [analyticsDaily, setAnalyticsDaily] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [promoRes, packageRes, venueRes] = await Promise.all([
        supabase
          .from('venue_promotions')
          .select('*')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false }),
        supabase
          .from('venue_ad_subscriptions')
          .select('*')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false }),
        supabase
          .from('venues')
          .select('id, is_featured, is_sponsored, featured_priority, featured_badge_label, featured_until')
          .eq('id', venueId)
          .maybeSingle(),
      ]);

      if (promoRes.error) throw promoRes.error;
      if (packageRes.error) throw packageRes.error;
      if (venueRes.error) throw venueRes.error;

      setPromos(promoRes.data || []);
      setAdSubscriptions(packageRes.data || []);
      setVenueProfile(venueRes.data || null);

      // Load analytics data
      setLoadingAnalytics(true);
      const summary = await fetchAdAnalyticsSummary(venueId);
      const daily = await fetchAdAnalyticsDaily(venueId);
      setAnalyticsSummary(summary || []);
      setAnalyticsDaily(daily || []);
      setLoadingAnalytics(false);
    } catch (err) {
      console.error('Promos/ads load error:', err.message);
      showToast('error', err.message);
      setLoadingAnalytics(false);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const topPackage = adSubscriptions.find((row) => row.status === 'active' || row.status === 'pending_approval');
    setPlacementDraft(Array.isArray(topPackage?.placement_scope) ? topPackage.placement_scope : []);
  }, [adSubscriptions]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, promo_code: randomCode() });
    setShowForm(true);
  }

  function openEdit(promo) {
    setEditing(promo);
    setForm({
      title: promo.title || '',
      description: promo.description || '',
      promo_code: promo.promo_code || '',
      discount_type: promo.discount_type || 'percent',
      discount_value: promo.discount_value ?? '',
      min_booking_hours: promo.min_booking_hours ?? 1,
      max_discount_idr: promo.max_discount_idr ?? '',
      valid_from: promo.valid_from || '',
      valid_until: promo.valid_until || '',
      usage_limit: promo.usage_limit ?? '',
      applies_to: promo.applies_to || 'all',
      is_active: promo.is_active ?? true,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.discount_value) return;
    setSaving(true);
    try {
      const payload = {
        venue_id: venueId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        promo_code: form.promo_code.trim().toUpperCase() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_booking_hours: Number(form.min_booking_hours) || 1,
        max_discount_idr: form.max_discount_idr ? Number(form.max_discount_idr) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        applies_to: form.applies_to,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('venue_promotions').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('success', 'Promo diperbarui.');
      } else {
        const { error } = await supabase.from('venue_promotions').insert(payload);
        if (error) throw error;
        showToast('success', 'Promo berhasil dibuat.');
      }
      setShowForm(false);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo) {
    try {
      await supabase.from('venue_promotions').update({ is_active: !promo.is_active }).eq('id', promo.id);
      load();
    } catch (err) { showToast('error', err.message); }
  }

  async function activatePackage(tier) {
    if (!venueId || !ADS_PACKAGE_CATALOG[tier]) return;

    const selected = ADS_PACKAGE_CATALOG[tier];
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    setBuyingTier(tier);
    try {
      const payload = {
        venue_id: venueId,
        package_tier: selected.tier.toLowerCase(),
        monthly_fee_idr: selected.monthly_fee_idr,
        placement_scope: selected.placement_scope,
        ctr_target_percent: selected.ctr_target_percent,
        status: 'pending_approval',
        starts_at: start.toISOString().slice(0, 10),
        ends_at: end.toISOString().slice(0, 10),
        created_by: auth?.id || null,
      };

      const { error } = await supabase.from('venue_ad_subscriptions').insert(payload);
      if (error) throw error;

      showToast('success', `Paket ${selected.tier} diajukan dan menunggu approval admin.`);
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBuyingTier('');
    }
  }

  function priorityByTier(tier) {
    const tierNormalized = String(tier || '').toLowerCase();
    if (tierNormalized === 'platinum') return 100;
    if (tierNormalized === 'gold') return 80;
    if (tierNormalized === 'silver') return 60;
    return 40;
  }

  function resolveAllowedScopesByTier(tier) {
    const tierKey = String(tier || '').toLowerCase();
    if (!tierKey) return [];
    const catalog = Object.values(ADS_PACKAGE_CATALOG).find((item) => item.tier.toLowerCase() === tierKey);
    if (!catalog) return [];
    const rawScopes = Array.isArray(catalog.placement_scope) ? catalog.placement_scope : [];
    if (rawScopes.includes('multi_placement')) {
      return PLACEMENT_CHANNELS.map((item) => item.key);
    }
    return rawScopes.filter((scope) => scope !== 'multi_placement');
  }

  function buildPlacementMetadata(scopes = [], packageTier = null) {
    const scopeSet = new Set(scopes || []);
    const tierLabel = packageTier
      ? `${String(packageTier).charAt(0).toUpperCase()}${String(packageTier).slice(1).toLowerCase()}`
      : null;
    return {
      is_featured: scopeSet.has('featured_listing') || scopeSet.has('homepage_banner') || scopeSet.has('search_promoted') || scopeSet.has('booking_page_top'),
      is_sponsored: scopeSet.has('homepage_banner') || scopeSet.has('search_promoted') || scopeSet.has('booking_page_top'),
      featured_priority: scopeSet.size > 0 ? priorityByTier(packageTier) : 0,
      featured_badge_label: scopeSet.size > 0 ? `Featured ${tierLabel || 'Venue'}` : 'Featured Venue',
    };
  }

  async function updateFeaturedPlacement(enabled) {
    if (!venueId) return;
    setSavingFeatured(true);
    try {
      const topPackage = adSubscriptions.find((row) => row.status === 'active' || row.status === 'pending_approval');
      const metadata = buildPlacementMetadata(enabled ? placementDraft : [], topPackage?.package_tier);

      const { error } = await supabase
        .from('venues')
        .update({
          is_featured: enabled ? metadata.is_featured : false,
          is_sponsored: enabled ? metadata.is_sponsored : false,
          featured_priority: enabled ? metadata.featured_priority : 0,
          featured_badge_label: enabled ? metadata.featured_badge_label : 'Featured Venue',
          featured_until: enabled ? (topPackage?.ends_at || null) : null,
        })
        .eq('id', venueId);

      if (error) throw error;
      showToast('success', enabled ? 'Featured badge aktif dan placement diprioritaskan.' : 'Featured badge dinonaktifkan.');
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingFeatured(false);
    }
  }

  async function savePlacementScopes() {
    const topPackage = adSubscriptions.find((row) => row.status === 'active' || row.status === 'pending_approval');
    if (!topPackage?.id) {
      showToast('error', 'Belum ada paket ads aktif/pending untuk dikonfigurasi.');
      return;
    }

    const allowedScopes = new Set(resolveAllowedScopesByTier(topPackage.package_tier));
    const sanitizedScopes = placementDraft.filter((scope) => allowedScopes.has(scope));
    const metadata = buildPlacementMetadata(sanitizedScopes, topPackage.package_tier);

    setSavingPlacement(true);
    try {
      const { error: subError } = await supabase
        .from('venue_ad_subscriptions')
        .update({ placement_scope: sanitizedScopes })
        .eq('id', topPackage.id);
      if (subError) throw subError;

      const { error: venueError } = await supabase
        .from('venues')
        .update({
          is_featured: metadata.is_featured,
          is_sponsored: metadata.is_sponsored,
          featured_priority: metadata.featured_priority,
          featured_badge_label: metadata.featured_badge_label,
          featured_until: topPackage.ends_at || null,
        })
        .eq('id', venueId);
      if (venueError) throw venueError;

      showToast('success', 'Konfigurasi placement berhasil disimpan.');
      load();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingPlacement(false);
    }
  }

  function togglePlacementScope(scopeKey) {
    setPlacementDraft((current) => {
      if (current.includes(scopeKey)) return current.filter((item) => item !== scopeKey);
      return [...current, scopeKey];
    });
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function isExpired(promo) {
    if (!promo.valid_until) return false;
    return new Date(promo.valid_until) < new Date();
  }

  const now = new Date();
  const filtered = promos.filter(p => {
    if (filterActive === 'active') return p.is_active && !isExpired(p);
    if (filterActive === 'inactive') return !p.is_active || isExpired(p);
    return true;
  });

  const activeCount = promos.filter(p => p.is_active && !isExpired(p)).length;
  const totalUsage = promos.reduce((s, p) => s + (p.usage_count || 0), 0);
  const activePackage = adSubscriptions.find((row) => row.status === 'active' || row.status === 'pending_approval') || null;
  const allowedPlacementScopes = resolveAllowedScopesByTier(activePackage?.package_tier);

  if (!venueId) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        <EmptyState icon={Megaphone} title="Belum ada venue" description="Daftarkan venue terlebih dahulu." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg text-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Promosi</p>
          <h1 className="font-display text-3xl lg:text-4xl text-neutral-900">Promosi & Diskon</h1>
          <p className="text-neutral-500 text-sm mt-1">Buat kode promo dan diskon untuk menarik pelanggan.</p>
        </div>
        <ActionButton onClick={openCreate}><Plus size={14} /> Buat Promo</ActionButton>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Ads Package</p>
            <h2 className="text-xl font-black text-neutral-900">Bronze / Silver / Gold / Platinum</h2>
            <p className="text-sm text-neutral-500 mt-1">Aktifkan paket iklan berlangganan untuk meningkatkan eksposur venue.</p>
          </div>
          {activePackage && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
              Paket aktif: <span className="font-bold uppercase">{activePackage.package_tier}</span> ({activePackage.status.replace('_', ' ')})
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Object.values(ADS_PACKAGE_CATALOG).map((pkg) => {
            const isCurrentTier = activePackage?.package_tier === pkg.tier.toLowerCase();
            return (
              <div key={pkg.tier} className={`rounded-2xl border p-4 ${isCurrentTier ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-black text-neutral-900">{pkg.tier}</div>
                  <Sparkles size={14} className={isCurrentTier ? 'text-emerald-600' : 'text-neutral-400'} />
                </div>
                <div className="text-2xl font-black text-neutral-900">Rp {pkg.monthly_fee_idr.toLocaleString('id-ID')}</div>
                <div className="text-xs text-neutral-500 mb-3">per bulan · target CTR {pkg.ctr_target_percent}%</div>
                <div className="text-xs text-neutral-600 mb-3">{pkg.description}</div>
                <ul className="text-xs text-neutral-600 space-y-1 mb-4">
                  {pkg.placement_scope.map((scope) => (
                    <li key={scope}>• {scope.replaceAll('_', ' ')}</li>
                  ))}
                </ul>
                <ActionButton
                  onClick={() => activatePackage(pkg.tier)}
                  loading={buyingTier === pkg.tier}
                  disabled={Boolean(isCurrentTier)}
                  className="w-full justify-center"
                >
                  {isCurrentTier ? 'Sedang Aktif' : `Pilih ${pkg.tier}`}
                </ActionButton>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-neutral-900">Featured Venue Badge</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {venueProfile?.is_featured
                ? `Aktif${venueProfile?.featured_badge_label ? ` sebagai ${venueProfile.featured_badge_label}` : ''}${venueProfile?.featured_priority ? ` · priority ${venueProfile.featured_priority}` : ''}`
                : 'Belum aktif. Aktifkan untuk menonjolkan venue di listing.'}
            </div>
          </div>
          <ActionButton
            onClick={() => updateFeaturedPlacement(!venueProfile?.is_featured)}
            loading={savingFeatured}
            variant={venueProfile?.is_featured ? 'outline' : 'primary'}
          >
            {venueProfile?.is_featured ? 'Nonaktifkan Featured' : 'Aktifkan Featured'}
          </ActionButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-bold text-neutral-900">Multi-placement Control</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                Atur channel penayangan aktif untuk paket {activePackage?.package_tier ? String(activePackage.package_tier).toUpperCase() : '—'}.
              </div>
            </div>
            <ActionButton
              onClick={savePlacementScopes}
              loading={savingPlacement}
              disabled={!activePackage}
              variant="outline"
            >
              Simpan Placement
            </ActionButton>
          </div>

          {!activePackage ? (
            <div className="text-xs text-neutral-500">Pilih paket ads terlebih dahulu untuk mengatur placement.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PLACEMENT_CHANNELS.map((channel) => {
                const allowed = allowedPlacementScopes.includes(channel.key);
                const checked = placementDraft.includes(channel.key);
                return (
                  <label
                    key={channel.key}
                    className={`rounded-xl border px-3 py-2 flex items-start gap-3 ${allowed ? 'border-neutral-200 bg-white cursor-pointer' : 'border-neutral-100 bg-neutral-50 opacity-60 cursor-not-allowed'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={!allowed || savingPlacement}
                      onChange={() => togglePlacementScope(channel.key)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-neutral-900">{channel.label}</span>
                      <span className="block text-xs text-neutral-500">{channel.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Dashboard */}
      {analyticsSummary.length > 0 && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Performance</p>
              <h2 className="text-xl font-black text-neutral-900">Analytics & ROI Tracking</h2>
              <p className="text-sm text-neutral-500 mt-1">Monitor performa iklan Anda dengan metrik realtime: impressions, clicks, conversions, dan ROI.</p>
            </div>
            <TrendingUp size={20} className="text-emerald-600" />
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {analyticsSummary.map((summary) => {
              const impressions = summary.total_impressions || 0;
              const clicks = summary.total_clicks || 0;
              const conversions = summary.total_conversions || 0;
              const revenue = summary.conversion_revenue_idr || 0;
              const ctr = summary.click_through_rate_percent || 0;
              const conversionRate = summary.conversion_rate_percent || 0;
              const roi = summary.roi_percent || 0;

              return (
                <React.Fragment key={summary.subscription_id}>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Impressions</div>
                    <div className="text-2xl font-bold text-neutral-900">{impressions.toLocaleString('id-ID')}</div>
                    <div className="text-xs text-neutral-500 mt-1">Total views</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Clicks</div>
                    <div className="text-2xl font-bold text-blue-600">{clicks.toLocaleString('id-ID')}</div>
                    <div className="text-xs text-neutral-500 mt-1">CTR: {ctr}%</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Conversions</div>
                    <div className="text-2xl font-bold text-emerald-600">{conversions.toLocaleString('id-ID')}</div>
                    <div className="text-xs text-neutral-500 mt-1">Rate: {conversionRate}%</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Net ROI</div>
                    <div className={`text-2xl font-bold ${roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">Rp {(summary.net_roi_idr || 0).toLocaleString('id-ID')}</div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Revenue Summary */}
          {analyticsSummary.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-200">
              {analyticsSummary.map((summary) => (
                <div key={`revenue-${summary.subscription_id}`} className="col-span-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-bold text-neutral-900">Paket: {summary.package_tier.toUpperCase()}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        Biaya: Rp {summary.monthly_fee_idr.toLocaleString('id-ID')} · Revenue: Rp {summary.conversion_revenue_idr.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trend Chart */}
          {analyticsDaily.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 p-4 pt-6 mt-4">
              <div className="text-sm font-bold text-neutral-900 mb-3">30-Hari Trend</div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={analyticsDaily}>
                  <defs>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => value.toLocaleString('id-ID')}
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px' }} />
                  <Area 
                    type="monotone" 
                    dataKey="impressions" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorImpressions)"
                    name="Impressions"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#8b5cf6" 
                    fillOpacity={1} 
                    fill="url(#colorClicks)"
                    name="Clicks"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorConversions)"
                    name="Conversions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Promo</div>
          <div className="text-2xl font-bold text-neutral-900">{promos.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Aktif</div>
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total Pemakaian</div>
          <div className="text-2xl font-bold text-neutral-900">{totalUsage}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Member Only</div>
          <div className="text-2xl font-bold text-neutral-900">{promos.filter(p => p.applies_to === 'member_only').length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit">
        {[['all', 'Semua'], ['active', 'Aktif'], ['inactive', 'Nonaktif']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilterActive(k)}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition ${filterActive === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Tag} title="Belum ada promo" description="Buat kode promo pertama untuk venue Anda." action={<ActionButton onClick={openCreate}><Plus size={14} /> Buat Promo</ActionButton>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(promo => {
            const expired = isExpired(promo);
            return (
              <div key={promo.id} className={`rounded-2xl border p-4 flex items-start gap-4 ${!promo.is_active || expired ? 'border-neutral-200 bg-neutral-50 opacity-75' : 'border-emerald-200 bg-white'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${promo.is_active && !expired ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                  <Tag size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-neutral-900">{promo.title}</span>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{fmtDiscount(promo)} OFF</span>
                    <span className="text-xs text-neutral-400">{APPLIES_LABELS[promo.applies_to]}</span>
                    {expired && <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Kadaluarsa</span>}
                  </div>
                  {promo.description && <div className="text-xs text-neutral-500 mb-1">{promo.description}</div>}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-neutral-500">
                    {promo.promo_code && (
                      <button type="button" onClick={() => copyCode(promo.promo_code)}
                        className="flex items-center gap-1 font-mono bg-neutral-100 px-2 py-0.5 rounded hover:bg-neutral-200 transition">
                        {copied === promo.promo_code ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                        {promo.promo_code}
                      </button>
                    )}
                    {promo.valid_from && <span>Mulai {fmtDate(promo.valid_from)}</span>}
                    {promo.valid_until && <span>Berakhir {fmtDate(promo.valid_until)}</span>}
                    <span>Dipakai {promo.usage_count || 0}{promo.usage_limit ? `/${promo.usage_limit}` : 'x'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => toggleActive(promo)} title={promo.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                    {promo.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} className="text-neutral-400" />}
                  </button>
                  <button onClick={() => openEdit(promo)} className="text-xs text-neutral-500 hover:underline">Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Promo' : 'Buat Promo Baru'}>
        <div className="space-y-4">
          <Field label="Nama Promo *">
            <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} placeholder="cth: Diskon Weekend 20%" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jenis Diskon">
              <select className={selectCls} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
                <option value="percent">Persen (%)</option>
                <option value="fixed">Nominal (Rp)</option>
              </select>
            </Field>
            <Field label={`Nilai Diskon ${form.discount_type === 'percent' ? '(%)' : '(Rp)'} *`}>
              <input className={inputCls} type="number" min="0" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} placeholder={form.discount_type === 'percent' ? '20' : '50000'} />
            </Field>
            <Field label="Kode Promo">
              <div className="flex gap-1">
                <input className={inputCls} value={form.promo_code} onChange={e => set('promo_code', e.target.value.toUpperCase())} placeholder="HEMAT20" />
                <button type="button" onClick={() => set('promo_code', randomCode())} className="px-2 py-1.5 text-xs bg-neutral-100 hover:bg-neutral-200 rounded-xl shrink-0 font-semibold">Acak</button>
              </div>
            </Field>
            <Field label="Berlaku Untuk">
              <select className={selectCls} value={form.applies_to} onChange={e => set('applies_to', e.target.value)}>
                {Object.entries(APPLIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Mulai">
              <input className={inputCls} type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Tanggal Berakhir">
              <input className={inputCls} type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
            </Field>
            <Field label="Maks. Diskon (Rp)">
              <input className={inputCls} type="number" min="0" value={form.max_discount_idr} onChange={e => set('max_discount_idr', e.target.value)} placeholder="— Tidak terbatas —" />
            </Field>
            <Field label="Batas Pemakaian">
              <input className={inputCls} type="number" min="0" value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} placeholder="— Tidak terbatas —" />
            </Field>
          </div>
          <Field label="Deskripsi">
            <textarea className={textareaCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Keterangan tambahan untuk pelanggan" />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-700">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            Aktifkan promo sekarang
          </label>
          <div className="flex gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSave} loading={saving}>{editing ? 'Simpan Perubahan' : 'Buat Promo'}</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
