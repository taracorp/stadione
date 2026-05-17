-- STADIONE Training Ecosystem FK Indexes
-- Improves join/filter performance for training_* foreign key columns.

create index if not exists idx_training_academies_owner_user_id
  on public.training_academies(owner_user_id);

create index if not exists idx_training_coaches_user_id
  on public.training_coaches(user_id);

create index if not exists idx_training_programs_coach_id
  on public.training_programs(coach_id);

create index if not exists idx_training_events_academy_id
  on public.training_events(academy_id);

create index if not exists idx_training_event_registrations_event_id
  on public.training_event_registrations(event_id);

create index if not exists idx_training_event_registrations_user_id
  on public.training_event_registrations(user_id);

create index if not exists idx_training_athletes_user_id
  on public.training_athletes(user_id);

create index if not exists idx_training_athletes_academy_id
  on public.training_athletes(academy_id);

create index if not exists idx_training_attendance_athlete_id
  on public.training_attendance(athlete_id);

create index if not exists idx_training_attendance_academy_id
  on public.training_attendance(academy_id);

create index if not exists idx_training_athlete_reports_athlete_id
  on public.training_athlete_reports(athlete_id);

create index if not exists idx_training_athlete_reports_academy_id
  on public.training_athlete_reports(academy_id);

create index if not exists idx_training_athlete_reports_created_by
  on public.training_athlete_reports(created_by);

create index if not exists idx_training_tournament_stats_athlete_id
  on public.training_tournament_stats(athlete_id);

create index if not exists idx_training_achievements_athlete_id
  on public.training_achievements(athlete_id);

create index if not exists idx_training_parent_links_athlete_id
  on public.training_parent_links(athlete_id);

create index if not exists idx_training_parent_links_parent_user_id
  on public.training_parent_links(parent_user_id);

create index if not exists idx_training_invoices_academy_id
  on public.training_invoices(academy_id);

create index if not exists idx_training_invoices_athlete_id
  on public.training_invoices(athlete_id);

create index if not exists idx_training_payment_reminders_invoice_id
  on public.training_payment_reminders(invoice_id);

create index if not exists idx_training_scholarships_athlete_id
  on public.training_scholarships(athlete_id);

create index if not exists idx_training_scholarships_academy_id
  on public.training_scholarships(academy_id);

create index if not exists idx_training_workspace_members_academy_id
  on public.training_workspace_members(academy_id);

create index if not exists idx_training_workspace_members_user_id
  on public.training_workspace_members(user_id);
