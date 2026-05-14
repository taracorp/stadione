# AGENTS.md

Panduan ini ditujukan untuk coding agent yang bekerja di repository Stadione.

## Tujuan
- Menjaga perubahan tetap kecil, aman, dan sesuai arsitektur React + Vite + Supabase.
- Memprioritaskan stabilitas fitur gamification (points, badges, leaderboard, achievements).
- Menghindari perubahan besar pada API publik tanpa kebutuhan jelas.

## Stack Utama
- Frontend: React 18 + Vite
- Styling: Tailwind CSS
- Data/API: Supabase (`@supabase/supabase-js`)
- Visual/chart: Recharts

## Struktur Penting
- `src/components/`: Komponen UI, termasuk `GamificationUI.jsx`
- `src/context/`: State global (`DataContext.jsx`)
- `src/hooks/`: Hook reusable (`useGamification.js`, `useSupabase.js`)
- `src/services/`: Logika akses data (`gamificationService.js`, `supabaseService.js`)
- `src/config/supabase.js`: Inisialisasi client Supabase
- `src/examples/`: Contoh integrasi fitur
- `supabase-*.sql`: Skema/fungsi SQL untuk backend gamification

## Perintah Kerja
- Install dependency: `npm install`
- Jalankan dev server: `npm run dev`
- Build produksi: `npm run build`
- Preview build: `npm run preview`

## Aturan Implementasi
- Gunakan JavaScript/JSX (bukan TypeScript) kecuali diminta.
- Ikuti pola yang sudah ada: hook untuk stateful logic, service untuk akses data.
- Pertahankan style dan penamaan yang konsisten dengan file sekitar.
- Jangan memindahkan file atau rename simbol besar-besaran tanpa alasan kuat.
- Jika mengubah alur Supabase, sinkronkan dengan SQL terkait dan dokumentasi setup.

## Aturan Khusus Auth/Login
- Alur auth utama berada di `stadione.jsx` (`LoginModal`, bootstrap session, logout) dan memakai Supabase Auth.
- Sebelum memanggil `supabase.auth.*`, pastikan client Supabase siap; tampilkan pesan ramah jika konfigurasi belum valid, jangan biarkan UI crash.
- Normalisasi input auth yang aman, terutama `email.trim()` dan `name.trim()`, sebelum dikirim ke Supabase.
- Setelah registrasi email/password, pertahankan pesan sukses verifikasi email saat modal berpindah kembali ke mode login.
- Mapping user dari session/login harus konsisten: gunakan `id`, `email`, dan nama dari `user_metadata.name` dengan fallback ke prefix email.

## Aturan Khusus Trivia & Riwayat
- Trivia artikel bersifat 1x kesempatan per user per artikel; setelah selesai, UI harus lock permanen dan tampil status sudah dikerjakan.
- Cek status selesai trivia tidak boleh hanya dari satu tabel; gunakan fallback lintas sumber (misalnya `article_progress`, `quiz_results`, atau log lama) agar status tetap konsisten.
- Pencatatan aktivitas trivia wajib diarahkan ke sumber riwayat profil (`user_activity_log`), dan jika insert backend gagal, sediakan fallback aman (contoh: pending local queue) agar user tetap melihat jejak aktivitas.
- Riwayat profil harus menggabungkan sumber utama dan fallback, bukan memilih salah satu saja. Sumber yang perlu dipertimbangkan: `user_activity_log`, `article_progress`, `quiz_results`, legacy `activity_log`, dan pending local queue.
- Saat menggabungkan riwayat, deduplikasi berdasarkan artikel/reference agar satu trivia tidak muncul berkali-kali, tetapi jangan menghilangkan riwayat lama hanya karena sudah ada log baru.
- Saat mengubah copy, gunakan istilah "Trivia diselesaikan" (hindari phrasing lama seperti "membaca artikel" untuk konteks gamification ini).

## Checklist Sebelum Selesai
- Perubahan terfokus pada kebutuhan user.
- Tidak ada error syntax/lint yang diperkenalkan.
- Alur utama tetap berjalan (load data, render UI, interaksi gamification).
- Validasi khusus: login/register/forgot password tidak crash saat Supabase belum siap dan menampilkan pesan yang bisa dipahami user.
- Validasi khusus: artikel yang trivia-nya sudah pernah dikerjakan tidak menampilkan quiz lagi, hanya status selesai.
- Validasi khusus: profil menampilkan ringkasan dan item riwayat trivia secara konsisten setelah submit.
- Validasi khusus: riwayat lama tetap muncul setelah ada entri baru di `user_activity_log`.
- Jika ada asumsi, tuliskan singkat pada ringkasan perubahan.

## Catatan Khusus Repo Ini
- Project memiliki dokumentasi setup terpisah: `README.md`, `README_GAMIFICATION.md`, `SUPABASE_SETUP.md`.
- Pastikan perubahan fitur gamification sejalan dengan dokumen implementasi yang sudah ada.
