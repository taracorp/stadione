# Supabase Authentication Setup Guide

## Overview

Stadione sekarang memakai auth flow berikut:
- Google OAuth (aktif)
- Email + password (aktif)
- Forgot password + reset password recovery (aktif)
- Email verification wajib untuk registrasi email/password
- Facebook login (dinonaktifkan dari UI)

Catatan produksi:
- Domain produksi yang harus dipakai untuk redirect auth adalah `https://stadione.vercel.app`.
- Hindari memakai subdomain project Vercel lama agar reset password tidak diarahkan ke login Vercel.

## Implementasi Saat Ini

Lokasi utama implementasi ada di `stadione.jsx`:
- `AUTH_MODAL_MODES`: `login`, `register`, `forgot-password`, `recovery`
- Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Daftar via Google dan login via Google memakai flow OAuth yang sama; perbedaannya hanya konteks tombol di modal.
- Register email/password: `supabase.auth.signUp(...)` dengan `emailRedirectTo`
- Forgot password: `supabase.auth.resetPasswordForEmail(...)` dengan `redirectTo`
- Recovery update password: `supabase.auth.updateUser({ password })`
- Bootstrap auth state: `onAuthStateChange(...)` dipasang sebelum `getSession()` agar callback OAuth/recovery tidak terlewat.
- Recovery listener: event `PASSWORD_RECOVERY`
- Error callback OAuth/reset dari URL dibaca dan ditampilkan di modal sebelum URL dibersihkan.

## Prasyarat Konfigurasi Supabase

Buka Supabase Dashboard untuk project:
- Authentication -> Providers -> Google
- Authentication -> URL Configuration

### 1. Google Provider

Pastikan:
- Provider Google aktif (Enable)
- Client ID dan Client Secret valid
- Redirect URL yang diminta Supabase sudah didaftarkan di Google Cloud OAuth app

### 2. URL Configuration

Tambahkan URL berikut pada Supabase Auth:
- Site URL:
  - Lokal: `http://localhost:5173`
  - Produksi: `https://stadione.vercel.app`
- Additional Redirect URLs:
  - `http://localhost:5173`
  - `https://stadione.vercel.app`

Penting:
- Jangan tambahkan domain preview Vercel (contoh: `https://stadione-taracorps-projects.vercel.app`) ke Additional Redirect URLs produksi.
- Jika domain preview pernah terdaftar, hapus untuk mencegah callback Google OAuth kembali ke host non-kanonik.

Catatan:
- Aplikasi menggunakan query `auth_mode=recovery` saat reset password.
- Karena redirect kembali ke root URL app, URL root wajib terdaftar sebagai redirect URL.

### 3. Email Verification

Untuk email/password signup, pastikan verifikasi email aktif di Supabase Auth settings.
Perilaku aplikasi:
- Setelah signup, user diminta verifikasi email dulu
- User tidak di-auto-login setelah signup email/password

## Alur yang Perlu Diuji

## 1) Login Google

1. Klik Masuk
2. Klik Lanjut dengan Google
3. Selesaikan consent di Google
4. Kembali ke app dalam keadaan login

## 2) Daftar via Google

1. Klik Daftar
2. Klik Daftar dengan Google
3. Selesaikan consent di Google
4. Kembali ke app dalam keadaan login
5. Buka profil dan pastikan stats/riwayat tidak error untuk user baru

## 3) Register Email/Password

1. Klik Daftar
2. Isi nama, email, password
3. Submit
4. Muncul pesan untuk cek email verifikasi
5. Verifikasi via link email
6. Login dengan akun yang sudah diverifikasi

## 4) Forgot Password + Recovery

1. Dari tab Masuk klik Lupa password
2. Masukkan email akun
3. Klik Kirim link reset
4. Buka link reset dari email
5. App masuk mode recovery
6. Isi password baru + konfirmasi
7. Submit dan pastikan user bisa lanjut memakai akun atau login ulang dengan password baru

## Troubleshooting

### Login Google gagal

Cek:
- Google provider sudah Enable di Supabase
- Redirect URL Supabase sudah didaftarkan di Google OAuth app
- URL domain app (lokal/produksi) ada di Supabase URL Configuration
- Jika modal menampilkan error redirect/OAuth, cek pesan error URL callback yang ditampilkan app.

### Error email belum dikonfirmasi

Penyebab:
- User mencoba login sebelum klik link verifikasi email.

Solusi:
- Minta user cek inbox/spam lalu verifikasi email.

### Link reset password kembali ke halaman kosong/salah

Cek:
- `http://localhost:5173` dan `https://stadione.vercel.app` ada di Additional Redirect URLs Supabase
- Domain yang dipakai user sesuai daftar redirect

### Recovery mode tidak terbuka

Cek:
- URL redirect dari email reset mengandung parameter auth Supabase
- Event `PASSWORD_RECOVERY` diterima pada app bootstrap
- Tidak ada script/router lain yang menghapus query terlalu dini

## Catatan Keamanan

- Jangan commit service-role key ke frontend
- Hanya gunakan anon key di frontend
- Untuk produksi, gunakan domain final dan pastikan semua redirect URL konsisten
