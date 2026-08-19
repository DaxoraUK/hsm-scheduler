-- Daxora Ground Control: reconcile the reviewed plan matrix and remove stale
-- advanced-feature denials from internal Elite pilot workspaces.
--
-- The plan is the source of truth. Internal Elite workspaces are expected to
-- receive the full Elite capability set unless a later, explicit commercial
-- rule says otherwise.

begin;

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
      'packaging_version', '2026-07-10',
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
      'packaging_version', '2026-07-10',
      'access_model', 'elite_scale'
    ),
    updated_at = now()
where code = 'elite';

-- Clear only stale denials for features that are intrinsic to Elite, and only
-- for internal/billing-exempt workspaces used for pilots and demonstrations.
update public.club_subscriptions
set entitlement_overrides = coalesce(entitlement_overrides, '{}'::jsonb) - array[
      'operations_advanced',
      'reports_advanced',
      'analytics_advanced',
      'multi_venue',
      'priority_support',
      'advanced_integrations',
      'premium_support'
    ]::text[],
    updated_at = now()
where plan_code = 'elite'
  and status = 'internal'
  and billing_exempt = true;

do $$
begin
  if exists (
    select 1
    from public.subscription_plans
    where code in ('pro', 'elite')
      and not ('analytics_advanced' = any(entitlements))
  ) then
    raise exception 'Plan reconciliation failed: Pro/Elite missing analytics_advanced';
  end if;

  if exists (
    select 1
    from public.subscription_plans
    where code in ('pro', 'elite')
      and not ('advanced_integrations' = any(entitlements))
  ) then
    raise exception 'Plan reconciliation failed: Pro/Elite missing advanced_integrations';
  end if;
end $$;

commit;
