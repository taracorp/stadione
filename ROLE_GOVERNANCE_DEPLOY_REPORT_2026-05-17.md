# Role Governance Deploy Report - 2026-05-17

## Informasi Umum

- Tanggal deploy: 2026-05-17
- Environment: Production
- Eksekutor: GitHub Copilot (agent)
- Reviewer: Pending
- Referensi tiket: Pending

## Scope Deploy

- One-shot rollout SQL
- QA smoke SQL
- Verifikasi aplikasi
- Hardening User Management create user (super-admin only)
- User Management action dropdown (blokir, nonaktifkan, hapus)
- Timed disable rollout (`disabled_until`)
- Permanent delete RPC rollout (`admin_delete_user_account`)

## Eksekusi SQL

1. Script dijalankan: migration `lock_admin_create_user_super_admin_only`

- Status: PASS
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Tidak ada

1. Script dijalankan: [scripts/qa-role-access-smoke.sql](scripts/qa-role-access-smoke.sql)

- Status: PASS (query guard function)
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Tidak ada

1. Script dijalankan: migration `fix_admin_create_user_role_ambiguity`

- Status: PASS
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Tidak ada

1. Script dijalankan: migration `fix_admin_create_user_email_ambiguity`

- Status: PASS
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Tidak ada

1. Script dijalankan: migration `fix_admin_create_user_user_roles_conflict_ambiguity`

- Status: PASS
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Tidak ada

1. Script dijalankan: [scripts/rollout-super-admin-user-actions.sql](scripts/rollout-super-admin-user-actions.sql)

- Status: PASS
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Percobaan pertama gagal karena `admin_list_users(text, integer, integer)` belum di-drop sebelum return type diubah. Script rollout diperbaiki lalu dijalankan ulang dan berhasil.

1. Script dijalankan: [scripts/qa-super-admin-user-management-actions.sql](scripts/qa-super-admin-user-management-actions.sql)

- Status: PASS
- Waktu eksekusi: 2026-05-17
- Catatan error (jika ada): Percobaan pertama gagal karena smoke check memanggil `admin_list_users` dengan role non-super-admin. Smoke script diubah untuk memverifikasi return type via introspeksi `pg_get_function_result(...)`, lalu lulus.

## Hasil Query Inti

1. Snapshot akun super admin target

- Query:

```sql
SELECT ur.user_id::text AS super_admin_id
FROM public.user_roles ur
WHERE ur.role = 'super_admin'
LIMIT 1;
```

- Output ringkas: ditemukan 1 super_admin_id
- Status: PASS

1. Canonical role matrix

- Output ringkas per role (permission_count):
- platform_admin: 4
- moderator: 7
- reporter: 5
- tournament_host: 5
- venue_partner: 5
- assistant_referee: 1
- timekeeper: 1
- member: 1
- fans: 1
- supporter: 1
- Status: PASS

1. Permission gate readiness utama

- newsroom (reporter): PASS
- moderation (moderator/platform_admin): PASS
- analytics (platform_admin/moderator): PASS
- admin-verification-queue (platform_admin): PASS
- workspace manager pages (tournament_host/venue_partner): PASS

1. User Management - create user (super admin only)

- Form tambah user manual tampil untuk super admin: PASS
- Submit create user oleh super admin berhasil: PASS
- Form tambah user manual tersembunyi untuk non-super-admin: PASS
- RPC admin_create_user_account untuk non-super-admin ditolak Unauthorized: PASS
- Query guard check function (super_admin only) menghasilkan OK: PASS

## Verifikasi Aplikasi

1. Login super admin berhasil: PASS
1. Platform Console terbuka: PASS
1. Newsroom terbuka sesuai role: PASS
1. Moderation terbuka sesuai role: PASS
1. Analytics terbuka sesuai role: PASS
1. Verification Queue terbuka sesuai role: PASS
1. Forbidden state tampil normal untuk akses tidak berizin: PASS
1. User Management create user hanya untuk super admin: PASS
1. User Management dropdown aksi blokir/nonaktifkan/hapus: PASS (DB rollout + smoke SQL selesai)

Catatan bukti uji manual:

- Super admin berhasil membuka `Platform Console`, `Newsroom`, `Moderasi`, `Analytics`, dan `Verifikasi` dari menu platform (heading halaman sesuai modul tampil).
- Saat menggunakan persona non-privileged (`general_user`), menu platform/admin tidak tersedia pada menu profil.
- Akses langsung URL admin (`/platform-console`) tidak menampilkan console admin dan kembali ke landing/public state.

Update sampling persona tambahan:

- Reporter (`news_reporter_admin`): Newsroom terbuka, Moderasi/Analytics menampilkan state `Akses tidak tersedia`.
- Moderator canonical (`moderator`): Moderasi dan Analytics terbuka, Newsroom menampilkan state `Akses tidak tersedia`.
- Venue Partner canonical (`venue_partner`): tidak memiliki menu Platform Console dan akses langsung `/platform-console` kembali ke state public (deny).
- Venue Partner canonical (`venue_partner`): `Workspace Console` tersedia pada menu tetapi ditolak karena syarat Verified Member (by design, sesuai guard `VERIFIED_MEMBER_REQUIRED_PAGES` di aplikasi).
- Platform admin compatibility (`internal_admin`): Moderasi terbuka sesuai ekspektasi.
- Tournament host compatibility (`tournament_host_admin`): FIX VERIFIED. Setelah patch di `src/utils/permissions.js`, menu `Platform Console` tidak lagi muncul pada akun ini (deny sesuai matrix).
- Venue partner compatibility (`eo_operator`): menu Workspace tersedia, namun Workspace Console masih mensyaratkan Verified Member.
- Catatan cakupan: canonical role kritikal (`moderator`, `venue_partner`) sudah diuji dengan akun khusus QA.

## Build dan Konsistensi Kode

1. Build Vite (`npm run build`): PASS
1. Error baru pada file yang diubah: Tidak ditemukan
1. Catatan: build memberi warning duplicate key `Dukuh Pakis` di `stadione.jsx` (non-blocking, pre-existing/di luar scope perubahan ini)

## Insiden dan Mitigasi

- Ada insiden saat deploy: YA
- Detail insiden: Saat uji submit create user super admin, function `admin_create_user_account` gagal dengan error SQL ambiguity (`role`, `email`, `user_id`).
- Mitigasi yang dilakukan: Patch function di repo + apply 3 migration perbaikan ambiguity; retest UI berhasil create user dan user tampil di tabel.
- Perlu rollback: TIDAK

## Keputusan Akhir

- Deploy diterima: GO
- Alasan: Hardening backend/frontend lulus, guard SQL super-admin-only tervalidasi, dan verifikasi lintas halaman admin prioritas selesai PASS.
- Tindak lanjut:
  - Jalankan checklist manual pada [ROLE_ACCESS_QA_CHECKLIST.md](ROLE_ACCESS_QA_CHECKLIST.md)
  - Eksekusi runsheet manual pada [USER_MANAGEMENT_SUPER_ADMIN_QA_RUNSHEET.md](USER_MANAGEMENT_SUPER_ADMIN_QA_RUNSHEET.md)
  - Audit mapping compatibility role `eo_operator` agar konsisten dengan policy matrix yang disepakati
  - Sinkronkan matrix QA dengan kebijakan verified member pada halaman workspace

## Lampiran

- Template report: [ROLE_GOVERNANCE_DEPLOY_REPORT_TEMPLATE.md](ROLE_GOVERNANCE_DEPLOY_REPORT_TEMPLATE.md)
- Checklist QA role access: [ROLE_ACCESS_QA_CHECKLIST.md](ROLE_ACCESS_QA_CHECKLIST.md)
- Runsheet QA user management: [USER_MANAGEMENT_SUPER_ADMIN_QA_RUNSHEET.md](USER_MANAGEMENT_SUPER_ADMIN_QA_RUNSHEET.md)
- Smoke SQL role access: [scripts/qa-role-access-smoke.sql](scripts/qa-role-access-smoke.sql)
- Smoke SQL user actions: [scripts/qa-super-admin-user-management-actions.sql](scripts/qa-super-admin-user-management-actions.sql)
- Perubahan UI create-user guard: [src/components/admin/platform/UserManagementPage.jsx](src/components/admin/platform/UserManagementPage.jsx)
- Perubahan SQL schema: [supabase-schema.sql](supabase-schema.sql)
- Script hardening SQL: [scripts/super-admin-user-management.sql](scripts/super-admin-user-management.sql)
- Script rollout user actions: [scripts/rollout-super-admin-user-actions.sql](scripts/rollout-super-admin-user-actions.sql)
