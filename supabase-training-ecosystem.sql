-- STADIONE Training Ecosystem Schema
-- Safe to run incrementally (uses IF NOT EXISTS where possible).

create extension if not exists pgcrypto;

-- ============ ENUMS ============
do $$ begin
  create type training_sport as enum (
    'football', 'futsal', 'basketball', 'volleyball', 'badminton', 'tennis', 'padel', 'esports', 'swimming'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type training_level as enum ('beginner', 'intermediate', 'advanced', 'elite');
exception when duplicate_object then null; end $$;

do $$ begin
  create type training_event_type as enum ('coaching_clinic', 'holiday_camp', 'talent_scouting_camp', 'trial_day', 'open_training');
exception when duplicate_object then null; end $$;

do $$ begin
  create type training_payment_status as enum ('paid', 'pending', 'overdue', 'partial', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type athlete_status as enum ('beginner', 'intermediate', 'elite_prospect');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scholarship_status as enum ('full_scholarship', 'partial_scholarship', 'sponsored_athlete');
exception when duplicate_object then null; end $$;

-- ============ CORE ENTITIES ============
create table if not exists training_academies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  sport training_sport not null,
  province text,
  city text,
  address text,
  age_category text,
  level training_level default 'beginner',
  monthly_price numeric(12,2) default 0,
  verified_identity boolean default false,
  verified_venue boolean default false,
  verified_coach boolean default false,
  is_verified boolean generated always as (verified_identity and verified_venue and verified_coach) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_academies_sport_city on training_academies(sport, city);
create index if not exists idx_training_academies_verified on training_academies(is_verified);

create table if not exists training_coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  sport training_sport not null,
  city text,
  license text,
  years_experience int default 0,
  online_available boolean default false,
  offline_available boolean default true,
  private_available boolean default true,
  group_available boolean default false,
  session_price numeric(12,2) default 0,
  specialty text,
  achievement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_coaches_discovery on training_coaches(sport, city, years_experience);

create table if not exists training_programs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references training_academies(id) on delete cascade,
  coach_id uuid references training_coaches(id) on delete set null,
  title text not null,
  program_type text not null,
  package_name text,
  sessions_per_week int,
  billing_cycle text,
  price numeric(12,2) default 0,
  min_age int,
  max_age int,
  level training_level,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_programs_academy on training_programs(academy_id, is_active);

create table if not exists training_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references training_academies(id) on delete cascade,
  title text not null,
  event_type training_event_type not null,
  sport training_sport not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text,
  registration_open boolean default true,
  quota int,
  price numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists training_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references training_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  athlete_name text,
  payment_status training_payment_status default 'pending',
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);

-- ============ ATHLETE DEVELOPMENT ============
create table if not exists training_athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  academy_id uuid references training_academies(id) on delete set null,
  full_name text not null,
  sport training_sport not null,
  position text,
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  dominant_side text,
  status athlete_status default 'beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_attendance (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references training_athletes(id) on delete cascade,
  academy_id uuid references training_academies(id) on delete set null,
  session_date date not null,
  present boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique(athlete_id, session_date)
);

create table if not exists training_athlete_reports (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references training_athletes(id) on delete cascade,
  academy_id uuid references training_academies(id) on delete set null,
  period_label text not null,
  physical_score numeric(5,2),
  technical_score numeric(5,2),
  tactical_score numeric(5,2),
  mental_score numeric(5,2),
  discipline_score numeric(5,2),
  coach_notes text,
  report_grade text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(athlete_id, period_label)
);

create table if not exists training_tournament_stats (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references training_athletes(id) on delete cascade,
  tournament_id uuid,
  tournament_name text,
  sport training_sport not null,
  matches_played int default 0,
  goals int default 0,
  assists int default 0,
  yellow_cards int default 0,
  red_cards int default 0,
  minutes_played int default 0,
  points int default 0,
  rebounds int default 0,
  kda numeric(8,2),
  mvp_count int default 0,
  win_rate numeric(5,2),
  source text default 'stadione_tournament_integration',
  created_at timestamptz not null default now()
);

create table if not exists training_achievements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references training_athletes(id) on delete cascade,
  title text not null,
  category text,
  event_name text,
  achieved_at date,
  created_at timestamptz not null default now()
);

-- ============ PARENT / PAYMENT ============
create table if not exists training_parent_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references training_athletes(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique(athlete_id, parent_user_id)
);

create table if not exists training_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  academy_id uuid references training_academies(id) on delete set null,
  athlete_id uuid references training_athletes(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null,
  due_date date,
  status training_payment_status default 'pending',
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_training_invoices_status_due on training_invoices(status, due_date);

create table if not exists training_payment_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references training_invoices(id) on delete cascade,
  reminder_type text not null,
  sent_at timestamptz not null default now(),
  channel text
);

create table if not exists training_scholarships (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references training_athletes(id) on delete cascade,
  academy_id uuid references training_academies(id) on delete set null,
  scholarship_type scholarship_status not null,
  coverage_percent numeric(5,2) default 100,
  sponsor_name text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

-- ============ ACCESS & CONTEXT ============
create table if not exists training_workspace_members (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references training_academies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('academy_owner', 'academy_admin', 'coach', 'finance_admin', 'parent', 'athlete')),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'suspended', 'disabled', 'archived')),
  created_at timestamptz not null default now(),
  unique(academy_id, user_id, role)
);

create index if not exists idx_training_workspace_members_user on training_workspace_members(user_id, role, lifecycle_status);

-- ============ VIEWS ============
create or replace view training_parent_dashboard_view as
select
  pl.parent_user_id,
  a.id as athlete_id,
  a.full_name as athlete_name,
  a.status as athlete_status,
  ac.name as academy_name,
  (
    select round((sum(case when at.present then 1 else 0 end)::numeric / nullif(count(*), 0)) * 100, 2)
    from training_attendance at
    where at.athlete_id = a.id
  ) as attendance_rate,
  (
    select count(*)
    from training_invoices i
    where i.athlete_id = a.id and i.status = 'overdue'
  ) as overdue_invoice_count
from training_parent_links pl
join training_athletes a on a.id = pl.athlete_id
left join training_academies ac on ac.id = a.academy_id;

create or replace view training_academy_dashboard_view as
select
  ac.id as academy_id,
  ac.name,
  count(distinct ath.id) as active_athletes,
  count(distinct c.id) as active_coaches,
  count(distinct p.id) filter (where p.is_active) as active_programs,
  coalesce(sum(i.amount) filter (where i.status = 'paid'), 0) as paid_revenue,
  count(distinct i.id) filter (where i.status = 'overdue') as overdue_invoices
from training_academies ac
left join training_athletes ath on ath.academy_id = ac.id
left join training_coaches c on c.user_id in (
  select wm.user_id from training_workspace_members wm where wm.academy_id = ac.id and wm.role = 'coach'
)
left join training_programs p on p.academy_id = ac.id
left join training_invoices i on i.academy_id = ac.id
group by ac.id, ac.name;

-- ============ TRIGGER FOR updated_at ============
create or replace function training_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_training_academies_updated_at on training_academies;
create trigger trg_training_academies_updated_at
before update on training_academies
for each row execute function training_touch_updated_at();

drop trigger if exists trg_training_coaches_updated_at on training_coaches;
create trigger trg_training_coaches_updated_at
before update on training_coaches
for each row execute function training_touch_updated_at();

drop trigger if exists trg_training_programs_updated_at on training_programs;
create trigger trg_training_programs_updated_at
before update on training_programs
for each row execute function training_touch_updated_at();

drop trigger if exists trg_training_athletes_updated_at on training_athletes;
create trigger trg_training_athletes_updated_at
before update on training_athletes
for each row execute function training_touch_updated_at();

-- NOTE:
-- Add RLS policies according to your role model after validating roles in production.
