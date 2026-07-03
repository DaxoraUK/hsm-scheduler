-- Daxora Ground Control: pilot operations, launch gates, client telemetry and user profiles.
-- Requires migrations through 202607030006_billing_legal_readiness.sql.

begin;

create table if not exists public.platform_launch_gates (
  code text primary key,
  title text not null,
  category text not null check (category in ('product', 'security', 'operations', 'commercial', 'legal', 'deployment')),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'blocked', 'ready', 'not_applicable')),
  evidence text not null default '',
  owner_label text not null default '',
  due_date date,
  last_verified_at timestamptz,
  last_verified_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object'),
  check (length(trim(code)) between 3 and 64),
  check (length(trim(title)) between 3 and 160)
);

create table if not exists public.platform_pilot_clubs (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  stage text not null default 'candidate'
    check (stage in ('candidate', 'invited', 'onboarding', 'validation', 'live_pilot', 'paused', 'graduated', 'withdrawn')),
  health text not null default 'on_track'
    check (health in ('on_track', 'attention', 'blocked')),
  coordinator_user_id uuid references auth.users(id) on delete set null,
  target_start_date date,
  target_review_date date,
  live_since timestamptz,
  notes text not null default '',
  checklist jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(checklist) = 'object')
);

create index if not exists platform_pilot_clubs_stage_idx
  on public.platform_pilot_clubs(stage, health, updated_at desc);

create table if not exists public.platform_client_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  level text not null check (level in ('warning', 'error')),
  category text not null check (category in ('application_crash', 'unhandled_rejection', 'sync_failure', 'session_failure', 'manual_report')),
  message text not null,
  reference text,
  route text,
  release text,
  environment text,
  context jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(context) = 'object'),
  check (length(message) between 1 and 500)
);

create index if not exists platform_client_events_open_idx
  on public.platform_client_events(created_at desc)
  where resolved_at is null;
create index if not exists platform_client_events_club_idx
  on public.platform_client_events(club_id, created_at desc)
  where club_id is not null;

insert into public.platform_launch_gates (code, title, category, owner_label)
values
  ('security_release_gate', 'Security and tenant-isolation verification complete', 'security', 'Daxora'),
  ('backup_restore_test', 'Production backup and restore test completed', 'operations', 'Daxora'),
  ('production_environment', 'Production environment and secrets configured', 'deployment', 'Daxora'),
  ('monitoring_alerts', 'Error monitoring and alert ownership confirmed', 'operations', 'Daxora'),
  ('incident_response', 'Incident response and escalation runbook rehearsed', 'operations', 'Daxora'),
  ('legal_review', 'Commercial and privacy documents professionally reviewed', 'legal', 'Daxora'),
  ('stripe_test_mode', 'Stripe test-mode checkout, portal and webhooks verified', 'commercial', 'Daxora'),
  ('support_process', 'Pilot support channel, response targets and case workflow confirmed', 'operations', 'Daxora'),
  ('pilot_club_selected', 'Initial pilot club and accountable owner confirmed', 'commercial', 'Daxora'),
  ('pilot_training', 'Pilot training and operational handover completed', 'product', 'Daxora'),
  ('production_smoke_test', 'Production smoke test passed on desktop and mobile', 'product', 'Daxora'),
  ('launch_signoff', 'Launch decision recorded with outstanding risks accepted', 'commercial', 'Daxora')
on conflict (code) do nothing;

drop trigger if exists platform_launch_gates_touch_updated_at on public.platform_launch_gates;
create trigger platform_launch_gates_touch_updated_at
before update on public.platform_launch_gates
for each row execute function public.touch_updated_at();

drop trigger if exists platform_pilot_clubs_touch_updated_at on public.platform_pilot_clubs;
create trigger platform_pilot_clubs_touch_updated_at
before update on public.platform_pilot_clubs
for each row execute function public.touch_updated_at();

alter table public.platform_launch_gates enable row level security;
alter table public.platform_launch_gates force row level security;
alter table public.platform_pilot_clubs enable row level security;
alter table public.platform_pilot_clubs force row level security;
alter table public.platform_client_events enable row level security;
alter table public.platform_client_events force row level security;

revoke all on table public.platform_launch_gates from public, anon, authenticated;
revoke all on table public.platform_pilot_clubs from public, anon, authenticated;
revoke all on table public.platform_client_events from public, anon, authenticated;

create or replace function public.update_my_profile(next_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  clean_name text := regexp_replace(trim(coalesce(next_display_name, '')), '\s+', ' ', 'g');
  actor_email text;
begin
  if actor_id is null then
    raise exception 'Sign in to update your profile' using errcode = '42501';
  end if;
  if length(clean_name) < 2 or length(clean_name) > 80 then
    raise exception 'Display name must contain between 2 and 80 characters' using errcode = '22023';
  end if;
  if clean_name ~ '[[:cntrl:]]' then
    raise exception 'Display name contains unsupported characters' using errcode = '22023';
  end if;

  select user_row.email into actor_email
  from auth.users user_row
  where user_row.id = actor_id;

  insert into public.user_profiles (id, email, display_name)
  values (actor_id, actor_email, clean_name)
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', clean_name),
      updated_at = now()
  where id = actor_id;

  update public.platform_support_staff
  set display_name = clean_name,
      updated_at = now()
  where user_id = actor_id;

  return jsonb_build_object(
    'user_id', actor_id,
    'email', actor_email,
    'display_name', clean_name,
    'updated_at', now()
  );
end;
$$;

create or replace function public.record_client_event(
  target_club_id uuid default null,
  event_level text default 'error',
  event_category text default 'manual_report',
  event_message text default 'Unexpected client error',
  event_reference text default null,
  event_route text default null,
  app_release text default null,
  app_environment text default null,
  event_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  created_id uuid;
  safe_context jsonb;
  actor_role text;
begin
  if actor_id is null then
    raise exception 'Authenticated access required' using errcode = '42501';
  end if;
  if event_level not in ('warning', 'error') then
    raise exception 'Unsupported client event level' using errcode = '22023';
  end if;
  if event_category not in ('application_crash', 'unhandled_rejection', 'sync_failure', 'session_failure', 'manual_report') then
    raise exception 'Unsupported client event category' using errcode = '22023';
  end if;

  if target_club_id is not null then
    actor_role := private.current_actor_role(target_club_id, actor_id);
    if actor_role = 'unknown' then
      raise exception 'Club access is required to record this event' using errcode = '42501';
    end if;
  end if;

  safe_context := coalesce(event_context, '{}'::jsonb)
    - array['password', 'token', 'access_token', 'refresh_token', 'authorization', 'cookie', 'secret', 'api_key', 'email', 'fixture', 'fixtures', 'team', 'player'];

  if octet_length(safe_context::text) > 8192 then
    safe_context := jsonb_build_object('context_truncated', true);
  end if;

  insert into public.platform_client_events (
    club_id, user_id, level, category, message, reference, route, release, environment, context
  ) values (
    target_club_id,
    actor_id,
    event_level,
    event_category,
    left(coalesce(nullif(trim(event_message), ''), 'Unexpected client error'), 500),
    left(nullif(trim(coalesce(event_reference, '')), ''), 80),
    left(nullif(trim(coalesce(event_route, '')), ''), 300),
    left(nullif(trim(coalesce(app_release, '')), ''), 80),
    left(nullif(trim(coalesce(app_environment, '')), ''), 40),
    safe_context
  ) returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.platform_get_pilot_launch_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  perform private.require_platform_staff('support');

  select jsonb_build_object(
    'gates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', gate.code,
        'title', gate.title,
        'category', gate.category,
        'status', gate.status,
        'evidence', gate.evidence,
        'owner_label', gate.owner_label,
        'due_date', gate.due_date,
        'last_verified_at', gate.last_verified_at,
        'last_verified_by_name', verifier.display_name,
        'updated_at', gate.updated_at
      ) order by gate.category, gate.title)
      from public.platform_launch_gates gate
      left join public.user_profiles verifier on verifier.id = gate.last_verified_by
    ), '[]'::jsonb),
    'pilots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'club_id', pilot.club_id,
        'club_name', club.name,
        'stage', pilot.stage,
        'health', pilot.health,
        'coordinator_user_id', pilot.coordinator_user_id,
        'coordinator_name', coordinator.display_name,
        'target_start_date', pilot.target_start_date,
        'target_review_date', pilot.target_review_date,
        'live_since', pilot.live_since,
        'notes', pilot.notes,
        'checklist', pilot.checklist,
        'plan_code', subscription.plan_code,
        'subscription_status', subscription.status,
        'onboarding_status', onboarding.status,
        'updated_at', pilot.updated_at
      ) order by pilot.updated_at desc)
      from public.platform_pilot_clubs pilot
      join public.clubs club on club.id = pilot.club_id
      left join public.user_profiles coordinator on coordinator.id = pilot.coordinator_user_id
      left join public.club_subscriptions subscription on subscription.club_id = pilot.club_id
      left join public.club_onboarding onboarding on onboarding.club_id = pilot.club_id
    ), '[]'::jsonb),
    'client_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event_row.id,
        'club_id', event_row.club_id,
        'club_name', club.name,
        'level', event_row.level,
        'category', event_row.category,
        'message', event_row.message,
        'reference', event_row.reference,
        'route', event_row.route,
        'release', event_row.release,
        'environment', event_row.environment,
        'context', event_row.context,
        'created_at', event_row.created_at
      ) order by event_row.created_at desc)
      from (
        select * from public.platform_client_events
        where resolved_at is null
        order by created_at desc
        limit 50
      ) event_row
      left join public.clubs club on club.id = event_row.club_id
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'gate_total', (select count(*) from public.platform_launch_gates where status <> 'not_applicable'),
      'gate_ready', (select count(*) from public.platform_launch_gates where status = 'ready'),
      'gate_blocked', (select count(*) from public.platform_launch_gates where status = 'blocked'),
      'pilot_total', (select count(*) from public.platform_pilot_clubs where stage not in ('withdrawn')),
      'pilot_live', (select count(*) from public.platform_pilot_clubs where stage = 'live_pilot'),
      'pilot_blocked', (select count(*) from public.platform_pilot_clubs where health = 'blocked' and stage not in ('graduated', 'withdrawn')),
      'open_client_errors', (select count(*) from public.platform_client_events where resolved_at is null and level = 'error'),
      'billing_legal_ready', private.billing_legal_configuration_ready()
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.platform_update_launch_gate(
  gate_code text,
  next_status text,
  next_evidence text default '',
  next_owner_label text default '',
  next_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  updated_gate public.platform_launch_gates%rowtype;
begin
  perform private.require_platform_staff('admin');
  if next_status not in ('not_started', 'in_progress', 'blocked', 'ready', 'not_applicable') then
    raise exception 'Unsupported launch-gate status' using errcode = '22023';
  end if;

  update public.platform_launch_gates
  set status = next_status,
      evidence = left(coalesce(next_evidence, ''), 4000),
      owner_label = left(coalesce(next_owner_label, ''), 120),
      due_date = next_due_date,
      last_verified_at = case when next_status = 'ready' then now() else last_verified_at end,
      last_verified_by = case when next_status = 'ready' then actor_id else last_verified_by end,
      updated_at = now()
  where code = gate_code
  returning * into updated_gate;

  if updated_gate.code is null then
    raise exception 'Launch gate not found' using errcode = 'P0002';
  end if;

  perform private.write_platform_activity(
    'launch_gate_updated', null, 'launch_gate', updated_gate.code,
    jsonb_build_object('status', updated_gate.status, 'due_date', updated_gate.due_date)
  );

  return to_jsonb(updated_gate);
end;
$$;

create or replace function public.platform_upsert_pilot(
  target_club_id uuid,
  next_stage text default 'candidate',
  next_health text default 'on_track',
  next_coordinator_user_id uuid default null,
  next_target_start_date date default null,
  next_target_review_date date default null,
  next_notes text default '',
  next_checklist jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  pilot_row public.platform_pilot_clubs%rowtype;
begin
  perform private.require_platform_staff('admin');
  if next_stage not in ('candidate', 'invited', 'onboarding', 'validation', 'live_pilot', 'paused', 'graduated', 'withdrawn') then
    raise exception 'Unsupported pilot stage' using errcode = '22023';
  end if;
  if next_health not in ('on_track', 'attention', 'blocked') then
    raise exception 'Unsupported pilot health' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(next_checklist, '{}'::jsonb)) <> 'object' then
    raise exception 'Pilot checklist must be an object' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clubs where id = target_club_id) then
    raise exception 'Club not found' using errcode = 'P0002';
  end if;

  insert into public.platform_pilot_clubs (
    club_id, stage, health, coordinator_user_id, target_start_date, target_review_date,
    live_since, notes, checklist, created_by, updated_by
  ) values (
    target_club_id, next_stage, next_health, next_coordinator_user_id,
    next_target_start_date, next_target_review_date,
    case when next_stage = 'live_pilot' then now() else null end,
    left(coalesce(next_notes, ''), 8000), coalesce(next_checklist, '{}'::jsonb), actor_id, actor_id
  )
  on conflict (club_id) do update set
    stage = excluded.stage,
    health = excluded.health,
    coordinator_user_id = excluded.coordinator_user_id,
    target_start_date = excluded.target_start_date,
    target_review_date = excluded.target_review_date,
    live_since = case
      when excluded.stage = 'live_pilot' then coalesce(public.platform_pilot_clubs.live_since, now())
      when excluded.stage in ('candidate', 'invited', 'onboarding', 'validation') then null
      else public.platform_pilot_clubs.live_since
    end,
    notes = excluded.notes,
    checklist = excluded.checklist,
    updated_by = actor_id,
    updated_at = now()
  returning * into pilot_row;

  perform private.write_platform_activity(
    'pilot_club_updated', target_club_id, 'pilot_club', target_club_id::text,
    jsonb_build_object('stage', pilot_row.stage, 'health', pilot_row.health)
  );

  return to_jsonb(pilot_row);
end;
$$;

create or replace function public.platform_resolve_client_event(
  target_event_id uuid,
  resolution_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_row public.platform_client_events%rowtype;
begin
  perform private.require_platform_staff('support');

  update public.platform_client_events
  set resolved_at = now(),
      resolved_by = actor_id,
      resolution_note = left(coalesce(resolution_note, ''), 2000)
  where id = target_event_id
    and resolved_at is null
  returning * into event_row;

  if event_row.id is null then
    raise exception 'Open client event not found' using errcode = 'P0002';
  end if;

  perform private.write_platform_activity(
    'client_event_resolved', event_row.club_id, 'client_event', event_row.id::text,
    jsonb_build_object('reference', event_row.reference, 'category', event_row.category)
  );

  return to_jsonb(event_row);
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon, authenticated;
revoke all on function public.record_client_event(uuid, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.platform_get_pilot_launch_readiness() from public, anon, authenticated;
revoke all on function public.platform_update_launch_gate(text, text, text, text, date) from public, anon, authenticated;
revoke all on function public.platform_upsert_pilot(uuid, text, text, uuid, date, date, text, jsonb) from public, anon, authenticated;
revoke all on function public.platform_resolve_client_event(uuid, text) from public, anon, authenticated;

grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.record_client_event(uuid, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.platform_get_pilot_launch_readiness() to authenticated;
grant execute on function public.platform_update_launch_gate(text, text, text, text, date) to authenticated;
grant execute on function public.platform_upsert_pilot(uuid, text, text, uuid, date, date, text, jsonb) to authenticated;
grant execute on function public.platform_resolve_client_event(uuid, text) to authenticated;

commit;
