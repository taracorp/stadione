-- QA smoke: simulate venue final report submission without UI
-- This script updates/creates a submitted venue report, then marks
-- venue match and assignment as completed, and returns verification rows.

with target as (
  select
    '23957a27-cb8b-4033-9d06-a054a0864e32'::uuid as venue_tournament_id,
    '6ff02323-6425-4538-9c82-830388ef8fbe'::uuid as venue_match_id,
    '4137372a-fec6-4c03-830e-535ea2c3ea13'::uuid as assignment_id,
    'd1258956-c94b-4ecf-b866-6d355dd3d73e'::uuid as official_user_id
), match_ctx as (
  select
    vm.id,
      vm.tournament_id,
    vm.home_team_id,
    vm.away_team_id,
    home.team_name as home_team_name,
    away.team_name as away_team_name,
    coalesce(vm.home_score, 1) as home_score,
    coalesce(vm.away_score, 0) as away_score
  from public.venue_tournament_matches vm
  left join public.venue_tournament_teams home on home.id = vm.home_team_id
  left join public.venue_tournament_teams away on away.id = vm.away_team_id
  join target t on t.venue_match_id = vm.id
), latest_report as (
  select vr.id
  from public.venue_match_reports vr
  join target t on t.venue_match_id = vr.venue_match_id
  order by vr.updated_at desc nulls last, vr.created_at desc nulls last
  limit 1
), updated_report as (
  update public.venue_match_reports vr
  set
      venue_tournament_id = mc.tournament_id,
    venue_match_id = mc.id,
    submitted_by = t.official_user_id,
    submitter_name = 'Smoke Official',
    final_score_home = mc.home_score,
    final_score_away = mc.away_score,
    home_team = mc.home_team_name,
    away_team = mc.away_team_name,
    report_text = 'Final smoke report submitted by SQL simulation.',
    incidents = 'No major incidents. QA simulation path.',
    attendance = 48,
    venue = 'Court A · Final',
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
  from target t
  join match_ctx mc on true
  where vr.id in (select id from latest_report)
  returning vr.id, vr.status, vr.final_score_home, vr.final_score_away
), inserted_report as (
  insert into public.venue_match_reports (
    venue_tournament_id,
    venue_match_id,
    submitted_by,
    submitter_name,
    final_score_home,
    final_score_away,
    home_team,
    away_team,
    report_text,
    incidents,
    attendance,
    venue,
    status,
    submitted_at,
    updated_at
  )
  select
      mc.tournament_id,
    mc.id,
    t.official_user_id,
    'Smoke Official',
    mc.home_score,
    mc.away_score,
    mc.home_team_name,
    mc.away_team_name,
    'Final smoke report submitted by SQL simulation.',
    'No major incidents. QA simulation path.',
    48,
    'Court A · Final',
    'submitted',
    now(),
    now()
  from target t
  join match_ctx mc on true
  where not exists (select 1 from updated_report)
  returning id, status, final_score_home, final_score_away
), final_report as (
  select * from updated_report
  union all
  select * from inserted_report
), updated_match as (
  update public.venue_tournament_matches vm
  set
    home_score = fr.final_score_home,
    away_score = fr.final_score_away,
    winner_team_id = case
      when fr.final_score_home > fr.final_score_away then vm.home_team_id
      when fr.final_score_away > fr.final_score_home then vm.away_team_id
      else null
    end,
    status = 'completed',
    updated_at = now()
  from final_report fr, target t
  where vm.id = t.venue_match_id
  returning vm.id, vm.status, vm.home_score, vm.away_score, vm.winner_team_id
), updated_assignment as (
  update public.match_assignments ma
  set status = 'completed', updated_at = now()
  from target t
  where ma.id = t.assignment_id
    and ma.user_id = t.official_user_id
  returning ma.id, ma.status
)
select
  ma.id as assignment_id,
  ma.status as assignment_status,
  vm.id as venue_match_id,
  vm.status as match_status,
  vm.home_score,
  vm.away_score,
  vm.winner_team_id,
  vr.id as report_id,
  vr.status as report_status,
  vr.submitted_at,
  vr.attendance,
  case when ma.status = 'completed' then 'ok' else 'check' end as assignment_completion,
  case when vm.status = 'completed' then 'ok' else 'check' end as match_completion,
  case when vr.status = 'submitted' then 'ok' else 'check' end as report_submission,
  case when vr.final_score_home = vm.home_score and vr.final_score_away = vm.away_score then 'ok' else 'check' end as score_sync
from target t
join public.match_assignments ma on ma.id = t.assignment_id
join public.venue_tournament_matches vm on vm.id = t.venue_match_id
left join public.venue_match_reports vr on vr.venue_match_id = vm.id
order by vr.updated_at desc nulls last
limit 1;
