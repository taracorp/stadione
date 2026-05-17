# Partnership Notification - One Page Execution

Target: notifikasi partnership aktif penuh (In-App + Email) di production.
Waktu: 20-30 menit.

## A. Siapkan Data Dasar di Supabase

1. Buka Supabase SQL Editor.
2. Jalankan file `scripts/add-partnership-applications.sql`.
3. Jalankan file `supabase-admin-notifications.sql`.

Sukses jika:
- Tabel `partnership_applications` ada.
- Tabel `admin_notifications` ada.
- Trigger `trg_create_notification_on_partnership` ada.

## B. Siapkan Secret Email di Supabase

Set secret berikut:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Contoh command:

```bash
npx supabase secrets set \
  RESEND_API_KEY="YOUR_RESEND_API_KEY" \
  RESEND_FROM_EMAIL="Stadione <no-reply@yourdomain.com>" \
  --project-ref "YOUR_PROJECT_REF"
```

## C. Deploy Edge Function Email

Deploy function:
- `supabase/functions/send-partnership-notification/index.ts`

Contoh command:

```bash
npx supabase functions deploy send-partnership-notification --project-ref "YOUR_PROJECT_REF"
```

## D. Set Environment Variable di Vercel

Minimal:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Opsional (disarankan):
- `VITE_PARTNERSHIP_NOTIFICATION_EMAIL`

Catatan:
- Jika `VITE_PARTNERSHIP_NOTIFICATION_EMAIL` tidak diisi, sistem pakai email fallback super admin.
- Setelah ubah env var, lakukan redeploy Vercel.

## E. Verifikasi Cepat End-to-End

1. Buka halaman partnership dan submit 1 form baru.
2. Cek di Supabase:
   - Ada row baru di `partnership_applications`.
   - Ada row baru di `admin_notifications`.
3. Login super admin -> buka workspace sponsor:
   - Badge unread muncul.
   - Klik badge -> unread turun.
4. Cek inbox email tujuan:
   - Email notifikasi partnership masuk.

## F. Kalau Ada Error

- Form submit gagal:
  - Cek `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di Vercel.
- In-app notif tidak muncul:
  - Cek `supabase-admin-notifications.sql` sudah jalan dan trigger ada.
- Email tidak masuk:
  - Cek secret `RESEND_API_KEY` dan `RESEND_FROM_EMAIL`.
  - Cek function `send-partnership-notification` sudah terdeploy.

## G. Done Criteria

Implementasi dianggap selesai jika:
- Submit partnership berhasil.
- In-app admin notification muncul.
- Email notification terkirim.
- Unread badge bisa ditandai selesai.
