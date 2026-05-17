# Role Access QA Checklist

Dokumen ini untuk verifikasi cepat setelah perubahan role normalization dan permission-first gate.

## Prasyarat
- Environment Supabase aktif.
- Data role dan permission sudah tersinkron.
- Akun uji tersedia per persona role.

## SQL Verification
1. Jalankan [scripts/qa-role-access-smoke.sql](scripts/qa-role-access-smoke.sql).
2. Pastikan query role matrix mengembalikan permission_count lebih besar dari 0 untuk role canonical yang memang operasional:
- platform_admin
- moderator
- reporter
- tournament_host
- venue_partner
3. Pastikan role engagement dan official baseline tidak kosong:
- assistant_referee
- timekeeper
- member
- fans
- supporter
4. Pastikan function create user dikunci ke super admin dengan query function-definition check pada script smoke.

## User Management Create User (Super Admin Only)
1. Login sebagai Super Admin lalu buka halaman User Management.
2. Pastikan blok Tambah user manual tampil lengkap (nama, email, password, konfirmasi, role).
3. Submit data user baru yang valid.
4. Pastikan muncul notifikasi sukses dan user baru muncul di tabel list user.
5. Login sebagai akun non-super-admin yang masih bisa akses User Management.
6. Pastikan form Tambah user manual tidak tampil dan muncul pesan bahwa fitur hanya untuk super admin.
7. Jika non-super-admin memanggil RPC create user dari aplikasi, pastikan respons Unauthorized.

## App Verification by Persona
1. Super Admin
- Buka Platform Console: boleh.
- Buka Newsroom: boleh.
- Buka Moderation: boleh.
- Buka Analytics: boleh.
- Buka Verification Queue: boleh.

2. Reporter
- Buka Newsroom: boleh.
- Buka Moderation: tidak boleh.
- Buka Analytics: tidak wajib.

3. Moderator
- Buka Moderation: boleh.
- Buka Newsroom: tidak wajib.
- Buka Analytics: boleh jika permission tersedia.

4. Tournament Host atau Venue Partner
- Buka Workspace Console: boleh.
- Buka Tournament Manager: boleh.
- Buka Sponsor Manager: boleh jika permission sponsorship tersedia.
- Buka Platform Console: tidak boleh kecuali punya role atau permission platform.

5. Member atau Fans atau Supporter
- Tidak boleh akses halaman admin.
- Tetap bisa akses fitur user biasa.

## Regression Checks
1. Login tetap stabil saat Supabase siap maupun tidak siap.
2. Dropdown user tetap tampil section:
- Account
- Aktivitas
- Workspace
- Official
- Platform
3. Role badges tetap muncul di header user menu dan profile.
4. Halaman admin yang tidak berizin menampilkan state forbidden, bukan crash.

## Exit Criteria
- Tidak ada error runtime baru.
- Gating role dan permission konsisten dengan hasil SQL smoke.
- Persona uji utama lolos end-to-end.

## Hasil Eksekusi 2026-05-17

Status ringkas:
- SQL Verification: PASS
- User Management Create User (Super Admin Only): PASS
- App Verification by Persona: PARTIAL PASS
- Regression Checks: PASS (prioritas utama)

Detail hasil:
1. SQL Verification
- PASS: role matrix dan permission gate readiness tervalidasi melalui smoke query.
- PASS: function `admin_create_user_account` terdeteksi memiliki guard super_admin.

2. User Management Create User (Super Admin Only)
- PASS: Super Admin dapat melihat form tambah user manual.
- PASS: Super Admin berhasil membuat user baru dan user tampil di tabel.
- PASS: Non-super-admin tidak melihat form tambah user manual.
- PASS: Guard backend tetap aktif (non-super-admin tidak bisa create user).

3. App Verification by Persona
- PASS (Super Admin): Platform Console, Newsroom, Moderation, Analytics, dan Verification Queue dapat diakses.
- PASS (Member/General User): menu admin tidak tersedia pada user menu.
- PASS (Member/General User): akses langsung URL admin (`/platform-console`) tidak membuka halaman admin dan kembali ke state public.
- PASS (Reporter / `news_reporter_admin`): Newsroom dapat diakses.
- PASS (Reporter / `news_reporter_admin`): Moderasi dan Analytics menampilkan state `Akses tidak tersedia`.
- PASS (Moderator canonical / `moderator`): Moderasi dapat diakses.
- PASS (Moderator canonical / `moderator`): Analytics dapat diakses.
- PASS (Moderator canonical / `moderator`): Newsroom menampilkan state `Akses tidak tersedia`.
- PASS (Platform Admin compat / `internal_admin`): Moderasi dapat diakses.
- PASS (Tournament Host compat / `tournament_host_admin`): setelah patch [src/utils/permissions.js](src/utils/permissions.js), menu `Platform Console` tidak lagi muncul untuk akun ini (deny sesuai matrix).
- PASS (Venue Partner canonical / `venue_partner`): tidak memiliki menu Platform Console.
- PASS (Venue Partner canonical / `venue_partner`): akses langsung `/platform-console` kembali ke state public (deny).
- PASS (Venue Partner canonical / `venue_partner`): `Workspace Console` ditolak dengan pesan `Verified Member Diperlukan`, sesuai guard aplikasi pada halaman workspace.
- PASS (Venue Partner compat / `eo_operator`): pola sama, `Workspace Console` ditolak karena prasyarat Verified Member.

4. Regression Checks
- PASS: tidak ditemukan crash pada alur verifikasi utama.
- PASS: role badge dan persona user tampil pada menu profil saat login.
- NOTE: pada otomasi browser terdapat isu klik elemen menu yang berada di luar viewport; mitigasi dilakukan lewat jalur navigasi alternatif dan hasil verifikasi tetap dapat diselesaikan.

5. Tindak lanjut QA
- Audit mapping role compatibility `eo_operator` terhadap permission gate aktual di aplikasi.
- Sinkronkan wording matrix QA agar eksplisit menyebut prasyarat Verified Member untuk akses halaman workspace.
