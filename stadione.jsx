import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, MapPin, Star, Users, Trophy, Newspaper, Dumbbell, Building2,
  ChevronRight, Filter, Search, Clock, Zap, Plus, Award,
  ArrowRight, ArrowUpRight, Target, Flame, BookOpen, ShieldCheck,
  TrendingUp, Play, Menu, X, CheckCircle, Bell, Eye,
  Wifi, Car, Coffee, Volleyball, Gamepad2, Activity,
  Circle, Sparkles, ChevronDown, MoveRight,
  LogOut, User, MessageSquare, Wallet, BarChart3,
  Edit3, ArrowLeft, MessageCircle, ChevronLeft, Settings, ShoppingCart,
  Twitter, Facebook, Linkedin, Share2, Bookmark, Check, Heart, Upload
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useVenues, useTournaments, useNews, useCoaches, useChats,
  useTournamentDetail, useCoachDetail
} from './src/hooks/useSupabase.js';
import {
  useUserGamification,
  useArticleReading,
  useScrollTracker,
  useTournamentPlayers,
  useActivityHistory,
  useTierProgression
} from './src/hooks/useGamification.js';
import {
  UserGamificationBadge,
  TierProgressionCard,
  ActivityCard,
  ArticleQuizModal,
  QuizResultToast
} from './src/components/GamificationUI.jsx';
import { registerTournamentPlayer, submitGeneratedQuizAttempt, hasTriviaAttempt } from './src/services/gamificationService.js';
import { fetchCurrentUserActiveContext, fetchCurrentUserModerationStatus, fetchCurrentUserPermissions, fetchCurrentUserRoleProfiles, fetchCurrentUserRoles, recordVenueBooking, recordActivityToLog, sendEInvoiceEmail, switchCurrentUserActiveContext } from './src/services/supabaseService.js';
import { fetchRegistrationWorkspaceContext } from './src/services/registrationService.js';
import { canAccessAdminPage, deriveConsoleAccess, getOfficialMatchCapabilities, PAGE_ACCESS } from './src/utils/permissions.js';
import { getUserRoleBadges, normalizeRoles } from './src/utils/roles.js';
import { clearStoredActiveWorkspaceContext, getStoredActiveWorkspaceContext, setStoredActiveWorkspaceContext } from './src/utils/activeWorkspaceContext.js';
import { generateTriviaQuestionsFromContent } from './src/utils/quizGeneration.js';
import { supabase, SUPABASE_CONFIGURED, SUPABASE_ERROR, SUPABASE_KEY, SUPABASE_URL } from './src/config/supabase.js';
import {
  getAdaptiveAuthTimeout,
  authSessionCache,
  authPerfTracker,
  createRequestTracker,
  debounceAsync,
  getAuthStateFromCache,
  cacheAuthStateLocally,
  clearAuthStateCache,
} from './src/utils/authOptimization.js';

const PlatformDashboard = lazy(() => import('./src/components/admin/platform/PlatformDashboard.jsx'));
const AnalyticsPage = lazy(() => import('./src/components/admin/platform/AnalyticsPage.jsx'));
const ModerationPage = lazy(() => import('./src/components/admin/platform/ModerationPage.jsx'));
const NewsroomPage = lazy(() => import('./src/components/admin/platform/NewsroomPage.jsx'));
const VerificationQueuePage = lazy(() => import('./src/components/admin/platform/VerificationQueuePage.jsx'));
const UserManagementPage = lazy(() => import('./src/components/admin/platform/UserManagementPage.jsx'));
const PlatformPromoPage = lazy(() => import('./src/components/admin/platform/PlatformPromoPage.jsx'));
const SponsorPromoPage = lazy(() => import('./src/components/admin/platform/SponsorPromoPage.jsx'));
const WorkspaceConsolePage = lazy(() => import('./src/components/admin/workspace/WorkspaceConsolePage.jsx'));
const CommunityManagerPage = lazy(() => import('./src/components/admin/workspace/CommunityManagerPage.jsx'));
const SponsorManagerPage = lazy(() => import('./src/components/admin/workspace/SponsorManagerPage.jsx'));
const TournamentManagerPage = lazy(() => import('./src/components/admin/workspace/TournamentManagerPage.jsx'));
const TrainingManagerPage = lazy(() => import('./src/components/admin/workspace/TrainingManagerPage.jsx'));
const VenueManagerPage = lazy(() => import('./src/components/admin/workspace/VenueManagerPage.jsx'));
const VenueRegistrationPage = lazy(() => import('./src/components/admin/workspace/VenueRegistrationPage.jsx'));
const VenueWorkspacePage = lazy(() => import('./src/components/admin/workspace/VenueWorkspacePage.jsx'));
const OfficialCenterPage = lazy(() => import('./src/components/admin/official/OfficialCenterPage.jsx'));
const OfficialSchedulePage = lazy(() => import('./src/components/admin/official/OfficialSchedulePage.jsx'));
const MatchCenterPage = lazy(() => import('./src/components/admin/official/MatchCenterPage.jsx'));
const MatchReportPage = lazy(() => import('./src/components/admin/official/MatchReportPage.jsx'));
const MatchStatisticsPage = lazy(() => import('./src/components/admin/official/MatchStatisticsPage.jsx'));
const QuickRegistrationModal = lazy(() => import('./src/components/QuickRegistrationModal.jsx'));
const PartnershipPage = lazy(() => import('./src/components/PartnershipPage.jsx'));
const TeamWorkspaceModal = lazy(() => import('./src/components/TeamWorkspaceModal.jsx'));
const TrainingEcosystem = lazy(() => import('./src/components/training/TrainingEcosystem.jsx'));
const CommunityDiscoveryPage = lazy(() => import('./src/components/community/CommunityDiscoveryPage.jsx'));
const CommunityDetailPage = lazy(() => import('./src/components/community/CommunityDetailPage.jsx'));

// ============ DATA ============
const VENUES = [
  { id: 1, name: 'GOR Senayan Mini Soccer', city: 'Jakarta Pusat', sport: 'Sepakbola', price: 450000, rating: 4.8, reviews: 234, color: '#0F4D2A', tags: ['Outdoor', 'Floodlight', 'Parkir'] },
  { id: 2, name: 'Padel Club Kemang', city: 'Jakarta Selatan', sport: 'Padel', price: 380000, rating: 4.9, reviews: 156, color: '#1F3A8A', tags: ['Indoor', 'AC', 'Lockers'] },
  { id: 3, name: 'Aquatic Center Kelapa Gading', city: 'Jakarta Utara', sport: 'Renang', price: 75000, rating: 4.6, reviews: 412, color: '#0E7490', tags: ['Olympic', 'Heated'] },
  { id: 4, name: 'Futsal Arena Tebet', city: 'Jakarta Selatan', sport: 'Futsal', price: 220000, rating: 4.7, reviews: 89, color: '#92400E', tags: ['Indoor', 'Vinyl', 'AC'] },
  { id: 5, name: 'Lapangan Cilandak Sport Park', city: 'Jakarta Selatan', sport: 'Sepakbola', price: 850000, rating: 4.9, reviews: 178, color: '#0F4D2A', tags: ['Rumput Sintetis', 'Locker'] },
  { id: 6, name: 'Splash Pool Bintaro', city: 'Tangsel', sport: 'Renang', price: 60000, rating: 4.5, reviews: 256, color: '#0E7490', tags: ['Family', 'Cafe'] },
  { id: 7, name: 'Padel Garage BSD', city: 'Tangsel', sport: 'Padel', price: 320000, rating: 4.7, reviews: 92, color: '#1F3A8A', tags: ['Outdoor', 'Lighting'] },
  { id: 8, name: 'Futsal Stadium Cibubur', city: 'Jakarta Timur', sport: 'Futsal', price: 180000, rating: 4.4, reviews: 145, color: '#92400E', tags: ['Indoor', 'Cafe'] },
];

const TOURNAMENTS = [
  {
    id: 1, name: 'Liga Futsal Jakarta 2026', sport: 'Futsal', format: 'Liga',
    teams: 12, status: 'Berlangsung', prize: 50000000, startDate: '15 Mar 2026',
    color: '#92400E', host: 'StadioneSports', participants: 156,
    standings: [
      { pos: 1, team: 'FC Senayan United', p: 8, w: 7, d: 1, l: 0, gf: 32, ga: 8, pts: 22 },
      { pos: 2, team: 'Tebet Tigers FC', p: 8, w: 6, d: 1, l: 1, gf: 28, ga: 11, pts: 19 },
      { pos: 3, team: 'Kemang Kings', p: 8, w: 5, d: 2, l: 1, gf: 24, ga: 14, pts: 17 },
      { pos: 4, team: 'Cilandak Warriors', p: 8, w: 4, d: 2, l: 2, gf: 19, ga: 15, pts: 14 },
      { pos: 5, team: 'BSD Eagles', p: 8, w: 3, d: 2, l: 3, gf: 17, ga: 18, pts: 11 },
      { pos: 6, team: 'Cibubur FC', p: 8, w: 2, d: 1, l: 5, gf: 12, ga: 22, pts: 7 },
    ],
    schedule: [
      { date: '12 Mei', home: 'FC Senayan United', away: 'Tebet Tigers FC', status: 'live' },
      { date: '13 Mei', home: 'Kemang Kings', away: 'Cilandak Warriors', status: 'upcoming' },
      { date: '14 Mei', home: 'BSD Eagles', away: 'Cibubur FC', status: 'upcoming' },
      { date: '08 Mei', home: 'Tebet Tigers FC', away: 'Kemang Kings', score: '3-2', status: 'done' },
      { date: '07 Mei', home: 'FC Senayan United', away: 'BSD Eagles', score: '4-0', status: 'done' },
    ]
  },
  {
    id: 2, name: 'Stadione Padel Open', sport: 'Padel', format: 'Knockout',
    teams: 16, status: 'Pendaftaran', prize: 25000000, startDate: '20 Jun 2026',
    color: '#1F3A8A', host: 'Padel Club Kemang', participants: 24
  },
  {
    id: 3, name: 'Liga Esports Mobile Legends', sport: 'Esports', format: 'Liga',
    teams: 24, status: 'Berlangsung', prize: 100000000, startDate: '01 Apr 2026',
    color: '#7C3AED', host: 'Stadione × MPL', participants: 312
  },
  {
    id: 4, name: 'Tennis Singles Championship', sport: 'Tennis', format: 'Knockout',
    teams: 32, status: 'Pendaftaran', prize: 30000000, startDate: '10 Jul 2026',
    color: '#15803D', host: 'Senayan Tennis Club', participants: 28
  },
  {
    id: 5, name: 'Liga Badminton Antar-Klub', sport: 'Badminton', format: 'Liga',
    teams: 8, status: 'Berlangsung', prize: 15000000, startDate: '05 Apr 2026',
    color: '#B91C1C', host: 'PB Jakarta', participants: 64
  },
  {
    id: 6, name: 'Pingpong Open Tournament', sport: 'Pingpong', format: 'Knockout',
    teams: 16, status: 'Pendaftaran', prize: 8000000, startDate: '25 May 2026',
    color: '#EA580C', host: 'Komunitas TM Jakarta', participants: 12
  },
];

const CHATS = [
  {
    id: 1, coachId: 1, name: 'Coach Bambang Sutrisno', sport: 'Sepakbola', initial: 'BS',
    online: true, lastMsg: 'Sip, sampai ketemu besok jam 7 ya!', time: '5 mnt', unread: 0,
    messages: [
      { from: 'coach', text: 'Halo Aldi! Gimana kondisi kakimu setelah latihan kemarin?', time: '14:30' },
      { from: 'me', text: 'Udah lebih baik coach, masih sedikit pegal tapi udah bisa lari pelan', time: '14:32' },
      { from: 'coach', text: 'Bagus. Besok kita fokus ke teknik finishing ya. Bawa shin guard juga.', time: '14:33' },
      { from: 'coach', text: 'Oh iya, latihan stretching 10 menit sebelum tidur. Penting buat recovery.', time: '14:33' },
      { from: 'me', text: 'Siap coach. Jam 7 di lapangan biasa kan?', time: '14:35' },
      { from: 'coach', text: 'Sip, sampai ketemu besok jam 7 ya!', time: '14:36' },
    ]
  },
  {
    id: 2, coachId: 3, name: 'Coach Andre Wijaya', sport: 'Padel', initial: 'AW',
    online: false, lastMsg: 'Boleh, slot Sabtu sore masih kosong', time: '2 jam', unread: 2,
    messages: [
      { from: 'me', text: 'Coach, masih ada slot weekend ini?', time: '12:15' },
      { from: 'coach', text: 'Boleh, slot Sabtu sore masih kosong', time: '12:30' },
      { from: 'coach', text: 'Jam 16:00 atau 17:00. Mau yang mana?', time: '12:31' },
    ]
  },
  {
    id: 3, coachId: 2, name: 'Coach Ratna Dewi', sport: 'Renang', initial: 'RD',
    online: true, lastMsg: 'Latihan nafas hari ini bagus banget!', time: '1 hari', unread: 0,
    messages: [
      { from: 'me', text: 'Coach, hari ini saya berhasil 50m tanpa berhenti!', time: '08:30' },
      { from: 'coach', text: 'Wah keren! Itu progres besar', time: '08:42' },
      { from: 'coach', text: 'Latihan nafas hari ini bagus banget! Pertahankan ya', time: '08:45' },
    ]
  },
];

const BRACKETS = {
  // Tournament id 2 = Stadione Padel Open — 8 tim knockout
  2: [
    { name: 'Quarter Final', matches: [
      { p1: 'Andre & Maya', p2: 'Bagas & Lina', s1: 6, s2: 4, w: 0 },
      { p1: 'Reza & Dani', p2: 'Riko & Sari', s1: 7, s2: 5, w: 0 },
      { p1: 'Aldi & Putri', p2: 'Bayu & Tia', s1: 6, s2: 7, w: 1 },
      { p1: 'Yoga & Mega', p2: 'Rendy & Nia', s1: 6, s2: 3, w: 0 },
    ]},
    { name: 'Semi Final', matches: [
      { p1: 'Andre & Maya', p2: 'Reza & Dani', s1: 6, s2: 5, w: 0 },
      { p1: 'Bayu & Tia', p2: 'Yoga & Mega', s1: null, s2: null, w: null },
    ]},
    { name: 'Final', matches: [
      { p1: 'Andre & Maya', p2: 'TBD', s1: null, s2: null, w: null },
    ]},
  ],
  // Tournament id 4 = Tennis Singles Championship — 8 tim
  4: [
    { name: 'Quarter Final', matches: [
      { p1: 'Rendy P.', p2: 'Aldi K.', s1: 2, s2: 1, w: 0 },
      { p1: 'Maya H.', p2: 'Sari D.', s1: 2, s2: 0, w: 0 },
      { p1: 'Bagas N.', p2: 'Reza A.', s1: 1, s2: 2, w: 1 },
      { p1: 'Tito S.', p2: 'Dimas P.', s1: 2, s2: 1, w: 0 },
    ]},
    { name: 'Semi Final', matches: [
      { p1: 'Rendy P.', p2: 'Maya H.', s1: null, s2: null, w: null },
      { p1: 'Reza A.', p2: 'Tito S.', s1: null, s2: null, w: null },
    ]},
    { name: 'Final', matches: [
      { p1: 'TBD', p2: 'TBD', s1: null, s2: null, w: null },
    ]},
  ],
  // Tournament id 6 = Pingpong Open — small bracket
  6: [
    { name: 'Semi Final', matches: [
      { p1: 'Hendra K.', p2: 'Putra A.', s1: 3, s2: 1, w: 0 },
      { p1: 'Galih E.', p2: 'Bayu L.', s1: 2, s2: 3, w: 1 },
    ]},
    { name: 'Final', matches: [
      { p1: 'Hendra K.', p2: 'Bayu L.', s1: null, s2: null, w: null },
    ]},
  ],
};

// Coach extended data
const COACH_EXTRA = {
  1: {
    bio: 'Mantan pemain profesional Persija Jakarta dengan 12 tahun pengalaman bermain di liga 1. Setelah pensiun, fokus mengembangkan generasi muda sepakbola Indonesia melalui pendekatan teknis modern dan psikologi olahraga.',
    location: 'Jakarta Selatan',
    languages: ['Indonesia', 'English'],
    schedule: ['Sen-Jum: 06:00 - 21:00', 'Sabtu: 07:00 - 19:00', 'Minggu: 08:00 - 17:00'],
    programs: [
      { name: 'Sesi Privat 1-on-1', price: 250000, duration: '60 menit', desc: 'Latihan privat fokus teknik dan stamina' },
      { name: 'Sesi Berdua', price: 175000, duration: '60 menit', desc: 'Latihan untuk dua orang, biaya per orang' },
      { name: 'Latihan Tim (Max 12)', price: 1200000, duration: '90 menit', desc: 'Latihan kolektif untuk satu tim' },
    ]
  },
  3: {
    bio: 'Pelatih padel bersertifikasi Spanyol. Pernah bermain di sirkuit ATP Padel hingga peringkat 100 dunia. Berfokus pada teknik dasar yang kuat dan strategi bermain berpasangan.',
    location: 'Jakarta Selatan & BSD',
    languages: ['Indonesia', 'English', 'Español'],
    schedule: ['Sen-Jum: 14:00 - 22:00', 'Sab-Min: 08:00 - 21:00'],
    programs: [
      { name: 'Sesi Privat', price: 350000, duration: '60 menit', desc: 'Privat dengan analisis video' },
      { name: 'Klinik Pemula', price: 200000, duration: '90 menit', desc: 'Group max 4 orang, kenalan dasar' },
      { name: 'Strategi Pasangan', price: 500000, duration: '90 menit', desc: 'Khusus pasangan tetap, taktik' },
    ]
  },
};

// ============ HELPERS ============
const formatRupiah = (n) => `Rp ${n.toLocaleString('id-ID')}`;
const sportIcon = (sport) => {
  const icons = {
    'Sepakbola': Volleyball, 'Futsal': Volleyball, 'Renang': Activity,
    'Padel': Target, 'Badminton': Zap, 'Tennis': Target,
    'Pingpong': Circle, 'Esports': Gamepad2
  };
  return icons[sport] || Trophy;
};

// ============ STYLES ============
const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&family=Instrument+Serif:ital@0;1&display=swap');
    
    * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; background: #F4F4F4; }
    
    .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
    .font-serif-it { font-family: 'Instrument Serif', serif; font-style: italic; }
    .font-body { font-family: 'Plus Jakarta Sans', sans-serif; }
    
    .skewed { transform: skewX(-8deg); }
    .skewed-rev { transform: skewX(8deg); }
    
    .hover-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s; }
    .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 16px 40px -12px rgba(0,0,0,0.18); }
    
    .grain {
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E");
    }
    
    .ticker { animation: scroll 35s linear infinite; }
    @keyframes scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    
    .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .pulse-dot { animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    button {
      transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
    }
    button:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    input, textarea, select {
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #0A0A0A;
      box-shadow: 0 0 0 4px rgba(225, 29, 46, 0.08);
    }

    .card {
      background: #FFFFFF;
      border: 1px solid #E5E5E5;
      border-radius: 28px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.05);
    }
    .section-title {
      text-transform: uppercase;
      letter-spacing: 0.18em;
    }
    .section-description {
      color: #4B5563;
      max-width: 42rem;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: #EEEEEE; }
    ::-webkit-scrollbar-thumb { background: #CCC; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #E11D2E; }
  `}</style>
);

// ============ LOGO ============
const Logo = ({ size = 36 }) => (
  <img
    src="/stadione-logo.png"
    alt="Stadione"
    width={size}
    height={size}
    className="object-contain"
    style={{ display: 'block' }}
  />
);

const Wordmark = ({ size = 22, color = '#E11D2E' }) => (
  <span
    className="font-display skewed"
    style={{ color, fontSize: size, lineHeight: 1, letterSpacing: '0.04em', display: 'inline-block' }}
  >
    STADIONE
  </span>
);

const LazyFallback = ({ label = 'Memuat halaman...' }) => (
  <div className="min-h-[40vh] bg-[#F4F4F4] flex items-center justify-center px-5">
    <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-5 text-sm font-semibold text-neutral-600">
      {label}
    </div>
  </div>
);

const AccessDeniedPage = ({ title = 'Akses tidak tersedia', description = 'Halaman ini hanya tersedia untuk role yang sesuai.', onBack }) => (
  <div className="bg-[#F4F4F4] min-h-[70vh] px-5 py-10 lg:px-8 flex items-center justify-center">
    <div className="max-w-xl w-full rounded-3xl border border-neutral-200 bg-white p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-5">
        <ShieldCheck size={22} />
      </div>
      <h2 className="font-display text-3xl text-neutral-900 mb-3">{title}</h2>
      <p className="text-sm text-neutral-500 leading-relaxed mb-6">{description}</p>
      <button onClick={onBack} className="px-5 py-3 rounded-full bg-neutral-900 text-white text-sm font-bold">
        Kembali ke Profil
      </button>
    </div>
  </div>
);

// ============ HEADER ============
const Header = ({ current, onNav, auth, onOpenAuth, onLogout, onCart, onSwitchContext, gamificationStats, statsLoading, communityNotifications = [], communityUnreadById = {}, onOpenCommunityNotification, cartCount = 0 }) => {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [notificationMenu, setNotificationMenu] = useState(false);
  const items = [
    { id: 'booking', label: 'Booking Lapangan' },
    { id: 'tournament', label: 'Turnamen & Liga' },
    { id: 'community', label: 'Komunitas' },
    { id: 'news', label: 'Berita' },
    { id: 'training', label: 'Pelatihan' },
  ];
  const totalCommunityUnread = Object.values(communityUnreadById || {}).reduce((sum, count) => sum + Number(count || 0), 0);
  const activeScope = auth?.activeContext?.context_scope;
  const contextAccess = {
    platform: activeScope ? activeScope === 'platform' : auth?.access?.platform,
    workspace: activeScope ? activeScope === 'workspace' : auth?.access?.workspace,
    official: activeScope ? activeScope === 'official' : auth?.access?.official,
  };
  const consoleItems = [
    contextAccess.platform && { id: 'platform-console', label: 'Platform Console', icon: BarChart3 },
    contextAccess.workspace && { id: 'workspace-console', label: 'Workspace Console', icon: Building2 },
    contextAccess.official && { id: 'official-center', label: 'Official Center', icon: ShieldCheck },
  ].filter(Boolean);
  const contextOptions = [
    auth?.access?.platform && { scope: 'platform', label: 'Platform', page: 'platform-console', icon: BarChart3 },
    auth?.access?.workspace && { scope: 'workspace', label: 'Workspace', page: 'workspace-console', icon: Building2 },
    auth?.access?.official && { scope: 'official', label: 'Official', page: 'official-center', icon: ShieldCheck },
  ].filter(Boolean);
  const officialCapabilities = getOfficialMatchCapabilities({ userRoles: auth?.roles || [] });

  const handleContextSelection = async (scope, pageTarget) => {
    if (typeof onSwitchContext === 'function') {
      await onSwitchContext(scope);
    }
    onNav(pageTarget);
    setUserMenu(false);
  };
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-300" style={{ background: 'rgba(244,244,244,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <button onClick={() => onNav('home')} className="flex items-center gap-2.5 group">
          <Logo size={32} />
          <Wordmark size={22} />
        </button>
        <nav className="hidden lg:flex items-center gap-1">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                current === item.id || current.startsWith(item.id)
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 relative">
          {auth && (
            <div className="hidden lg:flex items-center">
              <UserGamificationBadge stats={gamificationStats} loading={statsLoading} />
            </div>
          )}
          {auth ? (
            <>
              <button
                onClick={() => { setNotificationMenu((value) => !value); setUserMenu(false); }}
                className="relative p-2.5 hover:bg-neutral-200 rounded-full"
                title="Notifikasi komunitas"
              >
                <Bell size={18} />
                {totalCommunityUnread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1" style={{ background: '#E11D2E' }}>
                    {Math.min(totalCommunityUnread, 99)}
                  </span>
                )}
              </button>
              <button
                onClick={onCart}
                className="relative p-2.5 hover:bg-neutral-200 rounded-full"
                title="Keranjang"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#E11D2E' }}>
                    {Math.min(cartCount, 99)}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setUserMenu(!userMenu); setNotificationMenu(false); }}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-neutral-200 hover:border-neutral-400"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm text-white" style={{ background: '#E11D2E' }}>
                  {auth.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="text-sm font-bold hidden md:inline">{auth.name.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>
              {notificationMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationMenu(false)} />
                  <div className="absolute top-full right-16 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-neutral-200 shadow-xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm text-neutral-900">Notifikasi Komunitas</div>
                        <div className="text-xs text-neutral-500">{totalCommunityUnread} unread dari semua komunitas</div>
                      </div>
                      <Bell size={16} className="text-neutral-500" />
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                      {communityNotifications.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-neutral-500">Belum ada notifikasi komunitas.</div>
                      ) : (
                        communityNotifications.slice(0, 8).map((item) => {
                          const unreadForCommunity = Number(communityUnreadById?.[item.communityId] || 0);
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                onOpenCommunityNotification?.(item);
                                setNotificationMenu(false);
                              }}
                              className="w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50"
                            >
                              <div className="flex items-start justify-between gap-3 mb-1">
                                <div className="text-xs uppercase tracking-[0.18em] font-black text-neutral-500">{item.communityName || 'Komunitas'}</div>
                                {unreadForCommunity > 0 && (
                                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#E11D2E' }}>
                                    {unreadForCommunity}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-bold text-neutral-900">{item.title}</div>
                              <div className="mt-1 text-xs text-neutral-600 line-clamp-2">{item.detail}</div>
                              <div className="mt-2 text-[11px] text-neutral-400">{new Date(item.createdAt).toLocaleString('id-ID')}</div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl border border-neutral-200 shadow-xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-neutral-100">
                      <div className="font-bold text-sm">{auth.name}</div>
                      <div className="text-xs text-neutral-500">{auth.email}</div>
                      {auth?.roleBadges?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {auth.roleBadges.slice(0, 3).map((badge) => (
                            <span key={badge} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="py-2">
                      <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Account</div>
                      <button onClick={() => { onNav('profile'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <User size={14} /> Profil Saya
                      </button>
                      <button onClick={() => { onNav('cart'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3 justify-between">
                        <span className="flex items-center gap-3"><ShoppingCart size={14} /> Keranjang</span>
                        {cartCount > 0 && <span className="text-[10px] font-bold text-white px-1.5 rounded-full" style={{ background: '#E11D2E', minWidth: 18, height: 18, lineHeight: '18px' }}>{Math.min(cartCount, 99)}</span>}
                      </button>
                      <button onClick={() => { setNotificationMenu(true); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3 justify-between">
                        <span className="flex items-center gap-3"><Bell size={14} /> Notifikasi</span>
                        {totalCommunityUnread > 0 && <span className="text-[10px] font-bold text-white px-1.5 rounded-full" style={{ background: '#E11D2E', minWidth: 18, height: 18, lineHeight: '18px' }}>{totalCommunityUnread}</span>}
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <Settings size={14} /> Pengaturan
                      </button>
                    </div>
                    <div className="border-t border-neutral-100 py-2">
                      <button onClick={() => { onLogout(); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3">
                        <LogOut size={14} /> Keluar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={() => onOpenAuth('login')} className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-900">
                Masuk
              </button>
              <button onClick={() => onOpenAuth('register')} className="px-4 py-2 text-sm font-bold rounded-full text-white" style={{ background: '#E11D2E' }}>
                Daftar
              </button>
            </>
          )}
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-neutral-300 bg-white">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); setOpen(false); }}
              className="block w-full text-left px-5 py-3.5 text-sm font-semibold border-b border-neutral-200"
            >
              {item.label}
            </button>
          ))}
          {auth && (
            <>
              <button
                onClick={() => { onNav('cart'); setOpen(false); }}
                className="block w-full text-left px-5 py-3.5 text-sm font-semibold border-b border-neutral-200"
              >
                Keranjang {cartCount > 0 && <span className="ml-2 text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#E11D2E' }}>{Math.min(cartCount, 99)}</span>}
              </button>
              <button
                onClick={() => { onNav('coach-dashboard'); setOpen(false); }}
                className="block w-full text-left px-5 py-3.5 text-sm font-semibold border-b border-neutral-200 text-[#E11D2E]"
              >
                Dashboard Pelatih
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};

// ============ HOME ============
const HomePage = ({ onNav, venues, tournaments, news, coaches }) => {
  const safeNews = Array.isArray(news) ? news : [];
  const features = [
    { id: 'booking', label: 'BOOKING LAPANGAN', desc: 'Sepakbola, futsal, renang, padel — pesan slot dalam hitungan detik.', count: '500+ Venue', icon: MapPin },
    { id: 'tournament', label: 'TURNAMEN & LIGA', desc: 'Buat turnamen sendiri atau ikut liga dengan klasemen otomatis.', count: '120+ Aktif', icon: Trophy },
    { id: 'community', label: 'COMMUNITY ECOSYSTEM', desc: 'Temukan komunitas olahraga dari 40+ kategori dengan smart discovery system.', count: '50 Kategori', icon: Users },
    { id: 'news', label: 'BERITA & MEDIA', desc: 'Berita olahraga Indonesia, eksklusif & dipercepat.', count: '24/7 Update', icon: Newspaper },
    { id: 'training', label: 'PELATIHAN', desc: 'Booking pelatih profesional bersertifikasi nasional.', count: '300+ Pelatih', icon: Dumbbell },
  ];
  const registrationReadyTournaments = (tournaments && tournaments.length > 0 ? tournaments : TOURNAMENTS)
    .filter((item) => String(item.status || '').toLowerCase() === 'pendaftaran')
    .slice(0, 2);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-neutral-300" style={{ background: '#F4F4F4' }}>
        <div className="absolute inset-0 grain opacity-40 pointer-events-none" />
        <div className="absolute -top-20 -right-32 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #E11D2E, transparent 70%)' }} />

        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24 relative">
          <div className="flex items-center gap-3 mb-6 fade-up">
            <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: '#E11D2E' }} />
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">Live Sekarang · 1.247 Pengguna Aktif</span>
          </div>

          <h1 className="font-display leading-[0.85] mb-8 fade-up" style={{ animationDelay: '0.1s' }}>
            <span className="block text-[15vw] lg:text-[10rem] text-neutral-900">SEMUA OLAHRAGA</span>
            <span className="block text-[15vw] lg:text-[10rem]" style={{ color: '#E11D2E' }}>
              <span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>satu</span> PLATFORM.
            </span>
          </h1>

          <div className="grid lg:grid-cols-2 gap-8 mb-12 fade-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-lg lg:text-xl text-neutral-700 max-w-xl leading-relaxed">
              Booking lapangan, gabung turnamen, baca berita olahraga, sampai latihan bareng pelatih profesional — semua dilakukan dari Stadione.
            </p>
            <div className="flex flex-wrap gap-3 lg:justify-end items-end">
              <button onClick={() => onNav('booking')} className="px-7 py-4 text-sm font-bold rounded-full text-white flex items-center gap-2 hover-lift" style={{ background: '#E11D2E' }}>
                MULAI BOOKING <ArrowRight size={16} />
              </button>
              <button onClick={() => onNav('create-tournament')} className="px-7 py-4 text-sm font-bold rounded-full bg-neutral-900 text-white flex items-center gap-2 hover-lift">
                BUAT TURNAMEN <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-300 border border-neutral-300 fade-up" style={{ animationDelay: '0.3s' }}>
            {[
              { v: '500+', l: 'Venue Terdaftar' },
              { v: '12.4K', l: 'Pengguna Aktif' },
              { v: '300+', l: 'Pelatih Profesional' },
              { v: '120', l: 'Turnamen Aktif' },
            ].map((s, i) => (
              <div key={i} className="bg-[#F4F4F4] p-6">
                <div className="font-display text-5xl lg:text-6xl text-neutral-900 leading-none mb-1">{s.v}</div>
                <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid lg:grid-cols-[1.2fr_0.8fr] gap-4 fade-up" style={{ animationDelay: '0.35s' }}>
            <button onClick={() => onNav('tournament')} className="rounded-3xl border border-neutral-300 bg-white/70 p-6 text-left hover:bg-white transition backdrop-blur-sm">
              <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-500 mb-3">Fitur Baru</div>
              <div className="font-display text-3xl text-neutral-900 leading-[0.95] mb-3">Pendaftaran cepat dan workspace tim.</div>
              <p className="text-sm text-neutral-600 leading-relaxed mb-5">Masuk ke detail turnamen yang sedang membuka pendaftaran untuk mengamankan slot, bayar lebih cepat, lalu kelola roster tim dari workspace khusus.</p>
              <div className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: '#E11D2E' }}>
                LIHAT TURNAMEN PENDAFTARAN <ArrowRight size={16} />
              </div>
            </button>
            <div className="rounded-3xl border border-neutral-300 bg-neutral-900 text-white p-6">
              <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-400 mb-3">Siap Didukung</div>
              <div className="space-y-3">
                {registrationReadyTournaments.length > 0 ? registrationReadyTournaments.map((item) => (
                  <button key={item.id} onClick={() => onNav('tournament-detail', item)} className="w-full rounded-2xl border border-neutral-800 bg-neutral-800 px-4 py-3 text-left hover:border-neutral-600 transition">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-bold uppercase text-emerald-300">Pendaftaran Cepat</span>
                      <span className="text-xs text-neutral-400">{item.sport}</span>
                    </div>
                    <div className="font-semibold text-white">{item.name}</div>
                  </button>
                )) : (
                  <div className="text-sm text-neutral-400 leading-relaxed">Belum ada turnamen berstatus pendaftaran di feed publik saat ini.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ticker */}
        <div className="border-t border-neutral-300 bg-neutral-900 text-white overflow-hidden">
          <div className="ticker flex gap-12 py-3 whitespace-nowrap">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-12 items-center">
                {['LIVE: Liga Futsal Jakarta — FC Senayan 3-2 Tebet Tigers', 'BARU: 12 venue padel di Kemang', 'PIALA AFF U-23: Indonesia ke Final', 'Coach Andre Wijaya buka kelas padel pemula', 'Liga Esports MPL S13 — Final EVOS vs RRQ Sabtu', 'Olimpiade renang: Rekor Asia baru'].map((t, j) => (
                  <span key={j} className="font-display text-lg flex items-center gap-3">
                    <Sparkles size={14} style={{ color: '#E11D2E' }} /> {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ EKOSISTEM</div>
            <h2 className="font-display text-5xl lg:text-7xl text-neutral-900 leading-[0.9]">
              EMPAT FITUR.<br />
              <span className="font-serif-it font-normal text-neutral-500" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>satu</span>{' '}
              <span style={{ color: '#E11D2E' }}>PENGALAMAN.</span>
            </h2>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-px bg-neutral-300 border border-neutral-300">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => onNav(f.id)}
                className="group bg-[#F4F4F4] p-8 lg:p-12 text-left hover:bg-white transition-colors relative"
              >
                <div className="flex items-start justify-between mb-12">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#E11D2E' }}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-neutral-200 text-neutral-700">{f.count}</span>
                </div>
                <div className="font-display text-3xl lg:text-5xl text-neutral-900 mb-3 leading-[0.95]">
                  0{i + 1} / {f.label}
                </div>
                <p className="text-base text-neutral-600 mb-6 max-w-md">{f.desc}</p>
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 group-hover:gap-4 transition-all">
                  JELAJAHI <MoveRight size={16} style={{ color: '#E11D2E' }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* FEATURED TURNAMEN */}
      <section className="border-t border-neutral-300 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">/ TURNAMEN UNGGULAN</div>
              <h2 className="font-display text-4xl lg:text-6xl leading-[0.9]">SEDANG BERLANGSUNG</h2>
            </div>
            <button onClick={() => onNav('tournament')} className="text-sm font-bold flex items-center gap-2 text-white hover:gap-4 transition-all">
              SEMUA TURNAMEN <ArrowRight size={16} />
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {(tournaments && tournaments.length > 0 ? tournaments : TOURNAMENTS).slice(0, 3).map((t) => {
              const Icon = sportIcon(t.sport);
              return (
                <button
                  key={t.id}
                  onClick={() => onNav('tournament-detail', t)}
                  className="text-left bg-neutral-800 p-6 hover:bg-neutral-700 transition relative overflow-hidden group"
                >
                  <div className="absolute -right-12 -bottom-12 opacity-10 group-hover:opacity-20 transition">
                    <Icon size={160} />
                  </div>
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-xs font-bold px-2 py-1 rounded uppercase" style={{ background: t.color }}>{t.sport}</span>
                    <span className="text-xs font-semibold text-neutral-400">{t.format}</span>
                  </div>
                  <div className="font-display text-3xl mb-4 leading-tight">{t.name}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-neutral-400 text-xs mb-1">HADIAH</div>
                      <div className="font-bold">{formatRupiah(t.prize)}</div>
                    </div>
                    <div>
                      <div className="text-neutral-400 text-xs mb-1">PESERTA</div>
                      <div className="font-bold">{t.participants} terdaftar</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* LATEST NEWS */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ TERKINI</div>
            <h2 className="font-display text-4xl lg:text-6xl text-neutral-900 leading-[0.9]">DARI NEWSROOM</h2>
          </div>
          <button onClick={() => onNav('news')} className="text-sm font-bold flex items-center gap-2 hover:gap-4 transition-all">
            SEMUA BERITA <ArrowRight size={16} style={{ color: '#E11D2E' }} />
          </button>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          {safeNews.slice(1, 4).map((n) => (
            <article key={n.id} className="cursor-pointer group" onClick={() => onNav('news-detail', n)}>
              <div className="aspect-[4/3] mb-4 relative overflow-hidden grain" style={{ background: n.color }}>
                <div className="absolute inset-0 flex items-end p-5">
                  <span className="text-xs font-bold px-3 py-1 bg-white text-neutral-900 uppercase tracking-wider">{n.category}</span>
                </div>
              </div>
              <div className="text-xs text-neutral-500 mb-2 font-semibold">{n.date} · {n.read} baca</div>
              <h3 className="font-display text-2xl leading-tight text-neutral-900 group-hover:text-[#E11D2E] transition">{n.title}</h3>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-300" style={{ background: '#E11D2E' }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28 text-white grain">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-widest font-bold mb-4 opacity-80">/ BERGABUNG SEKARANG</div>
            <h2 className="font-display text-5xl lg:text-8xl leading-[0.85] mb-8">
              Saatnya<br />
              <span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>main</span> jadi<br />
              SERIUS.
            </h2>
            <div className="flex flex-wrap gap-3">
              <button className="px-7 py-4 text-sm font-bold rounded-full bg-white text-[#E11D2E] flex items-center gap-2 hover-lift">
                DAFTAR GRATIS <ArrowUpRight size={16} />
              </button>
              <button className="px-7 py-4 text-sm font-bold rounded-full bg-neutral-900 text-white flex items-center gap-2 hover-lift">
                <Play size={14} fill="white" /> LIHAT DEMO
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// ============ BOOKING ============
const BookingPage = ({ onSelect, venues }) => {
  const [filter, setFilter] = useState('Semua');
  const filtered = filter === 'Semua' ? (venues && venues.length > 0 ? venues : VENUES) : (venues && venues.length > 0 ? venues : VENUES).filter(v => v.sport === filter);

  return (
    <div>
      <SectionHero
        kicker="/ FITUR 01"
        title={<>BOOKING<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>lapangan.</span></>}
        subtitle="Cari, pesan, main. 500+ venue tersebar di seluruh Indonesia. Konfirmasi instan, harga transparan."
      />

      {/* Filters */}
      <div className="border-b border-neutral-300 bg-white sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-neutral-500" />
          {SPORTS_BOOK.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 text-sm font-bold rounded-full uppercase tracking-wider transition ${
                filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {s}
            </button>
          ))}
          <div className="ml-auto hidden md:flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full">
            <Search size={14} className="text-neutral-500" />
            <input className="bg-transparent text-sm outline-none placeholder:text-neutral-500 w-48" placeholder="Cari venue atau lokasi..." />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12">
        <div className="text-sm text-neutral-500 mb-6 font-semibold">{filtered.length} venue tersedia</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((v, i) => (
            <button key={v.id} onClick={() => onSelect(v)} className="text-left bg-white rounded-2xl overflow-hidden hover-lift fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="aspect-[5/3] relative overflow-hidden grain" style={{ background: v.color }}>
                <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 bg-white text-neutral-900 uppercase tracking-wider">{v.sport}</div>
                <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white text-xs font-bold flex items-center gap-1">
                  <Star size={12} fill="white" /> {v.rating}
                </div>
                <div className="absolute -bottom-12 -right-12 opacity-20">
                  {React.createElement(sportIcon(v.sport), { size: 200, color: 'white' })}
                </div>
              </div>
              <div className="p-5">
                <div className="font-display text-2xl text-neutral-900 mb-1 leading-tight">{v.name}</div>
                <div className="flex items-center gap-1 text-sm text-neutral-500 mb-4">
                  <MapPin size={12} /> {v.city} · {v.reviews} ulasan
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {v.tags.map(t => (
                    <span key={t} className="text-xs font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">{t}</span>
                  ))}
                </div>
                <div className="flex items-end justify-between border-t border-neutral-200 pt-4">
                  <div>
                    <div className="text-xs text-neutral-500 font-semibold">Mulai dari</div>
                    <div className="font-display text-2xl text-neutral-900 leading-none">{formatRupiah(v.price)}<span className="text-sm text-neutral-500 font-body">/jam</span></div>
                  </div>
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#E11D2E' }}>
                    PESAN <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const BookingDetail = ({ venue, onBack, onPay }) => {
  const slots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  const taken = ['10:00', '14:00', '19:00', '20:00'];
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(0);

  const dates = [
    { label: 'Hari Ini', date: '7 Mei' },
    { label: 'Besok', date: '8 Mei' },
    { label: 'Sabtu', date: '9 Mei' },
    { label: 'Minggu', date: '10 Mei' },
    { label: 'Senin', date: '11 Mei' },
  ];

  return (
    <div>
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        ← Kembali
      </button>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="aspect-[16/9] relative overflow-hidden mb-6 rounded-2xl grain" style={{ background: venue.color }}>
            <div className="absolute -bottom-12 -right-12 opacity-20">
              {React.createElement(sportIcon(venue.sport), { size: 320, color: 'white' })}
            </div>
            <div className="absolute top-6 left-6 text-xs font-bold px-3 py-1 bg-white text-neutral-900 uppercase">{venue.sport}</div>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl text-neutral-900 leading-[0.9] mb-3">{venue.name}</h1>
          <div className="flex items-center gap-4 text-sm text-neutral-600 mb-6 flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={14} /> {venue.city}</span>
            <span className="flex items-center gap-1"><Star size={14} fill="#E11D2E" color="#E11D2E" /> {venue.rating} ({venue.reviews} ulasan)</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-8">
            {venue.tags.map(t => (
              <span key={t} className="text-xs font-bold px-3 py-1.5 bg-neutral-100 rounded-full">{t}</span>
            ))}
          </div>

          <div className="border-t border-neutral-300 pt-8">
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ PILIH TANGGAL</div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-8">
              {dates.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setDate(i)}
                  className={`shrink-0 px-5 py-3 rounded-2xl border-2 transition ${
                    date === i ? 'border-[#E11D2E] bg-[#E11D2E] text-white' : 'border-neutral-300 bg-white hover:border-neutral-900'
                  }`}
                >
                  <div className="text-xs font-bold uppercase">{d.label}</div>
                  <div className="font-display text-lg leading-none mt-1">{d.date}</div>
                </button>
              ))}
            </div>

            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ PILIH JAM</div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {slots.map(s => {
                const isTaken = taken.includes(s);
                const isSelected = selected === s;
                return (
                  <button
                    key={s}
                    disabled={isTaken}
                    onClick={() => setSelected(s)}
                    className={`p-3 rounded-xl text-center font-bold transition ${
                      isTaken ? 'bg-neutral-200 text-neutral-400 line-through cursor-not-allowed' :
                      isSelected ? 'bg-neutral-900 text-white' :
                      'bg-white border-2 border-neutral-200 hover:border-neutral-900'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="bg-white rounded-2xl p-6 border border-neutral-200">
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ RINGKASAN</div>
            <div className="font-display text-3xl text-neutral-900 leading-tight mb-1">{formatRupiah(venue.price)}<span className="text-base text-neutral-500 font-body"> / jam</span></div>
            <div className="text-sm text-neutral-500 mb-6">Sudah termasuk fasilitas standar</div>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Tanggal</span><span className="font-bold">{dates[date].label}, {dates[date].date}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Jam</span><span className="font-bold">{selected || '— pilih —'}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Durasi</span><span className="font-bold">1 jam</span></div>
              <div className="flex justify-between border-t border-neutral-200 pt-3"><span className="text-neutral-500">Service fee</span><span className="font-bold">{formatRupiah(500)}</span></div>
              <div className="flex justify-between"><span className="font-bold">Total</span><span className="font-display text-xl">{formatRupiah(venue.price + 500)}</span></div>
            </div>

            <button
              disabled={!selected}
              onClick={() => onPay(venue, selected, `${dates[date].label}, ${dates[date].date}`)}
              className={`w-full py-4 rounded-full font-bold text-sm transition ${
                selected ? 'text-white' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              style={selected ? { background: '#E11D2E' } : {}}
            >
              {selected ? 'LANJUT BAYAR' : 'PILIH JAM DULU'}
            </button>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-4 justify-center">
              <ShieldCheck size={12} /> Pembayaran aman via QRIS / Bank
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ TOURNAMENT ============
const TournamentPage = ({ onSelect, onCreate, tournaments }) => {
  const [filter, setFilter] = useState('Semua');
  const filtered = filter === 'Semua' ? (tournaments && tournaments.length > 0 ? tournaments : TOURNAMENTS) : (tournaments && tournaments.length > 0 ? tournaments : TOURNAMENTS).filter(t => t.sport === filter);
  const quickRegistrationCount = filtered.filter((item) => String(item.status || '').toLowerCase() === 'pendaftaran').length;

  return (
    <div>
      <SectionHero
        kicker="/ FITUR 02"
        title={<>TURNAMEN<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>&amp; liga.</span></>}
        subtitle="Buat turnamen sendiri atau gabung yang sudah ada. Klasemen otomatis, format liga & knockout, semua olahraga."
        action={
          <button onClick={onCreate} className="px-6 py-3 text-sm font-bold rounded-full text-white flex items-center gap-2 hover-lift" style={{ background: '#E11D2E' }}>
            <Plus size={16} /> BUAT TURNAMEN
          </button>
        }
      />

      <div className="border-b border-neutral-300 bg-white sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex items-center gap-3 overflow-x-auto">
          <Filter size={16} className="text-neutral-500 shrink-0" />
          {SPORTS_TOURNEY.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 px-4 py-2 text-sm font-bold rounded-full uppercase tracking-wider transition ${
                filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-4 mb-8">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-500 mb-2">Fitur Baru</div>
            <div className="font-display text-3xl text-neutral-900 mb-2">Pendaftaran Cepat</div>
            <p className="text-sm text-neutral-600 leading-relaxed">Turnamen dengan status pendaftaran sekarang bisa dibuka lewat alur registrasi cepat, lanjut pembayaran, dan langsung masuk ke workspace tim.</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-900 text-white p-6">
            <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-400 mb-2">Ringkasan</div>
            <div className="font-display text-5xl leading-none mb-2">{quickRegistrationCount}</div>
            <p className="text-sm text-neutral-300 leading-relaxed">turnamen di filter saat ini siap untuk quick registration dan workflow workspace tim.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((t, i) => {
            const Icon = sportIcon(t.sport);
            const isRegistrationOpen = String(t.status || '').toLowerCase() === 'pendaftaran';
            return (
              <button key={t.id} onClick={() => onSelect(t)} className="text-left bg-white rounded-2xl overflow-hidden hover-lift fade-up border border-neutral-200" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="p-6 relative overflow-hidden text-white grain" style={{ background: t.color, minHeight: 200 }}>
                  <div className="absolute -right-10 -bottom-10 opacity-15">
                    <Icon size={180} />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${t.status === 'Berlangsung' ? 'bg-white text-black' : 'bg-black/30 text-white'}`}>
                      {t.status === 'Berlangsung' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E11D2E] mr-1.5 pulse-dot" />}
                      {t.status}
                    </span>
                    <span className="text-xs font-semibold opacity-80">{t.format}</span>
                    {isRegistrationOpen && <span className="text-[10px] font-black uppercase px-2 py-1 rounded bg-emerald-300 text-emerald-950">Quick Reg</span>}
                  </div>
                  <div className="font-display text-3xl leading-tight mb-1 relative">{t.name}</div>
                  <div className="text-xs opacity-80">{t.host}</div>
                </div>
                <div className="p-5 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-neutral-500 text-xs font-semibold uppercase mb-0.5">Cabor</div>
                    <div className="font-bold text-neutral-900">{t.sport}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-xs font-semibold uppercase mb-0.5">Mulai</div>
                    <div className="font-bold text-neutral-900">{t.startDate}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-xs font-semibold uppercase mb-0.5">Hadiah</div>
                    <div className="font-bold text-neutral-900">{t.prize >= 1000000 ? `Rp ${(t.prize / 1000000).toFixed(0)}jt` : formatRupiah(t.prize)}</div>
                  </div>
                </div>
                <div className="px-5 pb-5 flex items-center justify-between border-t border-neutral-100 pt-4">
                  <span className="text-xs text-neutral-500"><Users size={12} className="inline mr-1" /> {t.participants} peserta</span>
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#E11D2E' }}>
                    LIHAT DETAIL <ArrowRight size={12} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Create Tournament CTA */}
        <div className="mt-12 bg-neutral-900 text-white rounded-2xl p-8 lg:p-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-3">/ BUAT SENDIRI</div>
            <h3 className="font-display text-4xl lg:text-5xl leading-[0.95] mb-3">PUNYA KOMUNITAS?<br />BIKIN LIGA SENDIRI.</h3>
            <p className="text-neutral-400 max-w-md mb-6">Setup format, undang peserta, klasemen otomatis update. Dukungan untuk 8 cabor termasuk esports.</p>
            <button onClick={onCreate} className="px-6 py-3 text-sm font-bold rounded-full bg-white text-neutral-900 flex items-center gap-2 hover:gap-3 transition-all">
              <Plus size={16} /> BUAT TURNAMEN BARU
            </button>
          </div>
          <div className="space-y-2">
            {[
              { icon: ShieldCheck, t: 'Verifikasi peserta otomatis' },
              { icon: TrendingUp, t: 'Klasemen & statistik real-time' },
              { icon: Trophy, t: 'Bracket knockout / round-robin' },
              { icon: Bell, t: 'Notifikasi jadwal otomatis' },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-center gap-3 bg-neutral-800 p-4 rounded-xl">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#E11D2E' }}>
                    <Icon size={16} />
                  </div>
                  <span className="font-semibold text-sm">{f.t}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const TournamentDetail = ({ tournament, onBack, tab, setTab, auth, openAuth }) => {
  const Icon = sportIcon(tournament.sport);
  const { players, loading: playersLoading, refetch: refetchTournamentPlayers } = useTournamentPlayers(tournament.id);
  const [joining, setJoining] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [showQuickRegistration, setShowQuickRegistration] = useState(false);
  const [showTeamWorkspace, setShowTeamWorkspace] = useState(false);
  const [workspaceContext, setWorkspaceContext] = useState({ registration: null, team: null });

  const supportsQuickRegistration = String(tournament.status || '').toLowerCase() === 'pendaftaran';
  const isTeamTournament = String(tournament.sport || '').toLowerCase() !== 'esports';
  const hasWorkspace = Boolean(workspaceContext.registration && (!isTeamTournament || workspaceContext.team));

  useEffect(() => {
    let active = true;

    async function loadRegistrationContext() {
      if (!auth?.id || !supportsQuickRegistration) {
        if (active) {
          setWorkspaceContext({ registration: null, team: null });
          setRegistered(false);
          setCheckingRegistration(false);
        }
        return;
      }

      setCheckingRegistration(true);
      const context = await fetchRegistrationWorkspaceContext(tournament.id, auth.id);

      if (!active) return;

      setWorkspaceContext(context);
      setRegistered(Boolean(context?.registration));
      setCheckingRegistration(false);
    }

    loadRegistrationContext();

    return () => {
      active = false;
    };
  }, [auth?.id, supportsQuickRegistration, tournament.id]);

  const handleJoinTournament = async () => {
    if (!auth) {
      openAuth('login');
      return;
    }

    if (supportsQuickRegistration) {
      if (hasWorkspace && isTeamTournament) {
        setShowTeamWorkspace(true);
        return;
      }

      if (!isTeamTournament && workspaceContext.registration) {
        setRegistered(true);
        return;
      }

      setShowQuickRegistration(true);
      return;
    }

    setJoining(true);
    const joined = await registerTournamentPlayer(auth.id, tournament.id, {
      playerName: auth.name,
      playerNumber: Math.floor(Math.random() * 99) + 1,
      position: 'Pemain',
      jerseyName: auth.name,
    });
    setJoining(false);

    if (joined) {
      setRegistered(true);
      refetchTournamentPlayers();
    }
  };

  const actionTitle = supportsQuickRegistration
    ? registered
      ? isTeamTournament
        ? 'Workspace tim Anda sudah siap'
        : 'Pendaftaran individu sudah masuk'
      : 'Daftar cepat dan amankan slot'
    : registered
      ? 'Kamu sudah terdaftar'
      : 'Ayo gabung turnamen';

  const actionDescription = supportsQuickRegistration
    ? registered
      ? isTeamTournament
        ? 'Kelola roster, undangan pemain, dan progres pembayaran langsung dari workspace tim.'
        : 'Slot Anda sudah diamankan. Tunggu update jadwal dan verifikasi berikutnya.'
      : 'Selesaikan pendaftaran, pembayaran, dan pembentukan tim dalam satu alur.'
    : 'Daftar sebagai pemain dan dapatkan reward gamifikasi.';

  const actionButtonLabel = supportsQuickRegistration
    ? registered
      ? isTeamTournament
        ? 'Buka Workspace Tim'
        : 'Pendaftaran Terkirim'
      : 'Daftar Cepat'
    : registered
      ? 'Terdaftar'
      : joining
        ? 'Sedang mendaftar...'
        : 'Gabung Turnamen';

  return (
    <div>
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        ← Kembali
      </button>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        {/* Banner */}
        <div className="rounded-2xl p-8 lg:p-12 text-white mb-8 relative overflow-hidden grain" style={{ background: tournament.color }}>
          <div className="absolute -right-10 -bottom-10 opacity-15">
            <Icon size={300} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-white text-black flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E11D2E] pulse-dot" />
              {tournament.status}
            </span>
            <span className="text-xs font-semibold opacity-80">{tournament.format} · {tournament.sport}</span>
          </div>
          <h1 className="font-display text-5xl lg:text-7xl leading-[0.9] mb-3">{tournament.name}</h1>
          <div className="text-sm opacity-80 mb-6">Diselenggarakan oleh {tournament.host}</div>
          <div className="flex flex-wrap gap-6">
            {[
              { l: 'Hadiah', v: formatRupiah(tournament.prize) },
              { l: 'Peserta', v: `${tournament.participants} terdaftar` },
              { l: 'Mulai', v: tournament.startDate },
              { l: 'Format', v: tournament.format },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-xs uppercase tracking-wider opacity-70 mb-0.5">{s.l}</div>
                <div className="font-display text-2xl">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-5 lg:px-8 mb-8">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">Aksi Turnamen</div>
              <div className="text-lg font-bold text-neutral-900">{actionTitle}</div>
              <p className="text-sm text-neutral-600 mt-1">{actionDescription}</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="text-sm text-neutral-500">
                {supportsQuickRegistration
                  ? checkingRegistration
                    ? 'Memuat status pendaftaran...'
                    : registered
                      ? `Status: ${workspaceContext.registration?.registration_status || 'draft'}`
                      : `${tournament.participants} slot terdaftar`
                  : playersLoading
                    ? 'Memuat peserta...'
                    : `${players.length} pemain terdaftar`}
              </div>
              <button
                onClick={handleJoinTournament}
                disabled={joining || checkingRegistration || (supportsQuickRegistration && registered && !isTeamTournament)}
                className={`px-5 py-3 rounded-full font-bold text-sm transition ${(registered && (!supportsQuickRegistration || !isTeamTournament)) ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed' : 'bg-[#E11D2E] text-white hover:bg-[#C81D1D]'}`}
              >
                {actionButtonLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-300 mb-8 flex gap-2 overflow-x-auto">
          {[
            ...(tournament.format !== 'Knockout' ? [{ id: 'klasemen', label: 'Klasemen' }] : []),
            ...(tournament.format === 'Knockout' || BRACKETS[tournament.id] ? [{ id: 'bagan', label: 'Bagan' }] : []),
            { id: 'jadwal', label: 'Jadwal' },
            { id: 'statistik', label: 'Statistik' },
          ].map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`px-5 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition ${
                tab === tabItem.id ? 'border-[#E11D2E] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'klasemen' && tournament.standings && (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 uppercase text-xs">
                    <th className="text-left px-4 py-3 font-bold w-12">#</th>
                    <th className="text-left px-4 py-3 font-bold">Tim</th>
                    <th className="text-center px-3 py-3 font-bold">P</th>
                    <th className="text-center px-3 py-3 font-bold">W</th>
                    <th className="text-center px-3 py-3 font-bold">D</th>
                    <th className="text-center px-3 py-3 font-bold">L</th>
                    <th className="text-center px-3 py-3 font-bold">GF</th>
                    <th className="text-center px-3 py-3 font-bold">GA</th>
                    <th className="text-center px-3 py-3 font-bold bg-neutral-100">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {tournament.standings.map((row, i) => (
                    <tr key={row.team} className={`border-t border-neutral-100 ${i < 2 ? 'bg-green-50/40' : ''}`}>
                      <td className="px-4 py-4 font-display text-xl">
                        {i < 2 && <span className="inline-block w-1 h-5 mr-2 align-middle" style={{ background: '#E11D2E' }} />}
                        {row.pos}
                      </td>
                      <td className="px-4 py-4 font-bold text-neutral-900">{row.team}</td>
                      <td className="text-center px-3 py-4">{row.p}</td>
                      <td className="text-center px-3 py-4 text-green-700 font-bold">{row.w}</td>
                      <td className="text-center px-3 py-4">{row.d}</td>
                      <td className="text-center px-3 py-4 text-red-700">{row.l}</td>
                      <td className="text-center px-3 py-4">{row.gf}</td>
                      <td className="text-center px-3 py-4">{row.ga}</td>
                      <td className="text-center px-3 py-4 font-display text-xl bg-neutral-50">{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex flex-wrap gap-4">
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" /> Kualifikasi Playoff</span>
              <span>P: Played · W: Win · D: Draw · L: Loss · GF: Goals For · GA: Goals Against · PTS: Points</span>
            </div>
          </div>
        )}

        {tab === 'jadwal' && tournament.schedule && (
          <div className="space-y-3">
            {tournament.schedule.map((m, i) => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 flex items-center gap-4 flex-wrap">
                <div className="w-16 text-center shrink-0">
                  <div className="font-display text-2xl text-neutral-900 leading-none">{m.date.split(' ')[0]}</div>
                  <div className="text-xs text-neutral-500 uppercase font-bold">{m.date.split(' ')[1]}</div>
                </div>
                <div className="flex-1 grid grid-cols-3 items-center gap-3 min-w-[280px]">
                  <div className="text-right font-bold">{m.home}</div>
                  <div className="text-center">
                    {m.status === 'done' ? (
                      <div className="font-display text-2xl">{m.score}</div>
                    ) : m.status === 'live' ? (
                      <div className="font-display text-lg" style={{ color: '#E11D2E' }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E11D2E] mr-1.5 pulse-dot" />
                        LIVE
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500 font-bold">vs</div>
                    )}
                  </div>
                  <div className="text-left font-bold">{m.away}</div>
                </div>
                <div className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                  m.status === 'done' ? 'bg-neutral-100 text-neutral-600' :
                  m.status === 'live' ? 'bg-[#E11D2E] text-white' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {m.status === 'done' ? 'Selesai' : m.status === 'live' ? 'Live' : 'Mendatang'}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'bagan' && <TournamentBracket tournamentId={tournament.id} />}

        {tab === 'statistik' && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-8">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { l: 'Top Scorer', v: 'Aldi Pratama', sub: 'FC Senayan · 8 gol' },
                { l: 'Tim Terproduktif', v: 'FC Senayan United', sub: '32 gol dalam 8 laga' },
                { l: 'Pertahanan Terbaik', v: 'FC Senayan United', sub: 'Hanya 8 kebobolan' },
                { l: 'Kemenangan Beruntun', v: 'Tebet Tigers', sub: '5 laga tanpa kalah' },
                { l: 'Total Pertandingan', v: '24 / 36', sub: 'Match selesai' },
                { l: 'Total Gol', v: '127', sub: 'Rata-rata 5.3 per laga' },
              ].map((s, i) => (
                <div key={i} className="border border-neutral-200 rounded-xl p-5">
                  <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-2">/ {s.l}</div>
                  <div className="font-display text-2xl text-neutral-900 mb-1">{s.v}</div>
                  <div className="text-sm text-neutral-500">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!tournament.standings && tab === 'klasemen' && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
            <Trophy size={32} className="mx-auto mb-3 text-neutral-400" />
            <div className="font-display text-2xl text-neutral-900 mb-2">Belum Ada Data</div>
            <p className="text-sm text-neutral-500">Turnamen akan dimulai pada {tournament.startDate}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ NEWS ============
const NewsPage = ({ onSelect, news }) => {
  const safeNews = Array.isArray(news) ? news : [];
  const featured = safeNews.find(n => n.featured);
  const rest = safeNews.filter(n => !n.featured);
  const [cat, setCat] = useState('Semua');
  const cats = ['Semua', ...new Set(safeNews.map(n => n.category))];
  const filtered = cat === 'Semua' ? rest : rest.filter(n => n.category === cat);

  return (
    <div>
      <SectionHero
        kicker="/ FITUR 03"
        title={<>BERITA<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>&amp; media.</span></>}
        subtitle="Newsroom olahraga Indonesia. Update tercepat, analisa terdalam, dari 8 cabor olahraga."
      />

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        {/* Featured */}
        {featured && (
          <article className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-16 cursor-pointer group" onClick={() => onSelect(featured)}>
            <div className="aspect-[4/3] relative overflow-hidden rounded-2xl grain order-2 lg:order-1" style={{ background: featured.color }}>
              <div className="absolute top-6 left-6 text-xs font-bold px-3 py-1 bg-white text-neutral-900 uppercase">{featured.category}</div>
              <div className="absolute bottom-6 left-6 text-xs font-bold px-3 py-1 bg-black/30 backdrop-blur text-white rounded-full">FEATURED</div>
            </div>
            <div className="flex flex-col justify-center order-1 lg:order-2">
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">{featured.date} · {featured.read} baca · oleh {featured.author}</div>
              <h2 className="font-display text-4xl lg:text-6xl text-neutral-900 leading-[0.9] mb-4 group-hover:text-[#E11D2E] transition">{featured.title}</h2>
              <p className="text-lg text-neutral-600 mb-6 max-w-lg">{featured.excerpt}</p>
              <div className="flex items-center gap-2 text-sm font-bold">
                BACA SELENGKAPNYA <ArrowRight size={14} style={{ color: '#E11D2E' }} />
              </div>
            </div>
          </article>
        )}

        {/* Categories */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
          <span className="text-xs uppercase tracking-widest font-bold text-neutral-500 shrink-0">/ Kategori</span>
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition ${
                cat === c ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((n, i) => (
            <article key={n.id} onClick={() => onSelect(n)} className="cursor-pointer group fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="aspect-[4/3] mb-4 relative overflow-hidden grain rounded-xl" style={{ background: n.color }}>
                <div className="absolute top-4 left-4 text-[10px] font-bold px-2 py-1 bg-white text-neutral-900 uppercase tracking-wider">{n.category}</div>
              </div>
              <div className="text-xs text-neutral-500 mb-2 font-semibold uppercase tracking-wider">{n.date} · {n.read}</div>
              <h3 className="font-display text-2xl leading-tight text-neutral-900 group-hover:text-[#E11D2E] transition mb-2">{n.title}</h3>
              <p className="text-sm text-neutral-600 line-clamp-2">{n.excerpt}</p>
              <div className="text-xs text-neutral-500 mt-3 font-semibold">oleh {n.author}</div>
            </article>
          ))}
        </div>

        {/* Newsletter */}
        <div className="mt-16 rounded-2xl bg-neutral-900 text-white p-8 lg:p-12 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-3">/ NEWSLETTER</div>
            <h3 className="font-display text-4xl lg:text-5xl leading-[0.95]">UPDATE OLAHRAGA<br /><span className="font-serif-it" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: '#E11D2E' }}>tiap pagi.</span></h3>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 px-5 py-4 rounded-full bg-neutral-800 text-white placeholder:text-neutral-500 outline-none border border-neutral-700 focus:border-white" placeholder="email@kamu.com" />
            <button className="px-6 py-4 rounded-full bg-white text-neutral-900 font-bold text-sm">DAFTAR</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ TRAINING ============
const TrainingPage = ({ onCoachDashboard, onCoachSelect, coaches }) => {
  const [filter, setFilter] = useState('Semua');
  const filtered = filter === 'Semua' ? (coaches && coaches.length > 0 ? coaches : COACHES) : (coaches && coaches.length > 0 ? coaches : COACHES).filter(c => c.sport === filter);

  return (
    <div>
      <SectionHero
        kicker="/ FITUR 04"
        title={<>PELATIHAN<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>&amp; pelatih.</span></>}
        subtitle="Booking sesi private dengan pelatih bersertifikasi. Dari pemula sampai atlet kompetitif."
        action={
          <button onClick={onCoachDashboard} className="px-6 py-3 text-sm font-bold rounded-full bg-neutral-900 text-white flex items-center gap-2 hover-lift">
            <Dumbbell size={16} /> SAYA PELATIH
          </button>
        }
      />

      <div className="border-b border-neutral-300 bg-white sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex items-center gap-3 overflow-x-auto">
          <Filter size={16} className="text-neutral-500 shrink-0" />
          {SPORTS_COACH.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 px-4 py-2 text-sm font-bold rounded-full uppercase tracking-wider transition ${
                filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((c, i) => (
            <div key={c.id} onClick={() => onCoachSelect(c)} className="bg-white rounded-2xl overflow-hidden hover-lift fade-up border border-neutral-200 cursor-pointer" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="p-6 flex items-center gap-4 border-b border-neutral-100">
                <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl text-white shrink-0" style={{ background: '#E11D2E' }}>
                  {c.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl text-neutral-900 leading-tight truncate">{c.name}</div>
                  <div className="text-sm text-neutral-500">{c.sport} · {c.exp} tahun pengalaman</div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star size={14} fill="#E11D2E" color="#E11D2E" />
                    <span className="font-bold">{c.rating}</span>
                    <span className="text-neutral-500">({c.sessions} sesi)</span>
                  </div>
                </div>
                <div className="space-y-1.5 mb-5">
                  {c.certs.map(cert => (
                    <div key={cert} className="flex items-center gap-2 text-xs text-neutral-600">
                      <CheckCircle size={12} style={{ color: '#E11D2E' }} />
                      {cert}
                    </div>
                  ))}
                </div>
                <div className="flex items-end justify-between border-t border-neutral-100 pt-4">
                  <div>
                    <div className="text-xs text-neutral-500 font-semibold">Per sesi</div>
                    <div className="font-display text-2xl text-neutral-900 leading-none">{formatRupiah(c.price)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onCoachSelect(c); }} className="px-4 py-2 text-xs font-bold rounded-full text-white" style={{ background: '#E11D2E' }}>
                    LIHAT PROFIL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Programs */}
        <div className="border-t border-neutral-300 pt-12">
          <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ PROGRAM PAKET</div>
          <h2 className="font-display text-4xl lg:text-6xl text-neutral-900 leading-[0.9] mb-8">PAKET LATIHAN POPULER</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: 'PAKET PEMULA', sessions: 8, price: 1400000, desc: 'Cocok untuk yang baru mulai. Fokus dasar teknik & fitness.', tag: 'PALING DICARI' },
              { name: 'PAKET INTERMEDIATE', sessions: 16, price: 2600000, desc: 'Tingkatkan performa dengan program 2 bulan terstruktur.', tag: 'BEST VALUE' },
              { name: 'PAKET ATLET', sessions: 32, price: 4800000, desc: 'Persiapan kompetitif. Termasuk video analisis & nutrisi.', tag: 'PRO' },
            ].map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 ${i === 1 ? 'bg-neutral-900 text-white border-2 border-[#E11D2E]' : 'bg-white border border-neutral-200'}`}>
                <div className={`text-xs font-bold mb-3 ${i === 1 ? 'text-[#E11D2E]' : 'text-neutral-500'}`}>{p.tag}</div>
                <div className="font-display text-3xl mb-1 leading-tight">{p.name}</div>
                <div className={`text-sm mb-5 ${i === 1 ? 'text-neutral-400' : 'text-neutral-600'}`}>{p.desc}</div>
                <div className="font-display text-4xl mb-1">{formatRupiah(p.price)}</div>
                <div className={`text-xs mb-6 ${i === 1 ? 'text-neutral-400' : 'text-neutral-500'}`}>{p.sessions} sesi · sekitar {formatRupiah(Math.round(p.price / p.sessions))}/sesi</div>
                <button className={`w-full py-3 rounded-full text-sm font-bold transition ${
                  i === 1 ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'
                }`}>
                  PILIH PAKET
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ SHARED ============
const SectionHero = ({ kicker, title, subtitle, action }) => (
  <section className="border-b border-neutral-300 relative overflow-hidden grain" style={{ background: '#F4F4F4' }}>
    <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #E11D2E, transparent 70%)' }} />
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-20 relative">
      <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-4">{kicker}</div>
      <div className="grid lg:grid-cols-2 gap-8 items-end">
        <h1 className="font-display text-6xl lg:text-9xl leading-[0.85] text-neutral-900">{title}</h1>
        <div>
          <p className="text-lg text-neutral-700 max-w-md mb-6">{subtitle}</p>
          {action}
        </div>
      </div>
    </div>
  </section>
);

const Footer = ({ onNav, onCoachDashboard }) => (
  <footer className="border-t border-neutral-300 bg-neutral-900 text-white">
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12 lg:py-16">
      <div className="grid lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2.5 mb-5">
            <Logo size={36} />
            <span className="font-display skewed text-3xl text-white">STADIONE</span>
          </div>
          <p className="text-neutral-400 max-w-sm mb-6 leading-relaxed">Platform olahraga Indonesia. Booking lapangan, ikut turnamen, baca berita, latihan bareng pelatih — satu aplikasi.</p>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block w-2 h-2 rounded-full pulse-dot" style={{ background: '#E11D2E' }} />
            Aktif di 12 kota · 24/7
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-4">Fitur</div>
          <ul className="space-y-2 text-sm">
            <li><button onClick={() => onNav('booking')} className="text-neutral-300 hover:text-white">Booking Lapangan</button></li>
            <li><button onClick={() => onNav('tournament')} className="text-neutral-300 hover:text-white">Turnamen & Liga</button></li>
            <li><button onClick={() => onNav('community')} className="text-neutral-300 hover:text-white">Komunitas</button></li>
            <li><button onClick={() => onNav('news')} className="text-neutral-300 hover:text-white">Berita</button></li>
            <li><button onClick={() => onNav('training')} className="text-neutral-300 hover:text-white">Pelatihan</button></li>
            <li><button onClick={onCoachDashboard} className="text-[#E11D2E] hover:text-white font-bold">Dashboard Pelatih →</button></li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-4">Perusahaan</div>
          <ul className="space-y-2 text-sm">
            <li><span className="text-neutral-300">Tentang Kami</span></li>
            <li><button onClick={() => onNav('kerjasama')} className="text-neutral-300 hover:text-white">Kerjasama</button></li>
            <li><span className="text-neutral-300">Karir</span></li>
            <li><span className="text-neutral-300">Press Kit</span></li>
            <li><span className="text-neutral-300">Kontak</span></li>
          </ul>
        </div>
        <div className="lg:col-span-3">
          <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-4">Newsletter</div>
          <p className="text-sm text-neutral-400 mb-3">Dapatkan update mingguan</p>
          <div className="flex gap-2">
            <input className="flex-1 px-4 py-3 rounded-full bg-neutral-800 text-sm border border-neutral-700 outline-none placeholder:text-neutral-500" placeholder="email@kamu.com" />
            <button className="px-4 py-3 rounded-full text-sm font-bold text-white" style={{ background: '#E11D2E' }}>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-800 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-neutral-500">© 2026 Stadione · Made with passion in Indonesia</div>
        <div className="flex gap-4 text-xs text-neutral-500">
          <span>Syarat & Ketentuan</span>
          <span>Privasi</span>
          <span>Cookies</span>
        </div>
      </div>
    </div>
  </footer>
);

// ============ LOGIN MODAL ============
const AUTH_MODAL_MODES = {
  login: 'login',
  register: 'register',
  forgotPassword: 'forgot-password',
  recovery: 'recovery',
};

// Base timeouts — generous enough for Vercel → Supabase latency
const AUTH_REQUEST_TIMEOUT_MS = 25000; // Primary login: 25s (production latency buffer)
const AUTH_FALLBACK_TIMEOUT_MS = 35000; // Fallback: 35s if primary fails
const AUTH_LOGIN_PRIMARY_TIMEOUT_MS = 25000; // Avoid premature abort on slow production links
const AUTH_SET_SESSION_TIMEOUT_MS = 25000; // Allow Supabase session sync to finish on high latency
const AUTH_DISABLE_CLIENT_TIMEOUT_FOR_PASSWORD = false; // Keep false by default; native signIn path is now primary
const AUTH_OAUTH_TIMEOUT_MS = 30000; // OAuth: 30s (external services)
const AUTH_FORGOT_PASSWORD_TIMEOUT_MS = 45000; // Reset password email
const APP_PRODUCTION_ORIGIN = 'https://stadione.vercel.app';

// Track in-flight auth requests to prevent duplicates
let authSubmitRequest = createRequestTracker();

// ============ INPUT VALIDATION ============
function validateEmail(email) {
  const normalized = email.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!normalized) return { valid: false, error: 'Email tidak boleh kosong' };
  if (!regex.test(normalized)) return { valid: false, error: 'Format email tidak valid' };
  if (normalized.length > 254) return { valid: false, error: 'Email terlalu panjang' };
  return { valid: true, value: normalized };
}

function validatePassword(password) {
  if (!password) return { valid: false, error: 'Password tidak boleh kosong' };
  if (password.length < 6) return { valid: false, error: 'Password minimal 6 karakter' };
  if (password.length > 128) return { valid: false, error: 'Password terlalu panjang' };
  return { valid: true, value: password };
}

function validateName(name) {
  const normalized = name.trim();
  if (!normalized) return { valid: false, error: 'Nama tidak boleh kosong' };
  if (normalized.length < 2) return { valid: false, error: 'Nama minimal 2 karakter' };
  if (normalized.length > 100) return { valid: false, error: 'Nama terlalu panjang' };
  return { valid: true, value: normalized };
}

function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
  return { score: strength, max: 5 };
}

function getAuthRedirectUrl(mode) {
  if (typeof window === 'undefined') return undefined;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // Always redirect to production URL unless running locally.
  // This ensures password reset / OAuth links in emails always work,
  // even when the reset was requested from a Vercel preview URL.
  const baseOrigin = isLocalhost
    ? window.location.origin
    : APP_PRODUCTION_ORIGIN;

  const url = new URL(baseOrigin);
  if (mode) url.searchParams.set('auth_mode', mode);
  return url.toString();
}

function shouldForceCanonicalAuthHost() {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost) return false;

  if (!(hostname.endsWith('.vercel.app') && hostname !== 'stadione.vercel.app')) {
    return false;
  }

  const params = getAuthUrlParams();
  const authKeys = [
    'code',
    'type',
    'auth_mode',
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
    'error',
    'error_code',
    'error_description',
    'recovery_token',
  ];

  // Only force host redirect for real auth callback flows.
  return authKeys.some((key) => params.has(key));
}

function shouldMoveToCanonicalBeforeOAuth() {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost) return false;

  return hostname.endsWith('.vercel.app') && hostname !== 'stadione.vercel.app';
}

function buildCanonicalCurrentUrl() {
  const targetUrl = new URL(APP_PRODUCTION_ORIGIN);
  targetUrl.pathname = window.location.pathname;
  targetUrl.search = window.location.search;
  targetUrl.hash = window.location.hash;
  return targetUrl.toString();
}

function redirectToCanonicalAuthHost() {
  if (!shouldForceCanonicalAuthHost()) return false;

  window.location.replace(buildCanonicalCurrentUrl());
  return true;
}

function getAuthModeFromUrl() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('auth_mode') || null;
}

function hasRecoveryParamsInUrl() {
  const params = getAuthUrlParams();
  const type = String(params.get('type') || '').toLowerCase();

  // Only treat as recovery when `type=recovery` or a dedicated recovery_token is present.
  // Checking for a bare `access_token` is intentionally removed: the OAuth callback
  // URL hash also contains an access_token, and falsely detecting that as a recovery
  // flow prevents `setShowAuth(false)` from running after Google login.
  return (
    type === 'recovery' ||
    params.has('recovery_token')
  );
}

function getAuthUrlParams() {
  if (typeof window === 'undefined') return new URLSearchParams();

  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash || '');

  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

function getAuthErrorFromUrl() {
  const params = getAuthUrlParams();
  return params.get('error_description') || params.get('error') || '';
}

function clearAuthUrlArtifacts() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete('auth_mode');
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  url.searchParams.delete('type');
  url.searchParams.delete('access_token');
  url.searchParams.delete('refresh_token');
  url.searchParams.delete('expires_at');
  url.searchParams.delete('expires_in');
  url.searchParams.delete('token_type');
  url.searchParams.delete('recovery_token');
  url.hash = '';
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

function mapAuthErrorMessage(error) {
  const rawMessage = String(error?.message || '').trim();
  const message = rawMessage.toLowerCase();

  if (!rawMessage) return 'Terjadi kesalahan. Silakan coba lagi.';
  
  // Timeout & Network
  if (message.includes('timeout')) return 'Koneksi lambat. Cek internet Anda dan coba lagi.';
  if (message.includes('network') || message.includes('connection') || message.includes('failed to fetch')) 
    return 'Masalah jaringan. Periksa koneksi internet Anda.';
  if (message.includes('cors') || message.includes('cross-origin')) 
    return 'Masalah server. Hubungi admin untuk setup CORS.';
  
  // Configuration
  if (message.includes('supabase belum')) return rawMessage;
  if (message.includes('invalid api key')) return 'Konfigurasi Supabase production tidak valid. Hubungi admin.';
  if (message.includes('provider is not enabled') || message.includes('google_oauth')) 
    return 'Login Google belum aktif. Hubungi admin.';
  if (message.includes('redirect') || message.includes('not allowed')) 
    return 'Domain tidak terdaftar di Supabase. Hubungi admin.';
  
  // Rate limiting
  if (message.includes('rate limit') || message.includes('too many')) 
    return 'Terlalu banyak percobaan. Tunggu 5 menit dan coba lagi.';
  
  // Login/Password
  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) 
    return 'Email atau password tidak cocok.';
  if (message.includes('invalid password') || message.includes('weak password'))
    return 'Password tidak memenuhi kriteria keamanan.';
  if (message.includes('password should be at least')) 
    return 'Password minimal 6 karakter.';
  
  // Email
  if (message.includes('email not confirmed') || message.includes('email_not_verified') || message.includes('email verification'))
    return 'Email belum diverifikasi. Cek email Anda.';
  if (message.includes('unable to validate email address') || message.includes('invalid_email'))
    return 'Format email tidak valid.';
  if (message.includes('user already registered')) 
    return 'Email sudah terdaftar. Silakan login.';
  
  // Session
  if (message.includes('auth session missing') || message.includes('session not found') || message.includes('no session'))
    return 'Sesi berakhir. Minta link reset password baru.';
  if (message.includes('invalid session'))
    return 'Sesi tidak valid. Silakan login ulang.';
  if (message.includes('akun ini diblokir'))
    return 'Akun ini diblokir. Hubungi super admin.';
  if (message.includes('akun ini dinonaktifkan'))
    return 'Akun ini dinonaktifkan. Hubungi super admin.';
  
  // OAuth
  if (message.includes('oauth') || message.includes('google')) 
    return 'Login Google gagal. Coba login dengan email.';
  
  return rawMessage || 'Terjadi kesalahan. Silakan coba lagi.';
}

function createModerationAuthError(kind = 'blocked') {
  const isDisabled = kind === 'disabled';
  const error = new Error(
    isDisabled
      ? 'Akun ini dinonaktifkan. Hubungi super admin.'
      : 'Akun ini diblokir. Hubungi super admin.'
  );
  error.code = isDisabled ? 'ACCOUNT_DISABLED' : 'ACCOUNT_BLOCKED';
  return error;
}

function isModerationAuthError(error) {
  return error?.code === 'ACCOUNT_BLOCKED' || error?.code === 'ACCOUNT_DISABLED';
}

async function getSupabaseAuthClient() {
  if (!SUPABASE_CONFIGURED || !supabase?.auth) {
    throw new Error(SUPABASE_ERROR || 'Supabase belum dikonfigurasi. Login belum bisa digunakan.');
  }

  return supabase;
}

async function withAuthTimeout(
  promise,
  label = 'Auth request',
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
  options = {},
) {
  // OPTIMIZED: Use adaptive timeout based on connection quality
  const adaptiveTimeoutMs = options?.disableAdaptive ? timeoutMs : getAdaptiveAuthTimeout(timeoutMs);
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      console.warn(`${label} timeout setelah ${Math.round(adaptiveTimeoutMs / 1000)} detik (${navigator.connection?.effectiveType || 'unknown'} connection).`);
      reject(new Error(`${label} timeout setelah ${Math.round(adaptiveTimeoutMs / 1000)} detik. Periksa koneksi internet Anda.`));
    }, adaptiveTimeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timerId);
    return result;
  } catch (error) {
    clearTimeout(timerId);
    throw error;
  }
}

function isTimeoutError(error) {
  return String(error?.message || '').toLowerCase().includes('timeout');
}

function createAuthAttemptTrace(mode, email = '') {
  const attemptId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return {
    attemptId,
    mode,
    emailHint: normalizedEmail ? normalizedEmail.replace(/^[^@]+/, '***') : '',
    startedAt: Date.now(),
  };
}

function pushAuthTrace(trace, event, payload = {}, level = 'info') {
  if (!trace) return;

  const entry = {
    attemptId: trace.attemptId,
    mode: trace.mode,
    emailHint: trace.emailHint,
    event,
    elapsedMs: Date.now() - trace.startedAt,
    at: new Date().toISOString(),
    ...payload,
  };

  if (typeof window !== 'undefined') {
    const bucket = window.__stadioneAuthDebug || { events: [] };
    const events = Array.isArray(bucket.events) ? bucket.events : [];
    bucket.events = [...events, entry].slice(-200);
    bucket.last = entry;
    window.__stadioneAuthDebug = bucket;
  }

  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logger('[AUTH TRACE]', entry);
}

async function signInWithPasswordFallback({ email, password, trace = null, disableClientTimeout = false }) {
  const controller = (!disableClientTimeout && typeof AbortController !== 'undefined') ? new AbortController() : null;
  const fetchTimeoutMs = disableClientTimeout ? null : AUTH_LOGIN_PRIMARY_TIMEOUT_MS;
  const fetchTimer = (controller && fetchTimeoutMs)
    ? setTimeout(() => controller.abort(), fetchTimeoutMs)
    : null;

  pushAuthTrace(trace, 'fallback_fetch_start', {
    timeoutMs: fetchTimeoutMs,
    disableClientTimeout,
  });
  const fetchStartedAt = Date.now();

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: controller?.signal,
    });
  } catch (fetchError) {
    if (fetchTimer) clearTimeout(fetchTimer);
    const isAbort = String(fetchError?.name || '').toLowerCase() === 'aborterror';
    const message = isAbort
      ? `Login (fallback fetch) timeout${fetchTimeoutMs ? ` setelah ${Math.round(fetchTimeoutMs / 1000)} detik` : ''}.`
      : String(fetchError?.message || fetchError);
    pushAuthTrace(trace, 'fallback_fetch_error', { message }, 'error');
    throw new Error(message);
  } finally {
    if (fetchTimer) clearTimeout(fetchTimer);
  }

  pushAuthTrace(trace, 'fallback_fetch_done', {
    status: response.status,
    durationMs: Date.now() - fetchStartedAt,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    pushAuthTrace(trace, 'fallback_fetch_failed', {
      status: response.status,
      reason: payload?.error_description || payload?.msg || 'invalid token payload',
    }, 'warn');
    throw new Error(payload?.error_description || payload?.msg || 'Login gagal. Silakan coba lagi.');
  }

  pushAuthTrace(trace, 'set_session_start');
  const setSessionStartedAt = Date.now();
  const sessionPromise = supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  const sessionResult = disableClientTimeout
    ? await sessionPromise
    : await withAuthTimeout(
      sessionPromise,
      'Set auth session',
      AUTH_SET_SESSION_TIMEOUT_MS,
      { disableAdaptive: true },
    );

  pushAuthTrace(trace, 'set_session_done', {
    durationMs: Date.now() - setSessionStartedAt,
    hasError: Boolean(sessionResult?.error),
  }, sessionResult?.error ? 'warn' : 'info');

  if (sessionResult?.error) throw sessionResult.error;

  pushAuthTrace(trace, 'fallback_success', {
    hasUser: Boolean(payload?.user || sessionResult?.data?.user),
  });

  return { user: payload?.user || sessionResult?.data?.user || null };
}

function mapAuthUser(user) {
  if (!user) return null;

  const normalizedRoles = normalizeRoles(Array.isArray(user.roles) ? user.roles : []);
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const memberVerification = (() => {
    const raw = user?.user_metadata?.member_verification;
    if (!raw || typeof raw !== 'object') return null;
    return {
      citizenshipStatus: String(raw.citizenshipStatus || '').trim() || 'WNI',
      phone: String(raw.phone || '').trim(),
      nik: String(raw.nik || '').trim(),
      passportNo: String(raw.passportNo || '').trim(),
      country: String(raw.country || '').trim(),
      province: String(raw.province || '').trim(),
      city: String(raw.city || '').trim(),
      district: String(raw.district || '').trim(),
      postalCode: String(raw.postalCode || '').trim(),
      address: String(raw.address || '').trim(),
      rt: String(raw.rt || '').trim(),
      rw: String(raw.rw || '').trim(),
      ktpPhotoUrl: String(raw.ktpPhotoUrl || '').trim(),
      postPhotoUrl: String(raw.postPhotoUrl || '').trim(),
      verifiedMember: Boolean(raw.verifiedMember),
      verifiedAt: raw.verifiedAt || null,
    };
  })();

  return {
    name: user.user_metadata?.name || user.name || user.email?.split('@')[0] || 'User',
    email: user.email || user.registrant_email || '',
    id: user.id,
    roles: normalizedRoles,
    roleBadges: getUserRoleBadges(normalizedRoles, user.roleProfiles || []),
    activeContext: user.activeContext || null,
    permissions,
    access: user.access || deriveConsoleAccess(normalizedRoles, permissions),
    memberVerification,
    verifiedMember: Boolean(user?.user_metadata?.verified_member || memberVerification?.verifiedMember),
    rawMetadata: user?.user_metadata || {},
  };
}

/**
 * OPTIMIZED: Parallel data fetching with caching
 * ~65% faster than sequential fetching (1900ms savings)
 */
async function enrichAuthUser(user) {
  const mappedUser = mapAuthUser(user);
  if (!mappedUser?.id) return null;

  // Check cache first (5-min TTL)
  const cached = authSessionCache.get(mappedUser.id);
  if (cached) return cached;

  try {
    const perfLabel = `enrich_user_${mappedUser.id?.slice(0, 8)}`;
    authPerfTracker.start(perfLabel);

    const storedActiveContext = getStoredActiveWorkspaceContext(mappedUser.id);

    // ⚡ PARALLEL: Fetch all user data at the same time (not sequential)
    const [roleProfiles, allRoles, permissions, activeContext, moderationStatus] = await Promise.all([
      fetchCurrentUserRoleProfiles(),
      fetchCurrentUserRoles(),
      fetchCurrentUserPermissions(),
      fetchCurrentUserActiveContext(),
      fetchCurrentUserModerationStatus(),
    ]);

    if (moderationStatus?.is_disabled) {
      throw createModerationAuthError('disabled');
    }

    if (moderationStatus?.is_blocked) {
      throw createModerationAuthError('blocked');
    }

    const roles = normalizeRoles((roleProfiles || []).map((profile) => profile.role));
    const effectiveRoles = roles.length > 0 ? roles : (allRoles || []);
    const effectiveActiveContext = activeContext || storedActiveContext || null;

    if (effectiveActiveContext) {
      setStoredActiveWorkspaceContext(mappedUser.id, effectiveActiveContext);
    }

    const enrichedUser = {
      ...mappedUser,
      roles: effectiveRoles,
      roleProfiles,
      roleBadges: getUserRoleBadges(effectiveRoles, roleProfiles),
      activeContext: effectiveActiveContext,
      moderation: moderationStatus,
      permissions,
      access: deriveConsoleAccess(effectiveRoles, permissions),
    };

    // Cache the enriched user
    authSessionCache.set(mappedUser.id, enrichedUser);
    cacheAuthStateLocally(mappedUser.id, enrichedUser);

    authPerfTracker.end(perfLabel, { roles: effectiveRoles.length, cached: false });

    return enrichedUser;
  } catch (err) {
    if (isModerationAuthError(err)) {
      throw err;
    }

    console.error('Failed to enrich auth user:', err);
    const storedActiveContext = getStoredActiveWorkspaceContext(mappedUser.id);
    return {
      ...mappedUser,
      roles: [],
      roleBadges: [],
      activeContext: storedActiveContext,
      permissions: [],
      access: deriveConsoleAccess([], []),
    };
  }
}

/**
 * LEGACY VERSION (kept for reference)
 * This was the old sequential version - now replaced with optimized parallel version
 */
async function _enrichAuthUser_LEGACY(user) {
  const mappedUser = mapAuthUser(user);
  if (!mappedUser?.id) return null;

  try {
    const storedActiveContext = getStoredActiveWorkspaceContext(mappedUser.id);
    const roleProfiles = await fetchCurrentUserRoleProfiles();
    const roles = normalizeRoles((roleProfiles || []).map((profile) => profile.role));
    const effectiveRoles = roles.length > 0 ? roles : await fetchCurrentUserRoles();
    const permissions = await fetchCurrentUserPermissions();
    const activeContext = await fetchCurrentUserActiveContext();
    const effectiveActiveContext = activeContext || storedActiveContext || null;

    if (effectiveActiveContext) {
      setStoredActiveWorkspaceContext(mappedUser.id, effectiveActiveContext);
    }

    return {
      ...mappedUser,
      roles: effectiveRoles,
      roleProfiles,
      roleBadges: getUserRoleBadges(effectiveRoles, roleProfiles),
      activeContext: effectiveActiveContext,
      permissions,
      access: deriveConsoleAccess(effectiveRoles, permissions),
    };
  } catch (err) {
    console.error('Failed to enrich auth user:', err);
    const storedActiveContext = getStoredActiveWorkspaceContext(mappedUser.id);
    return {
      ...mappedUser,
      roles: [],
      roleBadges: [],
      activeContext: storedActiveContext,
      permissions: [],
      access: deriveConsoleAccess([], []),
    };
  }
}



const LoginModal = ({ open, mode: initMode, initialError, onClose, onAuth }) => {
  const [mode, setMode] = useState(initMode || AUTH_MODAL_MODES.login);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRetryable, setIsRetryable] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!initMode) return;
    setMode(initMode);
    setError('');
    setSuccessMessage('');
  }, [initMode]);

  useEffect(() => {
    if (!open || !initialError) return;
    setError(mapAuthErrorMessage({ message: initialError }));
    setSuccessMessage('');
  }, [open, initialError]);

  if (!open) return null;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setIsRetryable(false);
    setSuccessMessage('');
    if (nextMode !== AUTH_MODAL_MODES.register) setName('');
    if (nextMode !== AUTH_MODAL_MODES.recovery) {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleGoogleAuth = async () => {
    if (shouldMoveToCanonicalBeforeOAuth()) {
      window.location.assign(buildCanonicalCurrentUrl());
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const supabase = await getSupabaseAuthClient();
      const { error: oauthError } = await withAuthTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: getAuthRedirectUrl(),
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            },
          },
        }),
        'Login Google',
        AUTH_OAUTH_TIMEOUT_MS
      );

      if (oauthError) throw oauthError;
    } catch (err) {
      console.error('Google auth error:', err);
      setError(mapAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // OPTIMIZED: Prevent duplicate submissions
    if (authSubmitRequest.isInFlight()) {
      console.warn('[AUTH] Submission already in progress, ignoring duplicate submit');
      return;
    }

    authSubmitRequest.start();
    setError('');
    setIsRetryable(false);
    setSuccessMessage('');
    setLoading(true);

    const perfLabel = `auth_${mode}_submit`;
    authPerfTracker.start(perfLabel);
    let authTrace = null;
    let supabaseClient = null;

    const recoverExistingSession = async (reason = 'unknown') => {
      if (!supabaseClient?.auth) return false;

      pushAuthTrace(authTrace, 'session_recovery_start', { reason });
      try {
        const sessionResult = await withAuthTimeout(
          supabaseClient.auth.getSession(),
          'Session recovery',
          AUTH_SET_SESSION_TIMEOUT_MS,
          { disableAdaptive: true },
        );

        const recoveredUser = sessionResult?.data?.session?.user || null;
        if (!recoveredUser) {
          pushAuthTrace(authTrace, 'session_recovery_empty', { reason }, 'warn');
          return false;
        }

        pushAuthTrace(authTrace, 'session_recovery_success', {
          reason,
          userId: recoveredUser.id,
        });

        onAuth(mapAuthUser(recoveredUser));
        clearAuthUrlArtifacts();
        onClose();
        return true;
      } catch (sessionError) {
        pushAuthTrace(authTrace, 'session_recovery_failed', {
          reason,
          message: String(sessionError?.message || sessionError),
        }, 'warn');
        return false;
      }
    };

    try {
      supabaseClient = await getSupabaseAuthClient();
      const supabase = supabaseClient;

      // Forgot Password Mode
      if (mode === AUTH_MODAL_MODES.forgotPassword) {
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) throw new Error(emailValidation.error);

        const { error: resetError } = await withAuthTimeout(
          supabase.auth.resetPasswordForEmail(emailValidation.value, {
            redirectTo: getAuthRedirectUrl(AUTH_MODAL_MODES.recovery),
          }),
          'Reset password',
          AUTH_FORGOT_PASSWORD_TIMEOUT_MS
        );

        if (resetError) throw resetError;

        setSuccessMessage('Link reset password sudah dikirim. Cek inbox email Anda.');
        setEmail('');
        setLoading(false);
        return;
      }

      // Recovery Mode (Update Password)
      if (mode === AUTH_MODAL_MODES.recovery) {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) throw new Error(passwordValidation.error);
        
        if (password !== confirmPassword) throw new Error('Password dan konfirmasi tidak cocok.');

        const { data: updateData, error: updateError } = await withAuthTimeout(
          supabase.auth.updateUser({ password: passwordValidation.value }),
          'Update password',
          AUTH_REQUEST_TIMEOUT_MS
        );
        
        if (updateError) throw updateError;

        if (updateData?.user) {
          onAuth(mapAuthUser(updateData.user));
        } else {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) onAuth(mapAuthUser(userData.user));
        }

        clearAuthUrlArtifacts();
        setSuccessMessage('Password berhasil diperbarui.');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1000);
        setLoading(false);
        return;
      }

      // Validate inputs
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) throw new Error(emailValidation.error);

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) throw new Error(passwordValidation.error);

      // Register Mode
      if (mode === AUTH_MODAL_MODES.register) {
        const nameValidation = validateName(name);
        if (!nameValidation.valid) throw new Error(nameValidation.error);

        const { data, error: signUpError } = await withAuthTimeout(
          supabase.auth.signUp({
            email: emailValidation.value,
            password: passwordValidation.value,
            options: {
              data: { name: nameValidation.value },
              emailRedirectTo: getAuthRedirectUrl(),
            },
          }),
          'Register',
          AUTH_REQUEST_TIMEOUT_MS
        );

        if (signUpError) throw signUpError;
        if (!data.user) throw new Error('Registrasi gagal. Silakan coba lagi.');

        switchMode(AUTH_MODAL_MODES.login);
        setEmail(emailValidation.value);
        setName('');
        setPassword('');
        setSuccessMessage('Registrasi berhasil! Cek email untuk verifikasi sebelum login.');
        setLoading(false);
        return;
      }

      // Login Mode
      let data;
      authTrace = createAuthAttemptTrace(mode, emailValidation.value);
      const disableClientTimeout = AUTH_DISABLE_CLIENT_TIMEOUT_FOR_PASSWORD;

      const isNetworkLikeError = (errorLike) => {
        const msg = String(errorLike?.message || errorLike || '').toLowerCase();
        return msg.includes('timeout') ||
          msg.includes('network') ||
          msg.includes('failed to fetch') ||
          msg.includes('abort');
      };

      const isInvalidCredentialError = (errorLike) => {
        const msg = String(errorLike?.message || errorLike || '').toLowerCase();
        return msg.includes('invalid login credentials') ||
          msg.includes('invalid email or password') ||
          msg.includes('email atau password tidak cocok');
      };

      try {
        pushAuthTrace(authTrace, 'primary_direct_start', {
          disableClientTimeout,
        });

        const signInResult = await supabase.auth.signInWithPassword({
          email: emailValidation.value,
          password: passwordValidation.value,
        });

        if (signInResult?.error) {
          throw signInResult.error;
        }

        data = signInResult?.data || null;
        pushAuthTrace(authTrace, 'primary_direct_done', {
          hasUser: Boolean(data?.user),
        });
      } catch (primaryError) {
        pushAuthTrace(authTrace, 'primary_direct_failed', {
          message: String(primaryError?.message || primaryError),
        }, isNetworkLikeError(primaryError) ? 'warn' : 'error');

        if (isInvalidCredentialError(primaryError)) {
          throw primaryError;
        }

        if (!isNetworkLikeError(primaryError)) {
          throw primaryError;
        }

        pushAuthTrace(authTrace, 'fallback_after_primary_start', {
          timeoutMs: disableClientTimeout ? null : AUTH_FALLBACK_TIMEOUT_MS,
        });

        const fallbackPromise = signInWithPasswordFallback({
          email: emailValidation.value,
          password: passwordValidation.value,
          trace: authTrace,
          disableClientTimeout,
        });

        const fallbackResult = disableClientTimeout
          ? await fallbackPromise
          : await withAuthTimeout(
            fallbackPromise,
            'Login (fallback after primary)',
            AUTH_FALLBACK_TIMEOUT_MS,
            { disableAdaptive: true },
          );

        data = fallbackResult;
        pushAuthTrace(authTrace, 'fallback_after_primary_done', {
          hasUser: Boolean(data?.user),
        });
      }

      if (!data || !data.user) throw new Error('Email atau password tidak cocok.');

      pushAuthTrace(authTrace, 'login_success', {
        userId: data?.user?.id || null,
      });

      await onAuth(mapAuthUser(data.user));
      clearAuthUrlArtifacts();
      onClose();
    } catch (err) {
      console.error('Auth error:', err);
      pushAuthTrace(authTrace, 'login_failed', { message: String(err?.message || err) }, 'error');

      if (isTimeoutError(err)) {
        const recovered = await recoverExistingSession('catch_timeout');
        if (recovered) return;
      }

      const errMsg = mapAuthErrorMessage(err);
      setError(errMsg);
      setIsRetryable(isTimeoutError(err));
    } finally {
      setLoading(false);
      authSubmitRequest.end();
      authPerfTracker.end(perfLabel, { mode, success: !error });
    }
  };

  const isRecoveryMode = mode === AUTH_MODAL_MODES.recovery;
  const isForgotMode = mode === AUTH_MODAL_MODES.forgotPassword;
  const isLoginMode = mode === AUTH_MODAL_MODES.login;
  const isRegisterMode = mode === AUTH_MODAL_MODES.register;
  const showGoogle = isLoginMode || isRegisterMode;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 fade-up" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="grid grid-cols-2">
          <button
            onClick={() => switchMode(AUTH_MODAL_MODES.login)}
            className={`py-3.5 text-xs uppercase tracking-widest font-bold transition ${isLoginMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
          >
            Masuk
          </button>
          <button
            onClick={() => switchMode(AUTH_MODAL_MODES.register)}
            className={`py-3.5 text-xs uppercase tracking-widest font-bold transition ${isRegisterMode ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
          >
            Daftar
          </button>
        </div>

        <div className="p-7 lg:p-9 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full"><X size={18} /></button>
          <Logo size={42} />
          <h2 className="font-display text-4xl mt-4 leading-tight">
            {isLoginMode && 'SELAMAT KEMBALI.'}
            {isRegisterMode && 'GABUNG SEKARANG.'}
            {isForgotMode && 'RESET PASSWORD.'}
            {isRecoveryMode && 'ATUR PASSWORD BARU.'}
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            {isLoginMode && 'Lanjutkan ke akun Stadione Anda.'}
            {isRegisterMode && 'Buat akun gratis, akses semua fitur.'}
            {isForgotMode && 'Masukkan email akun untuk menerima link reset password.'}
            {isRecoveryMode && 'Masukkan password baru untuk menyelesaikan pemulihan akun.'}
          </p>

          {showGoogle && (
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full mb-4 py-3 rounded-xl border-2 border-neutral-200 font-bold text-sm flex items-center justify-center gap-2 hover:bg-neutral-50 transition disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
              {loading ? 'Memproses...' : isRegisterMode ? 'Daftar dengan Google' : 'Lanjut dengan Google'}
            </button>
          )}

          {showGoogle && (
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400 font-bold uppercase">atau email</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegisterMode && (
              <div className="mb-3">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm disabled:opacity-60"
                  placeholder="Nama lengkap"
                />
              </div>
            )}
            {!isRecoveryMode && (
              <div className="mb-3">
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm disabled:opacity-60"
                  placeholder="Email"
                />
              </div>
            )}

            {!isForgotMode && (
              <div className="mb-3">
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm pr-12 disabled:opacity-60"
                    placeholder={isRecoveryMode ? 'Password baru' : 'Password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 disabled:opacity-60"
                  >
                    <Eye size={16} />
                  </button>
                </div>
                {isRegisterMode && password && (
                  <div className="mt-2 flex gap-1">
                    {(() => {
                      const strength = getPasswordStrength(password);
                      const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-500'];
                      return (
                        <>
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full ${i < strength.score ? colors[strength.score - 1] : 'bg-neutral-200'}`}
                            />
                          ))}
                          <span className="text-xs text-neutral-500 ml-1 whitespace-nowrap">
                            {strength.score <= 2 && 'Lemah'}
                            {strength.score === 3 && 'Sedang'}
                            {strength.score >= 4 && 'Kuat'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {isRecoveryMode && (
              <div className="mb-3">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm disabled:opacity-60"
                  placeholder="Konfirmasi password baru"
                />
              </div>
            )}

            {isLoginMode && (
              <div className="text-right mb-4">
                <button
                  type="button"
                  onClick={() => switchMode(AUTH_MODAL_MODES.forgotPassword)}
                  disabled={loading}
                  className="text-xs text-neutral-500 font-semibold hover:text-neutral-900 disabled:opacity-60"
                >
                  Lupa password?
                </button>
              </div>
            )}

            {isForgotMode && (
              <div className="text-right mb-4">
                <button
                  type="button"
                  onClick={() => switchMode(AUTH_MODAL_MODES.login)}
                  disabled={loading}
                  className="text-xs text-neutral-500 font-semibold hover:text-neutral-900 disabled:opacity-60"
                >
                  Kembali ke login
                </button>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">{successMessage}</p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between gap-3">
                <p className="text-xs text-red-600 font-medium">{error}</p>
                {isRetryable && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="shrink-0 text-xs font-bold text-red-600 underline hover:text-red-800 disabled:opacity-50"
                  >
                    Coba Lagi
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
              style={{ background: loading ? '#999' : '#E11D2E' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isLoginMode && 'SEDANG MASUK...'}
                  {isRegisterMode && 'SEDANG MENDAFTAR...'}
                  {isForgotMode && 'MENGIRIM LINK RESET...'}
                  {isRecoveryMode && 'MENYIMPAN PASSWORD...'}
                </>
              ) : (
                <>
                  {isLoginMode && 'MASUK SEKARANG'}
                  {isRegisterMode && 'BUAT AKUN'}
                  {isForgotMode && 'KIRIM LINK RESET'}
                  {isRecoveryMode && 'SIMPAN PASSWORD BARU'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {isRegisterMode && (
            <p className="text-[11px] text-neutral-500 mt-4 leading-relaxed text-center">
              Dengan mendaftar, Anda menyetujui <span className="font-bold underline">Syarat Layanan</span> dan <span className="font-bold underline">Kebijakan Privasi</span> Stadione.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ CREATE TOURNAMENT WIZARD ============
const CreateTournamentWizard = ({ onBack, onPublished }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '', sport: '', format: 'Liga', host: '',
    startDate: '', endDate: '', location: '',
    maxTeams: 8, regFee: 50000, prize: 5000000, currency: 'IDR',
    pointsWin: 3, pointsDraw: 1, pointsLoss: 0,
    rules: '', visibility: 'public'
  });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const steps = [
    { id: 1, label: 'Cabor & Format' },
    { id: 2, label: 'Jadwal' },
    { id: 3, label: 'Peserta & Hadiah' },
    { id: 4, label: 'Review' },
  ];

  const canNext = {
    1: data.sport && data.name,
    2: data.startDate,
    3: data.maxTeams >= 2,
    4: true,
  }[step];

  const tourneySports = SPORTS_TOURNEY.filter(s => s !== 'Semua');

  return (
    <div>
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Batalkan & Kembali
      </button>

      <div className="max-w-5xl mx-auto px-5 lg:px-8 py-8">
        <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ BUAT TURNAMEN</div>
        <h1 className="font-display text-5xl lg:text-7xl text-neutral-900 leading-[0.9] mb-8">
          BIKIN TURNAMEN-MU<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: '#E11D2E' }}>dari nol.</span>
        </h1>

        {/* Progress */}
        <div className="grid grid-cols-4 gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s.id} className="relative">
              <div className={`h-1 rounded-full ${step >= s.id ? 'bg-[#E11D2E]' : 'bg-neutral-200'}`} />
              <div className="mt-2 flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > s.id ? 'bg-[#E11D2E] text-white' : step === s.id ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                  {step > s.id ? <Check size={12} /> : s.id}
                </div>
                <span className={`text-xs font-bold uppercase ${step >= s.id ? 'text-neutral-900' : 'text-neutral-400'}`}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-6 lg:p-10 mb-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl mb-1">Pilih cabor</h2>
                <p className="text-sm text-neutral-500 mb-4">Cabang olahraga yang akan dipertandingkan.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {tourneySports.map(s => {
                    const Icon = sportIcon(s);
                    return (
                      <button
                        key={s}
                        onClick={() => set('sport', s)}
                        className={`p-4 rounded-xl border-2 text-left transition ${data.sport === s ? 'border-[#E11D2E] bg-red-50' : 'border-neutral-200 hover:border-neutral-400'}`}
                      >
                        <Icon size={20} className={data.sport === s ? 'text-[#E11D2E]' : 'text-neutral-700'} />
                        <div className="font-bold mt-2 text-sm">{s}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="font-display text-3xl mb-1">Format kompetisi</h2>
                <p className="text-sm text-neutral-500 mb-4">Liga = setiap tim main lawan semua. Knockout = sistem gugur.</p>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { id: 'Liga', label: 'LIGA', desc: 'Setiap tim bermain melawan semua tim lain. Klasemen otomatis.', icon: BarChart3 },
                    { id: 'Knockout', label: 'KNOCKOUT', desc: 'Sistem gugur. Kalah = pulang. Cocok untuk turnamen singkat.', icon: Trophy },
                    { id: 'Hybrid', label: 'GROUP + KO', desc: 'Babak grup dulu lalu knockout. Format kompetisi besar.', icon: Target },
                  ].map(f => {
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.id}
                        onClick={() => set('format', f.id)}
                        className={`p-5 rounded-xl border-2 text-left transition ${data.format === f.id ? 'border-[#E11D2E] bg-red-50' : 'border-neutral-200 hover:border-neutral-400'}`}
                      >
                        <Icon size={20} className="mb-3" style={{ color: '#E11D2E' }} />
                        <div className="font-display text-xl mb-1">{f.label}</div>
                        <div className="text-xs text-neutral-600">{f.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Nama Turnamen</label>
                <input
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 font-bold text-lg"
                  placeholder="Contoh: Liga Futsal Antar RT 2026"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Penyelenggara (opsional)</label>
                <input
                  value={data.host}
                  onChange={e => set('host', e.target.value)}
                  className="w-full px-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900"
                  placeholder="Nama komunitas / klub Anda"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl mb-1">Atur jadwal</h2>
                <p className="text-sm text-neutral-500 mb-4">Tentukan rentang waktu turnamen.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    className="w-full px-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Tanggal Selesai (opsional)</label>
                  <input
                    type="date"
                    value={data.endDate}
                    onChange={e => set('endDate', e.target.value)}
                    className="w-full px-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Lokasi</label>
                <input
                  value={data.location}
                  onChange={e => set('location', e.target.value)}
                  className="w-full px-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900"
                  placeholder="Contoh: GOR Senayan, Jakarta Pusat"
                />
              </div>

              {data.format === 'Liga' && (
                <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                  <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ SISTEM POIN LIGA</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-neutral-700 mb-1 block">Poin Menang</label>
                      <input
                        type="number"
                        value={data.pointsWin}
                        onChange={e => set('pointsWin', +e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 outline-none focus:border-neutral-900 font-bold text-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-700 mb-1 block">Poin Seri</label>
                      <input
                        type="number"
                        value={data.pointsDraw}
                        onChange={e => set('pointsDraw', +e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 outline-none focus:border-neutral-900 font-bold text-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-700 mb-1 block">Poin Kalah</label>
                      <input
                        type="number"
                        value={data.pointsLoss}
                        onChange={e => set('pointsLoss', +e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 outline-none focus:border-neutral-900 font-bold text-lg"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl mb-1">Peserta & hadiah</h2>
                <p className="text-sm text-neutral-500 mb-4">Tentukan jumlah tim dan struktur hadiah.</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Jumlah Tim Maksimal</label>
                <div className="flex gap-2 flex-wrap">
                  {[4, 8, 16, 24, 32].map(n => (
                    <button
                      key={n}
                      onClick={() => set('maxTeams', n)}
                      className={`px-5 py-3 rounded-xl border-2 font-display text-2xl transition ${data.maxTeams === n ? 'border-[#E11D2E] bg-red-50 text-[#E11D2E]' : 'border-neutral-200 hover:border-neutral-400'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Biaya Pendaftaran (per tim)</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-500">Rp</span>
                    <input
                      type="number"
                      value={data.regFee}
                      onChange={e => set('regFee', +e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 font-bold"
                    />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1.5">Total terkumpul: {formatRupiah(data.regFee * data.maxTeams)}</div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Total Hadiah</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-500">Rp</span>
                    <input
                      type="number"
                      value={data.prize}
                      onChange={e => set('prize', +e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 grid grid-cols-3 gap-4">
                {[
                  { p: '🥇 Juara 1', amt: Math.floor(data.prize * 0.5) },
                  { p: '🥈 Juara 2', amt: Math.floor(data.prize * 0.3) },
                  { p: '🥉 Juara 3', amt: Math.floor(data.prize * 0.2) },
                ].map((p, i) => (
                  <div key={i}>
                    <div className="text-xs font-bold text-amber-900 mb-1">{p.p}</div>
                    <div className="font-display text-xl text-amber-900">{formatRupiah(p.amt)}</div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Peraturan & Catatan</label>
                <textarea
                  value={data.rules}
                  onChange={e => set('rules', e.target.value)}
                  rows={4}
                  className="w-full px-5 py-3.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 resize-none"
                  placeholder="Contoh: Pemain min. 17 tahun. Setiap tim wajib seragam. Wasit disediakan panitia."
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2 block">Visibilitas</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'public', label: 'PUBLIK', desc: 'Siapa saja bisa daftar' },
                    { id: 'private', label: 'UNDANGAN', desc: 'Hanya yang diundang' },
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => set('visibility', v.id)}
                      className={`p-4 rounded-xl border-2 text-left transition ${data.visibility === v.id ? 'border-[#E11D2E] bg-red-50' : 'border-neutral-200 hover:border-neutral-400'}`}
                    >
                      <div className="font-display text-lg">{v.label}</div>
                      <div className="text-xs text-neutral-600">{v.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-3xl mb-1">Review akhir</h2>
              <p className="text-sm text-neutral-500 mb-6">Pastikan semua benar sebelum publish.</p>

              <div className="rounded-2xl p-6 mb-6 text-white grain relative overflow-hidden" style={{ background: data.sport ? '#E11D2E' : '#525252' }}>
                <div className="text-xs uppercase tracking-widest font-bold opacity-80 mb-2">{data.sport || 'Cabor'} · {data.format}</div>
                <div className="font-display text-4xl leading-tight mb-1">{data.name || 'Nama turnamen'}</div>
                <div className="text-sm opacity-80">oleh {data.host || 'Anda'}</div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { l: 'Mulai', v: data.startDate || '—' },
                  { l: 'Lokasi', v: data.location || '—' },
                  { l: 'Maksimal Tim', v: `${data.maxTeams} tim` },
                  { l: 'Biaya Daftar', v: formatRupiah(data.regFee) },
                  { l: 'Total Hadiah', v: formatRupiah(data.prize) },
                  { l: 'Visibilitas', v: data.visibility === 'public' ? 'Publik' : 'Undangan' },
                ].map((s, i) => (
                  <div key={i} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-1">{s.l}</div>
                    <div className="font-bold">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onBack()}
            className="px-6 py-3 rounded-full font-bold text-sm bg-white border-2 border-neutral-300 hover:border-neutral-900 flex items-center gap-2"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </button>
          <div className="text-sm text-neutral-500 font-semibold">Langkah {step} dari 4</div>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="px-6 py-3 rounded-full font-bold text-sm text-white flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#E11D2E' }}
            >
              Lanjut <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => onPublished(data)}
              className="px-7 py-3 rounded-full font-bold text-sm text-white flex items-center gap-2"
              style={{ background: '#E11D2E' }}
            >
              <Check size={14} /> PUBLISH TURNAMEN
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PublishedSuccess = ({ data, onView, onHome }) => (
  <div className="max-w-2xl mx-auto px-5 py-20 text-center">
    <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: '#E11D2E' }}>
      <Check size={40} className="text-white" strokeWidth={3} />
    </div>
    <div className="text-xs uppercase tracking-widest font-bold text-[#E11D2E] mb-3">/ TURNAMEN AKTIF</div>
    <h1 className="font-display text-5xl lg:text-7xl text-neutral-900 leading-[0.9] mb-4">SELAMAT, TURNAMEN<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>siap tanding!</span></h1>
    <p className="text-lg text-neutral-600 mb-8 max-w-md mx-auto">"{data.name}" sudah dipublikasikan. Bagikan link ke calon peserta.</p>
    <div className="flex justify-center gap-3 flex-wrap">
      <button onClick={onView} className="px-6 py-3 rounded-full font-bold text-sm text-white flex items-center gap-2" style={{ background: '#E11D2E' }}>
        Lihat Turnamen <ArrowRight size={14} />
      </button>
      <button onClick={onHome} className="px-6 py-3 rounded-full font-bold text-sm bg-white border-2 border-neutral-300">
        Kembali ke Beranda
      </button>
    </div>
  </div>
);

// ============ ARTICLE DETAIL ============
const ArticleDetail = ({ article, onBack, onSelect, auth, openAuth, newsList = [] }) => {
  const safeNews = Array.isArray(newsList) ? newsList : [];
  const related = safeNews.filter(n => n.id !== article.id && n.category === article.category).slice(0, 3);
  const fallback = safeNews.filter(n => n.id !== article.id).slice(0, 3);
  const recommend = related.length > 0 ? related : fallback;
  const articleRef = useRef(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [readMessage, setReadMessage] = useState('');

  const {
    progress,
    quiz,
    loading: progressLoading,
    updateProgress,
    readingCompleted,
    quizCompleted,
    quizCorrect,
    scrollDepth
  } = useArticleReading(auth?.id, article.id);

  useScrollTracker(articleRef, async () => {
    if (!auth) return;
    const result = await updateProgress(100, true);
    if (result) setReadMessage('✅ Artikel ditandai selesai. Poin telah dicatat.');
  });

  const markAsRead = async () => {
    if (!auth) {
      openAuth('login');
      return;
    }

    const result = await updateProgress(100, true);
    if (result) setReadMessage('✅ Artikel ditandai selesai. Poin telah dicatat.');
  };

  const handleQuizSubmit = async (selected) => {
    if (!auth) {
      openAuth('login');
      return;
    }
    if (!quiz) return;

    setQuizLoading(true);
    const result = await submitQuizAnswer(auth.id, quiz.id, article.id, selected);
    setQuizLoading(false);
    setQuizResult(result);
  };

  // Mock body content
  const body = [
    `Pertandingan yang berlangsung di ${article.category === 'Sepakbola' ? 'Stadion Gelora Bung Karno' : 'venue utama'} Jumat malam itu berjalan dengan tensi tinggi sejak menit pertama. Para pendukung memenuhi tribun, menciptakan atmosfer yang jarang terlihat dalam kompetisi domestik tahun ini.`,
    `"Ini adalah momen yang sudah lama kami tunggu," ujar pelatih kepala dalam sesi konferensi pers pasca-pertandingan. "Anak-anak bermain dengan hati. Mereka tahu apa arti pertandingan ini bagi pendukung dan keluarga mereka."`,
    `Statistik pertandingan menunjukkan dominasi yang nyaris sempurna: 64% penguasaan bola, 18 tembakan ke arah gawang, dan tingkat akurasi umpan mencapai 89%. Lini tengah menjadi area kunci, di mana duo gelandang berhasil meredam serangan lawan sekaligus memulai transisi cepat ke depan.`,
    `Yang membuat malam ini istimewa bukan hanya hasil akhir, melainkan cara mereka mendapatkannya. Sebuah gol kemenangan yang lahir dari kerja keras kolektif — dimulai dari penjaga gawang, dialirkan melalui tujuh sentuhan, dan diakhiri dengan finishing yang dingin.`,
    `Manajer mengakui bahwa perjalanan masih panjang. "Ini baru satu langkah. Tapi kami sudah membuktikan bahwa kami bisa berdiri sejajar dengan tim manapun. Sekarang yang penting adalah konsistensi."`,
    `Pertandingan berikutnya dijadwalkan pekan depan, di kandang lawan yang dikenal sulit ditembus. Tantangan baru menanti, namun kepercayaan diri yang dibangun malam ini bisa menjadi modal berharga.`
  ];

  return (
    <div>
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Kembali ke Berita
      </button>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-8 pb-6">
        <div className="text-xs uppercase tracking-widest font-bold mb-4" style={{ color: '#E11D2E' }}>
          / {article.category}
        </div>
        <h1 className="font-display text-5xl lg:text-7xl text-neutral-900 leading-[0.9] mb-6">
          {article.title}
        </h1>
        <p className="text-xl text-neutral-600 mb-8 leading-relaxed font-serif-it" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
          {article.excerpt}
        </p>

        <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-neutral-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm text-white" style={{ background: '#E11D2E' }}>
              {article.author.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="font-bold text-sm">{article.author}</div>
              <div className="text-xs text-neutral-500">{article.date} · {article.read} baca</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full border border-neutral-300 hover:border-neutral-900 flex items-center justify-center"><Bookmark size={14} /></button>
            <button className="w-10 h-10 rounded-full border border-neutral-300 hover:border-neutral-900 flex items-center justify-center"><Twitter size={14} /></button>
            <button className="w-10 h-10 rounded-full border border-neutral-300 hover:border-neutral-900 flex items-center justify-center"><Facebook size={14} /></button>
            <button className="w-10 h-10 rounded-full border border-neutral-300 hover:border-neutral-900 flex items-center justify-center"><Share2 size={14} /></button>
          </div>
        </div>
      </div>

      {auth && (
        <div className="max-w-5xl mx-auto px-5 lg:px-8 mb-8">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 grid gap-4 lg:grid-cols-[1fr_auto] items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-xs uppercase tracking-widest font-bold text-neutral-500">Progres Bacaan</span>
                <span className="text-xs font-semibold text-neutral-700">{readingCompleted ? 'Selesai' : `${scrollDepth || 0}%`}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden mb-4">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${Math.min(scrollDepth || 0, 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <button onClick={markAsRead} className="px-4 py-3 rounded-full bg-neutral-900 text-white text-sm font-bold hover:bg-neutral-800">Tandai Sudah Dibaca</button>
                {quiz && !quizCompleted && (
                  <button onClick={() => setQuizOpen(true)} className="px-4 py-3 rounded-full border border-neutral-300 text-sm font-bold hover:border-neutral-900">Kerjakan Kuis</button>
                )}
                {quizCompleted && (
                  <span className="text-sm font-semibold text-green-700">Kuis terselesaikan {quizCorrect ? '✅' : '⚠️'}</span>
                )}
              </div>
              {readMessage && <p className="mt-3 text-sm text-emerald-700">{readMessage}</p>}
            </div>
            <div className="rounded-3xl bg-amber-50 p-4 text-sm text-neutral-700 border border-amber-100">
              <div className="font-bold text-neutral-900 mb-2">Rewards</div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span>Poin baca</span><span>+10</span></div>
                <div className="flex justify-between"><span>Quiz benar</span><span>+5</span></div>
                <div className="flex justify-between"><span>Total bacaan</span><span>{progress?.read_completed ? 'Selesai' : 'Belum'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Image */}
      <div className="max-w-5xl mx-auto px-5 lg:px-8 mb-10">
        <div className="aspect-[16/9] rounded-2xl relative overflow-hidden grain" style={{ background: article.color }}>
          <div className="absolute -bottom-8 -right-8 opacity-15">
            {React.createElement(sportIcon(article.category), { size: 320, color: 'white' })}
          </div>
          <div className="absolute bottom-6 left-6 text-xs font-bold px-3 py-1 bg-black/40 backdrop-blur text-white rounded-full">
            FOTO: STADIONE
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-5 lg:px-8 pb-16">
        <div className="prose-content space-y-5 text-lg text-neutral-800 leading-[1.8]">
          {body.map((p, i) => (
            <p key={i} className={i === 0 ? 'first-letter:font-display first-letter:text-7xl first-letter:float-left first-letter:mr-3 first-letter:leading-[0.9] first-letter:mt-1' : ''} style={{ color: i === 0 ? undefined : '#262626' }}>
              {p}
            </p>
          ))}
        </div>

        {quizOpen && (
          <ArticleQuizModal
            quiz={quiz}
            onSubmit={handleQuizSubmit}
            onClose={() => setQuizOpen(false)}
            loading={quizLoading}
          />
        )}
        {quizResult && (
          <QuizResultToast result={quizResult} onClose={() => setQuizResult(null)} />
        )}

        {/* Pull quote */}
        <blockquote className="my-12 border-l-4 pl-6 py-2" style={{ borderColor: '#E11D2E' }}>
          <p className="font-serif-it text-3xl leading-tight text-neutral-900" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>
            "Yang penting bukan dari mana kita mulai, tapi seberapa keras kita berjuang untuk sampai ke sini."
          </p>
          <footer className="text-sm text-neutral-500 mt-3 font-bold uppercase tracking-wider">— Pelatih kepala</footer>
        </blockquote>

        <p className="text-lg text-neutral-800 leading-[1.8]">{body[body.length - 1]}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-neutral-200">
          {[article.category, 'Liga Indonesia', '2026', 'Eksklusif'].map(t => (
            <span key={t} className="text-xs font-bold px-3 py-1.5 bg-neutral-100 rounded-full hover:bg-neutral-200 cursor-pointer">#{t}</span>
          ))}
        </div>
      </div>

      {/* Comments preview */}
      <div className="max-w-3xl mx-auto px-5 lg:px-8 pb-12">
        <div className="border-t border-neutral-300 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl">Diskusi · 24</h3>
            <button className="text-xs font-bold flex items-center gap-1 text-[#E11D2E]"><MessageCircle size={14} /> Tulis Komentar</button>
          </div>
          <div className="space-y-4">
            {[
              { name: 'Budi Santoso', avatar: 'BS', time: '2 jam lalu', text: 'Performa malam tadi luar biasa! Lini tengah bermain sangat solid.' },
              { name: 'Rina Andriani', avatar: 'RA', time: '4 jam lalu', text: 'Akhirnya. Sudah lama nunggu momen kayak gini. Garuda ke depan!' },
            ].map((c, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs shrink-0">{c.avatar}</div>
                <div className="flex-1 bg-neutral-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{c.name}</span>
                    <span className="text-xs text-neutral-500">{c.time}</span>
                  </div>
                  <p className="text-sm text-neutral-700">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related */}
      <section className="border-t border-neutral-300 bg-white">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16">
          <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ BERITA TERKAIT</div>
          <h2 className="font-display text-4xl lg:text-5xl mb-8">BACA JUGA</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {recommend.map(n => (
              <article key={n.id} onClick={() => onSelect(n)} className="cursor-pointer group">
                <div className="aspect-[4/3] mb-4 relative overflow-hidden grain rounded-xl" style={{ background: n.color }}>
                  <div className="absolute top-4 left-4 text-[10px] font-bold px-2 py-1 bg-white text-neutral-900 uppercase">{n.category}</div>
                </div>
                <div className="text-xs text-neutral-500 mb-2 font-semibold uppercase">{n.date} · {n.read}</div>
                <h3 className="font-display text-xl leading-tight group-hover:text-[#E11D2E] transition">{n.title}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

// ============ COACH DASHBOARD ============
const CoachDashboard = ({ onBack, auth }) => {
  const [tab, setTab] = useState('overview');
  const [showQuickRegistration, setShowQuickRegistration] = useState(false);
  const [showTeamWorkspace, setShowTeamWorkspace] = useState(false);
  const [workspaceContext, setWorkspaceContext] = useState({ registration: null, team: null });
  const coachDashboardTournament = TOURNAMENTS.find((item) => String(item.status || '').toLowerCase() === 'pendaftaran') || TOURNAMENTS[0];

  const earningsData = [
    { month: 'Nov', amount: 8500000, sessions: 34 },
    { month: 'Des', amount: 12400000, sessions: 49 },
    { month: 'Jan', amount: 14200000, sessions: 56 },
    { month: 'Feb', amount: 13800000, sessions: 55 },
    { month: 'Mar', amount: 16500000, sessions: 66 },
    { month: 'Apr', amount: 18900000, sessions: 75 },
    { month: 'Mei', amount: 21200000, sessions: 84 },
  ];

  const todaySchedule = [
    { time: '07:00', client: 'Aldi Pratama', type: 'Sesi Privat', sport: 'Sepakbola', status: 'done' },
    { time: '09:00', client: 'Sarah & Maya', type: 'Sesi Berdua', sport: 'Sepakbola', status: 'done' },
    { time: '15:00', client: 'Tim FC Senayan U-15', type: 'Latihan Tim', sport: 'Sepakbola', status: 'live' },
    { time: '17:00', client: 'Budi Santoso', type: 'Sesi Privat', sport: 'Sepakbola', status: 'upcoming' },
    { time: '19:00', client: 'Rina Wijaya', type: 'Konsultasi', sport: 'Sepakbola', status: 'upcoming' },
  ];

  const students = [
    { name: 'Aldi Pratama', sessions: 24, level: 'Intermediate', joined: 'Jan 2026', status: 'active' },
    { name: 'Sarah Kusuma', sessions: 18, level: 'Pemula', joined: 'Feb 2026', status: 'active' },
    { name: 'Budi Santoso', sessions: 32, level: 'Advanced', joined: 'Nov 2025', status: 'active' },
    { name: 'Maya Hartono', sessions: 12, level: 'Pemula', joined: 'Mar 2026', status: 'active' },
    { name: 'Rina Wijaya', sessions: 8, level: 'Intermediate', joined: 'Apr 2026', status: 'active' },
  ];

  const reviews = [
    { name: 'Aldi Pratama', rating: 5, time: '2 hari lalu', text: 'Coach Bambang luar biasa! Teknik dribbling saya meningkat drastis dalam 2 bulan. Sangat sabar dan detail dalam mengoreksi.' },
    { name: 'Sarah Kusuma', rating: 5, time: '1 minggu lalu', text: 'Pelatih terbaik yang pernah saya temui. Materi terstruktur, motivasi selalu on point.' },
    { name: 'Budi Santoso', rating: 4, time: '2 minggu lalu', text: 'Pengalaman 12 tahunnya benar-benar terasa. Recommended buat yang serius mau jadi pemain bola.' },
  ];

  const stats = [
    { label: 'Pendapatan Bulan Ini', value: 'Rp 21.2jt', delta: '+12%', icon: Wallet },
    { label: 'Total Sesi', value: '84', delta: '+9 dari bulan lalu', icon: Calendar },
    { label: 'Murid Aktif', value: '47', delta: '+5 baru', icon: Users },
    { label: 'Rating', value: '4.9', delta: 'dari 234 ulasan', icon: Star },
  ];

  return (
    <div className="bg-white min-h-screen">
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Kembali
      </button>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl text-white" style={{ background: '#E11D2E' }}>
              {(auth?.name || 'BS').split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">/ DASHBOARD PELATIH</div>
              <h1 className="font-display text-3xl lg:text-4xl leading-tight">{auth?.name || 'Coach Bambang Sutrisno'}</h1>
              <div className="text-sm text-neutral-500">Pelatih Sepakbola · Aktif sejak Jan 2024</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2.5 rounded-full text-sm font-bold border-2 border-neutral-300 hover:border-neutral-900 flex items-center gap-2">
              <Edit3 size={14} /> Edit Profil
            </button>
            <button
              onClick={() => setShowQuickRegistration(true)}
              className="px-4 py-2.5 rounded-full text-sm font-bold text-white flex items-center gap-2"
              style={{ background: '#E11D2E' }}
            >
              <Plus size={14} /> Buka Slot
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-300 mb-8 flex gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Ringkasan', icon: BarChart3 },
            { id: 'schedule', label: 'Jadwal', icon: Calendar },
            { id: 'students', label: 'Murid', icon: Users },
            { id: 'reviews', label: 'Ulasan', icon: MessageSquare },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
                  tab === t.id ? 'border-[#E11D2E] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#E11D2E' }}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{s.delta}</span>
                    </div>
                    <div className="font-display text-3xl text-neutral-900 leading-none mb-1">{s.value}</div>
                    <div className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Earnings chart */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">/ PENDAPATAN</div>
                  <h3 className="font-display text-2xl">7 BULAN TERAKHIR</h3>
                </div>
                <div className="flex gap-1 bg-neutral-100 rounded-full p-1">
                  {['7B', '3B', '12B'].map((p, i) => (
                    <button key={i} className={`px-3 py-1.5 rounded-full text-xs font-bold ${i === 0 ? 'bg-white shadow' : 'text-neutral-500'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={earningsData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E11D2E" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#E11D2E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                  <XAxis dataKey="month" stroke="#999" tick={{ fontSize: 12, fontWeight: 600 }} />
                  <YAxis stroke="#999" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000000}jt`} />
                  <Tooltip
                    contentStyle={{ background: '#0A0A0A', border: 'none', borderRadius: 12, fontSize: 12, color: 'white' }}
                    labelStyle={{ color: 'white', fontWeight: 700 }}
                    formatter={(v) => [formatRupiah(v), 'Pendapatan']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#E11D2E" strokeWidth={3} fill="url(#redGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Two columns */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Schedule today */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">/ HARI INI</div>
                    <h3 className="font-display text-2xl">JADWAL</h3>
                  </div>
                  <span className="text-xs font-bold text-neutral-500">{todaySchedule.length} sesi</span>
                </div>
                <div className="space-y-2">
                  {todaySchedule.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50">
                      <div className="font-display text-xl w-14 shrink-0">{s.time}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{s.client}</div>
                        <div className="text-xs text-neutral-500">{s.type}</div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${
                        s.status === 'done' ? 'bg-neutral-100 text-neutral-600' :
                        s.status === 'live' ? 'bg-[#E11D2E] text-white' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {s.status === 'done' ? '✓ Selesai' : s.status === 'live' ? '● Live' : 'Akan Datang'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent reviews */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">/ TERBARU</div>
                    <h3 className="font-display text-2xl">ULASAN</h3>
                  </div>
                  <span className="text-xs font-bold flex items-center gap-1"><Star size={12} fill="#E11D2E" color="#E11D2E" /> 4.9 / 5.0</span>
                </div>
                <div className="space-y-4">
                  {reviews.slice(0, 2).map((r, i) => (
                    <div key={i} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{r.name}</span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(r.rating)].map((_, j) => <Star key={j} size={10} fill="#E11D2E" color="#E11D2E" />)}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 mb-2">{r.time}</div>
                      <p className="text-sm text-neutral-700 line-clamp-2">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'schedule' && (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="p-5 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">/ KAMIS, 7 MEI 2026</div>
                <h3 className="font-display text-2xl">JADWAL HARI INI</h3>
              </div>
              <button className="px-4 py-2 rounded-full text-xs font-bold text-white flex items-center gap-2" style={{ background: '#E11D2E' }}>
                <Plus size={12} /> Tambah Slot
              </button>
            </div>
            <div className="divide-y divide-neutral-100">
              {todaySchedule.map((s, i) => (
                <div key={i} className="p-5 flex items-center gap-4 hover:bg-neutral-50">
                  <div className="font-display text-3xl w-20 shrink-0">{s.time}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{s.client}</div>
                    <div className="text-sm text-neutral-500">{s.type} · {s.sport}</div>
                  </div>
                  <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${
                    s.status === 'done' ? 'bg-neutral-100 text-neutral-600' :
                    s.status === 'live' ? 'bg-[#E11D2E] text-white' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {s.status === 'done' ? 'Selesai' : s.status === 'live' ? 'Live' : 'Mendatang'}
                  </span>
                  <button className="p-2 hover:bg-neutral-200 rounded-full"><Edit3 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'students' && (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="p-5 border-b border-neutral-200">
              <h3 className="font-display text-2xl">{students.length} MURID AKTIF</h3>
              <div className="text-sm text-neutral-500">Total 47 murid termasuk arsip</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase font-bold text-neutral-500">
                <tr>
                  <th className="text-left px-5 py-3">Nama</th>
                  <th className="text-left px-5 py-3">Level</th>
                  <th className="text-center px-5 py-3">Total Sesi</th>
                  <th className="text-left px-5 py-3">Bergabung</th>
                  <th className="text-right px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs">
                          {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-bold">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        s.level === 'Pemula' ? 'bg-green-100 text-green-700' :
                        s.level === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{s.level}</span>
                    </td>
                    <td className="text-center px-5 py-4 font-display text-lg">{s.sessions}</td>
                    <td className="px-5 py-4 text-neutral-500">{s.joined}</td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-xs font-bold text-[#E11D2E]">Detail →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 lg:col-span-1 h-fit">
              <div className="text-center">
                <div className="font-display text-7xl text-neutral-900 leading-none">4.9</div>
                <div className="flex items-center justify-center gap-0.5 my-2">
                  {[...Array(5)].map((_, j) => <Star key={j} size={16} fill="#E11D2E" color="#E11D2E" />)}
                </div>
                <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider">dari 234 ulasan</div>
              </div>
              <div className="border-t border-neutral-200 mt-6 pt-6 space-y-2">
                {[5, 4, 3, 2, 1].map(r => {
                  const pct = r === 5 ? 78 : r === 4 ? 18 : r === 3 ? 3 : 1;
                  return (
                    <div key={r} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-3">{r}</span>
                      <Star size={10} fill="#E11D2E" color="#E11D2E" />
                      <div className="flex-1 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, background: '#E11D2E' }} />
                      </div>
                      <span className="text-xs text-neutral-500 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{r.name}</div>
                        <div className="text-xs text-neutral-500">{r.time}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[...Array(r.rating)].map((_, j) => <Star key={j} size={12} fill="#E11D2E" color="#E11D2E" />)}
                    </div>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed mb-3">{r.text}</p>
                  <button className="text-xs font-bold text-neutral-500 hover:text-[#E11D2E] flex items-center gap-1">
                    <MessageCircle size={12} /> Balas
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          <QuickRegistrationModal
            isOpen={showQuickRegistration}
            tournament={coachDashboardTournament}
            auth={auth}
            onClose={() => setShowQuickRegistration(false)}
            onSuccess={(data) => {
              setWorkspaceContext({
                registration: data?.registration || null,
                team: data?.team || null,
              });
              setRegistered(Boolean(data?.registration));
              setShowQuickRegistration(false);
              refetchTournamentPlayers();
              if (data?.team) {
                setShowTeamWorkspace(true);
              }
            }}
          />
          <TeamWorkspaceModal
            isOpen={showTeamWorkspace}
            registration={workspaceContext.registration}
            team={workspaceContext.team}
            tournament={coachDashboardTournament}
            auth={auth}
            onClose={() => setShowTeamWorkspace(false)}
          />
        </Suspense>
      </div>
    </div>
  );
};

const ISO_COUNTRIES = [
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'JP', name: 'Jepang' },
  { code: 'KR', name: 'Korea Selatan' },
  { code: 'CN', name: 'Tiongkok' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'US', name: 'Amerika Serikat' },
  { code: 'GB', name: 'Inggris' },
  { code: 'NL', name: 'Belanda' },
  { code: 'DE', name: 'Jerman' },
];

// NIK: 2-digit province prefix codes (BPS Indonesia)
const NIK_VALID_PROVINCE_CODES = new Set([11,12,13,14,15,16,17,18,19,21,31,32,33,34,35,36,51,52,53,61,62,63,64,65,71,72,73,74,75,76,81,82,91,92,94,95,96,97]);

const WNI_REGION_DATA = {
  // ── ACEH & SUMATERA ──
  'Aceh': {
    'Kota Banda Aceh': { 'Baiturrahman':'23241','Banda Raya':'23234','Meuraxa':'23233','Kuta Alam':'23121','Lueng Bata':'23247','Syiah Kuala':'23111','Ulee Kareng':'23117' },
    'Kab. Aceh Besar': { 'Kuta Baro':'23361','Darul Imarah':'23352','Ingin Jaya':'23362','Peukan Bada':'23351','Montasik':'23363' },
    'Kab. Pidie': { 'Sigli':'24115','Kota Sigli':'24111','Simpang Tiga':'24151','Sakti':'24161' },
    'Kota Langsa': { 'Langsa Kota':'24415','Langsa Baro':'24411','Langsa Timur':'24416','Langsa Lama':'24417' },
    'Kab. Aceh Utara': { 'Lhokseumawe':'24351','Dewantara':'24352','Muara Batu':'24373','Nisam':'24374' },
    'Kota Lhokseumawe': { 'Banda Sakti':'24311','Blang Mangat':'24352','Muara Dua':'24351' },
    'Kab. Bireuen': { 'Kota Juang':'24211','Peusangan':'24252','Jeumpa':'24261' },
    'Kab. Aceh Tamiang': { 'Karang Baru':'24476','Manyak Payed':'24471','Seruway':'24472' },
  },
  'Sumatera Utara': {
    'Kota Medan': { 'Medan Petisah':'20113','Medan Baru':'20154','Medan Timur':'20236','Medan Kota':'20111','Medan Johor':'20144','Medan Selayang':'20131','Medan Helvetia':'20124','Medan Sunggal':'20122','Medan Tuntungan':'20141','Medan Denai':'20226' },
    'Kab. Deli Serdang': { 'Lubuk Pakam':'20512','Percut Sei Tuan':'20371','Sunggal':'20352','Hamparan Perak':'20374','Patumbak':'20361','Pancur Batu':'20353' },
    'Kota Binjai': { 'Binjai Kota':'20711','Binjai Utara':'20741','Binjai Timur':'20731','Binjai Selatan':'20721','Binjai Barat':'20712' },
    'Kota Pematang Siantar': { 'Siantar Barat':'21111','Siantar Martoba':'21137','Siantar Utara':'21121','Siantar Selatan':'21128','Siantar Timur':'21114' },
    'Kab. Langkat': { 'Stabat':'20811','Tanjung Pura':'20853','Binjai':'20815','Babalan':'20813' },
    'Kota Tebing Tinggi': { 'Tebing Tinggi Kota':'20614','Bajenis':'20625','Padang Hulu':'20613' },
    'Kota Tanjung Balai': { 'Tanjung Balai Selatan':'21322','Teluk Nibung':'21321','Sei Tualang Raso':'21352' },
    'Kab. Asahan': { 'Kisaran Barat':'21216','Kisaran Timur':'21224','Buntu Pane':'21274' },
    'Kab. Simalungun': { 'Raya':'21165','Perdagangan':'21184','Haranggaol':'21174' },
    'Kota Padang Sidimpuan': { 'PSP Utara':'22719','PSP Selatan':'22734','PSP Tenggara':'22733' },
  },
  'Sumatera Barat': {
    'Kota Padang': { 'Padang Barat':'25115','Padang Timur':'25121','Padang Utara':'25111','Padang Selatan':'25211','Koto Tangah':'25172','Nanggalo':'25112','Lubuk Begalung':'25221','Pauh':'25162' },
    'Kota Bukittinggi': { 'Mandiangin Koto Selayan':'26111','Guguk Panjang':'26122','Aur Birugo Tigo Baleh':'26115' },
    'Kab. Agam': { 'Lubuk Basung':'26411','Ampek Angkek':'26452','Tilatang Kamang':'26453','Banuhampu':'26481' },
    'Kota Solok': { 'Lubuk Sikarah':'27311','Tanjung Harapan':'27312' },
    'Kab. Padang Pariaman': { 'Pariaman':'25511','Lubuk Alung':'25572','Batang Anai':'25581' },
    'Kota Pariaman': { 'Pariaman Tengah':'25512','Pariaman Utara':'25511' },
    'Kab. Tanah Datar': { 'Batusangkar':'27211','Lima Kaum':'27212','Rambatan':'27261' },
    'Kota Sawahlunto': { 'Lembah Segar':'27417','Talawi':'27418' },
    'Kab. Pesisir Selatan': { 'Painan':'25611','Bayang':'25671','Koto XI Tarusan':'25612' },
  },
  'Riau': {
    'Kota Pekanbaru': { 'Tampan':'28291','Pekanbaru Kota':'28111','Payung Sekaki':'28294','Bukit Raya':'28281','Marpoyan Damai':'28125','Tenayan Raya':'28261','Sail':'28151','Sukajadi':'28124' },
    'Kab. Kampar': { 'Bangkinang':'28415','Kampar':'28461','Tambang':'28412','Siak Hulu':'28414','Perhentian Raja':'28462' },
    'Kota Dumai': { 'Dumai Kota':'28811','Dumai Timur':'28821','Bukit Kapur':'28826','Medang Kampai':'28812' },
    'Kab. Siak': { 'Siak':'28771','Mempura':'28772','Kandis':'28681' },
    'Kab. Bengkalis': { 'Bengkalis':'28711','Duri':'28784','Rupat':'28752' },
    'Kab. Pelalawan': { 'Pangkalan Kerinci':'28311','Langgam':'28382','Pangkalan Kuras':'28391' },
    'Kab. Indragiri Hulu': { 'Rengat':'29314','Seberida':'29352','Batang Cenaku':'29315' },
    'Kab. Indragiri Hilir': { 'Tembilahan':'29212','Kateman':'29262','Enok':'29261' },
    'Kab. Rokan Hilir': { 'Bagansiapiapi':'28911','Batu Hampar':'28912','Bangko':'28913' },
    'Kab. Rokan Hulu': { 'Pasir Pangaraian':'28512','Rambah':'28513','Tambusai':'28514' },
  },
  'Jambi': {
    'Kota Jambi': { 'Pasar Jambi':'36112','Jambi Selatan':'36137','Kota Baru':'36128','Telanaipura':'36122','Jambi Timur':'36131','Alam Barajo':'36139','Danau Sipin':'36133' },
    'Kab. Muaro Jambi': { 'Sengeti':'36381','Jambi Luar Kota':'36361','Kumpeh Ulu':'36362','Mestong':'36363' },
    'Kab. Batang Hari': { 'Muara Bulian':'36611','Muara Tembesi':'36671','Bajubang':'36612' },
    'Kab. Tanjung Jabung Timur': { 'Muara Sabak':'36571','Rantau Rasau':'36572' },
    'Kab. Tanjung Jabung Barat': { 'Kuala Tungkal':'36512','Betara':'36563' },
    'Kab. Bungo': { 'Muara Bungo':'37211','Rimbo Tengah':'37261' },
    'Kab. Sarolangun': { 'Sarolangun':'37415','Bathin VIII':'37452' },
    'Kota Sungai Penuh': { 'Sungai Penuh':'37112','Hamparan Rawang':'37111' },
  },
  'Sumatera Selatan': {
    'Kota Palembang': { 'Ilir Barat I':'30137','Ilir Timur I':'30112','Kalidoni':'30163','Sukarami':'30151','Kemuning':'30152','Alang-Alang Lebar':'30154','Bukit Kecil':'30113','Sematang Borang':'30169' },
    'Kab. Banyuasin': { 'Banyuasin I':'30753','Talang Kelapa':'30761','Suak Tapeh':'30783','Pulau Rimau':'30754' },
    'Kab. Ogan Komering Ulu': { 'Baturaja Timur':'32115','Baturaja Barat':'32112','Lubuk Batang':'32182','Semidang Aji':'32151' },
    'Kota Lubuklinggau': { 'Lubuklinggau Barat I':'31614','Lubuklinggau Barat II':'31612','Lubuklinggau Timur I':'31624' },
    'Kota Prabumulih': { 'Prabumulih Barat':'31134','Prabumulih Timur':'31111','Rambang Kapak Tengah':'31125' },
    'Kab. Musi Banyuasin': { 'Sekayu':'30711','Babat Supat':'30712','Sungai Keruh':'30769' },
    'Kab. Lahat': { 'Lahat':'31411','Kikim Selatan':'31451' },
  },
  'Bengkulu': {
    'Kota Bengkulu': { 'Ratu Agung':'38224','Teluk Segara':'38111','Gading Cempaka':'38228','Muara Bangkahulu':'38121','Selebar':'38212','Kampung Melayu':'38213' },
    'Kab. Bengkulu Utara': { 'Arga Makmur':'38611','Lais':'38657' },
    'Kab. Seluma': { 'Tais':'38871','Sukaraja':'38873' },
    'Kab. Bengkulu Selatan': { 'Manna':'38511','Kedurang':'38552' },
    'Kab. Kepahiang': { 'Kepahiang':'38371','Bermani Ilir':'38374' },
    'Kab. Rejang Lebong': { 'Curup':'39112','Curup Tengah':'39113' },
  },
  'Lampung': {
    'Kota Bandar Lampung': { 'Kedaton':'35148','Tanjung Karang Timur':'35122','Rajabasa':'35144','Way Halim':'35135','Sukarame':'35131','Kemiling':'35153','Langkapura':'35158','Panjang':'35241','Teluk Betung Selatan':'35214' },
    'Kab. Lampung Tengah': { 'Gunung Sugih':'34161','Trimurjo':'34162','Kalirejo':'34151','Punggur':'34152' },
    'Kab. Lampung Selatan': { 'Kalianda':'35513','Natar':'35362','Jatiagung':'35363' },
    'Kota Metro': { 'Metro Pusat':'34111','Metro Timur':'34124','Metro Barat':'34122','Metro Selatan':'34126' },
    'Kab. Lampung Utara': { 'Kotabumi':'34511','Abung Selatan':'34513' },
    'Kab. Pringsewu': { 'Pringsewu':'35373','Gadingrejo':'35374','Banyumas':'35375' },
    'Kab. Lampung Timur': { 'Sukadana':'34411','Jabung':'34412' },
    'Kota Liwa': { 'Balik Bukit':'34814' },
  },
  'Kepulauan Bangka Belitung': {
    'Kota Pangkal Pinang': { 'Bukit Intan':'33143','Taman Sari':'33121','Rangkui':'33135','Gabek':'33173','Gerunggang':'33115' },
    'Kab. Bangka': { 'Sungailiat':'33215','Merawang':'33261','Bakam':'33268','Mendo Barat':'33266' },
    'Kab. Belitung': { 'Tanjung Pandan':'33412','Membalong':'33471','Sijuk':'33452' },
    'Kab. Bangka Tengah': { 'Koba':'33181','Pangkalan Baru':'33182','Sungai Selan':'33183' },
    'Kab. Bangka Barat': { 'Mentok':'33311','Tempilang':'33361' },
    'Kab. Bangka Selatan': { 'Toboali':'33411','Air Gegas':'33461' },
  },
  'Kepulauan Riau': {
    'Kota Batam': { 'Batu Aji':'29422','Lubuk Baja':'29432','Batam Kota':'29433','Nongsa':'29466','Sekupang':'29423','Batu Ampar':'29441','Bengkong':'29457','Galang':'29463' },
    'Kota Tanjung Pinang': { 'Tanjung Pinang Kota':'29111','Bukit Bestari':'29122','Tanjung Pinang Timur':'29125','Tanjung Pinang Barat':'29112' },
    'Kab. Bintan': { 'Bintan Utara':'29151','Gunung Kijang':'29181','Bintan Timur':'29152' },
    'Kab. Karimun': { 'Karimun':'29611','Meral':'29613','Buru':'29651' },
    'Kab. Natuna': { 'Bunguran Timur':'29783','Bunguran Barat':'29784' },
    'Kota Tanjung Balai Karimun': { 'Karimun':'29611' },
  },
  // ── JAWA ──
  'DKI Jakarta': {
    'Jakarta Pusat': { 'Menteng':'10310','Gambir':'10110','Sawah Besar':'10710','Kemayoran':'10620','Tanah Abang':'10240','Senen':'10410','Johar Baru':'10560','Cempaka Putih':'10510' },
    'Jakarta Selatan': { 'Kebayoran Baru':'12130','Tebet':'12810','Setiabudi':'12920','Mampang Prapatan':'12790','Pancoran':'12760','Pasar Minggu':'12510','Cilandak':'12430','Pesanggrahan':'12320','Kebayoran Lama':'12210','Jagakarsa':'12620' },
    'Jakarta Utara': { 'Penjaringan':'14440','Tanjung Priok':'14310','Koja':'14210','Kelapa Gading':'14240','Pademangan':'14410','Cilincing':'14120','Papanggo':'14340' },
    'Jakarta Barat': { 'Grogol Petamburan':'11450','Kebon Jeruk':'11530','Cengkareng':'11730','Tambora':'11210','Kalideres':'11840','Palmerah':'11480','Kembangan':'11610','Taman Sari':'11150' },
    'Jakarta Timur': { 'Jatinegara':'13320','Kramat Jati':'13510','Makasar':'13650','Duren Sawit':'13440','Pulogadung':'13260','Cakung':'13910','Pasar Rebo':'13760','Ciracas':'13740','Cipayung':'13840','Matraman':'13140' },
    'Kepulauan Seribu': { 'Kepulauan Seribu Utara':'14540','Kepulauan Seribu Selatan':'14550' },
  },
  'Jawa Barat': {
    'Kota Bandung': { 'Coblong':'40132','Sukajadi':'40161','Cicendo':'40171','Antapani':'40291','Buahbatu':'40261','Bandung Wetan':'40113','Cidadap':'40143','Cibeunying Kaler':'40122','Regol':'40252','Lengkong':'40261','Bojongloa Kaler':'40183','Arcamanik':'40293','Mandalajati':'40294' },
    'Kota Bekasi': { 'Bekasi Selatan':'17148','Bekasi Utara':'17125','Bekasi Barat':'17135','Bekasi Timur':'17111','Jatiasih':'17423','Rawalumbu':'17116','Pondok Gede':'17411','Mustikajaya':'17156','Pondok Melati':'17414','Jatisampurna':'17433','Bantargebang':'17151','Medansatria':'17132' },
    'Kota Bogor': { 'Bogor Tengah':'16112','Bogor Selatan':'16132','Bogor Barat':'16117','Bogor Utara':'16153','Tanah Sereal':'16161','Bogor Timur':'16143' },
    'Kota Depok': { 'Beji':'16423','Pancoran Mas':'16436','Cimanggis':'16451','Limo':'16514','Sukmajaya':'16411','Sawangan':'16516','Cilodong':'16414','Cipayung':'16437','Tapos':'16457','Bojongsari':'16519' },
    'Kab. Karawang': { 'Karawang Barat':'41311','Karawang Timur':'41312','Cikampek':'41373','Purwasari':'41371','Teluk Jambe Timur':'41361' },
    'Kab. Bekasi': { 'Tambun Selatan':'17510','Cikarang Barat':'17520','Cikarang Utara':'17530','Cikarang Selatan':'17530','Tambun Utara':'17511','Babelan':'17610' },
    'Kab. Bogor': { 'Cibinong':'16913','Citereup':'16810','Gunung Putri':'16964','Bojonggede':'16920','Jonggol':'16830','Parung':'16330' },
    'Kota Cimahi': { 'Cimahi Selatan':'40531','Cimahi Tengah':'40521','Cimahi Utara':'40511' },
    'Kab. Sukabumi': { 'Sukabumi':'43113','Cikembar':'43161','Cisaat':'43152' },
    'Kab. Cianjur': { 'Cianjur':'43211','Pacet':'43253','Sukaresmi':'43254' },
    'Kab. Bandung': { 'Dayeuhkolot':'40258','Margahayu':'40228','Majalaya':'40382','Cicalengka':'40395' },
    'Kab. Garut': { 'Garut Kota':'44111','Tarogong Kidul':'44151','Banyuresmi':'44152' },
    'Kab. Tasikmalaya': { 'Tasikmalaya':'46111','Cibeureum':'46152','Mangkubumi':'46181' },
    'Kota Tasikmalaya': { 'Tawang':'46111','Cihideung':'46122','Mangkubumi':'46115' },
    'Kab. Majalengka': { 'Majalengka':'45411','Rajagaluh':'45471' },
    'Kab. Cirebon': { 'Sumber':'45611','Arjawinangun':'45151' },
    'Kota Cirebon': { 'Kesambi':'45131','Lemahwungkuk':'45111','Harjamukti':'45144' },
    'Kab. Sumedang': { 'Sumedang Utara':'45311','Cimalaka':'45353' },
    'Kab. Subang': { 'Subang':'41211','Pabuaran':'41261' },
    'Kab. Purwakarta': { 'Purwakarta':'41111','Bungursari':'41152','Campaka':'41115' },
    'Kab. Indramayu': { 'Indramayu':'45211','Sindang':'45222','Jatibarang':'45273' },
    'Kab. Kuningan': { 'Kuningan':'45511','Jalaksana':'45552','Cilimus':'45556' },
    'Kab. Bandung Barat': { 'Padalarang':'40551','Batujajar':'40561','Ngamprah':'40552' },
    'Kota Banjar': { 'Banjar':'46311','Pataruman':'46323' },
    'Kab. Ciamis': { 'Ciamis':'46211','Baregbeg':'46231' },
    'Kab. Pangandaran': { 'Parigi':'46393','Pangandaran':'46394' },
  },
  'Jawa Tengah': {
    'Kota Semarang': { 'Banyumanik':'50264','Tembalang':'50275','Semarang Tengah':'50134','Pedurungan':'50198','Gayamsari':'50166','Genuk':'50117','Gajahmungkur':'50232','Semarang Barat':'50141','Semarang Timur':'50121','Semarang Utara':'50174','Semarang Selatan':'50252','Candisari':'50254','Gunung Pati':'50221','Ngaliyan':'50182','Tugu':'50175','Mijen':'50217' },
    'Kota Surakarta': { 'Banjarsari':'57136','Laweyan':'57147','Jebres':'57126','Serengan':'57155','Pasar Kliwon':'57113' },
    'Kab. Banyumas': { 'Purwokerto Timur':'53115','Purwokerto Barat':'53131','Purwokerto Selatan':'53141','Sokaraja':'53181','Kembaran':'53182' },
    'Kab. Kudus': { 'Kota Kudus':'59313','Jati':'59341','Bae':'59322' },
    'Kota Magelang': { 'Magelang Tengah':'56111','Magelang Selatan':'56121','Magelang Utara':'56115' },
    'Kab. Magelang': { 'Mertoyudan':'56172','Salam':'56484','Muntilan':'56412','Mungkid':'56511' },
    'Kota Pekalongan': { 'Pekalongan Barat':'51111','Pekalongan Timur':'51124','Pekalongan Selatan':'51131','Pekalongan Utara':'51141' },
    'Kota Tegal': { 'Tegal Barat':'52115','Tegal Selatan':'52124','Tegal Timur':'52111' },
    'Kab. Cilacap': { 'Cilacap Tengah':'53222','Kroya':'53282','Kesugihan':'53274' },
    'Kab. Purbalingga': { 'Purbalingga':'53311','Kalimanah':'53371' },
    'Kab. Kebumen': { 'Kebumen':'54311','Gombong':'54412','Karanganyar':'54351' },
    'Kab. Purworejo': { 'Purworejo':'54111','Banyuurip':'54151' },
    'Kab. Wonosobo': { 'Wonosobo':'56311','Mojotengah':'56371' },
    'Kab. Boyolali': { 'Boyolali':'57311','Ngemplak':'57375' },
    'Kab. Klaten': { 'Klaten Tengah':'57411','Prambanan':'57454','Wedi':'57461' },
    'Kab. Sukoharjo': { 'Sukoharjo':'57511','Grogol':'57552','Kartasura':'57167' },
    'Kab. Wonogiri': { 'Wonogiri':'57611','Selogiri':'57651' },
    'Kab. Karanganyar': { 'Karanganyar':'57711','Colomadu':'57173' },
    'Kab. Sragen': { 'Sragen':'57211','Karangmalang':'57271' },
    'Kab. Grobogan': { 'Purwodadi':'58111','Gubug':'58164' },
    'Kab. Blora': { 'Blora':'58211','Cepu':'58312' },
    'Kab. Rembang': { 'Rembang':'59211','Lasem':'59271' },
    'Kab. Pati': { 'Pati':'59111','Juwana':'59185' },
    'Kab. Jepara': { 'Jepara':'59411','Welahan':'59463','Pecangaan':'59461' },
    'Kab. Demak': { 'Demak':'59511','Mranggen':'59567' },
    'Kab. Kendal': { 'Kendal':'51311','Kaliwungu':'51372' },
    'Kab. Batang': { 'Batang':'51211','Gringsing':'51261' },
    'Kab. Pemalang': { 'Pemalang':'52311','Ulujami':'52361' },
    'Kab. Tegal': { 'Slawi':'52411','Adiwerna':'52194' },
    'Kab. Brebes': { 'Brebes':'52211','Bumiayu':'52273' },
    'Kota Salatiga': { 'Sidomukti':'50721','Sidorejo':'50711','Argomulyo':'50731' },
  },
  'DI Yogyakarta': {
    'Kota Yogyakarta': { 'Gondokusuman':'55221','Umbulharjo':'55161','Danurejan':'55213','Mergangsan':'55153','Kraton':'55131','Jetis':'55231','Tegalrejo':'55241','Wirobrajan':'55251','Ngampilan':'55261','Pakualaman':'55166','Mantrijeron':'55142','Gedongtengen':'55271','Gondomanan':'55122','Kotagede':'55172' },
    'Kab. Sleman': { 'Depok':'55281','Mlati':'55284','Gamping':'55291','Godean':'55264','Berbah':'55573','Ngaglik':'55581','Kalasan':'55571','Prambanan':'55572','Pakem':'55582','Moyudan':'55563','Minggir':'55562','Seyegan':'55561','Tempel':'55552','Turi':'55551','Sleman':'55511','Ngemplak':'55584','Cangkringan':'55583' },
    'Kab. Bantul': { 'Banguntapan':'55198','Sewon':'55186','Kasihan':'55181','Bantul':'55714','Piyungan':'55792','Jetis':'55781','Pleret':'55791','Imogiri':'55782','Pandak':'55761','Bambanglipuro':'55764','Pundong':'55771','Kretek':'55772','Sanden':'55763','Srandakan':'55762','Pajangan':'55751','Sedayu':'55752' },
    'Kab. Gunung Kidul': { 'Wonosari':'55812','Nglipar':'55855','Playen':'55861','Patuk':'55871','Gedangsari':'55872','Ngawen':'55853','Semin':'55854','Ponjong':'55892','Karangmojo':'55891','Semanu':'55893','Tepus':'55881','Tanjungsari':'55882','Rongkop':'55883','Girisubo':'55884','Saptosari':'55851','Paliyan':'55862','Panggang':'55872' },
    'Kab. Kulon Progo': { 'Wates':'55611','Pengasih':'55651','Lendah':'55663','Galur':'55661','Temon':'55654','Panjatan':'55655','Kokap':'55653','Girimulyo':'55674','Nanggulan':'55671','Kalibawang':'55672','Samigaluh':'55673' },
  },
  'Jawa Timur': {
    'Kota Surabaya': { 'Tegalsari':'60262','Wonokromo':'60243','Kenjeran':'60135','Rungkut':'60294','Mulyorejo':'60115','Sukolilo':'60111','Gubeng':'60281','Genteng':'60271','Bubutan':'60172','Simokerto':'60151','Semampir':'60143','Pabean Cantikan':'60162','Bulak':'60123','Krembangan':'60175','Asemrowo':'60182','Sukomanunggal':'60188','Benowo':'60195','Pakal':'60197','Lakarsantri':'60213','Sambikerep':'60216','Tandes':'60186','Karang Pilang':'60221','Wiyung':'60227','Dukuh Pakis':'60225','Wonocolo':'60237','Gayungan':'60235','Jambangan':'60232','Sawahan':'60251','Dukuh Pakis':'60225' },
    'Kota Malang': { 'Klojen':'65111','Lowokwaru':'65141','Kedungkandang':'65136','Sukun':'65148','Blimbing':'65122' },
    'Kab. Sidoarjo': { 'Sidoarjo':'61211','Waru':'61256','Taman':'61257','Gedangan':'61254','Candi':'61271','Tanggulangin':'61272','Porong':'61274' },
    'Kota Kediri': { 'Kediri Kota':'64111','Pesantren':'64131','Mojoroto':'64119' },
    'Kab. Gresik': { 'Gresik':'61111','Kebomas':'61124','Driyorejo':'61177' },
    'Kota Madiun': { 'Manguharjo':'63121','Taman':'63131','Kartoharjo':'63113' },
    'Kab. Jember': { 'Patrang':'68111','Sumbersari':'68121','Kaliwates':'68131' },
    'Kab. Malang': { 'Kepanjen':'65163','Lawang':'65213','Singosari':'65153' },
    'Kota Batu': { 'Batu':'65311','Junrejo':'65321','Bumiaji':'65331' },
    'Kab. Pasuruan': { 'Pohjentrek':'67154','Bangil':'67153' },
    'Kota Pasuruan': { 'Bugul Kidul':'67131','Gadingrejo':'67139' },
    'Kota Mojokerto': { 'Magersari':'61311','Prajurit Kulon':'61321' },
    'Kab. Mojokerto': { 'Mojosari':'61382','Bangsal':'61362' },
    'Kab. Lamongan': { 'Lamongan':'62211','Ngimbang':'62262' },
    'Kab. Bojonegoro': { 'Bojonegoro':'62111','Cepu':'62262' },
    'Kab. Tuban': { 'Tuban':'62311','Palang':'62361' },
    'Kab. Nganjuk': { 'Nganjuk':'64411','Bagor':'64471' },
    'Kab. Madiun': { 'Madiun':'63151','Dolopo':'63152' },
    'Kab. Ngawi': { 'Ngawi':'63211','Paron':'63261' },
    'Kab. Magetan': { 'Magetan':'63311','Parang':'63362' },
    'Kab. Ponorogo': { 'Ponorogo':'63411','Babadan':'63461' },
    'Kab. Pacitan': { 'Pacitan':'63511','Arjosari':'63561' },
    'Kab. Trenggalek': { 'Trenggalek':'66311','Pogalan':'66352' },
    'Kab. Tulungagung': { 'Tulungagung':'66211','Kedungwaru':'66224' },
    'Kab. Blitar': { 'Blitar':'66131','Srengat':'66152' },
    'Kota Blitar': { 'Sukorejo':'66121','Kepanjenkidul':'66111' },
    'Kab. Probolinggo': { 'Probolinggo':'67211','Dringu':'67271' },
    'Kota Probolinggo': { 'Mayangan':'67211','Kedopok':'67219' },
    'Kab. Lumajang': { 'Lumajang':'67311','Yosowilangun':'67381' },
    'Kab. Situbondo': { 'Situbondo':'68311','Panji':'68312' },
    'Kab. Bondowoso': { 'Bondowoso':'68211','Curahdami':'68252' },
    'Kab. Banyuwangi': { 'Banyuwangi':'68411','Genteng':'68464' },
    'Kab. Jombang': { 'Jombang':'61411','Peterongan':'61481' },
    'Kab. Bangkalan': { 'Bangkalan':'69111','Socah':'69153' },
    'Kab. Sampang': { 'Sampang':'69211','Camplong':'69261' },
    'Kab. Pamekasan': { 'Pamekasan':'69311','Waru':'69363' },
    'Kab. Sumenep': { 'Sumenep':'69411','Ambunten':'69461' },
  },
  'Banten': {
    'Kota Tangerang': { 'Cipondoh':'15148','Pinang':'15145','Karawaci':'15112','Batuceper':'15122','Cibodas':'15138','Jatiuwung':'15135','Neglasari':'15129','Benda':'15124','Periuk':'15131','Larangan':'15154','Ciledug':'15153','Karang Tengah':'15157' },
    'Kota Tangerang Selatan': { 'Pamulang':'15417','Ciputat':'15411','Pondok Aren':'15224','Serpong':'15310','Ciputat Timur':'15412','Serpong Utara':'15320','Setu':'15315' },
    'Kota Serang': { 'Serang':'42111','Cipocok Jaya':'42122','Taktakan':'42163','Kasemen':'42191','Walantaka':'42183','Curug':'42171' },
    'Kab. Tangerang': { 'Tigaraksa':'15720','Pasar Kemis':'15560','Kosambi':'15212','Legok':'15820','Sepatan':'15520','Kelapa Dua':'15810','Curug':'15810' },
    'Kota Cilegon': { 'Cilegon':'42411','Cibeber':'42422','Citangkil':'42445','Purwakarta':'42431','Jombang':'42415' },
    'Kab. Serang': { 'Serang':'42116','Ciruas':'42182','Kragilan':'42183' },
    'Kab. Lebak': { 'Rangkasbitung':'42311','Maja':'42382' },
    'Kab. Pandeglang': { 'Pandeglang':'42211','Labuan':'42264' },
  },
  // ── BALI & NUSA TENGGARA ──
  'Bali': {
    'Kota Denpasar': { 'Denpasar Barat':'80117','Denpasar Selatan':'80223','Denpasar Timur':'80237','Denpasar Utara':'80119' },
    'Kab. Badung': { 'Kuta':'80361','Kuta Utara':'80351','Mengwi':'80351','Kuta Selatan':'80361','Abiansemal':'80352','Petang':'80353' },
    'Kab. Gianyar': { 'Gianyar':'80512','Sukawati':'80582','Ubud':'80571','Tegallalang':'80561','Tampaksiring':'80552' },
    'Kab. Buleleng': { 'Buleleng':'81116','Singaraja':'81117','Seririt':'81153','Gerokgak':'81155' },
    'Kab. Tabanan': { 'Tabanan':'82111','Kediri':'82121','Kerambitan':'82161' },
    'Kab. Klungkung': { 'Klungkung':'80712','Dawan':'80771','Nusa Penida':'80773' },
    'Kab. Karangasem': { 'Amlapura':'80811','Karangasem':'80812','Abang':'80854' },
    'Kab. Bangli': { 'Bangli':'80611','Kintamani':'80652' },
    'Kab. Jembrana': { 'Negara':'82211','Mendoyo':'82251' },
  },
  'Nusa Tenggara Barat': {
    'Kota Mataram': { 'Ampenan':'83113','Cakranegara':'83234','Mataram':'83126','Sekarbela':'83116','Selaparang':'83231','Sandubaya':'83232' },
    'Kab. Lombok Barat': { 'Gerung':'83363','Narmada':'83371','Lingsar':'83361','Labuapi':'83362' },
    'Kab. Lombok Tengah': { 'Praya':'83511','Janapria':'83553','Praya Barat':'83571','Praya Timur':'83572' },
    'Kab. Lombok Timur': { 'Selong':'83611','Aikmel':'83653','Masbagik':'83661' },
    'Kab. Lombok Utara': { 'Tanjung':'83352','Gangga':'83353' },
    'Kab. Sumbawa': { 'Sumbawa':'84311','Unter Iwes':'84315','Lunyuk':'84361' },
    'Kab. Dompu': { 'Dompu':'84211','Woja':'84261' },
    'Kota Bima': { 'Rasanae Barat':'84111','Raba':'84112','Mpunda':'84113' },
    'Kab. Bima': { 'Bolo':'84161','Woha':'84171' },
    'Kab. Sumbawa Barat': { 'Taliwang':'84357','Sekongkang':'84358' },
  },
  'Nusa Tenggara Timur': {
    'Kota Kupang': { 'Kota Raja':'85111','Kota Lama':'85112','Oebobo':'85111','Maulafa':'85147','Alak':'85148','Kelapa Lima':'85228' },
    'Kab. Ende': { 'Ende':'86312','Detukeli':'86357','Ndona':'86352' },
    'Kab. Manggarai': { 'Langke Rembong':'86511','Cibal':'86552' },
    'Kab. Manggarai Barat': { 'Komodo':'86551','Lembor':'86552' },
    'Kab. Sikka': { 'Alok':'86111','Nele':'86161' },
    'Kab. Flores Timur': { 'Larantuka':'86211','Titehena':'86261' },
    'Kab. Timor Tengah Selatan': { 'Soe':'85512','Amanuban Selatan':'85551' },
    'Kab. Timor Tengah Utara': { 'Kefamenanu':'85611','Biboki Anleu':'85652' },
    'Kab. Belu': { 'Atambua':'85711','Tasifeto Barat':'85751' },
    'Kab. Sumba Timur': { 'Kota Waingapu':'87111','Kambera':'87112' },
    'Kab. Sumba Barat': { 'Kota Waikabubak':'87211' },
  },
  // ── KALIMANTAN ──
  'Kalimantan Barat': {
    'Kota Pontianak': { 'Pontianak Kota':'78112','Pontianak Selatan':'78121','Pontianak Barat':'78244','Pontianak Tenggara':'78115','Pontianak Utara':'78241','Pontianak Timur':'78232' },
    'Kab. Kubu Raya': { 'Sungai Raya':'78391','Sungai Ambawang':'78381','Sungai Kakap':'78381' },
    'Kab. Sanggau': { 'Sanggau':'78511','Kapuas':'78516' },
    'Kota Singkawang': { 'Singkawang Barat':'79112','Singkawang Tengah':'79121','Singkawang Timur':'79121' },
    'Kab. Landak': { 'Ngabang':'78357','Sengah Temila':'78382' },
    'Kab. Sambas': { 'Sambas':'79411','Pemangkat':'79452' },
    'Kab. Mempawah': { 'Mempawah Hilir':'78912','Sungai Pinyuh':'78951' },
    'Kab. Bengkayang': { 'Bengkayang':'79211','Ledo':'79251' },
    'Kab. Ketapang': { 'Delta Pawan':'78811','Sandai':'78861' },
    'Kab. Sintang': { 'Sintang':'78611','Binjai Hulu':'78652' },
    'Kab. Melawi': { 'Nanga Pinoh':'78671','Sokan':'78672' },
    'Kab. Kapuas Hulu': { 'Putussibau Utara':'78711','Putussibau Selatan':'78712' },
  },
  'Kalimantan Tengah': {
    'Kota Palangka Raya': { 'Pahandut':'73112','Jekan Raya':'73111','Sebangau':'73116','Bukit Batu':'73113','Rakumpit':'73114' },
    'Kab. Kotawaringin Barat': { 'Arut Selatan':'74311','Pangkalan Banteng':'74351','Arut Utara':'74312' },
    'Kab. Kotawaringin Timur': { 'Mentawa Baru Ketapang':'74311','Baamang':'74362' },
    'Kab. Kapuas': { 'Selat':'73511','Kapuas Murung':'73521' },
    'Kab. Barito Selatan': { 'Buntok':'73711','Dusun Selatan':'73712' },
    'Kab. Barito Utara': { 'Teweh Baru':'73812','Teweh Tengah':'73811' },
    'Kab. Seruyan': { 'Kuala Pembuang':'74111','Seruyan Hilir':'74112' },
    'Kab. Katingan': { 'Kasongan':'74452','Mendawai':'74453' },
    'Kab. Pulang Pisau': { 'Kahayan Hilir':'74811' },
    'Kab. Gunung Mas': { 'Kurun':'74511','Tewah':'74515' },
    'Kab. Barito Timur': { 'Tamiang Layang':'73611' },
    'Kab. Murung Raya': { 'Puruk Cahu':'73911' },
    'Kab. Lamandau': { 'Nanga Bulik':'74611' },
    'Kab. Sukamara': { 'Sukamara':'74171' },
  },
  'Kalimantan Selatan': {
    'Kota Banjarmasin': { 'Banjarmasin Barat':'70116','Banjarmasin Selatan':'70241','Banjarmasin Tengah':'70112','Banjarmasin Utara':'70123','Banjarmasin Timur':'70235' },
    'Kab. Banjar': { 'Martapura':'70611','Gambut':'70652','Kertak Hanyar':'70653' },
    'Kota Banjarbaru': { 'Banjarbaru Selatan':'70711','Cempaka':'70722','Landasan Ulin':'70724' },
    'Kab. Tanah Laut': { 'Pelaihari':'70811','Batu Ampar':'70861' },
    'Kab. Barito Kuala': { 'Marabahan':'70511','Mandastana':'70561' },
    'Kab. Hulu Sungai Selatan': { 'Kandangan':'71211','Simpur':'71261' },
    'Kab. Hulu Sungai Tengah': { 'Barabai':'71311','Pandawan':'71362' },
    'Kab. Hulu Sungai Utara': { 'Amuntai Tengah':'71411','Sungai Pandan':'71461' },
    'Kab. Tapin': { 'Rantau':'71111','Bakarangan':'71161' },
    'Kab. Tabalong': { 'Tanjung':'71511','Murung Pudak':'71561' },
    'Kab. Tanah Bumbu': { 'Batulicin':'72171','Satui':'72172' },
    'Kab. Balangan': { 'Paringin':'71611','Paringin Selatan':'71661' },
    'Kab. Kotabaru': { 'Pulau Laut Utara':'72111','Pulau Laut Tengah':'72161' },
  },
  'Kalimantan Timur': {
    'Kota Samarinda': { 'Samarinda Kota':'75112','Samarinda Ilir':'75131','Samarinda Ulu':'75123','Samarinda Seberang':'75241','Loa Janan Ilir':'75244','Palaran':'75261','Sungai Pinang':'75117' },
    'Kota Balikpapan': { 'Balikpapan Barat':'76114','Balikpapan Kota':'76113','Balikpapan Selatan':'76114','Balikpapan Utara':'76127','Balikpapan Tengah':'76123','Balikpapan Timur':'76115' },
    'Kab. Kutai Kartanegara': { 'Tenggarong':'75511','Tenggarong Seberang':'75515','Samboja':'75517' },
    'Kota Bontang': { 'Bontang Utara':'75313','Bontang Selatan':'75321','Bontang Barat':'75323' },
    'Kab. Berau': { 'Tanjung Redeb':'77311','Gunung Tabur':'77381' },
    'Kab. Kutai Barat': { 'Sendawar':'75761','Barong Tongkok':'75762' },
    'Kab. Kutai Timur': { 'Sangatta Utara':'75611','Sangatta Selatan':'75612' },
    'Kab. Penajam Paser Utara': { 'Penajam':'76141','Waru':'76142' },
    'Kab. Paser': { 'Tanah Grogot':'76211','Long Ikis':'76262' },
    'Kab. Mahakam Ulu': { 'Long Bagun':'77551' },
  },
  'Kalimantan Utara': {
    'Kota Tarakan': { 'Tarakan Barat':'77113','Tarakan Tengah':'77111','Tarakan Timur':'77115','Tarakan Utara':'77116' },
    'Kab. Nunukan': { 'Nunukan':'77411','Sebatik':'77462','Nunukan Selatan':'77412' },
    'Kab. Bulungan': { 'Tanjung Selor':'77212','Peso':'77261' },
    'Kab. Malinau': { 'Malinau Kota':'77511','Malinau Utara':'77561' },
    'Kab. Tana Tidung': { 'Tideng Pale':'77611' },
  },
  // ── SULAWESI ──
  'Sulawesi Utara': {
    'Kota Manado': { 'Wenang':'95112','Wanea':'95118','Tuminting':'95131','Singkil':'95141','Mapanget':'95253','Tikala':'95125','Sario':'95115','Malalayang':'95152','Bunaken':'95253','Paal Dua':'95128' },
    'Kab. Minahasa': { 'Tondano Barat':'95612','Tondano Utara':'95611','Eris':'95671' },
    'Kota Bitung': { 'Bitung Barat':'95512','Bitung Tengah':'95514','Girian':'95523' },
    'Kota Tomohon': { 'Tomohon Tengah':'95416','Tomohon Utara':'95411','Tomohon Selatan':'95419' },
    'Kab. Minahasa Utara': { 'Airmadidi':'95374','Dimembe':'95375' },
    'Kab. Minahasa Selatan': { 'Amurang':'95416','Tenga':'95417' },
    'Kota Kotamobagu': { 'Kotamobagu Barat':'95711','Kotamobagu Timur':'95712' },
    'Kab. Bolaang Mongondow': { 'Lolayan':'95791','Bolaang Uki':'95792' },
    'Kab. Kepulauan Sangihe': { 'Tahuna':'95811' },
    'Kab. Kepulauan Talaud': { 'Melonguane':'95851' },
  },
  'Sulawesi Tengah': {
    'Kota Palu': { 'Palu Barat':'94111','Palu Selatan':'94116','Palu Timur':'94114','Tatanga':'94119','Mantikulore':'94112','Ulujadi':'94118','Tawaeli':'94113','Palu Utara':'94116' },
    'Kab. Donggala': { 'Banawa':'94311','Rio Pakava':'94362','Sindue':'94363' },
    'Kab. Sigi': { 'Dolo':'94364','Palolo':'94365' },
    'Kab. Morowali': { 'Bungku Tengah':'94671','Bungku Utara':'94675' },
    'Kab. Parigi Moutong': { 'Parigi':'94411','Toribulu':'94461' },
    'Kab. Poso': { 'Poso Kota':'94611','Poso Pesisir':'94661' },
    'Kab. Tojo Una-Una': { 'Ampana Tete':'94683','Uekuli':'94684' },
    'Kab. Banggai': { 'Luwuk':'94711','Batui':'94771' },
    'Kab. Banggai Kepulauan': { 'Banggai':'94791' },
    'Kab. Buol': { 'Buol':'94562' },
    'Kab. Toli-Toli': { 'Baolan':'94511' },
  },
  'Sulawesi Selatan': {
    'Kota Makassar': { 'Mariso':'90125','Mamajang':'90131','Tamalate':'90224','Rappocini':'90222','Makassar':'90111','Tallo':'90212','Bontoala':'90154','Biringkanaya':'90241','Manggala':'90234','Panakkukang':'90231','Tamalanrea':'90245','Wajo':'90174','Ujung Tanah':'90165','Kepulauan Sangkarrang':'90217' },
    'Kab. Gowa': { 'Somba Opu':'92111','Pallangga':'92112','Bajeng':'92113','Bontonompo':'92161' },
    'Kab. Maros': { 'Mandai':'90571','Turikale':'90511','Maros Baru':'90511' },
    'Kota Parepare': { 'Bacukiki':'91112','Ujung':'91113','Soreang':'91111' },
    'Kab. Bone': { 'Tanete Riattang':'92711','Tanete Riattang Barat':'92751' },
    'Kab. Bulukumba': { 'Ujung Bulu':'92411','Gantarang':'92451' },
    'Kab. Bantaeng': { 'Bantaeng':'92411','Bissappu':'92421' },
    'Kab. Jeneponto': { 'Binamu':'92311','Bangkala':'92371' },
    'Kab. Takalar': { 'Pattallassang':'92211','Galesong':'92261' },
    'Kab. Selayar': { 'Benteng':'92811','Bontoharu':'92861' },
    'Kab. Sinjai': { 'Sinjai Utara':'92611','Sinjai Selatan':'92671' },
    'Kab. Barru': { 'Barru':'90711','Pujananting':'90761' },
    'Kab. Soppeng': { 'Lalabata':'90811','Lilirilau':'90871' },
    'Kab. Wajo': { 'Tempe':'90911','Pammana':'90972' },
    'Kab. Sidrap': { 'Maritengngae':'91611','Watang Pulu':'91661' },
    'Kab. Pinrang': { 'Watang Sawitto':'91211','Paleteang':'91261' },
    'Kab. Enrekang': { 'Baraka':'91711','Alla':'91712' },
    'Kab. Luwu': { 'Belopa':'91911','Bajo':'91971' },
    'Kab. Tana Toraja': { 'Makale':'91811','Gandang Batu Sillanan':'91881' },
    'Kab. Toraja Utara': { 'Rantepao':'91831','Kesu':'91881' },
    'Kota Palopo': { 'Wara':'91911','Sendana':'91923' },
    'Kab. Luwu Utara': { 'Masamba':'92961','Sukamaju':'92973' },
    'Kab. Luwu Timur': { 'Malili':'92981','Towuti':'92982' },
    'Kota Makassar (Kepulauan)': { 'Sangkarrang':'90217' },
  },
  'Sulawesi Tenggara': {
    'Kota Kendari': { 'Kendari':'93111','Kendari Barat':'93117','Baruga':'93116','Abeli':'93231','Poasia':'93232','Kambu':'93116','Mandonga':'93125','Puuwatu':'93126','Wua-Wua':'93113','Kadia':'93114','Nambo':'93225' },
    'Kab. Muna': { 'Katobu':'93611','Parigi':'93612' },
    'Kab. Konawe': { 'Unaaha':'93411','Bondoala':'93461' },
    'Kab. Konawe Selatan': { 'Andoolo':'93459','Benua':'93461' },
    'Kab. Buton': { 'Pasarwajo':'93711','Lasalimu':'93761' },
    'Kota Baubau': { 'Lea-Lea':'93711','Murhum':'93712','Wolio':'93721' },
    'Kab. Kolaka': { 'Kolaka':'93511','Pomalaa':'93562' },
    'Kab. Kolaka Utara': { 'Lasusua':'93561','Kodeoha':'93562' },
    'Kab. Bombana': { 'Rumbia':'93772','Kabaena':'93773' },
    'Kab. Wakatobi': { 'Wangi-Wangi':'93791','Kaledupa':'93792' },
  },
  'Gorontalo': {
    'Kota Gorontalo': { 'Kota Barat':'96115','Kota Tengah':'96114','Kota Timur':'96113','Dungingi':'96128','Dumbo Raya':'96132','Hulontalangi':'96131','Sipatana':'96127','Kota Selatan':'96116','Kota Utara':'96111' },
    'Kab. Gorontalo': { 'Limboto':'96211','Telaga':'96252','Tibawa':'96253' },
    'Kab. Bone Bolango': { 'Suwawa':'96511','Kabila':'96512' },
    'Kab. Gorontalo Utara': { 'Kwandang':'96611','Tolinggula':'96661' },
    'Kab. Boalemo': { 'Tilamuta':'96321','Paguyaman':'96371' },
    'Kab. Pohuwato': { 'Marisa':'96411','Paguat':'96461' },
  },
  'Sulawesi Barat': {
    'Kab. Mamuju': { 'Mamuju':'91511','Kalukku':'91561','Papalang':'91562' },
    'Kab. Majene': { 'Banggae':'91412','Banggae Timur':'91413','Pamboang':'91451' },
    'Kab. Polewali Mandar': { 'Polewali':'91311','Wonomulyo':'91361' },
    'Kab. Mamasa': { 'Mamasa':'91362' },
    'Kab. Pasangkayu': { 'Pasangkayu':'91571' },
    'Kab. Mamuju Tengah': { 'Budong-Budong':'91581' },
  },
  // ── MALUKU ──
  'Maluku': {
    'Kota Ambon': { 'Nusaniwe':'97114','Sirimau':'97127','Teluk Ambon Baguala':'97231','Leitimur Selatan':'97115','Baguala':'97228' },
    'Kab. Maluku Tengah': { 'Tehoru':'97512','Kairatu':'97561','Amahai':'97511' },
    'Kab. Maluku Tenggara': { 'Kei Kecil':'97611','Kei Besar':'97661' },
    'Kab. Seram Bagian Barat': { 'Kairatu Barat':'97561','Huamual':'97562' },
    'Kab. Seram Bagian Timur': { 'Bula':'97611' },
    'Kab. Kepulauan Aru': { 'Dobo':'97611' },
    'Kab. Maluku Barat Daya': { 'Tiakur':'97411' },
    'Kab. Buru': { 'Namlea':'97681' },
    'Kab. Buru Selatan': { 'Namrole':'97692' },
    'Kota Tual': { 'Pulau Dullah Selatan':'97613' },
  },
  'Maluku Utara': {
    'Kota Ternate': { 'Kota Ternate Selatan':'97713','Kota Ternate Utara':'97721','Kota Ternate Tengah':'97716','Kota Ternate Barat':'97711' },
    'Kab. Halmahera Barat': { 'Jailolo':'97811','Sahu':'97861' },
    'Kota Tidore Kepulauan': { 'Tidore':'97812','Oba':'97861' },
    'Kab. Halmahera Utara': { 'Tobelo':'97762','Galela':'97763' },
    'Kab. Halmahera Selatan': { 'Bacan':'97791','Kayoa':'97793' },
    'Kab. Halmahera Timur': { 'Maba':'97871' },
    'Kab. Halmahera Tengah': { 'Weda':'97781' },
    'Kab. Kepulauan Sula': { 'Sanana':'97851' },
    'Kab. Pulau Morotai': { 'Morotai Selatan':'97771' },
    'Kab. Pulau Taliabu': { 'Bobong':'97856' },
  },
  // ── PAPUA ──
  'Papua Barat': {
    'Kota Manokwari': { 'Manokwari Barat':'98312','Manokwari Selatan':'98313','Distrik Manokwari':'98311' },
    'Kab. Sorong': { 'Aimas':'98411','Salawati':'98451' },
    'Kota Sorong': { 'Sorong':'98411','Sorong Barat':'98413','Sorong Utara':'98414' },
    'Kab. Manokwari Selatan': { 'Ransiki':'98351' },
    'Kab. Teluk Bintuni': { 'Bintuni':'98551' },
    'Kab. Teluk Wondama': { 'Rasiei':'98451' },
    'Kab. Fakfak': { 'Fakfak':'98611' },
    'Kab. Kaimana': { 'Kaimana':'98651' },
    'Kab. Maybrat': { 'Kumurkek':'98361' },
    'Kab. Raja Ampat': { 'Waisai':'98488' },
    'Kab. Tambrauw': { 'Fef':'98315' },
  },
  'Papua Barat Daya': {
    'Kota Sorong': { 'Sorong Kota':'98411','Sorong Kepulauan':'98452' },
    'Kab. Sorong': { 'Aimas':'98411','Salawati Tengah':'98452' },
    'Kab. Sorong Selatan': { 'Teminabuan':'98453' },
    'Kab. Raja Ampat': { 'Waisai':'98488' },
    'Kab. Maybrat': { 'Kumurkek':'98361' },
    'Kab. Tambrauw': { 'Fef':'98315' },
  },
  'Papua': {
    'Kota Jayapura': { 'Abepura':'99351','Jayapura Selatan':'99224','Jayapura Utara':'99112','Heram':'99358','Muara Tami':'99225' },
    'Kab. Jayapura': { 'Sentani':'99352','Waibu':'99353','Nimboran':'99354' },
    'Kab. Keerom': { 'Arso':'99661','Web':'99662' },
    'Kab. Sarmi': { 'Sarmi':'99271' },
    'Kab. Waropen': { 'Botawa':'99272' },
    'Kab. Biak Numfor': { 'Biak Kota':'98111','Samofa':'98151' },
    'Kab. Yapen': { 'Serui':'98211' },
    'Kab. Supiori': { 'Sorendiweri':'98161' },
    'Kab. Mamberamo Raya': { 'Burmeso':'99331' },
  },
  'Papua Selatan': {
    'Kab. Merauke': { 'Merauke':'99611','Naukenjerai':'99612','Semangga':'99661' },
    'Kab. Asmat': { 'Agats':'99765','Fayit':'99766' },
    'Kab. Mappi': { 'Obaa':'99861','Nambioman Bapai':'99862' },
    'Kab. Boven Digoel': { 'Tanah Merah':'99611' },
  },
  'Papua Tengah': {
    'Kab. Nabire': { 'Nabire':'98801','Uwapa':'98853','Wanggar':'98802' },
    'Kab. Paniai': { 'Enarotali':'98871','Bibida':'98872' },
    'Kab. Mimika': { 'Mimika Baru':'99910','Tembagapura':'99911','Kwamki Narama':'99912' },
    'Kab. Dogiyai': { 'Moanemani':'98891' },
    'Kab. Intan Jaya': { 'Sugapa':'98981' },
    'Kab. Deiyai': { 'Tigi':'98882' },
  },
  'Papua Pegunungan': {
    'Kab. Jayawijaya': { 'Wamena':'99501','Wouma':'99511','Kurima':'99561' },
    'Kab. Puncak Jaya': { 'Mulia':'99471','Tingginambut':'99472' },
    'Kab. Puncak': { 'Ilaga':'99451' },
    'Kab. Lanny Jaya': { 'Tiom':'99591' },
    'Kab. Nduga': { 'Kenyam':'99581' },
    'Kab. Mamberamo Tengah': { 'Kobakma':'99421' },
    'Kab. Yalimo': { 'Elelim':'99481' },
    'Kab. Tolikara': { 'Karubaga':'99471' },
    'Kab. Pegunungan Bintang': { 'Oksibil':'99371' },
  },
};

const WNA_CITY_DATA = {
  // Asia Tenggara
  'Malaysia': ['Kuala Lumpur','Petaling Jaya','Shah Alam','Johor Bahru','Penang','Ipoh','Kota Kinabalu','Kuching','Malacca','Kota Bharu','Kuala Terengganu','Alor Setar'],
  'Singapore': ['Singapore'],
  'Thailand': ['Bangkok','Chiang Mai','Phuket','Pattaya','Chiang Rai','Hat Yai','Nonthaburi','Nakhon Ratchasima','Udon Thani'],
  'Filipina': ['Manila','Cebu City','Davao','Quezon City','Makati','Zamboanga','Cagayan de Oro','Pasig','Taguig'],
  'Vietnam': ['Hanoi','Ho Chi Minh City','Da Nang','Nha Trang','Haiphong','Can Tho','Hue'],
  'Myanmar': ['Yangon','Naypyidaw','Mandalay','Bago','Mawlamyine'],
  'Kamboja': ['Phnom Penh','Siem Reap','Battambang','Sihanoukville'],
  'Laos': ['Vientiane','Luang Prabang','Savannakhet','Pakse'],
  'Brunei Darussalam': ['Bandar Seri Begawan','Kuala Belait','Seria'],
  'Timor Leste': ['Dili','Baucau','Maliana'],
  // Asia Timur
  'China': ['Beijing','Shanghai','Guangzhou','Shenzhen','Chengdu','Wuhan','Nanjing','Xi\'an','Hangzhou','Chongqing','Tianjin','Dongguan','Foshan','Shenyang'],
  'Jepang': ['Tokyo','Osaka','Nagoya','Yokohama','Kyoto','Fukuoka','Sapporo','Kobe','Hiroshima','Sendai'],
  'Korea Selatan': ['Seoul','Busan','Incheon','Daegu','Daejeon','Gwangju','Suwon','Ulsan'],
  'Taiwan': ['Taipei','Kaohsiung','Taichung','Tainan','New Taipei','Taoyuan'],
  'Hong Kong': ['Hong Kong','Kowloon','New Territories'],
  'Macau': ['Macau'],
  'Mongolia': ['Ulaanbaatar','Erdenet','Darkhan'],
  // Asia Selatan
  'India': ['New Delhi','Mumbai','Bangalore','Chennai','Kolkata','Hyderabad','Pune','Ahmedabad','Jaipur','Surat','Lucknow','Kanpur'],
  'Pakistan': ['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Peshawar','Quetta'],
  'Bangladesh': ['Dhaka','Chittagong','Sylhet','Rajshahi','Khulna'],
  'Sri Lanka': ['Colombo','Kandy','Galle','Jaffna','Negombo'],
  'Nepal': ['Kathmandu','Pokhara','Lalitpur','Biratnagar'],
  'Bhutan': ['Thimphu','Paro','Punakha'],
  'Maladewa': ['Male','Addu City'],
  // Asia Tengah & Barat
  'Arab Saudi': ['Riyadh','Jeddah','Makkah','Madinah','Dammam','Khobar','Tabuk'],
  'Uni Emirat Arab': ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah'],
  'Qatar': ['Doha','Al Wakrah','Al Khor'],
  'Kuwait': ['Kuwait City','Salmiyah','Hawalli'],
  'Bahrain': ['Manama','Riffa','Muharraq'],
  'Oman': ['Muscat','Salalah','Sohar','Nizwa'],
  'Yordania': ['Amman','Zarqa','Irbid','Aqaba'],
  'Lebanon': ['Beirut','Tripoli','Sidon'],
  'Turki': ['Istanbul','Ankara','Izmir','Bursa','Antalya','Adana','Gaziantep'],
  'Israel': ['Jerusalem','Tel Aviv','Haifa','Be\'er Sheva','Rishon LeZion'],
  'Iran': ['Tehran','Mashhad','Isfahan','Shiraz','Tabriz','Karaj'],
  'Irak': ['Baghdad','Basra','Mosul','Erbil','Najaf'],
  'Kazakhstan': ['Almaty','Nur-Sultan','Shymkent','Aktobe'],
  'Uzbekistan': ['Tashkent','Samarkand','Bukhara','Namangan'],
  'Azerbaijan': ['Baku','Ganja','Sumqayit'],
  'Georgia': ['Tbilisi','Kutaisi','Batumi'],
  'Armenia': ['Yerevan','Gyumri'],
  // Asia Pasifik
  'Australia': ['Sydney','Melbourne','Brisbane','Perth','Adelaide','Canberra','Darwin','Hobart','Gold Coast','Newcastle'],
  'Selandia Baru': ['Auckland','Wellington','Christchurch','Hamilton','Tauranga'],
  'Papua Nugini': ['Port Moresby','Lae','Madang','Wewak'],
  'Fiji': ['Suva','Lautoka','Nadi'],
  // Eropa Barat
  'Inggris': ['London','Manchester','Birmingham','Glasgow','Liverpool','Edinburgh','Leeds','Bristol','Sheffield','Nottingham'],
  'Jerman': ['Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf','Dortmund','Essen','Bremen'],
  'Prancis': ['Paris','Marseille','Lyon','Toulouse','Nice','Nantes','Strasbourg','Bordeaux','Lille','Rennes'],
  'Italia': ['Rome','Milan','Naples','Turin','Palermo','Genoa','Bologna','Florence','Venice','Bari'],
  'Spanyol': ['Madrid','Barcelona','Valencia','Seville','Zaragoza','Malaga','Murcia','Bilbao','Alicante','Córdoba'],
  'Belanda': ['Amsterdam','Rotterdam','The Hague','Utrecht','Eindhoven','Tilburg'],
  'Belgia': ['Brussels','Antwerp','Ghent','Liège','Bruges'],
  'Swiss': ['Zurich','Geneva','Basel','Bern','Lausanne'],
  'Austria': ['Vienna','Graz','Linz','Salzburg','Innsbruck'],
  'Swedia': ['Stockholm','Gothenburg','Malmö','Uppsala','Västerås'],
  'Norwegia': ['Oslo','Bergen','Stavanger','Trondheim'],
  'Denmark': ['Copenhagen','Aarhus','Odense','Aalborg'],
  'Finlandia': ['Helsinki','Espoo','Tampere','Turku','Oulu'],
  'Portugal': ['Lisbon','Porto','Braga','Faro'],
  'Yunani': ['Athens','Thessaloniki','Patras','Heraklion'],
  'Irlandia': ['Dublin','Cork','Galway','Limerick'],
  // Eropa Timur
  'Polandia': ['Warsaw','Kraków','Łódź','Wrocław','Poznań','Gdańsk'],
  'Rusia': ['Moscow','Saint Petersburg','Novosibirsk','Yekaterinburg','Kazan','Chelyabinsk','Omsk'],
  'Ceko': ['Prague','Brno','Ostrava','Plzeň'],
  'Hungaria': ['Budapest','Debrecen','Miskolc'],
  'Rumania': ['Bucharest','Cluj-Napoca','Iași','Timișoara'],
  'Ukraina': ['Kyiv','Kharkiv','Odessa','Lviv','Dnipro'],
  'Serbia': ['Belgrade','Novi Sad','Niš'],
  'Kroasia': ['Zagreb','Split','Rijeka'],
  'Slovakia': ['Bratislava','Košice'],
  'Slovenia': ['Ljubljana','Maribor'],
  'Bulgaria': ['Sofia','Plovdiv','Varna'],
  // Amerika Utara
  'Amerika Serikat': ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','Seattle','Boston','Denver','Miami','Las Vegas','Atlanta','Portland','Detroit','Nashville'],
  'Kanada': ['Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Quebec City','Hamilton','Saskatoon'],
  'Meksiko': ['Mexico City','Guadalajara','Monterrey','Puebla','Tijuana','León','Ciudad Juárez','Cancún','Mérida'],
  // Amerika Selatan
  'Brazil': ['São Paulo','Rio de Janeiro','Brasília','Salvador','Fortaleza','Belo Horizonte','Manaus','Curitiba','Recife'],
  'Argentina': ['Buenos Aires','Córdoba','Rosario','Mendoza','Mar del Plata'],
  'Colombia': ['Bogotá','Medellín','Cali','Barranquilla','Cartagena'],
  'Chile': ['Santiago','Valparaíso','Concepción','Antofagasta'],
  'Peru': ['Lima','Arequipa','Trujillo','Chiclayo','Cusco'],
  'Venezuela': ['Caracas','Maracaibo','Valencia','Barquisimeto'],
  'Ekuador': ['Quito','Guayaquil','Cuenca'],
  'Bolivia': ['Sucre','La Paz','Santa Cruz','Cochabamba'],
  'Uruguay': ['Montevideo','Salto'],
  'Paraguay': ['Asunción','Ciudad del Este'],
  // Afrika
  'Afrika Selatan': ['Johannesburg','Cape Town','Durban','Pretoria','Port Elizabeth','Bloemfontein'],
  'Nigeria': ['Lagos','Abuja','Kano','Ibadan','Port Harcourt','Benin City'],
  'Kenya': ['Nairobi','Mombasa','Nakuru','Kisumu'],
  'Ethiopia': ['Addis Ababa','Dire Dawa','Mekelle'],
  'Mesir': ['Cairo','Alexandria','Giza','Luxor','Aswan','Port Said'],
  'Maroko': ['Casablanca','Rabat','Fes','Marrakech','Tangier','Agadir'],
  'Ghana': ['Accra','Kumasi','Tamale'],
  'Tanzania': ['Dar es Salaam','Dodoma','Mwanza','Arusha'],
  'Uganda': ['Kampala','Gulu','Mbarara'],
  'Rwanda': ['Kigali','Butare'],
  'Senegal': ['Dakar','Saint-Louis'],
  'Pantai Gading': ['Abidjan','Yamoussoukro'],
  'Kamerun': ['Yaoundé','Douala'],
  'Tunisia': ['Tunis','Sfax','Sousse'],
  'Aljazair': ['Algiers','Oran','Constantine'],
  'Libya': ['Tripoli','Benghazi'],
  'Sudan': ['Khartoum','Omdurman','Port Sudan'],
  'Somalia': ['Mogadishu','Hargeisa'],
  'Mozambik': ['Maputo','Beira','Nampula'],
  'Zimbabwe': ['Harare','Bulawayo'],
  'Zambia': ['Lusaka','Kitwe','Ndola'],
  'Angola': ['Luanda','Huambo','Lobito'],
  'Madagaskar': ['Antananarivo','Toamasina'],
};

const VERIFIED_MEMBER_REQUIRED_PAGES = new Set([
  'workspace-console',
  'community-manager',
  'sponsor-manager',
  'tournament-manager',
  'training-manager',
  'venue-manager',
  'venue-registration',
  'venue-workspace',
  'official-center',
  'official-schedule',
  'match-center',
  'match-report',
  'match-statistics',
]);

const SPORT_OPTIONS = ['Sepakbola','Futsal','Badminton','Basket','Voli','Renang','Padel','Tennis','Tenis Meja','Bulu Tangkis','Rugby','Atletik','Panahan','Tinju','Pencak Silat','Karate','Taekwondo','Esports','Lainnya'];
const LEVEL_OPTIONS = ['Pemula','Amatir','Semi-Pro','Profesional'];

// Posisi per olahraga. null = olahraga individual tanpa posisi regu.
const SPORT_POSITIONS = {
  'Sepakbola':    ['Penjaga Gawang','Bek Kanan','Bek Kiri','Bek Tengah','Libero / Sweeper','Gelandang Bertahan','Gelandang Tengah','Gelandang Serang','Sayap Kanan','Sayap Kiri','Penyerang / Striker'],
  'Futsal':       ['Penjaga Gawang','Fixo / Anchor','Flank Kanan','Flank Kiri','Pivot'],
  'Basket':       ['Point Guard (PG)','Shooting Guard (SG)','Small Forward (SF)','Power Forward (PF)','Center (C)'],
  'Voli':         ['Setter','Libero','Outside Hitter','Opposite Hitter','Middle Blocker'],
  'Rugby':        ['Hooker','Prop','Lock','Flanker','Number 8','Scrum-half','Fly-half','Centre','Wing','Full-back'],
  'Badminton':    ['Tunggal Putra','Tunggal Putri','Ganda Putra','Ganda Putri','Ganda Campuran'],
  'Bulu Tangkis': ['Tunggal Putra','Tunggal Putri','Ganda Putra','Ganda Putri','Ganda Campuran'],
  'Atletik':      ['Sprint (100m\u2013400m)','Lari Menengah (800m\u20131500m)','Lari Jauh (5000m+)','Maraton','Lompat Jauh','Lompat Tinggi','Lompat Galah','Lempar Lembing','Tolak Peluru','Lempar Cakram','Lontar Martil','Jalan Cepat','Triathlon'],
  'Renang':       ['Gaya Bebas','Gaya Punggung','Gaya Dada','Gaya Kupu-kupu','Gaya Ganti Perorangan'],
  'Pencak Silat': ['Tanding','Seni Tunggal','Seni Ganda','Seni Beregu'],
  'Karate':       ['Kata','Kumite'],
  'Taekwondo':    ['Poomsae (Kata)','Kyorugi (Sparring)'],
  'Esports':      null,
  'Tinju':        null,
  'Tennis':       null,
  'Tenis Meja':   null,
  'Panahan':      null,
  'Padel':        null,
  'Lainnya':      null,
};

const ESPORTS_GAMES = {
  'Mobile Legends: Bang Bang': ['Gold Laner','EXP Laner','Mid Laner','Roamer','Jungler','Hyper Carry'],
  'PUBG Mobile':               ['Fragger','Entry Fragger','Sniper','Support','IGL (In-Game Leader)'],
  'Free Fire':                 ['Fragger','Sniper','Support','Rush','IGL'],
  'Valorant':                  ['Duelist','Controller','Initiator','Sentinel','IGL'],
  'League of Legends':         ['Top Laner','Jungler','Mid Laner','ADC / Bot','Support'],
  'Dota 2':                    ['Carry (Pos 1)','Midlaner (Pos 2)','Offlaner (Pos 3)','Soft Support (Pos 4)','Hard Support (Pos 5)'],
  'Honor of Kings':            ['Gold Laner','EXP Laner','Mid Laner','Roamer','Jungler'],
  'Clash Royale':              ['Arena Player','2v2 Player'],
  'Clash of Clans':            ['Leader','Co-Leader','Elder','Member'],
  'eFootball / FIFA':          ['Tidak ada posisi khusus'],
  'Game Lainnya':              [],
};
const POSITION_FOOTBALL = ['Penjaga Gawang','Bek Kanan','Bek Kiri','Bek Tengah','Gelandang Bertahan','Gelandang','Gelandang Serang','Sayap Kanan','Sayap Kiri','Penyerang'];
const DOMINANT_FOOT = ['Kanan','Kiri','Keduanya'];
const DOMINANT_HAND = ['Kanan','Kiri','Keduanya'];
const BLOOD_TYPES = ['A','B','AB','O','A+','A-','B+','B-','AB+','AB-','O+','O-'];
const INDONESIA_PROVINCES_SHORT = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Jambi','Sumatera Selatan','Bengkulu','Lampung','Kepulauan Bangka Belitung','Kepulauan Riau','DKI Jakarta','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Banten','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan','Sulawesi Tenggara','Gorontalo','Sulawesi Barat','Maluku','Maluku Utara','Papua Barat','Papua','Papua Selatan','Papua Tengah','Papua Pegunungan'];

const calcProfileCompletion = (auth, ep) => {
  if (!auth || !ep) return { pct: 0, earned: [], missing: [] };
  const checks = [
    { key: 'name', label: 'Nama lengkap', done: !!(ep.firstName?.trim() || auth.name?.trim()) },
    { key: 'phone', label: 'Nomor HP', done: !!(ep.phone?.trim()) },
    { key: 'gender', label: 'Jenis kelamin', done: !!(ep.gender) },
    { key: 'birthdate', label: 'Tanggal lahir', done: !!(ep.birthDate?.trim()) },
    { key: 'province', label: 'Provinsi', done: !!(ep.province?.trim()) },
    { key: 'city', label: 'Kota', done: !!(ep.city?.trim()) },
    { key: 'photo', label: 'Foto profil', done: !!(ep.photoUrl?.trim()) },
    { key: 'sport', label: 'Olahraga utama', done: !!(ep.mainSport?.trim()) },
    { key: 'level', label: 'Level bermain', done: !!(ep.playLevel?.trim()) },
    { key: 'bio', label: 'Bio singkat', done: !!(ep.bio?.trim()) },
  ];
  const done = checks.filter(c => c.done);
  return { pct: Math.round((done.length / checks.length) * 100), earned: done.map(c => c.key), missing: checks.filter(c => !c.done).map(c => c.label) };
};

const ProfilePage = ({ auth, stats, currentTier, nextTier, progressPercentage, pointsToNextTier, activities, loading, onBack, onNav, onAuthChange }) => {
  const memberVerification = auth?.memberVerification || null;
  const [showAllActions, setShowAllActions] = useState(false);
  const [editTab, setEditTab] = useState('basic');
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Extended profile state (4 levels)
  const rawMeta = auth?.rawMetadata || {};
  const [ep, setEp] = useState(() => ({
    // Level 1 – Basic
    firstName: rawMeta.first_name || (auth?.name?.split(' ')[0]) || '',
    lastName: rawMeta.last_name || (auth?.name?.split(' ').slice(1).join(' ')) || '',
    nickname: rawMeta.nickname || '',
    phone: rawMeta.phone || memberVerification?.phone || '',
    photoUrl: rawMeta.photo_url || '',
    gender: rawMeta.gender || '',
    // Birth place cascade
    birthCountry: rawMeta.birth_country || 'Indonesia',
    birthProvince: rawMeta.birth_province || '',
    birthPlace: rawMeta.birth_place || '',
    birthDate: rawMeta.birth_date || '',
    // Domisili cascade
    province: rawMeta.province || memberVerification?.province || '',
    city: rawMeta.city || memberVerification?.city || '',
    district: rawMeta.district || memberVerification?.district || '',
    postalCode: rawMeta.postal_code || memberVerification?.postalCode || '',
    address: rawMeta.address || '',
    rt: rawMeta.rt || '',
    rw: rawMeta.rw || '',
    // Level 2 – Sports
    mainSport: rawMeta.main_sport || '',
    mainPosition: rawMeta.main_position || '',
    secondPosition: rawMeta.second_position || '',
    height: rawMeta.height || '',
    weight: rawMeta.weight || '',
    dominantFoot: rawMeta.dominant_foot || '',
    dominantHand: rawMeta.dominant_hand || '',
    jerseyNumber: rawMeta.jersey_number || '',
    jerseyName: rawMeta.jersey_name || '',
    playLevel: rawMeta.play_level || '',
    esportsGame: rawMeta.esports_game || '',
    // Level 3 – Social
    instagram: rawMeta.instagram || '',
    tiktok: rawMeta.tiktok || '',
    youtube: rawMeta.youtube || '',
    bio: rawMeta.bio || '',
    favoriteClub: rawMeta.favorite_club || '',
    favoriteAthlete: rawMeta.favorite_athlete || '',
    // Level 4 – Safety
    emergencyContactName: rawMeta.emergency_contact_name || '',
    emergencyContactRel: rawMeta.emergency_contact_rel || '',
    emergencyContactPhone: rawMeta.emergency_contact_phone || '',
    bloodType: rawMeta.blood_type || '',
    injuryHistory: rawMeta.injury_history || '',
    allergies: rawMeta.allergies || '',
    // Password
    newPassword: '',
    confirmPassword: '',
  }));
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const completion = calcProfileCompletion(auth, ep);

  const updateEp = (key, value) => setEp(prev => {
    const next = { ...prev, [key]: value };
    // Reset cascade on parent change
    if (key === 'birthCountry') { next.birthProvince = ''; next.birthPlace = ''; }
    if (key === 'birthProvince') { next.birthPlace = ''; }
    if (key === 'province') { next.city = ''; next.district = ''; next.postalCode = ''; }
    if (key === 'city') { next.district = ''; next.postalCode = ''; }
    if (key === 'district') {
      const autoPostal = ((WNI_REGION_DATA[next.province] || {})[next.city] || {})[value] || '';
      if (autoPostal) next.postalCode = autoPostal;
    }
    if (key === 'mainSport') { next.mainPosition = ''; next.secondPosition = ''; next.esportsGame = ''; }
    if (key === 'esportsGame') { next.mainPosition = ''; next.secondPosition = ''; }
    return next;
  });

  const saveEditProfile = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    const firstName = ep.firstName.trim();
    const lastName = ep.lastName.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || auth?.name || '';
    if (!fullName) { setEditError('Nama depan tidak boleh kosong.'); return; }
    if (ep.newPassword && ep.newPassword.length < 8) { setEditError('Password baru minimal 8 karakter.'); return; }
    if (ep.newPassword && ep.newPassword !== ep.confirmPassword) { setEditError('Konfirmasi password tidak cocok.'); return; }
    setEditSaving(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentMeta = currentUserData?.user?.user_metadata || {};
      const updatePayload = {
        data: {
          ...currentMeta,
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          nickname: ep.nickname.trim(),
          phone: ep.phone.trim(),
          photo_url: ep.photoUrl.trim(),
          gender: ep.gender,
          birth_place: ep.birthPlace.trim(),
          birth_date: ep.birthDate,
          birth_country: ep.birthCountry,
          birth_province: ep.birthProvince,
          province: ep.province,
          city: ep.city,
          district: ep.district,
          postal_code: ep.postalCode,
          address: ep.address.trim(),
          rt: ep.rt.trim(),
          rw: ep.rw.trim(),
          main_sport: ep.mainSport,
          main_position: ep.mainPosition,
          second_position: ep.secondPosition,
          esports_game: ep.esportsGame,
          height: ep.height,
          weight: ep.weight,
          dominant_foot: ep.dominantFoot,
          dominant_hand: ep.dominantHand,
          jersey_number: ep.jerseyNumber,
          jersey_name: ep.jerseyName.trim(),
          play_level: ep.playLevel,
          instagram: ep.instagram.trim(),
          tiktok: ep.tiktok.trim(),
          youtube: ep.youtube.trim(),
          bio: ep.bio.trim(),
          favorite_club: ep.favoriteClub.trim(),
          favorite_athlete: ep.favoriteAthlete.trim(),
          emergency_contact_name: ep.emergencyContactName.trim(),
          emergency_contact_rel: ep.emergencyContactRel.trim(),
          emergency_contact_phone: ep.emergencyContactPhone.trim(),
          blood_type: ep.bloodType,
          injury_history: ep.injuryHistory.trim(),
          allergies: ep.allergies.trim(),
        },
      };
      if (ep.newPassword) updatePayload.password = ep.newPassword;
      const { data: updatedData, error: updateError } = await supabase.auth.updateUser(updatePayload);
      if (updateError) throw updateError;
      const refreshed = await enrichAuthUser(updatedData?.user);
      if (refreshed && typeof onAuthChange === 'function') onAuthChange(refreshed);
      // Award points for completion milestones
      const newCompletion = calcProfileCompletion(refreshed, ep);
      if (newCompletion.pct >= 100 && completion.pct < 100) {
        try { await supabase.rpc('add_user_points', { p_user_id: auth.id, p_points: 50, p_reason: 'complete_basic_profile' }); } catch (_) {}
      }
      if (ep.photoUrl.trim() && !rawMeta.photo_url) {
        try { await supabase.rpc('add_user_points', { p_user_id: auth.id, p_points: 20, p_reason: 'upload_profile_photo' }); } catch (_) {}
      }
      if (ep.mainSport && !rawMeta.main_sport) {
        try { await supabase.rpc('add_user_points', { p_user_id: auth.id, p_points: 30, p_reason: 'complete_sports_profile' }); } catch (_) {}
      }
      setEditSuccess('Profil berhasil diperbarui.');
      updateEp('newPassword', '');
      updateEp('confirmPassword', '');
    } catch (err) {
      setEditError(err?.message || 'Gagal menyimpan perubahan.');
    } finally {
      setEditSaving(false);
    }
  };

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const uploadProfilePhoto = async (file) => {
    if (!file || !auth?.id) return;
    if (!String(file.type).startsWith('image/')) { setEditError('File harus berupa gambar.'); return; }
    if (file.size > 3 * 1024 * 1024) { setEditError('Ukuran foto maksimal 3MB.'); return; }
    setUploadingPhoto(true);
    setEditError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${auth.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('member-verification-docs').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage.from('member-verification-docs').getPublicUrl(path);
      if (pub?.publicUrl) updateEp('photoUrl', pub.publicUrl);
    } catch (err) {
      setEditError('Upload foto gagal: ' + (err?.message || 'Error tidak diketahui'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [verificationForm, setVerificationForm] = useState(() => ({
    citizenshipStatus: memberVerification?.citizenshipStatus || 'WNI',
    phone: memberVerification?.phone || '',
    nik: memberVerification?.nik || '',
    passportNo: memberVerification?.passportNo || '',
    country: memberVerification?.country || 'Indonesia',
    province: memberVerification?.province || '',
    city: memberVerification?.city || '',
    district: memberVerification?.district || '',
    postalCode: memberVerification?.postalCode || '',
    address: memberVerification?.address || '',
    rt: memberVerification?.rt || '',
    rw: memberVerification?.rw || '',
    ktpPhotoUrl: memberVerification?.ktpPhotoUrl || '',
    postPhotoUrl: memberVerification?.postPhotoUrl || '',
  }));
  const [savingVerification, setSavingVerification] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState({ ktp: false, post: false });
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');

  useEffect(() => {
    setVerificationForm({
      citizenshipStatus: memberVerification?.citizenshipStatus || 'WNI',
      phone: memberVerification?.phone || '',
      nik: memberVerification?.nik || '',
      passportNo: memberVerification?.passportNo || '',
      country: memberVerification?.country || 'Indonesia',
      province: memberVerification?.province || '',
      city: memberVerification?.city || '',
      district: memberVerification?.district || '',
      postalCode: memberVerification?.postalCode || '',
      address: memberVerification?.address || '',
      rt: memberVerification?.rt || '',
      rw: memberVerification?.rw || '',
      ktpPhotoUrl: memberVerification?.ktpPhotoUrl || '',
      postPhotoUrl: memberVerification?.postPhotoUrl || '',
    });
  }, [memberVerification]);

  const isWni = verificationForm.citizenshipStatus === 'WNI';
  const provinceOptions = Object.keys(WNI_REGION_DATA);
  const cityOptions = isWni
    ? Object.keys(WNI_REGION_DATA[verificationForm.province] || {})
    : (WNA_CITY_DATA[verificationForm.country] || []);
  const districtOptions = isWni
    ? Object.keys((WNI_REGION_DATA[verificationForm.province] || {})[verificationForm.city] || {})
    : [];

  useEffect(() => {
    if (!isWni) return;
    const selectedPostalCode = ((WNI_REGION_DATA[verificationForm.province] || {})[verificationForm.city] || {})[verificationForm.district] || '';
    if (!selectedPostalCode) return;
    setVerificationForm((prev) => ({ ...prev, postalCode: selectedPostalCode }));
  }, [isWni, verificationForm.province, verificationForm.city, verificationForm.district]);

  const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

  const updateVerificationField = (key, value) => {
    setVerificationSuccess('');
    setVerificationError('');
    setVerificationForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'citizenshipStatus') {
        if (value === 'WNI') {
          next.passportNo = '';
          next.country = 'Indonesia';
        } else {
          next.nik = '';
          next.province = '';
          next.district = '';
        }
        next.city = '';
        next.postalCode = '';
      }
      if (isWni && key === 'province') {
        next.city = '';
        next.district = '';
        next.postalCode = '';
      }
      if (isWni && key === 'city') {
        next.district = '';
        next.postalCode = '';
      }
      if (!isWni && key === 'country') {
        next.city = '';
      }
      return next;
    });
  };

  const validateVerificationForm = () => {
    const normalizedPhone = normalizePhone(verificationForm.phone);
    if (!verificationForm.citizenshipStatus) return 'Status warga negara wajib dipilih.';
    if (!/^(\+62|08)\d{8,11}$/.test(normalizedPhone)) {
      return 'No HP harus format 08xx atau +62xx dengan 10-13 digit.';
    }

    if (isWni) {
      if (!/^\d{16}$/.test(verificationForm.nik || '')) {
        return 'NIK wajib tepat 16 digit angka.';
      }
      const provinceCode = Number(String(verificationForm.nik).slice(0, 2));
      if (!NIK_VALID_PROVINCE_CODES.has(provinceCode)) {
        return `NIK tidak valid. Kode wilayah "${provinceCode < 10 ? '0'+provinceCode : provinceCode}" tidak dikenal dalam sistem NIK Indonesia.`;
      }
      const nikDay = Number(String(verificationForm.nik).slice(6, 8));
      const nikMonth = Number(String(verificationForm.nik).slice(8, 10));
      const adjustedDay = nikDay > 40 ? nikDay - 40 : nikDay;
      if (adjustedDay < 1 || adjustedDay > 31 || nikMonth < 1 || nikMonth > 12) {
        return 'NIK tidak valid. Digit tanggal/bulan lahir (digit 7-12) tidak sesuai.';
      }
      if (!verificationForm.province) return 'Provinsi wajib dipilih untuk WNI.';
      if (!verificationForm.city) return 'Kabupaten/Kota wajib dipilih.';
      if (!verificationForm.district) return 'Kecamatan wajib dipilih untuk WNI.';
      if (!verificationForm.postalCode) return 'Kode pos wajib dipilih sesuai kecamatan.';
    } else {
      if (!/^[a-zA-Z0-9\-\/ ]{5,30}$/.test(verificationForm.passportNo || '')) {
        return 'No Passport wajib alfanumerik (5-30 karakter).';
      }
      if (!verificationForm.country) return 'Negara wajib dipilih untuk WNA.';
      if (!verificationForm.city) return 'Kabupaten/Kota wajib dipilih berdasarkan negara.';
      if (!/^\d{4,10}$/.test(verificationForm.postalCode || '')) {
        return 'Kode pos wajib diisi (4-10 digit).';
      }
    }

    if (!verificationForm.address.trim()) return 'Alamat jalan wajib diisi.';
    if (verificationForm.rt && !/^\d{1,3}$/.test(verificationForm.rt)) return 'RT maksimal 3 digit angka.';
    if (verificationForm.rw && !/^\d{1,3}$/.test(verificationForm.rw)) return 'RW maksimal 3 digit angka.';
    if (!verificationForm.ktpPhotoUrl.trim()) return 'Upload foto KTP wajib dilakukan.';
    if (!verificationForm.postPhotoUrl.trim()) return 'Upload foto post/selfie wajib dilakukan.';
    return '';
  };

  const uploadDocument = async (docType, file) => {
    if (!file || !auth?.id) return;
    setVerificationSuccess('');
    setVerificationError('');

    if (!String(file.type || '').startsWith('image/')) {
      setVerificationError('File dokumen harus berupa gambar (jpg/png/webp).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setVerificationError('Ukuran file maksimal 5MB.');
      return;
    }

    const docKey = docType === 'ktp' ? 'ktpPhotoUrl' : 'postPhotoUrl';
    setUploadingDoc((prev) => ({ ...prev, [docType]: true }));

    try {
      const safeName = String(file.name || 'dokumen.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `${auth.id}/${docType}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase
        .storage
        .from('member-verification-docs')
        .upload(objectPath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase
        .storage
        .from('member-verification-docs')
        .getPublicUrl(objectPath);

      const publicUrl = String(publicData?.publicUrl || '').trim();
      if (!publicUrl) {
        throw new Error('Dokumen berhasil diunggah tetapi URL publik tidak tersedia.');
      }

      setVerificationForm((prev) => ({ ...prev, [docKey]: publicUrl }));
      setVerificationSuccess(docType === 'ktp' ? 'Foto KTP berhasil diunggah.' : 'Foto post/selfie berhasil diunggah.');
    } catch (err) {
      console.error('Upload member verification document error:', err);
      setVerificationError('Upload dokumen gagal. Pastikan bucket storage member-verification-docs sudah dibuat publik di Supabase.');
    } finally {
      setUploadingDoc((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const saveMemberVerification = async (event) => {
    event.preventDefault();
    if (!auth?.id) {
      setVerificationError('Silakan login terlebih dahulu.');
      return;
    }

    const validationError = validateVerificationForm();
    if (validationError) {
      setVerificationError(validationError);
      return;
    }

    setSavingVerification(true);
    setVerificationError('');
    setVerificationSuccess('');

    try {
      const normalizedPayload = {
        citizenshipStatus: verificationForm.citizenshipStatus,
        phone: normalizePhone(verificationForm.phone),
        nik: isWni ? String(verificationForm.nik || '').trim() : '',
        passportNo: isWni ? '' : String(verificationForm.passportNo || '').trim(),
        country: isWni ? 'Indonesia' : String(verificationForm.country || '').trim(),
        province: isWni ? String(verificationForm.province || '').trim() : '',
        city: String(verificationForm.city || '').trim(),
        district: isWni ? String(verificationForm.district || '').trim() : '',
        postalCode: String(verificationForm.postalCode || '').trim(),
        address: String(verificationForm.address || '').trim(),
        rt: String(verificationForm.rt || '').trim(),
        rw: String(verificationForm.rw || '').trim(),
        ktpPhotoUrl: String(verificationForm.ktpPhotoUrl || '').trim(),
        postPhotoUrl: String(verificationForm.postPhotoUrl || '').trim(),
        verifiedMember: true,
        verifiedAt: new Date().toISOString(),
      };

      const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
      if (currentUserError) throw currentUserError;

      const currentMeta = currentUserData?.user?.user_metadata || {};
      const { data: updatedData, error: updateError } = await supabase.auth.updateUser({
        data: {
          ...currentMeta,
          member_verification: normalizedPayload,
          verified_member: true,
          verified_member_at: normalizedPayload.verifiedAt,
        },
      });

      if (updateError) throw updateError;

      const refreshedAuth = await enrichAuthUser(updatedData?.user || currentUserData?.user);
      if (refreshedAuth && typeof onAuthChange === 'function') {
        onAuthChange(refreshedAuth);
      }

      setVerificationSuccess('Profil member berhasil diperbarui. Status Anda sekarang Verified Member.');
    } catch (err) {
      console.error('saveMemberVerification error:', err);
      setVerificationError(err?.message || 'Gagal menyimpan verifikasi member.');
    } finally {
      setSavingVerification(false);
    }
  };

  const consoleItems = auth ? [
    auth?.access?.platform && { key: 'platform-console', title: 'Platform Console', sub: 'Newsroom, moderasi, analytics, verifikasi', icon: BarChart3 },
    auth?.access?.workspace && { key: 'workspace-console', title: 'Workspace Console', sub: 'Turnamen, komunitas, venue, sponsor, training', icon: Building2 },
    auth?.access?.official && { key: 'official-center', title: 'Official Center', sub: 'Jadwal tugas, match center, laporan, statistik', icon: ShieldCheck },
  ].filter(Boolean) : [];
  const operationalActions = auth ? [
    auth?.access?.platform && [
      { key: 'user-management', title: 'Kelola User', sub: 'Role, status blokir, dan akses', icon: ShieldCheck },
      { key: 'admin-verification-queue', title: 'Verifikasi', sub: 'Review akun dan approval', icon: Sparkles },
      { key: 'moderation', title: 'Moderasi', sub: 'Kontrol konten bermasalah', icon: Eye },
      { key: 'newsroom', title: 'Newsroom', sub: 'Kelola artikel dan konten', icon: Newspaper },
      { key: 'analytics', title: 'Analytics', sub: 'Ringkasan metrik platform', icon: TrendingUp },
    ],
    auth?.access?.workspace && [
      { key: 'tournament-manager', title: 'Kelola Turnamen', sub: 'Operasi turnamen dan liga', icon: Trophy },
      { key: 'community-manager', title: 'Kelola Komunitas', sub: 'Manajemen komunitas', icon: Users },
      { key: 'venue-workspace', title: 'Kelola Venue', sub: 'Venue, booking, dan staf', icon: MapPin },
      { key: 'training-manager', title: 'Kelola Pelatihan', sub: 'Coach, program, dan trial', icon: Dumbbell },
      { key: 'sponsor-manager', title: 'Kelola Sponsor', sub: 'Partnership dan sponsor', icon: Wallet },
    ],
    auth?.access?.official && [
      { key: 'official-schedule', title: 'Jadwal Official', sub: 'Penugasan dan jadwal pertandingan', icon: Calendar },
    ],
  ].flat().filter(Boolean) : [];
  const visibleOperationalActions = showAllActions ? operationalActions : operationalActions.slice(0, 6);

  return (
    <div className="bg-white min-h-screen">
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Kembali
      </button>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-8">
        <div className="grid lg:grid-cols-[1.35fr_0.95fr] gap-6">
          <div className="rounded-3xl border border-neutral-200 bg-[#F8FAFC] p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#E11D2E] text-white flex items-center justify-center font-display text-3xl shrink-0">
                {auth?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Profil Gamer</div>
                <div className="font-display text-3xl text-neutral-900">{auth?.name || 'Pengguna'}</div>
                <div className="text-sm text-neutral-500">{auth?.email || 'Belum login'}</div>
                <div className="mt-2">
                  {auth?.verifiedMember && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <ShieldCheck size={12} /> Verified Member
                    </span>
                  )}
                  {!auth?.verifiedMember && completion.pct < 100 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-600 border border-sky-200 cursor-pointer" onClick={() => { setShowEditProfile(true); setEditTab('basic'); setEditError(''); setEditSuccess(''); }}>
                      <Edit3 size={11} /> Lengkapi Profil ({completion.pct}%)
                    </span>
                  )}
                </div>
                {auth?.roleBadges?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {auth.roleBadges.map((badge) => (
                      <span key={badge} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              </div>
              <button
                onClick={() => { setShowEditProfile(true); setEditTab('basic'); setEditError(''); setEditSuccess(''); }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border border-neutral-300 text-neutral-700 hover:border-neutral-900 flex items-center gap-1.5"
              >
                <Edit3 size={12} /> Edit
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-white border border-neutral-200 p-5">
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Poin</div>
                <div className="text-4xl font-bold text-neutral-900">{stats?.points ?? 0}</div>
              </div>
              <div className="rounded-3xl bg-white border border-neutral-200 p-5">
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Koin</div>
                <div className="text-4xl font-bold text-neutral-900">{stats?.coins ?? 0}</div>
              </div>
            </div>
            {/* Profile Completion Bar */}
            <div className="mt-4 rounded-2xl bg-white border border-neutral-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-widest text-neutral-500">Kelengkapan Profil</div>
                <div className="text-sm font-bold text-neutral-900">{completion.pct}%</div>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${completion.pct}%`, background: completion.pct >= 100 ? '#10b981' : completion.pct >= 60 ? '#f59e0b' : '#E11D2E' }} />
              </div>
              {completion.pct < 100 ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-500">Belum lengkap: {completion.missing.slice(0, 3).join(', ')}{completion.missing.length > 3 ? ` +${completion.missing.length - 3} lagi` : ''}</p>
                  <button onClick={() => { setShowEditProfile(true); setEditTab('basic'); setEditError(''); setEditSuccess(''); }} className="text-xs font-bold text-[#E11D2E] hover:underline">Lengkapi →</button>
                </div>
              ) : (
                <p className="text-xs text-emerald-600 font-bold">Profil lengkap! Semua poin terbuka.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Tingkat</div>
                <div className="text-3xl font-display text-neutral-900">{stats?.tier_level || currentTier?.name}</div>
              </div>
              <div className="text-sm text-neutral-500">Level {stats?.tier_level || currentTier?.name}</div>
            </div>
            <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-[#E11D2E] to-[#F59E0B]" style={{ width: `${Math.min(progressPercentage, 100)}%` }} />
            </div>
            {nextTier ? (
              <div className="text-sm text-neutral-700">{pointsToNextTier} poin lagi untuk ke tier {nextTier.name}.</div>
            ) : (
              <div className="text-sm text-neutral-700">Kamu sudah mencapai tier tertinggi.</div>
            )}

            <div className="mt-6 border-t border-neutral-200 pt-4">
              <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Aksi Cepat</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onNav('chat')} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:border-neutral-900">Pesan</button>
                <button onClick={() => onNav('home')} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:border-neutral-900">Beranda</button>
              </div>
            </div>
          </div>
        </div>

        {auth && operationalActions.length > 0 && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Pusat Kontrol</div>
                <h2 className="font-display text-2xl text-neutral-900">Semua Fitur Internal Dalam Satu Halaman</h2>
              </div>
              <div className="text-sm text-neutral-500">Akses cepat untuk operasi super admin tanpa pindah menu berlapis.</div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleOperationalActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNav(item.key)}
                    className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 text-left hover:border-neutral-900 transition"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4">
                      <Icon size={18} />
                    </div>
                    <div className="font-display text-xl text-neutral-900 mb-2">{item.title}</div>
                    <p className="text-sm text-neutral-500 leading-relaxed">{item.sub}</p>
                  </button>
                );
              })}
            </div>
            {operationalActions.length > 6 && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => setShowAllActions((prev) => !prev)}
                  className="px-4 py-2 rounded-full text-xs font-bold border border-neutral-300 text-neutral-700 hover:border-neutral-900"
                >
                  {showAllActions ? 'Tampilkan Ringkas' : `Lihat Semua (${operationalActions.length})`}
                </button>
              </div>
            )}
          </div>
        )}

        {auth && consoleItems.length > 0 && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Mode Operasional</div>
                <h2 className="font-display text-2xl text-neutral-900">Pusat Kerja Internal</h2>
              </div>
              <div className="text-sm text-neutral-500">Pilih mode console utama sesuai konteks kerja Anda.</div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {consoleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNav(item.key)}
                    className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 text-left hover:border-neutral-900 transition"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-4">
                      <Icon size={18} />
                    </div>
                    <div className="font-display text-xl text-neutral-900 mb-2">{item.title}</div>
                    <p className="text-sm text-neutral-500 leading-relaxed">{item.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== VERIFIKASI MEMBER SECTION ===== */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">/ Akun</div>
              <h2 className="font-display text-2xl text-neutral-900">Verifikasi Member</h2>
              <p className="text-sm text-neutral-500 mt-1">Lengkapi data diri untuk mendapatkan status Verified Member dan akses fitur penuh.</p>
            </div>
            {auth?.verifiedMember && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={14} /> Verified Member
              </span>
            )}
          </div>

          {/* Verified badges info */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${auth?.verifiedMember ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="font-bold text-sm text-neutral-900">Verified Member</div>
                  <div className={`text-xs font-bold ${auth?.verifiedMember ? 'text-emerald-600' : 'text-amber-600'}`}>{auth?.verifiedMember ? '✓ Aktif' : 'Belum Terverifikasi'}</div>
                </div>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">Pengguna yang telah melengkapi NIK/Paspor dan data alamat resmi. Syarat untuk membuat komunitas dan mengelola turnamen.</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Trophy size={18} />
                </div>
                <div>
                  <div className="font-bold text-sm text-neutral-900">Verified Tournament</div>
                  <div className="text-xs font-bold text-neutral-500">Untuk penyelenggara</div>
                </div>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">Turnamen yang diselenggarakan oleh organisasi / EO terverifikasi. Badge diberikan otomatis saat turnamen dibuat oleh penyelenggara verified.</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <div className="font-bold text-sm text-neutral-900">Verified Community</div>
                  <div className="text-xs font-bold text-neutral-500">Untuk komunitas</div>
                </div>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">Komunitas yang datanya lengkap dan dibuat oleh Verified Member. Mendapatkan prioritas tampil di direktori komunitas.</p>
            </div>
          </div>

          {/* Form verifikasi */}
          <form onSubmit={saveMemberVerification} className="space-y-6">
            <div className="border-t border-neutral-100 pt-6">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">Status Kewarganegaraan</div>
              <div className="flex flex-wrap gap-3">
                {['WNI','WNA'].map(s => (
                  <button key={s} type="button"
                    onClick={() => updateVerificationField('citizenshipStatus', s)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold border-2 transition ${verificationForm.citizenshipStatus === s ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'}`}
                  >{s === 'WNI' ? '🇮🇩 WNI — Warga Negara Indonesia' : '🌍 WNA — Warga Negara Asing'}</button>
                ))}
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Nomor HP Aktif <span className="text-red-500">*</span></label>
              <input type="tel" value={verificationForm.phone}
                onChange={e => updateVerificationField('phone', e.target.value)}
                className="w-full max-w-sm px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                placeholder="08xx atau +62xx" maxLength={16}
              />
              <p className="text-xs text-neutral-400 mt-1">Format: 0811234567 atau +628112345678 (10–13 digit)</p>
            </div>

            {isWni ? (
              <>
                {/* NIK */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Nomor Induk Kependudukan (NIK) <span className="text-red-500">*</span></label>
                  <div className="relative max-w-sm">
                    <input type="text" inputMode="numeric" value={verificationForm.nik}
                      onChange={e => updateVerificationField('nik', e.target.value.replace(/\D/g, '').slice(0, 16))}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm tracking-widest font-mono"
                      placeholder="16 digit NIK sesuai KTP" maxLength={16}
                    />
                    <span className={`absolute right-3 top-3 text-xs font-bold ${verificationForm.nik.length === 16 ? 'text-emerald-600' : 'text-neutral-400'}`}>{verificationForm.nik.length}/16</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">2 digit pertama = kode provinsi · digit 7–12 = tanggal lahir (perempuan +40 pada hari)</p>
                </div>

                {/* Wilayah WNI cascade */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Provinsi <span className="text-red-500">*</span></label>
                    <select value={verificationForm.province}
                      onChange={e => updateVerificationField('province', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white"
                    >
                      <option value="">— Pilih Provinsi —</option>
                      {provinceOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Kabupaten/Kota <span className="text-red-500">*</span></label>
                    <select value={verificationForm.city}
                      onChange={e => updateVerificationField('city', e.target.value)}
                      disabled={!verificationForm.province}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="">— Pilih Kab/Kota —</option>
                      {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Kecamatan <span className="text-red-500">*</span></label>
                    <select value={verificationForm.district}
                      onChange={e => updateVerificationField('district', e.target.value)}
                      disabled={!verificationForm.city}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="">— Pilih Kecamatan —</option>
                      {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Kode pos auto-fill */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Kode Pos <span className="text-red-500">*</span></label>
                  <input type="text" value={verificationForm.postalCode} readOnly
                    className="w-full max-w-xs px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 cursor-not-allowed"
                    placeholder="Terisi otomatis dari kecamatan"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Terisi otomatis saat kecamatan dipilih</p>
                </div>
              </>
            ) : (
              <>
                {/* Paspor & negara WNA */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Nomor Paspor <span className="text-red-500">*</span></label>
                    <input type="text" value={verificationForm.passportNo}
                      onChange={e => updateVerificationField('passportNo', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                      placeholder="Contoh: A1234567" maxLength={30}
                    />
                    <p className="text-xs text-neutral-400 mt-1">5–30 karakter alfanumerik</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Negara Asal <span className="text-red-500">*</span></label>
                    <select value={verificationForm.country}
                      onChange={e => updateVerificationField('country', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white"
                    >
                      <option value="">— Pilih Negara —</option>
                      {Object.keys(WNA_CITY_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Kota <span className="text-red-500">*</span></label>
                    <select value={verificationForm.city}
                      onChange={e => updateVerificationField('city', e.target.value)}
                      disabled={!verificationForm.country}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="">— Pilih Kota —</option>
                      {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Kode Pos <span className="text-red-500">*</span></label>
                    <input type="text" inputMode="numeric" value={verificationForm.postalCode}
                      onChange={e => updateVerificationField('postalCode', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                      placeholder="4–10 digit" maxLength={10}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Alamat jalan */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Alamat Jalan <span className="text-red-500">*</span></label>
              <textarea value={verificationForm.address}
                onChange={e => updateVerificationField('address', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm resize-none"
                placeholder="Nama jalan, nomor rumah, nama gedung / komplek, dll."
                maxLength={300}
              />
            </div>

            {/* RT / RW opsional */}
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">RT / RW <span className="font-normal normal-case text-neutral-400">(opsional)</span></div>
              <div className="flex gap-4 max-w-xs">
                <div className="flex-1">
                  <label className="block text-xs text-neutral-500 mb-1">RT</label>
                  <input type="text" inputMode="numeric" value={verificationForm.rt}
                    onChange={e => updateVerificationField('rt', e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm text-center"
                    placeholder="001" maxLength={3}
                  />
                </div>
                <div className="pt-5 text-neutral-400 font-bold">/</div>
                <div className="flex-1">
                  <label className="block text-xs text-neutral-500 mb-1">RW</label>
                  <input type="text" inputMode="numeric" value={verificationForm.rw}
                    onChange={e => updateVerificationField('rw', e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm text-center"
                    placeholder="001" maxLength={3}
                  />
                </div>
              </div>
            </div>

            {/* Upload dokumen */}
            <div className="border-t border-neutral-100 pt-6">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">Dokumen Pendukung</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-neutral-200 p-5">
                  <div className="text-sm font-bold text-neutral-900 mb-1">Foto {isWni ? 'KTP' : 'Halaman Foto Paspor'} <span className="text-red-500">*</span></div>
                  <p className="text-xs text-neutral-500 mb-3">JPG / PNG / WebP · maks. 5 MB</p>
                  {verificationForm.ktpPhotoUrl ? (
                    <div className="space-y-2">
                      <img src={verificationForm.ktpPhotoUrl} alt="Dokumen ID" className="w-full h-28 object-cover rounded-xl border border-neutral-200" />
                      <button type="button" onClick={() => updateVerificationField('ktpPhotoUrl', '')} className="text-xs text-red-500 hover:underline">Hapus &amp; upload ulang</button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-300 rounded-xl h-28 cursor-pointer hover:border-neutral-900 transition ${uploadingDoc.ktp ? 'opacity-60 cursor-wait' : ''}`}>
                      <Upload size={20} className="text-neutral-400" />
                      <span className="text-xs text-neutral-500">{uploadingDoc.ktp ? 'Mengupload...' : 'Klik untuk pilih file'}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingDoc.ktp}
                        onChange={e => e.target.files?.[0] && uploadDocument('ktp', e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
                <div className="rounded-2xl border border-neutral-200 p-5">
                  <div className="text-sm font-bold text-neutral-900 mb-1">Selfie Pegang Dokumen ID <span className="text-red-500">*</span></div>
                  <p className="text-xs text-neutral-500 mb-3">Selfie sambil memegang KTP/Paspor · JPG/PNG/WebP · maks. 5 MB</p>
                  {verificationForm.postPhotoUrl ? (
                    <div className="space-y-2">
                      <img src={verificationForm.postPhotoUrl} alt="Selfie" className="w-full h-28 object-cover rounded-xl border border-neutral-200" />
                      <button type="button" onClick={() => updateVerificationField('postPhotoUrl', '')} className="text-xs text-red-500 hover:underline">Hapus &amp; upload ulang</button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-300 rounded-xl h-28 cursor-pointer hover:border-neutral-900 transition ${uploadingDoc.post ? 'opacity-60 cursor-wait' : ''}`}>
                      <Upload size={20} className="text-neutral-400" />
                      <span className="text-xs text-neutral-500">{uploadingDoc.post ? 'Mengupload...' : 'Klik untuk pilih file'}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingDoc.post}
                        onChange={e => e.target.files?.[0] && uploadDocument('post', e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {verificationError && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">{verificationError}</div>}
            {verificationSuccess && <div className="text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200">{verificationSuccess}</div>}

            <div className="flex justify-end">
              <button type="submit" disabled={savingVerification}
                className="px-8 py-3 rounded-full text-sm font-bold text-white disabled:opacity-60 flex items-center gap-2"
                style={{ background: '#E11D2E' }}
              >
                <ShieldCheck size={16} />
                {savingVerification ? 'Menyimpan...' : auth?.verifiedMember ? 'Perbarui Data Verifikasi' : 'Ajukan Verifikasi Member'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Riwayat Aktivitas</div>
              <h2 className="font-display text-2xl text-neutral-900">Aktivitas Terbaru</h2>
            </div>
            <span className="text-sm text-neutral-500">{activities?.length ?? 0} entri</span>
          </div>
          {loading ? (
            <div className="text-sm text-neutral-500">Memuat aktivitas...</div>
          ) : activities?.length ? (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <ActivityCard key={index} activity={activity} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">Belum ada aktivitas gamifikasi.</div>
          )}
        </div>
      </div>

      {/* ===== EDIT PROFILE MODAL ===== */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-neutral-100">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Akun</div>
                <h2 className="font-display text-2xl text-neutral-900">Edit Profil</h2>
              </div>
              <button onClick={() => setShowEditProfile(false)} className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:border-neutral-900 transition">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-8 pt-5 overflow-x-auto">
              {[
                { key: 'basic', label: 'Dasar' },
                { key: 'sports', label: 'Olahraga' },
                { key: 'social', label: 'Sosial' },
                { key: 'safety', label: 'Keselamatan' },
                { key: 'account', label: 'Akun' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setEditTab(tab.key)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${editTab === tab.key ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600 hover:border-neutral-900'}`}
                >{tab.label}</button>
              ))}
            </div>

            {/* Profile Completion inside modal */}
            <div className="px-8 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${completion.pct}%`, background: completion.pct >= 100 ? '#10b981' : '#E11D2E' }} />
                </div>
                <span className="text-xs font-bold text-neutral-500">{completion.pct}% lengkap</span>
              </div>
            </div>

            <form onSubmit={saveEditProfile} className="px-8 pt-6 pb-8 space-y-5">

              {/* === TAB: BASIC === */}
              {editTab === 'basic' && (
                <div className="space-y-5">
                  {/* Photo */}
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full shrink-0 overflow-hidden border-2 border-neutral-200 bg-neutral-100 flex items-center justify-center">
                      {ep.photoUrl ? (
                        <img src={ep.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-2xl text-neutral-400">{auth?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                      )}
                    </div>
                    <div>
                      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border border-neutral-300 cursor-pointer hover:border-neutral-900 transition ${uploadingPhoto ? 'opacity-60 cursor-wait' : ''}`}>
                        <Upload size={12} /> {uploadingPhoto ? 'Mengupload...' : 'Upload Foto'}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                          onChange={e => e.target.files?.[0] && uploadProfilePhoto(e.target.files[0])} />
                      </label>
                      <p className="text-xs text-neutral-400 mt-1">JPG/PNG/WebP · maks. 3MB</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nama Depan <span className="text-red-500">*</span></label>
                      <input type="text" value={ep.firstName} onChange={e => updateEp('firstName', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="Nama depan" maxLength={50} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nama Belakang</label>
                      <input type="text" value={ep.lastName} onChange={e => updateEp('lastName', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="Nama belakang" maxLength={50} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nama Panggilan</label>
                    <input type="text" value={ep.nickname} onChange={e => updateEp('nickname', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="Nama yang biasa disapa" maxLength={30} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nomor HP <span className="text-red-500">*</span></label>
                    <input type="tel" value={ep.phone} onChange={e => updateEp('phone', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="08xx atau +62xx" maxLength={16} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Jenis Kelamin <span className="text-red-500">*</span></label>
                    <div className="flex gap-3">
                      {['Laki-laki','Perempuan'].map(g => (
                        <button key={g} type="button" onClick={() => updateEp('gender', g)}
                          className={`px-5 py-2.5 rounded-full text-sm font-bold border-2 transition ${ep.gender === g ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tempat & Tanggal Lahir */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Tempat & Tanggal Lahir</div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Negara Kelahiran <span className="text-red-500">*</span></label>
                        <select value={ep.birthCountry} onChange={e => updateEp('birthCountry', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                          <option value="Indonesia">🇮🇩 Indonesia</option>
                          {Object.keys(WNA_CITY_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {ep.birthCountry === 'Indonesia' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Provinsi Kelahiran</label>
                            <select value={ep.birthProvince} onChange={e => updateEp('birthProvince', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                              <option value="">— Pilih Provinsi —</option>
                              {Object.keys(WNI_REGION_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Kota/Kab. Kelahiran <span className="text-red-500">*</span></label>
                            <select value={ep.birthPlace} onChange={e => updateEp('birthPlace', e.target.value)}
                              disabled={!ep.birthProvince}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400">
                              <option value="">— Pilih Kota —</option>
                              {Object.keys(WNI_REGION_DATA[ep.birthProvince] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Kota Kelahiran <span className="text-red-500">*</span></label>
                          <select value={ep.birthPlace} onChange={e => updateEp('birthPlace', e.target.value)}
                            disabled={!ep.birthCountry}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400">
                            <option value="">— Pilih Kota —</option>
                            {(WNA_CITY_DATA[ep.birthCountry] || []).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Tanggal Lahir <span className="text-red-500">*</span></label>
                        <input type="date" value={ep.birthDate} onChange={e => updateEp('birthDate', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white" max={new Date().toISOString().split('T')[0]} />
                      </div>
                    </div>
                  </div>

                  {/* Domisili Tinggal */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Domisili Tinggal</div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Provinsi <span className="text-red-500">*</span></label>
                          <select value={ep.province} onChange={e => updateEp('province', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                            <option value="">— Pilih Provinsi —</option>
                            {Object.keys(WNI_REGION_DATA).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Kabupaten/Kota <span className="text-red-500">*</span></label>
                          <select value={ep.city} onChange={e => updateEp('city', e.target.value)}
                            disabled={!ep.province}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400">
                            <option value="">— Pilih Kab/Kota —</option>
                            {Object.keys(WNI_REGION_DATA[ep.province] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Kecamatan</label>
                          <select value={ep.district} onChange={e => updateEp('district', e.target.value)}
                            disabled={!ep.city}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400">
                            <option value="">— Pilih Kecamatan —</option>
                            {Object.keys((WNI_REGION_DATA[ep.province] || {})[ep.city] || {}).map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Kode Pos</label>
                          <input type="text" value={ep.postalCode} readOnly
                            className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-700 cursor-not-allowed"
                            placeholder="Terisi otomatis" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Alamat Rumah</label>
                        <textarea value={ep.address} onChange={e => updateEp('address', e.target.value)} rows={2}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm resize-none"
                          placeholder="Nama jalan, nomor rumah, komplek, dll." maxLength={300} />
                      </div>
                      <div className="flex gap-4 max-w-xs">
                        <div className="flex-1">
                          <label className="block text-xs text-neutral-500 mb-1">RT</label>
                          <input type="text" inputMode="numeric" value={ep.rt} onChange={e => updateEp('rt', e.target.value.replace(/\D/g, '').slice(0, 3))}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm text-center" placeholder="001" maxLength={3} />
                        </div>
                        <div className="pt-5 text-neutral-400 font-bold">/</div>
                        <div className="flex-1">
                          <label className="block text-xs text-neutral-500 mb-1">RW</label>
                          <input type="text" inputMode="numeric" value={ep.rw} onChange={e => updateEp('rw', e.target.value.replace(/\D/g, '').slice(0, 3))}
                            className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm text-center" placeholder="001" maxLength={3} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB: SPORTS === */}
              {editTab === 'sports' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Olahraga Utama <span className="text-red-500">*</span></label>
                    <select value={ep.mainSport} onChange={e => updateEp('mainSport', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                      <option value="">— Pilih Olahraga —</option>
                      {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Posisi Utama</label>
                      <input type="text" value={ep.mainPosition} onChange={e => updateEp('mainPosition', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. Penyerang" maxLength={40} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Posisi Kedua</label>
                      <input type="text" value={ep.secondPosition} onChange={e => updateEp('secondPosition', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. Gelandang" maxLength={40} />
                    </div>
                  </div>
                  {/* Dynamic position section */}
                  {ep.mainSport === 'Esports' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Game / Judul</label>
                        <select value={ep.esportsGame} onChange={e => updateEp('esportsGame', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                          <option value="">— Pilih Game —</option>
                          {Object.keys(ESPORTS_GAMES).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      {ep.esportsGame && (ESPORTS_GAMES[ep.esportsGame] || []).length > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Role Utama</label>
                            <select value={ep.mainPosition} onChange={e => updateEp('mainPosition', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                              <option value="">— Pilih Role —</option>
                              {(ESPORTS_GAMES[ep.esportsGame] || []).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Role Sekunder</label>
                            <select value={ep.secondPosition} onChange={e => updateEp('secondPosition', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                              <option value="">— Pilih Role —</option>
                              {(ESPORTS_GAMES[ep.esportsGame] || []).filter(r => r !== ep.mainPosition).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : SPORT_POSITIONS[ep.mainSport] !== undefined && SPORT_POSITIONS[ep.mainSport] !== null ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Posisi Utama</label>
                        <select value={ep.mainPosition} onChange={e => updateEp('mainPosition', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                          <option value="">— Pilih Posisi —</option>
                          {(SPORT_POSITIONS[ep.mainSport] || []).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Posisi Kedua</label>
                        <select value={ep.secondPosition} onChange={e => updateEp('secondPosition', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                          <option value="">— Pilih Posisi —</option>
                          {(SPORT_POSITIONS[ep.mainSport] || []).filter(p => p !== ep.mainPosition).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : ep.mainSport ? (
                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 text-sm text-neutral-500">
                      {ep.mainSport} adalah olahraga individual — tidak ada pilihan posisi regu.
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Tinggi Badan (cm)</label>
                      <input type="number" value={ep.height} onChange={e => updateEp('height', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. 175" min={100} max={250} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Berat Badan (kg)</label>
                      <input type="number" value={ep.weight} onChange={e => updateEp('weight', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. 65" min={30} max={200} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Kaki Dominan</label>
                      <select value={ep.dominantFoot} onChange={e => updateEp('dominantFoot', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                        <option value="">— Pilih —</option>
                        {DOMINANT_FOOT.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Tangan Dominan</label>
                      <select value={ep.dominantHand} onChange={e => updateEp('dominantHand', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm bg-white">
                        <option value="">— Pilih —</option>
                        {DOMINANT_HAND.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nomor Punggung Favorit</label>
                      <input type="number" value={ep.jerseyNumber} onChange={e => updateEp('jerseyNumber', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="1-99" min={1} max={99} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Jersey Name</label>
                      <input type="text" value={ep.jerseyName} onChange={e => updateEp('jerseyName', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="Nama di jersey" maxLength={20} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Level Bermain</label>
                    <div className="flex flex-wrap gap-2">
                      {LEVEL_OPTIONS.map(l => (
                        <button key={l} type="button" onClick={() => updateEp('playLevel', l)}
                          className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition ${ep.playLevel === l ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB: SOCIAL === */}
              {editTab === 'social' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Bio Singkat</label>
                    <textarea value={ep.bio} onChange={e => updateEp('bio', e.target.value)} rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm resize-none"
                      placeholder="Ceritakan sedikit tentang dirimu sebagai atlet..." maxLength={200} />
                    <p className="text-xs text-neutral-400 mt-1">{ep.bio.length}/200 karakter</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Instagram</label>
                    <div className="flex items-center border border-neutral-300 rounded-xl overflow-hidden focus-within:border-neutral-900">
                      <span className="px-3 text-sm text-neutral-400 border-r border-neutral-300 py-3 bg-neutral-50">@</span>
                      <input type="text" value={ep.instagram} onChange={e => updateEp('instagram', e.target.value)}
                        className="flex-1 px-3 py-3 outline-none text-sm" placeholder="username_instagram" maxLength={60} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">TikTok</label>
                    <div className="flex items-center border border-neutral-300 rounded-xl overflow-hidden focus-within:border-neutral-900">
                      <span className="px-3 text-sm text-neutral-400 border-r border-neutral-300 py-3 bg-neutral-50">@</span>
                      <input type="text" value={ep.tiktok} onChange={e => updateEp('tiktok', e.target.value)}
                        className="flex-1 px-3 py-3 outline-none text-sm" placeholder="username_tiktok" maxLength={60} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">YouTube Channel</label>
                    <input type="url" value={ep.youtube} onChange={e => updateEp('youtube', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="https://youtube.com/@channel" maxLength={120} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Klub Favorit</label>
                      <input type="text" value={ep.favoriteClub} onChange={e => updateEp('favoriteClub', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. Persija" maxLength={60} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Atlet Favorit</label>
                      <input type="text" value={ep.favoriteAthlete} onChange={e => updateEp('favoriteAthlete', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. Cristiano Ronaldo" maxLength={60} />
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB: SAFETY === */}
              {editTab === 'safety' && (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs text-amber-700">Data ini bersifat pribadi dan hanya digunakan untuk keperluan kedaruratan serta verifikasi turnamen resmi.</p>
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 pb-1 border-b border-neutral-100">Kontak Darurat</div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nama Kontak</label>
                    <input type="text" value={ep.emergencyContactName} onChange={e => updateEp('emergencyContactName', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="Nama orang yang dihubungi" maxLength={80} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Hubungan</label>
                      <input type="text" value={ep.emergencyContactRel} onChange={e => updateEp('emergencyContactRel', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="cth. Orang Tua" maxLength={40} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Nomor HP</label>
                      <input type="tel" value={ep.emergencyContactPhone} onChange={e => updateEp('emergencyContactPhone', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm" placeholder="08xx" maxLength={16} />
                    </div>
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 pb-1 border-b border-neutral-100 mt-2">Informasi Medis</div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Golongan Darah</label>
                    <div className="flex flex-wrap gap-2">
                      {BLOOD_TYPES.map(b => (
                        <button key={b} type="button" onClick={() => updateEp('bloodType', b)}
                          className={`px-3.5 py-2 rounded-full text-xs font-bold border-2 transition ${ep.bloodType === b ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Riwayat Cedera</label>
                    <textarea value={ep.injuryHistory} onChange={e => updateEp('injuryHistory', e.target.value)} rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm resize-none"
                      placeholder="cth. Pernah cedera lutut kiri (2022)" maxLength={300} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Alergi</label>
                    <textarea value={ep.allergies} onChange={e => updateEp('allergies', e.target.value)} rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm resize-none"
                      placeholder="cth. Alergi obat penisilin" maxLength={200} />
                  </div>
                </div>
              )}

              {/* === TAB: ACCOUNT === */}
              {editTab === 'account' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Email</label>
                    <input type="email" value={auth?.email || ''} readOnly
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-500 cursor-not-allowed" />
                    <p className="text-xs text-neutral-400 mt-1">Email tidak dapat diubah langsung di sini.</p>
                  </div>
                  <div className="border-t border-neutral-100 pt-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Ganti Password</div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Password Baru</label>
                        <input type="password" value={ep.newPassword} onChange={e => updateEp('newPassword', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                          placeholder="Min. 8 karakter" autoComplete="new-password" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1.5">Konfirmasi Password Baru</label>
                        <input type="password" value={ep.confirmPassword} onChange={e => updateEp('confirmPassword', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                          placeholder="Ulangi password baru" autoComplete="new-password" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors & Success */}
              {editError && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">{editError}</div>}
              {editSuccess && <div className="text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200">{editSuccess}</div>}

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <button type="button" onClick={() => setShowEditProfile(false)}
                  className="px-5 py-2.5 rounded-full text-sm font-bold border border-neutral-300 text-neutral-700 hover:border-neutral-900 transition">
                  Batal
                </button>
                <button type="submit" disabled={editSaving}
                  className="px-8 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-60 flex items-center gap-2 transition"
                  style={{ background: '#E11D2E' }}>
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ PAYMENT ============
const buildInvoiceNumber = (activity, index = 0) => {
  const date = new Date(activity?.activity_date || activity?.created_at || Date.now());
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const fallbackSeed = String(activity?.id || `${date.getTime()}-${index}`)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `EINV-${datePart}-${fallbackSeed || String(index + 1).padStart(3, '0')}`;
};

const CartPage = ({
  auth,
  cartItems,
  transactionHistory,
  invoiceEntries,
  sendingInvoice,
  invoiceNotice,
  onCheckoutItem,
  onRemoveItem,
  onSendSingleInvoice,
  onSendAllInvoices,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState('cart');

  const totalCartAmount = useMemo(() => {
    return (cartItems || []).reduce((sum, item) => sum + Number(item?.payload?.amount || 0), 0);
  }, [cartItems]);

  return (
    <div className="bg-[#F4F4F4] min-h-[70vh] py-8 lg:py-12 px-5 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold mb-5 text-neutral-700 hover:text-neutral-900">
          <ArrowLeft size={16} /> Kembali
        </button>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Akun Belanja</div>
              <h1 className="font-display text-3xl text-neutral-900">Keranjang & Riwayat Transaksi</h1>
              <p className="mt-2 text-sm text-neutral-500">Kelola checkout aktif Anda dan pantau transaksi yang sudah tercatat.</p>
            </div>
            {auth && (
              <div className="text-right">
                <div className="text-xs text-neutral-500">User</div>
                <div className="text-sm font-bold text-neutral-900">{auth.name}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-6 p-1 rounded-2xl border border-neutral-200 bg-neutral-50 w-fit">
            <button
              onClick={() => setActiveTab('cart')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'cart' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              Keranjang ({cartItems.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'history' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
            >
              Riwayat & E-Invoice ({transactionHistory.length})
            </button>
          </div>

          {activeTab === 'cart' ? (
            <div>
              {cartItems.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-1">{item.payload?.type === 'booking' ? 'Booking Lapangan' : 'Pelatihan'}</div>
                            <div className="font-bold text-neutral-900 text-lg leading-tight">{item.payload?.itemName || 'Checkout'}</div>
                            <div className="text-sm text-neutral-500 mt-1">{item.payload?.itemSub || '-'}</div>
                            <div className="text-xs text-neutral-400 mt-2">Ditambahkan {new Date(item.createdAt).toLocaleString('id-ID')}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-neutral-500">Estimasi bayar</div>
                            <div className="font-bold text-lg text-neutral-900">{formatRupiah(Number(item.payload?.amount || 0))}</div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => onCheckoutItem(item)}
                            className="px-4 py-2 rounded-full text-sm font-bold text-white"
                            style={{ background: '#E11D2E' }}
                          >
                            Checkout Sekarang
                          </button>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="px-4 py-2 rounded-full text-sm font-bold border border-neutral-300 text-neutral-700 hover:border-neutral-500"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-neutral-500">Total Keranjang</div>
                      <div className="text-sm text-neutral-500">Belum termasuk biaya layanan di halaman pembayaran.</div>
                    </div>
                    <div className="font-display text-2xl text-neutral-900">{formatRupiah(totalCartAmount)}</div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                  <ShoppingCart size={24} className="mx-auto mb-3 text-neutral-400" />
                  <div className="font-bold text-neutral-800 mb-1">Keranjang masih kosong</div>
                  <div className="text-sm text-neutral-500">Mulai booking lapangan atau program pelatihan, lalu item checkout akan muncul di sini.</div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-neutral-500">E-Invoice</div>
                  <div className="text-sm text-neutral-600">Total {invoiceEntries.length} invoice siap kirim ke email {auth?.email || 'user'}.</div>
                </div>
                <button
                  onClick={onSendAllInvoices}
                  disabled={sendingInvoice || invoiceEntries.length === 0}
                  className="px-4 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#E11D2E' }}
                >
                  {sendingInvoice ? 'Mengirim...' : 'Kirim Semua E-Invoice'}
                </button>
              </div>
              {invoiceNotice && (
                <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${invoiceNotice.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  {invoiceNotice.message}
                </div>
              )}

              {transactionHistory.length > 0 ? (
                <div className="space-y-3">
                  {transactionHistory.map((activity, index) => {
                    const metadata = activity?.activity_metadata || {};
                    const totalPaid = Number(metadata.totalPaid || metadata.amount || metadata.transactionAmount || 0);
                    const paymentMethod = metadata.paymentMethod || metadata.method || '-';
                    const dateValue = activity.activity_date || activity.created_at;
                    const invoiceNumber = buildInvoiceNumber(activity, index);

                    return (
                      <div key={activity.id || `${activity.activity_type}-${index}`} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-1">Transaksi</div>
                            <div className="font-bold text-neutral-900">{activity.activity_title || 'Transaksi'}</div>
                            <div className="text-sm text-neutral-500 mt-1">{activity.activity_description || 'Riwayat transaksi checkout pengguna'}</div>
                            <div className="text-xs font-semibold text-neutral-700 mt-2">No Invoice: {invoiceNumber}</div>
                            <div className="text-xs text-neutral-400 mt-2">{new Date(dateValue || Date.now()).toLocaleString('id-ID')}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-neutral-500">Metode</div>
                            <div className="text-sm font-bold text-neutral-700">{String(paymentMethod).replace(/_/g, ' ')}</div>
                            <div className="text-xs text-neutral-500 mt-2">Total</div>
                            <div className="font-bold text-neutral-900">{totalPaid > 0 ? formatRupiah(totalPaid) : '-'}</div>
                            <button
                              onClick={() => onSendSingleInvoice(activity, index)}
                              disabled={sendingInvoice || totalPaid <= 0}
                              className="mt-3 px-3 py-1.5 rounded-full text-xs font-bold border border-neutral-300 text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                            >
                              Kirim E-Invoice
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
                  <Wallet size={24} className="mx-auto mb-3 text-neutral-400" />
                  <div className="font-bold text-neutral-800 mb-1">Belum ada riwayat transaksi sukses</div>
                  <div className="text-sm text-neutral-500">Setelah checkout berhasil, riwayat transaksi dan e-invoice akan tampil otomatis di sini.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentPage = ({ payload, onBack, onSuccess }) => {
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [dokuLoading, setDokuLoading] = useState(false);
  const [dokuError, setDokuError] = useState('');

  const serviceFee = payload?.type === 'booking' ? 500 : 5000;
  const subtotal = (payload?.amount || 0) + serviceFee;
  const finalTotal = Math.max(0, subtotal + promoDiscount);
  const isVoucherCovered = Number(finalTotal || 0) <= 0;

  const handleValidatePromo = async () => {
    setPromoError('');
    if (!promoCode.trim()) {
      setPromoDiscount(0);
      return;
    }

    try {
      const normalizedCode = promoCode.trim().toLowerCase();
      const now = new Date().toISOString();

      const { data: promos, error } = await supabase
        .from('promo_codes')
        .select('id, name, promo_type, discount_type, discount_value, min_booking_amount, max_discount_amount, quota, used_count, valid_from, valid_until, venue_id, status, active, discount_amount, discount_percent')
        .eq('code', normalizedCode);

      if (error) {
        setPromoError('Kode promo tidak ditemukan. Cek kembali atau hubungi support.');
        setPromoDiscount(0);
        return;
      }

      const promo = promos && promos.length > 0 ? promos[0] : null;
      if (!promo) {
        setPromoError('Kode promo tidak valid atau tidak aktif.');
        setPromoDiscount(0);
        return;
      }

      // Status check
      if (promo.status && promo.status !== 'active') {
        const statusMsg = { paused: 'dijeda sementara', expired: 'sudah berakhir', cancelled: 'dibatalkan' };
        setPromoError(`Kode promo ${statusMsg[promo.status] || 'tidak aktif'}.`);
        setPromoDiscount(0);
        return;
      }

      // Old-schema fallback: check `active` boolean
      if (promo.active === false && !promo.status) {
        setPromoError('Kode promo tidak aktif.');
        setPromoDiscount(0);
        return;
      }

      // Validity period
      if (promo.valid_from && new Date(promo.valid_from) > new Date()) {
        setPromoError('Promo belum dimulai.');
        setPromoDiscount(0);
        return;
      }
      if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
        setPromoError('Kode promo sudah berakhir.');
        setPromoDiscount(0);
        return;
      }

      // Quota
      if (promo.quota != null && Number(promo.used_count || 0) >= Number(promo.quota)) {
        setPromoError('Kuota promo sudah habis.');
        setPromoDiscount(0);
        return;
      }

      // Venue scope (if promo is tied to a specific venue)
      const bookingVenueId = payload?.venue_id || payload?.venueId;
      if (promo.venue_id && bookingVenueId && promo.venue_id !== bookingVenueId) {
        setPromoError('Kode promo tidak berlaku untuk venue ini.');
        setPromoDiscount(0);
        return;
      }

      // Min booking amount
      const minRequired = Number(promo.min_booking_amount || 0);
      if (minRequired > 0 && subtotal < minRequired) {
        setPromoError(`Minimum pemesanan Rp ${Number(minRequired).toLocaleString('id-ID')} untuk menggunakan promo ini.`);
        setPromoDiscount(0);
        return;
      }

      // Calculate discount (support both new and old schema)
      let discount = 0;
      if (promo.discount_type === 'percent' || promo.discount_percent) {
        const pct = Number(promo.discount_value || promo.discount_percent || 0);
        discount = subtotal * pct / 100;
        const cap = Number(promo.max_discount_amount || 0);
        if (cap > 0) discount = Math.min(discount, cap);
      } else {
        discount = Number(promo.discount_value || promo.discount_amount || 0);
      }
      discount = Math.min(discount, subtotal); // cannot exceed subtotal

      setPromoDiscount(-discount); // negative = reduction
      setPromoError('');
    } catch (err) {
      setPromoError('Gagal memvalidasi kode promo. ' + (err?.message || ''));
      setPromoDiscount(0);
    }
  };

  const handleDokuCheckout = async () => {
    const MIN_DOKU_AMOUNT = 1000;
    if (dokuLoading) return;
    setDokuError('');

    const safeDokuMessage = (value) => {
      const text = String(value || '').trim();
      if (!text || text === '[object Object]') return '';
      if (text.includes('[object Object]')) {
        const normalized = text.toLowerCase().replace(/\s+/g, '');
        if (normalized.includes('"error":"[objectobject]"') || normalized.includes("'error':'[objectobject]'")) {
          return '';
        }
      }
      return text;
    };

    const normalizeDokuErrorMessage = (input) => {
      if (!input) return '';
      if (typeof input === 'string') return safeDokuMessage(input);
      if (input instanceof Error) {
        const directMessage = safeDokuMessage(input.message);
        if (directMessage) return directMessage;
        return normalizeDokuErrorMessage(input.cause || input.error || input.details || input.hint);
      }

      if (Array.isArray(input)) {
        const joined = input
          .map((item) => normalizeDokuErrorMessage(item))
          .filter(Boolean)
          .join(', ');
        return joined.trim();
      }

      if (typeof input === 'object') {
        const candidate =
          normalizeDokuErrorMessage(input.error) ||
          normalizeDokuErrorMessage(input.message) ||
          normalizeDokuErrorMessage(input.details) ||
          normalizeDokuErrorMessage(input.hint);

        if (candidate) return candidate;

        try {
          return safeDokuMessage(JSON.stringify(input));
        } catch {
          return '';
        }
      }

      return safeDokuMessage(input);
    };

    const isLegacyCheckoutUrl = (value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return false;

      try {
        const url = new URL(trimmed);
        const host = url.hostname.toLowerCase();
        const hasLegacyQuery = ['order_id', 'amount', 'currency'].some((key) => url.searchParams.has(key));
        const hasModernToken = ['token', 'payment_token', 'checkout_token', 'session', 'session_id'].some((key) => url.searchParams.has(key));
        return (host === 'checkout.doku.com' || host.endsWith('.checkout.doku.com')) && hasLegacyQuery && !hasModernToken;
      } catch {
        return false;
      }
    };

    if (payload?.type !== 'booking') {
      setDokuError('Checkout DOKU saat ini hanya tersedia untuk booking venue.');
      return;
    }

    if (!payload?.venueId || !payload?.amount) {
      setDokuError('Data booking belum lengkap, silakan ulangi pemilihan jadwal.');
      return;
    }

    if (Number(finalTotal || 0) < MIN_DOKU_AMOUNT) {
      setDokuError('Minimum pembayaran DOKU adalah IDR 1.000.');
      return;
    }

    if (!supabase?.functions || typeof supabase.functions.invoke !== 'function') {
      setDokuError('Client Supabase belum siap untuk memanggil DOKU checkout.');
      return;
    }

    if (typeof crypto?.randomUUID !== 'function') {
      setDokuError('Browser tidak mendukung UUID generator untuk checkout DOKU.');
      return;
    }

    setDokuLoading(true);
    try {
      const bookingId = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('doku-checkout', {
        body: {
          booking_id: bookingId,
          venue_id: payload.venueId,
          amount: finalTotal,
          currency: 'IDR',
          customer_name: payload?.customerName || null,
          customer_phone: payload?.customerPhone || null,
        },
      });

      if (error) {
        let detailedError = '';

        try {
          if (error?.context && typeof error.context.json === 'function') {
            const contextBody = await error.context.json();
            detailedError = normalizeDokuErrorMessage(contextBody);
          }
        } catch {
          // Ignore parse failures and keep generic error fallback.
        }

        throw new Error(detailedError || normalizeDokuErrorMessage(error) || 'Gagal memanggil DOKU checkout.');
      }

      const apiResponse = data?.transaction?.doku_response?.api_response || data?.doku_response?.api_response || null;
      const checkoutUrl =
        data?.checkout_url ||
        data?.transaction?.checkout_url ||
        apiResponse?.response?.payment?.url ||
        apiResponse?.payment?.url ||
        apiResponse?.response?.url ||
        apiResponse?.url ||
        '';

      if (!checkoutUrl) {
        throw new Error('DOKU checkout URL tidak ditemukan dari response.');
      }

      if (isLegacyCheckoutUrl(checkoutUrl)) {
        throw new Error('DOKU checkout mengembalikan URL lama yang tidak valid. Silakan coba lagi atau cek konfigurasi DOKU.');
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setDokuError(normalizeDokuErrorMessage(err) || 'Gagal membuka halaman pembayaran DOKU.');
    } finally {
      setDokuLoading(false);
    }
  };

  const handleVoucherCoveredCheckout = async () => {
    if (typeof onSuccess !== 'function') return;

    await onSuccess({
      method: {
        name: 'free_voucher',
        label: 'Voucher Full',
      },
      total: 0,
      voucher: {
        covered: true,
        code: promoCode.trim() || null,
        discount: Math.abs(Number(promoDiscount || 0)),
        subtotal,
        serviceFee,
      },
    });
  };

  return (
    <div className="bg-[#F4F4F4] min-h-[80vh]">
      <button onClick={onBack} className="max-w-4xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Batalkan & Kembali
      </button>

      <div className="max-w-4xl mx-auto px-5 lg:px-8 py-6">
        <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ PEMBAYARAN DOKU</div>
        <h1 className="font-display text-4xl lg:text-5xl mb-1 leading-[0.95]">
          LANJUTKAN<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: '#E11D2E' }}>pembayaran.</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 lg:p-8 space-y-6">
              <div>
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ KODE PROMO</div>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Masukkan kode promo (opsional)"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleValidatePromo}
                    className="px-6 py-3 rounded-full font-bold text-white text-sm"
                    style={{ background: '#E11D2E' }}
                  >
                    Pakai
                  </button>
                </div>
                {promoError && <div className="mt-2 text-xs text-red-600">{promoError}</div>}
                {promoDiscount < 0 && <div className="mt-2 text-xs text-green-600">Kode promo valid! Hemat {formatRupiah(Math.abs(promoDiscount))}</div>}
              </div>

              <div className="border-t border-neutral-200 pt-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-12 rounded-lg flex items-center justify-center font-bold text-white" style={{ background: '#E11D2E' }}>
                    DOKU
                  </div>
                  <div>
                    <div className="font-bold text-lg">DOKU Checkout</div>
                    <div className="text-xs text-neutral-500">Metode pembayaran aman & terpercaya</div>
                  </div>
                </div>

                <button
                  onClick={handleDokuCheckout}
                  disabled={dokuLoading || isVoucherCovered || Number(finalTotal || 0) < 1000}
                  className="w-full py-4 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#E11D2E' }}
                >
                  {dokuLoading ? 'Membuka DOKU Checkout...' : 'Bayar via DOKU'} <ArrowUpRight size={16} strokeWidth={3} />
                </button>
                {isVoucherCovered && (
                  <div className="mt-3 text-xs text-emerald-600 text-center">
                    Total pembayaran tertutup voucher. Anda bisa lanjut tanpa DOKU.
                  </div>
                )}
                {!isVoucherCovered && Number(finalTotal || 0) < 1000 && (
                  <div className="mt-3 text-xs text-amber-600 text-center">
                    Minimum pembayaran DOKU adalah IDR 1.000.
                  </div>
                )}
                {dokuError && <div className="mt-3 text-xs text-red-600 text-center">{dokuError}</div>}

                {isVoucherCovered && (
                  <button
                    onClick={handleVoucherCoveredCheckout}
                    className="w-full mt-3 py-3 rounded-full font-bold text-white text-sm"
                    style={{ background: '#059669' }}
                  >
                    Selesaikan Booking (Voucher)
                  </button>
                )}

                <div className="text-center text-xs text-neutral-500 mt-4 flex items-center justify-center gap-1">
                  <ShieldCheck size={11} /> Pembayaran aman terenkripsi 256-bit SSL
                </div>
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white rounded-2xl p-6 border border-neutral-200">
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ RINGKASAN</div>
              <div className="space-y-1 mb-4">
                <div className="font-display text-xl leading-tight">{payload?.itemName || 'Booking Stadione'}</div>
                {payload?.itemSub && <div className="text-sm text-neutral-500">{payload.itemSub}</div>}
              </div>

              <div className="space-y-2 text-sm border-t border-neutral-200 pt-4">
                <div className="flex justify-between"><span className="text-neutral-500">Harga</span><span className="font-bold">{formatRupiah(payload?.amount || 0)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">Service fee</span><span className="font-bold">{formatRupiah(serviceFee)}</span></div>
                {promoDiscount !== 0 && (
                  <div className="flex justify-between text-green-600"><span>Diskon Promo</span><span className="font-bold">{formatRupiah(promoDiscount)}</span></div>
                )}
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-3 mb-4 font-bold text-lg">
                <span>Total</span>
                <span className="font-display text-2xl">{formatRupiah(finalTotal)}</span>
              </div>

              <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-neutral-400 font-bold">
                <span>VISA</span><span>MASTERCARD</span><span>QRIS</span><span>OVO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ CHAT ============
const ChatPage = ({ initialChatId, onBack, chats: initialChats }) => {
  const defaultChats = initialChats && initialChats.length > 0 ? initialChats : CHATS;
  const [activeId, setActiveId] = useState(initialChatId || defaultChats[0]?.id);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState(defaultChats);
  const active = chats.find(c => c.id === activeId);
  const filtered = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const send = () => {
    if (!input.trim()) return;
    const newMsg = { from: 'me', text: input, time: 'Sekarang' };
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, newMsg], lastMsg: input, time: 'Sekarang' } : c));
    setInput('');
  };

  return (
    <div className="bg-[#F4F4F4] h-[calc(100vh-64px)] flex flex-col">
      <div className="border-b border-neutral-300 bg-white px-5 lg:px-8 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
          <ArrowLeft size={14} /> Kembali
        </button>
        <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">/ PESAN</div>
        <div className="w-16"></div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden">
        <aside className="border-r border-neutral-300 bg-white flex flex-col min-h-0">
          <div className="p-4 border-b border-neutral-200">
            <div className="font-display text-2xl mb-3">CHAT</div>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-neutral-100 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-neutral-300"
                placeholder="Cari pelatih..."
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full p-4 flex items-center gap-3 border-b border-neutral-100 transition text-left ${activeId === c.id ? 'bg-red-50' : 'hover:bg-neutral-50'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-display text-white" style={{ background: '#E11D2E' }}>
                    {c.initial}
                  </div>
                  {c.online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm truncate">{c.name}</span>
                    <span className="text-[10px] text-neutral-500 shrink-0">{c.time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-neutral-500 truncate">{c.lastMsg}</span>
                    {c.unread > 0 && (
                      <span className="text-[10px] font-bold text-white px-1.5 rounded-full shrink-0" style={{ background: '#E11D2E', minWidth: 18, height: 18, lineHeight: '18px' }}>
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col bg-[#FAFAFA] min-h-0">
          {active && (
            <>
              <div className="px-5 lg:px-6 py-3 border-b border-neutral-200 bg-white flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-white text-sm" style={{ background: '#E11D2E' }}>
                    {active.initial}
                  </div>
                  {active.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{active.name}</div>
                  <div className="text-xs text-neutral-500">
                    {active.online ? 'Online sekarang' : 'Aktif 2 jam lalu'} · {active.sport}
                  </div>
                </div>
                <button className="p-2 hover:bg-neutral-100 rounded-full"><Calendar size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 lg:p-8 space-y-3">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-neutral-200">Hari Ini</span>
                </div>
                {active.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                      m.from === 'me'
                        ? 'bg-neutral-900 text-white rounded-br-md'
                        : 'bg-white border border-neutral-200 text-neutral-900 rounded-bl-md'
                    }`}>
                      <div>{m.text}</div>
                      <div className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-neutral-400' : 'text-neutral-500'}`}>{m.time}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-neutral-200 bg-white">
                <div className="flex items-center gap-2">
                  <button className="p-2.5 hover:bg-neutral-100 rounded-full text-neutral-500"><Plus size={18} /></button>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    className="flex-1 px-4 py-3 bg-neutral-100 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-neutral-300"
                    placeholder={`Kirim pesan ke ${active.name.split(' ')[1] || active.name}...`}
                  />
                  <button onClick={send} className="p-3 rounded-full text-white" style={{ background: '#E11D2E' }}>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

// ============ TOURNAMENT BRACKET ============
const TournamentBracket = ({ tournamentId }) => {
  const bracket = BRACKETS[tournamentId];

  if (!bracket) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
        <Trophy size={32} className="mx-auto mb-3 text-neutral-400" />
        <div className="font-display text-2xl text-neutral-900 mb-2">Bagan Belum Tersedia</div>
        <p className="text-sm text-neutral-500 max-w-sm mx-auto">Bagan akan ditampilkan setelah babak grup selesai atau jika format turnamen ini sistem gugur.</p>
      </div>
    );
  }

  const matchHeight = 88;
  const matchGap = 16;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 lg:p-8 overflow-x-auto">
      <div className="flex gap-6 lg:gap-10 min-w-max">
        {bracket.map((round, ri) => {
          const matchSpace = matchHeight + matchGap;
          const cellHeight = matchSpace * Math.pow(2, ri);
          return (
            <div key={ri} className="flex flex-col gap-0" style={{ minWidth: 220 }}>
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E11D2E' }} />
                {round.name}
              </div>
              <div className="flex flex-col" style={{ paddingTop: ri === 0 ? 0 : (cellHeight - matchSpace) / 2 }}>
                {round.matches.map((m, mi) => (
                  <div key={mi} style={{ height: matchSpace, marginBottom: ri === 0 ? 0 : cellHeight - matchSpace }}>
                    <div className={`bg-neutral-50 border-2 rounded-xl overflow-hidden ${m.w !== null ? 'border-neutral-200' : 'border-amber-300 bg-amber-50'}`} style={{ height: matchHeight }}>
                      <div className={`flex items-center justify-between px-3 h-1/2 border-b border-neutral-200 ${m.w === 0 ? 'bg-white' : ''}`}>
                        <span className={`text-sm truncate ${m.w === 0 ? 'font-bold text-neutral-900' : 'text-neutral-500'}`}>{m.p1}</span>
                        <span className={`font-display text-lg ml-2 shrink-0 ${m.w === 0 ? 'text-[#E11D2E]' : 'text-neutral-400'}`}>{m.s1 ?? '—'}</span>
                      </div>
                      <div className={`flex items-center justify-between px-3 h-1/2 ${m.w === 1 ? 'bg-white' : ''}`}>
                        <span className={`text-sm truncate ${m.w === 1 ? 'font-bold text-neutral-900' : 'text-neutral-500'}`}>{m.p2}</span>
                        <span className={`font-display text-lg ml-2 shrink-0 ${m.w === 1 ? 'text-[#E11D2E]' : 'text-neutral-400'}`}>{m.s2 ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-0 self-center" style={{ minWidth: 200 }}>
          <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-4 flex items-center gap-2">
            <Trophy size={12} style={{ color: '#E11D2E' }} /> Juara
          </div>
          <div className="rounded-2xl p-5 text-white text-center grain relative overflow-hidden" style={{ background: '#E11D2E' }}>
            <Trophy size={32} className="mx-auto mb-2 opacity-80" />
            <div className="text-xs uppercase tracking-widest font-bold opacity-80 mb-1">CHAMPION</div>
            <div className="font-display text-xl leading-tight">TBD</div>
            <div className="text-xs opacity-80 mt-1">Menunggu final</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ COACH PROFILE ============
const CoachProfile = ({ coach, onBack, onChat, onBook }) => {
  const [tab, setTab] = useState('tentang');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(0);

  const extra = COACH_EXTRA[coach.id] || {
    bio: `${coach.name} adalah pelatih ${coach.sport} dengan ${coach.exp} tahun pengalaman. Telah melatih ratusan murid dari pemula hingga atlet kompetitif.`,
    location: 'Jakarta',
    languages: ['Indonesia', 'English'],
    schedule: ['Sen-Jum: 06:00 - 21:00', 'Sab-Min: 08:00 - 19:00'],
    programs: [
      { name: 'Sesi Privat', price: coach.price, duration: '60 menit', desc: 'Latihan privat 1-on-1' },
      { name: 'Sesi Berdua', price: Math.round(coach.price * 0.7), duration: '60 menit', desc: 'Latihan untuk dua orang' },
      { name: 'Group (Max 4)', price: Math.round(coach.price * 0.5), duration: '90 menit', desc: 'Group kecil' },
    ]
  };

  const dates = [
    { label: 'Hari Ini', date: '7 Mei' },
    { label: 'Besok', date: '8 Mei' },
    { label: 'Sabtu', date: '9 Mei' },
    { label: 'Minggu', date: '10 Mei' },
  ];

  const slots = ['07:00', '09:00', '15:00', '17:00', '19:00'];
  const taken = ['09:00', '17:00'];

  const allReviews = [
    { name: 'Aldi Pratama', rating: 5, time: '2 hari lalu', text: `Coach ${coach.name.split(' ')[1] || coach.name} luar biasa! Materi tersusun dengan baik, sabar, dan benar-benar membantu peningkatan teknik saya secara signifikan.` },
    { name: 'Sarah Kusuma', rating: 5, time: '1 minggu lalu', text: 'Pelatih terbaik yang pernah saya temui. Selalu memberi feedback konstruktif, motivasi nya juga keren.' },
    { name: 'Budi Santoso', rating: 4, time: '2 minggu lalu', text: 'Sangat berpengalaman. Cocok untuk yang serius mau belajar dari dasar.' },
    { name: 'Maya Hartono', rating: 5, time: '3 minggu lalu', text: 'Recommended! 8 sesi sudah merasa banyak progres.' },
  ];

  const Icon = sportIcon(coach.sport);

  return (
    <div>
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Kembali ke Pelatihan
      </button>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="rounded-2xl p-6 lg:p-8 mb-6 grain relative overflow-hidden text-white" style={{ background: '#0A0A0A' }}>
            <div className="absolute -right-16 -bottom-16 opacity-5">
              <Icon size={300} />
            </div>
            <div className="flex items-start gap-5 flex-wrap relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center font-display text-4xl text-white shrink-0" style={{ background: '#E11D2E' }}>
                {coach.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-widest font-bold opacity-70 mb-1">/ {coach.sport.toUpperCase()} COACH</div>
                <h1 className="font-display text-4xl lg:text-5xl leading-[0.95] mb-3">{coach.name}</h1>
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <span className="flex items-center gap-1"><Star size={14} fill="#E11D2E" color="#E11D2E" /> {coach.rating}</span>
                  <span className="opacity-60">·</span>
                  <span>{coach.sessions} sesi selesai</span>
                  <span className="opacity-60">·</span>
                  <span>{coach.exp} tahun pengalaman</span>
                  <span className="opacity-60">·</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {extra.location}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10 relative">
              <div>
                <div className="text-xs uppercase tracking-wider opacity-70 mb-1">Tarif Mulai</div>
                <div className="font-display text-2xl">{formatRupiah(Math.min(...extra.programs.map(p => p.price)))}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider opacity-70 mb-1">Respon</div>
                <div className="font-display text-2xl">~5 menit</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider opacity-70 mb-1">Bahasa</div>
                <div className="font-display text-lg">{extra.languages.join(' · ')}</div>
              </div>
            </div>
          </div>

          <div className="border-b border-neutral-300 mb-6 flex gap-1 overflow-x-auto">
            {[
              { id: 'tentang', label: 'Tentang' },
              { id: 'program', label: 'Program' },
              { id: 'jadwal', label: 'Jadwal' },
              { id: 'ulasan', label: `Ulasan (${allReviews.length})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition shrink-0 ${
                  tab === t.id ? 'border-[#E11D2E] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'tentang' && (
            <div className="space-y-6">
              <div>
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ BIO</div>
                <p className="text-base text-neutral-700 leading-relaxed">{extra.bio}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ SERTIFIKASI & PRESTASI</div>
                <div className="space-y-2">
                  {coach.certs.map(c => (
                    <div key={c} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-3">
                      <Award size={16} style={{ color: '#E11D2E' }} />
                      <span className="font-bold text-sm">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ JADWAL TERSEDIA</div>
                <div className="space-y-1.5">
                  {extra.schedule.map(s => (
                    <div key={s} className="flex items-center gap-2 text-sm">
                      <Clock size={12} className="text-neutral-500" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'program' && (
            <div className="space-y-3">
              {extra.programs.map((p, i) => (
                <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-display text-2xl mb-1">{p.name}</div>
                    <div className="text-sm text-neutral-600">{p.desc}</div>
                    <div className="text-xs text-neutral-500 mt-2 flex items-center gap-2">
                      <Clock size={10} /> {p.duration}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-3xl text-neutral-900 leading-none">{formatRupiah(p.price)}</div>
                    <div className="text-xs text-neutral-500 font-semibold">per sesi</div>
                  </div>
                  <button onClick={() => onBook({ coach, program: p })} className="px-4 py-2 rounded-full text-xs font-bold text-white" style={{ background: '#E11D2E' }}>
                    PILIH
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'jadwal' && (
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ PILIH TANGGAL</div>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {dates.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(i)}
                    className={`shrink-0 px-5 py-3 rounded-2xl border-2 transition ${
                      selectedDate === i ? 'border-[#E11D2E] bg-[#E11D2E] text-white' : 'border-neutral-300 bg-white hover:border-neutral-900'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase">{d.label}</div>
                    <div className="font-display text-lg leading-none mt-1">{d.date}</div>
                  </button>
                ))}
              </div>
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-3">/ JAM TERSEDIA</div>
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
                {slots.map(s => {
                  const isTaken = taken.includes(s);
                  const isSelected = selectedSlot === s;
                  return (
                    <button
                      key={s}
                      disabled={isTaken}
                      onClick={() => setSelectedSlot(s)}
                      className={`p-3 rounded-xl text-center font-bold transition ${
                        isTaken ? 'bg-neutral-100 text-neutral-400 line-through cursor-not-allowed' :
                        isSelected ? 'bg-neutral-900 text-white' :
                        'bg-white border-2 border-neutral-200 hover:border-neutral-900'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {selectedSlot && (
                <button onClick={() => onBook({ coach, program: extra.programs[0], time: selectedSlot, date: dates[selectedDate].date })} className="mt-6 w-full lg:w-auto px-7 py-3.5 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2" style={{ background: '#E11D2E' }}>
                  Booking {dates[selectedDate].label} {selectedSlot} <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          {tab === 'ulasan' && (
            <div className="space-y-4">
              {allReviews.map((r, i) => (
                <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs">
                        {r.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{r.name}</div>
                        <div className="text-xs text-neutral-500">{r.time}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[...Array(r.rating)].map((_, j) => <Star key={j} size={12} fill="#E11D2E" color="#E11D2E" />)}
                    </div>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start space-y-3">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6">
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">/ BOOKING CEPAT</div>
            <div className="font-display text-3xl mb-1">{formatRupiah(coach.price)}</div>
            <div className="text-sm text-neutral-500 mb-5">per sesi 60 menit</div>

            <button onClick={() => onBook({ coach, program: extra.programs[0] })} className="w-full py-3.5 rounded-full font-bold text-white text-sm mb-2" style={{ background: '#E11D2E' }}>
              BOOK SESI SEKARANG
            </button>
            <button onClick={() => onChat(coach)} className="w-full py-3.5 rounded-full font-bold text-sm border-2 border-neutral-300 hover:border-neutral-900 flex items-center justify-center gap-2">
              <MessageCircle size={14} /> Chat Pelatih
            </button>

            <div className="border-t border-neutral-200 mt-5 pt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <ShieldCheck size={12} style={{ color: '#E11D2E' }} /> Verified Coach
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <CheckCircle size={12} style={{ color: '#E11D2E' }} /> Refund 100% jika batal
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <CheckCircle size={12} style={{ color: '#E11D2E' }} /> Pembayaran aman
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 text-white rounded-2xl p-5">
            <div className="text-xs uppercase tracking-widest font-bold opacity-70 mb-2">/ STATISTIK</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="font-display text-2xl">{coach.sessions}</div>
                <div className="text-xs opacity-70">Sesi selesai</div>
              </div>
              <div>
                <div className="font-display text-2xl">{coach.rating}</div>
                <div className="text-xs opacity-70">Rating</div>
              </div>
              <div>
                <div className="font-display text-2xl">{coach.exp}th</div>
                <div className="text-xs opacity-70">Pengalaman</div>
              </div>
              <div>
                <div className="font-display text-2xl">98%</div>
                <div className="text-xs opacity-70">Tingkat hadir</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ APP ============
const DEV_E2E_OFFICIAL_AUTH = Object.freeze({
  id: 'd1258956-c94b-4ecf-b866-6d355dd3d73e',
  email: 'qa.official@stadione.dev',
  name: 'QA Official',
  roles: ['match_official'],
  permissions: [
    'official.schedule.read',
    'official.match_center.open',
    'official.match_report.open',
    'official.match_statistics.open',
  ],
  activeContext: {
    context_scope: 'official',
    context_role: 'match_official',
    context_entity_type: null,
    context_entity_id: null,
    context_label: 'Official Center',
    metadata: { source: 'dev_e2e_bypass' },
    switched_at: new Date().toISOString(),
  },
});

export default function Stadione() {
  const [page, setPage] = useState('home');
  const [trainingSection, setTrainingSection] = useState('home');
  const [tournamentDetail, setTournamentDetail] = useState(null);
  const [matchContext, setMatchContext] = useState(null);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [articleDetail, setArticleDetail] = useState(null);
  const [publishedTournament, setPublishedTournament] = useState(null);
  const [coachDetail, setCoachDetail] = useState(null);
  const [communityDetail, setCommunityDetail] = useState(null);
  const [paymentPayload, setPaymentPayload] = useState(null);
  const [chatInitial, setChatInitial] = useState(null);
  const [tab, setTab] = useState('klasemen');
  const [returnTo, setReturnTo] = useState(null);
  const [communityNotifications, setCommunityNotifications] = useState([]);
  const [communityUnreadById, setCommunityUnreadById] = useState({});
  const [cartItems, setCartItems] = useState([]);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceNotice, setInvoiceNotice] = useState(null);

  // Auth state
  const [auth, setAuth] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authInitialError, setAuthInitialError] = useState('');
  const [authMode, setAuthMode] = useState(() => {
    const mode = getAuthModeFromUrl();
    return (mode === AUTH_MODAL_MODES.recovery || hasRecoveryParamsInUrl())
      ? AUTH_MODAL_MODES.recovery
      : AUTH_MODAL_MODES.login;
  });
  const devOfficialBypass = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (!import.meta.env.DEV) return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('e2e_official') === '1';
  }, []);
  const devOfficialBypassPage = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('e2e_page') || '';
  }, []);
  const communityNotificationStorageKey = useMemo(() => `stadione_community_notifications_${auth?.id || 'guest'}`, [auth?.id]);
  const communityUnreadStorageKey = useMemo(() => `stadione_community_unread_${auth?.id || 'guest'}`, [auth?.id]);
  const cartStorageKey = useMemo(() => `stadione_checkout_cart_${auth?.id || 'guest'}`, [auth?.id]);

  useEffect(() => {
    redirectToCanonicalAuthHost();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const rawNotifications = window.localStorage.getItem(communityNotificationStorageKey);
      const rawUnread = window.localStorage.getItem(communityUnreadStorageKey);
      setCommunityNotifications(rawNotifications ? JSON.parse(rawNotifications) : []);
      setCommunityUnreadById(rawUnread ? JSON.parse(rawUnread) : {});
    } catch {
      setCommunityNotifications([]);
      setCommunityUnreadById({});
    }
  }, [communityNotificationStorageKey, communityUnreadStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const rawCart = window.localStorage.getItem(cartStorageKey);
      const parsed = rawCart ? JSON.parse(rawCart) : [];
      setCartItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCartItems([]);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(communityNotificationStorageKey, JSON.stringify(communityNotifications.slice(0, 20)));
      window.localStorage.setItem(communityUnreadStorageKey, JSON.stringify(communityUnreadById || {}));
    } catch {
      // ignore localStorage failures
    }
  }, [communityNotificationStorageKey, communityNotifications, communityUnreadById, communityUnreadStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems.slice(0, 30)));
    } catch {
      // ignore localStorage failures
    }
  }, [cartItems, cartStorageKey]);

  const handleCommunityNotification = useCallback((notification) => {
    if (!notification?.id) return;

    setCommunityNotifications((prev) => {
      if (prev.some((item) => item.id === notification.id)) return prev;
      return [notification, ...prev].slice(0, 20);
    });

    if (notification.communityId) {
      setCommunityUnreadById((prev) => ({
        ...prev,
        [notification.communityId]: Number(prev?.[notification.communityId] || 0) + 1,
      }));
    }
  }, []);

  const handleCommunityRead = useCallback((communityId) => {
    if (!communityId) return;
    setCommunityUnreadById((prev) => ({
      ...prev,
      [communityId]: 0,
    }));
  }, []);

  const handleAuth = useCallback(async (user) => {
    // OPTIMIZED: Invalidate cache when user logs in
    if (user?.id) {
      clearAuthStateCache(user.id);
      authSessionCache.invalidate(user.id);
    }
    try {
      const nextAuth = await enrichAuthUser(user);
      setAuth(nextAuth);
    } catch (err) {
      if (isModerationAuthError(err)) {
        try {
          const supabase = await getSupabaseAuthClient();
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.error('Failed to sign out moderated account:', signOutErr);
        }

        clearStoredActiveWorkspaceContext(user?.id);
        setAuth(null);
      }

      throw err;
    }
  }, []);

  const rejectModeratedSession = useCallback(async (error, user) => {
    const userId = user?.id;

    if (userId) {
      clearAuthStateCache(userId);
      authSessionCache.invalidate(userId);
      clearStoredActiveWorkspaceContext(userId);
    }

    try {
      const supabase = await getSupabaseAuthClient();
      await supabase.auth.signOut();
    } catch (signOutErr) {
      console.error('Failed to sign out moderated session:', signOutErr);
    }

    setAuth(null);
    setAuthMode(AUTH_MODAL_MODES.login);
    setAuthInitialError(mapAuthErrorMessage(error));
    setShowAuth(true);
    setPage('home');
  }, []);

  // Restore session from Supabase on app mount
  useEffect(() => {
    let subscription;

    const restoreSession = async () => {
      try {
        const supabase = await getSupabaseAuthClient();

        const urlAuthError = getAuthErrorFromUrl();
        if (urlAuthError) {
          setAuthMode(AUTH_MODAL_MODES.login);
          setAuthInitialError(urlAuthError);
          setShowAuth(true);
          clearAuthUrlArtifacts();
        } else if (getAuthModeFromUrl() === AUTH_MODAL_MODES.recovery || hasRecoveryParamsInUrl()) {
          setAuthMode(AUTH_MODAL_MODES.recovery);
          setAuthInitialError('');
          setShowAuth(true);
        }

        const { data } = supabase.auth.onAuthStateChange(
          (event, currentSession) => {
            if (event === 'PASSWORD_RECOVERY') {
              setAuthMode(AUTH_MODAL_MODES.recovery);
              setAuthInitialError('');
              setShowAuth(true);
              return;
            }

            if (currentSession?.user) {
              const recoveryFlowActive =
                getAuthModeFromUrl() === AUTH_MODAL_MODES.recovery ||
                hasRecoveryParamsInUrl();

              if (event === 'SIGNED_IN' && !recoveryFlowActive) {
                clearAuthUrlArtifacts();
                setShowAuth(false);
                setAuthInitialError('');
              }

              // Important: keep auth callback synchronous to avoid Supabase auth lock deadlocks.
              setTimeout(async () => {
                try {
                  const nextAuth = await enrichAuthUser(currentSession.user);
                  setAuth(nextAuth);
                } catch (enrichErr) {
                  if (isModerationAuthError(enrichErr)) {
                    await rejectModeratedSession(enrichErr, currentSession.user);
                    return;
                  }

                  console.error('Failed to enrich auth user from auth state change:', enrichErr);
                }
              }, 0);
            } else {
              if (devOfficialBypass) {
                setAuth(DEV_E2E_OFFICIAL_AUTH);
              } else {
                setAuth(null);
              }
            }
          }
        );
        subscription = data?.subscription;

        const { data: { session }, error } = await supabase.auth.getSession();

        if (!error && session?.user) {
          try {
            const nextAuth = await enrichAuthUser(session.user);
            setAuth(nextAuth);
          } catch (enrichErr) {
            if (isModerationAuthError(enrichErr)) {
              await rejectModeratedSession(enrichErr, session.user);
              return;
            }

            throw enrichErr;
          }
        } else if (devOfficialBypass) {
          setAuth(DEV_E2E_OFFICIAL_AUTH);
          setShowAuth(false);
          setAuthInitialError('');

          if (devOfficialBypassPage === 'schedule') {
            setPage('official-schedule');
          } else if (devOfficialBypassPage === 'center') {
            setPage('official-center');
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      }
    };

    restoreSession();

    return () => {
      subscription?.unsubscribe();
    };
  }, [devOfficialBypass, devOfficialBypassPage, rejectModeratedSession]);

  // Fetch data from Supabase
  const { venues, loading: venuesLoading } = useVenues();
  const { tournaments, loading: tournamentsLoading } = useTournaments();
  const { news, loading: newsLoading } = useNews();
  const { coaches, loading: coachesLoading } = useCoaches();
  const { chats, loading: chatsLoading } = useChats();
  const { stats: gamificationStats, loading: gamificationLoading } = useUserGamification(auth?.id);
  const { activities, loading: activitiesLoading, refetch: refetchActivities } = useActivityHistory(auth?.id, 20);
  const { currentTier, nextTier, progressPercentage, pointsToNextTier } = useTierProgression(gamificationStats?.points || 0);
  const access = auth?.access || deriveConsoleAccess([], []);
  const transactionHistory = useMemo(() => {
    return (activities || [])
      .filter((item) => {
        const type = String(item?.activity_type || '').toLowerCase();
        const metadata = item?.activity_metadata || {};
        const amount = Number(metadata.totalPaid || metadata.amount || metadata.transactionAmount || 0);
        return (type === 'venue_booking' || type === 'transaction' || amount > 0) && amount > 0;
      })
      .sort((a, b) => new Date(b.activity_date || b.created_at || 0).getTime() - new Date(a.activity_date || a.created_at || 0).getTime());
  }, [activities]);
  const invoiceEntries = useMemo(() => {
    return transactionHistory.map((activity, index) => {
      const metadata = activity?.activity_metadata || {};
      const totalPaid = Number(metadata.totalPaid || metadata.amount || metadata.transactionAmount || 0);
      return {
        invoiceNumber: buildInvoiceNumber(activity, index),
        issuedAt: activity.activity_date || activity.created_at || new Date().toISOString(),
        title: activity.activity_title || 'Transaksi',
        description: activity.activity_description || 'Riwayat transaksi checkout pengguna',
        paymentMethod: metadata.paymentMethod || metadata.method || '-',
        amount: totalPaid,
        customerName: auth?.name || 'User Stadione',
        customerEmail: auth?.email || '',
        customerId: auth?.id || null,
      };
    });
  }, [auth?.email, auth?.id, auth?.name, transactionHistory]);
  
  // Fallback to hardcoded data if Supabase is not available
  const VENUES_DATA = venues.length > 0 ? venues : [];
  const TOURNAMENTS_DATA = tournaments.length > 0 ? tournaments : [];
  const NEWS_DATA = news.length > 0 ? news : [];
  const COACHES_DATA = coaches.length > 0 ? coaches : [];
  const CHATS_DATA = chats.length > 0 ? chats : [];

  const goTo = (newPage, data = null, opts = {}) => {
    const trainingAliasMap = {
      'training-academy': 'academy',
      'training-parent': 'parent',
      'training-workspace': 'workspace',
      'training-programs': 'programs',
    };
    const sectionFromAlias = trainingAliasMap[newPage];
    const requestedTrainingSection = sectionFromAlias || opts?.section || data?.section;

    if (newPage === 'training' || sectionFromAlias) {
      const allowedSections = new Set(['home', 'academy', 'coach', 'programs', 'events', 'athlete', 'parent', 'workspace']);
      if (requestedTrainingSection && allowedSections.has(requestedTrainingSection)) {
        setTrainingSection(requestedTrainingSection);
      } else if (newPage === 'training' && !requestedTrainingSection) {
        setTrainingSection('home');
      }
      setPage('training');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (newPage === 'tournament-detail') setTournamentDetail(data);
    if (['match-center', 'match-report', 'match-statistics'].includes(newPage)) setMatchContext(data);
    if (newPage === 'booking-detail') setBookingDetail(data);
    if (newPage === 'news-detail') setArticleDetail(data);
    if (newPage === 'tournament-published') setPublishedTournament(data);
    if (newPage === 'coach-profile') setCoachDetail(data);
    if (newPage === 'community-detail') setCommunityDetail(data);
    if (newPage === 'payment') setPaymentPayload(data);
    if (newPage === 'chat') setChatInitial(data);
    if (opts.returnTo !== undefined) setReturnTo(opts.returnTo);
    setPage(newPage);
    if (newPage.startsWith('tournament-detail')) setTab(tournamentDetail?.format === 'Knockout' ? 'bagan' : 'klasemen');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addItemToCart = (payload) => {
    if (!payload) return;

    const nextItem = {
      id: (typeof crypto !== 'undefined' && crypto?.randomUUID)
        ? crypto.randomUUID()
        : `cart-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      payload,
      createdAt: new Date().toISOString(),
    };

    setCartItems((prev) => [nextItem, ...prev].slice(0, 30));
    goTo('cart');
  };

  const handleCheckoutFromCart = (item) => {
    if (!item?.payload) return;
    goTo('payment', {
      ...item.payload,
      sourceCartItemId: item.id,
    }, { returnTo: 'cart' });
  };

  const sendInvoicePayload = async (invoice) => {
    if (!auth?.email) {
      setInvoiceNotice({ type: 'error', message: 'Email user belum tersedia. Silakan login ulang dan pastikan profil memiliki email valid.' });
      return { error: 'missing_email' };
    }

    return sendEInvoiceEmail({
      toEmail: auth.email,
      recipientName: auth.name,
      invoice,
    });
  };

  const handleSendSingleInvoice = async (activity, index) => {
    const metadata = activity?.activity_metadata || {};
    const amount = Number(metadata.totalPaid || metadata.amount || metadata.transactionAmount || 0);
    if (amount <= 0) {
      setInvoiceNotice({ type: 'error', message: 'Invoice hanya tersedia untuk transaksi dengan nominal berhasil.' });
      return;
    }

    const invoice = {
      invoiceNumber: buildInvoiceNumber(activity, index),
      issuedAt: activity.activity_date || activity.created_at || new Date().toISOString(),
      title: activity.activity_title || 'Transaksi',
      description: activity.activity_description || 'Riwayat transaksi checkout pengguna',
      paymentMethod: metadata.paymentMethod || metadata.method || '-',
      amount,
      customerName: auth?.name || 'User Stadione',
      customerEmail: auth?.email || '',
      customerId: auth?.id || null,
    };

    setSendingInvoice(true);
    setInvoiceNotice(null);
    const result = await sendInvoicePayload(invoice);
    if (result?.error) {
      setInvoiceNotice({ type: 'error', message: `Gagal kirim e-invoice ${invoice.invoiceNumber}: ${result.error}` });
    } else {
      setInvoiceNotice({ type: 'success', message: `E-invoice ${invoice.invoiceNumber} berhasil dikirim ke ${auth.email}.` });
    }
    setSendingInvoice(false);
  };

  const handleSendAllInvoices = async () => {
    if (invoiceEntries.length === 0) {
      setInvoiceNotice({ type: 'error', message: 'Belum ada invoice transaksi sukses untuk dikirim.' });
      return;
    }

    setSendingInvoice(true);
    setInvoiceNotice(null);

    let sent = 0;
    let failed = 0;

    for (const invoice of invoiceEntries) {
      const result = await sendInvoicePayload(invoice);
      if (result?.error) {
        failed += 1;
      } else {
        sent += 1;
      }
    }

    if (failed > 0) {
      setInvoiceNotice({
        type: 'error',
        message: `Pengiriman e-invoice selesai: ${sent} berhasil, ${failed} gagal. Pastikan Edge Function dan env email sudah aktif.`,
      });
    } else {
      setInvoiceNotice({
        type: 'success',
        message: `Semua ${sent} e-invoice berhasil dikirim ke ${auth?.email || 'email user'}.`,
      });
    }

    setSendingInvoice(false);
  };

  const openAuth = (mode) => {
    if (
      mode === AUTH_MODAL_MODES.login ||
      mode === AUTH_MODAL_MODES.register ||
      mode === AUTH_MODAL_MODES.forgotPassword ||
      mode === AUTH_MODAL_MODES.recovery
    ) {
      setAuthMode(mode);
    } else {
      setAuthMode(AUTH_MODAL_MODES.login);
    }
    setAuthInitialError('');
    setShowAuth(true);
  };

  const handleOpenCommunityNotification = (notification) => {
    if (!notification) return;

    if (notification.communityId) {
      handleCommunityRead(notification.communityId);
    }

    const communitySeed = notification.communitySeed || {
      id: notification.communityId,
      name: notification.communityName || 'Komunitas',
      city: '',
      province: '',
      badges: [],
      events: [],
      feedPosts: [],
    };

    if (communitySeed?.id) {
      goTo('community-detail', communitySeed);
      return;
    }

    goTo('community');
  };

  const handleLogout = async () => {
    const userId = auth?.id;
    try {
      const supabase = await getSupabaseAuthClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    clearStoredActiveWorkspaceContext(userId);
    setAuth(null);
    setPage('home');
  };

  const handleSwitchContext = async (scope) => {
    if (!auth?.id || !scope) return;

    const fallbackContext = {
      context_scope: scope,
      context_role: null,
      context_entity_type: null,
      context_entity_id: null,
      context_label: scope === 'platform'
        ? 'Platform Console'
        : scope === 'workspace'
          ? 'Workspace Console'
          : scope === 'official'
            ? 'Official Center'
            : 'General',
      metadata: {},
      switched_at: new Date().toISOString(),
    };

    const nextContext = await switchCurrentUserActiveContext({
      scope,
      label: fallbackContext.context_label,
      reason: 'menu_context_switch',
      metadata: { source: 'header_menu' },
    });

    const resolvedContext = nextContext || fallbackContext;
    setStoredActiveWorkspaceContext(auth.id, resolvedContext);
    setAuth((prev) => (prev ? { ...prev, activeContext: resolvedContext } : prev));
  };

  const requireAuthThen = (cb) => {
    if (auth) cb();
    else openAuth('login');
  };

  const renderLazyPage = (node, label) => (
    <Suspense fallback={<LazyFallback label={label} />}>
      {node}
    </Suspense>
  );

  const renderAccessControlledPage = (pageKey, node, label, options = {}) => {
    const allowed = canAccessPage(pageKey, options);
    if (!allowed) {
      if (auth && VERIFIED_MEMBER_REQUIRED_PAGES.has(pageKey) && !auth?.verifiedMember) {
        return (
          <AccessDeniedPage
            title="Verified Member Diperlukan"
            description="Halaman ini mensyaratkan akun Verified Member. Lengkapi data profil, unggah KTP dan foto post/selfie di halaman Profil Saya."
            onBack={() => goTo('profile')}
          />
        );
      }

      return <AccessDeniedPage onBack={() => goTo('profile')} />;
    }

    return renderLazyPage(node, label);
  };

  const canAccessPage = (pageKey, options = {}) => {
    const allowedByRolePermission = canAccessAdminPage(pageKey, auth?.roles || [], auth?.permissions || []);
    if (!allowedByRolePermission) return false;

    if (auth && VERIFIED_MEMBER_REQUIRED_PAGES.has(pageKey) && !auth?.verifiedMember) {
      return false;
    }

    const activeScope = auth?.activeContext?.context_scope;
    const pageRule = PAGE_ACCESS[pageKey];

    if (activeScope && pageRule?.console && activeScope !== pageRule.console) {
      return false;
    }

    if (['match-center', 'match-report', 'match-statistics'].includes(pageKey)) {
      const selectedContext = options?.matchContext || matchContext;
      const capabilities = getOfficialMatchCapabilities({
        userRoles: auth?.roles || [],
        assignmentRole: selectedContext?.assignmentRole,
      });

      if (pageKey === 'match-center') return capabilities.openMatchCenter;
      if (pageKey === 'match-report') return capabilities.openMatchReport;
      if (pageKey === 'match-statistics') return capabilities.openMatchStatistics;
    }

    return true;
  };

  // Payment success → return to home or specified page
  const handlePaymentSuccess = async ({ method, total, voucher } = {}) => {
    if (paymentPayload?.sourceCartItemId) {
      setCartItems((prev) => prev.filter((item) => item.id !== paymentPayload.sourceCartItemId));
    }

    if (paymentPayload?.type === 'booking' && auth?.id) {
      const resolvedMethod = method?.name || (voucher?.covered ? 'free_voucher' : undefined);
      const resolvedTotal = Number.isFinite(Number(total)) ? Number(total) : Number(paymentPayload?.amount || 0);

      const result = await recordVenueBooking(auth.id, {
        venueId: paymentPayload.venueId,
        venueName: paymentPayload.itemName,
        venueCity: paymentPayload.venueCity,
        bookingDate: paymentPayload.bookingDate,
        bookingTime: paymentPayload.bookingTime,
        durationHours: paymentPayload.durationHours || 1,
        sport: paymentPayload.sport,
        status: voucher?.covered ? 'paid' : 'confirmed',
        paymentMethod: resolvedMethod,
        totalPaid: resolvedTotal,
        voucherCode: voucher?.code || null,
        voucherDiscount: Number(voucher?.discount || 0),
        voucherCovered: Boolean(voucher?.covered),
      });

      if (result?.error) {
        console.warn('Booking tersimpan ke fallback riwayat:', result.error);
      }

      await refetchActivities?.();
      goTo(returnTo || 'profile');
      setPaymentPayload(null);
      setReturnTo(null);
      return;
    }

    goTo(returnTo || 'home');
    setPaymentPayload(null);
    setReturnTo(null);
  };

  // Booking → payment
  const startBookingPayment = (venue, slot, date) => {
    requireAuthThen(() => {
      addItemToCart({
        type: 'booking',
        amount: venue.price,
        venueId: venue.id,
        venueCity: venue.city,
        sport: venue.sport,
        bookingDate: date,
        bookingTime: slot,
        durationHours: 1,
        itemName: venue.name,
        itemSub: `${date} · ${slot} · 1 jam`,
      });
    });
  };

  // Coach → payment
  const startCoachPayment = ({ coach, program, time, date }) => {
    requireAuthThen(() => {
      addItemToCart({
        type: 'coaching',
        amount: program?.price || coach.price,
        itemName: program?.name || 'Sesi Privat',
        itemSub: `${coach.name}${time ? ` · ${date} ${time}` : ''}`,
      });
    });
  };

  return (
    <div className="min-h-screen" style={{ background: '#F4F4F4', color: '#0A0A0A' }}>
      <FontStyles />
      <Header
        current={page}
        onNav={goTo}
        auth={auth}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
        onCart={() => requireAuthThen(() => goTo('cart'))}
        onSwitchContext={handleSwitchContext}
        gamificationStats={gamificationStats}
        statsLoading={gamificationLoading}
        communityNotifications={communityNotifications}
        communityUnreadById={communityUnreadById}
        onOpenCommunityNotification={handleOpenCommunityNotification}
        cartCount={cartItems.length}
      />
      {(!SUPABASE_CONFIGURED || SUPABASE_ERROR) && (
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 bg-amber-100 border border-amber-300 text-amber-900 text-sm rounded-b-3xl">
          <div className="font-semibold">Supabase belum terkonfigurasi dengan benar.</div>
          <div>Pastikan <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> sudah diset di <code>.env.local</code> atau environment variables Vercel.</div>
          {SUPABASE_ERROR && (
            <div className="mt-2 text-xs text-neutral-800">Error: {SUPABASE_ERROR}</div>
          )}
        </div>
      )}
      <main>
        {page === 'home' && <HomePage onNav={goTo} venues={VENUES_DATA} tournaments={TOURNAMENTS_DATA} news={NEWS_DATA} coaches={COACHES_DATA} />}
        {page === 'booking' && <BookingPage onSelect={(v) => goTo('booking-detail', v)} venues={VENUES_DATA} />}
        {page === 'booking-detail' && bookingDetail && (
          <BookingDetail
            venue={bookingDetail}
            onBack={() => goTo('booking')}
            onPay={startBookingPayment}
          />
        )}
        {page === 'tournament' && <TournamentPage onSelect={(t) => goTo('tournament-detail', t)} onCreate={() => goTo('create-tournament')} tournaments={TOURNAMENTS_DATA} />}
        {page === 'tournament-detail' && tournamentDetail && <TournamentDetail tournament={tournamentDetail} onBack={() => goTo('tournament')} tab={tab} setTab={setTab} auth={auth} openAuth={openAuth} />}
        {page === 'community' && (
          <Suspense fallback={<LazyFallback label="Memuat komunitas..." />}>
            <CommunityDiscoveryPage auth={auth} openAuth={openAuth} onSelectCommunity={(community) => goTo('community-detail', community)} />
          </Suspense>
        )}
        {page === 'community-detail' && communityDetail && (
          <Suspense fallback={<LazyFallback label="Memuat detail komunitas..." />}>
            <CommunityDetailPage
              communityId={communityDetail?.id}
              initialCommunity={communityDetail}
              auth={auth}
              openAuth={openAuth}
              onBack={() => goTo('community')}
              onSelectCommunity={(community) => goTo('community-detail', community)}
              onCommunityNotification={handleCommunityNotification}
              onCommunityRead={handleCommunityRead}
            />
          </Suspense>
        )}
        {page === 'create-tournament' && (
          <CreateTournamentWizard
            onBack={() => goTo('tournament')}
            onPublished={(d) => goTo('tournament-published', d)}
          />
        )}
        {page === 'tournament-published' && publishedTournament && (
          <PublishedSuccess
            data={publishedTournament}
            onView={() => goTo('tournament')}
            onHome={() => goTo('home')}
          />
        )}
        {page === 'news' && <NewsPage onSelect={(a) => goTo('news-detail', a)} news={NEWS_DATA} />}
        {page === 'news-detail' && articleDetail && <ArticleDetail article={articleDetail} onBack={() => goTo('news')} onSelect={(a) => goTo('news-detail', a)} auth={auth} openAuth={openAuth} newsList={NEWS_DATA} />}
        {page === 'profile' && <ProfilePage auth={auth} stats={gamificationStats} currentTier={currentTier} nextTier={nextTier} progressPercentage={progressPercentage} pointsToNextTier={pointsToNextTier} activities={activities} loading={activitiesLoading} onBack={() => goTo('home')} onNav={goTo} onAuthChange={setAuth} />}
        {page === 'cart' && (
          <CartPage
            auth={auth}
            cartItems={cartItems}
            transactionHistory={transactionHistory}
            invoiceEntries={invoiceEntries}
            sendingInvoice={sendingInvoice}
            invoiceNotice={invoiceNotice}
            onCheckoutItem={handleCheckoutFromCart}
            onRemoveItem={(itemId) => setCartItems((prev) => prev.filter((item) => item.id !== itemId))}
            onSendSingleInvoice={handleSendSingleInvoice}
            onSendAllInvoices={handleSendAllInvoices}
            onBack={() => goTo('home')}
          />
        )}
        {page === 'training' && (
          <Suspense fallback={<div className="p-8 text-center text-neutral-500">Memuat training ecosystem...</div>}>
            <TrainingEcosystem
              auth={auth}
              openAuth={openAuth}
              onCoachDashboard={() => auth ? goTo('coach-dashboard') : openAuth('login')}
              onCoachSelect={(c) => goTo('coach-profile', c)}
              coaches={COACHES_DATA}
              initialSection={trainingSection}
              onSectionChange={setTrainingSection}
            />
          </Suspense>
        )}
        {page === 'coach-profile' && coachDetail && (
          <CoachProfile
            coach={coachDetail}
            onBack={() => goTo('training')}
            onChat={(c) => requireAuthThen(() => goTo('chat', CHATS_DATA.find(x => x.coachId === c.id)?.id || CHATS_DATA[0]?.id))}
            onBook={(p) => startCoachPayment(p)}
          />
        )}
        {page === 'coach-dashboard' && <CoachDashboard onBack={() => goTo('home')} auth={auth} />}
        {page === 'platform-console' && renderAccessControlledPage('platform-console', <PlatformDashboard auth={auth} onBack={() => goTo('profile')} onNav={goTo} />, 'Memuat platform console...')}
        {page === 'newsroom' && renderAccessControlledPage('newsroom', <NewsroomPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat newsroom...')}
        {page === 'moderation' && renderAccessControlledPage('moderation', <ModerationPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat moderation queue...')}
        {page === 'analytics' && renderAccessControlledPage('analytics', <AnalyticsPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat analytics...')}
        {page === 'admin-verification-queue' && renderAccessControlledPage('admin-verification-queue', <VerificationQueuePage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat verification queue...')}
        {page === 'user-management' && renderAccessControlledPage('user-management', <UserManagementPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat user management...')}
        {page === 'platform-promo' && renderAccessControlledPage('platform-console', <PlatformPromoPage auth={auth} onBack={() => goTo('platform-console')} />, 'Memuat promo platform...')}
        {page === 'sponsor-promo' && <SponsorPromoPage auth={auth} onBack={() => goTo('platform-console')} />}
          {page === 'kerjasama' && <Suspense fallback={<div className="p-8 text-center text-neutral-500">Memuat halaman kerjasama...</div>}><PartnershipPage auth={auth} onBack={() => goTo('home')} /></Suspense>}
        {page === 'workspace-console' && renderAccessControlledPage('workspace-console', <WorkspaceConsolePage auth={auth} onBack={() => goTo('profile')} onNav={goTo} />, 'Memuat workspace console...')}
        {page === 'community-manager' && renderAccessControlledPage('community-manager', <CommunityManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat community manager...')}
        {page === 'sponsor-manager' && renderAccessControlledPage('sponsor-manager', <SponsorManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat sponsor manager...')}
        {page === 'tournament-manager' && renderAccessControlledPage('tournament-manager', <TournamentManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat tournament manager...')}
        {page === 'training-manager' && renderAccessControlledPage('training-manager', <TrainingManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat training manager...')}
        {page === 'venue-manager' && renderAccessControlledPage('venue-manager', <VenueManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat venue manager...')}
        {page === 'venue-registration' && renderAccessControlledPage('venue-registration', <VenueRegistrationPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat venue registration...')}
        {page === 'venue-workspace' && renderAccessControlledPage('venue-workspace', <VenueWorkspacePage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat venue workspace...')}
        {page === 'official-center' && renderAccessControlledPage('official-center', <OfficialCenterPage auth={auth} onBack={() => goTo('profile')} onNav={goTo} />, 'Memuat official center...')}
        {page === 'official-schedule' && renderAccessControlledPage('official-schedule', <OfficialSchedulePage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} />, 'Memuat jadwal official...')}
        {page === 'match-center' && renderAccessControlledPage('match-center', <MatchCenterPage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} matchContext={matchContext} />, 'Memuat match center...', { matchContext })}
        {page === 'match-report' && renderAccessControlledPage('match-report', <MatchReportPage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} matchContext={matchContext} />, 'Memuat match report...', { matchContext })}
        {page === 'match-statistics' && renderAccessControlledPage('match-statistics', <MatchStatisticsPage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} matchContext={matchContext} />, 'Memuat match statistics...', { matchContext })}
        {page === 'payment' && paymentPayload && (
          <PaymentPage
            payload={paymentPayload}
            onBack={() => goTo(returnTo || 'home')}
            onSuccess={handlePaymentSuccess}
          />
        )}
        {page === 'chat' && (
          <ChatPage
            initialChatId={chatInitial}
            onBack={() => goTo('home')}
            chats={CHATS_DATA}
          />
        )}
      </main>
      {page !== 'chat' && (
        <Footer onNav={goTo} onCoachDashboard={() => auth ? goTo('coach-dashboard') : openAuth('login')} />
      )}
      <LoginModal
        open={showAuth}
        mode={authMode}
        initialError={authInitialError}
        onClose={() => {
          setShowAuth(false);
          setAuthInitialError('');
        }}
        onAuth={handleAuth}
      />
    </div>
  );
}
