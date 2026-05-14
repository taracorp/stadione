# Context Switch QA

## Tujuan
Memvalidasi perpindahan context aktif (platform/workspace/official) tanpa logout.

## Prasyarat
1. User uji memiliki minimal dua akses context, contoh:
- platform + workspace, atau
- workspace + official.
2. Database sudah memiliki tabel dan RPC context switch:
- user_active_workspace_context
- user_context_switch_logs
- set_active_workspace_context
3. Build frontend terbaru sudah terpasang.

## Skenario Uji Wajib

### Skenario 1: Platform -> Workspace
1. Login user dengan akses platform dan workspace.
2. Buka menu user, pastikan context aktif awal = platform.
3. Klik chip context Workspace.
4. Validasi:
- Tidak terjadi logout.
- Halaman berpindah ke workspace-console.
- Menu Platform disembunyikan, menu Workspace tampil.
- Akses page platform (newsroom/moderation) menjadi forbidden selama context workspace aktif.

### Skenario 2: Workspace -> Official
1. Login user dengan akses workspace dan official.
2. Set context ke workspace.
3. Klik chip context Official.
4. Validasi:
- Tidak terjadi logout.
- Halaman berpindah ke official-center.
- Menu Workspace disembunyikan, menu Official tampil.
- Akses page workspace manager menjadi forbidden selama context official aktif.

### Skenario 3: Official -> Platform
1. Login user dengan akses official dan platform.
2. Set context ke official.
3. Klik chip context Platform.
4. Validasi:
- Tidak terjadi logout.
- Halaman berpindah ke platform-console.
- Menu Official disembunyikan, menu Platform tampil.
- Akses page official dibatasi jika context platform aktif.

## Verifikasi Data Backend
Jalankan query berikut setelah beberapa kali switch:

SELECT
  context_scope,
  context_role,
  context_entity_type,
  context_entity_id,
  context_label,
  switched_at
FROM user_active_workspace_context
WHERE user_id = '<USER_ID>';

SELECT
  previous_scope,
  new_scope,
  reason,
  created_at
FROM user_context_switch_logs
WHERE user_id = '<USER_ID>'
ORDER BY created_at DESC
LIMIT 10;

Pass criteria:
1. Record user_active_workspace_context selalu ter-update ke context terakhir.
2. Log switch bertambah sesuai jumlah perpindahan context.
3. reason bernilai menu_context_switch untuk switch dari dropdown.

## Exit Criteria
1. Ketiga skenario wajib lulus tanpa logout.
2. Gate halaman sensitif mengikuti context aktif.
3. Data context dan audit log tersimpan konsisten.
