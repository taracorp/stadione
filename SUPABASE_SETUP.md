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
4. Jalankan file SQL dengan urutan berikut:
  1. `supabase-schema.sql`
  2. `supabase-tournament-rls.sql`
  3. `supabase-community.sql`
  4. `supabase-activity-rls-fix.sql` (wajib jika riwayat aktivitas tidak tercatat)
  5. `supabase-admin-notifications.sql` (notifikasi partnership masuk untuk super admin)
5. Tunggu sampai masing-masing query selesai ✓

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
- ✓ app_roles
- ✓ app_permissions
- ✓ role_permissions
- ✓ user_roles
- ✓ admin_audit_logs
- ✓ tournament_operator_verification_requests
- ✓ tournament_registrations
- ✓ tournament_registration_roster
- ✓ sport_communities
- ✓ community_memberships
- ✓ community_feed_posts
- ✓ community_events
- ✓ community_chat_messages
- ✓ academy_trial_bookings

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

## 6. Role & Permission Mapping

Stadione memakai `user_roles` dan `get_current_user_permissions()` sebagai sumber utama akses. Untuk menjaga UI tetap konsisten saat RPC permission belum mengembalikan data, frontend punya fallback ringan di `src/services/supabaseService.js`.

Fallback ini hanya lapisan bantu di client. RLS, `app_roles`, `app_permissions`, dan `role_permissions` tetap menjadi sumber otoritas utama di Supabase.

### Mapping fallback yang dipakai frontend

| Role | Permission fallback |
| --- | --- |
| `super_admin` | `platform.all`, `operator.verify`, `registration.approve`, `registration.reject`, `payment.verify` |
| `internal_admin` | `platform.all`, `operator.verify`, `registration.approve`, `registration.reject`, `payment.verify` |
| `reviewer` | `operator.verify` |
| `verification_admin` | `operator.verify` |
| `admin` | `operator.verify` |
| `finance_admin` | `payment.verify`, `registration.approve` |

### Catatan implementasi

- Jika `get_current_user_permissions()` berhasil, hasil RPC tetap dipakai.
- Jika RPC kosong atau gagal, frontend akan membaca `user_roles` dan menurunkan permission dasar dari mapping di atas.
- Mapping ini membantu menjaga item seperti verifikasi, platform console, dan approval workflow tetap muncul hanya untuk role yang relevan.

### Bootstrap super admin pertama

Jika akun dengan email `taradfworkspace@gmail.com` sudah ada di `auth.users`, jalankan query ini di SQL Editor untuk memberi role `super_admin`:

```sql
INSERT INTO user_roles (user_id, role, granted_by)
SELECT id, 'super_admin', id
FROM auth.users
WHERE email = 'taradfworkspace@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

Jika email tersebut belum terdaftar, buat akun dulu lewat auth flow biasa, lalu jalankan query di atas.

### Notifikasi Partnership Baru

Sistem partnership sekarang mengirim dua jenis notifikasi:

1. In-app notification lewat tabel `admin_notifications` dan trigger di `partnership_applications`.
2. Email notification lewat edge function `send-partnership-notification`.

Untuk email notification, pastikan environment variable berikut tersedia saat deploy:

```env
VITE_PARTNERSHIP_NOTIFICATION_EMAIL=taradfworkspace@gmail.com
```

Kalau variabel ini tidak diisi, frontend akan memakai fallback ke email super admin di atas.

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
