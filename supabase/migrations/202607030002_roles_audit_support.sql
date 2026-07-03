-- Daxora Ground Control: role management, trusted audit review and safe support sessions.
-- Apply after 202607030001_multi_club_rls.sql.
--
-- Design principles:
--   * membership and support changes happen only through guarded RPCs;
--   * browser users never receive a service-role key;
--   * support staff keep their own identity and receive time-limited read-only access;
--   * every privileged membership/support action is written server-side to audit_events.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in email) > 1)
);
create unique index if not exists user_profiles_email_key
  on public.user_profiles(lower(email));

insert into public.user_profiles (id, email, display_name)
select
  user_row.id,
  lower(user_row.email),
  coalesce(
    nullif(trim(user_row.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(user_row.raw_user_meta_data ->> 'full_name'), ''),
    split_part(user_row.email, '@', 1)
  )
from auth.users user_row
where user_row.email is not null
on conflict (id) do update
set email = excluded.email,
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
    updated_at = now();

create or replace function private.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.user_profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(nullif(public.user_profiles.display_name, ''), excluded.display_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists ground_control_sync_user_profile on auth.users;
create trigger ground_control_sync_user_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function private.sync_user_profile();

create table if not exists public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'scheduler', 'viewer')),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in email) > 1),
  check (expires_at > created_at)
);
create index if not exists club_invitations_club_status_idx
  on public.club_invitations(club_id, status, created_at desc);
create index if not exists club_invitations_email_status_idx
  on public.club_invitations(lower(email), status, expires_at);

create table if not exists public.platform_support_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_access_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  support_user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 5 and 500),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (expires_at <= starts_at + interval '4 hours')
);
create index if not exists support_access_active_user_idx
  on public.support_access_sessions(support_user_id, expires_at desc)
  where revoked_at is null;
create index if not exists support_access_active_club_idx
  on public.support_access_sessions(club_id, expires_at desc)
  where revoked_at is null;

alter table public.audit_events
  add column if not exists actor_role text,
  add column if not exists actor_label text,
  add column if not exists source text not null default 'app',
  add column if not exists support_session_id uuid references public.support_access_sessions(id) on delete set null;

create index if not exists audit_events_action_idx
  on public.audit_events(club_id, action, created_at desc);

-- Keep updated_at consistent on new public tables.
drop trigger if exists user_profiles_touch_updated_at on public.user_profiles;
create trigger user_profiles_touch_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists club_invitations_touch_updated_at on public.club_invitations;
create trigger club_invitations_touch_updated_at
before update on public.club_invitations
for each row execute function public.touch_updated_at();

drop trigger if exists platform_support_staff_touch_updated_at on public.platform_support_staff;
create trigger platform_support_staff_touch_updated_at
before update on public.platform_support_staff
for each row execute function public.touch_updated_at();

create or replace function private.current_actor_label(actor_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    nullif(trim(profile.display_name), ''),
    nullif(trim(profile.email), ''),
    actor_id::text
  )
  from public.user_profiles profile
  where profile.id = actor_id
  union all
  select actor_id::text
  where not exists (select 1 from public.user_profiles profile where profile.id = actor_id)
  limit 1;
$$;

create or replace function private.current_actor_role(target_club_id uuid, actor_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    (
      select membership.role
      from public.club_memberships membership
      where membership.club_id = target_club_id
        and membership.user_id = actor_id
        and membership.status = 'active'
      limit 1
    ),
    (
      select 'support'
      from public.support_access_sessions session_row
      join public.platform_support_staff staff on staff.user_id = session_row.support_user_id
      where session_row.club_id = target_club_id
        and session_row.support_user_id = actor_id
        and session_row.revoked_at is null
        and session_row.starts_at <= now()
        and session_row.expires_at > now()
        and staff.status = 'active'
      limit 1
    ),
    'unknown'
  );
$$;

create or replace function private.write_audit_event(
  target_club_id uuid,
  actor_id uuid,
  event_action text,
  entity_type text default null,
  entity_id text default null,
  event_detail jsonb default '{}'::jsonb,
  event_source text default 'database',
  support_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  event_id uuid;
begin
  if actor_id is null then
    raise exception 'Authenticated actor required' using errcode = '42501';
  end if;
  if length(trim(coalesce(event_action, ''))) < 2 then
    raise exception 'Audit action is required' using errcode = '22023';
  end if;

  insert into public.audit_events (
    club_id,
    actor_user_id,
    actor_role,
    actor_label,
    action,
    entity_type,
    entity_id,
    detail,
    source,
    support_session_id
  ) values (
    target_club_id,
    actor_id,
    private.current_actor_role(target_club_id, actor_id),
    private.current_actor_label(actor_id),
    trim(event_action),
    nullif(trim(coalesce(entity_type, '')), ''),
    nullif(trim(coalesce(entity_id, '')), ''),
    coalesce(event_detail, '{}'::jsonb),
    coalesce(nullif(trim(event_source), ''), 'database'),
    support_session_id
  ) returning id into event_id;

  return event_id;
end;
$$;

-- All browser writes now pass through audited SECURITY DEFINER functions.
-- Direct table mutation grants are removed near the end of this migration.
create or replace function public.save_club_configuration(
  target_club_id uuid,
  configuration jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  next_name text;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if configuration is null or jsonb_typeof(configuration) <> 'object' then
    raise exception 'Club configuration must be a JSON object' using errcode = '22023';
  end if;

  insert into public.club_config (club_id, id, data)
  values (target_club_id, 'club', configuration)
  on conflict (club_id, id)
  do update set data = excluded.data, updated_at = now();

  next_name := nullif(trim(coalesce(configuration ->> 'name', '')), '');
  if next_name is not null then
    update public.clubs
    set name = next_name, updated_at = now()
    where id = target_club_id;
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'settings.club_config.save',
    'club_config',
    'club',
    jsonb_build_object('club_name_updated', next_name is not null),
    'database'
  );
end;
$$;

create or replace function public.replace_club_collection(
  target_club_id uuid,
  collection_name text,
  records jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  record_count integer := 0;
  safe_collection text := lower(trim(coalesce(collection_name, '')));
  safe_records jsonb := coalesce(records, '[]'::jsonb);
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_records) <> 'array' then
    raise exception 'records must be a JSON array' using errcode = '22023';
  end if;

  if safe_collection in ('pitches', 'team_config') then
    if not public.can_manage_club(target_club_id) then
      raise exception 'Club administrator access required' using errcode = '42501';
    end if;
  elsif safe_collection in ('refs', 'pitch_closures') then
    if not public.can_operate_club(target_club_id) then
      raise exception 'Club operator access required' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported collection: %', safe_collection using errcode = '22023';
  end if;

  if safe_collection = 'pitches' then
    delete from public.pitches where club_id = target_club_id;
    insert into public.pitches (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  elsif safe_collection = 'team_config' then
    delete from public.team_config where club_id = target_club_id;
    insert into public.team_config (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  elsif safe_collection = 'refs' then
    delete from public.refs where club_id = target_club_id;
    insert into public.refs (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  elsif safe_collection = 'pitch_closures' then
    delete from public.pitch_closures where club_id = target_club_id;
    insert into public.pitch_closures (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'settings.collection.replace',
    safe_collection,
    safe_collection,
    jsonb_build_object('collection', safe_collection, 'record_count', record_count),
    'database'
  );

  return record_count;
end;
$$;

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
  if safe_id is null then
    raise exception 'History entry requires an id' using errcode = '22023';
  end if;
  if history_data is null or jsonb_typeof(history_data) <> 'object' then
    raise exception 'History entry must be a JSON object' using errcode = '22023';
  end if;

  insert into public.history (club_id, id, data, saved_at)
  values (target_club_id, safe_id, history_data, coalesce(history_saved_at, now()))
  on conflict (club_id, id)
  do update set
    data = excluded.data,
    saved_at = excluded.saved_at,
    updated_at = now();

  if jsonb_typeof(history_data -> 'fixtureDays') = 'array' then
    day_count := jsonb_array_length(history_data -> 'fixtureDays');
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'matchweek.publish',
    'matchweek',
    safe_id,
    jsonb_build_object(
      'date_label', nullif(history_data ->> 'dateLabel', ''),
      'fixture_day_count', day_count
    ),
    'database'
  );
end;
$$;

create or replace function public.delete_matchweek_history(
  target_club_id uuid,
  history_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_id text := nullif(trim(coalesce(history_id, '')), '');
  deleted_count integer := 0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if safe_id is null then
    raise exception 'History entry requires an id' using errcode = '22023';
  end if;

  delete from public.history
  where club_id = target_club_id and id = safe_id;
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'Matchweek history entry not found' using errcode = 'P0002';
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'history.delete',
    'matchweek',
    safe_id,
    '{}'::jsonb,
    'database'
  );

  return true;
end;
$$;

create or replace function public.save_test_fixtures(
  target_club_id uuid,
  config_key text,
  fixtures jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_key text := lower(trim(coalesce(config_key, '')));
  safe_fixtures jsonb := coalesce(fixtures, '[]'::jsonb);
  fixture_count integer;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if safe_key not in ('testsat', 'testsun', 'testmidweek') then
    raise exception 'Unsupported test fixture key' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_fixtures) <> 'array' then
    raise exception 'fixtures must be a JSON array' using errcode = '22023';
  end if;

  fixture_count := jsonb_array_length(safe_fixtures);
  insert into public.club_config (club_id, id, data)
  values (target_club_id, safe_key, jsonb_build_object('fixtures', safe_fixtures))
  on conflict (club_id, id)
  do update set data = excluded.data, updated_at = now();

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'test-fixtures.save',
    'test-fixtures',
    safe_key,
    jsonb_build_object('fixture_count', fixture_count),
    'database'
  );

  return fixture_count;
end;
$$;

create or replace function public.is_active_support_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.platform_support_staff staff
    where staff.user_id = auth.uid()
      and staff.status = 'active'
  );
$$;

create or replace function public.get_active_support_session(target_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select session_row.id
  from public.support_access_sessions session_row
  join public.platform_support_staff staff on staff.user_id = session_row.support_user_id
  join public.clubs club on club.id = session_row.club_id
  where session_row.club_id = target_club_id
    and session_row.support_user_id = auth.uid()
    and session_row.revoked_at is null
    and session_row.starts_at <= now()
    and session_row.expires_at > now()
    and staff.status = 'active'
    and club.status = 'active'
  order by session_row.expires_at desc
  limit 1;
$$;

create or replace function public.has_active_support_access(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.get_active_support_session(target_club_id) is not null;
$$;

create or replace function public.can_read_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.is_club_member(target_club_id)
      or public.has_active_support_access(target_club_id);
$$;

create or replace function public.is_organisation_accessible(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.clubs club
    where club.organisation_id = target_organisation_id
      and public.can_read_club(club.id)
  );
$$;

create or replace function public.list_accessible_workspaces()
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with membership_access as (
    select
      membership.club_id,
      membership.role,
      'membership'::text as access_mode,
      false as read_only,
      null::uuid as support_session_id,
      null::timestamptz as support_expires_at,
      membership.created_at as granted_at,
      1 as priority
    from public.club_memberships membership
    join public.clubs club on club.id = membership.club_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and club.status = 'active'
  ),
  support_access as (
    select
      session_row.club_id,
      'support'::text as role,
      'support'::text as access_mode,
      true as read_only,
      session_row.id as support_session_id,
      session_row.expires_at as support_expires_at,
      session_row.created_at as granted_at,
      2 as priority
    from public.support_access_sessions session_row
    join public.platform_support_staff staff on staff.user_id = session_row.support_user_id
    join public.clubs club on club.id = session_row.club_id
    where session_row.support_user_id = auth.uid()
      and session_row.revoked_at is null
      and session_row.starts_at <= now()
      and session_row.expires_at > now()
      and staff.status = 'active'
      and club.status = 'active'
  ),
  combined as (
    select * from membership_access
    union all
    select * from support_access
  ),
  deduplicated as (
    select distinct on (combined.club_id)
      combined.*
    from combined
    order by combined.club_id, combined.priority
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'club_id', club.id,
        'organisation_id', club.organisation_id,
        'club_name', club.name,
        'club_slug', club.slug,
        'club_status', club.status,
        'role', deduplicated.role,
        'access_mode', deduplicated.access_mode,
        'read_only', deduplicated.read_only,
        'support_session_id', deduplicated.support_session_id,
        'support_expires_at', deduplicated.support_expires_at,
        'granted_at', deduplicated.granted_at
      ) order by club.name
    ),
    '[]'::jsonb
  )
  from deduplicated
  join public.clubs club on club.id = deduplicated.club_id;
$$;

create or replace function public.list_club_members(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'user_id', membership.user_id,
        'email', profile.email,
        'display_name', profile.display_name,
        'role', membership.role,
        'status', membership.status,
        'created_at', membership.created_at,
        'updated_at', membership.updated_at
      ) order by
        case membership.role when 'owner' then 1 when 'admin' then 2 when 'scheduler' then 3 else 4 end,
        lower(coalesce(profile.display_name, profile.email))
    )
    from public.club_memberships membership
    left join public.user_profiles profile on profile.id = membership.user_id
    where membership.club_id = target_club_id
      and membership.status <> 'revoked'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_club_invitations(target_club_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  update public.club_invitations
  set status = 'expired', updated_at = now()
  where club_id = target_club_id
    and status = 'pending'
    and expires_at <= now();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', invitation.id,
        'email', invitation.email,
        'role', invitation.role,
        'status', invitation.status,
        'expires_at', invitation.expires_at,
        'created_at', invitation.created_at,
        'invited_by', invitation.invited_by
      ) order by invitation.created_at desc
    )
    from public.club_invitations invitation
    where invitation.club_id = target_club_id
      and invitation.status in ('pending', 'expired')
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_club_invitation(
  target_club_id uuid,
  invite_email text,
  invite_role text default 'viewer',
  expiry_hours integer default 72
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  safe_email text := lower(trim(coalesce(invite_email, '')));
  safe_role text := lower(trim(coalesce(invite_role, 'viewer')));
  safe_hours integer := greatest(1, least(coalesce(expiry_hours, 72), 168));
  invitation_id uuid;
  invitation_token text := encode(gen_random_bytes(32), 'hex');
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if position('@' in safe_email) <= 1 then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;
  if safe_role not in ('admin', 'scheduler', 'viewer') then
    raise exception 'Unsupported invitation role' using errcode = '22023';
  end if;
  if actor_role = 'admin' and safe_role = 'admin' then
    raise exception 'Only the club owner can invite another administrator' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.club_memberships membership
    join public.user_profiles profile on profile.id = membership.user_id
    where membership.club_id = target_club_id
      and lower(profile.email) = safe_email
      and membership.status = 'active'
  ) then
    raise exception 'This person already has active club access' using errcode = '23505';
  end if;

  update public.club_invitations
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where club_id = target_club_id
    and lower(email) = safe_email
    and status = 'pending';

  insert into public.club_invitations (
    club_id, email, role, token_hash, invited_by, expires_at
  ) values (
    target_club_id,
    safe_email,
    safe_role,
    encode(digest(invitation_token, 'sha256'), 'hex'),
    actor_id,
    now() + make_interval(hours => safe_hours)
  ) returning id into invitation_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.invitation.create',
    'club_invitation',
    invitation_id::text,
    jsonb_build_object('email', safe_email, 'role', safe_role, 'expiry_hours', safe_hours),
    'database'
  );

  return jsonb_build_object(
    'id', invitation_id,
    'token', invitation_token,
    'email', safe_email,
    'role', safe_role,
    'expires_at', now() + make_interval(hours => safe_hours)
  );
end;
$$;

create or replace function public.revoke_club_invitation(
  target_club_id uuid,
  invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  invitation_role text;
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  select role into invitation_role
  from public.club_invitations
  where id = invitation_id and club_id = target_club_id and status = 'pending'
  for update;

  if invitation_role is null then
    raise exception 'Pending invitation not found' using errcode = 'P0002';
  end if;
  if actor_role = 'admin' and invitation_role = 'admin' then
    raise exception 'Only the club owner can revoke an administrator invitation' using errcode = '42501';
  end if;

  update public.club_invitations
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = invitation_id and club_id = target_club_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.invitation.revoke',
    'club_invitation',
    invitation_id::text,
    jsonb_build_object('role', invitation_role),
    'database'
  );
end;
$$;

create or replace function public.accept_club_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  invitation public.club_invitations%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(profile.email) into actor_email
  from public.user_profiles profile
  where profile.id = actor_id;

  select invitation_row.* into invitation
  from public.club_invitations invitation_row
  where invitation_row.token_hash = encode(digest(trim(coalesce(invitation_token, '')), 'sha256'), 'hex')
  for update;

  if invitation.id is null then
    raise exception 'Invitation link is invalid' using errcode = 'P0002';
  end if;
  if invitation.status <> 'pending' then
    raise exception 'Invitation is no longer available' using errcode = '42501';
  end if;
  if invitation.expires_at <= now() then
    update public.club_invitations set status = 'expired', updated_at = now() where id = invitation.id;
    raise exception 'Invitation has expired' using errcode = '42501';
  end if;
  if actor_email is null or actor_email <> lower(invitation.email) then
    raise exception 'Sign in with the email address that received this invitation' using errcode = '42501';
  end if;

  insert into public.club_memberships (club_id, user_id, role, status, created_by)
  values (invitation.club_id, actor_id, invitation.role, 'active', invitation.invited_by)
  on conflict (club_id, user_id) do update
  set role = excluded.role,
      status = 'active',
      updated_at = now();

  update public.club_invitations
  set status = 'accepted', accepted_by = actor_id, accepted_at = now(), updated_at = now()
  where id = invitation.id;

  perform private.write_audit_event(
    invitation.club_id,
    actor_id,
    'membership.invitation.accept',
    'club_membership',
    actor_id::text,
    jsonb_build_object('role', invitation.role, 'invitation_id', invitation.id),
    'database'
  );

  return jsonb_build_object('club_id', invitation.club_id, 'role', invitation.role);
end;
$$;

create or replace function public.update_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  next_role text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  current_role text;
  safe_role text := lower(trim(coalesce(next_role, '')));
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if target_user_id = actor_id then
    raise exception 'Use ownership transfer or another administrator to change your own access' using errcode = '42501';
  end if;
  if safe_role not in ('admin', 'scheduler', 'viewer') then
    raise exception 'Unsupported role' using errcode = '22023';
  end if;

  select role into current_role
  from public.club_memberships
  where club_id = target_club_id and user_id = target_user_id and status = 'active'
  for update;

  if current_role is null then
    raise exception 'Active club member not found' using errcode = 'P0002';
  end if;
  if current_role = 'owner' then
    raise exception 'The owner role can change only through ownership transfer' using errcode = '42501';
  end if;
  if actor_role = 'admin' and (current_role = 'admin' or safe_role = 'admin') then
    raise exception 'Only the club owner can manage administrator access' using errcode = '42501';
  end if;

  update public.club_memberships
  set role = safe_role, updated_at = now()
  where club_id = target_club_id and user_id = target_user_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.role.update',
    'club_membership',
    target_user_id::text,
    jsonb_build_object('previous_role', current_role, 'next_role', safe_role),
    'database'
  );
end;
$$;

create or replace function public.remove_club_member(
  target_club_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  target_role text;
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner', 'admin') then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if target_user_id = actor_id then
    raise exception 'You cannot remove your own membership here' using errcode = '42501';
  end if;

  select role into target_role
  from public.club_memberships
  where club_id = target_club_id and user_id = target_user_id and status = 'active'
  for update;

  if target_role is null then
    raise exception 'Active club member not found' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'Transfer ownership before removing the owner' using errcode = '42501';
  end if;
  if actor_role = 'admin' and target_role = 'admin' then
    raise exception 'Only the club owner can remove an administrator' using errcode = '42501';
  end if;

  update public.club_memberships
  set status = 'revoked', updated_at = now()
  where club_id = target_club_id and user_id = target_user_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.remove',
    'club_membership',
    target_user_id::text,
    jsonb_build_object('previous_role', target_role),
    'database'
  );
end;
$$;

create or replace function public.transfer_club_ownership(
  target_club_id uuid,
  new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_role text;
begin
  if private.current_actor_role(target_club_id, actor_id) <> 'owner' then
    raise exception 'Club owner access required' using errcode = '42501';
  end if;
  if new_owner_user_id = actor_id then
    raise exception 'You already own this club' using errcode = '22023';
  end if;

  perform 1 from public.club_memberships
  where club_id = target_club_id and user_id = actor_id and role = 'owner' and status = 'active'
  for update;

  select role into target_role
  from public.club_memberships
  where club_id = target_club_id and user_id = new_owner_user_id and status = 'active'
  for update;

  if target_role is null then
    raise exception 'The new owner must already be an active club member' using errcode = 'P0002';
  end if;

  -- Capture the transfer while the authenticated actor is still the owner.
  -- The event participates in this transaction, so a later update failure rolls it back.
  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.ownership.transfer',
    'club_membership',
    new_owner_user_id::text,
    jsonb_build_object('previous_owner', actor_id, 'new_owner_previous_role', target_role),
    'database'
  );

  update public.club_memberships
  set role = 'admin', updated_at = now()
  where club_id = target_club_id and user_id = actor_id;

  update public.club_memberships
  set role = 'owner', updated_at = now()
  where club_id = target_club_id and user_id = new_owner_user_id;
end;
$$;

create or replace function public.list_support_access_sessions(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', session_row.id,
        'support_user_id', session_row.support_user_id,
        'support_name', staff.display_name,
        'support_email', profile.email,
        'reason', session_row.reason,
        'starts_at', session_row.starts_at,
        'expires_at', session_row.expires_at,
        'revoked_at', session_row.revoked_at,
        'created_at', session_row.created_at,
        'active', session_row.revoked_at is null and session_row.expires_at > now()
      ) order by session_row.created_at desc
    )
    from public.support_access_sessions session_row
    join public.platform_support_staff staff on staff.user_id = session_row.support_user_id
    left join public.user_profiles profile on profile.id = session_row.support_user_id
    where session_row.club_id = target_club_id
      and session_row.created_at > now() - interval '30 days'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.grant_support_access(
  target_club_id uuid,
  support_email text,
  duration_minutes integer default 60,
  support_reason text default 'Club support session'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  support_user uuid;
  safe_email text := lower(trim(coalesce(support_email, '')));
  safe_minutes integer := greatest(15, least(coalesce(duration_minutes, 60), 120));
  safe_reason text := trim(coalesce(support_reason, ''));
  session_id uuid;
  session_expiry timestamptz := now() + make_interval(mins => safe_minutes);
begin
  if private.current_actor_role(target_club_id, actor_id) <> 'owner' then
    raise exception 'Only the club owner can grant support access' using errcode = '42501';
  end if;
  if length(safe_reason) < 5 then
    raise exception 'Give a short reason for support access' using errcode = '22023';
  end if;

  select staff.user_id into support_user
  from public.platform_support_staff staff
  join public.user_profiles profile on profile.id = staff.user_id
  where lower(profile.email) = safe_email
    and staff.status = 'active'
  limit 1;

  if support_user is null then
    raise exception 'No active Daxora support account matches that email' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = support_user
      and membership.status = 'active'
  ) then
    raise exception 'Use a dedicated Daxora support account that is not a club member' using errcode = '42501';
  end if;

  update public.support_access_sessions
  set revoked_at = now(), revoked_by = actor_id
  where club_id = target_club_id
    and support_user_id = support_user
    and revoked_at is null
    and expires_at > now();

  insert into public.support_access_sessions (
    club_id, support_user_id, granted_by, reason, expires_at
  ) values (
    target_club_id, support_user, actor_id, safe_reason, session_expiry
  ) returning id into session_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'support.session.grant',
    'support_access_session',
    session_id::text,
    jsonb_build_object('support_user_id', support_user, 'duration_minutes', safe_minutes, 'reason', safe_reason),
    'database',
    session_id
  );

  return jsonb_build_object(
    'id', session_id,
    'support_user_id', support_user,
    'expires_at', session_expiry,
    'duration_minutes', safe_minutes
  );
end;
$$;

create or replace function public.revoke_support_access(
  target_club_id uuid,
  support_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  session_support_user uuid;
begin
  if private.current_actor_role(target_club_id, actor_id) <> 'owner' then
    raise exception 'Only the club owner can revoke support access' using errcode = '42501';
  end if;

  select support_user_id into session_support_user
  from public.support_access_sessions
  where id = support_session_id and club_id = target_club_id
  for update;

  if session_support_user is null then
    raise exception 'Support session not found' using errcode = 'P0002';
  end if;

  update public.support_access_sessions
  set revoked_at = coalesce(revoked_at, now()), revoked_by = actor_id
  where id = support_session_id and club_id = target_club_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'support.session.revoke',
    'support_access_session',
    support_session_id::text,
    jsonb_build_object('support_user_id', session_support_user),
    'database',
    support_session_id
  );
end;
$$;

create or replace function public.end_own_support_session(support_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_club_id uuid;
begin
  select club_id into target_club_id
  from public.support_access_sessions
  where id = support_session_id
    and support_user_id = actor_id
    and revoked_at is null
  for update;

  if target_club_id is null then
    raise exception 'Active support session not found' using errcode = 'P0002';
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'support.session.end',
    'support_access_session',
    support_session_id::text,
    '{}'::jsonb,
    'support',
    support_session_id
  );

  update public.support_access_sessions
  set revoked_at = now(), revoked_by = actor_id
  where id = support_session_id;
end;
$$;

create or replace function public.record_support_workspace_open(
  target_club_id uuid,
  support_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_id uuid;
begin
  if public.get_active_support_session(target_club_id) is distinct from support_session_id then
    raise exception 'Active support session required' using errcode = '42501';
  end if;

  select event.id into event_id
  from public.audit_events event
  where event.club_id = target_club_id
    and event.actor_user_id = actor_id
    and event.action = 'support.workspace.open'
    and event.support_session_id = support_session_id
    and event.created_at > now() - interval '15 minutes'
  order by event.created_at desc
  limit 1;

  if event_id is null then
    event_id := private.write_audit_event(
      target_club_id,
      actor_id,
      'support.workspace.open',
      'club',
      target_club_id::text,
      '{}'::jsonb,
      'support',
      support_session_id
    );
  end if;

  return event_id;
end;
$$;

create or replace function public.list_audit_events(
  target_club_id uuid,
  result_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(result_limit, 50), 100));
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(audit_row) order by audit_row.created_at desc)
    from (
      select
        event.id,
        event.actor_user_id,
        coalesce(event.actor_label, profile.display_name, profile.email, event.actor_user_id::text) as actor_label,
        coalesce(event.actor_role, private.current_actor_role(target_club_id, event.actor_user_id)) as actor_role,
        event.action,
        event.entity_type,
        event.entity_id,
        event.detail,
        event.source,
        event.support_session_id,
        event.created_at
      from public.audit_events event
      left join public.user_profiles profile on profile.id = event.actor_user_id
      where event.club_id = target_club_id
      order by event.created_at desc
      limit safe_limit
    ) audit_row
  ), '[]'::jsonb);
end;
$$;

-- Browser-supplied semantic audit events are deliberately not exposed.
-- Each supported mutation above writes its own server-side audit event.

-- Replace read policies so active support sessions can read but never write.
drop policy if exists organisations_member_select on public.organisations;
create policy organisations_access_select
  on public.organisations for select to authenticated
  using (public.is_organisation_accessible(id));

drop policy if exists clubs_member_select on public.clubs;
create policy clubs_access_select
  on public.clubs for select to authenticated
  using (public.can_read_club(id));

-- Audit history is available only through the guarded administrator RPC.
drop policy if exists audit_events_member_select on public.audit_events;
drop policy if exists audit_events_admin_select on public.audit_events;
create policy audit_events_admin_select
  on public.audit_events for select to authenticated
  using (public.can_manage_club(club_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['history', 'refs', 'team_config', 'club_config', 'pitches', 'pitch_closures']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_member_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read_club(club_id))',
      table_name || '_access_select',
      table_name
    );
  end loop;
end $$;

alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
alter table public.club_invitations enable row level security;
alter table public.club_invitations force row level security;
alter table public.platform_support_staff enable row level security;
alter table public.platform_support_staff force row level security;
alter table public.support_access_sessions enable row level security;
alter table public.support_access_sessions force row level security;

-- Operational writes are RPC-only so a browser cannot mutate data without a server-side audit event.
revoke insert, update, delete on
  public.history, public.refs, public.team_config, public.club_config, public.pitches, public.pitch_closures
from authenticated;

-- Audit rows are also RPC-only to prevent viewers or support sessions bypassing the admin screen.
revoke select, insert, update, delete on public.audit_events from authenticated;

-- These security tables are intentionally RPC-only. No direct browser table policies exist.
revoke all on public.user_profiles from anon, authenticated;
revoke all on public.club_invitations from anon, authenticated;
revoke all on public.platform_support_staff from anon, authenticated;
revoke all on public.support_access_sessions from anon, authenticated;

-- Tight function grants. SECURITY DEFINER functions remain callable only where listed.
revoke all on function public.is_active_support_staff() from public, anon, authenticated;
revoke all on function public.get_active_support_session(uuid) from public, anon, authenticated;
revoke all on function public.has_active_support_access(uuid) from public, anon, authenticated;
revoke all on function public.can_read_club(uuid) from public, anon, authenticated;
revoke all on function public.is_organisation_accessible(uuid) from public, anon, authenticated;
revoke all on function public.save_club_configuration(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_club_collection(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.save_matchweek_history(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_matchweek_history(uuid, text) from public, anon, authenticated;
revoke all on function public.save_test_fixtures(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.list_accessible_workspaces() from public, anon, authenticated;
revoke all on function public.list_club_members(uuid) from public, anon, authenticated;
revoke all on function public.list_club_invitations(uuid) from public, anon, authenticated;
revoke all on function public.create_club_invitation(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.revoke_club_invitation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_club_invitation(text) from public, anon, authenticated;
revoke all on function public.update_club_member_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.remove_club_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.transfer_club_ownership(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_support_access_sessions(uuid) from public, anon, authenticated;
revoke all on function public.grant_support_access(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.revoke_support_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.end_own_support_session(uuid) from public, anon, authenticated;
revoke all on function public.record_support_workspace_open(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_audit_events(uuid, integer) from public, anon, authenticated;
revoke all on function public.record_audit_event(uuid, text, text, text, jsonb) from public, anon, authenticated;

revoke all on function private.sync_user_profile() from public, anon, authenticated;
revoke all on function private.current_actor_label(uuid) from public, anon, authenticated;
revoke all on function private.current_actor_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.write_audit_event(uuid, uuid, text, text, text, jsonb, text, uuid) from public, anon, authenticated;

grant execute on function public.is_active_support_staff() to authenticated;
grant execute on function public.get_active_support_session(uuid) to authenticated;
grant execute on function public.has_active_support_access(uuid) to authenticated;
grant execute on function public.can_read_club(uuid) to authenticated;
grant execute on function public.is_organisation_accessible(uuid) to authenticated;
grant execute on function public.save_club_configuration(uuid, jsonb) to authenticated;
grant execute on function public.replace_club_collection(uuid, text, jsonb) to authenticated;
grant execute on function public.save_matchweek_history(uuid, text, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_matchweek_history(uuid, text) to authenticated;
grant execute on function public.save_test_fixtures(uuid, text, jsonb) to authenticated;
grant execute on function public.list_accessible_workspaces() to authenticated;
grant execute on function public.list_club_members(uuid) to authenticated;
grant execute on function public.list_club_invitations(uuid) to authenticated;
grant execute on function public.create_club_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.revoke_club_invitation(uuid, uuid) to authenticated;
grant execute on function public.accept_club_invitation(text) to authenticated;
grant execute on function public.update_club_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_club_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_club_ownership(uuid, uuid) to authenticated;
grant execute on function public.list_support_access_sessions(uuid) to authenticated;
grant execute on function public.grant_support_access(uuid, text, integer, text) to authenticated;
grant execute on function public.revoke_support_access(uuid, uuid) to authenticated;
grant execute on function public.end_own_support_session(uuid) to authenticated;
grant execute on function public.record_support_workspace_open(uuid, uuid) to authenticated;
grant execute on function public.list_audit_events(uuid, integer) to authenticated;

commit;
