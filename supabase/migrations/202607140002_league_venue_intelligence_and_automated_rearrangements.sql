-- Daxora League Operations: venue intelligence and controlled rearrangements.
-- Seeds the pilot league venue map, supports bulk UK postcode geocoding, records
-- coordinate provenance and applies validated postponements into a new schedule version.

begin;

alter table public.league_venues
  add column if not exists coordinate_source text,
  add column if not exists coordinate_accuracy text,
  add column if not exists coordinate_updated_at timestamptz;

alter table public.league_venues drop constraint if exists league_venues_coordinate_source_check;
alter table public.league_venues add constraint league_venues_coordinate_source_check
  check (coordinate_source is null or coordinate_source in ('postcode_centroid', 'manual', 'import'));

alter table public.league_postponement_requests
  add column if not exists selected_date date,
  add column if not exists selected_kick_off time,
  add column if not exists selected_venue_id uuid references public.league_venues(id) on delete set null,
  add column if not exists resolution_version_id uuid references public.league_schedule_versions(id) on delete set null,
  add column if not exists resolved_at timestamptz;

-- Current Lancashire Amateur League pilot venue postcodes. These are postcode
-- centroids and remain operator-editable; a manual save supersedes the seed.
with coordinate_seed(postcode_key, latitude, longitude) as (
  values
    ('WN50DQ', 53.541608::numeric, -2.686934::numeric),
    ('BL26RF', 53.573921::numeric, -2.366925::numeric),
    ('BL26NX', 53.579856::numeric, -2.380599::numeric),
    ('BB101JH', 53.803337::numeric, -2.237346::numeric),
    ('BL90HH', 53.589945::numeric, -2.303689::numeric),
    ('M246XH', 53.569124::numeric, -2.188708::numeric),
    ('WN50TU', 53.541128::numeric, -2.653909::numeric),
    ('WN50UE', 53.541128::numeric, -2.653909::numeric),
    ('BL48HY', 53.539525::numeric, -2.386182::numeric),
    ('BL70EU', 53.637995::numeric, -2.404339::numeric),
    ('M146ZT', 53.441816::numeric, -2.212575::numeric),
    ('OL115EX', 53.614041::numeric, -2.180442::numeric),
    ('OL129ER', 53.638637::numeric, -2.135870::numeric),
    ('BL15ES', 53.584343::numeric, -2.482389::numeric),
    ('BL33HH', 53.555824::numeric, -2.447466::numeric),
    ('BL99FX', 53.587797::numeric, -2.292676::numeric),
    ('WN58NU', 53.541017::numeric, -2.700490::numeric),
    ('WA139HR', 53.385414::numeric, -2.455871::numeric),
    ('BB47SN', 53.702730::numeric, -2.273404::numeric),
    ('PR98NP', 53.669148::numeric, -2.961906::numeric),
    ('SK97WA', 53.292537::numeric, -2.287608::numeric),
    ('SK97TT', 53.292537::numeric, -2.287608::numeric),
    ('BB56BD', 53.760964::numeric, -2.361169::numeric),
    ('WN48SL', 53.492881::numeric, -2.622930::numeric),
    ('BB22QZ', 53.737227::numeric, -2.503255::numeric),
    ('BL67QE', 53.602630::numeric, -2.555633::numeric),
    ('BL67NH', 53.601945::numeric, -2.550169::numeric),
    ('BL25RZ', 53.587086::numeric, -2.362008::numeric),
    ('OL128BA', 53.661757::numeric, -2.175381::numeric)
)
update public.league_venues venue
set latitude = seed.latitude,
    longitude = seed.longitude,
    coordinate_source = 'postcode_centroid',
    coordinate_accuracy = 'postcode',
    coordinate_updated_at = now(),
    updated_at = now()
from coordinate_seed seed
where regexp_replace(upper(coalesce(venue.postcode, '')), '[^A-Z0-9]', '', 'g') = seed.postcode_key
  and (venue.latitude is null or venue.longitude is null);

create or replace function public.update_league_venue_map_position(
  target_league_id uuid,
  target_venue_id uuid,
  target_latitude numeric,
  target_longitude numeric
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  if target_latitude not between -90 and 90 or target_longitude not between -180 and 180 then raise exception 'Invalid map coordinates' using errcode = '22023'; end if;
  update public.league_venues
  set latitude = target_latitude,
      longitude = target_longitude,
      coordinate_source = 'manual',
      coordinate_accuracy = 'operator_refined',
      coordinate_updated_at = now(),
      updated_at = now()
  where id = target_venue_id and league_id = target_league_id;
  if not found then raise exception 'Venue not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.venue_map_position_saved', 'venue', target_venue_id, jsonb_build_object('latitude', target_latitude, 'longitude', target_longitude, 'source', 'manual'));
end;
$$;

create or replace function public.bulk_update_league_venue_map_positions(
  target_league_id uuid,
  coordinate_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  row_data jsonb;
  venue_record_id uuid;
  next_latitude numeric;
  next_longitude numeric;
  next_source text;
  next_accuracy text;
  updated_count integer := 0;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  if coordinate_rows is null or jsonb_typeof(coordinate_rows) <> 'array' then raise exception 'Coordinate rows must be an array' using errcode = '22023'; end if;
  if jsonb_array_length(coordinate_rows) > 200 then raise exception 'No more than 200 venues can be mapped at once' using errcode = '22023'; end if;

  for row_data in select value from jsonb_array_elements(coordinate_rows)
  loop
    venue_record_id := nullif(row_data ->> 'venue_id', '')::uuid;
    next_latitude := nullif(row_data ->> 'latitude', '')::numeric;
    next_longitude := nullif(row_data ->> 'longitude', '')::numeric;
    next_source := lower(trim(coalesce(row_data ->> 'coordinate_source', 'postcode_centroid')));
    next_accuracy := nullif(trim(coalesce(row_data ->> 'coordinate_accuracy', 'postcode')), '');
    if venue_record_id is null or next_latitude is null or next_longitude is null then raise exception 'Every coordinate row requires a venue, latitude and longitude' using errcode = '22023'; end if;
    if next_latitude not between -90 and 90 or next_longitude not between -180 and 180 then raise exception 'Invalid map coordinates' using errcode = '22023'; end if;
    if next_source not in ('postcode_centroid', 'manual', 'import') then raise exception 'Invalid coordinate source' using errcode = '22023'; end if;

    update public.league_venues
    set latitude = next_latitude,
        longitude = next_longitude,
        coordinate_source = next_source,
        coordinate_accuracy = next_accuracy,
        coordinate_updated_at = now(),
        updated_at = now()
    where id = venue_record_id and league_id = target_league_id;
    if not found then raise exception 'Venue does not belong to this league' using errcode = '23503'; end if;
    updated_count := updated_count + 1;
  end loop;

  perform private.write_league_audit(target_league_id, 'league.venue_positions_bulk_saved', 'venue_batch', null, jsonb_build_object('count', updated_count));
  return jsonb_build_object('updated', updated_count);
end;
$$;

create or replace function public.get_league_operations_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if not public.can_view_league(target_league_id) then raise exception 'League workspace access denied' using errcode = '42501'; end if;

  select jsonb_build_object(
    'access', jsonb_build_object(
      'can_manage', public.can_manage_league(target_league_id),
      'can_operate', public.can_operate_league(target_league_id),
      'can_manage_officials', public.can_manage_league_officials(target_league_id)
    ),
    'officials', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.status, row_value.name) from public.league_officials row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.available_on, row_value.starts_at) from public.league_official_availability row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'conflicts', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at) from public.league_official_conflicts row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'requirements', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.scope_type, row_value.created_at) from public.league_official_requirements row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(
        to_jsonb(row_value) || jsonb_build_object(
          'response_token', case when public.can_manage_league_officials(target_league_id) and row_value.response_token_hash is not null then token_store.raw_token else null end
        )
        order by row_value.target_date, row_value.kick_off, row_value.role
      )
      from public.league_official_assignments row_value
      left join private.league_official_response_tokens token_store on token_store.assignment_id = row_value.id
      where row_value.league_id = target_league_id
    ), '[]'::jsonb),
    'postponements', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.deadline_on nulls last, row_value.created_at) from public.league_postponement_requests row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'venue_positions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', venue.id,
      'latitude', venue.latitude,
      'longitude', venue.longitude,
      'coordinate_source', venue.coordinate_source,
      'coordinate_accuracy', venue.coordinate_accuracy,
      'coordinate_updated_at', venue.coordinate_updated_at
    ) order by venue.name) from public.league_venues venue where venue.league_id = target_league_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.save_league_postponement_suggestions(
  target_league_id uuid,
  target_postponement_id uuid,
  suggestion_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture operation access required' using errcode = '42501'; end if;
  if suggestion_rows is null or jsonb_typeof(suggestion_rows) <> 'array' then raise exception 'Suggestions must be an array' using errcode = '22023'; end if;
  if jsonb_array_length(suggestion_rows) > 12 then raise exception 'A maximum of 12 rearrangement suggestions can be stored' using errcode = '22023'; end if;
  update public.league_postponement_requests
  set proposed_dates = suggestion_rows,
      status = case when jsonb_array_length(suggestion_rows) > 0 then 'proposed' else 'rearrangement_required' end,
      updated_at = now()
  where id = target_postponement_id and league_id = target_league_id
    and status not in ('rearranged', 'closed', 'rejected');
  if not found then raise exception 'Open postponement not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.rearrangement_suggestions_saved', 'postponement', target_postponement_id, jsonb_build_object('count', jsonb_array_length(suggestion_rows)));
end;
$$;

create or replace function public.apply_league_postponement_rearrangement(
  target_league_id uuid,
  target_postponement_id uuid,
  rearranged_date date,
  rearranged_kick_off time default null,
  rearranged_venue_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  postponement public.league_postponement_requests%rowtype;
  source_entry public.league_schedule_entries%rowtype;
  source_version public.league_schedule_versions%rowtype;
  division_row public.league_divisions%rowtype;
  season_row public.league_seasons%rowtype;
  venue_row public.league_venues%rowtype;
  next_kick_off time;
  next_venue_id uuid;
  next_version_number integer;
  next_version_id uuid;
  next_entry_id uuid;
  home_club_id uuid;
  away_club_id uuid;
  selected_ground_key text;
  selected_ground_capacity integer;
  selected_ground_usage integer;
  selected_venue_usage integer;
  assignment_row record;
  raw_token text;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture operation access required' using errcode = '42501'; end if;
  if rearranged_date is null then raise exception 'A rearranged date is required' using errcode = '22023'; end if;

  select request.* into postponement
  from public.league_postponement_requests request
  where request.id = target_postponement_id and request.league_id = target_league_id
  for update;
  if postponement.id is null then raise exception 'Postponement not found' using errcode = 'P0002'; end if;
  if postponement.status in ('rearranged', 'closed', 'rejected') then raise exception 'This postponement is no longer open' using errcode = '42501'; end if;
  if postponement.target_type <> 'schedule_entry' then raise exception 'Automatic rearrangement currently requires a versioned league schedule fixture' using errcode = '22023'; end if;

  select entry.* into source_entry
  from public.league_schedule_entries entry
  where entry.id = postponement.target_id and entry.league_id = target_league_id;
  if source_entry.id is null then raise exception 'Schedule fixture not found' using errcode = 'P0002'; end if;
  if source_entry.locked then raise exception 'Locked fixtures must be unlocked before rearrangement' using errcode = '42501'; end if;

  select version_value.* into source_version from public.league_schedule_versions version_value where version_value.id = source_entry.version_id and version_value.league_id = target_league_id;
  select division_value.* into division_row from public.league_divisions division_value where division_value.id = source_entry.division_id and division_value.league_id = target_league_id;
  select season_value.* into season_row from public.league_seasons season_value where season_value.id = source_entry.season_id and season_value.league_id = target_league_id;
  next_kick_off := coalesce(rearranged_kick_off, division_row.default_kick_off, season_row.default_kick_off, source_entry.kick_off);
  next_venue_id := coalesce(rearranged_venue_id, source_entry.venue_id);
  if next_kick_off is null or next_venue_id is null then raise exception 'A rearranged fixture requires a kick-off and venue' using errcode = '23502'; end if;
  select venue.* into venue_row from public.league_venues venue where venue.id = next_venue_id and venue.league_id = target_league_id and venue.status = 'active';
  if venue_row.id is null then raise exception 'Selected venue is not active in this league' using errcode = '23503'; end if;

  if rearranged_date < coalesce(division_row.starts_on, season_row.starts_on) or rearranged_date > coalesce(division_row.ends_on, season_row.ends_on) then
    raise exception 'The rearranged date is outside the division season' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.league_playing_dates playing_date
    where playing_date.league_id = target_league_id
      and playing_date.season_id = source_entry.season_id
      and playing_date.playing_date = rearranged_date
      and playing_date.status = 'available'
      and (playing_date.division_id is null or playing_date.division_id = source_entry.division_id)
  ) then raise exception 'The rearranged date is not an available league playing date' using errcode = '23514'; end if;

  select team.parent_club_id into home_club_id from public.league_teams team where team.id = source_entry.home_team_id;
  select team.parent_club_id into away_club_id from public.league_teams team where team.id = source_entry.away_team_id;
  if exists (
    select 1 from public.league_blackout_dates blackout
    where blackout.league_id = target_league_id
      and (blackout.season_id is null or blackout.season_id = source_entry.season_id)
      and rearranged_date between blackout.starts_on and blackout.ends_on
      and (
        blackout.scope_type = 'league'
        or (blackout.scope_type = 'division' and blackout.scope_id = source_entry.division_id)
        or (blackout.scope_type = 'team' and blackout.scope_id in (source_entry.home_team_id, source_entry.away_team_id))
        or (blackout.scope_type = 'club' and blackout.scope_id in (home_club_id, away_club_id))
        or (blackout.scope_type = 'venue' and blackout.scope_id = next_venue_id)
      )
  ) then raise exception 'A blackout prevents this rearranged date' using errcode = '23514'; end if;

  if exists (
    select 1 from public.league_schedule_entries other
    where other.version_id = source_entry.version_id
      and other.id <> source_entry.id
      and other.scheduled_date = rearranged_date
      and other.placement_status = 'placed'
      and (other.home_team_id in (source_entry.home_team_id, source_entry.away_team_id) or other.away_team_id in (source_entry.home_team_id, source_entry.away_team_id))
  ) or exists (
    select 1 from public.league_cup_ties tie
    where tie.league_id = target_league_id and tie.season_id = source_entry.season_id
      and tie.scheduled_date = rearranged_date and tie.status not in ('cancelled', 'void', 'bye', 'postponed')
      and (tie.home_team_id in (source_entry.home_team_id, source_entry.away_team_id) or tie.away_team_id in (source_entry.home_team_id, source_entry.away_team_id))
  ) then raise exception 'One of the teams already plays on the selected date' using errcode = '23505'; end if;

  select count(*) into selected_venue_usage
  from public.league_schedule_entries other
  where other.version_id = source_entry.version_id and other.id <> source_entry.id
    and other.scheduled_date = rearranged_date and other.kick_off = next_kick_off
    and other.venue_id = next_venue_id and other.placement_status = 'placed';
  select selected_venue_usage + count(*) into selected_venue_usage
  from public.league_cup_ties tie
  where tie.league_id = target_league_id and tie.season_id = source_entry.season_id
    and tie.scheduled_date = rearranged_date and tie.kick_off = next_kick_off
    and tie.venue_id = next_venue_id and tie.status not in ('cancelled', 'void', 'bye', 'postponed');
  if selected_venue_usage >= venue_row.simultaneous_fixture_limit then raise exception 'The selected venue is already at capacity' using errcode = '23505'; end if;

  selected_ground_key := coalesce(nullif(trim(venue_row.ground_share_key), ''), 'venue:' || venue_row.id::text);
  select coalesce(sum(greatest(venue.simultaneous_fixture_limit, 1)), 1) into selected_ground_capacity
  from public.league_venues venue
  where venue.league_id = target_league_id and venue.status = 'active'
    and coalesce(nullif(trim(venue.ground_share_key), ''), 'venue:' || venue.id::text) = selected_ground_key;
  select count(*) into selected_ground_usage
  from public.league_schedule_entries other
  join public.league_venues other_venue on other_venue.id = other.venue_id
  where other.version_id = source_entry.version_id and other.id <> source_entry.id
    and other.scheduled_date = rearranged_date and other.kick_off = next_kick_off and other.placement_status = 'placed'
    and coalesce(nullif(trim(other_venue.ground_share_key), ''), 'venue:' || other_venue.id::text) = selected_ground_key;
  select selected_ground_usage + count(*) into selected_ground_usage
  from public.league_cup_ties tie
  join public.league_venues other_venue on other_venue.id = tie.venue_id
  where tie.league_id = target_league_id and tie.season_id = source_entry.season_id
    and tie.scheduled_date = rearranged_date and tie.kick_off = next_kick_off
    and tie.status not in ('cancelled', 'void', 'bye', 'postponed')
    and coalesce(nullif(trim(other_venue.ground_share_key), ''), 'venue:' || other_venue.id::text) = selected_ground_key;
  if selected_ground_usage >= selected_ground_capacity then raise exception 'The selected shared ground is already at capacity' using errcode = '23505'; end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || source_entry.season_id::text));
  select coalesce(max(version_number), 0) + 1 into next_version_number
  from public.league_schedule_versions
  where league_id = target_league_id and season_id = source_entry.season_id;

  insert into public.league_schedule_versions(
    league_id, season_id, parent_version_id, version_number, name, status, source,
    generation_config, validation_summary, created_by
  ) values (
    target_league_id, source_entry.season_id, source_version.id, next_version_number,
    source_version.name || ' · rearranged ' || to_char(rearranged_date, 'DD Mon YYYY'),
    'draft', 'manual', source_version.generation_config,
    jsonb_build_object('rearrangement_pending_validation', true), auth.uid()
  ) returning id into next_version_id;

  insert into public.league_schedule_entries(
    version_id, league_id, season_id, division_id, source_fixture_id,
    competition_type, competition_id, cup_tie_id,
    home_team_id, away_team_id, venue_id, scheduled_date, kick_off,
    round_number, meeting_number, placement_status, locked, unresolved_reason, notes
  )
  select next_version_id, entry.league_id, entry.season_id, entry.division_id, entry.source_fixture_id,
    entry.competition_type, entry.competition_id, entry.cup_tie_id,
    entry.home_team_id, entry.away_team_id, entry.venue_id, entry.scheduled_date, entry.kick_off,
    entry.round_number, entry.meeting_number, entry.placement_status, entry.locked, entry.unresolved_reason, entry.notes
  from public.league_schedule_entries entry
  where entry.version_id = source_entry.version_id;

  update public.league_schedule_entries cloned
  set scheduled_date = rearranged_date,
      kick_off = next_kick_off,
      venue_id = next_venue_id,
      placement_status = 'placed',
      unresolved_reason = null,
      notes = concat_ws(E'\n', nullif(cloned.notes, ''), 'Rearranged from ' || coalesce(postponement.original_date::text, source_entry.scheduled_date::text) || ' via postponement ' || postponement.id::text),
      updated_at = now()
  where cloned.version_id = next_version_id
    and cloned.division_id = source_entry.division_id
    and cloned.home_team_id = source_entry.home_team_id
    and cloned.away_team_id = source_entry.away_team_id
    and cloned.meeting_number = source_entry.meeting_number
  returning cloned.id into next_entry_id;
  if next_entry_id is null then raise exception 'The rearranged fixture could not be located in the new schedule version' using errcode = 'P0002'; end if;

  -- Move appointments to equivalent entries in the new operational version.
  update public.league_official_assignments assignment
  set target_id = cloned.id,
      target_date = cloned.scheduled_date,
      kick_off = cloned.kick_off,
      venue_id = cloned.venue_id,
      updated_at = now()
  from public.league_schedule_entries old_entry
  join public.league_schedule_entries cloned
    on cloned.version_id = next_version_id
   and cloned.division_id = old_entry.division_id
   and cloned.home_team_id = old_entry.home_team_id
   and cloned.away_team_id = old_entry.away_team_id
   and cloned.meeting_number = old_entry.meeting_number
  where assignment.league_id = target_league_id
    and assignment.target_type = 'schedule_entry'
    and assignment.target_id = old_entry.id
    and old_entry.version_id = source_entry.version_id
    and old_entry.id <> source_entry.id;

  for assignment_row in
    select assignment.id
    from public.league_official_assignments assignment
    where assignment.league_id = target_league_id
      and assignment.target_type = 'schedule_entry'
      and assignment.target_id = source_entry.id
    for update
  loop
    raw_token := encode(gen_random_bytes(24), 'hex');
    update public.league_official_assignments
    set target_id = next_entry_id,
        target_date = rearranged_date,
        kick_off = next_kick_off,
        venue_id = next_venue_id,
        status = 'proposed',
        response_token_hash = encode(digest(raw_token, 'sha256'), 'hex'),
        response_expires_at = now() + interval '30 days',
        responded_at = null,
        updated_at = now()
    where id = assignment_row.id;
    insert into private.league_official_response_tokens(assignment_id, raw_token)
    values (assignment_row.id, raw_token)
    on conflict (assignment_id) do update set raw_token = excluded.raw_token, created_at = now();
  end loop;

  update public.league_postponement_requests
  set selected_date = rearranged_date,
      selected_kick_off = next_kick_off,
      selected_venue_id = next_venue_id,
      resolution_version_id = next_version_id,
      resolved_at = now(),
      status = 'rearranged',
      updated_at = now()
  where id = postponement.id;

  perform private.write_league_audit(target_league_id, 'league.postponement_rearranged', 'postponement', postponement.id, jsonb_build_object(
    'source_version_id', source_version.id,
    'resolution_version_id', next_version_id,
    'entry_id', next_entry_id,
    'scheduled_date', rearranged_date,
    'kick_off', next_kick_off,
    'venue_id', next_venue_id
  ));

  return jsonb_build_object('version_id', next_version_id, 'version_number', next_version_number, 'entry_id', next_entry_id, 'scheduled_date', rearranged_date, 'kick_off', next_kick_off, 'venue_id', next_venue_id);
end;
$$;

revoke all on function public.bulk_update_league_venue_map_positions(uuid, jsonb) from public, anon;
revoke all on function public.save_league_postponement_suggestions(uuid, uuid, jsonb) from public, anon;
revoke all on function public.apply_league_postponement_rearrangement(uuid, uuid, date, time, uuid) from public, anon;

grant execute on function public.bulk_update_league_venue_map_positions(uuid, jsonb) to authenticated;
grant execute on function public.save_league_postponement_suggestions(uuid, uuid, jsonb) to authenticated;
grant execute on function public.apply_league_postponement_rearrangement(uuid, uuid, date, time, uuid) to authenticated;

commit;
