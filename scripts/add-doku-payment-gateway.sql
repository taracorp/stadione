-- DOKU payment gateway schema for venue payment integrations

create table if not exists doku_venue_config (
  venue_id integer primary key,
  environment text not null default 'sandbox',
  business_id text,
  brand_id text,
  merchant_id text,
  api_key text,
  client_id text,
  secret_key text,
  doku_public_key text,
  merchant_public_key text,
  checkout_base_url text,
  updated_at timestamp with time zone default now()
);

alter table if exists doku_venue_config
  add column if not exists business_id text;

alter table if exists doku_venue_config
  add column if not exists brand_id text;

alter table if exists doku_venue_config
  add column if not exists api_key text;

alter table if exists doku_venue_config
  add column if not exists doku_public_key text;

alter table if exists doku_venue_config
  add column if not exists merchant_public_key text;

create table if not exists doku_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  venue_id integer not null,
  price numeric not null,
  currency text not null default 'IDR',
  customer_name text,
  customer_phone text,
  status text not null default 'pending',
  checkout_url text,
  doku_order_id text,
  doku_response jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table if exists doku_payment_transactions
  add column if not exists amount numeric;

update doku_payment_transactions
set amount = price
where amount is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'doku_payment_transactions_status_check'
  ) then
    alter table doku_payment_transactions
      add constraint doku_payment_transactions_status_check
      check (status in ('pending', 'completed', 'failed', 'expired', 'cancelled', 'refunded'));
  end if;
end $$;

create index if not exists idx_doku_payment_transactions_booking_id on doku_payment_transactions (booking_id);
create index if not exists idx_doku_payment_transactions_venue_id on doku_payment_transactions (venue_id);
create index if not exists idx_doku_payment_transactions_status on doku_payment_transactions (status);
create index if not exists idx_doku_payment_transactions_created_at on doku_payment_transactions (created_at desc);
create unique index if not exists idx_doku_payment_transactions_order_id_unique on doku_payment_transactions (doku_order_id) where doku_order_id is not null;

create table if not exists payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_payload jsonb,
  received_at timestamp with time zone default now(),
  signature text,
  event_order_id text,
  event_status text,
  event_hash text,
  created_at timestamp with time zone default now()
);

alter table if exists payment_webhook_events
  add column if not exists event_order_id text;

alter table if exists payment_webhook_events
  add column if not exists event_status text;

alter table if exists payment_webhook_events
  add column if not exists event_hash text;

create index if not exists idx_payment_webhook_events_order_id on payment_webhook_events (event_order_id);
create index if not exists idx_payment_webhook_events_status on payment_webhook_events (event_status);
create unique index if not exists idx_payment_webhook_events_hash on payment_webhook_events (event_hash);
