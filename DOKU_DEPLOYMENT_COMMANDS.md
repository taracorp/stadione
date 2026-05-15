# DOKU Deployment Commands (Step-by-Step)

Tanggal: 2026-05-15
Target: Supabase Project (remote)

Dokumen ini berisi urutan command yang bisa langsung dijalankan dari terminal (Git Bash/WSL).

## Mapping Data DOKU ke Aplikasi

Masukkan data akun DOKU Anda pada menu Settings venue (DOKU Payment Gateway):

- Business ID -> business_id
- Brand ID -> brand_id
- Merchant ID -> merchant_id
- API Key -> api_key
- Client ID -> client_id
- Active Secret Key -> secret_key
- DOKU Public Key -> doku_public_key
- Merchant Public Key -> merchant_public_key

Catatan keamanan:

- Jangan commit key/secret ke git.
- Simpan secret function di Supabase Secrets, bukan di file source.

## 0) Prerequisites

- Node.js terpasang
- psql client terpasang
- Akses Supabase project ref
- Akses DB password (untuk SUPABASE_DB_URL)

## 1) Masuk ke folder project

```bash
cd "c:/Users/Lenovo/TARA CORP PROJECT/stadione"
```

## 2) Install Supabase CLI (opsi tanpa install global)

```bash
npx supabase --version
```

Jika diminta install package, jawab yes.

## 3) Login Supabase CLI

```bash
npx supabase login
```

## 4) Set variable environment deploy

Ganti placeholder berikut sesuai project Anda.

```bash
export SUPABASE_PROJECT_REF="YOUR_PROJECT_REF"
export SUPABASE_DB_URL="postgresql://postgres:YOUR_DB_PASSWORD@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
export DOKU_SECRET_KEY="YOUR_DOKU_WEBHOOK_SECRET"
```

## 5) Link repo ke project Supabase

```bash
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
```

## 6) Apply migrasi SQL DOKU

```bash
psql "$SUPABASE_DB_URL" -f scripts/add-doku-payment-gateway.sql
```

## 6.1) Upsert konfigurasi venue DOKU (opsional, direkomendasikan via template)

Gunakan template berikut agar tidak salah mapping field:

- scripts/doku-config-upsert-template.sql

Jalankan setelah placeholder diganti nilai aktual (jangan commit nilai rahasia):

```bash
psql "$SUPABASE_DB_URL" -f /path/secure/doku-config-upsert.sql
```

## 7) Set function secret untuk webhook checkout

```bash
npx supabase secrets set DOKU_SECRET_KEY="$DOKU_SECRET_KEY" --project-ref "$SUPABASE_PROJECT_REF"
```

Untuk versi lengkap setup secret (Bash + PowerShell), lihat:

- DOKU_SECRETS_SETUP.md

## 8) Deploy Edge Functions

```bash
npx supabase functions deploy doku-checkout --project-ref "$SUPABASE_PROJECT_REF"
npx supabase functions deploy doku-webhook-handler --project-ref "$SUPABASE_PROJECT_REF"
```

## 9) Verifikasi SQL inti (sanity check)

```bash
psql "$SUPABASE_DB_URL" <<'SQL'
select to_regclass('public.doku_venue_config') as doku_venue_config;
select to_regclass('public.doku_payment_transactions') as doku_payment_transactions;
select to_regclass('public.payment_webhook_events') as payment_webhook_events;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'doku_payment_transactions'
  and column_name in ('price', 'amount', 'status', 'doku_order_id', 'doku_response')
order by column_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('doku_payment_transactions', 'payment_webhook_events')
order by tablename, indexname;
SQL
```

## 10) URL webhook untuk diinput ke dashboard DOKU

Format URL:

<https://YOUR_PROJECT_REF.supabase.co/functions/v1/doku-webhook-handler>

Contoh jika project ref adalah abcdefghijkl:

<https://abcdefghijkl.supabase.co/functions/v1/doku-webhook-handler>

## 11) Cek endpoint function hidup

```bash
curl -i "https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/doku-checkout"
```

Expected: status 405 Method Not Allowed (ini normal karena endpoint menerima POST).

## 12) Jalankan smoke QA

Ikuti checklist di file berikut:

- DOKU_QA_SMOKE_CHECKLIST.md

Jika Anda menggunakan PowerShell sebagai terminal utama, ikuti command setup secret pada:

- DOKU_SECRETS_SETUP.md

## 13) Rollback minimum jika ada insiden

- Disable callback dari dashboard DOKU sementara.
- Redeploy function sebelumnya dari commit stabil.
- Restore data status transaksi secara selektif menggunakan SQL update terkontrol.

## 14) Checklist release selesai

- SQL migrasi berhasil
- Secrets berhasil di-set
- Dua functions berhasil deploy
- Webhook URL sudah terpasang di dashboard DOKU
- Functional smoke lulus
- Idempotency smoke lulus
- Failure/refund smoke lulus
