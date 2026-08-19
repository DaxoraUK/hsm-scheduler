-- Daxora Ground Control: establish Elite as a distinct organisation operating
-- layer rather than Pro with unlimited limits.

begin;

update public.subscription_plans
set description = 'Organisation-wide command, governance and executive evidence for complex multi-site clubs.',
    monthly_price_pence = 39900,
    annual_price_pence = null,
    entitlements = array[
      'dashboard','club_profile','fixture_import','resource_registry','communications',
      'matchday_scheduling','midweek_scheduling','pitch_intelligence',
      'parking_intelligence','weather_intelligence','officials_management',
      'reports_operations','analytics_core','data_export','operations_advanced',
      'reports_advanced','analytics_advanced','multi_venue',
      'organisation_command','executive_reporting','governance_controls'
    ]::text[],
    limits = '{"teams":60,"venues":8,"users":25,"pitches":80,"history_entries":260,"history_retention_days":1095}'::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-13.1',
      'launch_status', 'contact',
      'customer_visible', true,
      'assignable', true,
      'access_model', 'elite_organisation_command',
      'contract_band', 'elite_60',
      'larger_organisations', 'custom_contracted_capacity'
    ),
    updated_at = now()
where code = 'elite';

-- Remove obsolete service and integration promises from historical overrides.
-- Genuine bespoke limits remain possible through explicit contracted overrides.
update public.club_subscriptions
set entitlement_overrides = coalesce(entitlement_overrides, '{}'::jsonb)
      - array['advanced_integrations','priority_support','premium_support'],
    updated_at = now()
where plan_code = 'elite'
  and coalesce(entitlement_overrides, '{}'::jsonb) ?| array[
    'advanced_integrations','priority_support','premium_support'
  ];

-- Internal Elite workspaces should inherit the current package rather than a
-- stale unlimited launch override. Deliberate non-internal contracted limits
-- are preserved.
update public.club_subscriptions
set limit_overrides = '{}'::jsonb,
    updated_at = now()
where plan_code = 'elite'
  and (status = 'internal' or billing_exempt = true)
  and coalesce(limit_overrides, '{}'::jsonb) <> '{}'::jsonb;

commit;

notify pgrst, 'reload schema';
