-- STADIONE Training Ecosystem Cleanup / Reset Script
-- Removes demo and load-test seeded data to keep dev environment clean.
-- Safe and idempotent.

with target_academies as (
  select id from public.training_academies
  where name like 'Demo %' or name like 'LoadTest %'
),
target_programs as (
  select id from public.training_programs
  where title like 'Demo %' or title like 'LoadTest %'
),
target_events as (
  select id from public.training_events
  where title like 'Demo %' or title like 'LoadTest %'
),
target_athletes as (
  select id from public.training_athletes
  where full_name like 'Demo %' or full_name like 'LoadTest %'
),
target_coaches as (
  select id from public.training_coaches
  where full_name like 'Coach Demo %' or full_name like 'LoadTest Coach %'
)

delete from public.training_program_enrollments tpe
where tpe.program_id in (select id from target_programs);

delete from public.training_event_registrations ter
where ter.event_id in (select id from target_events);

delete from public.training_payment_reminders tpr
where tpr.invoice_id in (
  select ti.id from public.training_invoices ti where ti.athlete_id in (select id from target_athletes)
);

delete from public.training_invoices ti
where ti.athlete_id in (select id from target_athletes)
   or ti.academy_id in (select id from target_academies)
   or ti.invoice_no like 'INV-DEMO-%';

delete from public.training_athlete_reports tar
where tar.athlete_id in (select id from target_athletes)
   or tar.academy_id in (select id from target_academies);

delete from public.training_tournament_stats tts
where tts.athlete_id in (select id from target_athletes);

delete from public.training_achievements tach
where tach.athlete_id in (select id from target_athletes);

delete from public.training_attendance tatt
where tatt.athlete_id in (select id from target_athletes)
   or tatt.academy_id in (select id from target_academies);

delete from public.training_parent_links tpl
where tpl.athlete_id in (select id from target_athletes);

delete from public.training_workspace_members twm
where twm.academy_id in (select id from target_academies);

delete from public.training_events te
where te.id in (select id from target_events)
   or te.academy_id in (select id from target_academies);

delete from public.training_programs tp
where tp.id in (select id from target_programs)
   or tp.academy_id in (select id from target_academies);

delete from public.training_athletes ta
where ta.id in (select id from target_athletes)
   or ta.academy_id in (select id from target_academies);

delete from public.training_scholarships ts
where ts.athlete_id in (select id from target_athletes)
   or ts.academy_id in (select id from target_academies);

delete from public.training_coaches tc
where tc.id in (select id from target_coaches);

delete from public.training_academies ta
where ta.id in (select id from target_academies);

select
  (select count(*) from public.training_academies where name like 'Demo %' or name like 'LoadTest %') as remaining_demo_academies,
  (select count(*) from public.training_coaches where full_name like 'Coach Demo %' or full_name like 'LoadTest Coach %') as remaining_demo_coaches,
  (select count(*) from public.training_programs where title like 'Demo %' or title like 'LoadTest %') as remaining_demo_programs,
  (select count(*) from public.training_events where title like 'Demo %' or title like 'LoadTest %') as remaining_demo_events;
