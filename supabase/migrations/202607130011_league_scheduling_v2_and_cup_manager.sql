-- Daxora League Manager: Scheduling v2 and unlimited Cup Manager.
-- Adds authoritative league/division rules, all-division generation support,
-- arbitrary knockout competitions, cup-aware validation and safe rearrangement inputs.

begin;

alter table public.league_seasons
  add column if not exists default_kick_off time,
  add column if not exists primary_weekday integer not null default 6,
  add column if not exists max_consecutive_home_away integer not null default 2;

alter table public.league_seasons
  drop constraint if exists league_seasons_primary_weekday_check,
  drop constraint if exists league_seasons_max_consecutive_home_away_check;
alter table public.league_seasons
  add constraint league_seasons_primary_weekday_check check (primary_weekday between 0 and 6),
  add constraint league_seasons_max_consecutive_home_away_check check (max_consecutive_home_away between 1 and 6);

-- Preserve the league operator's existing configured kick-off and weekday.
-- Seasons without a prior choice remain unset and are blocked from scheduling until configured.
update public.league_seasons season_value
set default_kick_off = (
  select playing_date.default_kick_off
  from public.league_playing_dates playing_date
  where playing_date.season_id = season_value.id
    and playing_date.default_kick_off is not null
  group by playing_date.default_kick_off
  order by count(*) desc, playing_date.default_kick_off
  limit 1
)
where season_value.default_kick_off is null;

update public.league_seasons season_value
set primary_weekday = coalesce((
  select extract(dow from playing_date.playing_date)::integer
  from public.league_playing_dates playing_date
  where playing_date.season_id = season_value.id
  group by extract(dow from playing_date.playing_date)::integer
  order by count(*) desc, extract(dow from playing_date.playing_date)::integer
  limit 1
), season_value.primary_weekday);

-- Future seasons must deliberately store the league's chosen kick-off.

alter table public.league_divisions
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists meetings_per_pairing integer not null default 2,
  add column if not exists default_kick_off time,
  add column if not exists playing_weekday integer,
  add column if not exists max_consecutive_home_away integer not null default 2;

alter table public.league_divisions
  drop constraint if exists league_divisions_dates_check,
  drop constraint if exists league_divisions_meetings_per_pairing_check,
  drop constraint if exists league_divisions_playing_weekday_check,
  drop constraint if exists league_divisions_max_consecutive_home_away_check;
alter table public.league_divisions
  add constraint league_divisions_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  add constraint league_divisions_meetings_per_pairing_check check (meetings_per_pairing between 1 and 4),
  add constraint league_divisions_playing_weekday_check check (playing_weekday is null or playing_weekday between 0 and 6),
  add constraint league_divisions_max_consecutive_home_away_check check (max_consecutive_home_away between 1 and 6);

update public.league_divisions division_value
set starts_on = coalesce(division_value.starts_on, season_value.starts_on),
    ends_on = coalesce(division_value.ends_on, season_value.ends_on),
    max_consecutive_home_away = coalesce(division_value.max_consecutive_home_away, season_value.max_consecutive_home_away, 2)
from public.league_seasons season_value
where season_value.id = division_value.season_id;

alter table public.league_fixtures
  add column if not exists meeting_number integer not null default 1,
  add column if not exists competition_type text not null default 'league',
  add column if not exists competition_id uuid,
  add column if not exists cup_tie_id uuid;

alter table public.league_fixtures
  drop constraint if exists league_fixtures_meeting_number_check,
  drop constraint if exists league_fixtures_competition_type_check;
alter table public.league_fixtures
  add constraint league_fixtures_meeting_number_check check (meeting_number between 1 and 4),
  add constraint league_fixtures_competition_type_check check (competition_type in ('league', 'cup'));

alter table public.league_schedule_entries
  add column if not exists meeting_number integer not null default 1,
  add column if not exists competition_type text not null default 'league',
  add column if not exists competition_id uuid,
  add column if not exists cup_tie_id uuid;

alter table public.league_schedule_entries
  drop constraint if exists league_schedule_entries_version_id_home_team_id_away_team_id_key,
  drop constraint if exists league_schedule_entries_meeting_number_check,
  drop constraint if exists league_schedule_entries_competition_type_check;
alter table public.league_schedule_entries
  add constraint league_schedule_entries_meeting_number_check check (meeting_number between 1 and 4),
  add constraint league_schedule_entries_competition_type_check check (competition_type in ('league', 'cup'));

create unique index if not exists league_schedule_entries_unique_league_meeting_idx
  on public.league_schedule_entries (
    version_id,
    division_id,
    least(home_team_id::text, away_team_id::text),
    greatest(home_team_id::text, away_team_id::text),
    meeting_number
  )
  where competition_type = 'league';

create table if not exists public.league_cups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 160),
  code text,
  starts_on date not null,
  default_kick_off time,
  final_date date,
  final_venue_id uuid references public.league_venues(id) on delete set null,
  draw_mode text not null default 'random' check (draw_mode in ('random', 'seeded')),
  round_interval_days integer not null default 14 check (round_interval_days between 1 and 90),
  same_club_avoid_until_round integer not null default 1 check (same_club_avoid_until_round between 0 and 10),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (final_date is null or final_date >= starts_on),
  unique (season_id, name)
);

create table if not exists public.league_cup_divisions (
  cup_id uuid not null references public.league_cups(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  division_id uuid not null references public.league_divisions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cup_id, division_id)
);

create table if not exists public.league_cup_team_overrides (
  cup_id uuid not null references public.league_cups(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_id uuid not null references public.league_teams(id) on delete cascade,
  included boolean not null,
  created_at timestamptz not null default now(),
  primary key (cup_id, team_id)
);

create table if not exists public.league_cup_rounds (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.league_cups(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  round_number integer not null check (round_number > 0),
  name text not null,
  scheduled_date date,
  status text not null default 'draft' check (status in ('draft', 'drawn', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cup_id, round_number)
);

create table if not exists public.league_cup_ties (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.league_cups(id) on delete cascade,
  cup_round_id uuid not null references public.league_cup_rounds(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  round_number integer not null check (round_number > 0),
  tie_number integer not null check (tie_number > 0),
  home_team_id uuid not null references public.league_teams(id) on delete restrict,
  away_team_id uuid references public.league_teams(id) on delete restrict,
  venue_id uuid references public.league_venues(id) on delete restrict,
  scheduled_date date,
  kick_off time,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'postponed', 'played', 'bye', 'cancelled', 'void')),
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  winner_team_id uuid references public.league_teams(id) on delete restrict,
  locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (away_team_id is null or home_team_id <> away_team_id),
  check (winner_team_id is null or winner_team_id = home_team_id or winner_team_id = away_team_id),
  unique (cup_round_id, tie_number)
);

alter table public.league_fixtures
  drop constraint if exists league_fixtures_cup_tie_id_fkey;
alter table public.league_fixtures
  add constraint league_fixtures_cup_tie_id_fkey foreign key (cup_tie_id) references public.league_cup_ties(id) on delete set null;

alter table public.league_schedule_entries
  drop constraint if exists league_schedule_entries_cup_tie_id_fkey;
alter table public.league_schedule_entries
  add constraint league_schedule_entries_cup_tie_id_fkey foreign key (cup_tie_id) references public.league_cup_ties(id) on delete set null;

create index if not exists league_cups_season_idx on public.league_cups(league_id, season_id, starts_on, name);
create index if not exists league_cup_rounds_lookup_idx on public.league_cup_rounds(cup_id, round_number);
create index if not exists league_cup_ties_schedule_idx on public.league_cup_ties(league_id, season_id, scheduled_date, kick_off);
create index if not exists league_cup_ties_team_idx on public.league_cup_ties(season_id, home_team_id, away_team_id);

alter table public.league_cups enable row level security;
alter table public.league_cups force row level security;
alter table public.league_cup_divisions enable row level security;
alter table public.league_cup_divisions force row level security;
alter table public.league_cup_team_overrides enable row level security;
alter table public.league_cup_team_overrides force row level security;
alter table public.league_cup_rounds enable row level security;
alter table public.league_cup_rounds force row level security;
alter table public.league_cup_ties enable row level security;
alter table public.league_cup_ties force row level security;

revoke all on table public.league_cups, public.league_cup_divisions, public.league_cup_team_overrides, public.league_cup_rounds, public.league_cup_ties from anon, authenticated;

create policy league_cups_read on public.league_cups for select to authenticated using (public.can_view_league(league_id));
create policy league_cups_write on public.league_cups for all to authenticated using (public.can_operate_league(league_id)) with check (public.can_operate_league(league_id));
create policy league_cup_divisions_read on public.league_cup_divisions for select to authenticated using (public.can_view_league(league_id));
create policy league_cup_divisions_write on public.league_cup_divisions for all to authenticated using (public.can_operate_league(league_id)) with check (public.can_operate_league(league_id));
create policy league_cup_team_overrides_read on public.league_cup_team_overrides for select to authenticated using (public.can_view_league(league_id));
create policy league_cup_team_overrides_write on public.league_cup_team_overrides for all to authenticated using (public.can_operate_league(league_id)) with check (public.can_operate_league(league_id));
create policy league_cup_rounds_read on public.league_cup_rounds for select to authenticated using (public.can_view_league(league_id));
create policy league_cup_rounds_write on public.league_cup_rounds for all to authenticated using (public.can_operate_league(league_id)) with check (public.can_operate_league(league_id));
create policy league_cup_ties_read on public.league_cup_ties for select to authenticated using (public.can_view_league(league_id));
create policy league_cup_ties_write on public.league_cup_ties for all to authenticated using (public.can_operate_league(league_id)) with check (public.can_operate_league(league_id));

-- Replace the pilot creator so the operator chooses the league default rather than inheriting a hidden system time.
drop function if exists public.platform_create_league_pilot(text, text, text, text, text, date, date);
create function public.platform_create_league_pilot(
  league_name text,
  league_country_code text default 'GB-ENG',
  league_governing_body text default null,
  league_timezone text default 'Europe/London',
  initial_season_name text default null,
  initial_season_start date default null,
  initial_season_end date default null,
  initial_default_kick_off time default null,
  initial_primary_weekday integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_name text := trim(coalesce(league_name, ''));
  org_id uuid;
  new_league_id uuid;
  new_season_id uuid;
  base_slug text;
  unique_slug text;
begin
  perform private.require_platform_staff('admin');
  if length(safe_name) < 2 then raise exception 'League name is required' using errcode = '22023'; end if;
  if length(trim(coalesce(initial_season_name, ''))) >= 2 and initial_default_kick_off is null then
    raise exception 'Choose the league default kick-off for the initial season' using errcode = '22023';
  end if;
  if initial_primary_weekday not between 0 and 6 then raise exception 'Primary weekday must be between 0 and 6' using errcode = '22023'; end if;

  base_slug := coalesce(nullif(private.league_slug(safe_name), ''), 'league');
  unique_slug := base_slug;
  if exists (select 1 from public.organisations where slug = unique_slug)
     or exists (select 1 from public.leagues where slug = unique_slug) then
    unique_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  insert into public.organisations (name, slug, organisation_type, status, created_by)
  values (safe_name, unique_slug, 'league_operator', 'active', actor_id)
  returning id into org_id;

  insert into public.leagues (organisation_id, name, slug, country_code, governing_body, timezone, product_status, status, created_by)
  values (org_id, safe_name, unique_slug, coalesce(nullif(trim(league_country_code), ''), 'GB-ENG'), nullif(trim(coalesce(league_governing_body, '')), ''), coalesce(nullif(trim(league_timezone), ''), 'Europe/London'), 'pilot', 'active', actor_id)
  returning id into new_league_id;

  insert into public.league_memberships (league_id, user_id, role, status, created_by)
  values (new_league_id, actor_id, 'owner', 'active', actor_id);

  if length(trim(coalesce(initial_season_name, ''))) >= 2 then
    insert into public.league_seasons (league_id, name, starts_on, ends_on, status, is_current, default_kick_off, primary_weekday)
    values (new_league_id, trim(initial_season_name), initial_season_start, initial_season_end, 'draft', true, initial_default_kick_off, initial_primary_weekday)
    returning id into new_season_id;
  end if;

  perform private.write_league_audit(new_league_id, 'league.pilot_created', 'league', new_league_id, jsonb_build_object('season_id', new_season_id, 'product_status', 'pilot', 'default_kick_off', initial_default_kick_off, 'primary_weekday', initial_primary_weekday));
  return jsonb_build_object('league_id', new_league_id, 'season_id', new_season_id, 'slug', unique_slug);
end;
$$;

create or replace function public.get_league_workspace(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
begin
  if actor_id is null or not public.can_view_league(target_league_id) then
    raise exception 'League workspace access denied' using errcode = '42501';
  end if;

  update public.league_invitations
  set status = 'expired', updated_at = now()
  where league_id = target_league_id and status = 'pending' and expires_at <= now();

  select jsonb_build_object(
    'league', to_jsonb(league),
    'access', jsonb_build_object(
      'role', private.current_league_role(target_league_id, actor_id),
      'can_manage', public.can_manage_league(target_league_id),
      'can_operate', public.can_operate_league(target_league_id),
      'read_only', not public.can_operate_league(target_league_id)
    ),
    'seasons', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.is_current desc, row_value.starts_on desc nulls last, row_value.name) from public.league_seasons row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'divisions', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.sort_order, row_value.name) from public.league_divisions row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'clubs', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_parent_clubs row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'venues', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_venues row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_teams row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'blackouts', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.starts_on, row_value.scope_type) from public.league_blackout_dates row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'playing_dates', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.playing_date, row_value.division_id nulls first) from public.league_playing_dates row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'fixtures', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.scheduled_date nulls last, row_value.kick_off nulls last, row_value.created_at) from public.league_fixtures row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'cups', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.starts_on, row_value.name) from public.league_cups row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'cup_divisions', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.cup_id, row_value.division_id) from public.league_cup_divisions row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'cup_team_overrides', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.cup_id, row_value.team_id) from public.league_cup_team_overrides row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'cup_rounds', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.cup_id, row_value.round_number) from public.league_cup_rounds row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'cup_ties', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.cup_id, row_value.round_number, row_value.tie_number) from public.league_cup_ties row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id,
        'role', membership.role,
        'status', membership.status,
        'display_name', profile.display_name,
        'email', profile.email,
        'created_at', membership.created_at
      ) order by case membership.role when 'owner' then 0 when 'admin' then 1 when 'fixtures' then 2 else 3 end, coalesce(profile.display_name, profile.email))
      from public.league_memberships membership
      left join public.user_profiles profile on profile.id = membership.user_id
      where membership.league_id = target_league_id and membership.status <> 'revoked'
    ), '[]'::jsonb),
    'invitations', case when public.can_manage_league(target_league_id) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'email', invitation.email,
        'role', invitation.role,
        'status', invitation.status,
        'expires_at', invitation.expires_at,
        'created_at', invitation.created_at
      ) order by invitation.created_at desc)
      from public.league_invitations invitation
      where invitation.league_id = target_league_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'audit', coalesce((
      select jsonb_agg(to_jsonb(audit_row) order by audit_row.created_at desc)
      from (
        select * from public.league_audit_events
        where league_id = target_league_id
        order by created_at desc
        limit 75
      ) audit_row
    ), '[]'::jsonb)
  ) into result
  from public.leagues league
  where league.id = target_league_id;

  if result is null then
    raise exception 'League workspace not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.upsert_league_schedule_settings_entity(
  target_league_id uuid,
  entity_type text,
  entity_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_type text := lower(trim(coalesce(entity_type, '')));
  entity_id uuid := coalesce(nullif(entity_data ->> 'id', '')::uuid, gen_random_uuid());
  season_id uuid;
begin
  if not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if entity_data is null or jsonb_typeof(entity_data) <> 'object' then
    raise exception 'League entity data is required' using errcode = '22023';
  end if;

  if safe_type = 'season' then
    if nullif(entity_data ->> 'default_kick_off', '') is null then
      raise exception 'The league default kick-off is required' using errcode = '22023';
    end if;
    insert into public.league_seasons (
      id, league_id, name, starts_on, ends_on, status, is_current,
      default_kick_off, primary_weekday, max_consecutive_home_away
    ) values (
      entity_id, target_league_id, trim(entity_data ->> 'name'),
      nullif(entity_data ->> 'starts_on', '')::date,
      nullif(entity_data ->> 'ends_on', '')::date,
      coalesce(nullif(entity_data ->> 'status', ''), 'draft'),
      coalesce((entity_data ->> 'is_current')::boolean, false),
      nullif(entity_data ->> 'default_kick_off', '')::time,
      greatest(0, least(coalesce((entity_data ->> 'primary_weekday')::integer, 6), 6)),
      greatest(1, least(coalesce((entity_data ->> 'max_consecutive_home_away')::integer, 2), 6))
    )
    on conflict (id) do update set
      name = excluded.name,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      status = excluded.status,
      is_current = excluded.is_current,
      default_kick_off = excluded.default_kick_off,
      primary_weekday = excluded.primary_weekday,
      max_consecutive_home_away = excluded.max_consecutive_home_away,
      updated_at = now()
    where public.league_seasons.league_id = target_league_id;
    if coalesce((entity_data ->> 'is_current')::boolean, false) then
      update public.league_seasons set is_current = false, updated_at = now()
      where league_id = target_league_id and id <> entity_id and is_current;
    end if;
  elsif safe_type = 'division' then
    season_id := nullif(entity_data ->> 'season_id', '')::uuid;
    perform private.assert_league_reference(target_league_id, 'season', season_id);
    insert into public.league_divisions (
      id, league_id, season_id, name, code, sort_order, team_limit,
      starts_on, ends_on, meetings_per_pairing, default_kick_off,
      playing_weekday, max_consecutive_home_away
    ) values (
      entity_id, target_league_id, season_id, trim(entity_data ->> 'name'),
      nullif(trim(coalesce(entity_data ->> 'code', '')), ''),
      coalesce((entity_data ->> 'sort_order')::integer, 0),
      nullif(entity_data ->> 'team_limit', '')::integer,
      nullif(entity_data ->> 'starts_on', '')::date,
      nullif(entity_data ->> 'ends_on', '')::date,
      greatest(1, least(coalesce((entity_data ->> 'meetings_per_pairing')::integer, 2), 4)),
      nullif(entity_data ->> 'default_kick_off', '')::time,
      nullif(entity_data ->> 'playing_weekday', '')::integer,
      greatest(1, least(coalesce((entity_data ->> 'max_consecutive_home_away')::integer, 2), 6))
    )
    on conflict (id) do update set
      season_id = excluded.season_id,
      name = excluded.name,
      code = excluded.code,
      sort_order = excluded.sort_order,
      team_limit = excluded.team_limit,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      meetings_per_pairing = excluded.meetings_per_pairing,
      default_kick_off = excluded.default_kick_off,
      playing_weekday = excluded.playing_weekday,
      max_consecutive_home_away = excluded.max_consecutive_home_away,
      updated_at = now()
    where public.league_divisions.league_id = target_league_id;
  else
    raise exception 'Only season and division schedule settings are supported' using errcode = '22023';
  end if;

  perform private.write_league_audit(target_league_id, 'league.' || safe_type || '_schedule_settings_saved', safe_type, entity_id, entity_data);
  return entity_id;
end;
$$;

create or replace function public.synchronise_league_season_calendar(
  target_league_id uuid,
  target_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  season_row public.league_seasons%rowtype;
  division_row public.league_divisions%rowtype;
  inserted_count integer := 0;
  deleted_count integer := 0;
  current_inserted integer := 0;
  start_date date;
  end_date date;
  weekday_number integer;
  kick_off_time time;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League scheduling permission required' using errcode = '42501';
  end if;
  select * into season_row from public.league_seasons
  where id = target_season_id and league_id = target_league_id;
  if season_row.id is null then raise exception 'Season not found' using errcode = 'P0002'; end if;
  if season_row.starts_on is null or season_row.ends_on is null then
    raise exception 'Set the season start and end dates first' using errcode = '22023';
  end if;
  if season_row.default_kick_off is null then
    raise exception 'Set the league default kick-off first' using errcode = '22023';
  end if;

  delete from public.league_playing_dates
  where league_id = target_league_id
    and season_id = target_season_id
    and notes = 'Generated from league settings';
  get diagnostics deleted_count = row_count;

  for division_row in
    select * from public.league_divisions
    where league_id = target_league_id and season_id = target_season_id
    order by sort_order, name
  loop
    start_date := coalesce(division_row.starts_on, season_row.starts_on);
    end_date := coalesce(division_row.ends_on, season_row.ends_on);
    weekday_number := coalesce(division_row.playing_weekday, season_row.primary_weekday, 6);
    kick_off_time := coalesce(division_row.default_kick_off, season_row.default_kick_off);
    if end_date < start_date then
      raise exception '% has an end date before its start date', division_row.name using errcode = '22023';
    end if;

    insert into public.league_playing_dates (
      league_id, season_id, division_id, playing_date, default_kick_off, status, notes
    )
    select target_league_id, target_season_id, division_row.id, generated_day::date,
           kick_off_time, 'available', 'Generated from league settings'
    from generate_series(start_date, end_date, interval '1 day') generated_day
    where extract(dow from generated_day)::integer = weekday_number
    on conflict do nothing;
    get diagnostics current_inserted = row_count;
    inserted_count := inserted_count + current_inserted;
  end loop;

  perform private.write_league_audit(
    target_league_id,
    'league.calendar_synchronised',
    'season',
    target_season_id,
    jsonb_build_object('inserted', inserted_count, 'replaced_generated_rows', deleted_count, 'default_kick_off', season_row.default_kick_off, 'primary_weekday', season_row.primary_weekday)
  );
  return jsonb_build_object('inserted', inserted_count, 'replaced', deleted_count);
end;
$$;

create or replace function public.upsert_league_cup(target_league_id uuid, cup_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  cup_id uuid := coalesce(nullif(cup_data ->> 'id', '')::uuid, gen_random_uuid());
  season_id uuid := nullif(cup_data ->> 'season_id', '')::uuid;
  final_venue_id uuid := nullif(cup_data ->> 'final_venue_id', '')::uuid;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;
  perform private.assert_league_reference(target_league_id, 'season', season_id);
  perform private.assert_league_reference(target_league_id, 'venue', final_venue_id);
  insert into public.league_cups (
    id, league_id, season_id, name, code, starts_on, default_kick_off,
    final_date, final_venue_id, draw_mode, round_interval_days,
    same_club_avoid_until_round, status, created_by
  ) values (
    cup_id, target_league_id, season_id, trim(cup_data ->> 'name'),
    nullif(trim(coalesce(cup_data ->> 'code', '')), ''),
    (cup_data ->> 'starts_on')::date,
    nullif(cup_data ->> 'default_kick_off', '')::time,
    nullif(cup_data ->> 'final_date', '')::date,
    final_venue_id,
    coalesce(nullif(cup_data ->> 'draw_mode', ''), 'random'),
    greatest(1, least(coalesce((cup_data ->> 'round_interval_days')::integer, 14), 90)),
    greatest(0, least(coalesce((cup_data ->> 'same_club_avoid_until_round')::integer, 1), 10)),
    coalesce(nullif(cup_data ->> 'status', ''), 'draft'),
    auth.uid()
  )
  on conflict (id) do update set
    season_id = excluded.season_id,
    name = excluded.name,
    code = excluded.code,
    starts_on = excluded.starts_on,
    default_kick_off = excluded.default_kick_off,
    final_date = excluded.final_date,
    final_venue_id = excluded.final_venue_id,
    draw_mode = excluded.draw_mode,
    round_interval_days = excluded.round_interval_days,
    same_club_avoid_until_round = excluded.same_club_avoid_until_round,
    status = excluded.status,
    updated_at = now()
  where public.league_cups.league_id = target_league_id;
  perform private.write_league_audit(target_league_id, 'league.cup_saved', 'cup', cup_id, cup_data);
  return cup_id;
end;
$$;

create or replace function public.set_league_cup_eligibility(
  target_league_id uuid,
  target_cup_id uuid,
  division_ids uuid[] default '{}',
  included_team_ids uuid[] default '{}',
  excluded_team_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  cup_row public.league_cups%rowtype;
  reference_id uuid;
begin
  if not public.can_operate_league(target_league_id) then
    raise exception 'League fixture access required' using errcode = '42501';
  end if;
  select * into cup_row from public.league_cups where id = target_cup_id and league_id = target_league_id;
  if cup_row.id is null then raise exception 'Cup not found' using errcode = 'P0002'; end if;

  foreach reference_id in array coalesce(division_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.league_divisions where id = reference_id and league_id = target_league_id and season_id = cup_row.season_id) then
      raise exception 'A selected division does not belong to this cup season' using errcode = '23503';
    end if;
  end loop;
  foreach reference_id in array coalesce(included_team_ids, '{}'::uuid[]) || coalesce(excluded_team_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.league_teams where id = reference_id and league_id = target_league_id and season_id = cup_row.season_id) then
      raise exception 'A selected team does not belong to this cup season' using errcode = '23503';
    end if;
  end loop;

  delete from public.league_cup_divisions where cup_id = target_cup_id;
  insert into public.league_cup_divisions(cup_id, league_id, division_id)
  select target_cup_id, target_league_id, value from unnest(coalesce(division_ids, '{}'::uuid[])) value;

  delete from public.league_cup_team_overrides where cup_id = target_cup_id;
  insert into public.league_cup_team_overrides(cup_id, league_id, team_id, included)
  select target_cup_id, target_league_id, value, true from unnest(coalesce(included_team_ids, '{}'::uuid[])) value
  union all
  select target_cup_id, target_league_id, value, false from unnest(coalesce(excluded_team_ids, '{}'::uuid[])) value;

  perform private.write_league_audit(target_league_id, 'league.cup_eligibility_saved', 'cup', target_cup_id, jsonb_build_object('divisions', coalesce(array_length(division_ids, 1), 0), 'included_teams', coalesce(array_length(included_team_ids, 1), 0), 'excluded_teams', coalesce(array_length(excluded_team_ids, 1), 0)));
  return jsonb_build_object('cup_id', target_cup_id);
end;
$$;

create or replace function public.save_league_cup_round_draw(
  target_league_id uuid,
  target_cup_id uuid,
  round_data jsonb,
  tie_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  cup_row public.league_cups%rowtype;
  round_id uuid;
  v_round_number integer := greatest(coalesce((round_data ->> 'round_number')::integer, 1), 1);
  tie_data jsonb;
  home_team_id uuid;
  away_team_id uuid;
  venue_id uuid;
  winner_team_id uuid;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  select * into cup_row from public.league_cups where id = target_cup_id and league_id = target_league_id;
  if cup_row.id is null then raise exception 'Cup not found' using errcode = 'P0002'; end if;
  if tie_rows is null or jsonb_typeof(tie_rows) <> 'array' or jsonb_array_length(tie_rows) < 1 then
    raise exception 'A cup round requires at least one tie' using errcode = '22023';
  end if;

  select cup_round.id into round_id
  from public.league_cup_rounds cup_round
  where cup_round.cup_id = target_cup_id and cup_round.round_number = v_round_number;
  if round_id is not null then
    if exists (select 1 from public.league_cup_ties where cup_round_id = round_id and status = 'played') then
      raise exception 'A completed or in-progress round cannot be replaced' using errcode = '42501';
    end if;
    delete from public.league_cup_ties where cup_round_id = round_id;
    update public.league_cup_rounds set
      name = trim(coalesce(round_data ->> 'name', 'Round ' || v_round_number::text)),
      scheduled_date = nullif(round_data ->> 'scheduled_date', '')::date,
      status = coalesce(nullif(round_data ->> 'status', ''), 'drawn'),
      updated_at = now()
    where id = round_id;
  else
    insert into public.league_cup_rounds(cup_id, league_id, season_id, round_number, name, scheduled_date, status)
    values (target_cup_id, target_league_id, cup_row.season_id, v_round_number, trim(coalesce(round_data ->> 'name', 'Round ' || v_round_number::text)), nullif(round_data ->> 'scheduled_date', '')::date, coalesce(nullif(round_data ->> 'status', ''), 'drawn'))
    returning id into round_id;
  end if;

  for tie_data in select value from jsonb_array_elements(tie_rows) loop
    home_team_id := nullif(tie_data ->> 'home_team_id', '')::uuid;
    away_team_id := nullif(tie_data ->> 'away_team_id', '')::uuid;
    venue_id := nullif(tie_data ->> 'venue_id', '')::uuid;
    winner_team_id := nullif(tie_data ->> 'winner_team_id', '')::uuid;
    perform private.assert_league_reference(target_league_id, 'team', home_team_id);
    perform private.assert_league_reference(target_league_id, 'team', away_team_id);
    perform private.assert_league_reference(target_league_id, 'venue', venue_id);
    perform private.assert_league_reference(target_league_id, 'team', winner_team_id);
    insert into public.league_cup_ties(
      cup_id, cup_round_id, league_id, season_id, round_number, tie_number,
      home_team_id, away_team_id, venue_id, scheduled_date, kick_off, status,
      winner_team_id, locked, notes
    ) values (
      target_cup_id, round_id, target_league_id, cup_row.season_id, v_round_number,
      greatest(coalesce((tie_data ->> 'tie_number')::integer, 1), 1),
      home_team_id, away_team_id, venue_id,
      nullif(tie_data ->> 'scheduled_date', '')::date,
      coalesce(nullif(tie_data ->> 'kick_off', '')::time, cup_row.default_kick_off, (select default_kick_off from public.league_seasons where id = cup_row.season_id)),
      coalesce(nullif(tie_data ->> 'status', ''), case when away_team_id is null then 'bye' else 'scheduled' end),
      winner_team_id,
      coalesce((tie_data ->> 'locked')::boolean, false),
      nullif(trim(coalesce(tie_data ->> 'notes', '')), '')
    );
  end loop;

  update public.league_cups set status = 'active', updated_at = now() where id = target_cup_id and status = 'draft';
  perform private.write_league_audit(target_league_id, 'league.cup_round_draw_saved', 'cup_round', round_id, jsonb_build_object('cup_id', target_cup_id, 'round_number', v_round_number, 'ties', jsonb_array_length(tie_rows)));
  return round_id;
end;
$$;

create or replace function public.update_league_cup_tie(
  target_league_id uuid,
  target_tie_id uuid,
  tie_data jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  tie_row public.league_cup_ties%rowtype;
  winner_id uuid := nullif(tie_data ->> 'winner_team_id', '')::uuid;
  next_venue_id uuid := case when tie_data ? 'venue_id' then nullif(tie_data ->> 'venue_id', '')::uuid else null end;
  next_status text := coalesce(nullif(tie_data ->> 'status', ''), '');
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  select * into tie_row from public.league_cup_ties where id = target_tie_id and league_id = target_league_id;
  if tie_row.id is null then raise exception 'Cup tie not found' using errcode = 'P0002'; end if;
  if winner_id is not null and winner_id not in (tie_row.home_team_id, tie_row.away_team_id) then
    raise exception 'The winner must be one of the teams in the tie' using errcode = '23514';
  end if;
  if next_venue_id is not null then
    perform private.assert_league_reference(target_league_id, 'venue', next_venue_id);
  end if;
  if next_status <> '' and next_status not in ('draft', 'scheduled', 'postponed', 'cancelled', 'played', 'bye', 'void') then
    raise exception 'Unsupported cup tie status' using errcode = '22023';
  end if;

  update public.league_cup_ties set
    scheduled_date = case when tie_data ? 'scheduled_date' then nullif(tie_data ->> 'scheduled_date', '')::date else scheduled_date end,
    kick_off = case when tie_data ? 'kick_off' then nullif(tie_data ->> 'kick_off', '')::time else kick_off end,
    venue_id = case when tie_data ? 'venue_id' then next_venue_id else venue_id end,
    status = coalesce(nullif(tie_data ->> 'status', ''), status),
    home_score = case when tie_data ? 'home_score' then nullif(tie_data ->> 'home_score', '')::integer else home_score end,
    away_score = case when tie_data ? 'away_score' then nullif(tie_data ->> 'away_score', '')::integer else away_score end,
    winner_team_id = case when tie_data ? 'winner_team_id' then winner_id else winner_team_id end,
    locked = case when tie_data ? 'locked' then coalesce((tie_data ->> 'locked')::boolean, false) else locked end,
    notes = case when tie_data ? 'notes' then nullif(trim(coalesce(tie_data ->> 'notes', '')), '') else notes end,
    updated_at = now()
  where id = target_tie_id;

  if coalesce(nullif(tie_data ->> 'status', ''), tie_row.status) = 'scheduled' and (
    coalesce(case when tie_data ? 'scheduled_date' then nullif(tie_data ->> 'scheduled_date', '')::date else tie_row.scheduled_date end, null) is null
    or coalesce(case when tie_data ? 'kick_off' then nullif(tie_data ->> 'kick_off', '')::time else tie_row.kick_off end, null) is null
    or coalesce(case when tie_data ? 'venue_id' then next_venue_id else tie_row.venue_id end, null) is null
  ) then
    raise exception 'A scheduled cup tie requires a date, kick-off and venue' using errcode = '23514';
  end if;

  perform private.write_league_audit(target_league_id, 'league.cup_tie_updated', 'cup_tie', target_tie_id, tie_data);
end;
$$;

create or replace function public.delete_league_cup(target_league_id uuid, target_cup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  if exists (select 1 from public.league_cup_ties where cup_id = target_cup_id and status = 'played') then
    raise exception 'A cup with recorded results cannot be deleted; archive it instead' using errcode = '42501';
  end if;
  delete from public.league_cups where id = target_cup_id and league_id = target_league_id;
  if not found then raise exception 'Cup not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.cup_deleted', 'cup', target_cup_id, '{}'::jsonb);
end;
$$;

create or replace function public.save_league_schedule_draft(
  target_league_id uuid,
  target_season_id uuid,
  draft_name text,
  generation_config jsonb,
  schedule_entries jsonb,
  parent_version_id uuid default null,
  draft_source text default 'generated'
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_id uuid := auth.uid();
  v_parent_version_id uuid := parent_version_id;
  v_next_version_number integer;
  v_new_version_id uuid;
  v_entry_data jsonb;
  v_division_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_venue_id uuid;
  v_source_fixture_id uuid;
  v_scheduled_date date;
  v_kick_off time;
  v_meeting_number integer;
  v_safe_source text := lower(trim(coalesce(draft_source, 'generated')));
  v_entry_count integer;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  perform private.assert_league_reference(target_league_id, 'season', target_season_id);
  if length(trim(coalesce(draft_name, ''))) < 2 then raise exception 'Schedule version name is required' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(schedule_entries, '[]'::jsonb)) <> 'array' then raise exception 'Schedule entries must be an array' using errcode = '22023'; end if;
  v_entry_count := jsonb_array_length(coalesce(schedule_entries, '[]'::jsonb));
  if v_entry_count < 1 or v_entry_count > 10000 then raise exception 'A schedule draft must contain between 1 and 10000 fixtures' using errcode = '22023'; end if;
  if v_safe_source not in ('generated', 'restored', 'manual') then raise exception 'Unsupported schedule source' using errcode = '22023'; end if;
  if v_parent_version_id is not null and not exists (select 1 from public.league_schedule_versions where id = v_parent_version_id and league_id = target_league_id and season_id = target_season_id) then
    raise exception 'Parent schedule version does not belong to this league season' using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || target_season_id::text));
  select coalesce(max(version_number), 0) + 1 into v_next_version_number from public.league_schedule_versions where league_id = target_league_id and season_id = target_season_id;
  insert into public.league_schedule_versions(league_id, season_id, parent_version_id, version_number, name, status, source, generation_config, validation_summary, created_by)
  values(target_league_id, target_season_id, v_parent_version_id, v_next_version_number, trim(draft_name), 'draft', v_safe_source, coalesce(generation_config, '{}'::jsonb), '{}'::jsonb, v_actor_id)
  returning id into v_new_version_id;

  for v_entry_data in select value from jsonb_array_elements(schedule_entries) loop
    v_division_id := nullif(v_entry_data ->> 'division_id', '')::uuid;
    v_home_team_id := nullif(v_entry_data ->> 'home_team_id', '')::uuid;
    v_away_team_id := nullif(v_entry_data ->> 'away_team_id', '')::uuid;
    v_venue_id := nullif(v_entry_data ->> 'venue_id', '')::uuid;
    v_source_fixture_id := nullif(v_entry_data ->> 'source_fixture_id', '')::uuid;
    v_scheduled_date := nullif(v_entry_data ->> 'scheduled_date', '')::date;
    v_meeting_number := greatest(1, least(coalesce((v_entry_data ->> 'meeting_number')::integer, 1), 4));
    perform private.assert_league_reference(target_league_id, 'division', v_division_id);
    perform private.assert_league_reference(target_league_id, 'team', v_home_team_id);
    perform private.assert_league_reference(target_league_id, 'team', v_away_team_id);
    perform private.assert_league_reference(target_league_id, 'venue', v_venue_id);
    if v_home_team_id = v_away_team_id then raise exception 'A team cannot play itself' using errcode = '23514'; end if;
    select coalesce(nullif(v_entry_data ->> 'kick_off', '')::time, division_value.default_kick_off, season_value.default_kick_off)
    into v_kick_off
    from public.league_divisions division_value
    join public.league_seasons season_value on season_value.id = division_value.season_id
    where division_value.id = v_division_id and division_value.league_id = target_league_id and season_value.id = target_season_id;
    if v_scheduled_date is not null and v_kick_off is null then
      raise exception 'A placed fixture requires the league or division kick-off setting' using errcode = '23502';
    end if;
    if not exists (
      select 1 from public.league_teams home_team
      join public.league_teams away_team on away_team.id = v_away_team_id
      where home_team.id = v_home_team_id and home_team.season_id = target_season_id and away_team.season_id = target_season_id
        and home_team.division_id = v_division_id and away_team.division_id = v_division_id
    ) then raise exception 'Schedule teams and division must belong to the selected season' using errcode = '23503'; end if;

    insert into public.league_schedule_entries(
      version_id, league_id, season_id, division_id, source_fixture_id,
      competition_type, competition_id, cup_tie_id,
      home_team_id, away_team_id, venue_id, scheduled_date, kick_off,
      round_number, meeting_number, placement_status, locked, unresolved_reason, notes
    ) values (
      v_new_version_id, target_league_id, target_season_id, v_division_id, v_source_fixture_id,
      'league', null, null,
      v_home_team_id, v_away_team_id, v_venue_id, v_scheduled_date,
      case when v_scheduled_date is null then null else v_kick_off end,
      greatest(coalesce((v_entry_data ->> 'round_number')::integer, 0), 0),
      v_meeting_number,
      case when v_scheduled_date is null then 'unplaced' else 'placed' end,
      coalesce((v_entry_data ->> 'locked')::boolean, false),
      nullif(trim(coalesce(v_entry_data ->> 'unresolved_reason', '')), ''),
      nullif(trim(coalesce(v_entry_data ->> 'notes', '')), '')
    );
  end loop;
  perform private.write_league_audit(target_league_id, 'league.schedule_draft_created', 'schedule_version', v_new_version_id, jsonb_build_object('season_id', target_season_id, 'version_number', v_next_version_number, 'fixtures', v_entry_count, 'source', v_safe_source));
  return v_new_version_id;
end;
$$;

create or replace function public.update_league_schedule_entries(
  target_league_id uuid,
  target_version_id uuid,
  entry_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_version_status text;
  v_season_id uuid;
  v_update_data jsonb;
  v_entry_id uuid;
  v_scheduled_date date;
  v_kick_off time;
  v_venue_id uuid;
  v_locked boolean;
  v_notes text;
  v_updated integer := 0;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  if entry_updates is null or jsonb_typeof(entry_updates) <> 'array' then raise exception 'Schedule entry updates must be a JSON array' using errcode = '22023'; end if;
  if jsonb_array_length(entry_updates) > 2000 then raise exception 'No more than 2000 schedule entries can be updated in one batch' using errcode = '22023'; end if;
  select status, season_id into v_version_status, v_season_id from public.league_schedule_versions where id = target_version_id and league_id = target_league_id;
  if v_version_status is null then raise exception 'Schedule version not found' using errcode = 'P0002'; end if;
  if v_version_status <> 'draft' then raise exception 'Published or archived schedules cannot be edited' using errcode = '42501'; end if;

  for v_update_data in select value from jsonb_array_elements(entry_updates) loop
    v_entry_id := nullif(trim(coalesce(v_update_data ->> 'id', '')), '')::uuid;
    v_scheduled_date := nullif(trim(coalesce(v_update_data ->> 'scheduled_date', '')), '')::date;
    v_venue_id := nullif(trim(coalesce(v_update_data ->> 'venue_id', '')), '')::uuid;
    v_locked := coalesce((v_update_data ->> 'locked')::boolean, false);
    v_notes := nullif(trim(coalesce(v_update_data ->> 'notes', '')), '');
    if v_entry_id is null then raise exception 'Every schedule entry update requires an id' using errcode = '22023'; end if;
    if v_scheduled_date is not null and v_venue_id is null then raise exception 'A placed fixture requires a venue' using errcode = '23502'; end if;
    perform private.assert_league_reference(target_league_id, 'venue', v_venue_id);
    select coalesce(nullif(v_update_data ->> 'kick_off', '')::time, division_value.default_kick_off, season_value.default_kick_off)
    into v_kick_off
    from public.league_schedule_entries entry_value
    join public.league_divisions division_value on division_value.id = entry_value.division_id
    join public.league_seasons season_value on season_value.id = entry_value.season_id
    where entry_value.id = v_entry_id and entry_value.version_id = target_version_id and entry_value.league_id = target_league_id;
    if v_scheduled_date is not null and v_kick_off is null then
      raise exception 'A placed fixture requires the league or division kick-off setting' using errcode = '23502';
    end if;
    update public.league_schedule_entries set
      scheduled_date = v_scheduled_date,
      kick_off = case when v_scheduled_date is null then null else v_kick_off end,
      venue_id = v_venue_id,
      placement_status = case when v_scheduled_date is null then 'unplaced' else 'placed' end,
      locked = v_locked,
      unresolved_reason = case when v_scheduled_date is null then coalesce(unresolved_reason, 'Manually unplaced for review.') else null end,
      notes = v_notes,
      updated_at = now()
    where id = v_entry_id and version_id = target_version_id and league_id = target_league_id;
    if not found then raise exception 'Schedule entry not found' using errcode = 'P0002'; end if;
    v_updated := v_updated + 1;
  end loop;
  update public.league_schedule_versions set validation_summary = '{}'::jsonb, updated_at = now() where id = target_version_id and league_id = target_league_id;
  perform private.write_league_audit(target_league_id, 'league.schedule_entries_updated', 'schedule_version', target_version_id, jsonb_build_object('updated_entries', v_updated));
  return jsonb_build_object('updated', v_updated, 'version_id', target_version_id);
end;
$$;

create or replace function private.league_schedule_validation(target_league_id uuid, target_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  with version_row as (
    select * from public.league_schedule_versions where id = target_version_id and league_id = target_league_id
  ),
  entries as (
    select entry.*, home_team.parent_club_id as home_club_id, away_team.parent_club_id as away_club_id,
      coalesce(nullif(venue.ground_share_key, ''), 'venue:' || venue.id::text) as ground_key,
      greatest(coalesce(venue.simultaneous_fixture_limit, 1), 1) as venue_limit,
      coalesce(division.starts_on, season.starts_on) as division_starts_on,
      coalesce(division.ends_on, season.ends_on) as division_ends_on,
      division.meetings_per_pairing,
      division.max_consecutive_home_away,
      division.name as division_name
    from public.league_schedule_entries entry
    join version_row version on version.id = entry.version_id
    join public.league_teams home_team on home_team.id = entry.home_team_id
    join public.league_teams away_team on away_team.id = entry.away_team_id
    join public.league_divisions division on division.id = entry.division_id
    join public.league_seasons season on season.id = entry.season_id
    left join public.league_venues venue on venue.id = entry.venue_id
  ),
  cup_entries as (
    select tie.id, tie.scheduled_date, tie.kick_off, tie.home_team_id, tie.away_team_id, tie.venue_id,
      coalesce(nullif(venue.ground_share_key, ''), 'venue:' || venue.id::text) as ground_key,
      greatest(coalesce(venue.simultaneous_fixture_limit, 1), 1) as venue_limit
    from public.league_cup_ties tie
    join version_row version on version.season_id = tie.season_id
    left join public.league_venues venue on venue.id = tie.venue_id
    where tie.league_id = target_league_id and tie.scheduled_date is not null and tie.status not in ('cancelled', 'void', 'bye', 'postponed')
  ),
  team_date_usage as (
    select entry.id, entry.scheduled_date, unnest(array[entry.home_team_id, entry.away_team_id]) as team_id, 'league'::text as source from entries entry where entry.scheduled_date is not null
    union all
    select cup.id, cup.scheduled_date, unnest(array_remove(array[cup.home_team_id, cup.away_team_id], null)) as team_id, 'cup'::text from cup_entries cup
  ),
  ground_usage as (
    select entry.id, entry.scheduled_date, entry.kick_off, entry.venue_id, entry.ground_key, entry.venue_limit, 'league'::text as source from entries entry where entry.scheduled_date is not null and entry.venue_id is not null
    union all
    select cup.id, cup.scheduled_date, cup.kick_off, cup.venue_id, cup.ground_key, cup.venue_limit, 'cup'::text from cup_entries cup where cup.venue_id is not null
  ),
  team_sides as (
    select entry.id, entry.division_id, entry.scheduled_date, entry.home_team_id as team_id, 'home'::text as side, entry.max_consecutive_home_away from entries entry where entry.scheduled_date is not null
    union all
    select entry.id, entry.division_id, entry.scheduled_date, entry.away_team_id, 'away'::text, entry.max_consecutive_home_away from entries entry where entry.scheduled_date is not null
  ),
  ordered_sides as (
    select side_row.*,
      row_number() over (partition by side_row.division_id, side_row.team_id order by side_row.scheduled_date, side_row.id) -
      row_number() over (partition by side_row.division_id, side_row.team_id, side_row.side order by side_row.scheduled_date, side_row.id) as run_group
    from team_sides side_row
  ),
  side_runs as (
    select division_id, team_id, side, run_group, count(*)::integer as run_length, max(max_consecutive_home_away)::integer as max_allowed
    from ordered_sides group by division_id, team_id, side, run_group
  ),
  issue_rows as (
    select 'unplaced:' || entry.id::text issue_id, 'blocking' severity, 'unplaced-fixture' code, 'A required fixture is unplaced.' message, jsonb_build_array(entry.id) entry_ids from entries entry where entry.scheduled_date is null
    union all
    select 'missing-venue:' || entry.id::text, 'blocking', 'missing-venue', 'A placed fixture has no valid venue.', jsonb_build_array(entry.id) from entries entry where entry.scheduled_date is not null and entry.venue_id is null
    union all
    select 'missing-kick-off:' || entry.id::text, 'blocking', 'missing-kick-off', 'A placed fixture has no kick-off time.', jsonb_build_array(entry.id) from entries entry where entry.scheduled_date is not null and entry.kick_off is null
    union all
    select 'division-start:' || entry.id::text, 'blocking', 'before-division-start', entry.division_name || ' has a fixture before its division start date.', jsonb_build_array(entry.id) from entries entry where entry.scheduled_date < entry.division_starts_on
    union all
    select 'division-end:' || entry.id::text, 'blocking', 'after-division-end', entry.division_name || ' has a fixture after its division end date.', jsonb_build_array(entry.id) from entries entry where entry.scheduled_date > entry.division_ends_on
    union all
    select 'team-clash:' || usage.scheduled_date::text || ':' || usage.team_id::text, 'blocking', 'team-double-booking', 'A team has more than one league/cup fixture on ' || usage.scheduled_date::text || '.', jsonb_agg(usage.id order by usage.id)
    from team_date_usage usage group by usage.scheduled_date, usage.team_id having count(*) > 1
    union all
    select 'ground-clash:' || usage.scheduled_date::text || ':' || coalesce(usage.kick_off::text, '') || ':' || usage.ground_key, 'blocking', 'ground-capacity-conflict', 'A venue or ground-share group exceeds its simultaneous league/cup fixture limit.', jsonb_agg(usage.id order by usage.id)
    from ground_usage usage
    group by usage.scheduled_date, usage.kick_off, usage.ground_key
    having count(*) > (
      select coalesce(sum(greatest(coalesce(venue_value.simultaneous_fixture_limit, 1), 1)), 1)
      from public.league_venues venue_value
      where venue_value.league_id = target_league_id
        and coalesce(nullif(venue_value.ground_share_key, ''), 'venue:' || venue_value.id::text) = usage.ground_key
        and venue_value.status = 'active'
    )
    union all
    select 'playing-date:' || entry.id::text, 'blocking', 'unavailable-playing-date', 'A fixture uses a date that is not available for its division.', jsonb_build_array(entry.id)
    from entries entry where entry.scheduled_date is not null and not exists (
      select 1 from public.league_playing_dates playing_date
      where playing_date.league_id = target_league_id and playing_date.season_id = entry.season_id and playing_date.status = 'available'
        and playing_date.playing_date = entry.scheduled_date and (playing_date.division_id is null or playing_date.division_id = entry.division_id)
    )
    union all
    select 'blackout:' || entry.id::text || ':' || blackout.id::text, 'blocking', 'blackout-violation', 'A fixture conflicts with blackout: ' || blackout.reason, jsonb_build_array(entry.id)
    from entries entry join public.league_blackout_dates blackout on blackout.league_id = target_league_id
      and (blackout.season_id is null or blackout.season_id = entry.season_id)
      and entry.scheduled_date between blackout.starts_on and blackout.ends_on
      and (blackout.scope_type = 'league' or (blackout.scope_type = 'division' and blackout.scope_id = entry.division_id) or (blackout.scope_type = 'team' and blackout.scope_id in (entry.home_team_id, entry.away_team_id)) or (blackout.scope_type = 'club' and blackout.scope_id in (entry.home_club_id, entry.away_club_id)) or (blackout.scope_type = 'venue' and blackout.scope_id = entry.venue_id))
    union all
    select 'matrix:' || division.id::text, 'blocking', 'fixture-matrix-incomplete', division.name || ' does not contain the required number of fixtures.', '[]'::jsonb
    from public.league_divisions division join version_row version on version.season_id = division.season_id
    cross join lateral (select count(*)::integer team_count from public.league_teams team where team.division_id = division.id and team.season_id = version.season_id and team.status = 'active') team_totals
    cross join lateral (select count(*)::integer fixture_count from entries entry where entry.division_id = division.id) fixture_totals
    where division.league_id = target_league_id and team_totals.team_count * greatest(team_totals.team_count - 1, 0) * division.meetings_per_pairing / 2 <> fixture_totals.fixture_count
    union all
    select 'run:' || run.division_id::text || ':' || run.team_id::text || ':' || run.run_group::text, 'warning', 'long-home-away-run', 'A team has a run of ' || run.run_length::text || ' consecutive ' || run.side || ' league fixtures; the division target is ' || run.max_allowed::text || '.', '[]'::jsonb
    from side_runs run where run.run_length > run.max_allowed
  )
  select jsonb_build_object(
    'valid', count(*) filter (where severity = 'blocking') = 0,
    'blockingCount', count(*) filter (where severity = 'blocking'),
    'warningCount', count(*) filter (where severity = 'warning'),
    'issues', coalesce(jsonb_agg(jsonb_build_object('id', issue_id, 'severity', severity, 'code', code, 'message', message, 'entryIds', entry_ids) order by severity, code, issue_id), '[]'::jsonb)
  ) into result from issue_rows;
  return coalesce(result, jsonb_build_object('valid', true, 'blockingCount', 0, 'warningCount', 0, 'issues', '[]'::jsonb));
end;
$$;

create or replace function public.publish_league_schedule_version(target_league_id uuid, target_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  version_row public.league_schedule_versions%rowtype;
  validation jsonb;
  entry public.league_schedule_entries%rowtype;
  published_count integer := 0;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  select * into version_row from public.league_schedule_versions where id = target_version_id and league_id = target_league_id for update;
  if version_row.id is null then raise exception 'Schedule version not found' using errcode = 'P0002'; end if;
  if version_row.status <> 'draft' then raise exception 'Only a draft schedule can be published' using errcode = '42501'; end if;
  validation := private.league_schedule_validation(target_league_id, target_version_id);
  if not coalesce((validation ->> 'valid')::boolean, false) then raise exception 'Schedule has % blocking validation issue(s)', coalesce((validation ->> 'blockingCount')::integer, 0) using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':' || version_row.season_id::text));
  update public.league_schedule_versions set status = 'archived', updated_at = now() where league_id = target_league_id and season_id = version_row.season_id and status = 'published' and id <> target_version_id;
  delete from public.league_fixtures where league_id = target_league_id and season_id = version_row.season_id and source = 'generated' and competition_type = 'league';

  for entry in select * from public.league_schedule_entries where version_id = target_version_id and placement_status = 'placed' order by round_number, scheduled_date, kick_off loop
    insert into public.league_fixtures(
      league_id, season_id, division_id, home_team_id, away_team_id, venue_id,
      scheduled_date, kick_off, status, locked, source, external_ref, notes,
      schedule_version_id, meeting_number, competition_type
    ) values (
      target_league_id, version_row.season_id, entry.division_id, entry.home_team_id, entry.away_team_id, entry.venue_id,
      entry.scheduled_date, entry.kick_off, 'scheduled', entry.locked, 'generated', 'LM-' || entry.id::text, entry.notes,
      target_version_id, entry.meeting_number, 'league'
    );
    published_count := published_count + 1;
  end loop;
  update public.league_schedule_versions set status = 'published', validation_summary = validation, published_by = actor_id, published_at = now(), updated_at = now() where id = target_version_id;
  perform private.write_league_audit(target_league_id, 'league.schedule_published', 'schedule_version', target_version_id, jsonb_build_object('season_id', version_row.season_id, 'version_number', version_row.version_number, 'fixtures', published_count));
  return jsonb_build_object('version_id', target_version_id, 'fixtures', published_count, 'validation', validation);
end;
$$;

revoke all on function public.platform_create_league_pilot(text, text, text, text, text, date, date, time, integer) from public, anon;
revoke all on function public.upsert_league_schedule_settings_entity(uuid, text, jsonb) from public, anon;
revoke all on function public.synchronise_league_season_calendar(uuid, uuid) from public, anon;
revoke all on function public.upsert_league_cup(uuid, jsonb) from public, anon;
revoke all on function public.set_league_cup_eligibility(uuid, uuid, uuid[], uuid[], uuid[]) from public, anon;
revoke all on function public.save_league_cup_round_draw(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.update_league_cup_tie(uuid, uuid, jsonb) from public, anon;
revoke all on function public.delete_league_cup(uuid, uuid) from public, anon;
revoke all on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) from public, anon;
revoke all on function public.update_league_schedule_entries(uuid, uuid, jsonb) from public, anon;
revoke all on function public.publish_league_schedule_version(uuid, uuid) from public, anon;

grant execute on function public.platform_create_league_pilot(text, text, text, text, text, date, date, time, integer) to authenticated;
grant execute on function public.upsert_league_schedule_settings_entity(uuid, text, jsonb) to authenticated;
grant execute on function public.synchronise_league_season_calendar(uuid, uuid) to authenticated;
grant execute on function public.upsert_league_cup(uuid, jsonb) to authenticated;
grant execute on function public.set_league_cup_eligibility(uuid, uuid, uuid[], uuid[], uuid[]) to authenticated;
grant execute on function public.save_league_cup_round_draw(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.update_league_cup_tie(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_league_cup(uuid, uuid) to authenticated;
grant execute on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) to authenticated;
grant execute on function public.update_league_schedule_entries(uuid, uuid, jsonb) to authenticated;
grant execute on function public.publish_league_schedule_version(uuid, uuid) to authenticated;

commit;
