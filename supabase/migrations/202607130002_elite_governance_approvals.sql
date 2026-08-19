-- Daxora Ground Control: Elite Phase 2 governance, delegated responsibility,
-- approval workflows and centrally controlled communication templates.

begin;

update public.subscription_plans
set entitlements = (
      select array_agg(distinct entitlement order by entitlement)
      from unnest(
        coalesce(entitlements, '{}'::text[]) || array[
          'approval_workflows',
          'site_responsibility',
          'communication_governance',
          'funding_portfolio',
          'enhanced_audit'
        ]::text[]
      ) entitlement
    ),
    description = 'Organisation-wide command, delegated responsibility, approval governance and executive evidence for complex multi-site clubs.',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-13.2',
      'elite_phase', 2,
      'approval_governance', true,
      'site_responsibility', true,
      'funding_portfolio', true,
      'communication_governance', true
    ),
    updated_at = now()
where code = 'elite';

create table if not exists public.elite_approval_policies (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  matchweek_approval_required boolean not null default true,
  communications_approval_required boolean not null default true,
  funding_pack_approval_required boolean not null default true,
  executive_report_approval_required boolean not null default false,
  separation_of_duties boolean not null default true,
  approval_expiry_hours integer not null default 168 check (approval_expiry_hours between 24 and 720),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.elite_site_responsibilities (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  site_id text not null check (length(trim(site_id)) between 1 and 120),
  user_id uuid not null references auth.users(id) on delete cascade,
  responsibility text not null check (responsibility in ('site_lead','site_admin','reviewer','executive_viewer')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, site_id, user_id, responsibility)
);

create index if not exists elite_site_responsibilities_club_site_idx
  on public.elite_site_responsibilities(club_id, site_id, active);
create index if not exists elite_site_responsibilities_user_idx
  on public.elite_site_responsibilities(user_id, club_id, active);

create table if not exists public.elite_approval_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  approval_type text not null check (approval_type in ('matchweek','communications','funding_pack','executive_report')),
  entity_key text not null check (length(trim(entity_key)) between 3 and 240),
  title text not null check (length(trim(title)) between 3 and 180),
  summary text not null default '',
  site_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  decision_by uuid references auth.users(id) on delete set null,
  decision_at timestamptz,
  decision_note text not null default '',
  expires_at timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists elite_approval_requests_club_status_idx
  on public.elite_approval_requests(club_id, status, requested_at desc);
create index if not exists elite_approval_requests_entity_idx
  on public.elite_approval_requests(club_id, approval_type, entity_key, status);

create table if not exists public.elite_communication_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  template_key text not null check (template_key in ('fixture_confirmed','fixture_changed','fixture_postponed','fixture_cancelled')),
  name text not null check (length(trim(name)) between 3 and 120),
  subject_template text not null check (length(trim(subject_template)) between 3 and 180),
  body_template text not null check (length(trim(body_template)) between 10 and 4000),
  active boolean not null default true,
  approval_required boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, template_key)
);

create index if not exists elite_communication_templates_club_idx
  on public.elite_communication_templates(club_id, active, template_key);

alter table public.elite_approval_policies enable row level security;
alter table public.elite_site_responsibilities enable row level security;
alter table public.elite_approval_requests enable row level security;
alter table public.elite_communication_templates enable row level security;

alter table public.elite_approval_policies force row level security;
alter table public.elite_site_responsibilities force row level security;
alter table public.elite_approval_requests force row level security;
alter table public.elite_communication_templates force row level security;

create or replace function private.can_use_elite_control(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.can_read_club(target_club_id)
    and private.club_subscription_allows_write(target_club_id)
    and private.club_has_entitlement(target_club_id, 'organisation_command'),
    false
  );
$$;

create or replace function private.can_review_elite_approval(
  target_club_id uuid,
  target_site_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.has_club_role(target_club_id, array['owner','admin'])
    or exists (
      select 1
      from public.elite_site_responsibilities responsibility
      where responsibility.club_id = target_club_id
        and responsibility.user_id = auth.uid()
        and responsibility.active = true
        and responsibility.responsibility in ('site_admin','reviewer')
        and (
          target_site_id is null
          or trim(target_site_id) = ''
          or responsibility.site_id = target_site_id
        )
    ),
    false
  );
$$;

revoke all on function private.can_use_elite_control(uuid) from public, anon, authenticated;
revoke all on function private.can_review_elite_approval(uuid, text) from public, anon, authenticated;

-- Read access remains within the club and only exists for Elite workspaces.
drop policy if exists elite_approval_policies_read on public.elite_approval_policies;
create policy elite_approval_policies_read on public.elite_approval_policies
for select to authenticated
using (public.can_read_club(club_id) and private.club_has_entitlement(club_id, 'approval_workflows'));

drop policy if exists elite_site_responsibilities_read on public.elite_site_responsibilities;
create policy elite_site_responsibilities_read on public.elite_site_responsibilities
for select to authenticated
using (public.can_read_club(club_id) and private.club_has_entitlement(club_id, 'site_responsibility'));

drop policy if exists elite_approval_requests_read on public.elite_approval_requests;
create policy elite_approval_requests_read on public.elite_approval_requests
for select to authenticated
using (public.can_read_club(club_id) and private.club_has_entitlement(club_id, 'approval_workflows'));

drop policy if exists elite_communication_templates_read on public.elite_communication_templates;
create policy elite_communication_templates_read on public.elite_communication_templates
for select to authenticated
using (public.can_read_club(club_id) and private.club_has_entitlement(club_id, 'communication_governance'));

-- All mutations are routed through security-definer functions below.
revoke all on public.elite_approval_policies from anon, authenticated;
revoke all on public.elite_site_responsibilities from anon, authenticated;
revoke all on public.elite_approval_requests from anon, authenticated;
revoke all on public.elite_communication_templates from anon, authenticated;
grant select on public.elite_approval_policies to authenticated;
grant select on public.elite_site_responsibilities to authenticated;
grant select on public.elite_approval_requests to authenticated;
grant select on public.elite_communication_templates to authenticated;

create or replace function public.save_elite_approval_policy(
  target_club_id uuid,
  policy jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  saved public.elite_approval_policies;
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'approval_workflows') then
    raise exception 'Elite approval workflows are not included in this plan' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;

  insert into public.elite_approval_policies (
    club_id,
    matchweek_approval_required,
    communications_approval_required,
    funding_pack_approval_required,
    executive_report_approval_required,
    separation_of_duties,
    approval_expiry_hours,
    created_by,
    updated_by
  ) values (
    target_club_id,
    coalesce((policy ->> 'matchweekApprovalRequired')::boolean, true),
    coalesce((policy ->> 'communicationsApprovalRequired')::boolean, true),
    coalesce((policy ->> 'fundingPackApprovalRequired')::boolean, true),
    coalesce((policy ->> 'executiveReportApprovalRequired')::boolean, false),
    coalesce((policy ->> 'separationOfDuties')::boolean, true),
    greatest(24, least(coalesce((policy ->> 'approvalExpiryHours')::integer, 168), 720)),
    actor_id,
    actor_id
  )
  on conflict (club_id) do update set
    matchweek_approval_required = excluded.matchweek_approval_required,
    communications_approval_required = excluded.communications_approval_required,
    funding_pack_approval_required = excluded.funding_pack_approval_required,
    executive_report_approval_required = excluded.executive_report_approval_required,
    separation_of_duties = excluded.separation_of_duties,
    approval_expiry_hours = excluded.approval_expiry_hours,
    updated_by = actor_id,
    updated_at = now()
  returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.approval_policy.save', 'elite_approval_policy',
    target_club_id::text, to_jsonb(saved), 'database', null
  );
  return to_jsonb(saved);
end;
$$;

create or replace function public.assign_elite_site_responsibility(
  target_club_id uuid,
  target_site_id text,
  target_user_id uuid,
  target_responsibility text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  saved public.elite_site_responsibilities;
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'site_responsibility') then
    raise exception 'Elite site responsibility is not included in this plan' using errcode = '42501';
  end if;
  if trim(coalesce(target_site_id, '')) = '' then
    raise exception 'Select a site' using errcode = '22023';
  end if;
  if target_responsibility not in ('site_lead','site_admin','reviewer','executive_viewer') then
    raise exception 'Unsupported site responsibility' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.user_id = target_user_id
      and membership.status = 'active'
  ) then
    raise exception 'The selected person is not an active club member' using errcode = '42501';
  end if;

  insert into public.elite_site_responsibilities (
    club_id, site_id, user_id, responsibility, active, created_by, updated_by
  ) values (
    target_club_id, trim(target_site_id), target_user_id, target_responsibility, true, actor_id, actor_id
  )
  on conflict (club_id, site_id, user_id, responsibility) do update set
    active = true,
    updated_by = actor_id,
    updated_at = now()
  returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.site_responsibility.assign', 'elite_site_responsibility',
    saved.id::text, to_jsonb(saved), 'database', null
  );
  return to_jsonb(saved);
end;
$$;

create or replace function public.remove_elite_site_responsibility(
  target_club_id uuid,
  responsibility_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target public.elite_site_responsibilities;
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  select * into target from public.elite_site_responsibilities
  where id = responsibility_id and club_id = target_club_id;
  if target.id is null then return false; end if;
  update public.elite_site_responsibilities
  set active = false, updated_by = actor_id, updated_at = now()
  where id = responsibility_id;
  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.site_responsibility.remove', 'elite_site_responsibility',
    responsibility_id::text, to_jsonb(target), 'database', null
  );
  return true;
end;
$$;

create or replace function public.create_elite_approval_request(
  target_club_id uuid,
  request_type text,
  request_entity_key text,
  request_title text,
  request_summary text default '',
  request_site_id text default null,
  request_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  policy public.elite_approval_policies;
  saved public.elite_approval_requests;
  expiry_hours integer := 168;
begin
  if not public.can_operate_club(target_club_id) then
    raise exception 'Operational club access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'approval_workflows') then
    raise exception 'Elite approval workflows are not included in this plan' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if request_type not in ('matchweek','communications','funding_pack','executive_report') then
    raise exception 'Unsupported approval type' using errcode = '22023';
  end if;
  if length(trim(coalesce(request_entity_key, ''))) < 3 then
    raise exception 'Approval entity key is required' using errcode = '22023';
  end if;

  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  expiry_hours := coalesce(policy.approval_expiry_hours, 168);

  update public.elite_approval_requests
  set status = 'cancelled', updated_at = now(), decision_note = 'Superseded by a newer request'
  where club_id = target_club_id
    and approval_type = request_type
    and entity_key = trim(request_entity_key)
    and status = 'pending';

  insert into public.elite_approval_requests (
    club_id, approval_type, entity_key, title, summary, site_id,
    requested_by, expires_at, snapshot
  ) values (
    target_club_id, request_type, trim(request_entity_key), trim(request_title),
    trim(coalesce(request_summary, '')), nullif(trim(coalesce(request_site_id, '')), ''),
    actor_id, now() + make_interval(hours => expiry_hours), coalesce(request_snapshot, '{}'::jsonb)
  ) returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.approval.request', 'elite_approval_request',
    saved.id::text, to_jsonb(saved), 'database', null
  );
  return to_jsonb(saved);
end;
$$;

create or replace function public.decide_elite_approval(
  target_club_id uuid,
  approval_id uuid,
  decision text,
  decision_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target public.elite_approval_requests;
  policy public.elite_approval_policies;
  saved public.elite_approval_requests;
begin
  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  select * into target from public.elite_approval_requests
  where id = approval_id and club_id = target_club_id for update;
  if target.id is null then raise exception 'Approval request not found' using errcode = 'P0002'; end if;
  if target.status <> 'pending' then raise exception 'This approval request is no longer pending' using errcode = '40900'; end if;
  if target.expires_at is not null and target.expires_at <= now() then
    update public.elite_approval_requests set status = 'expired', updated_at = now() where id = target.id;
    raise exception 'This approval request has expired' using errcode = '40900';
  end if;
  if not private.can_review_elite_approval(target_club_id, target.site_id) then
    raise exception 'Reviewer or administrator access required' using errcode = '42501';
  end if;
  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  if coalesce(policy.separation_of_duties, true) and target.requested_by = actor_id then
    raise exception 'The requester cannot approve their own item while separation of duties is enabled' using errcode = '42501';
  end if;

  update public.elite_approval_requests
  set status = decision,
      decision_by = actor_id,
      decision_at = now(),
      decision_note = trim(coalesce(decision_note, '')),
      updated_at = now()
  where id = target.id
  returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.approval.' || decision, 'elite_approval_request',
    saved.id::text, to_jsonb(saved), 'database', null
  );
  return to_jsonb(saved);
end;
$$;

create or replace function public.save_elite_communication_template(
  target_club_id uuid,
  template jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  saved public.elite_communication_templates;
  safe_key text := trim(coalesce(template ->> 'templateKey', ''));
begin
  if not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'communication_governance') then
    raise exception 'Elite communication governance is not included in this plan' using errcode = '42501';
  end if;
  if safe_key not in ('fixture_confirmed','fixture_changed','fixture_postponed','fixture_cancelled') then
    raise exception 'Unsupported communication template' using errcode = '22023';
  end if;

  insert into public.elite_communication_templates (
    club_id, template_key, name, subject_template, body_template,
    active, approval_required, created_by, updated_by
  ) values (
    target_club_id,
    safe_key,
    trim(coalesce(template ->> 'name', 'Communication template')),
    trim(coalesce(template ->> 'subjectTemplate', 'Fixture update')),
    trim(coalesce(template ->> 'bodyTemplate', 'Review the latest fixture details in Ground Control.')),
    coalesce((template ->> 'active')::boolean, true),
    coalesce((template ->> 'approvalRequired')::boolean, true),
    actor_id,
    actor_id
  )
  on conflict (club_id, template_key) do update set
    name = excluded.name,
    subject_template = excluded.subject_template,
    body_template = excluded.body_template,
    active = excluded.active,
    approval_required = excluded.approval_required,
    updated_by = actor_id,
    updated_at = now()
  returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.communication_template.save', 'elite_communication_template',
    saved.id::text, jsonb_build_object('template_key', saved.template_key, 'active', saved.active, 'approval_required', saved.approval_required),
    'database', null
  );
  return to_jsonb(saved);
end;
$$;

-- Server-side gate used by web communication dispatch. Pro is unaffected;
-- Elite is blocked only when its saved policy explicitly requires approval.
create or replace function public.assert_elite_communication_approval(
  target_club_id uuid,
  request_entity_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  policy public.elite_approval_policies;
begin
  if not private.club_has_entitlement(target_club_id, 'communication_governance') then
    return true;
  end if;
  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  if not coalesce(policy.communications_approval_required, true) then return true; end if;
  if exists (
    select 1 from public.elite_approval_requests approval
    where approval.club_id = target_club_id
      and approval.approval_type = 'communications'
      and approval.entity_key = trim(request_entity_key)
      and approval.status = 'approved'
      and (approval.expires_at is null or approval.expires_at > now())
  ) then return true; end if;
  raise exception 'Elite communication approval is required before this batch can be sent' using errcode = '42501';
end;
$$;


-- Re-establish matchweek publication with an Elite-only server-side approval
-- gate. Core and Pro keep their existing publication behaviour.
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
  policy public.elite_approval_policies;
  approval_key text := nullif(trim(coalesce(history_data ->> 'approvalEntityKey', '')), '');
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

  if private.club_has_entitlement(target_club_id, 'approval_workflows') then
    select * into policy from public.elite_approval_policies where club_id = target_club_id;
    if coalesce(policy.matchweek_approval_required, true) then
      if approval_key is null then
        raise exception 'Elite matchweek approval reference is required' using errcode = '42501';
      end if;
      if not exists (
        select 1 from public.elite_approval_requests approval
        where approval.club_id = target_club_id
          and approval.approval_type = 'matchweek'
          and approval.entity_key = approval_key
          and approval.status = 'approved'
          and (approval.expires_at is null or approval.expires_at > now())
      ) then
        raise exception 'Elite matchweek approval is required before publication' using errcode = '42501';
      end if;
    end if;
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
      'fixture_day_count', day_count,
      'approval_entity_key', approval_key
    ),
    'database'
  );
end;
$$;

grant execute on function public.save_elite_approval_policy(uuid, jsonb) to authenticated;
grant execute on function public.assign_elite_site_responsibility(uuid, text, uuid, text) to authenticated;
grant execute on function public.remove_elite_site_responsibility(uuid, uuid) to authenticated;
grant execute on function public.create_elite_approval_request(uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.decide_elite_approval(uuid, uuid, text, text) to authenticated;
grant execute on function public.save_elite_communication_template(uuid, jsonb) to authenticated;
grant execute on function public.assert_elite_communication_approval(uuid, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
