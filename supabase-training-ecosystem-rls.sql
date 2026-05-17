-- STADIONE Training Ecosystem RLS Policies
-- Apply after training_ecosystem_schema_v1.

create or replace function public.is_training_workspace_member(target_academy uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.training_workspace_members twm
    where twm.user_id = auth.uid()
      and twm.academy_id = target_academy
      and twm.lifecycle_status = 'active'
      and (allowed_roles is null or twm.role = any(allowed_roles))
  );
$$;

create or replace function public.is_training_parent_of(target_athlete uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.training_parent_links tpl
    where tpl.parent_user_id = auth.uid()
      and tpl.athlete_id = target_athlete
  );
$$;

alter table public.training_academies enable row level security;
alter table public.training_coaches enable row level security;
alter table public.training_programs enable row level security;
alter table public.training_events enable row level security;
alter table public.training_event_registrations enable row level security;
alter table public.training_athletes enable row level security;
alter table public.training_attendance enable row level security;
alter table public.training_athlete_reports enable row level security;
alter table public.training_tournament_stats enable row level security;
alter table public.training_achievements enable row level security;
alter table public.training_parent_links enable row level security;
alter table public.training_invoices enable row level security;
alter table public.training_payment_reminders enable row level security;
alter table public.training_scholarships enable row level security;
alter table public.training_workspace_members enable row level security;

create policy training_academies_public_read
on public.training_academies
for select
using (true);

create policy training_academies_owner_manage
on public.training_academies
for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy training_coaches_public_read
on public.training_coaches
for select
using (true);

create policy training_coaches_self_manage
on public.training_coaches
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy training_programs_public_read
on public.training_programs
for select
using (is_active = true or public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach','finance_admin']));

create policy training_programs_workspace_manage
on public.training_programs
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']));

create policy training_events_public_read
on public.training_events
for select
using (registration_open = true or public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']));

create policy training_events_workspace_manage
on public.training_events
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']));

create policy training_event_registrations_self_read
on public.training_event_registrations
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.training_events te
    where te.id = training_event_registrations.event_id
      and public.is_training_workspace_member(te.academy_id, array['academy_owner','academy_admin','coach','finance_admin'])
  )
);

create policy training_event_registrations_self_insert
on public.training_event_registrations
for insert
with check (user_id = auth.uid());

create policy training_event_registrations_self_update
on public.training_event_registrations
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy training_athletes_member_or_parent_read
on public.training_athletes
for select
using (
  public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach','finance_admin','parent'])
  or public.is_training_parent_of(id)
  or user_id = auth.uid()
);

create policy training_athletes_workspace_manage
on public.training_athletes
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']));

create policy training_attendance_member_or_parent_read
on public.training_attendance
for select
using (
  public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach','finance_admin','parent'])
  or public.is_training_parent_of(athlete_id)
);

create policy training_attendance_workspace_manage
on public.training_attendance
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']));

create policy training_reports_member_or_parent_read
on public.training_athlete_reports
for select
using (
  public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach','finance_admin','parent'])
  or public.is_training_parent_of(athlete_id)
);

create policy training_reports_workspace_manage
on public.training_athlete_reports
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach']));

create policy training_stats_member_or_parent_read
on public.training_tournament_stats
for select
using (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_tournament_stats.athlete_id
      and (
        public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach','finance_admin','parent'])
        or public.is_training_parent_of(ta.id)
      )
  )
);

create policy training_stats_workspace_manage
on public.training_tournament_stats
for all
using (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_tournament_stats.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach'])
  )
)
with check (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_tournament_stats.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach'])
  )
);

create policy training_achievements_member_or_parent_read
on public.training_achievements
for select
using (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_achievements.athlete_id
      and (
        public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach','finance_admin','parent'])
        or public.is_training_parent_of(ta.id)
      )
  )
);

create policy training_achievements_workspace_manage
on public.training_achievements
for all
using (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_achievements.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach'])
  )
)
with check (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_achievements.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach'])
  )
);

create policy training_parent_links_parent_read
on public.training_parent_links
for select
using (
  parent_user_id = auth.uid()
  or exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_parent_links.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin','coach','finance_admin'])
  )
);

create policy training_parent_links_parent_insert
on public.training_parent_links
for insert
with check (parent_user_id = auth.uid());

create policy training_parent_links_workspace_manage
on public.training_parent_links
for all
using (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_parent_links.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin'])
  )
)
with check (
  exists (
    select 1
    from public.training_athletes ta
    where ta.id = training_parent_links.athlete_id
      and public.is_training_workspace_member(ta.academy_id, array['academy_owner','academy_admin'])
  )
);

create policy training_invoices_member_or_parent_read
on public.training_invoices
for select
using (
  public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach','finance_admin'])
  or (athlete_id is not null and public.is_training_parent_of(athlete_id))
);

create policy training_invoices_workspace_manage
on public.training_invoices
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','finance_admin']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','finance_admin']));

create policy training_payment_reminders_workspace_read
on public.training_payment_reminders
for select
using (
  exists (
    select 1
    from public.training_invoices ti
    where ti.id = training_payment_reminders.invoice_id
      and public.is_training_workspace_member(ti.academy_id, array['academy_owner','academy_admin','finance_admin'])
  )
);

create policy training_payment_reminders_workspace_manage
on public.training_payment_reminders
for all
using (
  exists (
    select 1
    from public.training_invoices ti
    where ti.id = training_payment_reminders.invoice_id
      and public.is_training_workspace_member(ti.academy_id, array['academy_owner','academy_admin','finance_admin'])
  )
)
with check (
  exists (
    select 1
    from public.training_invoices ti
    where ti.id = training_payment_reminders.invoice_id
      and public.is_training_workspace_member(ti.academy_id, array['academy_owner','academy_admin','finance_admin'])
  )
);

create policy training_scholarships_member_or_parent_read
on public.training_scholarships
for select
using (
  public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','coach','finance_admin'])
  or public.is_training_parent_of(athlete_id)
);

create policy training_scholarships_workspace_manage
on public.training_scholarships
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','finance_admin']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin','finance_admin']));

create policy training_workspace_members_self_read
on public.training_workspace_members
for select
using (user_id = auth.uid() or public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']));

create policy training_workspace_members_admin_manage
on public.training_workspace_members
for all
using (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']))
with check (public.is_training_workspace_member(academy_id, array['academy_owner','academy_admin']));
