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
