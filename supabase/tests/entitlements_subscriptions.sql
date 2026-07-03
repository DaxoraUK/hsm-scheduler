-- Ground Control entitlement and subscription enforcement proof.
-- Staging/local Supabase only. Apply migrations through 202607030004 first.
--
-- Replace USER_A and USER_B below with two real UUIDs from auth.users.
-- USER_A acts as the club owner. USER_B acts as temporary Daxora platform
-- staff. All records and staff changes are rolled back at the end.

begin;

create temp table gc_subscription_test_context (
  owner_user_id uuid not null,
  staff_user_id uuid not null,
  organisation_id uuid,
  club_id uuid
) on commit drop;

grant select, update on gc_subscription_test_context to authenticated;

insert into gc_subscription_test_context (owner_user_id, staff_user_id)
values (
  '00000000-0000-0000-0000-000000000001', -- REPLACE WITH USER_A
  '00000000-0000-0000-0000-000000000002'  -- REPLACE WITH USER_B
);

do $$
begin
  if not exists (
    select 1 from auth.users where id = (select owner_user_id from gc_subscription_test_context)
  ) or not exists (
    select 1 from auth.users where id = (select staff_user_id from gc_subscription_test_context)
  ) then
    raise exception 'Replace USER_A and USER_B with two real auth.users UUIDs before running this test';
  end if;
end $$;

update gc_subscription_test_context
set organisation_id = gen_random_uuid(),
    club_id = gen_random_uuid();

insert into public.organisations (id, name, slug, organisation_type)
select organisation_id,
       'Subscription Test Organisation',
       'subscription-test-' || left(organisation_id::text, 8),
       'club_operator'
from gc_subscription_test_context;

insert into public.clubs (id, organisation_id, name, slug, created_by)
select club_id,
       organisation_id,
       'Subscription Test Club',
       'subscription-test-club-' || left(club_id::text, 8),
       owner_user_id
from gc_subscription_test_context;

insert into public.club_memberships (club_id, user_id, role, status, created_by)
select club_id, owner_user_id, 'owner', 'active', owner_user_id
from gc_subscription_test_context;

insert into public.platform_support_staff (user_id, display_name, status, created_by)
select staff_user_id, 'Subscription Test Staff', 'active', owner_user_id
from gc_subscription_test_context
on conflict (user_id) do update
set display_name = excluded.display_name,
    status = 'active',
    updated_at = now();

-- A new club receives the default Core trial.
do $$
declare
  subscription public.club_subscriptions%rowtype;
begin
  select * into subscription
  from public.club_subscriptions
  where club_id = (select club_id from gc_subscription_test_context);

  if subscription.plan_code <> 'core' or subscription.status <> 'trialing' then
    raise exception 'Subscription failure: new club did not receive the Core trial';
  end if;
  if subscription.trial_ends_at is null or subscription.trial_ends_at <= now() then
    raise exception 'Subscription failure: Core trial has no valid expiry';
  end if;
end $$;

-- Club owners can read their subscription, but cannot assign commercial plans.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  payload jsonb;
begin
  payload := public.get_club_subscription((select club_id from gc_subscription_test_context));
  if payload ->> 'plan_code' <> 'core' or payload ->> 'access_state' <> 'full' then
    raise exception 'Subscription failure: owner cannot read the active Core trial';
  end if;

  begin
    perform public.platform_set_club_subscription(
      (select club_id from gc_subscription_test_context),
      'link', 'active', 'manual', null, null, null, false, true,
      '{}'::jsonb, '{}'::jsonb, 'Owner must not change plan'
    );
    raise exception 'Subscription failure: club owner changed the commercial plan';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

-- Active Daxora staff can assign Link through the guarded platform RPC.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select staff_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.platform_set_club_subscription(
  (select club_id from gc_subscription_test_context),
  'link', 'active', 'manual', null, null, null, false, true,
  '{}'::jsonb, '{}'::jsonb, 'Entitlement enforcement test'
);

reset role;

-- Link permits league/communication foundations but not matchday publishing.
-- It also enforces four teams, one venue and three reserved user places.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  payload jsonb;
  team_count integer;
begin
  payload := public.get_club_subscription((select club_id from gc_subscription_test_context));
  if payload ->> 'plan_code' <> 'link' or payload ->> 'plan_name' <> 'Link' then
    raise exception 'Subscription failure: Link assignment was not returned';
  end if;
  if not ((payload -> 'entitlements') ? 'league_link') then
    raise exception 'Subscription failure: Link is missing league_link';
  end if;
  if (payload -> 'entitlements') ? 'matchday_scheduling' then
    raise exception 'Subscription failure: Link incorrectly includes matchday_scheduling';
  end if;

  begin
    perform public.save_matchweek_history(
      (select club_id from gc_subscription_test_context),
      'subscription-link-blocked-history',
      '{"fixtureDays":[]}'::jsonb,
      now()
    );
    raise exception 'Entitlement failure: Link published matchday history';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  perform public.replace_club_collection(
    (select club_id from gc_subscription_test_context),
    'team_config',
    '[
      {"id":"team-1","data":{"name":"Team 1"}},
      {"id":"team-2","data":{"name":"Team 2"}},
      {"id":"team-3","data":{"name":"Team 3"}},
      {"id":"team-4","data":{"name":"Team 4"}}
    ]'::jsonb
  );

  select count(*) into team_count
  from public.team_config
  where club_id = (select club_id from gc_subscription_test_context);
  if team_count <> 4 then
    raise exception 'Limit failure: Link did not retain four teams';
  end if;

  begin
    perform public.replace_club_collection(
      (select club_id from gc_subscription_test_context),
      'team_config',
      '[
        {"id":"team-1","data":{}},
        {"id":"team-2","data":{}},
        {"id":"team-3","data":{}},
        {"id":"team-4","data":{}},
        {"id":"team-5","data":{}}
      ]'::jsonb
    );
    raise exception 'Limit failure: Link accepted a fifth team';
  exception
    when check_violation then null;
  end;

  begin
    perform public.save_club_configuration(
      (select club_id from gc_subscription_test_context),
      '{"name":"Subscription Test Club","sites":[{"id":"one"},{"id":"two"}]}'::jsonb
    );
    raise exception 'Limit failure: Link accepted a second venue';
  exception
    when check_violation then null;
  end;
end $$;

select public.create_club_invitation(
  (select club_id from gc_subscription_test_context),
  'subscription-test-one@example.invalid',
  'viewer',
  24
);
select public.create_club_invitation(
  (select club_id from gc_subscription_test_context),
  'subscription-test-two@example.invalid',
  'viewer',
  24
);

do $$
begin
  begin
    perform public.create_club_invitation(
      (select club_id from gc_subscription_test_context),
      'subscription-test-three@example.invalid',
      'viewer',
      24
    );
    raise exception 'Limit failure: Link reserved a fourth user place';
  exception
    when check_violation then null;
  end;
end $$;

reset role;

-- Move to active Core and prove matchday publishing becomes available.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select staff_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);
select public.platform_set_club_subscription(
  (select club_id from gc_subscription_test_context),
  'core', 'active', 'manual', null, null, now() + interval '1 month', false, true,
  '{}'::jsonb, '{}'::jsonb, 'Core publishing test'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

select public.save_matchweek_history(
  (select club_id from gc_subscription_test_context),
  'subscription-core-allowed-history',
  '{"dateLabel":"Core Test","fixtureDays":[]}'::jsonb,
  now()
);

reset role;

-- Suspended clubs remain readable but database mutations are rejected.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select staff_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);
select public.platform_set_club_subscription(
  (select club_id from gc_subscription_test_context),
  'core', 'suspended', 'manual', null, null, null, false, false,
  '{}'::jsonb, '{}'::jsonb, 'Suspension read-only test'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select owner_user_id from gc_subscription_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  payload jsonb;
begin
  payload := public.get_club_subscription((select club_id from gc_subscription_test_context));
  if payload ->> 'access_state' <> 'read_only' then
    raise exception 'Subscription failure: suspended club is not read only';
  end if;

  begin
    perform public.save_club_configuration(
      (select club_id from gc_subscription_test_context),
      '{"name":"Suspended Write Must Fail"}'::jsonb
    );
    raise exception 'Subscription failure: suspended club changed configuration';
  exception
    when insufficient_privilege or check_violation then null;
  end;
end $$;

reset role;

-- SQL-editor verification of the effects and blocked writes.
do $$
begin
  if not exists (
    select 1 from public.history
    where club_id = (select club_id from gc_subscription_test_context)
      and id = 'subscription-core-allowed-history'
  ) then
    raise exception 'Entitlement failure: Core history write did not land';
  end if;

  if exists (
    select 1 from public.history
    where club_id = (select club_id from gc_subscription_test_context)
      and id = 'subscription-link-blocked-history'
  ) then
    raise exception 'Entitlement failure: blocked Link history write landed';
  end if;

  if (select count(*) from public.team_config where club_id = (select club_id from gc_subscription_test_context)) <> 4 then
    raise exception 'Limit failure: failed fifth-team replacement changed the four saved teams';
  end if;

  if (select count(*) from public.club_invitations where club_id = (select club_id from gc_subscription_test_context) and status = 'pending') <> 2 then
    raise exception 'Limit failure: blocked fourth user place was persisted';
  end if;
end $$;

rollback;
