-- STADIONE Training Ecosystem Seed Data
-- Idempotent seed for academy/coach/program/event + sample parent/workspace tenant mapping.

with academy_upsert as (
  insert into public.training_academies (
    owner_user_id,
    name,
    sport,
    province,
    city,
    address,
    age_category,
    level,
    monthly_price,
    verified_identity,
    verified_venue,
    verified_coach
  )
  select
    (
      select ur.user_id
      from public.user_roles ur
      where ur.role in ('super_admin', 'internal_admin')
      order by ur.role, ur.user_id
      limit 1
    ) as owner_user_id,
    'Demo Garuda Academy Tenant',
    'football'::training_sport,
    'DKI Jakarta',
    'Jakarta Selatan',
    'Jl. Stadion Demo No. 10',
    'U-10 - U-18',
    'intermediate'::training_level,
    450000,
    true,
    true,
    true
  where not exists (
    select 1
    from public.training_academies ta
    where ta.name = 'Demo Garuda Academy Tenant'
  )
  returning id
),
academy_row as (
  select id from academy_upsert
  union all
  select ta.id
  from public.training_academies ta
  where ta.name = 'Demo Garuda Academy Tenant'
  limit 1
),
coach_upsert as (
  insert into public.training_coaches (
    user_id,
    full_name,
    sport,
    city,
    license,
    years_experience,
    online_available,
    offline_available,
    private_available,
    group_available,
    session_price,
    specialty,
    achievement
  )
  select
    (
      select ur.user_id
      from public.user_roles ur
      where ur.role = 'coach'
      order by ur.user_id
      limit 1
    ) as user_id,
    'Coach Demo Bambang',
    'football'::training_sport,
    'Jakarta Selatan',
    'AFC C-License',
    10,
    true,
    true,
    true,
    true,
    250000,
    'Tactical buildup & finishing',
    'Demo Coach Seed 2026'
  where not exists (
    select 1
    from public.training_coaches tc
    where tc.full_name = 'Coach Demo Bambang'
  )
  returning id
),
coach_row as (
  select id from coach_upsert
  union all
  select tc.id
  from public.training_coaches tc
  where tc.full_name = 'Coach Demo Bambang'
  limit 1
),
program_seed as (
  insert into public.training_programs (
    academy_id,
    coach_id,
    title,
    program_type,
    package_name,
    sessions_per_week,
    billing_cycle,
    price,
    min_age,
    max_age,
    level,
    is_active
  )
  select
    ar.id,
    cr.id,
    'Demo Elite Development Program',
    'Elite Program',
    'Monthly',
    3,
    'Monthly',
    1350000,
    12,
    18,
    'advanced'::training_level,
    true
  from academy_row ar
  cross join coach_row cr
  where not exists (
    select 1
    from public.training_programs tp
    where tp.title = 'Demo Elite Development Program'
  )
  returning id
),
event_seed as (
  insert into public.training_events (
    academy_id,
    title,
    event_type,
    sport,
    starts_at,
    ends_at,
    venue_name,
    registration_open,
    quota,
    price
  )
  select
    ar.id,
    'Demo Coaching Clinic Jakarta',
    'coaching_clinic'::training_event_type,
    'football'::training_sport,
    now() + interval '10 day',
    now() + interval '10 day' + interval '4 hour',
    'GOR Demo Senayan',
    true,
    50,
    150000
  from academy_row ar
  where not exists (
    select 1
    from public.training_events te
    where te.title = 'Demo Coaching Clinic Jakarta'
  )
  returning id
),
athlete_seed as (
  insert into public.training_athletes (
    user_id,
    academy_id,
    full_name,
    sport,
    position,
    height_cm,
    weight_kg,
    dominant_side,
    status
  )
  select
    (
      select ur.user_id
      from public.user_roles ur
      where ur.role in ('player', 'super_admin', 'internal_admin')
      order by ur.role, ur.user_id
      limit 1
    ) as user_id,
    ar.id,
    'Demo Athlete Aldi',
    'football'::training_sport,
    'Midfielder',
    168,
    58,
    'Kanan',
    'elite_prospect'::athlete_status
  from academy_row ar
  where not exists (
    select 1
    from public.training_athletes ta
    where ta.full_name = 'Demo Athlete Aldi'
  )
  returning id
),
athlete_row as (
  select id from athlete_seed
  union all
  select ta.id
  from public.training_athletes ta
  where ta.full_name = 'Demo Athlete Aldi'
  limit 1
),
parent_candidate as (
  select ur.user_id
  from public.user_roles ur
  where ur.role in ('super_admin', 'internal_admin', 'finance_admin')
  order by ur.role, ur.user_id
  limit 1
),
workspace_owner_candidate as (
  select ur.user_id
  from public.user_roles ur
  where ur.role in ('super_admin', 'internal_admin')
  order by ur.role, ur.user_id
  limit 1
),
workspace_member_seed as (
  insert into public.training_workspace_members (
    academy_id,
    user_id,
    role,
    lifecycle_status
  )
  select
    ar.id,
    woc.user_id,
    'academy_owner',
    'active'
  from academy_row ar
  cross join workspace_owner_candidate woc
  where woc.user_id is not null
    and not exists (
      select 1
      from public.training_workspace_members twm
      where twm.academy_id = ar.id
        and twm.user_id = woc.user_id
        and twm.role = 'academy_owner'
    )
  returning id
),
parent_link_seed as (
  insert into public.training_parent_links (
    athlete_id,
    parent_user_id,
    relationship
  )
  select
    atr.id,
    pc.user_id,
    'Orang Tua Demo'
  from athlete_row atr
  cross join parent_candidate pc
  where pc.user_id is not null
    and not exists (
      select 1
      from public.training_parent_links tpl
      where tpl.athlete_id = atr.id
        and tpl.parent_user_id = pc.user_id
    )
  returning id
)
select
  (select id from academy_row limit 1) as academy_id,
  (select id from coach_row limit 1) as coach_id,
  (select id from athlete_row limit 1) as athlete_id,
  (select count(*) from program_seed) as inserted_programs,
  (select count(*) from event_seed) as inserted_events,
  (select count(*) from workspace_member_seed) as inserted_workspace_members,
  (select count(*) from parent_link_seed) as inserted_parent_links;

insert into public.training_attendance (
  athlete_id,
  academy_id,
  session_date,
  present,
  note
)
select
  ta.id,
  ta.academy_id,
  current_date - offs.day_offset,
  true,
  'Sesi latihan rutin demo'
from public.training_athletes ta
cross join lateral (
  values (1), (3), (5), (8), (10)
) as offs(day_offset)
where ta.full_name = 'Demo Athlete Aldi'
on conflict (athlete_id, session_date) do nothing;

insert into public.training_athlete_reports (
  athlete_id,
  academy_id,
  period_label,
  physical_score,
  technical_score,
  tactical_score,
  mental_score,
  discipline_score,
  coach_notes,
  report_grade,
  created_by
)
select
  ta.id,
  ta.academy_id,
  to_char(current_date, 'Mon YYYY'),
  80,
  88,
  78,
  84,
  90,
  'Perlu meningkatkan positioning dan komunikasi.',
  'A',
  (
    select ur.user_id
    from public.user_roles ur
    where ur.role = 'coach'
    order by ur.user_id
    limit 1
  )
from public.training_athletes ta
where ta.full_name = 'Demo Athlete Aldi'
on conflict (athlete_id, period_label) do nothing;

insert into public.training_invoices (
  invoice_no,
  academy_id,
  athlete_id,
  title,
  amount,
  due_date,
  status,
  payment_method
)
select
  'INV-DEMO-TRAINING-2026-001',
  ta.academy_id,
  ta.id,
  'SPP Bulanan Demo Mei 2026',
  450000,
  current_date + interval '7 day',
  'pending'::training_payment_status,
  'Transfer Bank'
from public.training_athletes ta
where ta.full_name = 'Demo Athlete Aldi'
on conflict (invoice_no) do nothing;
