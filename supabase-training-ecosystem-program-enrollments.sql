-- STADIONE Training Program Enrollments
-- Adds write-path table for program registration from UI.

create table if not exists public.training_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, user_id)
);

create index if not exists idx_training_program_enrollments_program_id
  on public.training_program_enrollments(program_id);

create index if not exists idx_training_program_enrollments_user_id
  on public.training_program_enrollments(user_id);

alter table public.training_program_enrollments enable row level security;

create policy training_program_enrollments_self_read
on public.training_program_enrollments
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.training_programs tp
    where tp.id = training_program_enrollments.program_id
      and public.is_training_workspace_member(tp.academy_id, array['academy_owner','academy_admin','coach','finance_admin'])
  )
);

create policy training_program_enrollments_self_insert
on public.training_program_enrollments
for insert
with check (user_id = auth.uid());

create policy training_program_enrollments_self_update
on public.training_program_enrollments
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy training_program_enrollments_workspace_manage
on public.training_program_enrollments
for all
using (
  exists (
    select 1
    from public.training_programs tp
    where tp.id = training_program_enrollments.program_id
      and public.is_training_workspace_member(tp.academy_id, array['academy_owner','academy_admin'])
  )
)
with check (
  exists (
    select 1
    from public.training_programs tp
    where tp.id = training_program_enrollments.program_id
      and public.is_training_workspace_member(tp.academy_id, array['academy_owner','academy_admin'])
  )
);
