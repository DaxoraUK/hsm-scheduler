-- Canonical user intent for one matchday. Provider facts and optimiser output
-- are intentionally not stored here: they remain canonical input and derived
-- state respectively.

create table if not exists public.matchday_scheduling_states (
  club_id uuid not null references public.clubs(id) on delete cascade,
  day_scope text not null,
  matchday_date text not null,
  intents jsonb not null default '{}'::jsonb,
  manual_fixtures jsonb not null default '[]'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  published_revision integer,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (club_id, day_scope, matchday_date),
  check (length(day_scope) between 1 and 40),
  check (length(matchday_date) between 1 and 80),
  check (jsonb_typeof(intents) = 'object'),
  check (jsonb_typeof(manual_fixtures) = 'array')
);

alter table public.matchday_scheduling_states enable row level security;

drop policy if exists matchday_scheduling_states_member_read on public.matchday_scheduling_states;
create policy matchday_scheduling_states_member_read on public.matchday_scheduling_states
for select to authenticated
using (public.is_club_member(club_id));

revoke all on table public.matchday_scheduling_states from public, anon, authenticated;

create or replace function public.load_matchday_scheduling_state(
  target_club_id uuid,
  target_day_scope text,
  target_matchday_date text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  saved public.matchday_scheduling_states%rowtype;
  day_value text := left(lower(trim(coalesce(target_day_scope, ''))), 40);
  date_value text := left(trim(coalesce(target_matchday_date, '')), 80);
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then
    raise exception 'Club access required' using errcode = '42501';
  end if;
  if day_value = '' or date_value = '' then
    raise exception 'Matchday scope and date are required' using errcode = '22023';
  end if;

  select * into saved
  from public.matchday_scheduling_states state
  where state.club_id = target_club_id
    and state.day_scope = day_value
    and state.matchday_date = date_value;

  if not found then
    return jsonb_build_object(
      'day_scope', day_value,
      'matchday_date', date_value,
      'intents', '{}'::jsonb,
      'manual_fixtures', '[]'::jsonb,
      'revision', 0,
      'published_revision', null,
      'published_at', null,
      'published_snapshot', null
    );
  end if;

  return jsonb_build_object(
    'day_scope', saved.day_scope,
    'matchday_date', saved.matchday_date,
    'intents', saved.intents,
    'manual_fixtures', saved.manual_fixtures,
    'revision', saved.revision,
    'published_revision', saved.published_revision,
    'published_at', saved.published_at,
    'published_snapshot', saved.published_snapshot,
    'updated_at', saved.updated_at
  );
end;
$$;

create or replace function public.save_matchday_scheduling_state(
  target_club_id uuid,
  target_day_scope text,
  target_matchday_date text,
  expected_revision integer,
  intent_data jsonb,
  manual_fixture_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  day_value text := left(lower(trim(coalesce(target_day_scope, ''))), 40);
  date_value text := left(trim(coalesce(target_matchday_date, '')), 80);
  saved public.matchday_scheduling_states%rowtype;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Matchday operator access required' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if day_value = '' or date_value = '' then
    raise exception 'Matchday scope and date are required' using errcode = '22023';
  end if;
  if coalesce(expected_revision, -1) < 0 then
    raise exception 'An expected revision is required' using errcode = '22023';
  end if;
  if coalesce(intent_data, '{}'::jsonb) is null or jsonb_typeof(coalesce(intent_data, '{}'::jsonb)) <> 'object' then
    raise exception 'Scheduling intents must be a JSON object' using errcode = '22023';
  end if;
  if coalesce(manual_fixture_data, '[]'::jsonb) is null or jsonb_typeof(coalesce(manual_fixture_data, '[]'::jsonb)) <> 'array' then
    raise exception 'Manual fixtures must be a JSON array' using errcode = '22023';
  end if;

  -- The conditional conflict update makes the revision check atomic: two
  -- clients saving the same revision cannot both succeed.
  insert into public.matchday_scheduling_states (
    club_id, day_scope, matchday_date, intents, manual_fixtures, revision, updated_by
  ) values (
    target_club_id, day_value, date_value,
    coalesce(intent_data, '{}'::jsonb), coalesce(manual_fixture_data, '[]'::jsonb),
    expected_revision + 1, actor_id
  ) on conflict (club_id, day_scope, matchday_date) do update set
    intents = excluded.intents,
    manual_fixtures = excluded.manual_fixtures,
    revision = public.matchday_scheduling_states.revision + 1,
    updated_at = now(),
    updated_by = actor_id
  where public.matchday_scheduling_states.revision = expected_revision
  returning * into saved;

  if not found then
    raise exception 'Matchday scheduling state has changed; reload before saving' using errcode = '40900';
  end if;

  perform public.record_audit_event(
    target_club_id,
    'matchday.schedule.saved',
    'matchday_scheduling_state',
    saved.day_scope || ':' || saved.matchday_date,
    jsonb_build_object('revision', saved.revision, 'manual_fixture_count', jsonb_array_length(saved.manual_fixtures))
  );

  return public.load_matchday_scheduling_state(target_club_id, day_value, date_value);
end;
$$;

create or replace function public.publish_matchday_scheduling_state(
  target_club_id uuid,
  target_day_scope text,
  target_matchday_date text,
  expected_revision integer,
  schedule_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  day_value text := left(lower(trim(coalesce(target_day_scope, ''))), 40);
  date_value text := left(trim(coalesce(target_matchday_date, '')), 80);
  saved public.matchday_scheduling_states%rowtype;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then
    raise exception 'Matchweek publisher access required' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if day_value = '' or date_value = '' then
    raise exception 'Matchday scope and date are required' using errcode = '22023';
  end if;
  if coalesce(expected_revision, -1) < 0 then
    raise exception 'An expected revision is required' using errcode = '22023';
  end if;
  if coalesce(schedule_snapshot, '{}'::jsonb) is null or jsonb_typeof(coalesce(schedule_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception 'Schedule snapshot must be a JSON object' using errcode = '22023';
  end if;

  select * into saved
  from public.matchday_scheduling_states state
  where state.club_id = target_club_id
    and state.day_scope = day_value
    and state.matchday_date = date_value
  for update;

  if not found or saved.revision <> expected_revision then
    raise exception 'Save the current matchday schedule before publishing' using errcode = '40900';
  end if;

  update public.matchday_scheduling_states
  set published_revision = saved.revision,
      published_at = now(),
      published_by = actor_id,
      published_snapshot = coalesce(schedule_snapshot, '{}'::jsonb),
      updated_at = now(),
      updated_by = actor_id
  where club_id = target_club_id
    and day_scope = day_value
    and matchday_date = date_value
  returning * into saved;

  perform public.record_audit_event(
    target_club_id,
    'matchday.schedule.published',
    'matchday_scheduling_state',
    saved.day_scope || ':' || saved.matchday_date,
    jsonb_build_object('revision', saved.revision)
  );

  return public.load_matchday_scheduling_state(target_club_id, day_value, date_value);
end;
$$;

-- Legacy history remains auditable evidence. It no longer decides whether an
-- authorised scheduler may save the canonical matchday state.
create or replace function public.save_matchweek_history(
  target_club_id uuid,
  history_id text,
  history_data jsonb,
  history_saved_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_id text := nullif(trim(coalesce(history_id, '')), '');
  day_count integer := 0;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if safe_id is null then
    raise exception 'History entry requires an id' using errcode = '22023';
  end if;
  if history_data is null or jsonb_typeof(history_data) <> 'object' then
    raise exception 'History entry must be a JSON object' using errcode = '22023';
  end if;

  insert into public.history (club_id, id, data, saved_at)
  values (target_club_id, safe_id, history_data, coalesce(history_saved_at, now()))
  on conflict (club_id, id) do update set
    data = excluded.data,
    saved_at = excluded.saved_at,
    updated_at = now();

  if jsonb_typeof(history_data -> 'fixtureDays') = 'array' then
    day_count := jsonb_array_length(history_data -> 'fixtureDays');
  end if;

  perform public.record_audit_event(
    target_club_id,
    'matchweek.history.saved',
    'matchweek_history',
    safe_id,
    jsonb_build_object('date_label', nullif(history_data ->> 'dateLabel', ''), 'fixture_day_count', day_count)
  );
end;
$$;

revoke all on function public.load_matchday_scheduling_state(uuid, text, text) from public, anon;
revoke all on function public.save_matchday_scheduling_state(uuid, text, text, integer, jsonb, jsonb) from public, anon;
revoke all on function public.publish_matchday_scheduling_state(uuid, text, text, integer, jsonb) from public, anon;
grant execute on function public.load_matchday_scheduling_state(uuid, text, text) to authenticated;
grant execute on function public.save_matchday_scheduling_state(uuid, text, text, integer, jsonb, jsonb) to authenticated;
grant execute on function public.publish_matchday_scheduling_state(uuid, text, text, integer, jsonb) to authenticated;
