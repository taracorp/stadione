# Deploy ke Vercel + Setup Supabase Environment Variables

Panduan lengkap untuk deploy Stadione ke Vercel dengan konfigurasi Supabase yang benar.

## 1. Login & Connect GitHub ke Vercel

1. Buka https://vercel.com
2. Klik **Login** → pilih **GitHub**
3. Authorize Vercel untuk akses repo GitHub kamu

## 2. Import Project ke Vercel

1. Klik **Add New** → **Project**
2. Pilih repo `stadione` dari GitHub
3. Klik **Import**

Vercel akan auto-detect Next.js/Vite configuration dan setup building.

## 3. **PENTING: Set Environment Variables**

Sebelum deploy, kamu HARUS set environment variables di Vercel:

1. Di halaman Import Project, lihat bagian **Environment Variables**
2. Tambah 2 variables:

   **Variable 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://bkjsqfcjylgmxlauatwt.supabase.co`

   **Variable 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `[COPY DARI SUPABASE DASHBOARD]`
     - Buka: https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/settings/api
     - Cari "Project API keys"
     - Copy value dari "anon public" key

3. Klik **Deploy**

Vercel akan mulai build dan deploy aplikasi kamu.

## 4. Verifikasi Deployment

Setelah Vercel selesai (biasanya 2-5 menit):

1. Klik link yang muncul (contoh: `https://stadione-xxx.vercel.app`)
2. Aplikasi harus muncul tanpa banner warning berwarna kuning
3. Homepage, Booking, Tournament semuanya harus bisa diklik

Jika masih ada banner kuning "Supabase belum terkonfigurasi", berarti:
- Environment variables tidak tersimpan dengan benar
- Kamu perlu redeploy dengan memasukkan variable yang tepat

## 5. Update Environment Variables (Jika Ada Kesalahan)

Kalau environment variable salah atau ingin update:

1. Pergi ke project dashboard Vercel
2. Klik **Settings** → **Environment Variables**
3. Edit atau tambah variable baru
4. Klik **Deploy** untuk trigger redeploy otomatis

## 6. Siap Deploy!

Setelah environment variables benar, deployment seharusnya sukses dan app bisa:
- ✓ Login/Register
- ✓ Lihat daftar venue, turnamen, berita
- ✓ Fetch data dari Supabase
- ✓ Chat dengan coach
- ✓ Book venue atau sesi latihan

---

## Troubleshooting

### "Supabase belum terkonfigurasi dengan benar" - Banner masih muncul
**Penyebab:** Environment variable tidak terisi atau masih placeholder
**Solusi:**
1. Buka project Vercel → Settings → Environment Variables
2. Pastikan `VITE_SUPABASE_ANON_KEY` bukan `your_anon_key_here`
3. Redeploy dengan klik **Deployments** → **...** → **Redeploy**

### Build gagal di Vercel
**Penyebab:** Build command error atau missing dependencies
**Solusi:**
1. Lihat build log di Vercel dashboard
2. Pastikan semua dependencies ada di `package.json`
3. Jalankan `npm run build` lokal untuk debug

### Data tidak muncul setelah deploy
**Penyebab:** API key tidak valid atau SQL schema belum diimport
**Solusi:**
1. Cek di browser console (F12 → Console) - lihat error message
2. Pastikan SQL schema sudah diimport ke Supabase (lihat SUPABASE_SETUP.md)
3. Verifikasi API key di Supabase dashboard masih valid

---

**URL Project Supabase:** https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/settings/api
