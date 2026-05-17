import React, { useState } from 'react';
import {
  Building2, Users, GraduationCap, Trophy, Megaphone, Star,
  ChevronRight, X, Check, ArrowRight, MapPin, Phone, Mail,
  Globe, FileText, Zap, Shield, TrendingUp, Heart,
} from 'lucide-react';
import { supabase } from '../config/supabase.js';
import { WNI_REGION_DATA } from '../data/wniRegionData.js';

// ── helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition placeholder:text-neutral-400';
const selectCls = inputCls;
const labelCls = 'block text-xs font-bold text-neutral-600 uppercase tracking-wide mb-1.5';

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'venue',
    icon: Building2,
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    title: 'Daftarkan Venue',
    subtitle: 'Lapangan & Fasilitas Olahraga',
    description: 'Miliki lapangan futsal, badminton, basket, tenis, atau olahraga lain? Bergabung dan buka akses booking online untuk ribuan pengguna Stadione.',
    benefits: ['Kelola jadwal booking online', 'Terima pembayaran digital', 'Analitik pendapatan real-time', 'Fitur promosi & voucher'],
    cta: 'Daftar Venue',
    tag: 'Paling Populer',
  },
  {
    key: 'coach',
    icon: GraduationCap,
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    title: 'Daftar Jadi Pelatih',
    subtitle: 'Pelatih & Instruktur Olahraga',
    description: 'Pelatih berlisensi atau berpengalaman? Tawarkan sesi pelatihan, kelas, dan program latihan melalui platform Stadione ke ribuan atlet.',
    benefits: ['Profil pelatih terverifikasi', 'Manajemen jadwal sesi', 'Pembayaran aman & transparan', 'Eksposur ke komunitas'],
    cta: 'Daftar Pelatih',
    tag: null,
  },
  {
    key: 'community',
    icon: Users,
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    title: 'Daftarkan Komunitas',
    subtitle: 'Komunitas & Klub Olahraga',
    description: 'Punya komunitas atau klub olahraga aktif? Bawa anggota Anda ke Stadione — kelola event, tournamen internal, dan bangun jaringan lebih luas.',
    benefits: ['Halaman komunitas resmi', 'Kelola event & turnamen', 'Forum diskusi anggota', 'Recruitment anggota baru'],
    cta: 'Daftar Komunitas',
    tag: null,
  },
  {
    key: 'team_operator',
    icon: Trophy,
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    title: 'Tim / Akademi',
    subtitle: 'Tim & Akademi Olahraga',
    description: 'Kelola tim kompetitif atau akademi olahraga? Daftarkan workspace Anda, ikuti turnamen resmi, dan manfaatkan fitur manajemen roster & statistik pemain.',
    benefits: ['Manajemen roster tim', 'Statistik pemain & match', 'Ikut turnamen resmi', 'Laporan performa'],
    cta: 'Daftar Tim/Akademi',
    tag: null,
  },
  {
    key: 'eo_operator',
    icon: Megaphone,
    color: 'rose',
    gradient: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    title: 'Tournament Host',
    subtitle: 'Penyelenggara Turnamen & Event',
    description: 'Tournament host atau federasi yang ingin menyelenggarakan turnamen resmi? Dapatkan akses ke tools manajemen turnamen profesional dan basis peserta Stadione.',
    benefits: ['Platform turnamen lengkap', 'Manajemen bracket & jadwal', 'Live scoring & hasil', 'Sertifikat & penghargaan digital'],
    cta: 'Daftar Tournament Host',
    tag: null,
  },
  {
    key: 'sponsor',
    icon: Star,
    color: 'neutral',
    gradient: 'from-neutral-700 to-neutral-900',
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
    text: 'text-neutral-700',
    badge: 'bg-neutral-100 text-neutral-700',
    title: 'Program Sponsor',
    subtitle: 'Brand & Korporat',
    description: 'Ingin menjangkau jutaan pengguna aktif olahraga Indonesia? Sponsori turnamen, venue, atau buat kode promo eksklusif untuk komunitas Stadione.',
    benefits: ['Eksposur brand ke jutaan user', 'Kode promo & kampanye', 'Sponsorship turnamen', 'Laporan ROI kampanye'],
    cta: 'Jadi Sponsor',
    tag: 'Enterprise',
  },
];

// ── Static option lists ───────────────────────────────────────────────────────
const SPORTS_LIST = [
  'Futsal', 'Sepak Bola', 'Basket', 'Voli', 'Badminton',
  'Tenis', 'Padel', 'Renang', 'Lari / Running', 'Bersepeda / Cycling',
  'Bela Diri / Silat / Karate', 'Panahan', 'Golf', 'Panjat Tebing',
  'Softball / Baseball', 'Senam / Gym', 'E-Sports', 'Lainnya',
];

const PROVINCES = Object.keys(WNI_REGION_DATA);

const COMMUNITY_CATEGORIES = [
  'Komunitas Hobi / Rekreasi',
  'Komunitas Kompetitif',
  'Akademi / Sekolah Olahraga',
  'Tim Corporate',
  'Komunitas Kampus',
  'Komunitas Pemula',
  'Komunitas Wanita',
  'Komunitas Keluarga',
  'Lainnya',
];

const CITIES_BY_PROVINCE = {
  'Aceh': ['Banda Aceh','Sabang','Langsa','Lhokseumawe','Subulussalam','Kab. Aceh Besar','Kab. Pidie','Kab. Pidie Jaya','Kab. Bireuen','Kab. Aceh Utara','Kab. Aceh Timur','Kab. Aceh Tamiang','Kab. Aceh Tengah','Kab. Bener Meriah','Kab. Gayo Lues','Kab. Aceh Barat','Kab. Nagan Raya','Kab. Aceh Barat Daya','Kab. Aceh Selatan','Kab. Aceh Singkil','Kab. Aceh Tenggara','Kab. Aceh Jaya','Kab. Simeulue'],
  'Sumatera Utara': ['Medan','Binjai','Pematangsiantar','Sibolga','Tebing Tinggi','Tanjungbalai','Padangsidempuan','Gunungsitoli','Kab. Deli Serdang','Kab. Langkat','Kab. Karo','Kab. Simalungun','Kab. Asahan','Kab. Batubara','Kab. Labuhanbatu','Kab. Labuhanbatu Utara','Kab. Labuhanbatu Selatan','Kab. Tapanuli Utara','Kab. Tapanuli Tengah','Kab. Tapanuli Selatan','Kab. Mandailing Natal','Kab. Padang Lawas','Kab. Padang Lawas Utara','Kab. Dairi','Kab. Pakpak Bharat','Kab. Toba','Kab. Samosir','Kab. Humbang Hasundutan','Kab. Serdang Bedagai','Kab. Nias','Kab. Nias Utara','Kab. Nias Barat','Kab. Nias Selatan'],
  'Sumatera Barat': ['Padang','Bukittinggi','Payakumbuh','Solok','Sawahlunto','Padang Panjang','Pariaman','Kab. Agam','Kab. Tanah Datar','Kab. Lima Puluh Kota','Kab. Pasaman','Kab. Pasaman Barat','Kab. Padang Pariaman','Kab. Pesisir Selatan','Kab. Sijunjung','Kab. Dharmasraya','Kab. Solok','Kab. Solok Selatan','Kab. Kepulauan Mentawai'],
  'Riau': ['Pekanbaru','Dumai','Kab. Kampar','Kab. Rokan Hulu','Kab. Rokan Hilir','Kab. Bengkalis','Kab. Kepulauan Meranti','Kab. Siak','Kab. Pelalawan','Kab. Indragiri Hulu','Kab. Indragiri Hilir','Kab. Kuantan Singingi'],
  'Kepulauan Riau': ['Batam','Tanjungpinang','Kab. Bintan','Kab. Karimun','Kab. Lingga','Kab. Natuna','Kab. Kepulauan Anambas'],
  'Jambi': ['Jambi','Sungai Penuh','Kab. Batanghari','Kab. Muaro Jambi','Kab. Bungo','Kab. Tebo','Kab. Sarolangun','Kab. Merangin','Kab. Kerinci','Kab. Tanjung Jabung Barat','Kab. Tanjung Jabung Timur'],
  'Sumatera Selatan': ['Palembang','Lubuklinggau','Pagar Alam','Prabumulih','Kab. Ogan Komering Ulu','Kab. Ogan Komering Ulu Timur','Kab. Ogan Komering Ulu Selatan','Kab. Ogan Komering Ilir','Kab. Ogan Ilir','Kab. Muara Enim','Kab. Lahat','Kab. Empat Lawang','Kab. Musi Rawas','Kab. Musi Rawas Utara','Kab. Musi Banyuasin','Kab. Banyuasin','Kab. Penukal Abab Lematang Ilir'],
  'Kepulauan Bangka Belitung': ['Pangkalpinang','Kab. Bangka','Kab. Bangka Tengah','Kab. Bangka Barat','Kab. Bangka Selatan','Kab. Belitung','Kab. Belitung Timur'],
  'Bengkulu': ['Bengkulu','Kab. Bengkulu Utara','Kab. Bengkulu Tengah','Kab. Bengkulu Selatan','Kab. Rejang Lebong','Kab. Kepahiang','Kab. Lebong','Kab. Kaur','Kab. Seluma','Kab. Mukomuko'],
  'Lampung': ['Bandar Lampung','Metro','Kab. Lampung Selatan','Kab. Lampung Tengah','Kab. Lampung Utara','Kab. Lampung Timur','Kab. Lampung Barat','Kab. Pesawaran','Kab. Pringsewu','Kab. Mesuji','Kab. Tulangbawang','Kab. Tulangbawang Barat','Kab. Tanggamus','Kab. Way Kanan','Kab. Pesisir Barat'],
  'DKI Jakarta': ['Jakarta Pusat','Jakarta Utara','Jakarta Barat','Jakarta Selatan','Jakarta Timur','Kep. Seribu'],
  'Jawa Barat': ['Bandung','Bekasi','Bogor','Cimahi','Cirebon','Depok','Sukabumi','Tasikmalaya','Banjar','Kab. Bandung','Kab. Bandung Barat','Kab. Bekasi','Kab. Bogor','Kab. Ciamis','Kab. Cianjur','Kab. Cirebon','Kab. Garut','Kab. Indramayu','Kab. Karawang','Kab. Kuningan','Kab. Majalengka','Kab. Pangandaran','Kab. Purwakarta','Kab. Subang','Kab. Sukabumi','Kab. Sumedang','Kab. Tasikmalaya'],
  'Banten': ['Serang','Cilegon','Tangerang','Tangerang Selatan','Kab. Lebak','Kab. Pandeglang','Kab. Serang','Kab. Tangerang'],
  'Jawa Tengah': ['Semarang','Surakarta','Salatiga','Magelang','Pekalongan','Tegal','Kab. Banjarnegara','Kab. Banyumas','Kab. Batang','Kab. Blora','Kab. Boyolali','Kab. Brebes','Kab. Cilacap','Kab. Demak','Kab. Grobogan','Kab. Jepara','Kab. Karanganyar','Kab. Kebumen','Kab. Kendal','Kab. Klaten','Kab. Kudus','Kab. Magelang','Kab. Pati','Kab. Pekalongan','Kab. Pemalang','Kab. Purbalingga','Kab. Purworejo','Kab. Rembang','Kab. Semarang','Kab. Sragen','Kab. Sukoharjo','Kab. Tegal','Kab. Temanggung','Kab. Wonogiri','Kab. Wonosobo'],
  'DI Yogyakarta': ['Yogyakarta','Kab. Bantul','Kab. Gunungkidul','Kab. Kulon Progo','Kab. Sleman'],
  'Jawa Timur': ['Surabaya','Batu','Blitar','Kediri','Madiun','Malang','Mojokerto','Pasuruan','Probolinggo','Kab. Bangkalan','Kab. Banyuwangi','Kab. Blitar','Kab. Bojonegoro','Kab. Bondowoso','Kab. Gresik','Kab. Jember','Kab. Jombang','Kab. Kediri','Kab. Lamongan','Kab. Lumajang','Kab. Madiun','Kab. Magetan','Kab. Malang','Kab. Mojokerto','Kab. Nganjuk','Kab. Ngawi','Kab. Pacitan','Kab. Pamekasan','Kab. Pasuruan','Kab. Ponorogo','Kab. Probolinggo','Kab. Sampang','Kab. Sidoarjo','Kab. Situbondo','Kab. Sumenep','Kab. Trenggalek','Kab. Tuban','Kab. Tulungagung'],
  'Bali': ['Denpasar','Kab. Badung','Kab. Bangli','Kab. Buleleng','Kab. Gianyar','Kab. Jembrana','Kab. Karangasem','Kab. Klungkung','Kab. Tabanan'],
  'Nusa Tenggara Barat': ['Mataram','Bima','Kab. Lombok Barat','Kab. Lombok Tengah','Kab. Lombok Timur','Kab. Lombok Utara','Kab. Sumbawa','Kab. Sumbawa Barat','Kab. Dompu','Kab. Bima'],
  'Nusa Tenggara Timur': ['Kupang','Kab. Alor','Kab. Belu','Kab. Ende','Kab. Flores Timur','Kab. Kupang','Kab. Lembata','Kab. Malaka','Kab. Manggarai','Kab. Manggarai Barat','Kab. Manggarai Timur','Kab. Nagekeo','Kab. Ngada','Kab. Rote Ndao','Kab. Sabu Raijua','Kab. Sikka','Kab. Sumba Barat','Kab. Sumba Barat Daya','Kab. Sumba Tengah','Kab. Sumba Timur','Kab. Timor Tengah Selatan','Kab. Timor Tengah Utara'],
  'Kalimantan Barat': ['Pontianak','Singkawang','Kab. Bengkayang','Kab. Kapuas Hulu','Kab. Kayong Utara','Kab. Ketapang','Kab. Kubu Raya','Kab. Landak','Kab. Melawi','Kab. Mempawah','Kab. Sambas','Kab. Sanggau','Kab. Sekadau','Kab. Sintang'],
  'Kalimantan Tengah': ['Palangka Raya','Kab. Barito Selatan','Kab. Barito Timur','Kab. Barito Utara','Kab. Gunung Mas','Kab. Kapuas','Kab. Katingan','Kab. Kotawaringin Barat','Kab. Kotawaringin Timur','Kab. Lamandau','Kab. Murung Raya','Kab. Pulang Pisau','Kab. Seruyan','Kab. Sukamara'],
  'Kalimantan Selatan': ['Banjarmasin','Banjarbaru','Kab. Balangan','Kab. Banjar','Kab. Barito Kuala','Kab. Hulu Sungai Selatan','Kab. Hulu Sungai Tengah','Kab. Hulu Sungai Utara','Kab. Kotabaru','Kab. Tabalong','Kab. Tanah Bumbu','Kab. Tanah Laut','Kab. Tapin'],
  'Kalimantan Timur': ['Samarinda','Balikpapan','Bontang','Kab. Berau','Kab. Kutai Barat','Kab. Kutai Kartanegara','Kab. Kutai Timur','Kab. Mahakam Ulu','Kab. Paser','Kab. Penajam Paser Utara'],
  'Kalimantan Utara': ['Tarakan','Kab. Bulungan','Kab. Malinau','Kab. Nunukan','Kab. Tana Tidung'],
  'Sulawesi Utara': ['Manado','Bitung','Kotamobagu','Tomohon','Kab. Bolaang Mongondow','Kab. Bolaang Mongondow Selatan','Kab. Bolaang Mongondow Timur','Kab. Bolaang Mongondow Utara','Kab. Kepulauan Sangihe','Kab. Kepulauan Siau Tagulandang Biaro','Kab. Kepulauan Talaud','Kab. Minahasa','Kab. Minahasa Selatan','Kab. Minahasa Tenggara','Kab. Minahasa Utara'],
  'Sulawesi Tengah': ['Palu','Kab. Banggai','Kab. Banggai Kepulauan','Kab. Banggai Laut','Kab. Buol','Kab. Donggala','Kab. Morowali','Kab. Morowali Utara','Kab. Parigi Moutong','Kab. Poso','Kab. Sigi','Kab. Tojo Una-Una','Kab. Toli-Toli'],
  'Sulawesi Barat': ['Mamuju','Kab. Majene','Kab. Mamasa','Kab. Mamuju Tengah','Kab. Pasangkayu','Kab. Polewali Mandar'],
  'Sulawesi Selatan': ['Makassar','Palopo','Parepare','Kab. Bantaeng','Kab. Barru','Kab. Bone','Kab. Bulukumba','Kab. Enrekang','Kab. Gowa','Kab. Jeneponto','Kab. Kepulauan Selayar','Kab. Luwu','Kab. Luwu Timur','Kab. Luwu Utara','Kab. Maros','Kab. Pangkajene dan Kepulauan','Kab. Pinrang','Kab. Sidenreng Rappang','Kab. Sinjai','Kab. Soppeng','Kab. Takalar','Kab. Tana Toraja','Kab. Toraja Utara','Kab. Wajo'],
  'Sulawesi Tenggara': ['Kendari','Bau-Bau','Kab. Bombana','Kab. Buton','Kab. Buton Selatan','Kab. Buton Tengah','Kab. Buton Utara','Kab. Konawe','Kab. Konawe Kepulauan','Kab. Konawe Selatan','Kab. Konawe Utara','Kab. Kolaka','Kab. Kolaka Timur','Kab. Kolaka Utara','Kab. Muna','Kab. Muna Barat','Kab. Wakatobi'],
  'Gorontalo': ['Gorontalo','Kab. Bone Bolango','Kab. Boalemo','Kab. Gorontalo','Kab. Gorontalo Utara','Kab. Pohuwato'],
  'Maluku': ['Ambon','Tual','Kab. Buru','Kab. Buru Selatan','Kab. Kepulauan Aru','Kab. Maluku Barat Daya','Kab. Maluku Tengah','Kab. Maluku Tenggara','Kab. Maluku Tenggara Barat','Kab. Seram Bagian Barat','Kab. Seram Bagian Timur'],
  'Maluku Utara': ['Ternate','Tidore Kepulauan','Kab. Halmahera Barat','Kab. Halmahera Selatan','Kab. Halmahera Tengah','Kab. Halmahera Timur','Kab. Halmahera Utara','Kab. Kepulauan Sula','Kab. Pulau Morotai','Kab. Pulau Taliabu'],
  'Papua': ['Jayapura','Kab. Asmat','Kab. Biak Numfor','Kab. Boven Digoel','Kab. Deiyai','Kab. Dogiyai','Kab. Intan Jaya','Kab. Jayapura','Kab. Jayawijaya','Kab. Keerom','Kab. Kepulauan Yapen','Kab. Lanny Jaya','Kab. Mamberamo Raya','Kab. Mamberamo Tengah','Kab. Mappi','Kab. Merauke','Kab. Mimika','Kab. Nabire','Kab. Nduga','Kab. Paniai','Kab. Pegunungan Bintang','Kab. Puncak','Kab. Puncak Jaya','Kab. Sarmi','Kab. Supiori','Kab. Tolikara','Kab. Waropen','Kab. Yahukimo','Kab. Yalimo'],
  'Papua Barat': ['Sorong','Kab. Fakfak','Kab. Kaimana','Kab. Manokwari','Kab. Manokwari Selatan','Kab. Maybrat','Kab. Pegunungan Arfak','Kab. Raja Ampat','Kab. Sorong','Kab. Sorong Selatan','Kab. Tambrauw','Kab. Teluk Bintuni','Kab. Teluk Wondama'],
};

// ── Form fields per category ──────────────────────────────────────────────────
const FORM_FIELDS = {
  venue: [
    { key: 'venue_name', label: 'Nama Venue', type: 'text', placeholder: 'GOR Merdeka Futsal', required: true },
    { key: 'sport_types', label: 'Jenis Olahraga Utama', type: 'select', options: SPORTS_LIST, required: true },
    { key: 'province', label: 'Provinsi', type: 'select', options: PROVINCES, required: true },
    { key: 'city', label: 'Kota / Kabupaten', type: 'city_select', required: true },
    { key: 'kecamatan', label: 'Kecamatan', type: 'district_select' },
    { key: 'address', label: 'Alamat Lengkap', type: 'text', placeholder: 'Jl. Sudirman No. 10', required: true },
    { key: 'court_count', label: 'Jumlah Lapangan / Area', type: 'number', placeholder: '4' },
    { key: 'has_online_booking', label: 'Sistem Booking Saat Ini', type: 'select', options: ['Belum ada', 'Sudah ada (ingin migrasi)', 'Pakai WhatsApp/manual'] },
    { key: 'message', label: 'Informasi Tambahan', type: 'textarea', placeholder: 'Ceritakan kondisi venue Anda...' },
  ],
  coach: [
    { key: 'sport', label: 'Cabang Olahraga', type: 'select', options: SPORTS_LIST, required: true },
    { key: 'experience_years', label: 'Pengalaman Melatih (tahun)', type: 'number', placeholder: '5', required: true },
    { key: 'license', label: 'Lisensi / Sertifikasi', type: 'text', placeholder: 'UEFA C, PBSI Level 1, dll.' },
    { key: 'province', label: 'Provinsi', type: 'select', options: PROVINCES, required: true },
    { key: 'city', label: 'Kota Domisili', type: 'city_select', required: true },
    { key: 'training_type', label: 'Jenis Pelatihan', type: 'select', options: ['Pelatihan individu', 'Pelatihan kelompok', 'Keduanya'] },
    { key: 'message', label: 'Tentang Anda', type: 'textarea', placeholder: 'Ceritakan pengalaman dan spesialisasi Anda...' },
  ],
  community: [
    { key: 'community_name', label: 'Nama Komunitas', type: 'text', placeholder: 'Komunitas Badminton Jogja', required: true },
    { key: 'community_category', label: 'Kategori Komunitas', type: 'select', options: COMMUNITY_CATEGORIES, required: true },
    { key: 'sport', label: 'Cabang Olahraga', type: 'select', options: SPORTS_LIST, required: true },
    { key: 'province', label: 'Provinsi', type: 'select', options: PROVINCES, required: true },
    { key: 'city', label: 'Kota / Kabupaten', type: 'city_select', required: true },
    { key: 'kecamatan', label: 'Kecamatan', type: 'district_select' },
    { key: 'member_count', label: 'Jumlah Anggota Aktif', type: 'number', placeholder: '20' },
    { key: 'social_media', label: 'Media Sosial / Link Grup', type: 'text', placeholder: 'Instagram / Link WhatsApp grup' },
    { key: 'message', label: 'Deskripsi Komunitas', type: 'textarea', placeholder: 'Ceritakan tentang komunitas Anda...' },
  ],
  team_operator: [
    { key: 'team_name', label: 'Nama Tim / Akademi', type: 'text', placeholder: 'FC Merdeka Jogja', required: true },
    { key: 'sport', label: 'Cabang Olahraga', type: 'select', options: SPORTS_LIST, required: true },
    { key: 'team_type', label: 'Tipe', type: 'select', options: ['Tim kompetitif', 'Akademi / sekolah sepakbola', 'Keduanya'] },
    { key: 'province', label: 'Provinsi', type: 'select', options: PROVINCES, required: true },
    { key: 'city', label: 'Kota / Kabupaten', type: 'city_select', required: true },
    { key: 'level', label: 'Level Kompetisi', type: 'select', options: ['Lokal/kota', 'Regional/provinsi', 'Nasional', 'Internasional'] },
    { key: 'message', label: 'Informasi Tambahan', type: 'textarea', placeholder: 'Prestasi, target kompetisi, dll.' },
  ],
  eo_operator: [
    { key: 'org_name', label: 'Nama Organisasi / EO', type: 'text', placeholder: 'PT Sport Events Indonesia', required: true },
    { key: 'sport', label: 'Cabang Olahraga Utama', type: 'select', options: SPORTS_LIST, required: true },
    { key: 'org_type', label: 'Tipe Organisasi', type: 'select', options: ['Event Organizer', 'Federasi', 'KONI / Dinas Olahraga', 'Lainnya'] },
    { key: 'province', label: 'Provinsi', type: 'select', options: PROVINCES, required: true },
    { key: 'city', label: 'Kota', type: 'city_select', required: true },
    { key: 'event_scale', label: 'Skala Event yang Biasa Diselenggarakan', type: 'select', options: ['Lokal (<100 peserta)', 'Regional (100-500 peserta)', 'Nasional (>500 peserta)'] },
    { key: 'website', label: 'Website / Instagram', type: 'text', placeholder: 'https://...' },
    { key: 'message', label: 'Deskripsi & Rencana Event', type: 'textarea', placeholder: 'Ceritakan event yang ingin diselenggarakan...' },
  ],
  sponsor: [
    { key: 'brand_name', label: 'Nama Brand / Perusahaan', type: 'text', placeholder: 'PT Maju Bersama', required: true },
    { key: 'industry', label: 'Industri', type: 'text', placeholder: 'Minuman olahraga, Peralatan olahraga...', required: true },
    { key: 'sponsorship_type', label: 'Jenis Sponsorship yang Diminati', type: 'select', options: ['Sponsorship turnamen', 'Kode promo & kampanye', 'Branding venue', 'Semua / Kombinasi'] },
    { key: 'budget_range', label: 'Kisaran Budget', type: 'select', options: ['< Rp 10 juta', 'Rp 10–50 juta', 'Rp 50–200 juta', '> Rp 200 juta', 'Diskusi lebih lanjut'] },
    { key: 'website', label: 'Website Perusahaan', type: 'text', placeholder: 'https://...' },
    { key: 'message', label: 'Pesan & Tujuan Kolaborasi', type: 'textarea', placeholder: 'Ceritakan apa yang ingin dicapai dari sponsorship ini...' },
  ],
};

// ── ApplicationModal ─────────────────────────────────────────────────────────
function ApplicationModal({ category, auth, onClose }) {
  const [form, setForm] = useState({ name: auth?.name || '', email: auth?.email || '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'province') {
      next.city = '';
      next.kecamatan = '';
    }
    if (k === 'city') {
      next.kecamatan = '';
    }
    return next;
  });
  const fields = FORM_FIELDS[category.key] || [];

  const handleSubmit = async () => {
    setError('');
    if (!form.name?.trim()) return setError('Nama lengkap wajib diisi.');
    if (!form.email?.trim()) return setError('Email wajib diisi.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Format email tidak valid.');
    const requiredField = fields.find((f) => f.required && !form[f.key]?.toString().trim());
    if (requiredField) return setError(`${requiredField.label} wajib diisi.`);

    try {
      setSaving(true);
      const { name, email, phone, ...rest } = form;
      const applicantName = name.trim();
      const applicantEmail = email.trim().toLowerCase();
      const applicantPhone = phone?.trim() || null;

      const { error: dbErr } = await supabase.from('partnership_applications').insert({
        type: category.key,
        applicant_name: applicantName,
        applicant_email: applicantEmail,
        applicant_phone: applicantPhone,
        applicant_user_id: auth?.id || null,
        details: rest,
      });
      if (dbErr) throw dbErr;

      const notificationEmail = import.meta.env.VITE_PARTNERSHIP_NOTIFICATION_EMAIL || 'taradfworkspace@gmail.com';
      const { error: emailErr } = await supabase.functions.invoke('send-partnership-notification', {
        body: {
          toEmail: notificationEmail,
          applicantName,
          applicantEmail,
          applicantPhone: applicantPhone || '',
          partnershipType: category.key,
          partnershipLabel: category.title,
          submittedAt: new Date().toISOString(),
          details: { ...rest },
        },
      });

      if (emailErr) {
        console.warn('Partnership notification email failed:', emailErr);
      }

      setDone(true);
    } catch (err) {
      setError(err.message || 'Gagal mengirim pendaftaran. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const Icon = category.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 z-10 bg-gradient-to-r ${category.gradient} px-5 py-4 flex items-center justify-between rounded-t-3xl`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon size={20} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">{category.title}</div>
              <div className="text-white/70 text-xs">{category.subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/20 text-white">
            <X size={18} />
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="p-8 text-center">
            <div className={`w-16 h-16 rounded-full ${category.bg} flex items-center justify-center mx-auto mb-4`}>
              <Check size={28} className={category.text} />
            </div>
            <h3 className="font-display text-2xl text-neutral-900 mb-2">Pendaftaran Terkirim!</h3>
            <p className="text-neutral-500 text-sm mb-6">
              Tim Stadione akan menghubungi Anda melalui email <strong>{form.email}</strong> dalam 1–3 hari kerja.
            </p>
            <button onClick={onClose}
              className={`px-6 py-3 rounded-2xl bg-gradient-to-r ${category.gradient} text-white text-sm font-bold`}>
              Tutup
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Applicant info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nama Lengkap *</label>
                <input className={inputCls} placeholder="Budi Santoso" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" className={inputCls} placeholder="email@kamu.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>No. WhatsApp / Telepon</label>
              <input className={inputCls} placeholder="08xxxxxxxxxx" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </div>

            {/* Divider */}
            <div className={`border-t ${category.border} pt-4`}>
              <div className={`text-xs font-bold uppercase tracking-widest ${category.text} mb-3`}>
                Detail {category.title}
              </div>
            </div>

            {/* Dynamic fields */}
            {fields.map((field) => (
              <div key={field.key}>
                <label className={labelCls}>
                  {field.label} {field.required && '*'}
                </label>
                {field.type === 'textarea' ? (
                  <textarea rows={3} className={`${inputCls} resize-none`} placeholder={field.placeholder}
                    value={form[field.key] || ''} onChange={(e) => set(field.key, e.target.value)} />
                ) : field.type === 'select' ? (
                  <select className={selectCls} value={form[field.key] || ''} onChange={(e) => set(field.key, e.target.value)}>
                    <option value="">Pilih...</option>
                    {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'city_select' ? (
                  <select className={selectCls} value={form[field.key] || ''} onChange={(e) => set(field.key, e.target.value)} disabled={!form.province}>
                    <option value="">{form.province ? 'Pilih kota / kabupaten...' : '— Pilih provinsi dulu —'}</option>
                    {Object.keys(WNI_REGION_DATA[form.province] || {}).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : field.type === 'district_select' ? (
                  <select className={selectCls} value={form[field.key] || ''} onChange={(e) => set(field.key, e.target.value)} disabled={!form.city}>
                    <option value="">{form.city ? 'Pilih kecamatan...' : '— Pilih kota/kabupaten dulu —'}</option>
                    {Object.keys((WNI_REGION_DATA[form.province] || {})[form.city] || {}).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <input type={field.type} className={inputCls} placeholder={field.placeholder}
                    value={form[field.key] || ''} onChange={(e) => set(field.key, e.target.value)} />
                )}
              </div>
            ))}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className={`rounded-xl ${category.bg} ${category.border} border px-4 py-3 text-xs ${category.text}`}>
              Dengan mendaftar, Anda setuju bahwa tim Stadione dapat menghubungi Anda untuk proses verifikasi lebih lanjut.
            </div>
          </div>
        )}

        {!done && (
          <div className="sticky bottom-0 bg-white border-t border-neutral-100 px-5 py-4 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-neutral-200 text-sm font-semibold text-neutral-600">
              Batal
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className={`flex-1 py-3 rounded-2xl bg-gradient-to-r ${category.gradient} text-white text-sm font-bold disabled:opacity-60`}>
              {saving ? 'Mengirim...' : category.cta}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PartnershipPage({ auth, onBack }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const STATS = [
    { value: '12+', label: 'Kota aktif' },
    { value: '2.000+', label: 'Pengguna terdaftar' },
    { value: '150+', label: 'Venue partner' },
    { value: '500+', label: 'Event digelar' },
  ];

  const WHY_US = [
    { icon: Zap, title: 'Setup Cepat', desc: 'Profil aktif dalam 24–48 jam setelah verifikasi.' },
    { icon: Shield, title: 'Aman & Terpercaya', desc: 'Pembayaran aman, data terlindungi, dukungan penuh.' },
    { icon: TrendingUp, title: 'Jangkauan Luas', desc: 'Akses ke ribuan pengguna aktif di seluruh Indonesia.' },
    { icon: Heart, title: 'Komunitas Solid', desc: 'Bergabung dengan ekosistem olahraga yang terus berkembang.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Back */}
      {onBack && (
        <div className="px-5 lg:px-8 pt-5">
          <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 font-medium">
            ← Kembali ke Beranda
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="px-5 lg:px-8 pt-12 pb-16 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest mb-6">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Kerjasama & Mitra Stadione
        </div>
        <h1 className="font-display text-4xl lg:text-6xl text-neutral-900 mb-4 leading-tight">
          Tumbuh Bersama<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-600">Stadione</span>
        </h1>
        <p className="text-neutral-500 text-base lg:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Jadilah bagian dari ekosistem olahraga Indonesia yang terus berkembang. Daftarkan venue, komunitas, atau keahlian Anda dan jangkau lebih banyak orang.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-2xl font-bold text-neutral-900">{s.value}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Category cards */}
      <section className="px-5 lg:px-8 pb-20 max-w-6xl mx-auto">
        <h2 className="font-display text-2xl lg:text-3xl text-neutral-900 text-center mb-3">Pilih Program Kerjasama</h2>
        <p className="text-neutral-500 text-sm text-center mb-10">Pilih kategori yang sesuai dan isi formulir pendaftaran.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.key}
                className={`relative rounded-3xl border ${cat.border} ${cat.bg} p-6 flex flex-col hover:shadow-lg transition-all duration-200 cursor-pointer group`}
                onClick={() => setSelectedCategory(cat)}>
                {cat.tag && (
                  <span className={`absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full ${cat.badge}`}>
                    {cat.tag}
                  </span>
                )}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-4 shadow-md`}>
                  <Icon size={22} className="text-white" />
                </div>
                <div className={`text-xs font-bold uppercase tracking-widest ${cat.text} mb-1`}>{cat.subtitle}</div>
                <h3 className="font-display text-xl text-neutral-900 mb-2">{cat.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed mb-5 flex-1">{cat.description}</p>
                <ul className="space-y-1.5 mb-5">
                  {cat.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-neutral-600">
                      <Check size={13} className={cat.text} />
                      {b}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-2xl bg-gradient-to-r ${cat.gradient} text-white text-sm font-bold flex items-center justify-center gap-2 group-hover:opacity-90 transition`}>
                  {cat.cta}
                  <ChevronRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why partner with us */}
      <section className="bg-neutral-900 text-white px-5 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl lg:text-3xl text-center mb-10">Mengapa Bermitra dengan Stadione?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_US.map((w) => {
              const WIcon = w.icon;
              return (
                <div key={w.title} className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                    <WIcon size={22} className="text-white" />
                  </div>
                  <div className="font-bold text-white mb-1">{w.title}</div>
                  <div className="text-neutral-400 text-sm leading-relaxed">{w.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="px-5 lg:px-8 py-16 max-w-3xl mx-auto text-center">
        <h2 className="font-display text-2xl lg:text-3xl text-neutral-900 mb-3">Punya Pertanyaan?</h2>
        <p className="text-neutral-500 text-sm mb-6">Tim partnership kami siap membantu Anda. Hubungi kami melalui email atau WhatsApp.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="mailto:partnership@stadione.id"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 hover:border-neutral-900 transition">
            <Mail size={15} /> partnership@stadione.id
          </a>
          <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
            <Phone size={15} /> WhatsApp Kami
          </a>
        </div>
      </section>

      {/* Modal */}
      {selectedCategory && (
        <ApplicationModal
          category={selectedCategory}
          auth={auth}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}
