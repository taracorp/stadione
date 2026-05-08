# Setup Supabase untuk Stadione

Aplikasi sudah terintegrasi dengan Supabase. Ikuti langkah-langkah berikut untuk menghubungkan database:

## 1. Dapatkan Credentials dari Supabase

1. Login ke [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Buka project `bkjsqfcjylgmxlauatwt` (atau project kamu)
3. Pergi ke **Settings → API**
4. Copy:
   - **Project URL** (contoh: `https://bkjsqfcjylgmxlauatwt.supabase.co`)
   - **anon public** key (untuk `VITE_SUPABASE_ANON_KEY`)

## 2. Setup .env.local

Edit file `.env.local` di root project:

```env
VITE_SUPABASE_URL=https://bkjsqfcjylgmxlauatwt.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Ganti `your_anon_key_here` dengan kunci yang sudah dicopy.

## 3. Import SQL Schema ke Supabase

1. Buka project Supabase dashboard
2. Klik **SQL Editor** di sidebar
3. Buat query baru
4. Copy seluruh isi file `supabase-schema.sql` ke SQL editor
5. Jalankan (klik tombol play atau Ctrl+Enter)
6. Tunggu sampai selesai ✓

## 4. Verifikasi Tabel

Setelah SQL selesai, periksa di **Table Editor**:
- ✓ venues
- ✓ venue_tags
- ✓ tournaments
- ✓ tournament_standings
- ✓ tournament_schedule
- ✓ tournament_bracket_rounds
- ✓ tournament_bracket_matches
- ✓ news
- ✓ coaches
- ✓ coach_certs
- ✓ coach_extra
- ✓ coach_languages
- ✓ coach_schedule
- ✓ coach_programs
- ✓ chats
- ✓ chat_messages

## 5. Test Koneksi

```bash
cd /workspaces/stadione
npm run dev
```

Aplikasi akan otomatis fetch data dari Supabase. Jika gagal, fallback ke hardcoded data.

## API Calls Yang Tersedia

Semua fungsi ada di `src/services/supabaseService.js`:

- `fetchVenues()` - Ambil semua venue
- `fetchTournaments()` - Ambil semua turnamen
- `fetchNews()` - Ambil berita
- `fetchCoaches()` - Ambil pelatih
- `fetchChats()` - Ambil chat
- `fetchTournamentDetail(id)` - Detail turnamen + standings & schedule
- `fetchCoachDetail(id)` - Detail pelatih + bio, languages, programs

## Custom Hooks

Gunakan di component manapun:

```javascript
import { useVenues, useTournaments, useNews, useCoaches, useChats } from './src/hooks/useSupabase';

function MyComponent() {
  const { venues, loading, error } = useVenues();
  const { tournaments, loading: tourLoading } = useTournaments();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{venues.length} venues found</div>;
}
```

## Troubleshooting

### "Cannot find module" error
- Pastikan path import benar: `./src/config/supabase.js`
- Restart dev server

### Data tidak ter-load
- Cek console browser (F12 → Console)
- Pastikan `.env.local` sudah filled dengan benar
- Periksa Supabase dashboard apakah table sudah ada

### Row Level Security (RLS) error
- Jika mendapat 403 Forbidden, disable RLS sementara atau setup RLS policies
- Settings → Authentication → Policies

---

**Dokumentasi lengkap Supabase:** https://supabase.com/docs
