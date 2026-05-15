import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, MapPin, Star, Users, Trophy, Newspaper, Dumbbell, Building2,
  ChevronRight, Filter, Search, Clock, Zap, Plus, Award,
  ArrowRight, ArrowUpRight, Target, Flame, BookOpen, ShieldCheck,
  TrendingUp, Play, Menu, X, CheckCircle, Bell, Eye,
  Wifi, Car, Coffee, Volleyball, Gamepad2, Activity,
  Circle, Sparkles, ChevronDown, MoveRight,
  LogOut, User, MessageSquare, Wallet, BarChart3,
  Edit3, ArrowLeft, MessageCircle, ChevronLeft, Settings,
  Twitter, Facebook, Linkedin, Share2, Bookmark, Check
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
import { fetchCurrentUserActiveContext, fetchCurrentUserPermissions, fetchCurrentUserRoleProfiles, fetchCurrentUserRoles, recordVenueBooking, recordActivityToLog, switchCurrentUserActiveContext } from './src/services/supabaseService.js';
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
const TeamWorkspaceModal = lazy(() => import('./src/components/TeamWorkspaceModal.jsx'));

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

const NEWS = [
  { id: 1, category: 'Sepakbola', title: 'Timnas U-23 Cetak Sejarah, Lolos Final Piala AFF', excerpt: 'Garuda Muda menundukkan Vietnam 2-1 lewat gol dramatis di babak tambahan.', author: 'Rendy Pratama', date: '07 Mei 2026', read: '4 mnt', featured: true, color: '#E11D2E' },
  { id: 2, category: 'Futsal', title: 'Liga Futsal Profesional Resmi Bergulir Bulan Depan', excerpt: 'Format baru, 16 klub, hadiah total 2 miliar rupiah.', author: 'Maya Hartono', date: '06 Mei 2026', read: '3 mnt', color: '#92400E' },
  { id: 3, category: 'Badminton', title: 'Jonatan Christie Juara Singapore Open 2026', excerpt: 'Comeback dramatis dari set pertama untuk mengamankan gelar.', author: 'Bagas Nurhakim', date: '05 Mei 2026', read: '5 mnt', color: '#B91C1C' },
  { id: 4, category: 'Padel', title: 'Demam Padel Indonesia: 200+ Klub Baru di 2026', excerpt: 'Olahraga raket asal Spanyol ini meledak popularitasnya.', author: 'Sarah Kusuma', date: '04 Mei 2026', read: '6 mnt', color: '#1F3A8A' },
  { id: 5, category: 'Esports', title: 'MPL Season 13 Catat Penonton Tertinggi Sepanjang Sejarah', excerpt: 'Final EVOS vs RRQ tembus 5 juta concurrent viewers.', author: 'Dimas Pradana', date: '04 Mei 2026', read: '4 mnt', color: '#7C3AED' },
  { id: 6, category: 'Tennis', title: 'Indonesia Open Tennis Datangkan Pemain Top 50 Dunia', excerpt: 'Turnamen ATP Challenger tahun ini lebih bergengsi.', author: 'Lisa Andriani', date: '03 Mei 2026', read: '3 mnt', color: '#15803D' },
  { id: 7, category: 'Renang', title: 'Atlet Renang Nasional Pecahkan Rekor Asia 200m Gaya Bebas', excerpt: 'Catatan baru di kejuaraan terbuka di Tokyo.', author: 'Aldi Surya', date: '02 Mei 2026', read: '4 mnt', color: '#0E7490' },
];

const COACHES = [
  { id: 1, name: 'Coach Bambang Sutrisno', sport: 'Sepakbola', exp: 12, rating: 4.9, sessions: 234, price: 250000, certs: ['AFC C-License', 'Mantan Pemain Persija'], initial: 'BS' },
  { id: 2, name: 'Coach Ratna Dewi', sport: 'Renang', exp: 8, rating: 4.8, sessions: 412, price: 180000, certs: ['SI Pelatih Nasional', 'Olimpiade 2016'], initial: 'RD' },
  { id: 3, name: 'Coach Andre Wijaya', sport: 'Padel', exp: 6, rating: 5.0, sessions: 89, price: 350000, certs: ['Padel Pro Spain', 'Top 100 ATP Padel'], initial: 'AW' },
  { id: 4, name: 'Coach Dewi Lestari', sport: 'Badminton', exp: 15, rating: 4.9, sessions: 567, price: 220000, certs: ['PB Djarum Alumni', 'BWF Coach Level 2'], initial: 'DL' },
  { id: 5, name: 'Coach Rizky Pratama', sport: 'Futsal', exp: 9, rating: 4.7, sessions: 178, price: 200000, certs: ['AFC Futsal C-License'], initial: 'RP' },
  { id: 6, name: 'Coach Maria Santoso', sport: 'Tennis', exp: 11, rating: 4.8, sessions: 290, price: 280000, certs: ['ITF Level 2', 'Ex-Davis Cup Coach'], initial: 'MS' },
  { id: 7, name: 'Coach Hendra Kurniawan', sport: 'Pingpong', exp: 7, rating: 4.6, sessions: 145, price: 150000, certs: ['ITTF Level 1', 'PORDA Champion'], initial: 'HK' },
  { id: 8, name: 'Coach Galih Eka', sport: 'Esports', exp: 5, rating: 4.9, sessions: 412, price: 120000, certs: ['Mythic Glory ML', 'Coach RRQ Hoshi'], initial: 'GE' },
];

const SPORTS_BOOK = ['Semua', 'Sepakbola', 'Futsal', 'Renang', 'Padel'];
const SPORTS_TOURNEY = ['Semua', 'Sepakbola', 'Futsal', 'Badminton', 'Pingpong', 'Tennis', 'Padel', 'Esports'];
const SPORTS_COACH = ['Semua', 'Sepakbola', 'Futsal', 'Renang', 'Padel', 'Badminton', 'Tennis', 'Pingpong', 'Esports'];

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
const Header = ({ current, onNav, auth, onOpenAuth, onLogout, onChat, onSwitchContext, gamificationStats, statsLoading }) => {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const items = [
    { id: 'booking', label: 'Booking Lapangan' },
    { id: 'tournament', label: 'Turnamen & Liga' },
    { id: 'news', label: 'Berita' },
    { id: 'training', label: 'Pelatihan' },
  ];
  const totalUnread = CHATS.reduce((s, c) => s + (c.unread || 0), 0);
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
                onClick={onChat}
                className="relative p-2.5 hover:bg-neutral-200 rounded-full"
                title="Pesan"
              >
                <MessageCircle size={18} />
                {totalUnread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#E11D2E' }}>
                    {totalUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-neutral-200 hover:border-neutral-400"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm text-white" style={{ background: '#E11D2E' }}>
                  {auth.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="text-sm font-bold hidden md:inline">{auth.name.split(' ')[0]}</span>
                <ChevronDown size={14} />
              </button>
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
                      {auth?.activeContext?.context_scope && (
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                          Context aktif: {auth.activeContext.context_scope}
                        </div>
                      )}
                    </div>
                    <div className="py-2">
                      {contextOptions.length > 1 && (
                        <div className="px-4 pb-2 border-b border-neutral-100">
                          <div className="pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Context</div>
                          <div className="flex gap-1.5 flex-wrap">
                            {contextOptions.map((option) => {
                              const Icon = option.icon;
                              const isActive = activeScope === option.scope;

                              return (
                                <button
                                  key={option.scope}
                                  onClick={() => handleContextSelection(option.scope, option.page)}
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold border transition ${
                                    isActive
                                      ? 'bg-neutral-900 text-white border-neutral-900'
                                      : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500'
                                  }`}
                                >
                                  <Icon size={12} /> {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Account</div>
                      <button onClick={() => { onNav('profile'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <User size={14} /> Profil Saya
                      </button>
                      <button onClick={() => { onChat(); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3 justify-between">
                        <span className="flex items-center gap-3"><MessageCircle size={14} /> Pesan</span>
                        {totalUnread > 0 && <span className="text-[10px] font-bold text-white px-1.5 rounded-full" style={{ background: '#E11D2E', minWidth: 18, height: 18, lineHeight: '18px' }}>{totalUnread}</span>}
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <Bell size={14} /> Notifikasi
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <Settings size={14} /> Pengaturan
                      </button>

                      <div className="mt-2 pt-2 border-t border-neutral-100">
                        <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Aktivitas</div>
                        <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                          <Calendar size={14} /> Booking Saya
                        </button>
                        <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                          <Trophy size={14} /> Turnamen Saya
                        </button>
                        <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                          <Users size={14} /> Komunitas Saya
                        </button>
                        <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                          <Dumbbell size={14} /> Pelatihan Saya
                        </button>
                        {contextAccess.official && (
                          <button onClick={() => { onNav('official-schedule'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <ShieldCheck size={14} /> Jadwal Saya
                          </button>
                        )}
                      </div>

                      {contextAccess.workspace && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Workspace</div>
                          <button onClick={() => { onNav('tournament-manager'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <Trophy size={14} /> Kelola Turnamen
                          </button>
                          <button onClick={() => { onNav('community-manager'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <Users size={14} /> Kelola Komunitas
                          </button>
                          <button onClick={() => { onNav('training-manager'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <Dumbbell size={14} /> Kelola Pelatihan
                          </button>
                          <button onClick={() => { onNav('venue-workspace'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <MapPin size={14} /> Kelola Venue
                          </button>
                          <button onClick={() => { onNav('sponsor-manager'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <Wallet size={14} /> Kelola Sponsor
                          </button>
                        </div>
                      )}

                      {contextAccess.official && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Official</div>
                          <button onClick={() => { onNav('official-schedule'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                            <Calendar size={14} /> Jadwal Pertandingan
                          </button>
                          {officialCapabilities.openMatchCenter && (
                            <button onClick={() => { onNav('match-center'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                              <Activity size={14} /> Match Center
                            </button>
                          )}
                          {officialCapabilities.openMatchReport && (
                            <button onClick={() => { onNav('match-report'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                              <BookOpen size={14} /> Laporan Pertandingan
                            </button>
                          )}
                          {officialCapabilities.openMatchStatistics && (
                            <button onClick={() => { onNav('match-statistics'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                              <BarChart3 size={14} /> Statistik Pertandingan
                            </button>
                          )}
                        </div>
                      )}

                      {consoleItems.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <div className="px-4 pb-1 text-[10px] uppercase tracking-[0.22em] font-bold text-neutral-400">Platform</div>
                          {consoleItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button key={item.id} onClick={() => { onNav(item.id); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                                <Icon size={14} /> {item.label}
                              </button>
                            );
                          })}
                          {contextAccess.platform && (
                            <>
                              <button onClick={() => { onNav('admin-verification-queue'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                                <ShieldCheck size={14} /> Verifikasi
                              </button>
                              <button onClick={() => { onNav('moderation'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                                <Sparkles size={14} /> Moderasi
                              </button>
                              <button onClick={() => { onNav('newsroom'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                                <Newspaper size={14} /> Newsroom
                              </button>
                              <button onClick={() => { onNav('analytics'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                                <BarChart3 size={14} /> Analytics
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="mt-2 pt-2 border-t border-neutral-100">
                        <button onClick={() => { onNav('coach-dashboard'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                          <BarChart3 size={14} /> Dashboard Pelatih
                        </button>
                      </div>
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
                onClick={() => { onChat(); setOpen(false); }}
                className="block w-full text-left px-5 py-3.5 text-sm font-semibold border-b border-neutral-200"
              >
                Pesan {totalUnread > 0 && <span className="ml-2 text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#E11D2E' }}>{totalUnread}</span>}
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
  const features = [
    { id: 'booking', label: 'BOOKING LAPANGAN', desc: 'Sepakbola, futsal, renang, padel — pesan slot dalam hitungan detik.', count: '500+ Venue', icon: MapPin },
    { id: 'tournament', label: 'TURNAMEN & LIGA', desc: 'Buat turnamen sendiri atau ikut liga dengan klasemen otomatis.', count: '120+ Aktif', icon: Trophy },
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
          {(news && news.length > 0 ? news : NEWS).slice(1, 4).map((n) => (
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
  const featured = (news && news.length > 0 ? news : NEWS).find(n => n.featured);
  const rest = (news && news.length > 0 ? news : NEWS).filter(n => !n.featured);
  const [cat, setCat] = useState('Semua');
  const cats = ['Semua', ...new Set((news && news.length > 0 ? news : NEWS).map(n => n.category))];
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
            <li><button onClick={() => onNav('news')} className="text-neutral-300 hover:text-white">Berita</button></li>
            <li><button onClick={() => onNav('training')} className="text-neutral-300 hover:text-white">Pelatihan</button></li>
            <li><button onClick={onCoachDashboard} className="text-[#E11D2E] hover:text-white font-bold">Dashboard Pelatih →</button></li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <div className="text-xs uppercase tracking-wider font-bold text-neutral-500 mb-4">Perusahaan</div>
          <ul className="space-y-2 text-sm">
            <li><span className="text-neutral-300">Tentang Kami</span></li>
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
const AUTH_OAUTH_TIMEOUT_MS = 30000; // OAuth: 30s (external services)
const AUTH_FORGOT_PASSWORD_TIMEOUT_MS = 45000; // Reset password email

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
  const isVercelPreviewHost = hostname.endsWith('.vercel.app') && hostname !== 'stadione.vercel.app';
  const baseOrigin = isVercelPreviewHost
    ? 'https://stadione.vercel.app'
    : window.location.origin;

  const url = new URL(baseOrigin);
  if (mode) url.searchParams.set('auth_mode', mode);
  return url.toString();
}

function getAuthModeFromUrl() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('auth_mode') || null;
}

function hasRecoveryParamsInUrl() {
  const params = getAuthUrlParams();
  const type = String(params.get('type') || '').toLowerCase();

  return (
    type === 'recovery' ||
    params.has('recovery_token') ||
    params.has('access_token')
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
  
  // OAuth
  if (message.includes('oauth') || message.includes('google')) 
    return 'Login Google gagal. Coba login dengan email.';
  
  return rawMessage || 'Terjadi kesalahan. Silakan coba lagi.';
}

async function getSupabaseAuthClient() {
  if (!SUPABASE_CONFIGURED || !supabase?.auth) {
    throw new Error(SUPABASE_ERROR || 'Supabase belum dikonfigurasi. Login belum bisa digunakan.');
  }

  return supabase;
}

async function withAuthTimeout(promise, label = 'Auth request', timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  // OPTIMIZED: Use adaptive timeout based on connection quality
  const adaptiveTimeoutMs = getAdaptiveAuthTimeout(timeoutMs);
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

async function signInWithPasswordFallback({ email, password }) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    throw new Error(payload?.error_description || payload?.msg || 'Login gagal. Silakan coba lagi.');
  }

  const sessionResult = await withAuthTimeout(
    supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    }),
    'Set auth session'
  );

  if (sessionResult?.error) throw sessionResult.error;

  const userResult = await withAuthTimeout(supabase.auth.getUser(), 'Fetch auth user');
  if (userResult?.error) throw userResult.error;

  return { user: userResult?.data?.user || sessionResult?.data?.user || null };
}

function mapAuthUser(user) {
  if (!user) return null;

  const normalizedRoles = normalizeRoles(Array.isArray(user.roles) ? user.roles : []);
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  return {
    name: user.user_metadata?.name || user.name || user.email?.split('@')[0] || 'User',
    email: user.email || user.registrant_email || '',
    id: user.id,
    roles: normalizedRoles,
    roleBadges: getUserRoleBadges(normalizedRoles, user.roleProfiles || []),
    activeContext: user.activeContext || null,
    permissions,
    access: user.access || deriveConsoleAccess(normalizedRoles, permissions),
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
    const [roleProfiles, allRoles, permissions, activeContext] = await Promise.all([
      fetchCurrentUserRoleProfiles(),
      fetchCurrentUserRoles(),
      fetchCurrentUserPermissions(),
      fetchCurrentUserActiveContext(),
    ]);

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
      permissions,
      access: deriveConsoleAccess(effectiveRoles, permissions),
    };

    // Cache the enriched user
    authSessionCache.set(mappedUser.id, enrichedUser);
    cacheAuthStateLocally(mappedUser.id, enrichedUser);

    authPerfTracker.end(perfLabel, { roles: effectiveRoles.length, cached: false });

    return enrichedUser;
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

    try {
      const supabase = await getSupabaseAuthClient();

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
      let signInError = null;

      try {
        console.log('Login: Trying Supabase signInWithPassword...');
        const signInResult = await withAuthTimeout(
          supabase.auth.signInWithPassword({
            email: emailValidation.value,
            password: passwordValidation.value,
          }),
          'Login',
          AUTH_REQUEST_TIMEOUT_MS
        );
        data = signInResult?.data;
        signInError = signInResult?.error || null;
      } catch (signInTimeoutError) {
        if (!isTimeoutError(signInTimeoutError)) throw signInTimeoutError;

        console.warn('Login: Primary request timed out, trying fallback API...');
        try {
          const fallbackResult = await withAuthTimeout(
            signInWithPasswordFallback({
              email: emailValidation.value,
              password: passwordValidation.value,
            }),
            'Login (fallback)',
            AUTH_FALLBACK_TIMEOUT_MS
          );
          data = fallbackResult;
        } catch (fallbackError) {
          if (isTimeoutError(fallbackError)) {
            throw new Error('Koneksi lambat. Cek internet dan coba lagi.');
          }
          throw fallbackError;
        }
      }

      if (signInError) throw signInError;
      if (!data || !data.user) throw new Error('Email atau password tidak cocok.');

      onAuth(mapAuthUser(data.user));
      clearAuthUrlArtifacts();
      onClose();
    } catch (err) {
      console.error('Auth error:', err);
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
const ArticleDetail = ({ article, onBack, onSelect, auth, openAuth }) => {
  const related = NEWS.filter(n => n.id !== article.id && n.category === article.category).slice(0, 3);
  const fallback = NEWS.filter(n => n.id !== article.id).slice(0, 3);
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

const ProfilePage = ({ auth, stats, currentTier, nextTier, progressPercentage, pointsToNextTier, activities, loading, onBack, onNav }) => {
  const consoleItems = auth ? [
    auth?.access?.platform && { key: 'platform-console', title: 'Platform Console', sub: 'Newsroom, moderasi, analytics, verifikasi', icon: BarChart3 },
    auth?.access?.workspace && { key: 'workspace-console', title: 'Workspace Console', sub: 'Turnamen, komunitas, venue, sponsor, training', icon: Building2 },
    auth?.access?.official && { key: 'official-center', title: 'Official Center', sub: 'Jadwal tugas, match center, laporan, statistik', icon: ShieldCheck },
  ].filter(Boolean) : [];

  return (
    <div className="bg-white min-h-screen">
      <button onClick={onBack} className="max-w-7xl mx-auto px-5 lg:px-8 pt-6 flex items-center gap-2 text-sm font-bold text-neutral-700 hover:text-[#E11D2E]">
        <ArrowLeft size={14} /> Kembali
      </button>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 space-y-8">
        <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6">
          <div className="rounded-3xl border border-neutral-200 bg-[#F8FAFC] p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-[#E11D2E] text-white flex items-center justify-center font-display text-3xl">
                {auth?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Profil Gamer</div>
                <div className="font-display text-3xl text-neutral-900">{auth?.name || 'Pengguna'}</div>
                <div className="text-sm text-neutral-500">{auth?.email || 'Belum login'}</div>
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
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
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

          <div className="rounded-3xl border border-neutral-200 bg-white p-8">
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Ringkasan Pencapaian</div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#FEF3C7] p-4">
                <div className="text-sm font-semibold text-amber-800">Tier Saat Ini</div>
                <div className="text-2xl font-bold text-neutral-900">{stats?.tier_level || currentTier?.name}</div>
              </div>
              <div className="rounded-2xl bg-[#EEF2FF] p-4">
                <div className="text-sm font-semibold text-indigo-800">Poin Total</div>
                <div className="text-2xl font-bold text-neutral-900">{stats?.points ?? 0}</div>
              </div>
              <div className="rounded-2xl bg-[#ECFDF5] p-4">
                <div className="text-sm font-semibold text-emerald-800">Koin Total</div>
                <div className="text-2xl font-bold text-neutral-900">{stats?.coins ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        {auth && consoleItems.length > 0 && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Mode Operasional</div>
                <h2 className="font-display text-2xl text-neutral-900">Pusat Kerja Internal</h2>
              </div>
              <div className="text-sm text-neutral-500">Masuk ke console yang sedang Anda kerjakan.</div>
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
      </div>
    </div>
  );
};

// ============ PAYMENT ============
const PaymentPage = ({ payload, onBack, onSuccess }) => {
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [dokuLoading, setDokuLoading] = useState(false);
  const [dokuError, setDokuError] = useState('');

  const serviceFee = payload?.type === 'booking' ? 500 : 5000;
  const subtotal = (payload?.amount || 0) + serviceFee;
  const finalTotal = Math.max(1, subtotal + promoDiscount);

  const handleValidatePromo = async () => {
    setPromoError('');
    if (!promoCode.trim()) {
      setPromoDiscount(0);
      return;
    }

    try {
      const normalizedCode = promoCode.trim().toLowerCase();
      console.log('Validating promo code:', normalizedCode);
      
      const { data: promos, error } = await supabase
        .from('promo_codes')
        .select('discount_amount, discount_percent, active')
        .eq('code', normalizedCode)
        .eq('active', true);

      console.log('Promo query result:', { promos, error });

      if (error) {
        console.error('Promo query error:', error);
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

      const discount = promo.discount_amount || (subtotal * (promo.discount_percent || 0) / 100);
      setPromoDiscount(discount);
      setPromoError('');
      console.log('Promo valid! Discount:', discount);
    } catch (err) {
      console.error('Promo validation error:', err);
      setPromoError('Gagal memvalidasi kode promo. ' + (err?.message || ''));
      setPromoDiscount(0);
    }
  };

  const handleDokuCheckout = async () => {
    if (dokuLoading) return;
    setDokuError('');

    if (payload?.type !== 'booking') {
      setDokuError('Checkout DOKU saat ini hanya tersedia untuk booking venue.');
      return;
    }

    if (!payload?.venueId || !payload?.amount) {
      setDokuError('Data booking belum lengkap, silakan ulangi pemilihan jadwal.');
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
        throw new Error(error.message || 'Gagal memanggil DOKU checkout.');
      }

      const checkoutUrl = data?.checkout_url || data?.transaction?.checkout_url;
      if (!checkoutUrl) {
        throw new Error('DOKU checkout URL tidak ditemukan dari response.');
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setDokuError(err?.message || 'Gagal membuka halaman pembayaran DOKU.');
    } finally {
      setDokuLoading(false);
    }
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
                  disabled={dokuLoading}
                  className="w-full py-4 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#E11D2E' }}
                >
                  {dokuLoading ? 'Membuka DOKU Checkout...' : 'Bayar via DOKU'} <ArrowUpRight size={16} strokeWidth={3} />
                </button>
                {dokuError && <div className="mt-3 text-xs text-red-600 text-center">{dokuError}</div>}

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
  const [tournamentDetail, setTournamentDetail] = useState(null);
  const [matchContext, setMatchContext] = useState(null);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [articleDetail, setArticleDetail] = useState(null);
  const [publishedTournament, setPublishedTournament] = useState(null);
  const [coachDetail, setCoachDetail] = useState(null);
  const [paymentPayload, setPaymentPayload] = useState(null);
  const [chatInitial, setChatInitial] = useState(null);
  const [tab, setTab] = useState('klasemen');
  const [returnTo, setReturnTo] = useState(null);

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

  const handleAuth = useCallback(async (user) => {
    // OPTIMIZED: Invalidate cache when user logs in
    if (user?.id) {
      clearAuthStateCache(user.id);
      authSessionCache.invalidate(user.id);
    }
    const nextAuth = await enrichAuthUser(user);
    setAuth(nextAuth);
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
          async (event, currentSession) => {
            if (event === 'PASSWORD_RECOVERY') {
              setAuthMode(AUTH_MODAL_MODES.recovery);
              setAuthInitialError('');
              setShowAuth(true);
              return;
            }

            if (currentSession?.user) {
              const nextAuth = await enrichAuthUser(currentSession.user);
              setAuth(nextAuth);
              const recoveryFlowActive =
                getAuthModeFromUrl() === AUTH_MODAL_MODES.recovery ||
                hasRecoveryParamsInUrl();

              if (event === 'SIGNED_IN' && !recoveryFlowActive) {
                clearAuthUrlArtifacts();
                setShowAuth(false);
                setAuthInitialError('');
              }
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
          const nextAuth = await enrichAuthUser(session.user);
          setAuth(nextAuth);
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
  }, [devOfficialBypass, devOfficialBypassPage]);

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
  
  // Fallback to hardcoded data if Supabase is not available
  const VENUES_DATA = venues.length > 0 ? venues : [];
  const TOURNAMENTS_DATA = tournaments.length > 0 ? tournaments : [];
  const NEWS_DATA = news.length > 0 ? news : [];
  const COACHES_DATA = coaches.length > 0 ? coaches : [];
  const CHATS_DATA = chats.length > 0 ? chats : [];

  const goTo = (newPage, data = null, opts = {}) => {
    if (newPage === 'tournament-detail') setTournamentDetail(data);
    if (['match-center', 'match-report', 'match-statistics'].includes(newPage)) setMatchContext(data);
    if (newPage === 'booking-detail') setBookingDetail(data);
    if (newPage === 'news-detail') setArticleDetail(data);
    if (newPage === 'tournament-published') setPublishedTournament(data);
    if (newPage === 'coach-profile') setCoachDetail(data);
    if (newPage === 'payment') setPaymentPayload(data);
    if (newPage === 'chat') setChatInitial(data);
    if (opts.returnTo !== undefined) setReturnTo(opts.returnTo);
    setPage(newPage);
    if (newPage.startsWith('tournament-detail')) setTab(tournamentDetail?.format === 'Knockout' ? 'bagan' : 'klasemen');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const renderAccessControlledPage = (allowed, node, label) => {
    if (!allowed) {
      return <AccessDeniedPage onBack={() => goTo('profile')} />;
    }

    return renderLazyPage(node, label);
  };

  const canAccessPage = (pageKey, options = {}) => {
    const allowedByRolePermission = canAccessAdminPage(pageKey, auth?.roles || [], auth?.permissions || []);
    if (!allowedByRolePermission) return false;

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
  const handlePaymentSuccess = async ({ method, total } = {}) => {
    if (paymentPayload?.type === 'booking' && auth?.id) {
      const result = await recordVenueBooking(auth.id, {
        venueId: paymentPayload.venueId,
        venueName: paymentPayload.itemName,
        venueCity: paymentPayload.venueCity,
        bookingDate: paymentPayload.bookingDate,
        bookingTime: paymentPayload.bookingTime,
        durationHours: paymentPayload.durationHours || 1,
        sport: paymentPayload.sport,
        status: 'confirmed',
        paymentMethod: method?.name,
        totalPaid: total,
      });

      if (result?.error) {
        console.warn('Booking tersimpan ke fallback riwayat:', result.error);
      }

      await refetchActivities?.();
      goTo('profile');
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
      goTo('payment', {
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
      }, { returnTo: 'booking' });
    });
  };

  // Coach → payment
  const startCoachPayment = ({ coach, program, time, date }) => {
    requireAuthThen(() => {
      goTo('payment', {
        type: 'coaching',
        amount: program?.price || coach.price,
        itemName: program?.name || 'Sesi Privat',
        itemSub: `${coach.name}${time ? ` · ${date} ${time}` : ''}`,
      }, { returnTo: 'training' });
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
        onChat={() => requireAuthThen(() => goTo('chat'))}
        onSwitchContext={handleSwitchContext}
        gamificationStats={gamificationStats}
        statsLoading={gamificationLoading}
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
        {page === 'news-detail' && articleDetail && <ArticleDetail article={articleDetail} onBack={() => goTo('news')} onSelect={(a) => goTo('news-detail', a)} auth={auth} openAuth={openAuth} />}
        {page === 'profile' && <ProfilePage auth={auth} stats={gamificationStats} currentTier={currentTier} nextTier={nextTier} progressPercentage={progressPercentage} pointsToNextTier={pointsToNextTier} activities={activities} loading={activitiesLoading} onBack={() => goTo('home')} onNav={goTo} />}
        {page === 'training' && (
          <TrainingPage
            onCoachDashboard={() => auth ? goTo('coach-dashboard') : openAuth('login')}
            onCoachSelect={(c) => goTo('coach-profile', c)}
            coaches={COACHES_DATA}
          />
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
        {page === 'platform-console' && renderAccessControlledPage(canAccessPage('platform-console'), <PlatformDashboard auth={auth} onBack={() => goTo('profile')} onNav={goTo} />, 'Memuat platform console...')}
        {page === 'newsroom' && renderAccessControlledPage(canAccessPage('newsroom'), <NewsroomPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat newsroom...')}
        {page === 'moderation' && renderAccessControlledPage(canAccessPage('moderation'), <ModerationPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat moderation queue...')}
        {page === 'analytics' && renderAccessControlledPage(canAccessPage('analytics'), <AnalyticsPage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat analytics...')}
        {page === 'admin-verification-queue' && renderAccessControlledPage(canAccessPage('admin-verification-queue'), <VerificationQueuePage auth={auth} onBack={() => goTo('platform-console')} onNav={goTo} />, 'Memuat verification queue...')}
        {page === 'workspace-console' && renderAccessControlledPage(canAccessPage('workspace-console'), <WorkspaceConsolePage auth={auth} onBack={() => goTo('profile')} onNav={goTo} />, 'Memuat workspace console...')}
        {page === 'community-manager' && renderAccessControlledPage(canAccessPage('community-manager'), <CommunityManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat community manager...')}
        {page === 'sponsor-manager' && renderAccessControlledPage(canAccessPage('sponsor-manager'), <SponsorManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat sponsor manager...')}
        {page === 'tournament-manager' && renderAccessControlledPage(canAccessPage('tournament-manager'), <TournamentManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat tournament manager...')}
        {page === 'training-manager' && renderAccessControlledPage(canAccessPage('training-manager'), <TrainingManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat training manager...')}
        {page === 'venue-manager' && renderAccessControlledPage(canAccessPage('venue-manager'), <VenueManagerPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat venue manager...')}
        {page === 'venue-registration' && <VenueRegistrationPage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />}
        {page === 'venue-workspace' && renderAccessControlledPage(canAccessPage('venue-workspace'), <VenueWorkspacePage auth={auth} onBack={() => goTo('workspace-console')} onNav={goTo} />, 'Memuat venue workspace...')}
        {page === 'official-center' && renderAccessControlledPage(canAccessPage('official-center'), <OfficialCenterPage auth={auth} onBack={() => goTo('profile')} onNav={goTo} />, 'Memuat official center...')}
        {page === 'official-schedule' && renderAccessControlledPage(canAccessPage('official-schedule'), <OfficialSchedulePage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} />, 'Memuat jadwal official...')}
        {page === 'match-center' && renderAccessControlledPage(canAccessPage('match-center', { matchContext }), <MatchCenterPage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} matchContext={matchContext} />, 'Memuat match center...')}
        {page === 'match-report' && renderAccessControlledPage(canAccessPage('match-report', { matchContext }), <MatchReportPage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} matchContext={matchContext} />, 'Memuat match report...')}
        {page === 'match-statistics' && renderAccessControlledPage(canAccessPage('match-statistics', { matchContext }), <MatchStatisticsPage auth={auth} onBack={() => goTo('official-center')} onNav={goTo} matchContext={matchContext} />, 'Memuat match statistics...')}
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
