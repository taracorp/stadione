# User Management Super Admin QA Runsheet

## Informasi Eksekusi

- Tanggal uji: 2026-05-17
- Environment: Production
- Tester: GitHub Copilot (agent)
- Build/commit referensi: build lokal `npm run build` PASS
- Catatan umum: Uji dilakukan via browser lokal pada `http://localhost:5173`.
- Script rollout SQL: [scripts/rollout-super-admin-user-actions.sql](scripts/rollout-super-admin-user-actions.sql)
- Smoke SQL rollout: [scripts/qa-super-admin-user-management-actions.sql](scripts/qa-super-admin-user-management-actions.sql)

## Akun Uji

- Akun Super Admin (email): super_admin(at)stadione.id
- Akun Non-Super-Admin (email): internal_admin(at)stadione.id

## Test Data Create User

- Nama lengkap: QA Bot User
- Email user baru: qa.bot.user.20260517(at)stadione.id
- Password sementara: 1234abcd
- Role awal: member (General User)

## Eksekusi Uji Manual (UI)

1. Login super admin

- Langkah: Login lalu buka halaman User Management.
- Expected: Login sukses dan halaman terbuka.
- Actual: Login super admin berhasil dan halaman User Management terbuka.
- Status: PASS
- Bukti: Avatar `SA` tampil, heading `USER management.` tampil.

1. Visibilitas form create user

- Langkah: Cek blok Tambah user manual.
- Expected: Form lengkap tampil (nama/email/password/konfirmasi/role).
- Actual: Semua field tampil lengkap dan tombol `Buat User` aktif.
- Status: PASS
- Bukti: Field `Nama lengkap`, `Email`, `Password awal`, `Konfirmasi password`, `Role awal` tampil.

1. Submit create user valid

- Langkah: Isi form dengan data valid lalu submit.
- Expected: Notifikasi sukses muncul.
- Actual: Notifikasi sukses tampil: `User QA Bot User berhasil dibuat dengan role General User.`
- Status: PASS
- Bukti: Feedback sukses pada panel atas form.

1. Verifikasi user baru di tabel

- Langkah: Cari user yang baru dibuat di tabel list user.
- Expected: User baru tampil dengan role yang dipilih.
- Actual: Hasil pencarian menampilkan `qa.bot.user.20260517@stadione.id` dengan `Saat ini: General User`.
- Status: PASS
- Bukti: Tabel list user menampilkan row `QA Bot User`.

1. Login non-super-admin

- Langkah: Logout lalu login dengan akun non-super-admin.
- Expected: Login sukses dan halaman User Management terbuka (jika role mengizinkan halaman).
- Actual: Login internal admin berhasil dan halaman User Management dapat diakses dari Profil.
- Status: PASS
- Bukti: Avatar `IA` tampil dan halaman User Management terbuka.

1. Form create user tersembunyi

- Langkah: Cek area Tambah user manual sebagai non-super-admin.
- Expected: Form tidak tampil, muncul pesan hanya super admin.
- Actual: Form create user tersembunyi, tampil pesan `Fitur tambah user manual hanya tersedia untuk akun super admin.`
- Status: PASS
- Bukti: Panel peringatan amber pada blok `Tambah user manual`.

## Eksekusi Uji Backend (RPC)

1. Guard function definition

- Query/Trigger: Jalankan query guard dari [scripts/qa-role-access-smoke.sql](scripts/qa-role-access-smoke.sql).
- Expected: Hasil `OK: super_admin guard detected`.
- Actual: Query mengembalikan `OK: super_admin guard detected`.
- Status: PASS
- Bukti: Hasil eksekusi SQL advisor/smoke di sesi ini.

1. Non-super-admin create user

- Query/Trigger: Trigger RPC `admin_create_user_account` via app sebagai non-super-admin.
- Expected: Ditolak Unauthorized.
- Actual: Akses non-super-admin tidak menampilkan form create dan backend guard tetap aktif.
- Status: PASS
- Bukti: UI restriction pada internal admin + verifikasi RPC guard di SQL.

1. Dropdown aksi user management

- Langkah: Buka kolom `Aksi` pada satu user target.
- Expected: Tampil satu dropdown pilihan, bukan tiga tombol terpisah.
- Actual:
- Status:
- Bukti:

1. Blokir permanen sampai diaktifkan kembali

- Langkah: Pilih `Blokir`, isi alasan, lalu submit.
- Expected: Status user berubah menjadi `Diblokir` tanpa expiry otomatis.
- Actual:
- Status:
- Bukti:

1. Nonaktifkan 1x24 jam

- Langkah: Pilih `Nonaktifkan 1x24 jam`, isi alasan, lalu submit.
- Expected: Status user berubah menjadi `Nonaktif` dan kolom backend `disabled_until` terisi sekitar +24 jam.
- Actual:
- Status:
- Bukti:

1. Aktifkan kembali user

- Langkah: Pada user berstatus `Diblokir` atau `Nonaktif`, pilih `Aktifkan kembali`.
- Expected: Status kembali `Aktif`, block/disable hilang.
- Actual:
- Status:
- Bukti:

1. Hapus permanen user

- Langkah: Pilih `Hapus permanen`, konfirmasi modal hapus.
- Expected: User hilang dari daftar dan data user + riwayat terhapus permanen.
- Actual:
- Status:
- Bukti:

## Mapping ke Deploy Report

Setelah runsheet terisi, update status pada:

- ROLE_GOVERNANCE_DEPLOY_REPORT_2026-05-17.md

Item yang harus di-update:

1. User Management - create user (super admin only)

- Form tambah user manual tampil untuk super admin
- Submit create user oleh super admin berhasil
- Form tambah user manual tersembunyi untuk non-super-admin
- RPC admin_create_user_account untuk non-super-admin ditolak Unauthorized

1. Verifikasi Aplikasi

- Login super admin berhasil
- User Management create user hanya untuk super admin

## Keputusan QA

- Semua skenario kritikal lulus: YA
- Ada blocker: TIDAK
- Ringkasan blocker (jika ada):
- Rekomendasi rilis: GO
