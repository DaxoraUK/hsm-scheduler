-- League Manager: generate a complete weekly playing-date calendar and stop
-- a single configured date from producing hundreds of misleading conflicts.

create or replace function public.generate_league_playing_date_calendar(
  target_league_id uuid,
  target_season_id uuid,
  weekday_numbers integer[] default array[6],
  default_kick_off time default '15:00',
  target_division_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  season_row public.league_seasons%rowtype;
  safe_weekdays integer[];
  inserted_count integer := 0;
  total_available integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_operate_league(target_league_id) then
    raise exception 'League scheduling permission required' using errcode = '42501';
  end if;

  select season_value.*
  into season_row
  from public.league_seasons season_value
  where season_value.id = target_season_id
    and season_value.league_id = target_league_id;

  if season_row.id is null then
    raise exception 'The selected season does not belong to this league' using errcode = '23503';
  end if;

  if season_row.starts_on is null or season_row.ends_on is null or season_row.ends_on < season_row.starts_on then
    raise exception 'The season needs valid start and end dates before generating its calendar' using errcode = '22023';
  end if;

  if target_division_id is not null and not exists (
    select 1
    from public.league_divisions division_value
    where division_value.id = target_division_id
      and division_value.league_id = target_league_id
      and division_value.season_id = target_season_id
  ) then
    raise exception 'The selected division does not belong to this season' using errcode = '23503';
  end if;

  select coalesce(array_agg(distinct weekday_value order by weekday_value), '{}'::integer[])
  into safe_weekdays
  from unnest(coalesce(weekday_numbers, '{}'::integer[])) weekday_value
  where weekday_value between 0 and 6;

  if coalesce(array_length(safe_weekdays, 1), 0) = 0 then
    raise exception 'Select at least one valid playing weekday' using errcode = '22023';
  end if;

  insert into public.league_playing_dates (
    id,
    league_id,
    season_id,
    division_id,
    playing_date,
    default_kick_off,
    status,
    notes
  )
  select
    gen_random_uuid(),
    target_league_id,
    target_season_id,
    target_division_id,
    generated_day::date,
    coalesce(default_kick_off, '15:00'::time),
    'available',
    'Generated weekly season calendar'
  from generate_series(season_row.starts_on, season_row.ends_on, interval '1 day') generated_day
  where extract(dow from generated_day)::integer = any(safe_weekdays)
    and not exists (
      select 1
      from public.league_playing_dates existing_date
      where existing_date.league_id = target_league_id
        and existing_date.season_id = target_season_id
        and existing_date.division_id is not distinct from target_division_id
        and existing_date.playing_date = generated_day::date
    );

  get diagnostics inserted_count = row_count;

  select count(*)::integer
  into total_available
  from public.league_playing_dates date_value
  where date_value.league_id = target_league_id
    and date_value.season_id = target_season_id
    and date_value.division_id is not distinct from target_division_id
    and date_value.status = 'available';

  perform private.write_league_audit(
    target_league_id,
    'league.playing_dates.calendar_generated',
    'season',
    target_season_id,
    jsonb_build_object(
      'weekdays', safe_weekdays,
      'default_kick_off', coalesce(default_kick_off, '15:00'::time),
      'division_id', target_division_id,
      'inserted', inserted_count,
      'total_available', total_available,
      'season_starts_on', season_row.starts_on,
      'season_ends_on', season_row.ends_on
    )
  );

  return jsonb_build_object(
    'inserted', inserted_count,
    'total_available', total_available,
    'season_starts_on', season_row.starts_on,
    'season_ends_on', season_row.ends_on,
    'weekdays', safe_weekdays
  );
end;
$$;

revoke all on function public.generate_league_playing_date_calendar(uuid, uuid, integer[], time, uuid) from public, anon;
grant execute on function public.generate_league_playing_date_calendar(uuid, uuid, integer[], time, uuid) to authenticated;
