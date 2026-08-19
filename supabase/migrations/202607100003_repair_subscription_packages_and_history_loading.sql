-- Daxora Ground Control: repair package authority, immediate entitlement refresh,
-- and guarded matchweek-history loading.
--
-- Root causes addressed:
-- 1. Invisible per-club false overrides could survive a package upgrade.
-- 2. The client received only an effective list, so stale plan rows could make
--    an Elite badge render with Core capabilities.
-- 3. History reads used a direct table request while writes used guarded RPCs.

begin;

insert into public.subscription_plans (
  code, name, description, status, monthly_price_pence, annual_price_pence,
  entitlements, limits, metadata
) values
(
  'link',
  'Link',
  'The operational connection between a club and its league.',
  'active',
  2900,
  29000,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export'
  ]::text[],
  '{"teams":4,"venues":1,"users":3,"pitches":6,"history_entries":12,"history_retention_days":90}'::jsonb,
  '{"commercial_name":"Link","packaging_version":"2026-07-10.3","access_model":"link_connection"}'::jsonb
),
(
  'core',
  'Core',
  'Complete matchday control for established grassroots clubs.',
  'active',
  14900,
  null,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
    'pitch_intelligence','parking_intelligence','weather_intelligence',
    'officials_management','reports_operations','analytics_core'
  ]::text[],
  '{"teams":20,"venues":1,"users":6,"pitches":20,"history_entries":104,"history_retention_days":365}'::jsonb,
  '{"packaging_version":"2026-07-10.3","access_model":"core_operations"}'::jsonb
),
(
  'pro',
  'Pro',
  'Advanced intelligence, reporting and capacity for larger clubs.',
  'active',
  24900,
  null,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
    'pitch_intelligence','parking_intelligence','weather_intelligence',
    'officials_management','reports_operations','analytics_core',
    'operations_advanced','reports_advanced','analytics_advanced','multi_venue',
    'priority_support','advanced_integrations'
  ]::text[],
  '{"teams":40,"venues":3,"users":15,"pitches":50,"history_entries":260,"history_retention_days":1095}'::jsonb,
  '{"packaging_version":"2026-07-10.3","access_model":"pro_intelligence"}'::jsonb
),
(
  'elite',
  'Elite',
  'Multi-site operations, premium support and bespoke scale.',
  'active',
  39900,
  null,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
    'pitch_intelligence','parking_intelligence','weather_intelligence',
    'officials_management','reports_operations','analytics_core',
    'operations_advanced','reports_advanced','analytics_advanced','multi_venue',
    'priority_support','advanced_integrations','premium_support'
  ]::text[],
  '{"teams":-1,"venues":-1,"users":-1,"pitches":-1,"history_entries":-1,"history_retention_days":-1}'::jsonb,
  '{"packaging_version":"2026-07-10.3","access_model":"elite_full_access"}'::jsonb
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    monthly_price_pence = excluded.monthly_price_pence,
    annual_price_pence = excluded.annual_price_pence,
    entitlements = excluded.entitlements,
    limits = excluded.limits,
    metadata = coalesce(public.subscription_plans.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

-- Package capabilities are authoritative. Existing overrides remain additive,
-- but old false values can no longer silently remove a paid capability.
update public.club_subscriptions subscription
set entitlement_overrides = coalesce((
      select jsonb_object_agg(entry.key, to_jsonb(true))
      from jsonb_each_text(subscription.entitlement_overrides) entry
      where lower(entry.value) = 'true'
    ), '{}'::jsonb),
    updated_at = now()
where exists (
  select 1
  from jsonb_each_text(subscription.entitlement_overrides) entry
  where lower(entry.value) <> 'true'
);

-- Internal Elite pilots use the unlimited Elite limits. Remove stale Core/Pro
-- limit overrides left behind by earlier package changes.
update public.club_subscriptions
set entitlement_overrides = '{}'::jsonb,
    limit_overrides = '{}'::jsonb,
    billing_interval = case when status = 'internal' then 'manual' else billing_interval end,
    updated_at = now()
where plan_code = 'elite'
  and (status = 'internal' or billing_exempt = true);

create or replace function private.club_has_entitlement(
  target_club_id uuid,
  entitlement_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    lower(trim(entitlement_key)) = any(plan.entitlements)
    or lower(subscription.entitlement_overrides ->> lower(trim(entitlement_key))) = 'true',
    false
  )
  from public.club_subscriptions subscription
  join public.subscription_plans plan on plan.code = subscription.plan_code
  where subscription.club_id = target_club_id
    and plan.status = 'active';
$$;

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
      and plan.status = 'active'

    union

    select override_entry.key
    from public.club_subscriptions subscription
    cross join lateral jsonb_each_text(subscription.entitlement_overrides) override_entry
    where subscription.club_id = target_club_id
      and lower(override_entry.value) = 'true'
  ) effective;
$$;

create or replace function public.get_club_subscription(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  subscription public.club_subscriptions%rowtype;
  plan public.subscription_plans%rowtype;
  access_state text;
  effective_limits jsonb;
  access_message text := '';
begin
  if auth.uid() is null or (
    not public.can_read_club(target_club_id)
    and not exists (
      select 1 from public.platform_support_staff staff
      where staff.user_id = auth.uid() and staff.status = 'active'
    )
  ) then
    raise exception 'Club access required' using errcode = '42501';
  end if;

  select * into subscription
  from public.club_subscriptions
  where club_id = target_club_id;

  if subscription.club_id is null then
    raise exception 'Club subscription is not configured' using errcode = 'P0002';
  end if;

  select * into plan
  from public.subscription_plans
  where code = subscription.plan_code
    and status = 'active';

  if plan.code is null then
    raise exception 'Subscription plan is unavailable' using errcode = 'P0002';
  end if;

  access_state := private.club_subscription_access_state(target_club_id);
  effective_limits := plan.limits || subscription.limit_overrides;

  if subscription.status = 'suspended' then
    access_message := 'This subscription is suspended. Club data remains available in read-only mode.';
  elsif subscription.status = 'cancelled' then
    access_message := 'This subscription is cancelled. Club data remains available in read-only mode.';
  elsif subscription.status = 'trialing' and access_state = 'read_only' then
    access_message := 'The trial has ended. Club data remains available in read-only mode.';
  elsif subscription.status = 'grace' and access_state = 'read_only' then
    access_message := 'The subscription grace period has ended. Club data remains available in read-only mode.';
  end if;

  return jsonb_build_object(
    'club_id', subscription.club_id,
    'plan_code', plan.code,
    'plan_name', plan.name,
    'status', subscription.status,
    'access_state', access_state,
    'access_message', access_message,
    'billing_interval', subscription.billing_interval,
    'trial_ends_at', subscription.trial_ends_at,
    'grace_ends_at', subscription.grace_ends_at,
    'current_period_end', subscription.current_period_end,
    'cancel_at_period_end', subscription.cancel_at_period_end,
    'billing_exempt', subscription.billing_exempt,
    'entitlements', to_jsonb(private.effective_club_entitlements(target_club_id)),
    'plan_entitlements', to_jsonb(plan.entitlements),
    'entitlement_overrides', subscription.entitlement_overrides,
    'limits', effective_limits,
    'plan_limits', plan.limits,
    'limit_overrides', subscription.limit_overrides,
    'package_version', coalesce(plan.metadata ->> 'packaging_version', ''),
    'updated_at', subscription.updated_at
  );
end;
$$;

create or replace function public.platform_set_club_subscription(
  target_club_id uuid,
  next_plan_code text,
  next_status text,
  next_billing_interval text default 'monthly',
  next_trial_ends_at timestamptz default null,
  next_grace_ends_at timestamptz default null,
  next_current_period_end timestamptz default null,
  next_cancel_at_period_end boolean default false,
  next_billing_exempt boolean default false,
  next_entitlement_overrides jsonb default '{}'::jsonb,
  next_limit_overrides jsonb default '{}'::jsonb,
  change_reason text default 'Manual platform assignment'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_plan text := lower(trim(coalesce(next_plan_code, '')));
  safe_status text := lower(trim(coalesce(next_status, '')));
  safe_interval text := lower(trim(coalesce(next_billing_interval, 'monthly')));
  previous_plan text;
  previous_status text;
  safe_entitlement_overrides jsonb := '{}'::jsonb;
  safe_limit_overrides jsonb := '{}'::jsonb;
begin
  perform private.require_platform_staff('admin');

  if not exists (select 1 from public.subscription_plans plan where plan.code = safe_plan and plan.status = 'active') then
    raise exception 'Unsupported subscription plan' using errcode = '22023';
  end if;
  if safe_status not in ('trialing', 'active', 'grace', 'suspended', 'cancelled', 'internal') then
    raise exception 'Unsupported subscription status' using errcode = '22023';
  end if;
  if safe_interval not in ('monthly', 'annual', 'manual') then
    raise exception 'Unsupported billing interval' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(next_entitlement_overrides, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(next_limit_overrides, '{}'::jsonb)) <> 'object' then
    raise exception 'Entitlement and limit overrides must be JSON objects' using errcode = '22023';
  end if;
  if length(trim(coalesce(change_reason, ''))) < 5 then
    raise exception 'A plan-change reason is required' using errcode = '22023';
  end if;

  select plan_code, status into previous_plan, previous_status
  from public.club_subscriptions
  where club_id = target_club_id;

  -- A changed package starts clean. Reapplying the same package uses only
  -- explicit additive overrides supplied by the current request.
  select coalesce(jsonb_object_agg(entry.key, to_jsonb(true)), '{}'::jsonb)
  into safe_entitlement_overrides
  from jsonb_each_text(coalesce(next_entitlement_overrides, '{}'::jsonb)) entry
  where lower(entry.value) = 'true';

  safe_limit_overrides := coalesce(next_limit_overrides, '{}'::jsonb);

  if previous_plan is distinct from safe_plan then
    safe_entitlement_overrides := '{}'::jsonb;
    safe_limit_overrides := '{}'::jsonb;
  end if;

  if safe_plan = 'elite' and (safe_status = 'internal' or coalesce(next_billing_exempt, false)) then
    safe_entitlement_overrides := '{}'::jsonb;
    safe_limit_overrides := '{}'::jsonb;
    safe_interval := 'manual';
  end if;

  insert into public.club_subscriptions (
    club_id, plan_code, status, billing_interval, trial_ends_at, grace_ends_at,
    current_period_end, cancel_at_period_end, cancelled_at, billing_exempt,
    entitlement_overrides, limit_overrides, created_by, updated_by, metadata
  ) values (
    target_club_id, safe_plan, safe_status, safe_interval, next_trial_ends_at,
    next_grace_ends_at, next_current_period_end, coalesce(next_cancel_at_period_end, false),
    case when safe_status = 'cancelled' then now() else null end,
    coalesce(next_billing_exempt, false), safe_entitlement_overrides,
    safe_limit_overrides, actor_id, actor_id,
    jsonb_build_object(
      'last_manual_reason', trim(change_reason),
      'package_assignment_version', '2026-07-10.3'
    )
  )
  on conflict (club_id) do update
  set plan_code = excluded.plan_code,
      status = excluded.status,
      billing_interval = excluded.billing_interval,
      trial_ends_at = excluded.trial_ends_at,
      grace_ends_at = excluded.grace_ends_at,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      cancelled_at = excluded.cancelled_at,
      billing_exempt = excluded.billing_exempt,
      entitlement_overrides = excluded.entitlement_overrides,
      limit_overrides = excluded.limit_overrides,
      updated_by = actor_id,
      metadata = public.club_subscriptions.metadata || excluded.metadata,
      updated_at = now();

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'subscription.assignment.update',
    'club_subscription',
    target_club_id::text,
    jsonb_build_object(
      'previous_plan', previous_plan,
      'next_plan', safe_plan,
      'previous_status', previous_status,
      'next_status', safe_status,
      'package_authoritative', true,
      'reason', trim(change_reason)
    ),
    'platform_admin'
  );

  perform private.write_platform_activity(
    'subscription.assignment.update',
    target_club_id,
    'club_subscription',
    target_club_id::text,
    jsonb_build_object(
      'previous_plan', previous_plan,
      'next_plan', safe_plan,
      'previous_status', previous_status,
      'next_status', safe_status,
      'package_authoritative', true,
      'reason', trim(change_reason)
    )
  );

  return public.get_club_subscription(target_club_id);
end;
$$;

create or replace function public.load_matchweek_history(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or (
    not public.can_read_club(target_club_id)
    and not exists (
      select 1 from public.platform_support_staff staff
      where staff.user_id = auth.uid() and staff.status = 'active'
    )
  ) then
    raise exception 'Club access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      case
        when jsonb_typeof(history_row.data) = 'object' then
          history_row.data || jsonb_build_object(
            'id', coalesce(history_row.data -> 'id', to_jsonb(history_row.id)),
            'savedAt', coalesce(history_row.data -> 'savedAt', to_jsonb(history_row.saved_at))
          )
        else jsonb_build_object(
          'id', history_row.id,
          'savedAt', history_row.saved_at
        )
      end
      order by history_row.saved_at desc, history_row.updated_at desc
    )
    from public.history history_row
    where history_row.club_id = target_club_id
  ), '[]'::jsonb);
end;
$$;

do $$
declare
  broken_plan text;
begin
  select plan.code into broken_plan
  from public.subscription_plans plan
  where plan.code in ('link', 'core', 'pro', 'elite')
    and (
      (plan.code in ('core', 'pro', 'elite') and not ('matchday_scheduling' = any(plan.entitlements)))
      or (plan.code in ('pro', 'elite') and not (array[
        'operations_advanced','reports_advanced','analytics_advanced','advanced_integrations'
      ]::text[] <@ plan.entitlements))
      or (plan.code = 'elite' and not ('premium_support' = any(plan.entitlements)))
    )
  limit 1;

  if broken_plan is not null then
    raise exception 'Subscription package repair failed for plan %', broken_plan;
  end if;
end $$;

revoke all on function public.get_club_subscription(uuid) from public, anon;
grant execute on function public.get_club_subscription(uuid) to authenticated;

revoke all on function public.platform_set_club_subscription(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.platform_set_club_subscription(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb,text) to authenticated;

revoke all on function public.load_matchweek_history(uuid) from public, anon;
grant execute on function public.load_matchweek_history(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
