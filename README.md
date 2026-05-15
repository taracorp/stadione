# 🏟️ Stadione - Platform Olahraga Indonesia

Platform all-in-one untuk booking lapangan, turnamen olahraga, berita, dan pelatih profesional.

## 🚀 Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Charts**: Recharts

## 📋 Fitur Utama

1. **Booking Lapangan** - Pesan venue sepakbola, futsal, renang, padel dengan instant confirmation
2. **Turnamen & Liga** - Buat turnamen dengan klasemen otomatis, bracket knockout
3. **Berita Olahraga** - Update berita real-time dari 8 cabang olahraga
4. **Pelatihan** - Book pelatih profesional bersertifikat nasional
5. **Chat** - Komunikasi langsung dengan pelatih

## 🔧 Setup & Installation

### Prerequisites
- Node.js 16+
- npm atau yarn
- Supabase account (free tier tersedia)

### Installation

```bash
# Clone repository
git clone https://github.com/taracorp/stadione.git
cd stadione

# Install dependencies
npm install

# Setup .env.local
cp .env.local.example .env.local  # atau buat manual
# Edit .env.local dengan Supabase credentials kamu
```

### Konfigurasi Supabase

Lihat dokumentasi lengkap di [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

Ringkas:
1. Ambil URL dan anon key dari Supabase dashboard
2. Set di `.env.local`
3. Import `supabase-schema.sql`, lalu `supabase-tournament-rls.sql`, lalu `supabase-community.sql` ke Supabase SQL editor
4. Run aplikasi

### Development

```bash
# Start dev server
npm run dev

# Buka http://localhost:5173
```

### Build untuk Production

```bash
# Build
npm run build

# Preview
npm run preview
```

## 📁 Project Structure

```
stadione/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase client config
│   ├── services/
│   │   └── supabaseService.js   # All database queries
│   ├── hooks/
│   │   └── useSupabase.js       # Custom React hooks
│   ├── context/
│   │   └── DataContext.jsx      # Data context provider
│   ├── main.jsx                 # React entry point
│   └── App.jsx
├── stadione.jsx                 # Main app component
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── supabase-schema.sql          # Database schema & seed
├── supabase-tournament-rls.sql  # Roles, permissions, verification workflow
├── supabase-community.sql       # Community feed, chat, academy trial schema
└── SUPABASE_SETUP.md            # Setup guide
```

## 📊 Database Schema

### Tables:
- `venues` - Data lapangan olahraga
- `venue_tags` - Tag lapangan (outdoor, AC, dll)
- `tournaments` - Turnamen olahraga
- `tournament_standings` - Klasemen turnamen
- `tournament_schedule` - Jadwal pertandingan
- `tournament_bracket_rounds` - Ronde bracket knockout
- `tournament_bracket_matches` - Pertandingan bracket
- `news` - Artikel berita olahraga
- `coaches` - Data pelatih
- `coach_certs` - Sertifikasi pelatih
- `coach_extra` - Bio & info tambahan pelatih
- `coach_languages` - Bahasa pelatih
- `coach_schedule` - Jadwal pelatih
- `coach_programs` - Program latihan pelatih
- `chats` - Chat dengan pelatih
- `chat_messages` - Pesan dalam chat

## 🔌 API Usage

```javascript
import { 
  fetchVenues, 
  fetchTournaments, 
  fetchNews, 
  fetchCoaches, 
  fetchChats 
} from './src/services/supabaseService.js';

// Fetch all venues
const venues = await fetchVenues();

// Fetch tournament detail dengan standings & schedule
const tournamentDetail = await fetchTournamentDetail(1);

// Fetch coaches dengan bio, sertif, program
const coaches = await fetchCoaches();
```

## 🎣 Custom Hooks

```javascript
import { 
  useVenues, 
  useTournaments, 
  useNews, 
  useCoaches, 
  useChats 
} from './src/hooks/useSupabase.js';

function MyComponent() {
  const { venues, loading, error } = useVenues();
  
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  
  return <div>{venues.length} venues</div>;
}
```

## 🚀 Deployment

### Deploy ke Vercel

```bash
# Push ke GitHub
git push origin main

# Vercel akan auto-deploy
# Jangan lupa set env variables di Vercel dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

Lihat production di: https://stadione.vercel.app

## 📝 Data Format

### Venue
```javascript
{
  id: 1,
  name: 'GOR Senayan Mini Soccer',
  city: 'Jakarta Pusat',
  sport: 'Sepakbola',
  price: 450000,
  rating: 4.8,
  reviews: 234,
  color: '#0F4D2A',
  tags: ['Outdoor', 'Floodlight', 'Parkir']
}
```

### Tournament
```javascript
{
  id: 1,
  name: 'Liga Futsal Jakarta 2026',
  sport: 'Futsal',
  format: 'Liga' | 'Knockout',
  teams: 12,
  status: 'Berlangsung' | 'Pendaftaran',
  prize: 50000000,
  startDate: '15 Mar 2026',
  color: '#92400E',
  host: 'StadioneSports',
  participants: 156,
  standings: [...],
  schedule: [...]
}
```

## 🆘 Troubleshooting

### Port sudah dipakai
```bash
# Kill process pada port 5173
lsof -ti:5173 | xargs kill -9

# Atau gunakan port lain
npm run dev -- --port 5174
```

### Supabase connection error
- Cek `.env.local` sudah filled
- Cek URL dan key valid di Supabase dashboard
- Periksa browser console untuk error detail

### Build gagal
```bash
# Clear cache dan install ulang
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📄 License

MIT License - Gratis untuk commercial & non-commercial use

## 👨‍💻 Support

Issues? Email: taradfworkspace@gmail.com

---

**Happy coding! 🏟️⚽**
