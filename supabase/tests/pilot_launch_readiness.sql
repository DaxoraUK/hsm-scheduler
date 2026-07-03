-- Ground Control pilot/launch readiness proof (staging or local Supabase only).
-- Apply migrations through 202607030007 first. Replace the UUID placeholders.
-- Every data change is rolled back.

begin;

create temp table gc_launch_test_context (
  admin_user_id uuid not null,
  support_user_id uuid not null,
  club_user_id uuid not null,
  club_id uuid not null,
  event_id uuid
) on commit drop;

grant select, update on gc_launch_test_context to authenticated;

insert into gc_launch_test_context values (
  '00000000-0000-0000-0000-000000000001', -- PLATFORM_ADMIN_USER
  '00000000-0000-0000-0000-000000000002', -- PLATFORM_SUPPORT_USER
  '00000000-0000-0000-0000-000000000003', -- ACTIVE_CLUB_USER
  '00000000-0000-0000-0000-000000000004', -- TARGET_CLUB
  null
);

-- A normal club user can update only their own display name and record telemetry
-- for a workspace they can access.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select club_user_id from gc_launch_test_context)::text, 'role', 'authenticated')::text,
  true
);

select public.update_my_profile('Pilot Security Test User');

update gc_launch_test_context context
set event_id = public.record_client_event(
  context.club_id,
  'error',
  'manual_report',
  'Rolled-back pilot launch security proof',
  'GC-SECURITY-PROOF',
  '/settings',
  'security-proof',
  'staging',
  '{"routeState":"safe","token":"must-be-removed"}'::jsonb
);

-- A normal user cannot see or update platform launch controls.
do $$
begin
  begin
    perform public.platform_get_pilot_launch_readiness();
    raise exception 'Security failure: normal club user read platform launch controls';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.platform_update_launch_gate('production_smoke_test', 'ready', 'not allowed', 'user', null);
    raise exception 'Security failure: normal club user changed a launch gate';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Support can view launch readiness and resolve telemetry, but cannot alter gates or pilots.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select support_user_id from gc_launch_test_context)::text, 'role', 'authenticated')::text,
  true
);

select public.platform_get_pilot_launch_readiness();
select public.platform_resolve_client_event((select event_id from gc_launch_test_context), 'Reviewed in staging proof');

do $$
begin
  begin
    perform public.platform_update_launch_gate('production_smoke_test', 'ready', 'not allowed', 'support', null);
    raise exception 'Security failure: support operator changed a launch gate';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.platform_upsert_pilot(
      (select club_id from gc_launch_test_context),
      'candidate', 'on_track', null, null, null, '', '{}'::jsonb
    );
    raise exception 'Security failure: support operator changed a pilot record';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Platform administrators can maintain launch gates and pilot records.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select admin_user_id from gc_launch_test_context)::text, 'role', 'authenticated')::text,
  true
);

select public.platform_update_launch_gate(
  'production_smoke_test',
  'in_progress',
  'Staging security proof only',
  'Platform administrator',
  current_date + 7
);

select public.platform_upsert_pilot(
  (select club_id from gc_launch_test_context),
  'validation',
  'on_track',
  (select admin_user_id from gc_launch_test_context),
  current_date + 7,
  current_date + 28,
  'Rolled-back staging proof',
  '{"owner_confirmed":true}'::jsonb
);

reset role;
rollback;
