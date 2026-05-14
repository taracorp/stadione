# Role Governance Runbook

## Tujuan
Runbook singkat untuk eksekusi rollout role governance di production secara cepat dan aman.

## Checklist Eksekusi
1. Pre-check tabel inti.
2. Jalankan one-shot rollout SQL.
3. Jalankan QA smoke SQL.
4. Verifikasi akun super admin target.
5. Validasi halaman admin utama di aplikasi.

## Copy-Paste SQL

### 1) Pre-check
SELECT COUNT(*) AS app_roles_count FROM app_roles;
SELECT COUNT(*) AS role_permissions_count FROM role_permissions;
SELECT COUNT(*) AS user_roles_count FROM user_roles;

Pass criteria:
- Semua query sukses.
- Semua count valid (>= 0) dan tabel tersedia.

### 2) Sync vocabulary
Jalankan file:
scripts/sync-role-vocabulary.sql

Pass criteria:
- Role canonical berhasil upsert.
- Display name role legacy terselaraskan.

### 3) Hardening permissions
Jalankan file:
scripts/harden-role-permissions.sql

Pass criteria:
- Role canonical tidak ada yang kosong permission.
- platform_admin memiliki operator.verify.

### 4) QA smoke
Jalankan file:
scripts/qa-role-access-smoke.sql

Pass criteria minimum:
- reporter ready untuk newsroom.
- tournament_host dan venue_partner ready untuk workspace manager pages.
- member/fans/supporter tidak ready untuk admin pages.
- platform_admin ready untuk admin-verification-queue.

### 5) Verifikasi super admin target
SELECT u.email, ur.role
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'taradfworkspace@gmail.com'
ORDER BY ur.role;

### Opsi cepat (pengganti langkah 2 dan 3)
Jalankan file:
scripts/production-role-governance-rollout.sql

Setelah itu lanjutkan ke langkah 4.

Pass criteria:
- Minimal memiliki role super_admin.

## Aplikasi: Quick Smoke
1. Login sebagai super admin.
2. Buka Platform Console.
3. Buka Newsroom, Moderation, Analytics, Verification Queue.
4. Cek forbidden state tampil normal pada halaman yang tidak berizin.

## Jika Ada Fail
1. Capture output query yang gagal.
2. Re-run hardening script sekali.
3. Re-run QA smoke.
4. Jika masih fail, rollback cepat permission tambahan paling berisiko:
DELETE FROM role_permissions
WHERE role = 'platform_admin'
  AND permission = 'operator.verify';

## Catatan
- Script bersifat idempotent.
- Eksekusi production di workspace ini menggunakan MCP Supabase tools.
- Setelah deploy, isi ROLE_GOVERNANCE_DEPLOY_REPORT_TEMPLATE.md sebagai bukti eksekusi.
