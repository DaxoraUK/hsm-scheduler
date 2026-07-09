-- Daxora Ground Control: align commercial plans with enforced UI capabilities.
-- Apply after 202607030007_pilot_launch_readiness.sql.
--
-- This migration introduces the Pro-only operations_advanced entitlement and
-- rewrites every plan entitlement array to the reviewed launch matrix. Existing
-- club subscriptions retain their assigned plan/status; their effective access
-- changes immediately because get_club_subscription resolves from these rows.

begin;

update public.subscription_plans
set entitlements = array[
      'dashboard','club_profile','fixture_import','league_link','communications',
      'resource_registry','data_export'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-05',
      'access_model', 'link_connection'
    ),
    updated_at = now()
where code = 'link';

update public.subscription_plans
set entitlements = array[
      'dashboard','club_profile','fixture_import','league_link','communications',
      'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
      'pitch_intelligence','parking_intelligence','weather_intelligence',
      'officials_management','reports_operations','analytics_core'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-05',
      'access_model', 'core_operations'
    ),
    updated_at = now()
where code = 'core';

update public.subscription_plans
set entitlements = array[
      'dashboard','club_profile','fixture_import','league_link','communications',
      'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
      'pitch_intelligence','parking_intelligence','weather_intelligence',
      'officials_management','reports_operations','analytics_core',
      'operations_advanced','reports_advanced','analytics_advanced','multi_venue',
      'priority_support','advanced_integrations'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-05',
      'access_model', 'pro_intelligence'
    ),
    updated_at = now()
where code = 'pro';

update public.subscription_plans
set entitlements = array[
      'dashboard','club_profile','fixture_import','league_link','communications',
      'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
      'pitch_intelligence','parking_intelligence','weather_intelligence',
      'officials_management','reports_operations','analytics_core',
      'operations_advanced','reports_advanced','analytics_advanced','multi_venue',
      'priority_support','advanced_integrations','premium_support'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-05',
      'access_model', 'elite_scale'
    ),
    updated_at = now()
where code = 'elite';

do $$
declare
  missing_codes text[];
begin
  select array_agg(required.code order by required.code)
  into missing_codes
  from (values ('link'), ('core'), ('pro'), ('elite')) required(code)
  where not exists (
    select 1 from public.subscription_plans plan where plan.code = required.code
  );

  if coalesce(array_length(missing_codes, 1), 0) > 0 then
    raise exception 'Plan feature enforcement failed; missing plans: %', array_to_string(missing_codes, ', ');
  end if;

  if exists (
    select 1 from public.subscription_plans
    where code in ('link', 'core')
      and 'operations_advanced' = any(entitlements)
  ) then
    raise exception 'Plan feature enforcement failed; advanced operations leaked into Link/Core';
  end if;

  if exists (
    select 1 from public.subscription_plans
    where code in ('pro', 'elite')
      and not ('operations_advanced' = any(entitlements))
  ) then
    raise exception 'Plan feature enforcement failed; Pro/Elite missing advanced operations';
  end if;
end $$;

commit;
