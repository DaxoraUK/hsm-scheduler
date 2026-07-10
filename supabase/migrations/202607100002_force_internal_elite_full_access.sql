-- Daxora Ground Control: make internal Elite workspaces unambiguously full-access.
--
-- The Elite plan is the source of truth for HSM and other internal pilot clubs.
-- This migration repairs the plan row, removes stale per-club restrictions and
-- makes the server-side effective-entitlement resolver ignore false overrides
-- for internal/billing-exempt Elite workspaces only.

begin;

update public.subscription_plans
set entitlements = array[
      'dashboard','club_profile','fixture_import','league_link','communications',
      'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
      'pitch_intelligence','parking_intelligence','weather_intelligence',
      'officials_management','reports_operations','analytics_core',
      'operations_advanced','reports_advanced','analytics_advanced','multi_venue',
      'priority_support','advanced_integrations','premium_support'
    ]::text[],
    limits = '{"teams":-1,"venues":-1,"users":-1,"pitches":-1,"history_entries":-1,"history_retention_days":-1}'::jsonb,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-10.2',
      'access_model', 'elite_full_access'
    ),
    updated_at = now()
where code = 'elite';

-- Internal Elite pilot clubs must not retain stale Core-era false overrides or
-- restrictive limits after a plan change.
update public.club_subscriptions
set entitlement_overrides = '{}'::jsonb,
    limit_overrides = '{}'::jsonb,
    billing_interval = 'manual',
    updated_at = now()
where plan_code = 'elite'
  and (status = 'internal' or billing_exempt = true);

create or replace function private.effective_club_entitlements(target_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(array_agg(distinct effective.entitlement order by effective.entitlement), '{}'::text[])
  from (
    select base.entitlement
    from public.club_subscriptions subscription
    join public.subscription_plans plan on plan.code = subscription.plan_code
    cross join lateral unnest(plan.entitlements) base(entitlement)
    where subscription.club_id = target_club_id
      and (
        (
          subscription.plan_code = 'elite'
          and (subscription.status = 'internal' or subscription.billing_exempt = true)
        )
        or coalesce(lower(subscription.entitlement_overrides ->> base.entitlement), 'true') <> 'false'
      )

    union

    select override_entry.key
    from public.club_subscriptions subscription
    cross join lateral jsonb_each_text(subscription.entitlement_overrides) override_entry
    where subscription.club_id = target_club_id
      and lower(override_entry.value) = 'true'
  ) effective;
$$;

-- Fail the migration if any internal Elite workspace still resolves without
-- the advanced capabilities required by the product matrix.
do $$
declare
  broken_count integer;
begin
  select count(*)
  into broken_count
  from public.club_subscriptions subscription
  where subscription.plan_code = 'elite'
    and (subscription.status = 'internal' or subscription.billing_exempt = true)
    and not (
      array[
        'operations_advanced',
        'reports_advanced',
        'analytics_advanced',
        'advanced_integrations',
        'multi_venue',
        'premium_support'
      ]::text[] <@ private.effective_club_entitlements(subscription.club_id)
    );

  if broken_count > 0 then
    raise exception 'Internal Elite entitlement reconciliation failed for % workspace(s)', broken_count;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
