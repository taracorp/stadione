# Sprint 3 Official E2E QA

Dokumen ini memvalidasi flow end-to-end target Sprint 3:
1. Assignment official diterima
2. Match Center dipakai untuk event/lineup
3. Match Report disubmit
4. Statistik dan status assignment sinkron

## Pre-check
- SQL Sprint 3 sudah dijalankan: scripts/sprint3-official-foundation.sql
- User QA memiliki role official yang valid (contoh: referee)
- Data jadwal tersedia pada tournament_schedule (tournament_id + entry_id)

## Matrix Permission Granular
- match_official: Match Center ✅, Match Report ✅, Match Statistics ✅
- referee: Match Center ✅, Match Report ✅, Match Statistics ✅
- match_commissioner: Match Center ✅, Match Report ✅, Match Statistics ✅
- statistic_operator: Match Center ✅, Match Report ❌, Match Statistics ✅
- venue_officer: Match Center ❌, Match Report ❌, Match Statistics ❌

## Test Case UI
1. Login sebagai official dengan assignment status assigned.
2. Buka Official > Jadwal Pertandingan.
3. Verifikasi:
- List assignment tampil.
- Detail panel menampilkan role, status, venue, notes.
- Tombol Konfirmasi aktif saat status assigned.
4. Klik Konfirmasi Penugasan.
5. Verifikasi status berubah menjadi confirmed.
6. Klik Buka Match Center dari detail panel.
7. Di Match Center, verifikasi:
- Role yang boleh lineup bisa simpan lineup.
- Role yang boleh event bisa tambah/hapus event.
- Tombol Laporan hanya aktif untuk role yang diizinkan.
8. Buka Match Report.
9. Simpan draft lalu submit laporan.
10. Kembali ke Jadwal, klik Tandai Completed (jika role mengizinkan).
11. Verifikasi status assignment menjadi completed.

## SQL Verification
Gunakan scripts/qa-sprint3-official-e2e.sql untuk verifikasi backend:
- match_assignments status progression
- match_reports latest row (submitted/draft)
- match_statistics sinkron dengan event

## Expected Result
- Tidak ada crash saat data kosong atau query gagal.
- Jadwal menampilkan empty/error state yang informatif dan ada tombol retry.
- Access denied tampil untuk role official yang tidak punya izin granular.
- Flow assignment -> report selesai dengan data tersimpan konsisten.
