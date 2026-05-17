# Role Governance Rollout

## Tujuan

Dokumen ini adalah panduan rollout singkat untuk production agar tim deploy bisa langsung eksekusi tanpa interpretasi tambahan.

## Ringkasan Release Internal

Tanggal: 2026-05-13
Scope: Normalisasi role, permission-first gate untuk halaman admin, hardening matrix role canonical, dan QA smoke query.

Perubahan utama:

1. Role alias dan role badge disatukan di frontend agar kompatibel legacy dan canonical.
2. Rule akses halaman admin diubah menjadi permission-first dengan role fallback kompatibilitas.
3. Role canonical yang sebelumnya kosong permission sudah diberi baseline aman.
4. Platform admin kini punya permission operator.verify untuk akses verification queue berbasis permission.
5. Query QA siap pakai ditambahkan untuk validasi cepat pasca deploy.

Dampak ke user:

1. Tidak ada perubahan UX besar untuk user umum.
2. Akses admin menjadi lebih konsisten antar role dan permission.
3. Risiko over-permission berkurang karena gate sudah lebih presisi.

## Artefak SQL yang Dipakai

1. scripts/sync-role-vocabulary.sql
2. scripts/harden-role-permissions.sql
3. scripts/qa-role-access-smoke.sql
4. scripts/production-role-governance-rollout.sql
5. scripts/unified-role-workspace-architecture.sql

Mode eksekusi tersedia:

1. Bertahap: jalankan 1 -> 2 -> 3.
2. One-shot: jalankan 4, lalu jalankan 3 untuk verifikasi tambahan jika diperlukan.
3. Arsitektur lanjutan (disarankan untuk scale): jalankan 5, lalu jalankan 3.

## Upgrade Arsitektur RBAC (System/Workspace/Activity)

Mulai fase ini, model role dipisahkan menjadi tiga lapisan:

1. System Role

- Hak global platform, tetap memakai `user_roles`.

1. Workspace Role

- Hak per workspace, disimpan di `user_workspace_roles`.

1. Activity Role

- Hak per aktivitas (match/team/training/event), disimpan di `user_activity_roles`.

Catatan:

- Rollout ini tidak menghapus role lama. Role legacy ditandai deprecated agar kompatibilitas tetap aman.
- `fans` dan `supporter` diarahkan menjadi `user_interests`, bukan role permission.

Referensi arsitektur:

- UNIFIED_ROLE_WORKSPACE_ARCHITECTURE.md

## Urutan Eksekusi SQL di Production

Ikuti urutan ini persis.

Opsi cepat (direkomendasikan untuk deploy terkontrol):

1. Jalankan scripts/production-role-governance-rollout.sql.
2. Jalankan scripts/qa-role-access-smoke.sql.
3. Lanjutkan verifikasi aplikasi.

Langkah 1. Pre-check schema dan data minimum
Jalankan query berikut:

```sql
SELECT COUNT(*) AS app_roles_count FROM app_roles;
SELECT COUNT(*) AS role_permissions_count FROM role_permissions;
SELECT COUNT(*) AS user_roles_count FROM user_roles;
```

Kriteria lanjut:

1. Ketiga tabel ada dan query sukses.
2. Tidak ada error koneksi atau privilege.

Langkah 2. Sinkronisasi vocabulary role
Jalankan isi file:
scripts/sync-role-vocabulary.sql

Expected result:

1. Role canonical terbuat atau ter-update.
2. Display name role legacy terselaraskan.
3. Permission canonical awal hasil copy dari role legacy.

Langkah 3. Hardening baseline permission canonical
Jalankan isi file:
scripts/harden-role-permissions.sql

Expected result:

1. Role canonical tidak ada yang kosong permission.
2. platform_admin punya operator.verify.

Langkah 4. QA smoke SQL
Jalankan isi file:
scripts/qa-role-access-smoke.sql

Expected result minimum:

1. Canonical role matrix menunjukkan permission_count lebih besar dari 0 untuk role operasional.
2. Reporter ready untuk newsroom.
3. Tournament host dan venue partner ready untuk workspace manager pages.
4. Member, fans, supporter tidak ready untuk admin pages.
5. Platform admin ready untuk admin-verification-queue.

Langkah 5. Verifikasi akun super admin target
Jalankan query berikut:

```sql
SELECT u.email, ur.role
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'taradfworkspace@gmail.com'
ORDER BY ur.role;
```

Expected result:

1. Akun target minimal memiliki role super_admin.

Langkah 6. Verifikasi tabel assignment kontekstual (jika menjalankan script 5)
Jalankan query berikut:

```sql
SELECT COUNT(*) AS workspace_roles_count FROM user_workspace_roles;
SELECT COUNT(*) AS activity_roles_count FROM user_activity_roles;
SELECT COUNT(*) AS interests_count FROM user_interests;
```

Expected result:

1. Ketiga tabel berhasil diakses tanpa error.
2. Struktur siap dipakai flow partnership/workspace activation.

## Post-Deploy Verification Aplikasi

1. Login akun super admin berhasil.
2. Platform Console terbuka normal.
3. Newsroom, Moderation, Analytics, Verification Queue terbuka sesuai hak akses.
4. Workspace pages hanya terbuka untuk role/permission yang sesuai.
5. Halaman tanpa izin menampilkan forbidden state, bukan crash.
6. Partnership activation dapat menulis assignment ke `user_workspace_roles`.
7. Assignment official/team/training dapat menulis assignment ke `user_activity_roles`.

## Flow Partnership dan Workspace Activation (Target)

1. User register lalu otomatis mendapat role `member`.
2. User mengajukan tipe partnership (host, venue, academy, community, coach).
3. User submit data legal dan verifikasi.
4. Super admin review: `pending` -> `need_revision` -> `approved`.
5. Saat approved, sistem assign role di `user_workspace_roles`.
6. Jika dibutuhkan, sistem assign role event-specific di `user_activity_roles`.

## Rollback Plan Singkat

Jika terjadi anomali akses setelah rollout:

1. Batasi akses sementara ke halaman terdampak dari UI routing.
2. Revert permission tambahan yang paling berisiko dulu, contoh:

```sql
DELETE FROM role_permissions WHERE role = 'platform_admin' AND permission = 'operator.verify';
```

1. Jalankan ulang QA smoke query untuk cek kondisi terbaru.
1. Koordinasikan hotfix rule PAGE_ACCESS bila mismatch ditemukan.

## Catatan Operasional

1. Semua script bersifat idempotent dan aman dijalankan ulang.
2. Di workspace ini, eksekusi SQL production dilakukan lewat MCP Supabase tool, bukan dbclient lokal.
3. Simpan hasil query QA sebagai bukti deploy untuk audit internal.
4. Gunakan template laporan deploy: ROLE_GOVERNANCE_DEPLOY_REPORT_TEMPLATE.md.
