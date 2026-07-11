-- Daxora Ground Control: align the stored package catalogue with the
-- launch-ready customer experience.
--
-- Link remains active only for legacy/future league-connected workspaces, but
-- is hidden from new customer assignment and self-service sales in the client.
-- Undelivered support and integration promises are removed from paid packages.

begin;

update public.subscription_plans
set description = 'The future operational connection between a club and its league.',
    entitlements = array[
      'dashboard','club_profile','fixture_import','league_link','communications',
      'resource_registry'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-11.1',
      'launch_status', 'held',
      'customer_visible', false,
      'assignable', false,
      'access_model', 'future_league_connection'
    ),
    updated_at = now()
where code = 'link';

update public.subscription_plans
set description = 'Complete scheduling and matchday control for a single-site grassroots club.',
    annual_price_pence = null,
    entitlements = array[
      'dashboard','club_profile','fixture_import','resource_registry','communications',
      'matchday_scheduling','midweek_scheduling','pitch_intelligence',
      'parking_intelligence','weather_intelligence','officials_management',
      'reports_operations','analytics_core','data_export'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-11.1',
      'launch_status', 'available',
      'customer_visible', true,
      'assignable', true,
      'access_model', 'core_operations'
    ),
    updated_at = now()
where code = 'core';

update public.subscription_plans
set description = 'Advanced cross-day operations, reporting and funding evidence for larger clubs.',
    annual_price_pence = null,
    entitlements = array[
      'dashboard','club_profile','fixture_import','resource_registry','communications',
      'matchday_scheduling','midweek_scheduling','pitch_intelligence',
      'parking_intelligence','weather_intelligence','officials_management',
      'reports_operations','analytics_core','data_export','operations_advanced',
      'reports_advanced','analytics_advanced','multi_venue'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-11.1',
      'launch_status', 'available',
      'customer_visible', true,
      'assignable', true,
      'access_model', 'pro_intelligence'
    ),
    updated_at = now()
where code = 'pro';

update public.subscription_plans
set description = 'Unlimited multi-site operations with tailored implementation and scale.',
    annual_price_pence = null,
    entitlements = array[
      'dashboard','club_profile','fixture_import','resource_registry','communications',
      'matchday_scheduling','midweek_scheduling','pitch_intelligence',
      'parking_intelligence','weather_intelligence','officials_management',
      'reports_operations','analytics_core','data_export','operations_advanced',
      'reports_advanced','analytics_advanced','multi_venue'
    ]::text[],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-11.1',
      'launch_status', 'contact',
      'customer_visible', true,
      'assignable', true,
      'access_model', 'elite_scale'
    ),
    updated_at = now()
where code = 'elite';

-- Remove inherited or historical overrides for capabilities that are not part
-- of the launch product. Link keeps league_link because that is its future
-- product purpose; other plans do not advertise or receive it.
update public.club_subscriptions
set entitlement_overrides = coalesce(entitlement_overrides, '{}'::jsonb)
      - array['advanced_integrations','priority_support','premium_support'],
    updated_at = now()
where coalesce(entitlement_overrides, '{}'::jsonb) ?| array[
  'advanced_integrations','priority_support','premium_support'
];

update public.club_subscriptions
set entitlement_overrides = coalesce(entitlement_overrides, '{}'::jsonb) - 'league_link',
    updated_at = now()
where plan_code <> 'link'
  and coalesce(entitlement_overrides, '{}'::jsonb) ? 'league_link';

commit;
