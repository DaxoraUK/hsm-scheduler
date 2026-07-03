-- Ground Control role, audit and support proof (staging/local Supabase only).
--
-- Apply migrations 202607030001 and 202607030002 first.
-- Replace USER_A and USER_B below with two real UUIDs from auth.users.
-- USER_A acts as the club owner. USER_B is moved through admin, scheduler,
-- viewer and registered Daxora-support access. Every test row is rolled back.

begin;

create temp table gc_role_test_context (
  owner_user_id uuid not null,
  second_user_id uuid not null,
  second_user_email text,
  organisation_id uuid,
  club_id uuid,
  support_session_id uuid
) on commit drop;

grant select, update on gc_role_test_context to authenticated;

insert into gc_role_test_context (owner_user_id, second_user_id)
values (
  '00000000-0000-0000-0000-000000000001', -- REPLACE WITH USER_A
  '00000000-0000-0000-0000-000000000002'  -- REPLACE WITH USER_B
);

do $$
begin
  if not exists (
    select 1 from auth.users where id = (select owner_user_id from gc_role_test_context)
  ) or not exists (
    select 1 from auth.users where id = (select second_user_id from gc_role_test_context)
  ) then
    raise exception 'Replace USER_A and USER_B with two real auth.users UUIDs before running this test';
  end if;
end $$;

update gc_role_test_context context
set organisation_id = gen_random_uuid(),
    club_id = gen_random_uuid(),
    second_user_email = lower(user_row.email)
from auth.users user_row
where user_row.id = context.second_user_id;

insert into public.organisations (id, name, slug, organisation_type)
select organisation_id,
       'Role Test Organisation',
       'role-test-' || left(organisation_id::text, 8),
       'club_operator'
from gc_role_test_context;

insert into public.clubs (id, organisation_id, name, slug)
select club_id,
       organisation_id,
       'Role Test Club',
       'role-test-club-' || left(club_id::text, 8)
from gc_role_test_context;

insert into public.club_memberships (club_id, user_id, role, status)
select club_id, owner_user_id, 'owner', 'active' from gc_role_test_context
union all
select club_id, second_user_id, 'viewer', 'active' from gc_role_test_context;

insert into public.history (club_id, id, data)
select club_id, 'role-test-seed', '{"seed":true}'::jsonb
from gc_role_test_context;

-- Owner changes USER_B to Administrator through the guarded RPC.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.update_club_member_role(
  (select club_id from gc_role_test_context),
  (select second_user_id from gc_role_test_context),
  'admin'
);

reset role;

do $$
begin
  if not exists (
    select 1 from public.club_memberships
    where club_id = (select club_id from gc_role_test_context)
      and user_id = (select second_user_id from gc_role_test_context)
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception 'Role failure: owner could not promote USER_B to administrator';
  end if;
end $$;

-- Administrator can save configuration, but cannot transfer ownership or grant support.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select second_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.save_club_configuration(
  (select club_id from gc_role_test_context),
  '{"name":"Role Test Club Updated"}'::jsonb
);

do $$
begin
  begin
    perform public.transfer_club_ownership(
      (select club_id from gc_role_test_context),
      (select owner_user_id from gc_role_test_context)
    );
    raise exception 'Role failure: administrator transferred ownership';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.grant_support_access(
      (select club_id from gc_role_test_context),
      (select second_user_email from gc_role_test_context),
      30,
      'Role test support request'
    );
    raise exception 'Role failure: administrator granted support access';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

-- Owner changes USER_B to Scheduler.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);
select public.update_club_member_role(
  (select club_id from gc_role_test_context),
  (select second_user_id from gc_role_test_context),
  'scheduler'
);
reset role;

-- Scheduler can publish a matchweek but cannot manage settings or members.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select second_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.save_matchweek_history(
  (select club_id from gc_role_test_context),
  'role-test-scheduler-publish',
  '{"dateLabel":"Scheduler Test","fixtureDays":[]}'::jsonb,
  now()
);

do $$
begin
  begin
    perform public.save_club_configuration(
      (select club_id from gc_role_test_context),
      '{"name":"Scheduler Must Not Save This"}'::jsonb
    );
    raise exception 'Role failure: scheduler changed club settings';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.list_club_members((select club_id from gc_role_test_context));
    raise exception 'Role failure: scheduler listed club members';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.history (club_id, id, data)
    select club_id, 'role-test-direct-write', '{}'::jsonb from gc_role_test_context;
    raise exception 'Audit failure: scheduler bypassed the audited history RPC';
  exception
    when insufficient_privilege or check_violation then null;
  end;
end $$;

reset role;

-- Owner changes USER_B to Viewer.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);
select public.update_club_member_role(
  (select club_id from gc_role_test_context),
  (select second_user_id from gc_role_test_context),
  'viewer'
);
reset role;

-- Viewer can read but cannot publish.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select second_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows
  from public.history
  where club_id = (select club_id from gc_role_test_context);

  if visible_rows < 2 then
    raise exception 'Role failure: viewer cannot read club history';
  end if;

  begin
    perform public.save_matchweek_history(
      (select club_id from gc_role_test_context),
      'role-test-viewer-publish',
      '{}'::jsonb,
      now()
    );
    raise exception 'Role failure: viewer published a matchweek';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

-- Convert USER_B into a registered support identity with no club membership.
update public.club_memberships
set status = 'revoked', updated_at = now()
where club_id = (select club_id from gc_role_test_context)
  and user_id = (select second_user_id from gc_role_test_context);

insert into public.platform_support_staff (user_id, display_name, status, created_by)
select second_user_id, 'Ground Control Test Support', 'active', owner_user_id
from gc_role_test_context
on conflict (user_id) do update
set display_name = excluded.display_name,
    status = 'active',
    updated_at = now();

-- Only the owner grants the time-limited session.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

update gc_role_test_context
set support_session_id = (
  public.grant_support_access(
    club_id,
    second_user_email,
    30,
    'Investigate role test workspace'
  ) ->> 'id'
)::uuid;

reset role;

-- Support sees the workspace with its own identity, but remains read-only.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select second_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  visible_rows integer;
  workspace_rows jsonb;
begin
  select count(*) into visible_rows
  from public.history
  where club_id = (select club_id from gc_role_test_context);

  if visible_rows < 2 then
    raise exception 'Support failure: active support cannot read club history';
  end if;

  workspace_rows := public.list_accessible_workspaces();
  if not exists (
    select 1
    from jsonb_array_elements(workspace_rows) item
    where item ->> 'club_id' = (select club_id from gc_role_test_context)::text
      and item ->> 'access_mode' = 'support'
      and (item ->> 'read_only')::boolean = true
  ) then
    raise exception 'Support failure: support workspace was not returned as read-only';
  end if;

  begin
    perform public.save_matchweek_history(
      (select club_id from gc_role_test_context),
      'role-test-support-publish',
      '{}'::jsonb,
      now()
    );
    raise exception 'Support failure: support published a matchweek';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.list_audit_events((select club_id from gc_role_test_context), 20);
    raise exception 'Support failure: support opened the administrator audit log';
  exception
    when insufficient_privilege then null;
  end;
end $$;

select public.record_support_workspace_open(
  (select club_id from gc_role_test_context),
  (select support_session_id from gc_role_test_context)
);

reset role;

-- Owner revokes support, which must immediately remove the RLS read path.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);
select public.revoke_support_access(
  (select club_id from gc_role_test_context),
  (select support_session_id from gc_role_test_context)
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select second_user_id from gc_role_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows
  from public.history
  where club_id = (select club_id from gc_role_test_context);

  if visible_rows <> 0 then
    raise exception 'Support failure: revoked support can still read club history';
  end if;
end $$;

reset role;

-- Confirm server-side attribution captured the actual roles used for each action.
do $$
begin
  if not exists (
    select 1 from public.audit_events
    where club_id = (select club_id from gc_role_test_context)
      and actor_user_id = (select second_user_id from gc_role_test_context)
      and actor_role = 'admin'
      and action = 'settings.club_config.save'
  ) then
    raise exception 'Audit failure: administrator settings event was not attributed server-side';
  end if;

  if not exists (
    select 1 from public.audit_events
    where club_id = (select club_id from gc_role_test_context)
      and actor_user_id = (select second_user_id from gc_role_test_context)
      and actor_role = 'scheduler'
      and action = 'matchweek.publish'
  ) then
    raise exception 'Audit failure: scheduler publish event was not attributed server-side';
  end if;

  if not exists (
    select 1 from public.audit_events
    where club_id = (select club_id from gc_role_test_context)
      and actor_user_id = (select second_user_id from gc_role_test_context)
      and actor_role = 'support'
      and action = 'support.workspace.open'
      and support_session_id = (select support_session_id from gc_role_test_context)
  ) then
    raise exception 'Audit failure: support workspace open was not attributed to the support session';
  end if;
end $$;

select 'PASS: owner, administrator, scheduler, viewer, audited writes and support revocation are enforced' as result;
rollback;
