-- Ground Control Daxora-admin and support-tooling proof (staging/local Supabase only).
--
-- Apply migrations through 202607030005 first.
-- Replace PLATFORM_ADMIN_USER, PLATFORM_SUPPORT_USER and TARGET_CLUB below with
-- real UUIDs. The admin and support users must already exist in auth.users and
-- public.platform_support_staff. Every data change in this proof is rolled back.

begin;

create temp table gc_platform_test_context (
  admin_user_id uuid not null,
  support_user_id uuid not null,
  club_id uuid not null,
  case_id uuid
) on commit drop;

grant select, update on gc_platform_test_context to authenticated;

insert into gc_platform_test_context (admin_user_id, support_user_id, club_id)
values (
  '00000000-0000-0000-0000-000000000001', -- REPLACE WITH PLATFORM_ADMIN_USER
  '00000000-0000-0000-0000-000000000002', -- REPLACE WITH PLATFORM_SUPPORT_USER
  '00000000-0000-0000-0000-000000000003'  -- REPLACE WITH TARGET_CLUB
);

do $$
begin
  if not exists (
    select 1
    from public.platform_support_staff staff
    where staff.user_id = (select admin_user_id from gc_platform_test_context)
      and staff.status = 'active'
      and staff.platform_role = 'admin'
  ) then
    raise exception 'Replace PLATFORM_ADMIN_USER with an active platform administrator UUID';
  end if;

  if not exists (
    select 1
    from public.platform_support_staff staff
    where staff.user_id = (select support_user_id from gc_platform_test_context)
      and staff.status = 'active'
      and staff.platform_role = 'support'
  ) then
    raise exception 'Replace PLATFORM_SUPPORT_USER with an active support operator UUID';
  end if;

  if not exists (
    select 1 from public.clubs club
    where club.id = (select club_id from gc_platform_test_context)
  ) then
    raise exception 'Replace TARGET_CLUB with an existing club UUID';
  end if;
end $$;

-- Support operators can view platform metadata and open a support case.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select support_user_id from gc_platform_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.get_platform_operator_context();
select public.platform_list_clubs('', '', '', 10, 0);

update gc_platform_test_context context
set case_id = created.id
from (
  select (public.platform_create_support_case(
    (select club_id from gc_platform_test_context),
    'Staging support security proof',
    'This case exists only inside a rolled-back security proof.',
    'normal',
    null
  ) ->> 'id')::uuid as id
) created;

select public.platform_update_support_case(
  (select case_id from gc_platform_test_context),
  'investigating',
  'high',
  'Support operator added an audited internal note.'
);

-- Support operators cannot suspend a club or assign commercial access.
do $$
begin
  begin
    perform public.platform_update_club_status(
      (select club_id from gc_platform_test_context),
      'suspended',
      'Support operator must not be able to suspend a club'
    );
    raise exception 'Security failure: support operator changed club status';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.platform_set_club_subscription(
      (select club_id from gc_platform_test_context),
      'elite',
      'internal',
      'manual',
      null,
      null,
      null,
      false,
      true,
      '{}'::jsonb,
      '{}'::jsonb,
      'Support operator must not assign plans'
    );
    raise exception 'Security failure: support operator changed a subscription';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

-- Platform administrators can perform the guarded commercial/status actions.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select admin_user_id from gc_platform_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.platform_set_club_subscription(
  (select club_id from gc_platform_test_context),
  'core',
  'active',
  'monthly',
  null,
  null,
  null,
  false,
  false,
  '{}'::jsonb,
  '{}'::jsonb,
  'Staging security proof for administrator plan assignment'
);

select public.platform_update_club_status(
  (select club_id from gc_platform_test_context),
  'suspended',
  'Staging security proof for administrator suspension'
);

select public.platform_update_club_status(
  (select club_id from gc_platform_test_context),
  'active',
  'Restore club after staging security proof'
);

-- Platform status does not bypass the owner-approved operational support session.
do $$
declare
  visible_history integer;
begin
  select count(*) into visible_history
  from public.history
  where club_id = (select club_id from gc_platform_test_context);

  if visible_history <> 0 and not public.can_read_club((select club_id from gc_platform_test_context)) then
    raise exception 'Security failure: platform administrator read operational history without club access';
  end if;
end $$;

reset role;
rollback;
