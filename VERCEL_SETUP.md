# Deploy ke Vercel + Setup Supabase Environment Variables

Panduan deploy Stadione ke Vercel dengan konfigurasi Supabase yang sesuai flow auth terbaru.

## 1. Import Project ke Vercel

1. Buka https://vercel.com
2. Login dengan GitHub
3. Add New -> Project
4. Pilih repo `stadione`
5. Import

## 2. Set Environment Variables

Di Vercel Project -> Settings -> Environment Variables, pastikan variabel berikut ada:

- `VITE_SUPABASE_URL` = URL project Supabase
- `VITE_SUPABASE_ANON_KEY` = anon public key Supabase

Opsional kompatibilitas tambahan (karena app juga membaca prefix lain):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Disarankan tetap mengisi minimal pasangan `VITE_*`.

## 3. Konfigurasi Auth Redirect (Wajib)

Selain env var, flow login Google dan reset password juga butuh konfigurasi di Supabase Dashboard.

Buka Supabase -> Authentication -> URL Configuration:

- Site URL:
  - `https://stadione.vercel.app`
- Additional Redirect URLs:
  - `https://stadione.vercel.app`
  - `http://localhost:5173` (untuk pengujian lokal)

Buka Supabase -> Authentication -> Providers -> Google:
- Enable Google provider
- Isi Google Client ID dan Client Secret
- Pastikan redirect URL dari Supabase sudah didaftarkan pada Google OAuth app

## 4. Deploy dan Verifikasi

1. Trigger redeploy dari Vercel
2. Buka URL production
3. Uji minimum berikut:
   - Login Google
   - Signup email/password (wajib verifikasi email)
   - Forgot password -> buka link reset -> set password baru

## 5. Checklist Cepat Jika Auth Tidak Jalan di Production

1. Environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` benar
2. Redeploy sudah dilakukan setelah update env var
3. Domain production masuk ke Supabase URL Configuration
4. Google provider aktif di Supabase
5. Redirect URL Supabase sudah didaftarkan di Google OAuth app
6. Link reset password mengarah kembali ke domain production
7. Coba mode incognito untuk menghindari cache/session lama

## Troubleshooting

### Banner Supabase belum terkonfigurasi

Penyebab:
- Env var belum terisi, salah, atau belum redeploy.

Solusi:
- Verifikasi env var di Vercel dan lakukan redeploy.

### Login Google gagal di production

Penyebab umum:
- Google provider belum aktif
- Redirect URI mismatch di Google OAuth app

Solusi:
- Samakan redirect URI antara Supabase dan Google Cloud OAuth config.

### Reset password tidak kembali ke app

Penyebab:
- Domain redirect belum terdaftar di Supabase URL Configuration.

Solusi:
- Tambah domain production dan lokal di Additional Redirect URLs.

## Referensi

- Supabase Project API: https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/settings/api
- Supabase Auth URL Config: https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/auth/url-configuration
- Vercel Project Settings: https://vercel.com/dashboard
