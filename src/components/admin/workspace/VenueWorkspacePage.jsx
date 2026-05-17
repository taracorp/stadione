import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Grid3x3,
  ShoppingCart,
  CreditCard,
  Users,
  UserCog,
  Wrench,
  Megaphone,
  BarChart3,
  Settings,
  Trophy,
  Tag,
  ChevronRight,
  Building2,
  MapPin,
} from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

// ── Lazy-loaded sub-pages (stubs until Phase 2+) ─────────────────────────────
// Each will be replaced by the real implementation as phases complete.
const VenueDashboard = lazy(() => import('./venue/VenueDashboard.jsx'));
const VenueBookingsPage = lazy(() => import('./venue/VenueBookingsPage.jsx'));
const VenueCalendarPage = lazy(() => import('./venue/VenueCalendarPage.jsx'));
const VenueCourtsPage = lazy(() => import('./venue/VenueCourtsPage.jsx'));
const VenuePOSPage = lazy(() => import('./venue/VenuePOSPage.jsx'));
const VenueMembershipPage = lazy(() => import('./venue/VenueMembershipPage.jsx'));
const VenueCustomersPage = lazy(() => import('./venue/VenueCustomersPage.jsx'));
const VenueStaffPage = lazy(() => import('./venue/VenueStaffPage.jsx'));
const VenueMaintenancePage = lazy(() => import('./venue/VenueMaintenancePage.jsx'));
const VenueAdsPage = lazy(() => import('./venue/VenueAdsPage.jsx'));
const VenueFinancePage = lazy(() => import('./venue/VenueFinancePage.jsx'));
const VenueSettingsPage = lazy(() => import('./venue/VenueSettingsPage.jsx'));
const VenueTournamentReservationPage = lazy(() => import('./venue/VenueTournamentReservationPage.jsx'));
const VenuePromoPage = lazy(() => import('./venue/VenuePromoPage.jsx'));

// ── Navigation items ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard',    label: 'Dashboard',   icon: LayoutDashboard, group: 'main' },
  { key: 'bookings',     label: 'Booking',     icon: BookOpen,        group: 'main' },
  { key: 'calendar',     label: 'Kalender',    icon: CalendarDays,    group: 'main' },
  { key: 'courts',       label: 'Lapangan',    icon: Grid3x3,         group: 'main' },
  { key: 'pos',          label: 'POS & Kasir', icon: ShoppingCart,    group: 'operations' },
  { key: 'membership',   label: 'Membership',  icon: CreditCard,      group: 'operations' },
  { key: 'tournament',   label: 'Turnamen',    icon: Trophy,          group: 'operations' },
  { key: 'customers',    label: 'Customer',    icon: Users,           group: 'people' },
  { key: 'staff',        label: 'Staf',        icon: UserCog,         group: 'people' },
  { key: 'maintenance',  label: 'Maintenance', icon: Wrench,          group: 'facility' },
  { key: 'ads',          label: 'Promosi',     icon: Megaphone,       group: 'growth' },
  { key: 'promo',        label: 'Kode Promo',  icon: Tag,             group: 'growth' },
  { key: 'finance',      label: 'Keuangan',    icon: BarChart3,       group: 'growth' },
  { key: 'settings',     label: 'Pengaturan',  icon: Settings,        group: 'config' },
];

const NAV_GROUPS = [
  { key: 'main',       label: 'Utama' },
  { key: 'operations', label: 'Operasional' },
  { key: 'people',     label: 'Tim & Pelanggan' },
  { key: 'facility',   label: 'Fasilitas' },
  { key: 'growth',     label: 'Pertumbuhan' },
  { key: 'config',     label: 'Konfigurasi' },
];

function SubPageFallback({ label }) {
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-neutral-500">Memuat {label}...</p>
      </div>
    </div>
  );
}

function ComingSoonPage({ label }) {
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <Wrench size={24} className="text-emerald-600" />
        </div>
        <h3 className="font-display text-xl text-neutral-900 mb-2">{label}</h3>
        <p className="text-sm text-neutral-500">Halaman ini sedang dalam pengembangan dan akan tersedia segera.</p>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activePage, onNav, venueName, sidebarOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-neutral-200 flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto lg:flex
        `}
      >
        {/* Venue header */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-neutral-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <MapPin size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Venue OS</p>
            <p className="text-sm font-semibold text-neutral-900 truncate">{venueName || 'Venue Saya'}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((n) => n.group === group.key);
            if (!items.length) return null;
            return (
              <div key={group.key} className="mb-4">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-1">
                  {group.label}
                </p>
                {items.map(({ key, label, icon: Icon }) => {
                  const active = activePage === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { onNav(key); onClose(); }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition mb-0.5
                        ${active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                      `}
                    >
                      <Icon size={15} />
                      {label}
                      {active && <ChevronRight size={13} className="ml-auto text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VenueWorkspacePage({ auth, onBack, onNav: parentNav }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [venue, setVenue] = useState(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

  useEffect(() => {
    if (!auth?.id) return;
    async function loadVenue() {
      setLoadingVenue(true);
      try {
        // Try to find venue owned by or staffed by current user
        const { data: owned } = await supabase
          .from('venues')
          .select('id, name, city, verification_status, is_active, owner_user_id')
          .eq('owner_user_id', auth.id)
          .maybeSingle();

        if (owned) {
          setVenue(owned);
        } else {
          // Check if user is a staff member of any venue
          const { data: staffRow } = await supabase
            .from('venue_staff')
            .select('venue_id, role, venues(id, name, city, verification_status, is_active, owner_user_id)')
            .eq('user_id', auth.id)
            .eq('status', 'active')
            .maybeSingle();

          if (staffRow?.venues) {
            setVenue({ ...staffRow.venues, staffRole: staffRow.role });
          }
        }
      } catch (err) {
        console.error('VenueWorkspacePage load error:', err);
      } finally {
        setLoadingVenue(false);
      }
    }
    loadVenue();
  }, [auth?.id]);

  const activeLabel = NAV_ITEMS.find((n) => n.key === activePage)?.label || '';

  function renderPage() {
    const sharedProps = { auth, venue, onNav: setActivePage, onBack };
    switch (activePage) {
      case 'dashboard':   return <VenueDashboard {...sharedProps} />;
      case 'bookings':    return <VenueBookingsPage {...sharedProps} />;
      case 'calendar':    return <VenueCalendarPage {...sharedProps} />;
      case 'courts':      return <VenueCourtsPage {...sharedProps} />;
      case 'pos':         return <VenuePOSPage {...sharedProps} />;
      case 'membership':  return <VenueMembershipPage {...sharedProps} />;
      case 'tournament':  return <VenueTournamentReservationPage {...sharedProps} />;
      case 'customers':   return <VenueCustomersPage {...sharedProps} />;
      case 'staff':       return <VenueStaffPage {...sharedProps} />;
      case 'maintenance': return <VenueMaintenancePage {...sharedProps} />;
      case 'ads':         return <VenueAdsPage {...sharedProps} />;
      case 'finance':     return <VenueFinancePage {...sharedProps} />;
      case 'promo':        return <VenuePromoPage {...sharedProps} />;
      case 'settings':    return <VenueSettingsPage {...sharedProps} />;
      default:            return <ComingSoonPage label={activeLabel} />;
    }
  }

  if (!auth?.id) {
    return (
      <AdminLayout
        variant="workspace"
        kicker="/ VENUE WORKSPACE"
        title={<>VENUE<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>workspace.</span></>}
        subtitle="Kelola venue, lapangan, booking, dan staf Anda."
        onBack={onBack}
      >
        <EmptyState
          icon={Building2}
          title="Masuk dulu"
          description="Venue workspace hanya bisa dibuka saat akun sudah login."
          action={<ActionButton onClick={() => parentNav('profile')}>Buka Profil</ActionButton>}
        />
      </AdminLayout>
    );
  }

  if (loadingVenue) {
    return (
      <AdminLayout
        variant="workspace"
        kicker="/ VENUE WORKSPACE"
        title={<>VENUE<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>workspace.</span></>}
        subtitle="Memuat data venue..."
        onBack={onBack}
      >
        <div className="flex items-center justify-center min-h-64">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!venue) {
    return (
      <AdminLayout
        variant="workspace"
        kicker="/ VENUE WORKSPACE"
        title={<>VENUE<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>workspace.</span></>}
        subtitle="Daftarkan venue Anda untuk mulai."
        onBack={onBack}
      >
        <EmptyState
          icon={Building2}
          title="Belum ada venue"
          description="Anda belum mendaftarkan venue. Daftarkan venue Anda untuk mendapatkan akses ke Venue OS lengkap."
          action={
            <ActionButton onClick={() => parentNav('venue-registration')}>
              Daftarkan Venue
            </ActionButton>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-200">
        <div className="h-14 flex items-center gap-3 px-4 lg:px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition"
          >
            <ChevronRight size={15} className="rotate-180" />
            Kembali
          </button>
          <span className="text-neutral-300">/</span>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Venue OS</span>
          <span className="text-neutral-300 hidden sm:block">/</span>
          <span className="text-sm font-semibold text-neutral-900 hidden sm:block">{activeLabel}</span>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="ml-auto lg:hidden flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition"
          >
            <Grid3x3 size={16} />
            Menu
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNav={setActivePage}
          venueName={venue?.name}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<SubPageFallback label={activeLabel} />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
