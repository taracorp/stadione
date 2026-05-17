# Role Governance Deploy Report Template

## Informasi Umum
- Tanggal deploy:
- Environment: Production
- Eksekutor:
- Reviewer:
- Referensi tiket:

## Scope Deploy
- One-shot rollout SQL
- QA smoke SQL
- Verifikasi aplikasi

## Eksekusi SQL
1. Script dijalankan: scripts/production-role-governance-rollout.sql
- Status: PASS / FAIL
- Waktu eksekusi:
- Catatan error (jika ada):

2. Script dijalankan: scripts/qa-role-access-smoke.sql
- Status: PASS / FAIL
- Waktu eksekusi:
- Catatan error (jika ada):

## Hasil Query Inti
1. Snapshot akun super admin target
- Query:
SELECT u.email, ur.role
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'taradfworkspace@gmail.com'
ORDER BY ur.role;
- Output ringkas:
- Status: PASS / FAIL

2. Canonical role matrix
- Output ringkas per role (permission_count):
- platform_admin:
- moderator:
- reporter:
- tournament_host:
- venue_partner:
- assistant_referee:
- timekeeper:
- member:
- fans:
- supporter:
- Status: PASS / FAIL

3. Permission gate readiness utama
- newsroom (reporter): PASS / FAIL
- moderation (moderator/platform_admin): PASS / FAIL
- analytics (platform_admin/moderator): PASS / FAIL
- admin-verification-queue (platform_admin): PASS / FAIL
- workspace manager pages (tournament_host/venue_partner): PASS / FAIL

4. User Management - create user (super admin only)
- Form tambah user manual tampil untuk super admin: PASS / FAIL
- Submit create user oleh super admin berhasil: PASS / FAIL
- Form tambah user manual tersembunyi untuk non-super-admin: PASS / FAIL
- RPC admin_create_user_account untuk non-super-admin ditolak Unauthorized: PASS / FAIL
- Query guard check function (super_admin only) menghasilkan OK: PASS / FAIL

## Verifikasi Aplikasi
1. Login super admin berhasil: PASS / FAIL
2. Platform Console terbuka: PASS / FAIL
3. Newsroom terbuka sesuai role: PASS / FAIL
4. Moderation terbuka sesuai role: PASS / FAIL
5. Analytics terbuka sesuai role: PASS / FAIL
6. Verification Queue terbuka sesuai role: PASS / FAIL
7. Forbidden state tampil normal untuk akses tidak berizin: PASS / FAIL
8. User Management create user hanya untuk super admin: PASS / FAIL

## Insiden dan Mitigasi
- Ada insiden saat deploy: YA / TIDAK
- Detail insiden:
- Mitigasi yang dilakukan:
- Perlu rollback: YA / TIDAK

## Keputusan Akhir
- Deploy diterima: YA / TIDAK
- Alasan:
- Tindak lanjut:

## Lampiran
- Screenshot SQL output:
- Screenshot smoke aplikasi:
- Link log deploy:
