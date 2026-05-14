-- QA: venue_tournament official report submission completion
-- Expected usage:
-- 1. Submit venue report from official MatchReportPage with status = submitted.
-- 2. Run this SQL to verify report/match/assignment completion state.

-- Smoke target: Phase 6 Official Smoke Cup / Phase 6 official smoke assignment

select
  ma.id as assignment_id,
  ma.status as assignment_status,
  ma.source_type,
  vt.id as venue_tournament_id,
  vt.name as tournament_name,
  vm.id as venue_match_id,
  vm.round_name,
  vm.status as match_status,
  vm.home_score,
  vm.away_score,
  vm.winner_team_id,
  vr.id as report_id,
  vr.status as report_status,
  vr.final_score_home,
  vr.final_score_away,
  vr.attendance,
  vr.submitted_at,
  vb.id as booking_id,
  vb.status as booking_status
from public.match_assignments ma
join public.venue_tournaments vt
  on vt.id = ma.venue_tournament_id
join public.venue_tournament_matches vm
  on vm.id = ma.venue_match_id
left join public.venue_match_reports vr
  on vr.venue_match_id = vm.id
left join public.venue_bookings vb
  on vb.id = vm.reservation_booking_id
where ma.notes ilike '%Phase 6 official smoke assignment%'
order by vr.updated_at desc nulls last, ma.assigned_at desc nulls last;

select
  count(*) filter (where vr.status = 'submitted') as submitted_reports,
  count(*) filter (where vm.status = 'completed') as completed_matches,
  count(*) filter (where ma.status = 'completed') as completed_assignments,
  count(*) filter (
    where vr.status = 'submitted'
      and vm.status = 'completed'
      and ma.status = 'completed'
  ) as fully_completed_triplets
from public.match_assignments ma
join public.venue_tournament_matches vm
  on vm.id = ma.venue_match_id
left join public.venue_match_reports vr
  on vr.venue_match_id = vm.id
where ma.source_type = 'venue_tournament'
  and ma.notes ilike '%Phase 6 official smoke assignment%';

select
  ma.id as assignment_id,
  case when ma.status = 'completed' then 'ok' else 'check' end as assignment_completion,
  case when vm.status = 'completed' then 'ok' else 'check' end as match_completion,
  case when vr.status = 'submitted' then 'ok' else 'check' end as report_submission,
  case
    when vr.final_score_home = vm.home_score
     and vr.final_score_away = vm.away_score then 'ok'
    else 'check'
  end as score_sync,
  case
    when vr.status = 'submitted' and vr.submitted_at is not null then 'ok'
    else 'check'
  end as submitted_timestamp,
  case
    when vm.winner_team_id is not null or coalesce(vm.home_score, 0) = coalesce(vm.away_score, 0) then 'ok'
    else 'check'
  end as winner_resolution
from public.match_assignments ma
join public.venue_tournament_matches vm
  on vm.id = ma.venue_match_id
left join public.venue_match_reports vr
  on vr.venue_match_id = vm.id
where ma.source_type = 'venue_tournament'
  and ma.notes ilike '%Phase 6 official smoke assignment%';

select
  ve.venue_match_id,
  count(*) as total_events,
  count(*) filter (where ve.event_type = 'goal') as goal_events,
  count(*) filter (where ve.event_type in ('yellow_card', 'red_card')) as card_events,
  min(ve.minute) as first_event_minute,
  max(ve.minute) as last_event_minute
from public.venue_match_events ve
where ve.venue_match_id in (
  select ma.venue_match_id
  from public.match_assignments ma
  where ma.source_type = 'venue_tournament'
    and ma.notes ilike '%Phase 6 official smoke assignment%'
)
group by ve.venue_match_id;
