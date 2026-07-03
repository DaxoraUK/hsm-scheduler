-- Ground Control billing/legal security proof.
-- Staging/local Supabase only. Apply migrations through 202607030006 first.
-- Replace USER_A and USER_B with real auth.users UUIDs. Everything is rolled back.

begin;

create temp table gc_billing_test_context (
  owner_user_id uuid not null,
  admin_user_id uuid not null,
  organisation_id uuid default gen_random_uuid(),
  club_id uuid default gen_random_uuid()
) on commit drop;

grant select, update on gc_billing_test_context to authenticated;

insert into gc_billing_test_context (owner_user_id, admin_user_id)
values (
  '00000000-0000-0000-0000-000000000001', -- REPLACE WITH USER_A
  '00000000-0000-0000-0000-000000000002'  -- REPLACE WITH USER_B
);

do $$
begin
  if not exists (select 1 from auth.users where id = (select owner_user_id from gc_billing_test_context))
     or not exists (select 1 from auth.users where id = (select admin_user_id from gc_billing_test_context)) then
    raise exception 'Replace USER_A and USER_B with real auth.users UUIDs before running this test';
  end if;
end $$;

insert into public.organisations (id, name, slug, organisation_type)
select organisation_id, 'Billing Test Organisation', 'billing-test-' || left(organisation_id::text, 8), 'club_operator'
from gc_billing_test_context;

insert into public.clubs (id, organisation_id, name, slug, created_by)
select club_id, organisation_id, 'Billing Test Club', 'billing-test-club-' || left(club_id::text, 8), owner_user_id
from gc_billing_test_context;

insert into public.club_memberships (club_id, user_id, role, status, created_by)
select club_id, owner_user_id, 'owner', 'active', owner_user_id
from gc_billing_test_context;

insert into public.platform_support_staff (user_id, display_name, status, created_by, platform_role)
select admin_user_id, 'Billing Test Admin', 'active', owner_user_id, 'admin'
from gc_billing_test_context
on conflict (user_id) do update set status = 'active', platform_role = 'admin', updated_at = now();

-- Draft legal documents must keep checkout disabled.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', (select owner_user_id from gc_billing_test_context)::text, 'role', 'authenticated')::text, true);

do $$
declare
  payload jsonb;
begin
  payload := public.get_billing_legal_status((select club_id from gc_billing_test_context));
  if (payload ->> 'billing_enabled')::boolean then
    raise exception 'Billing readiness failure: draft documents enabled billing';
  end if;

  begin
    perform public.accept_billing_legal_documents(
      (select club_id from gc_billing_test_context),
      '{"service_terms":"1.0-draft"}'::jsonb,
      true,
      'billing-test'
    );
    raise exception 'Billing readiness failure: owner accepted draft documents';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end $$;

reset role;

-- A club owner must not configure platform legal identity or publish terms.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', (select owner_user_id from gc_billing_test_context)::text, 'role', 'authenticated')::text, true);

do $$
begin
  begin
    perform public.platform_update_legal_settings(
      'Owner User', 'Daxora', 'Service address', 'https://example.test',
      'support@example.test', 'privacy@example.test', 'England and Wales',
      'test', 'not_vat_registered', null, 'DAX'
    );
    raise exception 'Billing security failure: club owner changed platform legal settings';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

-- The platform administrator can configure test mode and publish reviewed versions.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', (select admin_user_id from gc_billing_test_context)::text, 'role', 'authenticated')::text, true);

select public.platform_update_legal_settings(
  'Billing Test Sole Trader', 'Daxora', '1 Test Street, Bolton', 'https://example.test',
  'support@example.test', 'privacy@example.test', 'England and Wales',
  'test', 'not_vat_registered', null, 'DAX'
);

select public.platform_publish_legal_document('service_terms', '1.0', 'Business Service Terms', 'commercial', 'https://example.test/terms', 'hash-terms', true, 'published', now());
select public.platform_publish_legal_document('data_processing_addendum', '1.0', 'Data Processing Addendum', 'privacy', 'https://example.test/dpa', 'hash-dpa', true, 'published', now());
select public.platform_publish_legal_document('acceptable_use', '1.0', 'Acceptable Use Policy', 'operational', 'https://example.test/acceptable-use', 'hash-aup', true, 'published', now());

reset role;

-- The owner can accept exact current versions but not an outdated version.
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', (select owner_user_id from gc_billing_test_context)::text, 'role', 'authenticated')::text, true);

do $$
declare
  payload jsonb;
begin
  begin
    perform public.accept_billing_legal_documents(
      (select club_id from gc_billing_test_context),
      '{"service_terms":"0.9","data_processing_addendum":"1.0","acceptable_use":"1.0"}'::jsonb,
      true,
      'billing-test'
    );
    raise exception 'Billing acceptance failure: outdated terms were accepted';
  exception
    when invalid_parameter_value then null;
  end;

  payload := public.accept_billing_legal_documents(
    (select club_id from gc_billing_test_context),
    '{"service_terms":"1.0","data_processing_addendum":"1.0","acceptable_use":"1.0"}'::jsonb,
    true,
    'billing-test'
  );

  if not (payload ->> 'checkout_ready')::boolean then
    raise exception 'Billing readiness failure: exact current documents did not enable checkout';
  end if;
end $$;

rollback;
