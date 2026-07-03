-- Daxora Ground Control: internal administration and support operations.
-- Requires migrations through 202607030004_entitlements_subscriptions.sql.
-- This migration intentionally keeps platform access separate from club membership
-- and does not grant platform staff unrestricted access to operational fixture data.

begin;

alter table public.platform_support_staff
  add column if not exists platform_role text not null default 'support';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.platform_support_staff'::regclass
      and conname = 'platform_support_staff_platform_role_check'
  ) then
    alter table public.platform_support_staff
      add constraint platform_support_staff_platform_role_check
      check (platform_role in ('support', 'admin'));
  end if;
end;
$$;

create table if not exists public.platform_activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete set null,
  action text not null check (length(trim(action)) between 3 and 120),
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(detail) = 'object')
);

create index if not exists platform_activity_created_idx
  on public.platform_activity_events(created_at desc);
create index if not exists platform_activity_club_created_idx
  on public.platform_activity_events(club_id, created_at desc)
  where club_id is not null;

create sequence if not exists public.platform_support_case_number_seq start with 1001;

create table if not exists public.platform_support_cases (
  id uuid primary key default gen_random_uuid(),
  case_number bigint not null default nextval('public.platform_support_case_number_seq') unique,
  club_id uuid not null references public.clubs(id) on delete cascade,
  subject text not null check (length(trim(subject)) between 5 and 180),
  description text not null default '' check (length(description) <= 5000),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'waiting_on_club', 'resolved', 'closed')),
  requester_email text,
  opened_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_email is null or position('@' in requester_email) > 1)
);

create index if not exists platform_support_cases_status_idx
  on public.platform_support_cases(status, priority, updated_at desc);
create index if not exists platform_support_cases_club_idx
  on public.platform_support_cases(club_id, updated_at desc);

create table if not exists public.platform_support_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.platform_support_cases(id) on delete cascade,
  body text not null check (length(trim(body)) between 2 and 5000),
  note_kind text not null default 'internal'
    check (note_kind in ('internal', 'club_update')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists platform_support_case_notes_case_idx
  on public.platform_support_case_notes(case_id, created_at asc);

drop trigger if exists platform_support_cases_touch_updated_at on public.platform_support_cases;
create trigger platform_support_cases_touch_updated_at
before update on public.platform_support_cases
for each row execute function public.touch_updated_at();

alter table public.platform_activity_events enable row level security;
alter table public.platform_activity_events force row level security;
alter table public.platform_support_cases enable row level security;
alter table public.platform_support_cases force row level security;
alter table public.platform_support_case_notes enable row level security;
alter table public.platform_support_case_notes force row level security;

revoke all on table public.platform_activity_events from public, anon, authenticated;
revoke all on table public.platform_support_cases from public, anon, authenticated;
revoke all on table public.platform_support_case_notes from public, anon, authenticated;
revoke all on sequence public.platform_support_case_number_seq from public, anon, authenticated;

create or replace function private.require_platform_staff(required_role text default 'support')
returns text
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
begin
  if actor_id is null then
    raise exception 'Authenticated platform staff access required' using errcode = '42501';
  end if;

  select staff.platform_role into actor_role
  from public.platform_support_staff staff
  where staff.user_id = actor_id
    and staff.status = 'active';

  if actor_role is null then
    raise exception 'Active Daxora platform staff access required' using errcode = '42501';
  end if;

  if lower(coalesce(required_role, 'support')) = 'admin' and actor_role <> 'admin' then
    raise exception 'Daxora platform administrator access required' using errcode = '42501';
  end if;

  return actor_role;
end;
$$;

create or replace function private.write_platform_activity(
  event_action text,
  target_club_id uuid default null,
  entity_type text default null,
  entity_id text default null,
  event_detail jsonb default '{}'::jsonb
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
  perform private.require_platform_staff('support');

  insert into public.platform_activity_events (
    actor_user_id,
    club_id,
    action,
    entity_type,
    entity_id,
    detail
  ) values (
    actor_id,
    target_club_id,
    trim(event_action),
    nullif(trim(coalesce(entity_type, '')), ''),
    nullif(trim(coalesce(entity_id, '')), ''),
    coalesce(event_detail, '{}'::jsonb)
  ) returning id into event_id;

  return event_id;
end;
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
    (
      select case when staff.platform_role = 'admin' then 'platform_admin' else 'platform_support' end
      from public.platform_support_staff staff
      where staff.user_id = actor_id
        and staff.status = 'active'
      limit 1
    ),
    'unknown'
  );
$$;

create or replace function public.get_platform_operator_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  staff public.platform_support_staff%rowtype;
  actor_email text;
begin
  if actor_id is null then
    return jsonb_build_object('is_platform_staff', false);
  end if;

  select * into staff
  from public.platform_support_staff row_value
  where row_value.user_id = actor_id
    and row_value.status = 'active';

  if staff.user_id is null then
    return jsonb_build_object('is_platform_staff', false);
  end if;

  select user_row.email into actor_email
  from auth.users user_row
  where user_row.id = actor_id;

  return jsonb_build_object(
    'is_platform_staff', true,
    'user_id', actor_id,
    'email', actor_email,
    'display_name', staff.display_name,
    'platform_role', staff.platform_role,
    'status', staff.status
  );
end;
$$;

create or replace function public.platform_list_clubs(
  search_text text default '',
  status_filter text default '',
  plan_filter text default '',
  page_size integer default 50,
  page_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_search text := lower(trim(coalesce(search_text, '')));
  safe_status text := lower(trim(coalesce(status_filter, '')));
  safe_plan text := lower(trim(coalesce(plan_filter, '')));
  safe_limit integer := greatest(1, least(coalesce(page_size, 50), 100));
  safe_offset integer := greatest(0, coalesce(page_offset, 0));
begin
  perform private.require_platform_staff('support');

  return (
    with club_rows as (
      select
        club.id as club_id,
        club.name as club_name,
        club.slug as club_slug,
        club.status as club_status,
        club.created_at,
        organisation.name as organisation_name,
        owner_membership.user_id as owner_user_id,
        owner_profile.display_name as owner_display_name,
        owner_profile.email as owner_email,
        subscription.plan_code,
        plan.name as plan_name,
        subscription.status as subscription_status,
        subscription.billing_interval,
        subscription.billing_exempt,
        subscription.trial_ends_at,
        subscription.grace_ends_at,
        subscription.current_period_end,
        onboarding.status as onboarding_status,
        onboarding.current_step as onboarding_step,
        (select count(*)::integer from public.club_memberships membership where membership.club_id = club.id and membership.status = 'active') as member_count,
        (select count(*)::integer from public.team_config team_row where team_row.club_id = club.id) as team_count,
        (select count(*)::integer from public.pitches pitch_row where pitch_row.club_id = club.id) as pitch_count,
        (select count(*)::integer from public.history history_row where history_row.club_id = club.id) as history_count,
        coalesce((
          select case
            when jsonb_typeof(config.data -> 'sites') = 'array'
              then jsonb_array_length(config.data -> 'sites')
            else 0
          end
          from public.club_config config
          where config.club_id = club.id and config.id = 'club'
          limit 1
        ), 0) as venue_count,
        (select max(event_row.created_at) from public.audit_events event_row where event_row.club_id = club.id) as last_activity_at,
        (select count(*)::integer from public.platform_support_cases case_row where case_row.club_id = club.id and case_row.status not in ('resolved', 'closed')) as open_case_count,
        (select count(*)::integer from public.support_access_sessions support_row where support_row.club_id = club.id and support_row.revoked_at is null and support_row.starts_at <= now() and support_row.expires_at > now()) as active_support_count,
        (select support_row.id from public.support_access_sessions support_row where support_row.club_id = club.id and support_row.support_user_id = auth.uid() and support_row.revoked_at is null and support_row.starts_at <= now() and support_row.expires_at > now() order by support_row.expires_at desc limit 1) as my_support_session_id,
        (select support_row.expires_at from public.support_access_sessions support_row where support_row.club_id = club.id and support_row.support_user_id = auth.uid() and support_row.revoked_at is null and support_row.starts_at <= now() and support_row.expires_at > now() order by support_row.expires_at desc limit 1) as my_support_expires_at
      from public.clubs club
      join public.organisations organisation on organisation.id = club.organisation_id
      left join public.club_memberships owner_membership
        on owner_membership.club_id = club.id
       and owner_membership.role = 'owner'
       and owner_membership.status = 'active'
      left join public.user_profiles owner_profile on owner_profile.id = owner_membership.user_id
      left join public.club_subscriptions subscription on subscription.club_id = club.id
      left join public.subscription_plans plan on plan.code = subscription.plan_code
      left join public.club_onboarding onboarding on onboarding.club_id = club.id
      where (safe_search = '' or lower(club.name) like '%' || safe_search || '%' or lower(coalesce(owner_profile.email, '')) like '%' || safe_search || '%')
        and (safe_status = '' or club.status = safe_status)
        and (safe_plan = '' or subscription.plan_code = safe_plan)
    ),
    counted as (
      select count(*)::integer as total from club_rows
    ),
    paged as (
      select * from club_rows
      order by
        case when club_status = 'suspended' then 0 else 1 end,
        coalesce(last_activity_at, created_at) desc,
        club_name asc
      limit safe_limit offset safe_offset
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb),
      'total', coalesce((select total from counted), 0),
      'limit', safe_limit,
      'offset', safe_offset
    )
  );
end;
$$;

create or replace function public.platform_get_club_detail(target_club_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  perform private.require_platform_staff('support');

  if not exists (select 1 from public.clubs club where club.id = target_club_id) then
    raise exception 'Club workspace not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'club', jsonb_build_object(
      'id', club.id,
      'name', club.name,
      'slug', club.slug,
      'status', club.status,
      'created_at', club.created_at,
      'updated_at', club.updated_at,
      'organisation_id', club.organisation_id,
      'organisation_name', organisation.name
    ),
    'subscription', public.get_club_subscription(target_club_id),
    'subscription_record', coalesce((
      select to_jsonb(subscription_row)
      from public.club_subscriptions subscription_row
      where subscription_row.club_id = club.id
      limit 1
    ), '{}'::jsonb),
    'onboarding', coalesce(to_jsonb(onboarding), '{}'::jsonb),
    'counts', jsonb_build_object(
      'members', (select count(*) from public.club_memberships membership where membership.club_id = club.id and membership.status = 'active'),
      'teams', (select count(*) from public.team_config team_row where team_row.club_id = club.id),
      'pitches', (select count(*) from public.pitches pitch_row where pitch_row.club_id = club.id),
      'history', (select count(*) from public.history history_row where history_row.club_id = club.id),
      'venues', coalesce((
        select case
          when jsonb_typeof(config.data -> 'sites') = 'array'
            then jsonb_array_length(config.data -> 'sites')
          else 0
        end
        from public.club_config config
        where config.club_id = club.id and config.id = 'club'
        limit 1
      ), 0)
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id,
        'email', profile.email,
        'display_name', profile.display_name,
        'role', membership.role,
        'status', membership.status,
        'created_at', membership.created_at
      ) order by case membership.role when 'owner' then 0 when 'admin' then 1 when 'scheduler' then 2 else 3 end, profile.display_name)
      from public.club_memberships membership
      left join public.user_profiles profile on profile.id = membership.user_id
      where membership.club_id = club.id
    ), '[]'::jsonb),
    'support_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session_row.id,
        'support_user_id', session_row.support_user_id,
        'support_name', support_profile.display_name,
        'support_email', support_profile.email,
        'granted_by', session_row.granted_by,
        'granted_by_name', grant_profile.display_name,
        'reason', session_row.reason,
        'starts_at', session_row.starts_at,
        'expires_at', session_row.expires_at,
        'revoked_at', session_row.revoked_at,
        'active', session_row.revoked_at is null and session_row.starts_at <= now() and session_row.expires_at > now()
      ) order by session_row.created_at desc)
      from (
        select *
        from public.support_access_sessions source_session
        where source_session.club_id = club.id
        order by source_session.created_at desc
        limit 20
      ) session_row
      left join public.user_profiles support_profile on support_profile.id = session_row.support_user_id
      left join public.user_profiles grant_profile on grant_profile.id = session_row.granted_by
    ), '[]'::jsonb),
    'recent_audit', coalesce((
      select jsonb_agg(to_jsonb(audit_row) order by audit_row.created_at desc)
      from (
        select event_row.id, event_row.actor_user_id, event_row.actor_role, event_row.actor_label,
               event_row.action, event_row.entity_type, event_row.entity_id, event_row.detail,
               event_row.source, event_row.created_at
        from public.audit_events event_row
        where event_row.club_id = club.id
        order by event_row.created_at desc
        limit 25
      ) audit_row
    ), '[]'::jsonb),
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', case_row.id,
        'case_number', case_row.case_number,
        'subject', case_row.subject,
        'priority', case_row.priority,
        'status', case_row.status,
        'assigned_to', case_row.assigned_to,
        'created_at', case_row.created_at,
        'updated_at', case_row.updated_at
      ) order by case_row.updated_at desc)
      from (
        select *
        from public.platform_support_cases source_case
        where source_case.club_id = club.id
        order by source_case.updated_at desc
        limit 20
      ) case_row
    ), '[]'::jsonb)
  ) into result
  from public.clubs club
  join public.organisations organisation on organisation.id = club.organisation_id
  left join public.club_onboarding onboarding on onboarding.club_id = club.id
  where club.id = target_club_id;

  perform private.write_platform_activity(
    'club.detail.review',
    target_club_id,
    'club',
    target_club_id::text,
    '{}'::jsonb
  );

  return result;
end;
$$;

create or replace function public.platform_update_club_status(
  target_club_id uuid,
  next_status text,
  change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_status text := lower(trim(coalesce(next_status, '')));
  previous_status text;
begin
  perform private.require_platform_staff('admin');

  if safe_status not in ('active', 'suspended') then
    raise exception 'Club status must be active or suspended' using errcode = '22023';
  end if;
  if length(trim(coalesce(change_reason, ''))) < 5 then
    raise exception 'A status-change reason is required' using errcode = '22023';
  end if;

  select club.status into previous_status
  from public.clubs club
  where club.id = target_club_id
  for update;

  if previous_status is null then
    raise exception 'Club workspace not found' using errcode = 'P0002';
  end if;

  update public.clubs
  set status = safe_status, updated_at = now()
  where id = target_club_id;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'club.platform_status.update',
    'club',
    target_club_id::text,
    jsonb_build_object(
      'previous_status', previous_status,
      'next_status', safe_status,
      'reason', trim(change_reason)
    ),
    'platform_admin'
  );

  perform private.write_platform_activity(
    'club.status.update',
    target_club_id,
    'club',
    target_club_id::text,
    jsonb_build_object(
      'previous_status', previous_status,
      'next_status', safe_status,
      'reason', trim(change_reason)
    )
  );

  return jsonb_build_object(
    'club_id', target_club_id,
    'previous_status', previous_status,
    'status', safe_status
  );
end;
$$;

create or replace function public.platform_list_support_cases(
  target_club_id uuid default null,
  status_filter text default '',
  result_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_status text := lower(trim(coalesce(status_filter, '')));
  safe_limit integer := greatest(1, least(coalesce(result_limit, 100), 200));
begin
  perform private.require_platform_staff('support');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', case_row.id,
      'case_number', case_row.case_number,
      'club_id', case_row.club_id,
      'club_name', club.name,
      'subject', case_row.subject,
      'description', case_row.description,
      'priority', case_row.priority,
      'status', case_row.status,
      'requester_email', case_row.requester_email,
      'opened_by', case_row.opened_by,
      'opened_by_name', opener.display_name,
      'assigned_to', case_row.assigned_to,
      'assigned_to_name', assignee.display_name,
      'resolved_at', case_row.resolved_at,
      'created_at', case_row.created_at,
      'updated_at', case_row.updated_at
    ) order by
      case case_row.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
      case_row.updated_at desc)
    from (
      select *
      from public.platform_support_cases source_case
      where (target_club_id is null or source_case.club_id = target_club_id)
        and (safe_status = '' or source_case.status = safe_status)
      order by source_case.updated_at desc
      limit safe_limit
    ) case_row
    join public.clubs club on club.id = case_row.club_id
    left join public.user_profiles opener on opener.id = case_row.opened_by
    left join public.user_profiles assignee on assignee.id = case_row.assigned_to
  ), '[]'::jsonb);
end;
$$;

create or replace function public.platform_get_support_case(target_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
  target_club_id uuid;
begin
  perform private.require_platform_staff('support');

  select case_row.club_id into target_club_id
  from public.platform_support_cases case_row
  where case_row.id = target_case_id;

  if target_club_id is null then
    raise exception 'Support case not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'case', jsonb_build_object(
      'id', case_row.id,
      'case_number', case_row.case_number,
      'club_id', case_row.club_id,
      'club_name', club.name,
      'subject', case_row.subject,
      'description', case_row.description,
      'priority', case_row.priority,
      'status', case_row.status,
      'requester_email', case_row.requester_email,
      'opened_by', case_row.opened_by,
      'opened_by_name', opener.display_name,
      'assigned_to', case_row.assigned_to,
      'assigned_to_name', assignee.display_name,
      'resolved_at', case_row.resolved_at,
      'created_at', case_row.created_at,
      'updated_at', case_row.updated_at
    ),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', note_row.id,
        'body', note_row.body,
        'note_kind', note_row.note_kind,
        'created_by', note_row.created_by,
        'created_by_name', note_author.display_name,
        'created_at', note_row.created_at
      ) order by note_row.created_at asc)
      from public.platform_support_case_notes note_row
      left join public.user_profiles note_author on note_author.id = note_row.created_by
      where note_row.case_id = case_row.id
    ), '[]'::jsonb)
  ) into result
  from public.platform_support_cases case_row
  join public.clubs club on club.id = case_row.club_id
  left join public.user_profiles opener on opener.id = case_row.opened_by
  left join public.user_profiles assignee on assignee.id = case_row.assigned_to
  where case_row.id = target_case_id;

  perform private.write_platform_activity(
    'support_case.review',
    target_club_id,
    'support_case',
    target_case_id::text,
    '{}'::jsonb
  );

  return result;
end;
$$;

create or replace function public.platform_create_support_case(
  target_club_id uuid,
  case_subject text,
  case_description text default '',
  case_priority text default 'normal',
  requester_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_priority text := lower(trim(coalesce(case_priority, 'normal')));
  created_case public.platform_support_cases%rowtype;
begin
  perform private.require_platform_staff('support');

  if not exists (select 1 from public.clubs club where club.id = target_club_id) then
    raise exception 'Club workspace not found' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(case_subject, ''))) < 5 then
    raise exception 'Support case subject must contain at least five characters' using errcode = '22023';
  end if;
  if safe_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Unsupported support case priority' using errcode = '22023';
  end if;

  insert into public.platform_support_cases (
    club_id,
    subject,
    description,
    priority,
    requester_email,
    opened_by,
    assigned_to
  ) values (
    target_club_id,
    trim(case_subject),
    trim(coalesce(case_description, '')),
    safe_priority,
    nullif(lower(trim(coalesce(requester_email, ''))), ''),
    actor_id,
    actor_id
  ) returning * into created_case;

  perform private.write_platform_activity(
    'support_case.create',
    target_club_id,
    'support_case',
    created_case.id::text,
    jsonb_build_object(
      'case_number', created_case.case_number,
      'priority', created_case.priority,
      'subject', created_case.subject
    )
  );

  return to_jsonb(created_case);
end;
$$;

create or replace function public.platform_update_support_case(
  target_case_id uuid,
  next_status text default null,
  next_priority text default null,
  update_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  current_case public.platform_support_cases%rowtype;
  safe_status text := lower(trim(coalesce(next_status, '')));
  safe_priority text := lower(trim(coalesce(next_priority, '')));
begin
  perform private.require_platform_staff('support');

  select * into current_case
  from public.platform_support_cases case_row
  where case_row.id = target_case_id
  for update;

  if current_case.id is null then
    raise exception 'Support case not found' using errcode = 'P0002';
  end if;
  if safe_status <> '' and safe_status not in ('open', 'investigating', 'waiting_on_club', 'resolved', 'closed') then
    raise exception 'Unsupported support case status' using errcode = '22023';
  end if;
  if safe_priority <> '' and safe_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Unsupported support case priority' using errcode = '22023';
  end if;

  update public.platform_support_cases
  set status = case when safe_status = '' then status else safe_status end,
      priority = case when safe_priority = '' then priority else safe_priority end,
      assigned_to = coalesce(assigned_to, actor_id),
      resolved_at = case
        when safe_status in ('resolved', 'closed') then coalesce(resolved_at, now())
        when safe_status <> '' then null
        else resolved_at
      end,
      updated_at = now()
  where id = target_case_id
  returning * into current_case;

  if length(trim(coalesce(update_note, ''))) >= 2 then
    insert into public.platform_support_case_notes (case_id, body, note_kind, created_by)
    values (target_case_id, trim(update_note), 'internal', actor_id);
  end if;

  perform private.write_platform_activity(
    'support_case.update',
    current_case.club_id,
    'support_case',
    current_case.id::text,
    jsonb_build_object(
      'case_number', current_case.case_number,
      'status', current_case.status,
      'priority', current_case.priority,
      'note_added', length(trim(coalesce(update_note, ''))) >= 2
    )
  );

  return to_jsonb(current_case);
end;
$$;

create or replace function public.platform_list_activity(result_limit integer default 50)
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
  perform private.require_platform_staff('support');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', event_row.id,
      'actor_user_id', event_row.actor_user_id,
      'actor_name', actor_profile.display_name,
      'club_id', event_row.club_id,
      'club_name', club.name,
      'action', event_row.action,
      'entity_type', event_row.entity_type,
      'entity_id', event_row.entity_id,
      'detail', event_row.detail,
      'created_at', event_row.created_at
    ) order by event_row.created_at desc)
    from (
      select * from public.platform_activity_events source_event
      order by source_event.created_at desc
      limit safe_limit
    ) event_row
    left join public.user_profiles actor_profile on actor_profile.id = event_row.actor_user_id
    left join public.clubs club on club.id = event_row.club_id
  ), '[]'::jsonb);
end;
$$;

-- Tighten manual subscription assignment: only platform administrators may
-- change commercial access. Support operators remain read-only.
create or replace function public.platform_set_club_subscription(
  target_club_id uuid,
  next_plan_code text,
  next_status text,
  next_billing_interval text default 'monthly',
  next_trial_ends_at timestamptz default null,
  next_grace_ends_at timestamptz default null,
  next_current_period_end timestamptz default null,
  next_cancel_at_period_end boolean default false,
  next_billing_exempt boolean default false,
  next_entitlement_overrides jsonb default '{}'::jsonb,
  next_limit_overrides jsonb default '{}'::jsonb,
  change_reason text default 'Manual platform assignment'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_plan text := lower(trim(coalesce(next_plan_code, '')));
  safe_status text := lower(trim(coalesce(next_status, '')));
  safe_interval text := lower(trim(coalesce(next_billing_interval, 'monthly')));
  previous_plan text;
  previous_status text;
begin
  perform private.require_platform_staff('admin');

  if not exists (select 1 from public.subscription_plans plan where plan.code = safe_plan and plan.status = 'active') then
    raise exception 'Unsupported subscription plan' using errcode = '22023';
  end if;
  if safe_status not in ('trialing', 'active', 'grace', 'suspended', 'cancelled', 'internal') then
    raise exception 'Unsupported subscription status' using errcode = '22023';
  end if;
  if safe_interval not in ('monthly', 'annual', 'manual') then
    raise exception 'Unsupported billing interval' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(next_entitlement_overrides, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(next_limit_overrides, '{}'::jsonb)) <> 'object' then
    raise exception 'Entitlement and limit overrides must be JSON objects' using errcode = '22023';
  end if;
  if length(trim(coalesce(change_reason, ''))) < 5 then
    raise exception 'A plan-change reason is required' using errcode = '22023';
  end if;

  select plan_code, status into previous_plan, previous_status
  from public.club_subscriptions
  where club_id = target_club_id;

  insert into public.club_subscriptions (
    club_id, plan_code, status, billing_interval, trial_ends_at, grace_ends_at,
    current_period_end, cancel_at_period_end, cancelled_at, billing_exempt,
    entitlement_overrides, limit_overrides, created_by, updated_by, metadata
  ) values (
    target_club_id, safe_plan, safe_status, safe_interval, next_trial_ends_at,
    next_grace_ends_at, next_current_period_end, coalesce(next_cancel_at_period_end, false),
    case when safe_status = 'cancelled' then now() else null end,
    coalesce(next_billing_exempt, false), coalesce(next_entitlement_overrides, '{}'::jsonb),
    coalesce(next_limit_overrides, '{}'::jsonb), actor_id, actor_id,
    jsonb_build_object('last_manual_reason', trim(change_reason))
  )
  on conflict (club_id) do update
  set plan_code = excluded.plan_code,
      status = excluded.status,
      billing_interval = excluded.billing_interval,
      trial_ends_at = excluded.trial_ends_at,
      grace_ends_at = excluded.grace_ends_at,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      cancelled_at = excluded.cancelled_at,
      billing_exempt = excluded.billing_exempt,
      entitlement_overrides = excluded.entitlement_overrides,
      limit_overrides = excluded.limit_overrides,
      updated_by = actor_id,
      metadata = public.club_subscriptions.metadata || excluded.metadata,
      updated_at = now();

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'subscription.assignment.update',
    'club_subscription',
    target_club_id::text,
    jsonb_build_object(
      'previous_plan', previous_plan,
      'next_plan', safe_plan,
      'previous_status', previous_status,
      'next_status', safe_status,
      'reason', trim(change_reason)
    ),
    'platform_admin'
  );

  perform private.write_platform_activity(
    'subscription.assignment.update',
    target_club_id,
    'club_subscription',
    target_club_id::text,
    jsonb_build_object(
      'previous_plan', previous_plan,
      'next_plan', safe_plan,
      'previous_status', previous_status,
      'next_status', safe_status,
      'reason', trim(change_reason)
    )
  );

  return public.get_club_subscription(target_club_id);
end;
$$;

revoke all on function public.get_platform_operator_context() from public, anon, authenticated;
revoke all on function public.platform_list_clubs(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.platform_get_club_detail(uuid) from public, anon, authenticated;
revoke all on function public.platform_update_club_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.platform_list_support_cases(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.platform_get_support_case(uuid) from public, anon, authenticated;
revoke all on function public.platform_create_support_case(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.platform_update_support_case(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.platform_list_activity(integer) from public, anon, authenticated;

revoke all on function private.require_platform_staff(text) from public, anon, authenticated;
revoke all on function private.write_platform_activity(text, uuid, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.get_platform_operator_context() to authenticated;
grant execute on function public.platform_list_clubs(text, text, text, integer, integer) to authenticated;
grant execute on function public.platform_get_club_detail(uuid) to authenticated;
grant execute on function public.platform_update_club_status(uuid, text, text) to authenticated;
grant execute on function public.platform_list_support_cases(uuid, text, integer) to authenticated;
grant execute on function public.platform_get_support_case(uuid) to authenticated;
grant execute on function public.platform_create_support_case(uuid, text, text, text, text) to authenticated;
grant execute on function public.platform_update_support_case(uuid, text, text, text) to authenticated;
grant execute on function public.platform_list_activity(integer) to authenticated;

-- This migration intentionally does not expose service-role credentials, allow
-- platform staff to self-authorise, or bypass owner-approved support sessions
-- for operational club data.

commit;
