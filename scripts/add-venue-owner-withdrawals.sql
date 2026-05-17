-- Owner withdrawal request table.
-- This table tracks payout requests from non-cash balance handled by Stadione.

create table if not exists venue_owner_withdrawals (
  id uuid primary key default gen_random_uuid(),
  venue_id integer not null references venues(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'processing', 'paid', 'rejected', 'cancelled')),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  note text,
  transfer_reference text,
  requested_by uuid references auth.users(id) on delete set null,
  processed_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_venue_owner_withdrawals_venue_id
  on venue_owner_withdrawals (venue_id);

create index if not exists idx_venue_owner_withdrawals_status
  on venue_owner_withdrawals (status);

create index if not exists idx_venue_owner_withdrawals_requested_at
  on venue_owner_withdrawals (requested_at desc);

create or replace function set_venue_owner_withdrawals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_venue_owner_withdrawals_updated_at on venue_owner_withdrawals;
create trigger trg_venue_owner_withdrawals_updated_at
before update on venue_owner_withdrawals
for each row
execute function set_venue_owner_withdrawals_updated_at();

alter table venue_owner_withdrawals enable row level security;

drop policy if exists "Venue owner manager cashier can read withdrawals" on venue_owner_withdrawals;
create policy "Venue owner manager cashier can read withdrawals"
  on venue_owner_withdrawals
  for select
  using (
    exists (
      select 1
      from venue_staff vs
      where vs.venue_id = venue_owner_withdrawals.venue_id
        and vs.user_id = auth.uid()
        and vs.role in ('owner', 'manager', 'cashier')
        and vs.status = 'active'
    )
  );

drop policy if exists "Venue owner can create withdrawal request" on venue_owner_withdrawals;
create policy "Venue owner can create withdrawal request"
  on venue_owner_withdrawals
  for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1
      from venue_staff vs
      where vs.venue_id = venue_owner_withdrawals.venue_id
        and vs.user_id = auth.uid()
        and vs.role = 'owner'
        and vs.status = 'active'
    )
  );

drop policy if exists "Venue owner manager can update withdrawals" on venue_owner_withdrawals;
create policy "Venue owner manager can update withdrawals"
  on venue_owner_withdrawals
  for update
  using (
    exists (
      select 1
      from venue_staff vs
      where vs.venue_id = venue_owner_withdrawals.venue_id
        and vs.user_id = auth.uid()
        and vs.role in ('owner', 'manager')
        and vs.status = 'active'
    )
  );
