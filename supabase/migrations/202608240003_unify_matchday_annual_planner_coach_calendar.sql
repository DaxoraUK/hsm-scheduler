-- Keep the operator Annual Planner and each team-scoped Coach Hub calendar on
-- one durable timeline. Matchday rows remain release-owned records and can be
-- safely replaced when an operator rebuilds a day.
begin;

delete from public.annual_planner_bookings older
using public.annual_planner_bookings newer
where older.club_id = newer.club_id
  and older.source_type = newer.source_type
  and older.source_id = newer.source_id
  and older.source_type like 'matchday_%'
  and older.source_id is not null
  and older.id < newer.id;

create unique index if not exists annual_planner_matchday_source_key
  on public.annual_planner_bookings(club_id, source_type, source_id)
  where source_type like 'matchday_%' and source_id is not null;

create or replace function public.sync_matchday_calendar(
  target_club_id uuid,
  day_scope text,
  matchday_date date,
  fixture_rows jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_scope text := lower(trim(coalesce(day_scope, '')));
  safe_source_type text;
  row_data jsonb;
  source_id_value text;
  incoming_ids text[] := '{}';
  saved_count integer := 0;
  removed_count integer := 0;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operations access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Annual Planner is not enabled for this club' using errcode = '42501';
  end if;
  if safe_scope not in ('saturday', 'sunday', 'midweek') then
    raise exception 'Unsupported matchday scope' using errcode = '22023';
  end if;
  if matchday_date is null then
    raise exception 'Matchday date is required' using errcode = '22023';
  end if;
  if fixture_rows is null or jsonb_typeof(fixture_rows) <> 'array' then
    raise exception 'fixture_rows must be a JSON array' using errcode = '22023';
  end if;

  safe_source_type := 'matchday_' || safe_scope;

  for row_data in select value from jsonb_array_elements(fixture_rows)
  loop
    source_id_value := nullif(trim(coalesce(row_data->>'sourceId', row_data->>'source_id', row_data->>'id')), '');
    if source_id_value is null then
      raise exception 'Each matchday fixture requires a stable source id' using errcode = '22023';
    end if;
    incoming_ids := array_append(incoming_ids, source_id_value);

    insert into public.annual_planner_bookings(
      club_id, title, booking_type, status, team_key, team_name, opponent_name,
      venue_id, venue_name, pitch_id, pitch_name, start_at, end_at,
      recurrence, cost_pence, source_type, source_id, created_by, updated_by
    ) values (
      target_club_id,
      left(trim(coalesce(row_data->>'title', 'Match fixture')), 240),
      'match',
      'confirmed',
      nullif(trim(coalesce(row_data->>'teamKey', row_data->>'team_key')), ''),
      nullif(trim(coalesce(row_data->>'teamName', row_data->>'team_name')), ''),
      nullif(trim(coalesce(row_data->>'opponentName', row_data->>'opponent_name')), ''),
      nullif(trim(coalesce(row_data->>'venueId', row_data->>'venue_id')), ''),
      nullif(trim(coalesce(row_data->>'venueName', row_data->>'venue_name')), ''),
      nullif(trim(coalesce(row_data->>'pitchId', row_data->>'pitch_id')), ''),
      nullif(trim(coalesce(row_data->>'pitchName', row_data->>'pitch_name')), ''),
      (row_data->>'startAt')::timestamptz,
      (row_data->>'endAt')::timestamptz,
      'none', 0, safe_source_type, source_id_value, actor_id, actor_id
    )
    on conflict (club_id, source_type, source_id)
      where source_type like 'matchday_%' and source_id is not null
    do update set
      title = excluded.title,
      status = 'confirmed',
      team_key = excluded.team_key,
      team_name = excluded.team_name,
      opponent_name = excluded.opponent_name,
      venue_id = excluded.venue_id,
      venue_name = excluded.venue_name,
      pitch_id = excluded.pitch_id,
      pitch_name = excluded.pitch_name,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      updated_by = actor_id,
      updated_at = now();
    saved_count := saved_count + 1;
  end loop;

  delete from public.annual_planner_bookings booking
  where booking.club_id = target_club_id
    and booking.source_type = safe_source_type
    and booking.start_at >= matchday_date::timestamptz
    and booking.start_at < (matchday_date + 1)::timestamptz
    and not (booking.source_id = any(incoming_ids));
  get diagnostics removed_count = row_count;

  perform private.record_coach_hub_audit_event(
    target_club_id,
    'matchday.calendar.synchronised',
    'matchday_calendar',
    safe_scope || ':' || matchday_date::text,
    jsonb_build_object('day_scope', safe_scope, 'matchday_date', matchday_date, 'saved', saved_count, 'removed', removed_count)
  );

  return jsonb_build_object('day_scope', safe_scope, 'matchday_date', matchday_date, 'saved', saved_count, 'removed', removed_count);
end;
$$;

revoke all on function public.sync_matchday_calendar(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.sync_matchday_calendar(uuid, text, date, jsonb) to authenticated;

commit;
