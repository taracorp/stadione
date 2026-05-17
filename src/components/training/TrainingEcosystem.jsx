import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Filter, MapPin, Star, ChevronRight, CheckCircle, Users, Calendar,
  Trophy, Dumbbell, Shield, Award, Clock, Phone, Mail, ArrowLeft, BarChart3,
  TrendingUp, BookOpen, Target, Zap, Bell, Play, Plus, Check, X, Eye,
  ChevronDown, MessageCircle, Wallet, FileText, Activity, User, Settings,
  GraduationCap, Swords, Medal, Heart, AlertCircle, Download, Edit3,
  Building2, Layers, RefreshCw, CreditCard, Percent, ChevronLeft
} from 'lucide-react';
import {
  useTrainingAcademies,
  useTrainingCoaches,
  useTrainingPrograms,
  useTrainingEvents,
} from '../../hooks/useTrainingEcosystem.js';
import {
  registerTrainingEvent,
  enrollTrainingProgram,
  createTrainingAthleteReport,
} from '../../services/trainingEcosystemService.js';

// ─────────────── HELPERS ───────────────
const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const SPORTS = ['Semua', 'Sepakbola', 'Futsal', 'Basket', 'Badminton', 'Voli', 'Tennis', 'Padel', 'Esports'];
const AGE_CATS = ['Semua Usia', 'U-8', 'U-10', 'U-12', 'U-14', 'U-16', 'U-18', 'Senior', 'All Age'];
const PROVINCES = ['Semua Provinsi', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten', 'DIY'];
const SKILL_LEVELS = ['Semua Level', 'Beginner', 'Intermediate', 'Advanced', 'Elite'];
const TRAINING_SECTION_KEYS = new Set(['home', 'academy', 'coach', 'programs', 'events', 'athlete', 'parent', 'workspace']);

const canAccessTrainingSection = (section, auth) => {
  if (!TRAINING_SECTION_KEYS.has(section)) return true;
  if (['home', 'academy', 'coach', 'programs', 'events', 'athlete'].includes(section)) return true;

  const roles = (auth?.roles || []).map((role) => String(role || '').toLowerCase());

  if (section === 'parent') {
    if (!auth) return false;
    return roles.includes('parent')
      || roles.includes('academy_owner')
      || roles.includes('academy_admin')
      || roles.includes('super_admin')
      || roles.includes('platform_admin')
      || roles.includes('verification_admin');
  }

  if (section === 'workspace') {
    return Boolean(auth?.access?.workspace);
  }

  return true;
};

// ─────────────── MOCK DATA ───────────────
const ACADEMIES = [
  {
    id: 1, name: 'Garuda Football Academy', sport: 'Sepakbola', city: 'Jakarta Selatan',
    province: 'DKI Jakarta', coaches: 4, students: 120, ageRange: 'U-8 — U-18',
    price: 450000, rating: 4.9, reviews: 312, verified: true,
    tags: ['Kurikulum AFC', 'Rumput Sintetis', 'GPS Tracking'],
    color: '#0F4D2A', initial: 'GFA',
    schedule: 'Selasa, Kamis, Sabtu',
    desc: 'Academy sepakbola dengan kurikulum AFC berstandar internasional untuk pembinaan atlet muda.',
  },
  {
    id: 2, name: 'Elite Basketball Club Jakarta', sport: 'Basket', city: 'Jakarta Pusat',
    province: 'DKI Jakarta', coaches: 3, students: 85, ageRange: 'U-10 — Senior',
    price: 600000, rating: 4.8, reviews: 198, verified: true,
    tags: ['Indoor Court', 'Video Analysis', 'Strength & Conditioning'],
    color: '#EA580C', initial: 'EBC',
    schedule: 'Senin, Rabu, Jumat',
    desc: 'Club basket profesional dengan program pelatihan terstruktur dari junior hingga senior.',
  },
  {
    id: 3, name: 'Badminton Development Center BSD', sport: 'Badminton', city: 'Tangerang Selatan',
    province: 'Banten', coaches: 5, students: 200, ageRange: 'U-8 — U-18',
    price: 350000, rating: 4.7, reviews: 445, verified: true,
    tags: ['PB Djarum Alumni', 'Court Standar BWF', 'Dorong Ke Nasional'],
    color: '#B91C1C', initial: 'BDC',
    schedule: 'Senin, Selasa, Kamis, Sabtu',
    desc: 'Pusat pembinaan bulutangkis dengan target nasional. Sistem seleksi berbasis performa.',
  },
  {
    id: 4, name: 'Futsal Warriors Academy', sport: 'Futsal', city: 'Bekasi',
    province: 'Jawa Barat', coaches: 2, students: 60, ageRange: 'U-10 — U-18',
    price: 280000, rating: 4.6, reviews: 87, verified: false,
    tags: ['Indoor', 'Vinyl Court', 'Weekend Training'],
    color: '#7C3AED', initial: 'FWA',
    schedule: 'Sabtu, Minggu',
    desc: 'Academy futsal weekend khusus untuk pelajar. Jadwal fleksibel dan biaya terjangkau.',
  },
  {
    id: 5, name: 'Padel Academy Kemang', sport: 'Padel', city: 'Jakarta Selatan',
    province: 'DKI Jakarta', coaches: 2, students: 40, ageRange: 'All Age',
    price: 750000, rating: 5.0, reviews: 56, verified: true,
    tags: ['Certified Trainer', 'Premium Court', 'Video Replay'],
    color: '#1F3A8A', initial: 'PAK',
    schedule: 'Setiap hari tersedia',
    desc: 'Academy padel premium dengan pelatih bersertifikasi internasional.',
  },
  {
    id: 6, name: 'SSB Persib Ciamis', sport: 'Sepakbola', city: 'Ciamis',
    province: 'Jawa Barat', coaches: 3, students: 95, ageRange: 'U-8 — U-16',
    price: 200000, rating: 4.5, reviews: 134, verified: true,
    tags: ['Afiliasi Persib', 'Kompetisi Regional', 'Beasiswa Tersedia'],
    color: '#1D4ED8', initial: 'SPC',
    schedule: 'Selasa, Kamis, Sabtu',
    desc: 'SSB afiliasi Persib dengan jalur pembinaan ke level semi-profesional.',
  },
];

const COACHES_DATA = [
  {
    id: 1, name: 'Coach Bambang Sutrisno', sport: 'Sepakbola', exp: 12, rating: 4.9,
    sessions: 234, price: 250000, license: 'AFC C-License', city: 'Jakarta Selatan',
    speciality: 'Teknik & Taktik Sepakbola', online: true, group: true,
    initial: 'BS', achievements: ['Mantan Pemain Persija', 'Pelatih SSB Terbaik 2024'],
    services: ['Private coaching', 'Group coaching', 'Video analysis', 'Trial session'],
  },
  {
    id: 2, name: 'Coach Ratna Dewi', sport: 'Renang', exp: 8, rating: 4.8,
    sessions: 412, price: 180000, license: 'PRSI Level 2', city: 'Jakarta Utara',
    speciality: 'Teknik Renang & Stamina', online: false, group: true,
    initial: 'RD', achievements: ['Olimpiade 2016', 'Pelatih Nasional'],
    services: ['Private coaching', 'Group coaching', 'Trial session'],
  },
  {
    id: 3, name: 'Coach Andre Wijaya', sport: 'Padel', exp: 6, rating: 5.0,
    sessions: 89, price: 350000, license: 'FIP Level 2', city: 'Jakarta Selatan',
    speciality: 'Teknik Padel & Strategi', online: true, group: false,
    initial: 'AW', achievements: ['Top 100 ATP Padel', 'Ex-Pro Player Spanyol'],
    services: ['Private coaching', 'Trial session', 'Online consultation', 'Video analysis'],
  },
  {
    id: 4, name: 'Coach Dewi Lestari', sport: 'Badminton', exp: 15, rating: 4.9,
    sessions: 567, price: 220000, license: 'BWF Level 2', city: 'Tangerang Selatan',
    speciality: 'Footwork & Smash Teknik', online: false, group: true,
    initial: 'DL', achievements: ['PB Djarum Alumni', 'Pelatih Nasional Junior'],
    services: ['Private coaching', 'Group coaching', 'Trial session'],
  },
  {
    id: 5, name: 'Coach Rizky Pratama', sport: 'Futsal', exp: 9, rating: 4.7,
    sessions: 178, price: 200000, license: 'AFC Futsal C-License', city: 'Bekasi',
    speciality: 'Teknik Futsal & Finishing', online: true, group: true,
    initial: 'RP', achievements: ['Pelatih Liga Pro Futsal', 'Pemain Pro 8 Tahun'],
    services: ['Private coaching', 'Group coaching', 'Online consultation'],
  },
  {
    id: 6, name: 'Coach Galih Eka', sport: 'Esports', exp: 5, rating: 4.9,
    sessions: 412, price: 120000, license: 'Certified Esports Coach', city: 'Jakarta',
    speciality: 'Mobile Legends & Strategy', online: true, group: true,
    initial: 'GE', achievements: ['Mythic Glory ML', 'Ex-Coach RRQ Hoshi'],
    services: ['Private coaching', 'Online consultation', 'Video analysis'],
  },
];

const PROGRAMS = [
  {
    id: 1, name: 'Grassroots Program', type: 'Grassroots', sport: 'Sepakbola',
    academy: 'Garuda Football Academy', desc: 'Pengenalan sepakbola untuk anak usia dini. Fun & play.',
    ageRange: 'U-8 — U-10', duration: '3 bulan', sessions: '2x/minggu',
    price: 900000, color: '#0F4D2A', slots: 8, filled: 3,
  },
  {
    id: 2, name: 'Elite Development Program', type: 'Elite Program', sport: 'Sepakbola',
    academy: 'Garuda Football Academy', desc: 'Persiapan kompetisi level nasional. Kurikulum intensif AFC.',
    ageRange: 'U-14 — U-18', duration: '6 bulan', sessions: '3x/minggu',
    price: 3500000, color: '#E11D2E', slots: 4, filled: 4,
  },
  {
    id: 3, name: 'Holiday Camp Basketball', type: 'Holiday Camp', sport: 'Basket',
    academy: 'Elite Basketball Club Jakarta', desc: 'Camp intensif 5 hari untuk liburan sekolah. Full board.',
    ageRange: 'U-12 — U-18', duration: '5 hari', sessions: '2x/hari',
    price: 1200000, color: '#EA580C', slots: 20, filled: 14,
  },
  {
    id: 4, name: 'Weekend Padel Class', type: 'Weekend Training', sport: 'Padel',
    academy: 'Padel Academy Kemang', desc: 'Latihan weekend untuk profesional yang sibuk weekdays.',
    ageRange: 'All Age', duration: '1 bulan', sessions: '2x/weekend',
    price: 2000000, color: '#1F3A8A', slots: 6, filled: 2,
  },
  {
    id: 5, name: 'Goalkeeper Specialist Class', type: 'Goalkeeper Class', sport: 'Sepakbola',
    academy: 'Garuda Football Academy', desc: 'Kelas khusus kiper. Teknik reflek, distribusi bola, sweeper-keeper.',
    ageRange: 'U-12 — U-18', duration: '2 bulan', sessions: '2x/minggu',
    price: 1800000, color: '#0F4D2A', slots: 5, filled: 2,
  },
  {
    id: 6, name: 'Badminton Private Intensive', type: 'Private Training', sport: 'Badminton',
    academy: 'Badminton Development Center BSD', desc: 'Program 1-on-1 intensif untuk persiapan seleksi nasional.',
    ageRange: 'U-14 — U-18', duration: '3 bulan', sessions: '3x/minggu',
    price: 4500000, color: '#B91C1C', slots: 3, filled: 1,
  },
];

const EVENTS = [
  {
    id: 1, title: 'Coaching Clinic Sepakbola Bersama AFC Coach', type: 'Coaching Clinic',
    sport: 'Sepakbola', organizer: 'Garuda Football Academy',
    date: '25 Mei 2026', time: '08:00 — 14:00', location: 'GOR Senayan',
    price: 150000, slots: 50, registered: 38, color: '#0F4D2A',
    desc: 'Klinik eksklusif bersama pelatih berlisensi AFC. Teknik, taktik, dan mental game.',
  },
  {
    id: 2, title: 'Holiday Basketball Camp 2026', type: 'Holiday Camp',
    sport: 'Basket', organizer: 'Elite Basketball Club Jakarta',
    date: '15–19 Jun 2026', time: 'Full day', location: 'Lapangan A Senayan',
    price: 1200000, slots: 30, registered: 21, color: '#EA580C',
    desc: 'Camp 5 hari intensif selama liburan sekolah. Latihan, games, dan gala dinner.',
  },
  {
    id: 3, title: 'Talent Scouting Day — Persib Ciamis', type: 'Talent Scouting Camp',
    sport: 'Sepakbola', organizer: 'SSB Persib Ciamis',
    date: '10 Jun 2026', time: '07:00 — 12:00', location: 'Stadion Galuh, Ciamis',
    price: 0, slots: 100, registered: 67, color: '#1D4ED8',
    desc: 'Seleksi terbuka untuk atlet berbakat. Disaksikan langsung oleh tim pemandu bakat Persib.',
  },
  {
    id: 4, title: 'Open Training Day Padel', type: 'Open Training',
    sport: 'Padel', organizer: 'Padel Academy Kemang',
    date: '8 Jun 2026', time: '09:00 — 12:00', location: 'Padel Club Kemang',
    price: 75000, slots: 12, registered: 5, color: '#1F3A8A',
    desc: 'Coba main padel dengan pelatih profesional. Cocok untuk pemula yang penasaran.',
  },
  {
    id: 5, title: 'Trial Day Badminton — Free!', type: 'Trial Day',
    sport: 'Badminton', organizer: 'Badminton Development Center BSD',
    date: '1 Jun 2026', time: '07:30 — 10:00', location: 'GOR BSD City',
    price: 0, slots: 30, registered: 18, color: '#B91C1C',
    desc: 'Coba sesi latihan gratis. Temukan apakah program kami cocok untuk anakmu.',
  },
];

const ATHLETE = {
  id: 'ath-001', name: 'Aldi Surya Pratama', position: 'Gelandang Serang',
  sport: 'Sepakbola', academy: 'Garuda Football Academy',
  age: 15, height: 168, weight: 58, foot: 'Kanan',
  status: 'Elite Prospect', jersey: 10,
  stats: { matchPlayed: 24, goals: 12, assists: 9, yellowCards: 2, redCards: 0, minutesPlayed: 1840 },
  skills: { passing: 82, dribbling: 88, shooting: 79, firstTouch: 85, positioning: 76, stamina: 80 },
  attendance: { total: 96, present: 88, absent: 8, rate: 91.7 },
  reports: [
    { period: 'Apr 2026', grade: 'A', notes: 'Progres teknik dribbling luar biasa. Perlu tingkatkan positioning.', coach: 'Coach Bambang', physical: 80, technical: 88, tactical: 76, mental: 85, discipline: 90 },
    { period: 'Mar 2026', grade: 'B+', notes: 'Konsisten dalam latihan. Mulai menunjukkan jiwa kepemimpinan.', coach: 'Coach Bambang', physical: 78, technical: 82, tactical: 74, mental: 80, discipline: 88 },
    { period: 'Feb 2026', grade: 'B', notes: 'Butuh peningkatan stamina dan komunikasi lapangan.', coach: 'Coach Bambang', physical: 72, technical: 78, tactical: 71, mental: 75, discipline: 85 },
  ],
  achievements: [
    { title: 'Top Scorer', event: 'Liga Junior Jakarta 2026', icon: '⚽' },
    { title: 'MVP', event: 'Turnamen Mini Soccer Senayan', icon: '🏆' },
    { title: 'Best Young Player', event: 'Stadione Cup 2025', icon: '🌟' },
  ],
  timeline: [
    { date: 'Apr 2026', event: 'Naik ke status Elite Prospect', type: 'promotion' },
    { date: 'Mar 2026', event: 'Cetak hat-trick vs BSD Eagles', type: 'achievement' },
    { date: 'Jan 2026', event: 'Dipanggil seleksi tim kota', type: 'milestone' },
    { date: 'Jun 2025', event: 'Bergabung Garuda Football Academy', type: 'joined' },
  ],
};

const STUDENTS = [
  { id: 1, name: 'Aldi Surya', age: 15, position: 'Gelandang', status: 'Elite Prospect', attendance: 92, payment: 'Paid', lastActivity: '2 hari lalu' },
  { id: 2, name: 'Bintang Ramadhan', age: 13, position: 'Striker', status: 'Intermediate', attendance: 85, payment: 'Paid', lastActivity: '1 hari lalu' },
  { id: 3, name: 'Cahyo Nugroho', age: 14, position: 'Defender', status: 'Beginner', attendance: 78, payment: 'Overdue', lastActivity: '5 hari lalu' },
  { id: 4, name: 'Dika Pratama', age: 12, position: 'Kiper', status: 'Beginner', attendance: 95, payment: 'Paid', lastActivity: 'Hari ini' },
  { id: 5, name: 'Ekky Wijaya', age: 16, position: 'Sayap Kiri', status: 'Intermediate', attendance: 88, payment: 'Pending', lastActivity: '3 hari lalu' },
  { id: 6, name: 'Farel Ardiansyah', age: 15, position: 'Gelandang Bertahan', status: 'Elite Prospect', attendance: 97, payment: 'Paid', lastActivity: 'Hari ini' },
];

const SCHEDULE = [
  { id: 1, day: 'Selasa', date: '20 Mei 2026', time: '15:30 — 17:30', group: 'KU-14 & KU-16', coach: 'Coach Bambang', venue: 'Lapangan A', type: 'Latihan Rutin', students: 22 },
  { id: 2, day: 'Kamis', date: '22 Mei 2026', time: '15:30 — 17:30', group: 'KU-12', coach: 'Coach Arif', venue: 'Lapangan B', type: 'Latihan Rutin', students: 18 },
  { id: 3, day: 'Jumat', date: '23 Mei 2026', time: '16:00 — 18:00', group: 'Elite Program', coach: 'Coach Bambang', venue: 'Lapangan A', type: 'Latihan Intensif', students: 12 },
  { id: 4, day: 'Sabtu', date: '24 Mei 2026', time: '07:00 — 10:00', group: 'KU-8 & KU-10', coach: 'Coach Rina', venue: 'Lapangan C (Mini)', type: 'Grassroots', students: 30 },
  { id: 5, day: 'Sabtu', date: '24 Mei 2026', time: '10:00 — 12:00', group: 'KU-14', coach: 'Coach Arif', venue: 'Lapangan B', type: 'Scrimmage', students: 20 },
];

const PAYMENTS = [
  { id: 'INV-2026-0012', student: 'Aldi Surya', amount: 450000, type: 'SPP Bulanan - Mei', status: 'paid', due: '5 Mei 2026', paid: '3 Mei 2026' },
  { id: 'INV-2026-0013', student: 'Bintang Ramadhan', amount: 450000, type: 'SPP Bulanan - Mei', status: 'paid', due: '5 Mei 2026', paid: '5 Mei 2026' },
  { id: 'INV-2026-0014', student: 'Cahyo Nugroho', amount: 450000, type: 'SPP Bulanan - Mei', status: 'overdue', due: '5 Mei 2026', paid: null },
  { id: 'INV-2026-0015', student: 'Dika Pratama', amount: 450000, type: 'SPP Bulanan - Mei', status: 'paid', due: '5 Mei 2026', paid: '4 Mei 2026' },
  { id: 'INV-2026-0016', student: 'Ekky Wijaya', amount: 450000, type: 'SPP Bulanan - Mei', status: 'pending', due: '5 Mei 2026', paid: null },
  { id: 'INV-2026-0017', student: 'Farel Ardiansyah', amount: 1800000, type: 'Private Coaching - 8 Sesi', status: 'paid', due: '1 Mei 2026', paid: '30 Apr 2026' },
];

// ─────────────── BADGE COMPONENTS ───────────────
const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#E11D2E' }}>
    <Shield size={10} /> Verified
  </span>
);

const StatusBadge = ({ status }) => {
  const map = {
    paid: { label: 'Lunas', cls: 'bg-green-100 text-green-700' },
    pending: { label: 'Menunggu', cls: 'bg-yellow-100 text-yellow-700' },
    overdue: { label: 'Terlambat', cls: 'bg-red-100 text-red-700' },
    partial: { label: 'Parsial', cls: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Batal', cls: 'bg-neutral-100 text-neutral-500' },
  };
  const s = map[status] || { label: status, cls: 'bg-neutral-100 text-neutral-500' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.cls}`}>{s.label}</span>;
};

const AthleteStatusBadge = ({ status }) => {
  const map = {
    'Beginner': 'bg-neutral-100 text-neutral-700',
    'Intermediate': 'bg-blue-100 text-blue-700',
    'Elite Prospect': 'bg-amber-100 text-amber-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[status] || 'bg-neutral-100 text-neutral-600'}`}>{status}</span>;
};

// ─────────────── SKILL BAR ───────────────
const SkillBar = ({ label, value, max = 100 }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-neutral-600 font-medium">{label}</span>
      <span className="font-bold text-neutral-900">{value}</span>
    </div>
    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(value / max) * 100}%`, background: '#E11D2E' }}
      />
    </div>
  </div>
);

// ─────────────── SECTION COMPONENTS ───────────────

// 1. DISCOVER ACADEMY
const DiscoverAcademy = ({ onRegisterTrialClick, onBack, academies }) => {
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('Semua');
  const [province, setProvince] = useState('Semua Provinsi');
  const [age, setAge] = useState('Semua Usia');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selected, setSelected] = useState(null);

  const sourceAcademies = academies && academies.length > 0 ? academies : ACADEMIES;
  const filtered = useMemo(() => sourceAcademies.filter(a => {
    if (sport !== 'Semua' && a.sport !== sport) return false;
    if (province !== 'Semua Provinsi' && a.province !== province) return false;
    if (verifiedOnly && !a.verified) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [sourceAcademies, sport, province, verifiedOnly, search]);

  if (selected) {
    return (
      <div className="max-w-4xl mx-auto px-5 lg:px-8 py-10">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-6 font-semibold transition">
          <ArrowLeft size={16} /> Kembali ke Daftar Academy
        </button>
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="p-8 text-white" style={{ background: selected.color }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                {selected.initial}
              </div>
              <div>
                <div className="text-xs font-bold uppercase opacity-75 mb-1">{selected.sport}</div>
                <div className="text-2xl font-bold leading-tight">{selected.name}</div>
                <div className="flex items-center gap-2 mt-1 text-sm opacity-90">
                  <MapPin size={12} /> {selected.city} · {selected.province}
                  {selected.verified && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">✓ Verified</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="p-8">
            <p className="text-neutral-700 text-base mb-6">{selected.desc}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Siswa Aktif', val: selected.students, icon: <Users size={16} /> },
                { label: 'Pelatih', val: selected.coaches, icon: <Dumbbell size={16} /> },
                { label: 'Kategori Usia', val: selected.ageRange, icon: <GraduationCap size={16} /> },
                { label: 'Rating', val: `${selected.rating} ⭐`, icon: <Star size={16} /> },
              ].map(item => (
                <div key={item.label} className="bg-neutral-50 rounded-xl p-3 text-center">
                  <div className="text-neutral-500 flex justify-center mb-1">{item.icon}</div>
                  <div className="font-bold text-neutral-900 text-sm">{item.val}</div>
                  <div className="text-xs text-neutral-500">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mb-6">
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Jadwal Latihan</div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-neutral-400" />
                <span>{selected.schedule}</span>
              </div>
            </div>
            <div className="mb-6">
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Fasilitas & Keunggulan</div>
              <div className="flex flex-wrap gap-2">
                {selected.tags.map(t => (
                  <span key={t} className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-semibold">{t}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-neutral-100">
              <div>
                <div className="text-xs text-neutral-500 font-semibold">SPP / Bulan</div>
                <div className="text-3xl font-bold text-neutral-900">{fmt(selected.price)}</div>
              </div>
              <button
                onClick={() => onRegisterTrialClick && onRegisterTrialClick(selected)}
                className="px-6 py-3 rounded-full text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: '#E11D2E' }}
              >
                Daftar / Trial →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search & Filter */}
      <div className="bg-white border-b border-neutral-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama academy atau kota..."
                className="w-full pl-9 pr-4 py-2 rounded-full border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
              />
            </div>
            <select value={sport} onChange={e => setSport(e.target.value)} className="px-3 py-2 rounded-full border border-neutral-200 text-sm font-semibold focus:outline-none">
              {SPORTS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={province} onChange={e => setProvince(e.target.value)} className="px-3 py-2 rounded-full border border-neutral-200 text-sm font-semibold focus:outline-none">
              {PROVINCES.map(p => <option key={p}>{p}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="rounded" />
              Verified Only
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-neutral-500">{filtered.length} academy ditemukan</div>
          <div className="text-xs text-neutral-400 font-semibold">
            <Shield size={12} className="inline mr-1 text-red-500" />
            Academy terverifikasi ditandai merah
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((a, i) => (
            <div
              key={a.id}
              onClick={() => setSelected(a)}
              className="bg-white rounded-2xl border border-neutral-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="p-5 text-white relative" style={{ background: a.color }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold">
                    {a.initial}
                  </div>
                  {a.verified && <VerifiedBadge />}
                </div>
                <div className="text-xs font-bold uppercase opacity-75 mb-1">{a.sport}</div>
                <div className="font-bold text-lg leading-tight">{a.name}</div>
                <div className="text-xs mt-1 opacity-90 flex items-center gap-1">
                  <MapPin size={10} /> {a.city}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3 text-sm">
                  <span className="text-neutral-500">{a.ageRange}</span>
                  <span className="flex items-center gap-1 font-bold text-neutral-800">
                    <Star size={12} fill="#E11D2E" color="#E11D2E" /> {a.rating}
                    <span className="text-neutral-400 font-normal">({a.reviews})</span>
                  </span>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {a.tags.slice(0, 2).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-xs">{t}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
                  <div>
                    <div className="text-xs text-neutral-400">SPP / Bulan</div>
                    <div className="font-bold text-neutral-900">{fmt(a.price)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span><Users size={11} className="inline mr-0.5" />{a.students} siswa</span>
                    <ChevronRight size={14} className="text-neutral-400" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-neutral-400">
            <Building2 size={48} className="mx-auto mb-4 opacity-30" />
            <div className="font-semibold">Academy tidak ditemukan</div>
            <div className="text-sm mt-1">Coba ubah filter atau kata kunci pencarian</div>
          </div>
        )}
      </div>
    </div>
  );
};

// 2. DISCOVER COACH
const DiscoverCoach = ({ onCoachSelect, coachesData }) => {
  const [filter, setFilter] = useState('Semua');
  const [sessionType, setSessionType] = useState('Semua');
  const [search, setSearch] = useState('');

  const sourceCoaches = coachesData && coachesData.length > 0 ? coachesData : COACHES_DATA;
  const filtered = useMemo(() => sourceCoaches.filter(c => {
    if (filter !== 'Semua' && c.sport !== filter) return false;
    if (sessionType === 'Online' && !c.online) return false;
    if (sessionType === 'Group' && !c.group) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [sourceCoaches, filter, sessionType, search]);

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari pelatih..."
              className="w-full pl-9 pr-4 py-2 rounded-full border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter size={14} className="text-neutral-400 shrink-0" />
            {SPORTS.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full uppercase transition ${filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {['Semua', 'Online', 'Group'].map(t => (
              <button key={t} onClick={() => setSessionType(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition ${sessionType === t ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filtered.map((c) => (
            <div key={c.id} onClick={() => onCoachSelect && onCoachSelect(c)} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
              <div className="p-6 flex items-center gap-4 border-b border-neutral-100">
                <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white shrink-0" style={{ background: '#E11D2E' }}>
                  {c.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-neutral-900 truncate">{c.name}</div>
                  <div className="text-sm text-neutral-500">{c.sport} · {c.exp} thn pengalaman</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{c.city}</div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3 text-sm">
                  <span className="flex items-center gap-1 font-bold">
                    <Star size={13} fill="#E11D2E" color="#E11D2E" />{c.rating}
                  </span>
                  <span className="text-neutral-500">({c.sessions} sesi)</span>
                  {c.online && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Online</span>}
                  {c.group && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Group</span>}
                </div>
                <div className="text-xs text-neutral-500 mb-3 font-medium">{c.speciality}</div>
                <div className="space-y-1 mb-4">
                  {c.achievements.slice(0, 2).map(a => (
                    <div key={a} className="flex items-center gap-2 text-xs text-neutral-600">
                      <CheckCircle size={11} style={{ color: '#E11D2E' }} />{a}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {c.services.slice(0, 3).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-neutral-50 border border-neutral-200 text-neutral-600 rounded text-xs">{s}</span>
                  ))}
                </div>
                <div className="flex items-end justify-between border-t border-neutral-100 pt-4">
                  <div>
                    <div className="text-xs text-neutral-400 font-semibold">Per sesi</div>
                    <div className="font-bold text-2xl text-neutral-900">{fmt(c.price)}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onCoachSelect && onCoachSelect(c); }}
                    className="px-4 py-2 text-xs font-bold rounded-full text-white transition hover:opacity-90" style={{ background: '#E11D2E' }}>
                    LIHAT PROFIL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 3. TRAINING PROGRAMS
const TrainingPrograms = ({ onEnrollClick, programsData }) => {
  const [sport, setSport] = useState('Semua');
  const [type, setType] = useState('Semua');

  const types = ['Semua', 'Grassroots', 'Elite Program', 'Holiday Camp', 'Private Training', 'Weekend Training', 'Goalkeeper Class'];
  const sourcePrograms = programsData && programsData.length > 0 ? programsData : PROGRAMS;
  const filtered = useMemo(() => sourcePrograms.filter(p =>
    (sport === 'Semua' || p.sport === sport) &&
    (type === 'Semua' || p.type === type)
  ), [sourcePrograms, sport, type]);

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-neutral-400 uppercase shrink-0">Olahraga:</span>
            {SPORTS.map(s => (
              <button key={s} onClick={() => setSport(s)}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full uppercase transition ${sport === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-neutral-400 uppercase shrink-0">Tipe:</span>
            {types.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full uppercase transition ${type === t ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => {
            const isFull = p.filled >= p.slots;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                <div className="h-2 w-full" style={{ background: p.color }} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-full text-white text-nowrap" style={{ background: p.color }}>
                      {p.type}
                    </span>
                    {isFull && <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600">PENUH</span>}
                  </div>
                  <div className="font-bold text-xl text-neutral-900 mt-3 mb-1">{p.name}</div>
                  <div className="text-xs text-neutral-500 mb-2">{p.academy} · {p.sport}</div>
                  <p className="text-sm text-neutral-600 mb-4">{p.desc}</p>
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-neutral-400">Usia</div>
                      <div className="font-bold text-neutral-800">{p.ageRange}</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-neutral-400">Durasi</div>
                      <div className="font-bold text-neutral-800">{p.duration}</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-neutral-400">Sesi</div>
                      <div className="font-bold text-neutral-800">{p.sessions}</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="text-neutral-400">Slot</div>
                      <div className={`font-bold ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                        {p.slots - p.filled} sisa
                      </div>
                    </div>
                  </div>
                  {/* Slot bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-neutral-400 mb-1">
                      <span>Terisi</span>
                      <span>{p.filled}/{p.slots}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(p.filled / p.slots) * 100}%`, background: isFull ? '#E11D2E' : '#0F4D2A' }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                    <div>
                      <div className="text-xs text-neutral-400">Total Program</div>
                      <div className="font-bold text-xl text-neutral-900">{fmt(p.price)}</div>
                    </div>
                    <button
                      disabled={isFull}
                      onClick={() => !isFull && onEnrollClick && onEnrollClick(p)}
                      className={`px-4 py-2 text-xs font-bold rounded-full transition ${isFull ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'text-white hover:opacity-90'}`}
                      style={isFull ? {} : { background: '#E11D2E' }}>
                      {isFull ? 'PENUH' : 'DAFTAR →'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 4. TRAINING EVENTS
const TrainingEvents = ({ onRegisterClick, eventsData }) => {
  const [sport, setSport] = useState('Semua');
  const [type, setType] = useState('Semua');
  const eventTypes = ['Semua', 'Coaching Clinic', 'Holiday Camp', 'Talent Scouting Camp', 'Trial Day', 'Open Training'];

  const sourceEvents = eventsData && eventsData.length > 0 ? eventsData : EVENTS;
  const filtered = useMemo(() => sourceEvents.filter(e =>
    (sport === 'Semua' || e.sport === sport) &&
    (type === 'Semua' || e.type === type)
  ), [sourceEvents, sport, type]);

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {SPORTS.map(s => (
              <button key={s} onClick={() => setSport(s)}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full uppercase transition ${sport === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {eventTypes.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full border transition ${type === t ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10">
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map(e => {
            const pct = Math.round((e.registered / e.slots) * 100);
            return (
              <div key={e.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                <div className="p-6 text-white" style={{ background: e.color }}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-bold px-2 py-1 bg-white/20 rounded-full">{e.type}</span>
                    <span className="text-xs font-bold">{e.sport}</span>
                  </div>
                  <div className="text-xl font-bold leading-snug mb-2">{e.title}</div>
                  <div className="text-sm opacity-80">{e.organizer}</div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-neutral-600 mb-4">{e.desc}</p>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                    <div className="bg-neutral-50 rounded-lg p-2 text-center">
                      <Calendar size={12} className="mx-auto mb-1 text-neutral-400" />
                      <div className="font-bold text-neutral-800 text-nowrap overflow-hidden">{e.date}</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2 text-center">
                      <Clock size={12} className="mx-auto mb-1 text-neutral-400" />
                      <div className="font-bold text-neutral-800">{e.time}</div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2 text-center">
                      <MapPin size={12} className="mx-auto mb-1 text-neutral-400" />
                      <div className="font-bold text-neutral-800 truncate">{e.location}</div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>Pendaftar</span>
                      <span className="font-bold">{e.registered}/{e.slots} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: e.color }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                    <div>
                      <div className="text-xs text-neutral-400">Biaya Pendaftaran</div>
                      <div className="font-bold text-xl text-neutral-900">{e.price === 0 ? 'GRATIS' : fmt(e.price)}</div>
                    </div>
                    <button
                      onClick={() => onRegisterClick && onRegisterClick(e)}
                      className="px-5 py-2 text-xs font-bold rounded-full text-white transition hover:opacity-90"
                      style={{ background: '#E11D2E' }}>
                      DAFTAR →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 5. ATHLETE DEVELOPMENT (Profile & Report)
const AthleteDevelopment = ({ auth, openAuth }) => {
  const [reportIdx, setReportIdx] = useState(0);
  const a = ATHLETE;
  const report = a.reports[reportIdx];

  const gradeColor = { A: '#0F4D2A', 'B+': '#1D4ED8', B: '#EA580C', C: '#B91C1C' };

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-8 py-10">
      {/* Header */}
      <div className="bg-neutral-900 rounded-2xl p-6 mb-6 flex flex-wrap gap-6 items-center">
        <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-2xl font-bold">{a.name}</div>
          <div className="text-neutral-400 text-sm mt-1">{a.position} · #{a.jersey}</div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <AthleteStatusBadge status={a.status} />
            <span className="text-xs text-neutral-400">{a.academy}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center text-white">
          {[['Usia', `${a.age} thn`], ['Tinggi', `${a.height} cm`], ['Berat', `${a.weight} kg`]].map(([l, v]) => (
            <div key={l}>
              <div className="text-xl font-bold">{v}</div>
              <div className="text-xs text-neutral-400">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        {[
          ['Match', a.stats.matchPlayed], ['Gol', a.stats.goals], ['Assist', a.stats.assists],
          ['KK', a.stats.yellowCards], ['KM', a.stats.redCards], ['Menit', a.stats.minutesPlayed]
        ].map(([l, v]) => (
          <div key={l} className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
            <div className="text-xl font-bold text-neutral-900">{v}</div>
            <div className="text-xs text-neutral-400">{l}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Skill Radar */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Target size={16} style={{ color: '#E11D2E' }} /> Technical Skills
          </div>
          <div className="space-y-3">
            {Object.entries(a.skills).map(([k, v]) => (
              <SkillBar key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
            ))}
          </div>
        </div>

        {/* Attendance */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Activity size={16} style={{ color: '#E11D2E' }} /> Kehadiran
          </div>
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E11D2E" strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 40 * a.attendance.rate / 100} ${2 * Math.PI * 40 * (1 - a.attendance.rate / 100)}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-neutral-900">{a.attendance.rate}%</div>
                <div className="text-xs text-neutral-500">Kehadiran</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            {[['Total', a.attendance.total, 'text-neutral-700'], ['Hadir', a.attendance.present, 'text-green-600'], ['Tidak Hadir', a.attendance.absent, 'text-red-600']].map(([l, v, cls]) => (
              <div key={l} className="bg-neutral-50 rounded-xl p-3">
                <div className={`text-xl font-bold ${cls}`}>{v}</div>
                <div className="text-xs text-neutral-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Report Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <FileText size={16} style={{ color: '#E11D2E' }} /> Raport Perkembangan
          </div>
          <div className="flex items-center gap-2">
            {a.reports.map((r, i) => (
              <button key={r.period} onClick={() => setReportIdx(i)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition ${reportIdx === i ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                {r.period}
              </button>
            ))}
          </div>
        </div>
        {report && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold" style={{ background: gradeColor[report.grade] || '#E11D2E' }}>
                {report.grade}
              </div>
              <div>
                <div className="font-bold text-neutral-900">Periode {report.period}</div>
                <div className="text-sm text-neutral-500">Pelatih: {report.coach}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[['Fisik', report.physical], ['Teknik', report.technical], ['Taktik', report.tactical], ['Mental', report.mental], ['Disiplin', report.discipline]].map(([l, v]) => (
                <div key={l} className="bg-neutral-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-neutral-900">{v}</div>
                  <div className="text-xs text-neutral-400">{l}</div>
                  <div className="mt-1.5 h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${v}%`, background: '#E11D2E' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <span className="font-bold">Catatan Pelatih: </span>{report.notes}
            </div>
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <Trophy size={16} style={{ color: '#E11D2E' }} /> Prestasi
          </div>
          <div className="space-y-3">
            {a.achievements.map((ach, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                <span className="text-2xl">{ach.icon}</span>
                <div>
                  <div className="font-bold text-sm text-neutral-900">{ach.title}</div>
                  <div className="text-xs text-neutral-500">{ach.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} style={{ color: '#E11D2E' }} /> Timeline Perkembangan
          </div>
          <div className="space-y-3">
            {a.timeline.map((t, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#E11D2E' }} />
                <div>
                  <div className="text-xs text-neutral-400 font-semibold">{t.date}</div>
                  <div className="text-sm text-neutral-700">{t.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 6. PARENT DASHBOARD
const ParentDashboard = ({ auth, openAuth }) => {
  const [tab, setTab] = useState('overview');

  if (!auth) {
    return (
      <div className="max-w-xl mx-auto px-5 py-20 text-center">
        <Heart size={48} className="mx-auto mb-4 text-red-400" />
        <div className="text-xl font-bold text-neutral-900 mb-2">Parent Dashboard</div>
        <p className="text-neutral-500 mb-6">Login untuk melihat perkembangan, kehadiran, dan pembayaran anak Anda.</p>
        <button onClick={() => openAuth && openAuth('login')} className="px-6 py-3 rounded-full font-bold text-white text-sm" style={{ background: '#E11D2E' }}>
          Login / Daftar
        </button>
      </div>
    );
  }

  const tabs = [
    ['overview', 'Ringkasan'],
    ['attendance', 'Kehadiran'],
    ['progress', 'Perkembangan'],
    ['payment', 'Pembayaran'],
    ['schedule', 'Jadwal'],
  ];

  return (
    <div className="max-w-4xl mx-auto px-5 lg:px-8 py-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
          <Heart size={20} />
        </div>
        <div>
          <div className="font-bold text-neutral-900">Parent Dashboard</div>
          <div className="text-sm text-neutral-500">Pantau perkembangan Aldi Surya Pratama</div>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-full overflow-x-auto mb-8">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Kehadiran', val: '91.7%', icon: <CheckCircle size={18} />, cls: 'text-green-600 bg-green-50' },
              { label: 'Rating Bulan Ini', val: 'A', icon: <Award size={18} />, cls: 'text-amber-600 bg-amber-50' },
              { label: 'Pembayaran', val: 'Lunas', icon: <CreditCard size={18} />, cls: 'text-blue-600 bg-blue-50' },
              { label: 'Prestasi', val: '3 Award', icon: <Trophy size={18} />, cls: 'text-purple-600 bg-purple-50' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${item.cls}`}>{item.icon}</div>
                <div className="font-bold text-lg text-neutral-900">{item.val}</div>
                <div className="text-xs text-neutral-400">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="font-bold text-neutral-900 mb-3 text-sm">Catatan Pelatih Terbaru</div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              "Aldi menunjukkan perkembangan teknik dribbling yang luar biasa bulan ini. Perlu meningkatkan positioning dan komunikasi di lapangan. Terus semangat!"
              <div className="text-xs text-amber-600 mt-2 font-semibold">— Coach Bambang, April 2026</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="font-bold text-neutral-900 mb-3 text-sm">Jadwal Latihan Berikutnya</div>
            <div className="space-y-2">
              {SCHEDULE.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl text-sm">
                  <div>
                    <span className="font-bold text-neutral-900">{s.day}, {s.date}</span>
                    <span className="text-neutral-500 ml-2">{s.time}</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-neutral-200 rounded-full text-neutral-600">{s.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <div className="font-bold text-neutral-900 mb-4">Riwayat Kehadiran — Mei 2026</div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
              <div key={i} className="text-center text-xs font-bold text-neutral-400 py-1">{d}</div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
              const isPresent = [2, 6, 9, 13, 16, 20, 23, 27, 30].includes(day);
              const isAbsent = [4, 18].includes(day);
              return (
                <div key={day} className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition ${
                  isPresent ? 'bg-green-500 text-white' :
                  isAbsent ? 'bg-red-500 text-white' :
                  'bg-neutral-100 text-neutral-400'
                }`}>{day}</div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Hadir</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Tidak Hadir</span>
          </div>
        </div>
      )}

      {tab === 'progress' && <AthleteDevelopment auth={auth} openAuth={openAuth} />}

      {tab === 'payment' && (
        <div className="space-y-4">
          {PAYMENTS.slice(0, 3).map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 p-5 flex items-center justify-between">
              <div>
                <div className="font-bold text-neutral-900 text-sm">{p.type}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{p.id} · Jatuh tempo {p.due}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-neutral-900">{fmt(p.amount)}</div>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-3">
          {SCHEDULE.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-neutral-900 text-sm">{s.day}, {s.date}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{s.time} · {s.venue}</div>
                  <div className="text-xs text-neutral-400 mt-1">{s.group} · {s.coach}</div>
                </div>
                <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded-full font-semibold">{s.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 7. ACADEMY WORKSPACE
const AcademyWorkspace = ({ auth, onGenerateReport, reportSubmitting }) => {
  const [tab, setTab] = useState('dashboard');

  const tabs = [
    ['dashboard', 'Dashboard'],
    ['students', 'Siswa'],
    ['schedule', 'Jadwal'],
    ['payment', 'Pembayaran'],
    ['report', 'Raport'],
  ];

  const paid = PAYMENTS.filter(p => p.status === 'paid').length;
  const overdue = PAYMENTS.filter(p => p.status === 'overdue').length;
  const pending = PAYMENTS.filter(p => p.status === 'pending').length;
  const totalRevenue = PAYMENTS.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">/ WORKSPACE</div>
          <div className="text-2xl font-bold text-neutral-900">Garuda Football Academy</div>
          <div className="text-sm text-neutral-500">Jakarta Selatan · 120 siswa aktif</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-xs font-bold rounded-full border border-neutral-200 text-neutral-700 hover:border-neutral-400 transition flex items-center gap-1.5">
            <Plus size={13} /> Siswa Baru
          </button>
          <button className="px-4 py-2 text-xs font-bold rounded-full text-white flex items-center gap-1.5" style={{ background: '#E11D2E' }}>
            <Bell size={13} /> Kirim Pengumuman
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-2xl w-fit mb-8 overflow-x-auto">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Siswa Aktif', val: '120', icon: <Users size={18} />, cls: 'text-blue-600 bg-blue-50' },
              { label: 'Kehadiran Avg', val: '88.3%', icon: <Activity size={18} />, cls: 'text-green-600 bg-green-50' },
              { label: 'Revenue Bulan Ini', val: fmt(totalRevenue), icon: <Wallet size={18} />, cls: 'text-amber-600 bg-amber-50' },
              { label: 'Pembayaran Terlambat', val: overdue, icon: <AlertCircle size={18} />, cls: 'text-red-600 bg-red-50' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-neutral-200 p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.cls}`}>{item.icon}</div>
                <div className="font-bold text-xl text-neutral-900">{item.val}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          {/* Upcoming sessions */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="font-bold text-neutral-900 mb-4 text-sm">Sesi Terdekat</div>
            <div className="space-y-2">
              {SCHEDULE.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-200 flex items-center justify-center">
                      <Calendar size={14} className="text-neutral-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-900">{s.day} · {s.time}</div>
                      <div className="text-xs text-neutral-500">{s.group} · {s.coach}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-neutral-500">{s.students} siswa</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'students' && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="text-sm font-bold text-neutral-900">Daftar Siswa ({STUDENTS.length})</div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input placeholder="Cari siswa..." className="pl-8 pr-4 py-1.5 text-xs rounded-full border border-neutral-200 focus:outline-none" />
            </div>
          </div>
          <div className="divide-y divide-neutral-100">
            {STUDENTS.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
                    {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-900">{s.name}</div>
                    <div className="text-xs text-neutral-400">{s.position} · {s.age} thn · Aktif {s.lastActivity}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AthleteStatusBadge status={s.status} />
                  <span className="text-xs text-neutral-500">{s.attendance}%</span>
                  <StatusBadge status={s.payment.toLowerCase()} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-3">
          {SCHEDULE.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-neutral-900">{s.date.split(' ')[0]}</div>
                    <div className="text-xs text-neutral-400">{s.date.split(' ')[1]}</div>
                  </div>
                  <div>
                    <div className="font-bold text-neutral-900 text-sm">{s.group}</div>
                    <div className="text-xs text-neutral-500">{s.time} · {s.coach} · {s.venue}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded-full">{s.type}</span>
                  <span className="text-xs text-neutral-400">{s.students} siswa</span>
                </div>
              </div>
            </div>
          ))}
          <button className="w-full py-3 rounded-2xl border-2 border-dashed border-neutral-200 text-sm font-bold text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition flex items-center justify-center gap-2">
            <Plus size={16} /> Tambah Sesi Latihan
          </button>
        </div>
      )}

      {tab === 'payment' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Lunas', val: paid, cls: 'text-green-600 bg-green-50' },
              { label: 'Pending', val: pending, cls: 'text-yellow-600 bg-yellow-50' },
              { label: 'Terlambat', val: overdue, cls: 'text-red-600 bg-red-50' },
            ].map(item => (
              <div key={item.label} className={`rounded-2xl p-4 text-center ${item.cls}`}>
                <div className="text-3xl font-bold">{item.val}</div>
                <div className="text-xs font-semibold mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="divide-y divide-neutral-100">
              {PAYMENTS.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition">
                  <div>
                    <div className="text-sm font-bold text-neutral-900">{p.student}</div>
                    <div className="text-xs text-neutral-400">{p.type} · {p.id}</div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="font-bold text-sm text-neutral-900">{fmt(p.amount)}</div>
                      <div className="text-xs text-neutral-400">Due: {p.due}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <div className="text-center py-16 text-neutral-400">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <div className="font-semibold text-neutral-700">Raport Digital</div>
          <p className="text-sm mt-2 max-w-xs mx-auto">Generate raport perkembangan siswa untuk dikirim ke orang tua. Pilih siswa dan periode laporan.</p>
          <button
            onClick={onGenerateReport}
            disabled={reportSubmitting}
            className="mt-6 px-6 py-3 rounded-full text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: '#E11D2E' }}
          >
            <Download size={14} className="inline mr-2" /> {reportSubmitting ? 'Membuat Raport...' : 'Generate Raport'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────── MAIN TRAINING ECOSYSTEM PAGE ───────────────
export default function TrainingEcosystem({
  auth,
  openAuth,
  onCoachDashboard,
  onCoachSelect,
  coaches,
  initialSection = 'home',
  onSectionChange,
}) {
  const [section, setSection] = useState(initialSection);
  const [actionState, setActionState] = useState({ kind: '', message: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const actionTimerRef = useRef(null);
  const { academies: dbAcademies } = useTrainingAcademies();
  const { coaches: dbCoaches } = useTrainingCoaches();
  const { programs: dbPrograms } = useTrainingPrograms();
  const { events: dbEvents } = useTrainingEvents();

  const mergedAcademies = dbAcademies.length > 0 ? dbAcademies : ACADEMIES;
  const mergedCoaches = dbCoaches.length > 0 ? dbCoaches : (coaches && coaches.length > 0 ? coaches : COACHES_DATA);
  const mergedPrograms = dbPrograms.length > 0 ? dbPrograms : PROGRAMS;
  const mergedEvents = dbEvents.length > 0 ? dbEvents : EVENTS;

  useEffect(() => {
    if (initialSection && TRAINING_SECTION_KEYS.has(initialSection)) {
      setSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (!canAccessTrainingSection(section, auth)) {
      setSection('home');
    }
  }, [section, auth]);

  useEffect(() => {
    if (typeof onSectionChange === 'function') {
      onSectionChange(section);
    }
  }, [section, onSectionChange]);

  useEffect(() => () => {
    if (actionTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(actionTimerRef.current);
    }
  }, []);

  const pushActionMessage = (kind, message) => {
    setActionState({ kind, message });
    if (typeof window !== 'undefined') {
      if (actionTimerRef.current) {
        window.clearTimeout(actionTimerRef.current);
      }
      actionTimerRef.current = window.setTimeout(() => {
        setActionState({ kind: '', message: '' });
      }, 3200);
    }
  };

  const requireAuth = () => {
    if (!auth?.id) {
      if (typeof openAuth === 'function') openAuth('login');
      pushActionMessage('error', 'Silakan login dulu untuk melanjutkan aksi training.');
      return false;
    }
    return true;
  };

  const handleEnrollProgram = async (program) => {
    if (!requireAuth()) return;

    const result = await enrollTrainingProgram({
      programId: program?.id,
      userId: auth.id,
    });

    if (result.success) {
      pushActionMessage('success', `Berhasil daftar program: ${program?.name || 'Program Training'}.`);
      return;
    }

    pushActionMessage('error', result.error || 'Gagal mendaftar program latihan.');
  };

  const handleRegisterEvent = async (eventItem) => {
    if (!requireAuth()) return;

    const result = await registerTrainingEvent({
      eventId: eventItem?.id,
      userId: auth.id,
      athleteName: auth?.name,
    });

    if (result.success) {
      pushActionMessage('success', `Pendaftaran event berhasil: ${eventItem?.title || 'Training Event'}.`);
      return;
    }

    pushActionMessage('error', result.error || 'Gagal mendaftar event.');
  };

  const handleGenerateReport = async () => {
    if (!requireAuth()) return;

    setReportSubmitting(true);
    const result = await createTrainingAthleteReport({ userId: auth.id });
    setReportSubmitting(false);

    if (result.success) {
      pushActionMessage('success', `Raport berhasil dibuat untuk ${result.athleteName || 'atlet'}.`);
      return;
    }

    pushActionMessage('error', result.error || 'Gagal membuat raport atlet.');
  };

  const NAV = [
    { key: 'home', label: 'Overview', icon: <Layers size={14} /> },
    { key: 'academy', label: 'Discover Academy', icon: <Building2 size={14} /> },
    { key: 'coach', label: 'Discover Coach', icon: <Dumbbell size={14} /> },
    { key: 'programs', label: 'Programs', icon: <BookOpen size={14} /> },
    { key: 'events', label: 'Training Event', icon: <Calendar size={14} /> },
    { key: 'athlete', label: 'Athlete Development', icon: <Target size={14} /> },
    { key: 'parent', label: 'Parent Dashboard', icon: <Heart size={14} /> },
    { key: 'workspace', label: 'Workspace', icon: <Settings size={14} /> },
  ];

  return (
    <div>
      {/* ── HERO ── */}
      <section className="border-b border-neutral-300 relative overflow-hidden grain" style={{ background: '#F4F4F4' }}>
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #E11D2E, transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-20 relative">
          <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-4">/ PELATIHAN</div>
          <div className="grid lg:grid-cols-2 gap-8 items-end mb-10">
            <h1 className="font-display text-6xl lg:text-9xl leading-[0.85] text-neutral-900">
              TRAINING<br />
              <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>ecosystem.</span>
            </h1>
            <div>
              <p className="text-lg text-neutral-700 max-w-md mb-6">
                Platform pembinaan atlet digital terintegrasi — menghubungkan academy, coach, atlet, orang tua, turnamen, dan venue dalam satu ekosistem olahraga.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSection('academy')}
                  className="px-6 py-3 text-sm font-bold rounded-full text-white transition hover:opacity-90"
                  style={{ background: '#E11D2E' }}>
                  Cari Academy
                </button>
                <button
                  onClick={() => setSection('coach')}
                  className="px-6 py-3 text-sm font-bold rounded-full bg-neutral-900 text-white flex items-center gap-2 transition hover:bg-neutral-800">
                  <Dumbbell size={16} /> Cari Pelatih
                </button>
                {auth && (
                  <button
                    onClick={() => setSection('workspace')}
                    className="px-6 py-3 text-sm font-bold rounded-full border-2 border-neutral-900 text-neutral-900 transition hover:bg-neutral-100">
                    <Settings size={14} className="inline mr-1.5" /> Workspace
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Ecosystem stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { val: '120+', label: 'Academy & SSB', icon: <Building2 size={16} /> },
              { val: '350+', label: 'Pelatih Profesional', icon: <Dumbbell size={16} /> },
              { val: '4.500+', label: 'Atlet Terdaftar', icon: <Users size={16} /> },
              { val: '8', label: 'Cabang Olahraga', icon: <Trophy size={16} /> },
            ].map(item => (
              <div key={item.label} className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-neutral-200">
                <div className="flex items-center gap-2 mb-2 text-neutral-500">{item.icon}</div>
                <div className="text-2xl font-bold text-neutral-900">{item.val}</div>
                <div className="text-xs text-neutral-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STICKY NAV ── */}
      <div className="bg-white border-b border-neutral-200 sticky top-16 z-40 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <div className="flex items-center gap-1">
            {NAV.map(n => (
              <button
                key={n.key}
                onClick={() => setSection(n.key)}
                className={`flex items-center gap-1.5 px-4 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition whitespace-nowrap ${
                  section === n.key
                    ? 'border-[#E11D2E] text-[#E11D2E]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION CONTENT ── */}
      {actionState.message && (
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-5">
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${actionState.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {actionState.message}
          </div>
        </div>
      )}
      {section === 'home' && <HomeOverview setSection={setSection} auth={auth} academies={mergedAcademies} events={mergedEvents} />}
      {section === 'academy' && <DiscoverAcademy onRegisterTrialClick={() => {}} onBack={() => setSection('home')} academies={mergedAcademies} />}
      {section === 'coach' && <DiscoverCoach onCoachSelect={onCoachSelect} coachesData={mergedCoaches} />}
      {section === 'programs' && <TrainingPrograms onEnrollClick={handleEnrollProgram} programsData={mergedPrograms} />}
      {section === 'events' && <TrainingEvents onRegisterClick={handleRegisterEvent} eventsData={mergedEvents} />}
      {section === 'athlete' && <AthleteDevelopment auth={auth} openAuth={openAuth} />}
      {section === 'parent' && <ParentDashboard auth={auth} openAuth={openAuth} />}
      {section === 'workspace' && <AcademyWorkspace auth={auth} onGenerateReport={handleGenerateReport} reportSubmitting={reportSubmitting} />}
    </div>
  );
}

// ─────────────── HOME OVERVIEW ───────────────
const HomeOverview = ({ setSection, auth, academies, events }) => (
  <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12">
    {/* Featured academies */}
    <div className="mb-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">/ ACADEMY TERFEATURED</div>
          <h2 className="text-3xl font-bold text-neutral-900">Academy & SSB Unggulan</h2>
        </div>
        <button onClick={() => setSection('academy')} className="text-sm font-bold text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1">
          Lihat Semua <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {(academies || ACADEMIES).filter(a => a.verified).slice(0, 3).map(a => (
          <div key={a.id} onClick={() => setSection('academy')} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden cursor-pointer hover:shadow-md transition">
            <div className="p-5 text-white" style={{ background: a.color }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-sm font-bold">{a.initial}</div>
                <VerifiedBadge />
              </div>
              <div className="text-xs font-bold opacity-75">{a.sport}</div>
              <div className="font-bold text-base mt-0.5 leading-tight">{a.name}</div>
              <div className="text-xs opacity-75 mt-1 flex items-center gap-1"><MapPin size={9} /> {a.city}</div>
            </div>
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="text-xs text-neutral-500">{a.students} siswa · {a.ageRange}</div>
              <div className="text-sm font-bold text-neutral-900">{fmt(a.price)}<span className="text-xs font-normal text-neutral-400">/bln</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Ecosystem cards */}
    <div className="mb-14">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">/ FITUR ECOSYSTEM</div>
      <h2 className="text-3xl font-bold text-neutral-900 mb-6">Semua yang Kamu Butuhkan</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'coach', icon: <Dumbbell size={20} />, title: 'Pelatih Profesional', desc: 'Private & group coaching berlisensi dari seluruh Indonesia.', color: '#E11D2E' },
          { key: 'programs', icon: <BookOpen size={20} />, title: 'Program Latihan', desc: 'Dari Grassroots hingga Elite — pilih program yang sesuai target.', color: '#0F4D2A' },
          { key: 'events', icon: <Calendar size={20} />, title: 'Training Event', desc: 'Coaching clinic, holiday camp, scouting day, dan trial session.', color: '#1F3A8A' },
          { key: 'athlete', icon: <Target size={20} />, title: 'Athlete Development', desc: 'Tracking progres, raport digital, dan statistik turnamen terintegrasi.', color: '#EA580C' },
          { key: 'parent', icon: <Heart size={20} />, title: 'Parent Dashboard', desc: 'Pantau kehadiran, perkembangan, dan pembayaran anak secara real-time.', color: '#B91C1C' },
          { key: 'workspace', icon: <Settings size={20} />, title: 'Academy Workspace', desc: 'Kelola siswa, jadwal, attendance, dan keuangan dalam satu tempat.', color: '#7C3AED' },
          { key: null, icon: <Trophy size={20} />, title: 'Tournament Integration', desc: 'Statistik turnamen otomatis masuk ke profil atlet.', color: '#92400E' },
          { key: null, icon: <Percent size={20} />, title: 'Scholarship System', desc: 'Academy dapat memberikan beasiswa penuh, parsial, atau sponsor atlet.', color: '#0E7490' },
        ].map((item, i) => (
          <div
            key={i}
            onClick={() => item.key && setSection(item.key)}
            className={`bg-white rounded-2xl border border-neutral-200 p-5 ${item.key ? 'cursor-pointer hover:shadow-md' : 'opacity-75'} transition`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white mb-4" style={{ background: item.color }}>
              {item.icon}
            </div>
            <div className="font-bold text-sm text-neutral-900 mb-1">{item.title}</div>
            <p className="text-xs text-neutral-500">{item.desc}</p>
            {item.key && <div className="text-xs font-bold mt-3 flex items-center gap-1" style={{ color: item.color }}>Jelajahi <ChevronRight size={12} /></div>}
            {!item.key && <div className="text-xs font-bold mt-3 text-neutral-300">Segera Hadir</div>}
          </div>
        ))}
      </div>
    </div>

    {/* Upcoming events */}
    <div className="mb-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">/ TRAINING EVENT</div>
          <h2 className="text-3xl font-bold text-neutral-900">Event Terdekat</h2>
        </div>
        <button onClick={() => setSection('events')} className="text-sm font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1">
          Lihat Semua <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(events || EVENTS).slice(0, 3).map(e => (
          <div key={e.id} onClick={() => setSection('events')} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden cursor-pointer hover:shadow-md transition">
            <div className="h-1.5" style={{ background: e.color }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: e.color }}>{e.type}</span>
                {e.price === 0 && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">GRATIS</span>}
              </div>
              <div className="font-bold text-sm text-neutral-900 mt-2 mb-1 leading-snug">{e.title}</div>
              <div className="text-xs text-neutral-400 flex items-center gap-1 mb-3"><Calendar size={10} /> {e.date}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">{e.registered}/{e.slots} pendaftar</span>
                {e.price > 0 && <span className="font-bold text-neutral-900">{fmt(e.price)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* CTA for Academy */}
    <div className="rounded-3xl overflow-hidden bg-neutral-900 p-8 md:p-12 text-white text-center">
      <div className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3">/ UNTUK ACADEMY & COACH</div>
      <h2 className="text-3xl md:text-5xl font-bold mb-4">Buka Academy atau<br />Kelola Coaching-mu di sini.</h2>
      <p className="text-neutral-400 max-w-xl mx-auto mb-8">
        Daftarkan akademi, buat program, kelola siswa, proses pembayaran, dan kirim raport digital — semua dalam satu platform.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button className="px-6 py-3 rounded-full font-bold text-sm text-white transition hover:opacity-90" style={{ background: '#E11D2E' }}>
          Daftarkan Academy
        </button>
        <button onClick={() => onCoachDashboard && onCoachDashboard()} className="px-6 py-3 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition">
          Saya Pelatih →
        </button>
      </div>
    </div>
  </div>
);
