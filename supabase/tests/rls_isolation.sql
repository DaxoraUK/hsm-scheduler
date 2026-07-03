-- Ground Control RLS isolation proof (staging/local Supabase only).
--
-- Replace USER_A and USER_B below with two real UUIDs from auth.users.
-- The script creates two clubs inside a transaction, proves select/insert/update/
-- delete isolation as the authenticated role, and rolls back every test record.

begin;

create temp table gc_rls_test_context (
  user_a uuid not null,
  user_b uuid not null,
  organisation_id uuid,
  club_a uuid,
  club_b uuid
) on commit drop;

grant select, update on gc_rls_test_context to authenticated;

insert into gc_rls_test_context (user_a, user_b)
values (
  '00000000-0000-0000-0000-000000000001', -- REPLACE WITH USER_A
  '00000000-0000-0000-0000-000000000002'  -- REPLACE WITH USER_B
);

do $$
begin
  if not exists (
    select 1 from auth.users where id = (select user_a from gc_rls_test_context)
  ) or not exists (
    select 1 from auth.users where id = (select user_b from gc_rls_test_context)
  ) then
    raise exception 'Replace USER_A and USER_B with two real auth.users UUIDs before running this test';
  end if;
end $$;

update gc_rls_test_context
set organisation_id = gen_random_uuid(),
    club_a = gen_random_uuid(),
    club_b = gen_random_uuid();

insert into public.organisations (id, name, slug, organisation_type)
select organisation_id, 'RLS Test Organisation', 'rls-test-' || left(organisation_id::text, 8), 'club_operator'
from gc_rls_test_context;

insert into public.clubs (id, organisation_id, name, slug)
select club_a, organisation_id, 'RLS Test Club A', 'rls-club-a-' || left(club_a::text, 8)
from gc_rls_test_context
union all
select club_b, organisation_id, 'RLS Test Club B', 'rls-club-b-' || left(club_b::text, 8)
from gc_rls_test_context;

insert into public.club_memberships (club_id, user_id, role, status)
select club_a, user_a, 'owner', 'active' from gc_rls_test_context
union all
select club_b, user_b, 'owner', 'active' from gc_rls_test_context;

insert into public.history (club_id, id, data)
select club_a, 'rls-seed-a', '{"club":"A"}'::jsonb from gc_rls_test_context
union all
select club_b, 'rls-seed-b', '{"club":"B"}'::jsonb from gc_rls_test_context;

-- Act as User A.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_a from gc_rls_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  own_rows integer;
  other_rows integer;
  own_clubs integer;
  other_clubs integer;
begin
  select count(*) into own_rows
  from public.history
  where club_id = (select club_a from gc_rls_test_context);

  select count(*) into other_rows
  from public.history
  where club_id = (select club_b from gc_rls_test_context);

  select count(*) into own_clubs
  from public.clubs
  where id = (select club_a from gc_rls_test_context);

  select count(*) into other_clubs
  from public.clubs
  where id = (select club_b from gc_rls_test_context);

  if own_rows <> 1 then
    raise exception 'RLS failure: User A cannot read Club A history';
  end if;
  if other_rows <> 0 then
    raise exception 'RLS failure: User A can read Club B history';
  end if;
  if own_clubs <> 1 then
    raise exception 'RLS failure: User A cannot read Club A metadata';
  end if;
  if other_clubs <> 0 then
    raise exception 'RLS failure: User A can read Club B metadata';
  end if;
end $$;

insert into public.history (club_id, id, data)
select club_a, 'rls-user-a-own-write', '{"allowed":true}'::jsonb
from gc_rls_test_context;

do $$
declare
  affected integer;
begin
  begin
    insert into public.history (club_id, id, data)
    select club_b, 'rls-user-a-cross-insert', '{"allowed":false}'::jsonb
    from gc_rls_test_context;

    raise exception 'RLS failure: User A inserted a Club B history row';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;

  update public.history
  set data = '{"tampered":true}'::jsonb
  where club_id = (select club_b from gc_rls_test_context)
    and id = 'rls-seed-b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS failure: User A updated Club B history';
  end if;

  delete from public.history
  where club_id = (select club_b from gc_rls_test_context)
    and id = 'rls-seed-b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS failure: User A deleted Club B history';
  end if;

  begin
    insert into public.club_memberships (club_id, user_id, role, status)
    select club_b, user_a, 'owner', 'active'
    from gc_rls_test_context;

    raise exception 'RLS failure: User A created a Club B membership';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;
end $$;

reset role;

-- Verify as the SQL editor role that blocked mutations never landed.
do $$
begin
  if exists (
    select 1 from public.history
    where club_id = (select club_b from gc_rls_test_context)
      and id = 'rls-user-a-cross-insert'
  ) then
    raise exception 'RLS failure: blocked Club B insert exists';
  end if;

  if not exists (
    select 1 from public.history
    where club_id = (select club_b from gc_rls_test_context)
      and id = 'rls-seed-b'
      and data = '{"club":"B"}'::jsonb
  ) then
    raise exception 'RLS failure: Club B seed was changed or deleted by User A';
  end if;

  if exists (
    select 1 from public.club_memberships
    where club_id = (select club_b from gc_rls_test_context)
      and user_id = (select user_a from gc_rls_test_context)
  ) then
    raise exception 'RLS failure: blocked Club B membership exists';
  end if;
end $$;

-- Act as User B and prove the inverse boundary.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select user_b from gc_rls_test_context)::text,
    'role', 'authenticated'
  )::text,
  true
);

do $$
declare
  own_rows integer;
  other_rows integer;
begin
  select count(*) into own_rows
  from public.history
  where club_id = (select club_b from gc_rls_test_context);

  select count(*) into other_rows
  from public.history
  where club_id = (select club_a from gc_rls_test_context);

  if own_rows <> 1 then
    raise exception 'RLS failure: User B cannot read Club B history';
  end if;
  if other_rows <> 0 then
    raise exception 'RLS failure: User B can read Club A history';
  end if;
end $$;

insert into public.history (club_id, id, data)
select club_b, 'rls-user-b-own-write', '{"allowed":true}'::jsonb
from gc_rls_test_context;

do $$
begin
  begin
    insert into public.history (club_id, id, data)
    select club_a, 'rls-user-b-cross-insert', '{"allowed":false}'::jsonb
    from gc_rls_test_context;

    raise exception 'RLS failure: User B inserted a Club A history row';
  exception
    when insufficient_privilege or check_violation then
      null;
  end;
end $$;

reset role;

do $$
begin
  if exists (
    select 1 from public.history
    where club_id = (select club_a from gc_rls_test_context)
      and id = 'rls-user-b-cross-insert'
  ) then
    raise exception 'RLS failure: blocked Club A insert exists';
  end if;
end $$;

select 'PASS: cross-club select, insert, update, delete and membership boundaries are isolated' as result;
rollback;
