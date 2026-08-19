-- Daxora Ground Control v3.10.32
-- Multi-role club access with optional team/site scope.

create table if not exists public.club_member_roles (
  id uuid primary key default gen_random_uuid(),
  club_membership_id uuid not null references public.club_memberships(id) on delete cascade,
  role_code text not null,
  scope_type text not null default 'club' check (scope_type in ('club','team','site')),
  scope_id text,
  status text not null default 'active' check (status in ('active','revoked')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_membership_id, role_code, scope_type, scope_id)
);

alter table public.club_member_roles enable row level security;
alter table public.club_member_roles force row level security;
revoke all on public.club_member_roles from anon, authenticated;

drop policy if exists club_member_roles_member_select on public.club_member_roles;
create policy club_member_roles_member_select
  on public.club_member_roles for select to authenticated
  using (
    exists (
      select 1 from public.club_memberships membership
      where membership.id = club_member_roles.club_membership_id
        and public.can_read_club(membership.club_id)
    )
  );

drop index if exists club_member_roles_membership_idx;
create index club_member_roles_membership_idx on public.club_member_roles(club_membership_id, status);
create index club_member_roles_scope_idx on public.club_member_roles(scope_type, scope_id, status);

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
        'roles', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', assignment.id,
            'role_code', assignment.role_code,
            'scope_type', assignment.scope_type,
            'scope_id', assignment.scope_id,
            'status', assignment.status
          ) order by assignment.created_at)
          from public.club_member_roles assignment
          where assignment.club_membership_id = membership.id
            and assignment.status = 'active'
        ), '[]'::jsonb),
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

create or replace function public.add_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  next_role text,
  target_scope_type text default 'club',
  target_scope_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  membership_id uuid;
  actor_role text;
  role_value text := lower(trim(next_role));
  scope_value text := lower(trim(coalesce(target_scope_type, 'club')));
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if role_value not in ('chair','club_secretary','scheduler','fixture_officer','operations_officer','treasurer','welfare_officer','communications_officer','coach','team_manager','volunteer','viewer') then
    raise exception 'Unsupported additional club role' using errcode = '22023';
  end if;
  if scope_value not in ('club','team','site') then
    raise exception 'Unsupported role scope' using errcode = '22023';
  end if;
  if scope_value <> 'club' and nullif(trim(coalesce(target_scope_id,'')), '') is null then
    raise exception 'Scoped roles require a scope id' using errcode = '22023';
  end if;

  select id into membership_id
  from public.club_memberships
  where club_id = target_club_id and user_id = target_user_id and status <> 'revoked';
  if membership_id is null then
    raise exception 'Club member not found' using errcode = 'P0002';
  end if;

  insert into public.club_member_roles (club_membership_id, role_code, scope_type, scope_id, created_by)
  values (membership_id, role_value, scope_value, nullif(trim(target_scope_id), ''), auth.uid())
  on conflict (club_membership_id, role_code, scope_type, scope_id)
  do update set status = 'active', updated_at = now();

  return jsonb_build_object('ok', true, 'role_code', role_value, 'scope_type', scope_value, 'scope_id', nullif(trim(target_scope_id), ''));
end;
$$;

create or replace function public.remove_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  role_assignment_id uuid
)
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

  update public.club_member_roles assignment
  set status = 'revoked', updated_at = now()
  where assignment.id = role_assignment_id
    and exists (
      select 1 from public.club_memberships membership
      where membership.id = assignment.club_membership_id
        and membership.club_id = target_club_id
        and membership.user_id = target_user_id
        and membership.status <> 'revoked'
    );

  if not found then
    raise exception 'Additional role assignment not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('ok', true, 'role_assignment_id', role_assignment_id);
end;
$$;

revoke all on function public.list_club_members(uuid) from public, anon, authenticated;
revoke all on function public.add_club_member_role(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.remove_club_member_role(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_club_members(uuid) to authenticated;
grant execute on function public.add_club_member_role(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.remove_club_member_role(uuid, uuid, uuid) to authenticated;

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
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', assignment.id,
          'role_code', assignment.role_code,
          'scope_type', assignment.scope_type,
          'scope_id', assignment.scope_id,
          'status', assignment.status
        ) order by assignment.created_at)
        from public.club_member_roles assignment
        where assignment.club_membership_id = membership.id
          and assignment.status = 'active'
      ), '[]'::jsonb) as roles,
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
      '[]'::jsonb as roles,
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
    select distinct on (combined.club_id) combined.*
    from combined
    order by combined.club_id, combined.priority
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'club_id', club.id,
      'organisation_id', club.organisation_id,
      'club_name', club.name,
      'club_slug', club.slug,
      'club_status', club.status,
      'role', deduplicated.role,
      'roles', deduplicated.roles,
      'access_mode', deduplicated.access_mode,
      'read_only', deduplicated.read_only,
      'support_session_id', deduplicated.support_session_id,
      'support_expires_at', deduplicated.support_expires_at,
      'granted_at', deduplicated.granted_at
    ) order by club.name), '[]'::jsonb
  )
  from deduplicated
  join public.clubs club on club.id = deduplicated.club_id;
$$;

revoke all on function public.list_accessible_workspaces() from public, anon, authenticated;
grant execute on function public.list_accessible_workspaces() to authenticated;

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
  )
  or exists (
    select 1
    from public.club_memberships membership
    join public.clubs club on club.id = membership.club_id
    join public.club_member_roles assignment on assignment.club_membership_id = membership.id
    where membership.club_id = target_club_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and club.status = 'active'
      and assignment.status = 'active'
      and assignment.scope_type = 'club'
      and assignment.role_code = any(allowed_roles)
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
  select public.has_club_role(target_club_id, array['owner', 'admin', 'club_secretary']);
$$;

create or replace function public.can_operate_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.has_club_role(target_club_id, array['owner', 'admin', 'club_secretary', 'scheduler', 'fixture_officer', 'operations_officer']);
$$;
