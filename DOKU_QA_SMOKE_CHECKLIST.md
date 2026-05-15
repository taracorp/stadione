# DOKU QA Smoke Checklist

Tanggal: 2026-05-15
Scope: Booking/POS/Finance + Edge Function doku-checkout & doku-webhook-handler

## 1) Prasyarat

1. Pastikan migrasi SQL sudah dijalankan.

- scripts/add-doku-payment-gateway.sql

1. Pastikan edge function terdeploy.

- supabase/functions/doku-checkout/index.ts
- supabase/functions/doku-webhook-handler/index.ts

1. Pastikan env function valid.

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- DOKU_SECRET_KEY

1. Pastikan konfigurasi venue DOKU terisi di Settings.

- environment
- merchant_id
- client_id
- secret_key
- checkout_base_url

## 2) SQL Quick Verification

Jalankan query berikut di SQL editor:

```sql
-- Tabel inti DOKU
select to_regclass('public.doku_venue_config') as doku_venue_config;
select to_regclass('public.doku_payment_transactions') as doku_payment_transactions;
select to_regclass('public.payment_webhook_events') as payment_webhook_events;

-- Kolom penting
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'doku_payment_transactions'
  and column_name in ('price', 'amount', 'status', 'doku_order_id', 'doku_response');

-- Index penting
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('doku_payment_transactions', 'payment_webhook_events')
order by tablename, indexname;
```

Expected:

- tabel tersedia
- kolom status/doku_order_id/doku_response tersedia
- index webhook hash & order id tersedia

## 3) Functional Smoke

1. Buat booking unpaid di Venue Bookings.
1. Klik Bayar DOKU.
1. Klik Mulai Checkout DOKU.
1. Pastikan row baru muncul di doku_payment_transactions status pending.
1. Simulasikan webhook success ke doku-webhook-handler.
1. Verifikasi otomatis.

- doku_payment_transactions.status => completed
- venue_bookings.payment_status => paid
- venue_bookings.payment_method => doku
- venue_payments.reference_number terisi order_id DOKU
- venue_invoices.status => issued

## 4) Idempotency Smoke

1. Kirim webhook payload yang sama 2x.
1. Verifikasi.

- request kedua return success duplicate
- tidak ada perubahan status berulang yang merusak
- payment_webhook_events menyimpan jejak event dengan hash

## 5) Failure/Cancel/Refund Smoke

1. Simulasikan webhook status failed/expired/cancelled.
1. Verifikasi transaksi DOKU berubah sesuai status.
1. Lakukan refund dari Venue Bookings untuk booking DOKU.
1. Verifikasi.

- doku_payment_transactions.status => refunded
- venue_bookings.payment_status => refunded
- venue_invoices.status => voided

## 6) Finance Page Smoke

1. Buka tab DOKU di Venue Finance.
1. Uji filter status.

- pending/completed/failed/expired/cancelled/refunded

1. Uji tombol aksi.

- transaksi pending => tombol Lanjutkan membuka checkout_url

## 7) Observability Minimum

SQL ringkas monitoring 24 jam terakhir:

```sql
select status, count(*)
from doku_payment_transactions
where created_at >= now() - interval '24 hours'
group by status
order by status;

select count(*) as webhook_events_24h
from payment_webhook_events
where created_at >= now() - interval '24 hours';
```

## 8) Exit Criteria

- Semua functional smoke lulus
- Tidak ada error build frontend
- Webhook duplicate tidak menyebabkan side effect ganda
- Booking, payment, invoice, dan transaksi DOKU konsisten
