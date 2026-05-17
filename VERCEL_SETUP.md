# Deploy ke Vercel + Setup Supabase Environment Variables

Panduan deploy Stadione ke Vercel dengan konfigurasi Supabase yang sesuai flow auth terbaru.

Catatan:
- Domain produksi aktif untuk repo ini adalah `https://stadione.vercel.app`.
- Jangan gunakan domain project Vercel lama untuk redirect auth atau email reset password.

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
- `VITE_PARTNERSHIP_NOTIFICATION_EMAIL` = email tujuan notifikasi partnership baru (opsional, default super admin)

Penting:
- Isi value tanpa tanda kutip (`"` atau `'`).
- Pastikan key tidak terpotong, tidak ada spasi, dan tidak ada newline.
- Setelah mengubah env var di Vercel, wajib redeploy production deployment.

Opsional kompatibilitas tambahan (karena app juga membaca prefix lain):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Disarankan tetap mengisi minimal pasangan `VITE_*`.
Untuk partnership notifications, isi `VITE_PARTNERSHIP_NOTIFICATION_EMAIL` bila ingin email tujuan berbeda dari fallback super admin.

## 3. Konfigurasi Auth Redirect (Wajib)

Selain env var, flow login Google dan reset password juga butuh konfigurasi di Supabase Dashboard.

Buka Supabase -> Authentication -> URL Configuration:

- Site URL:
  - `https://stadione.vercel.app`
- Additional Redirect URLs:
  - `https://stadione.vercel.app`
  - `http://localhost:5173` (untuk pengujian lokal)

Penting:
- Jangan masukkan domain preview Vercel (misalnya `https://stadione-taracorps-projects.vercel.app`) di konfigurasi produksi Supabase Auth.
- Callback OAuth yang masuk ke preview domain dapat membuat user terlihat seperti masuk ke environment berbeda.

Buka Supabase -> Authentication -> Providers -> Google:
- Enable Google provider
- Isi Google Client ID dan Client Secret
- Pastikan redirect URL dari Supabase sudah didaftarkan pada Google OAuth app

## 4. Deploy dan Verifikasi

1. Trigger redeploy dari Vercel
2. Buka URL production
3. Uji minimum berikut:
   - Login Google
   - Daftar Google dari tab Daftar
   - Signup email/password (wajib verifikasi email)
   - Forgot password -> buka link reset -> set password baru

## 5. Checklist Cepat Jika Auth Tidak Jalan di Production

1. Environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` benar
2. Redeploy sudah dilakukan setelah update env var
3. Domain production masuk ke Supabase URL Configuration
4. Google provider aktif di Supabase
5. Redirect URL Supabase sudah didaftarkan di Google OAuth app
6. Link reset password mengarah kembali ke domain production
7. Setelah callback Google/reset password, app tidak menyisakan error/hash auth di URL
8. Coba mode incognito untuk menghindari cache/session lama

## Troubleshooting

### Banner Supabase belum terkonfigurasi

Penyebab:
- Env var belum terisi, salah, atau belum redeploy.

Solusi:
- Verifikasi env var di Vercel dan lakukan redeploy.

### Login menampilkan "Invalid API key"

Penyebab:
- `VITE_SUPABASE_ANON_KEY` di Vercel salah, terpotong, atau dipaste dengan tanda kutip/newline.
- Production deployment belum diredeploy setelah env var diperbaiki.

Solusi:
- Copy ulang anon public key dari Supabase Project Settings -> API.
- Paste ke Vercel sebagai raw value tanpa tanda kutip.
- Redeploy production.
- App juga punya fallback anon key untuk project Stadione, tetapi env Vercel tetap harus dibenahi agar deployment tidak bergantung pada fallback.

### Login Google gagal di production

Penyebab umum:
- Google provider belum aktif
- Redirect URI mismatch di Google OAuth app

Solusi:
- Samakan redirect URI antara Supabase dan Google Cloud OAuth config.
- Uji dari tab Masuk dan tab Daftar karena keduanya memakai OAuth Google yang sama.

### Reset password tidak kembali ke app

Penyebab:
- Domain redirect belum terdaftar di Supabase URL Configuration.
- Link reset lama sudah pernah dipakai atau expired.

Solusi:
- Tambah domain production dan lokal di Additional Redirect URLs.
- Kirim ulang link reset dan selalu buka link terbaru dari email.

## Referensi

- Supabase Project API: https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/settings/api
- Supabase Auth URL Config: https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/auth/url-configuration
- Vercel Project Settings: https://vercel.com/dashboard
