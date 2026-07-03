-- Daxora Ground Control: multi-club ownership, authenticated REST access and RLS.
-- Run once in the Supabase SQL Editor before installing the matching application patch.
-- Existing single-club rows remain present but invisible until the first signed-in
-- administrator uses the in-app "Secure existing workspace" action.

begin;

create extension if not exists pgcrypto;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique,
  organisation_type text not null default 'club_operator'
    check (organisation_type in ('club_operator', 'league_operator', 'platform')),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_memberships (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'scheduler', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- One-time bootstrap is deliberately allowlisted. Add the existing owner's
-- auth.users UUID here for a short window using the supplied rollout guide.
-- This prevents the first random authenticated account from claiming legacy data.
create table if not exists public.workspace_bootstrap_authorisations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists club_memberships_user_active_idx
  on public.club_memberships(user_id, status, club_id);
create index if not exists clubs_organisation_idx
  on public.clubs(organisation_id, status);

-- Preserve the existing prototype tables while adding a surrogate row key and
-- tenant ownership. The old global id primary keys are replaced so different
-- clubs may safely use the same logical keys such as "club" or "team_0".
create table if not exists public.history (
  id text not null,
  data jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);
create table if not exists public.refs (
  id text not null,
  data jsonb not null default '{}'::jsonb
);
create table if not exists public.team_config (
  id text not null,
  data jsonb not null default '{}'::jsonb
);
create table if not exists public.club_config (
  id text not null,
  data jsonb not null default '{}'::jsonb
);
create table if not exists public.pitches (
  id text not null,
  data jsonb not null default '{}'::jsonb
);
create table if not exists public.pitch_closures (
  id text not null,
  data jsonb not null default '{}'::jsonb
);

-- The old browser-authored audit_log is retained only as sealed legacy data.
create table if not exists public.audit_log (
  id text primary key,
  data jsonb,
  created_at timestamptz default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (length(trim(action)) between 2 and 120),
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_club_created_idx
  on public.audit_events(club_id, created_at desc);

-- Normalise each existing operational table to row_id PK + (club_id, id) key.
do $$
declare
  table_name text;
  primary_key_name text;
begin
  foreach table_name in array array['history', 'refs', 'team_config', 'club_config', 'pitches', 'pitch_closures']
  loop
    execute format('alter table public.%I add column if not exists row_id uuid', table_name);
    execute format('alter table public.%I alter column row_id set default gen_random_uuid()', table_name);
    execute format('update public.%I set row_id = gen_random_uuid() where row_id is null', table_name);
    execute format('alter table public.%I alter column row_id set not null', table_name);
    execute format('alter table public.%I add column if not exists club_id uuid', table_name);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', table_name);

    select conname into primary_key_name
    from pg_constraint
    where conrelid = format('public.%I', table_name)::regclass
      and contype = 'p';

    if primary_key_name is not null and not exists (
      select 1
      from pg_constraint c
      join unnest(c.conkey) with ordinality as keys(attnum, ordinality) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = keys.attnum
      where c.conrelid = format('public.%I', table_name)::regclass
        and c.contype = 'p'
      group by c.oid
      having array_agg(a.attname order by keys.ordinality) = array['row_id']::name[]
    ) then
      execute format('alter table public.%I drop constraint %I', table_name, primary_key_name);
      primary_key_name := null;
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', table_name)::regclass
        and contype = 'p'
    ) then
      execute format('alter table public.%I add constraint %I primary key (row_id)', table_name, table_name || '_pkey');
    end if;

    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', table_name)::regclass
        and conname = table_name || '_club_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (club_id) references public.clubs(id) on delete cascade',
        table_name,
        table_name || '_club_id_fkey'
      );
    end if;

    execute format(
      'create unique index if not exists %I on public.%I (club_id, id)',
      table_name || '_club_record_key',
      table_name
    );
  end loop;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Recreate touch triggers idempotently.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organisations', 'clubs', 'club_memberships',
    'history', 'refs', 'team_config', 'club_config', 'pitches', 'pitch_closures'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );
  end loop;
end $$;

-- Security-definer predicates prevent recursive membership policies while still
-- deriving identity exclusively from auth.uid().
create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.club_memberships membership
    join public.clubs club on club.id = membership.club_id
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and club.status = 'active'
  );
$$;

create or replace function public.has_club_role(target_club_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.club_memberships membership
    join public.clubs club on club.id = membership.club_id
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and club.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function public.can_manage_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.has_club_role(target_club_id, array['owner', 'admin']);
$$;

create or replace function public.can_operate_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.has_club_role(target_club_id, array['owner', 'admin', 'scheduler']);
$$;

create or replace function public.is_organisation_member(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.clubs club
    join public.club_memberships membership on membership.club_id = club.id
    where club.organisation_id = target_organisation_id
      and club.status = 'active'
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

-- Safe first-project bootstrap. It can execute only while the project contains
-- no club, uses an advisory lock to prevent races, and assigns all legacy rows
-- to the authenticated owner in one transaction.
create or replace function public.get_workspace_bootstrap_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  club_count integer;
  membership_count integer;
  bootstrap_authorised boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select count(*) into club_count from public.clubs;
  select count(*) into membership_count
  from public.club_memberships
  where user_id = auth.uid() and status = 'active';

  select exists (
    select 1
    from public.workspace_bootstrap_authorisations authorisation
    where authorisation.user_id = auth.uid()
      and authorisation.expires_at > now()
  ) into bootstrap_authorised;

  return jsonb_build_object(
    'can_bootstrap', club_count = 0 and bootstrap_authorised,
    'workspace_unclaimed', club_count = 0,
    'authorisation_required', club_count = 0 and not bootstrap_authorised,
    'has_membership', membership_count > 0,
    'club_count', club_count
  );
end;
$$;

create or replace function public.bootstrap_first_workspace(
  club_name text,
  organisation_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  new_organisation_id uuid := gen_random_uuid();
  new_club_id uuid := gen_random_uuid();
  safe_club_name text := trim(coalesce(club_name, ''));
  safe_organisation_name text := trim(coalesce(organisation_name, club_name, ''));
  club_slug text;
  organisation_slug text;
  table_name text;
  has_unassigned boolean;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(safe_club_name) < 2 then
    raise exception 'Club name is required' using errcode = '22023';
  end if;
  if length(safe_organisation_name) < 2 then
    safe_organisation_name := safe_club_name;
  end if;

  perform pg_advisory_xact_lock(hashtext('ground-control-bootstrap-first-workspace'));
  if exists (select 1 from public.clubs) then
    raise exception 'The first workspace has already been secured' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.workspace_bootstrap_authorisations authorisation
    where authorisation.user_id = actor_id
      and authorisation.expires_at > now()
  ) then
    raise exception 'This account is not authorised to claim the legacy workspace' using errcode = '42501';
  end if;

  organisation_slug := trim(both '-' from regexp_replace(lower(safe_organisation_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || left(new_organisation_id::text, 8);
  club_slug := trim(both '-' from regexp_replace(lower(safe_club_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || left(new_club_id::text, 8);

  insert into public.organisations (id, name, slug, organisation_type, created_by)
  values (new_organisation_id, safe_organisation_name, organisation_slug, 'club_operator', actor_id);

  insert into public.clubs (id, organisation_id, name, slug, created_by)
  values (new_club_id, new_organisation_id, safe_club_name, club_slug, actor_id);

  insert into public.club_memberships (club_id, user_id, role, status, created_by)
  values (new_club_id, actor_id, 'owner', 'active', actor_id);

  update public.history set club_id = new_club_id where club_id is null;
  update public.refs set club_id = new_club_id where club_id is null;
  update public.team_config set club_id = new_club_id where club_id is null;
  update public.club_config set club_id = new_club_id where club_id is null;
  update public.pitches set club_id = new_club_id where club_id is null;
  update public.pitch_closures set club_id = new_club_id where club_id is null;

  -- Once every legacy row has an owner, make tenant ownership mandatory at the
  -- database level so service-side mistakes cannot create orphaned records.
  foreach table_name in array array['history', 'refs', 'team_config', 'club_config', 'pitches', 'pitch_closures']
  loop
    execute format(
      'select exists (select 1 from public.%I where club_id is null)',
      table_name
    ) into has_unassigned;
    if has_unassigned then
      raise exception 'Unassigned rows remain in %', table_name using errcode = '23502';
    end if;
    execute format('alter table public.%I alter column club_id set not null', table_name);
  end loop;

  update public.clubs
  set name = coalesce(
    nullif((select data ->> 'name' from public.club_config where club_id = new_club_id and id = 'club' limit 1), ''),
    safe_club_name
  )
  where id = new_club_id;

  insert into public.audit_events (club_id, actor_user_id, action, entity_type, entity_id, detail)
  values (
    new_club_id,
    actor_id,
    'workspace.bootstrap',
    'club',
    new_club_id::text,
    jsonb_build_object('legacy_rows_claimed', true)
  );

  delete from public.workspace_bootstrap_authorisations where user_id = actor_id;

  return jsonb_build_object(
    'club_id', new_club_id,
    'organisation_id', new_organisation_id,
    'role', 'owner'
  );
end;
$$;

create or replace function public.save_club_configuration(
  target_club_id uuid,
  configuration jsonb
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  next_name text;
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  insert into public.club_config (club_id, id, data)
  values (target_club_id, 'club', coalesce(configuration, '{}'::jsonb))
  on conflict (club_id, id)
  do update set data = excluded.data, updated_at = now();

  next_name := nullif(trim(coalesce(configuration ->> 'name', '')), '');
  if next_name is not null then
    update public.clubs set name = next_name, updated_at = now() where id = target_club_id;
  end if;
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
set search_path = public
set row_security = off
as $$
declare
  record_count integer := 0;
  safe_records jsonb := coalesce(records, '[]'::jsonb);
begin
  if jsonb_typeof(safe_records) <> 'array' then
    raise exception 'records must be a JSON array' using errcode = '22023';
  end if;

  if collection_name in ('pitches', 'team_config') then
    if not public.can_manage_club(target_club_id) then
      raise exception 'Club administrator access required' using errcode = '42501';
    end if;
  elsif collection_name in ('refs', 'pitch_closures') then
    if not public.can_operate_club(target_club_id) then
      raise exception 'Club operator access required' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported collection: %', collection_name using errcode = '22023';
  end if;

  if collection_name = 'pitches' then
    delete from public.pitches where club_id = target_club_id;
    insert into public.pitches (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  elsif collection_name = 'team_config' then
    delete from public.team_config where club_id = target_club_id;
    insert into public.team_config (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  elsif collection_name = 'refs' then
    delete from public.refs where club_id = target_club_id;
    insert into public.refs (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  elsif collection_name = 'pitch_closures' then
    delete from public.pitch_closures where club_id = target_club_id;
    insert into public.pitch_closures (club_id, id, data)
    select target_club_id, item ->> 'id', coalesce(item -> 'data', '{}'::jsonb)
    from jsonb_array_elements(safe_records) item
    where nullif(item ->> 'id', '') is not null;
    get diagnostics record_count = row_count;
  end if;
  return record_count;
end;
$$;

create or replace function public.record_audit_event(
  target_club_id uuid,
  event_action text,
  entity_type text default null,
  entity_id text default null,
  event_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_id uuid;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(event_action, ''))) < 2 then
    raise exception 'Audit action is required' using errcode = '22023';
  end if;

  insert into public.audit_events (
    club_id, actor_user_id, action, entity_type, entity_id, detail
  ) values (
    target_club_id,
    actor_id,
    trim(event_action),
    nullif(trim(coalesce(entity_type, '')), ''),
    nullif(trim(coalesce(entity_id, '')), ''),
    coalesce(event_detail, '{}'::jsonb)
  ) returning id into event_id;

  return event_id;
end;
$$;

-- Remove every prototype "allow all" policy before installing deny-by-default RLS.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'organisations', 'clubs', 'club_memberships', 'workspace_bootstrap_authorisations',
        'history', 'refs', 'team_config', 'club_config', 'pitches', 'pitch_closures',
        'audit_events', 'audit_log'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end $$;

alter table public.organisations enable row level security;
alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.workspace_bootstrap_authorisations enable row level security;
alter table public.history enable row level security;
alter table public.refs enable row level security;
alter table public.team_config enable row level security;
alter table public.club_config enable row level security;
alter table public.pitches enable row level security;
alter table public.pitch_closures enable row level security;
alter table public.audit_events enable row level security;
alter table public.audit_log enable row level security;

alter table public.organisations force row level security;
alter table public.clubs force row level security;
alter table public.club_memberships force row level security;
alter table public.history force row level security;
alter table public.refs force row level security;
alter table public.team_config force row level security;
alter table public.club_config force row level security;
alter table public.pitches force row level security;
alter table public.pitch_closures force row level security;
alter table public.audit_events force row level security;
alter table public.audit_log force row level security;

create policy organisations_member_select
  on public.organisations for select to authenticated
  using (public.is_organisation_member(id));
create policy clubs_member_select
  on public.clubs for select to authenticated
  using (public.is_club_member(id));

create policy memberships_self_or_admin_select
  on public.club_memberships for select to authenticated
  using (user_id = auth.uid() or public.can_manage_club(club_id));
-- Membership writes remain closed until the dedicated role-management RPCs are
-- introduced. This prevents a browser client from promoting an admin to owner
-- or deleting the final owner through direct REST calls.

-- Read policies for all tenant-owned operational data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['history', 'refs', 'team_config', 'club_config', 'pitches', 'pitch_closures']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_club_member(club_id))',
      table_name || '_member_select',
      table_name
    );
  end loop;
end $$;

-- Settings data is administrator-only; operational history, officials and pitch
-- closures are writable by owner/admin/scheduler.
create policy club_config_admin_insert on public.club_config for insert to authenticated
  with check (public.can_manage_club(club_id));
create policy club_config_admin_update on public.club_config for update to authenticated
  using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy club_config_admin_delete on public.club_config for delete to authenticated
  using (public.can_manage_club(club_id));

create policy pitches_admin_insert on public.pitches for insert to authenticated
  with check (public.can_manage_club(club_id));
create policy pitches_admin_update on public.pitches for update to authenticated
  using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy pitches_admin_delete on public.pitches for delete to authenticated
  using (public.can_manage_club(club_id));

create policy team_config_admin_insert on public.team_config for insert to authenticated
  with check (public.can_manage_club(club_id));
create policy team_config_admin_update on public.team_config for update to authenticated
  using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy team_config_admin_delete on public.team_config for delete to authenticated
  using (public.can_manage_club(club_id));

create policy refs_operator_insert on public.refs for insert to authenticated
  with check (public.can_operate_club(club_id));
create policy refs_operator_update on public.refs for update to authenticated
  using (public.can_operate_club(club_id)) with check (public.can_operate_club(club_id));
create policy refs_operator_delete on public.refs for delete to authenticated
  using (public.can_operate_club(club_id));

create policy history_operator_insert on public.history for insert to authenticated
  with check (public.can_operate_club(club_id));
create policy history_operator_update on public.history for update to authenticated
  using (public.can_operate_club(club_id)) with check (public.can_operate_club(club_id));
create policy history_operator_delete on public.history for delete to authenticated
  using (public.can_operate_club(club_id));

create policy pitch_closures_operator_insert on public.pitch_closures for insert to authenticated
  with check (public.can_operate_club(club_id));
create policy pitch_closures_operator_update on public.pitch_closures for update to authenticated
  using (public.can_operate_club(club_id)) with check (public.can_operate_club(club_id));
create policy pitch_closures_operator_delete on public.pitch_closures for delete to authenticated
  using (public.can_operate_club(club_id));

create policy audit_events_member_select
  on public.audit_events for select to authenticated
  using (public.can_manage_club(club_id));
-- No client insert/update/delete policies exist for audit_events or legacy audit_log.

revoke all on public.organisations, public.clubs, public.club_memberships from anon, authenticated;
revoke all on public.workspace_bootstrap_authorisations from anon, authenticated;
revoke all on public.history, public.refs, public.team_config, public.club_config, public.pitches, public.pitch_closures from anon, authenticated;
revoke all on public.audit_events, public.audit_log from anon, authenticated;
grant select on public.organisations, public.clubs, public.club_memberships to authenticated;
grant select, insert, update, delete on public.history, public.refs, public.team_config, public.club_config, public.pitches, public.pitch_closures to authenticated;
grant select on public.audit_events to authenticated;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.is_club_member(uuid) from public, anon, authenticated;
revoke all on function public.has_club_role(uuid, text[]) from public, anon, authenticated;
revoke all on function public.can_manage_club(uuid) from public, anon, authenticated;
revoke all on function public.can_operate_club(uuid) from public, anon, authenticated;
revoke all on function public.is_organisation_member(uuid) from public, anon, authenticated;
revoke all on function public.get_workspace_bootstrap_status() from public, anon, authenticated;
revoke all on function public.bootstrap_first_workspace(text, text) from public, anon, authenticated;
revoke all on function public.save_club_configuration(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_club_collection(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_audit_event(uuid, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.has_club_role(uuid, text[]) to authenticated;
grant execute on function public.can_manage_club(uuid) to authenticated;
grant execute on function public.can_operate_club(uuid) to authenticated;
grant execute on function public.is_organisation_member(uuid) to authenticated;
grant execute on function public.get_workspace_bootstrap_status() to authenticated;
grant execute on function public.bootstrap_first_workspace(text, text) to authenticated;
grant execute on function public.save_club_configuration(uuid, jsonb) to authenticated;
grant execute on function public.replace_club_collection(uuid, text, jsonb) to authenticated;
grant execute on function public.record_audit_event(uuid, text, text, text, jsonb) to authenticated;


commit;
