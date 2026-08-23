-- Daxora Ground Control v3.10.41
-- Multi-role club access architecture.
-- Keeps the existing primary membership role for compatibility and adds
-- optional functional roles with explicit club/team/site scope.

create table if not exists public.club_member_roles (
  club_id uuid not null,
  user_id uuid not null,
  role_code text not null check (role_code in (
    'chair',
    'club_secretary',
    'fixture_officer',
    'operations_officer',
    'treasurer',
    'welfare_officer',
    'communications_officer',
    'coach',
    'team_manager',
    'volunteer'
  )),
  scope_type text not null default 'club' check (scope_type in ('club','team','site')),
  scope_id text,
  status text not null default 'active' check (status in ('active','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id, role_code, scope_type, scope_id),
  foreign key (club_id, user_id)
    references public.club_memberships(club_id, user_id)
    on delete cascade
);

create index if not exists club_member_roles_user_club_idx
  on public.club_member_roles(user_id, club_id, status);

create index if not exists club_member_roles_scope_idx
  on public.club_member_roles(club_id, scope_type, scope_id, status);

alter table public.club_member_roles enable row level security;
alter table public.club_member_roles force row level security;

revoke all on table public.club_member_roles from public, anon, authenticated;

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
          select jsonb_agg(
            jsonb_build_object(
              'role', member_role.role_code,
              'scope_type', member_role.scope_type,
              'scope_id', member_role.scope_id,
              'status', member_role.status
            )
            order by member_role.role_code, member_role.scope_type, member_role.scope_id
          )
          from public.club_member_roles member_role
          where member_role.club_id = membership.club_id
            and member_role.user_id = membership.user_id
            and member_role.status = 'active'
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
  role_code text,
  scope_type text default 'club',
  scope_id text default null
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
  safe_role text := lower(trim(coalesce(role_code, '')));
  safe_scope text := lower(trim(coalesce(scope_type, 'club')));
  safe_scope_id text := nullif(trim(scope_id), '');
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);

  if actor_role not in ('owner', 'admin') then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  if safe_role not in (
    'chair',
    'club_secretary',
    'fixture_officer',
    'operations_officer',
    'treasurer',
    'welfare_officer',
    'communications_officer',
    'coach',
    'team_manager',
    'volunteer'
  ) then
    raise exception 'Unsupported additional role' using errcode = '22023';
  end if;

  if safe_scope not in ('club','team','site') then
    raise exception 'Unsupported role scope' using errcode = '22023';
  end if;

  if safe_scope <> 'club' and safe_scope_id is null then
    raise exception 'A team or site scope requires a scope identifier' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = target_user_id
      and membership.status = 'active'
  ) then
    raise exception 'Active club member not found' using errcode = 'P0002';
  end if;

  insert into public.club_member_roles (
    club_id, user_id, role_code, scope_type, scope_id, status, created_by
  ) values (
    target_club_id, target_user_id, safe_role, safe_scope, safe_scope_id, 'active', actor_id
  )
  on conflict on constraint club_member_roles_pkey
  do update set status = 'active', updated_at = now(), created_by = excluded.created_by;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.additional_role.add',
    'club_member_role',
    target_user_id::text,
    jsonb_build_object(
      'role', safe_role,
      'scope_type', safe_scope,
      'scope_id', safe_scope_id
    ),
    'database'
  );

  return jsonb_build_object(
    'club_id', target_club_id,
    'user_id', target_user_id,
    'role', safe_role,
    'scope_type', safe_scope,
    'scope_id', safe_scope_id
  );
end;
$$;

create or replace function public.remove_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  role_code text,
  scope_type text default 'club',
  scope_id text default null
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
  safe_role text := lower(trim(coalesce(role_code, '')));
  safe_scope text := lower(trim(coalesce(scope_type, 'club')));
  safe_scope_id text := nullif(trim(scope_id), '');
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);

  if actor_role not in ('owner', 'admin') then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  if safe_role = '' then
    raise exception 'Role is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.club_member_roles member_role
    where member_role.club_id = target_club_id
      and member_role.user_id = target_user_id
      and member_role.role_code = safe_role
      and member_role.scope_type = safe_scope
      and member_role.scope_id is not distinct from safe_scope_id
      and member_role.status = 'active'
  ) then
    raise exception 'Additional role assignment not found' using errcode = 'P0002';
  end if;

  update public.club_member_roles as member_role
  set status = 'revoked', updated_at = now()
  where member_role.club_id = target_club_id
    and member_role.user_id = target_user_id
    and member_role.role_code = safe_role
    and member_role.scope_type = safe_scope
    and member_role.scope_id is not distinct from safe_scope_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'membership.additional_role.remove',
    'club_member_role',
    target_user_id::text,
    jsonb_build_object(
      'role', safe_role,
      'scope_type', safe_scope,
      'scope_id', safe_scope_id
    ),
    'database'
  );
end;
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
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'role', member_role.role_code,
            'scope_type', member_role.scope_type,
            'scope_id', member_role.scope_id,
            'status', member_role.status
          )
          order by member_role.role_code, member_role.scope_type, member_role.scope_id
        )
        from public.club_member_roles member_role
        where member_role.club_id = membership.club_id
          and member_role.user_id = membership.user_id
          and member_role.status = 'active'
      ), '[]'::jsonb) as role_assignments,
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
      '[]'::jsonb as role_assignments,
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
        'role_assignments', deduplicated.role_assignments,
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

revoke all on function public.add_club_member_role(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.remove_club_member_role(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.add_club_member_role(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.remove_club_member_role(uuid, uuid, text, text, text) to authenticated;

-- list_club_members/list_accessible_workspaces already have their existing grants.
