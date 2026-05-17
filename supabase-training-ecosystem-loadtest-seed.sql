-- STADIONE Training Ecosystem Load Test Seed
-- Inserts 12 academy/coach/program/event records for UI filter/search/load testing.
-- Idempotent by deterministic names.

do $$
declare
  i int;
  academy_name text;
  coach_name text;
  program_name text;
  event_name text;
  selected_sport training_sport;
  selected_city text;
  selected_province text;
  academy_id_var uuid;
  coach_id_var uuid;
begin
  for i in 1..12 loop
    academy_name := format('LoadTest Academy %s', lpad(i::text, 2, '0'));
    coach_name := format('LoadTest Coach %s', lpad(i::text, 2, '0'));
    program_name := format('LoadTest Program %s', lpad(i::text, 2, '0'));
    event_name := format('LoadTest Event %s', lpad(i::text, 2, '0'));

    selected_sport := case (i % 8)
      when 1 then 'football'::training_sport
      when 2 then 'futsal'::training_sport
      when 3 then 'basketball'::training_sport
      when 4 then 'badminton'::training_sport
      when 5 then 'tennis'::training_sport
      when 6 then 'padel'::training_sport
      when 7 then 'esports'::training_sport
      else 'volleyball'::training_sport
    end;

    selected_city := case (i % 6)
      when 1 then 'Jakarta Selatan'
      when 2 then 'Bandung'
      when 3 then 'Surabaya'
      when 4 then 'Yogyakarta'
      when 5 then 'Semarang'
      else 'Bekasi'
    end;

    selected_province := case
      when selected_city in ('Jakarta Selatan', 'Bekasi') then 'DKI Jakarta'
      when selected_city = 'Bandung' then 'Jawa Barat'
      when selected_city = 'Surabaya' then 'Jawa Timur'
      when selected_city = 'Yogyakarta' then 'DI Yogyakarta'
      else 'Jawa Tengah'
    end;

    if not exists (
      select 1 from public.training_academies ta where ta.name = academy_name
    ) then
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
      values (
        (
          select ur.user_id
          from public.user_roles ur
          where ur.role in ('super_admin', 'internal_admin')
          order by ur.role, ur.user_id
          limit 1
        ),
        academy_name,
        selected_sport,
        selected_province,
        selected_city,
        format('Jl. LoadTest %s No.%s', selected_city, i),
        'U-10 - U-18',
        'intermediate'::training_level,
        250000 + (i * 25000),
        true,
        true,
        true
      );
    end if;

    select ta.id into academy_id_var
    from public.training_academies ta
    where ta.name = academy_name
    limit 1;

    if not exists (
      select 1 from public.training_coaches tc where tc.full_name = coach_name
    ) then
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
      values (
        (
          select ur.user_id
          from public.user_roles ur
          where ur.role = 'coach'
          order by ur.user_id
          limit 1
        ),
        coach_name,
        selected_sport,
        selected_city,
        'LoadTest License',
        3 + i,
        (i % 2 = 0),
        true,
        true,
        true,
        100000 + (i * 15000),
        'Load test coaching profile',
        'Load test seed'
      );
    end if;

    select tc.id into coach_id_var
    from public.training_coaches tc
    where tc.full_name = coach_name
    limit 1;

    if not exists (
      select 1 from public.training_programs tp where tp.title = program_name
    ) then
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
      values (
        academy_id_var,
        coach_id_var,
        program_name,
        'Load Test Program',
        'Monthly',
        2 + (i % 3),
        'Monthly',
        600000 + (i * 50000),
        10,
        18,
        'intermediate'::training_level,
        true
      );
    end if;

    if not exists (
      select 1 from public.training_events te where te.title = event_name
    ) then
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
      values (
        academy_id_var,
        event_name,
        'open_training'::training_event_type,
        selected_sport,
        now() + ((i + 3)::text || ' day')::interval,
        now() + ((i + 3)::text || ' day')::interval + interval '2 hour',
        format('LoadTest Venue %s', i),
        true,
        20 + i,
        50000 + (i * 5000)
      );
    end if;
  end loop;
end;
$$;
