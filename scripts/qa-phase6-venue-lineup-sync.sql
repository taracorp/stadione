-- QA: verify venue lineup engine sync for official Match Center

select
  exists (
    select 1
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = 'venue_match_lineups'
  ) as has_venue_match_lineups_table;

select
  ma.id as assignment_id,
  vm.id as venue_match_id,
  vm.status as match_status,
  count(vl.id) as total_lineup_rows,
  count(vl.id) filter (where vl.starting_eleven) as starting_eleven_rows,
  min(vl.created_at) as first_lineup_at,
  max(vl.updated_at) as last_lineup_at
from public.match_assignments ma
join public.venue_tournament_matches vm
  on vm.id = ma.venue_match_id
left join public.venue_match_lineups vl
  on vl.venue_match_id = vm.id
where ma.source_type = 'venue_tournament'
  and ma.notes ilike '%Phase 6 official smoke assignment%'
group by ma.id, vm.id, vm.status;

select
  vl.venue_match_id,
  vl.team_id,
  vl.player_key,
  vl.player_name,
  vl.starting_eleven,
  vl.updated_at
from public.venue_match_lineups vl
where vl.venue_match_id in (
  select ma.venue_match_id
  from public.match_assignments ma
  where ma.source_type = 'venue_tournament'
    and ma.notes ilike '%Phase 6 official smoke assignment%'
)
order by vl.starting_eleven desc, vl.player_name asc
limit 50;
