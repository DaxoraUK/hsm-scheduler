-- Ground Control staging schema audit.
-- Run in the staging Supabase SQL Editor after applying every migration.
-- A successful run returns one PASS row and changes no data.

do $$
declare
  required_table text;
  required_function text;
  table_names text[] := array[
    'organisations', 'clubs', 'club_memberships', 'history', 'audit_events',
    'user_profiles', 'club_invitations', 'platform_support_staff', 'support_access_sessions',
    'club_onboarding', 'subscription_plans', 'club_subscriptions',
    'platform_activity_events', 'platform_support_cases', 'platform_support_case_notes',
    'platform_legal_settings', 'legal_documents', 'club_legal_acceptances',
    'billing_provider_events', 'billing_checkout_attempts',
    'platform_launch_gates', 'platform_pilot_clubs', 'platform_client_events',
    'funding_projects', 'funding_requirement_records', 'funding_documents',
    'funding_evidence_snapshots', 'funding_profiles', 'funding_applications',
    'funding_application_tasks', 'funding_monitoring_obligations',
    'platform_launch_gate_evidence', 'platform_pilot_sessions', 'platform_pilot_findings'
  ];
  function_names text[] := array[
    'save_matchweek_history', 'list_accessible_workspaces', 'get_club_onboarding',
    'get_club_subscription', 'platform_get_club_detail', 'get_billing_legal_status',
    'platform_get_pilot_launch_readiness', 'platform_get_pilot_evidence',
    'platform_record_launch_gate_evidence', 'platform_upsert_pilot_session',
    'platform_upsert_pilot_finding'
  ];
begin
  foreach required_table in array table_names loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Staging schema audit failed: missing table public.%', required_table;
    end if;
  end loop;

  foreach required_function in array function_names loop
    if not exists (
      select 1
      from pg_proc procedure_row
      join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
      where namespace_row.nspname = 'public'
        and procedure_row.proname = required_function
    ) then
      raise exception 'Staging schema audit failed: missing function public.%', required_function;
    end if;
  end loop;

  if not exists (select 1 from storage.buckets where id = 'funding-documents' and private = true) then
    raise exception 'Staging schema audit failed: private funding-documents storage bucket is missing';
  end if;

  if (select count(*) from public.subscription_plans where code in ('link', 'core', 'pro', 'elite')) <> 4 then
    raise exception 'Staging schema audit failed: Link/Core/Pro/Elite plan rows are incomplete';
  end if;

  if exists (
    select 1 from public.subscription_plans
    where code in ('link', 'core') and 'operations_advanced' = any(entitlements)
  ) then
    raise exception 'Staging schema audit failed: advanced operations leaked into Link/Core';
  end if;

  if exists (
    select 1 from public.subscription_plans
    where code in ('pro', 'elite') and not ('operations_advanced' = any(entitlements))
  ) then
    raise exception 'Staging schema audit failed: Pro/Elite are missing advanced operations';
  end if;

  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
    where namespace_row.nspname = 'public'
      and relation.relname = any(array['clubs','club_memberships','history','funding_projects','platform_pilot_sessions'])
      and (not relation.relrowsecurity or not relation.relforcerowsecurity)
  ) then
    raise exception 'Staging schema audit failed: a critical tenant table does not force RLS';
  end if;

  if (select count(*) from public.platform_launch_gates) < 12 then
    raise exception 'Staging schema audit failed: launch-gate seed records are incomplete';
  end if;
end $$;

select jsonb_build_object(
  'result', 'PASS',
  'checked_at', now(),
  'plans', (select jsonb_object_agg(code, jsonb_build_object('name', name, 'entitlements', entitlements)) from public.subscription_plans where code in ('link','core','pro','elite')),
  'launch_gate_count', (select count(*) from public.platform_launch_gates),
  'message', 'Required Ground Control staging schema, RLS foundations, plan matrix and pilot evidence objects are present.'
) as staging_schema_audit;
