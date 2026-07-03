-- Daxora Ground Control: plan entitlements and subscription architecture.
-- Apply after 202607030003_customer_onboarding.sql.
--
-- This migration intentionally does not connect a payment provider. It creates
-- the commercial source of truth, server-side feature/limit checks, trial and
-- grace behaviour, read-only suspension/cancellation, and a guarded manual
-- assignment RPC for the later Daxora admin console.

begin;

create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  description text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  monthly_price_pence integer check (monthly_price_pence is null or monthly_price_pence >= 0),
  annual_price_pence integer check (annual_price_pence is null or annual_price_pence >= 0),
  entitlements text[] not null default '{}'::text[],
  limits jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(limits) = 'object'),
  check (jsonb_typeof(metadata) = 'object')
);

insert into public.subscription_plans (
  code, name, description, monthly_price_pence, annual_price_pence, entitlements, limits, metadata
) values
(
  'link',
  'Link',
  'The operational connection between a club and its league.',
  2900,
  29000,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export'
  ]::text[],
  '{"teams":4,"venues":1,"users":3,"pitches":6,"history_entries":12,"history_retention_days":90}'::jsonb,
  '{"commercial_name":"Link"}'::jsonb
),
(
  'core',
  'Core',
  'Complete matchday control for established grassroots clubs.',
  14900,
  null,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
    'pitch_intelligence','parking_intelligence','weather_intelligence',
    'officials_management','reports_operations','analytics_core'
  ]::text[],
  '{"teams":20,"venues":1,"users":6,"pitches":20,"history_entries":104,"history_retention_days":365}'::jsonb,
  '{}'::jsonb
),
(
  'pro',
  'Pro',
  'Advanced intelligence, reporting and capacity for larger clubs.',
  24900,
  null,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
    'pitch_intelligence','parking_intelligence','weather_intelligence',
    'officials_management','reports_operations','analytics_core',
    'reports_advanced','analytics_advanced','multi_venue','priority_support',
    'advanced_integrations'
  ]::text[],
  '{"teams":40,"venues":3,"users":15,"pitches":50,"history_entries":260,"history_retention_days":1095}'::jsonb,
  '{}'::jsonb
),
(
  'elite',
  'Elite',
  'Multi-site operations, premium support and bespoke scale.',
  39900,
  null,
  array[
    'dashboard','club_profile','fixture_import','league_link','communications',
    'resource_registry','data_export','matchday_scheduling','midweek_scheduling',
    'pitch_intelligence','parking_intelligence','weather_intelligence',
    'officials_management','reports_operations','analytics_core',
    'reports_advanced','analytics_advanced','multi_venue','priority_support',
    'advanced_integrations','premium_support'
  ]::text[],
  '{"teams":-1,"venues":-1,"users":-1,"pitches":-1,"history_entries":-1,"history_retention_days":-1}'::jsonb,
  '{}'::jsonb
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    monthly_price_pence = excluded.monthly_price_pence,
    annual_price_pence = excluded.annual_price_pence,
    entitlements = excluded.entitlements,
    limits = excluded.limits,
    metadata = excluded.metadata,
    updated_at = now();

create table if not exists public.club_subscriptions (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'grace', 'suspended', 'cancelled', 'internal')),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'annual', 'manual')),
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  billing_exempt boolean not null default false,
  external_customer_id text,
  external_subscription_id text,
  entitlement_overrides jsonb not null default '{}'::jsonb,
  limit_overrides jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(entitlement_overrides) = 'object'),
  check (jsonb_typeof(limit_overrides) = 'object'),
  check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists club_subscriptions_external_customer_key
  on public.club_subscriptions(external_customer_id)
  where external_customer_id is not null;
create unique index if not exists club_subscriptions_external_subscription_key
  on public.club_subscriptions(external_subscription_id)
  where external_subscription_id is not null;
create index if not exists club_subscriptions_status_idx
  on public.club_subscriptions(status, plan_code, updated_at desc);

drop trigger if exists subscription_plans_touch_updated_at on public.subscription_plans;
create trigger subscription_plans_touch_updated_at
before update on public.subscription_plans
for each row execute function public.touch_updated_at();

drop trigger if exists club_subscriptions_touch_updated_at on public.club_subscriptions;
create trigger club_subscriptions_touch_updated_at
before update on public.club_subscriptions
for each row execute function public.touch_updated_at();

-- Existing pilot/design-partner workspaces retain full access and do not become
-- billable merely because this migration is applied.
insert into public.club_subscriptions (
  club_id, plan_code, status, billing_interval, billing_exempt, created_by, updated_by, metadata
)
select
  club.id,
  'elite',
  'internal',
  'manual',
  true,
  club.created_by,
  club.created_by,
  jsonb_build_object('migration', '202607030004', 'reason', 'existing pilot workspace')
from public.clubs club
on conflict (club_id) do nothing;

create or replace function private.create_default_club_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.club_subscriptions (
    club_id,
    plan_code,
    status,
    billing_interval,
    trial_ends_at,
    current_period_start,
    current_period_end,
    billing_exempt,
    created_by,
    updated_by,
    metadata
  ) values (
    new.id,
    'core',
    'trialing',
    'monthly',
    now() + interval '14 days',
    now(),
    now() + interval '14 days',
    false,
    new.created_by,
    new.created_by,
    jsonb_build_object('source', 'new_club_default')
  ) on conflict (club_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ground_control_create_club_subscription on public.clubs;
create trigger ground_control_create_club_subscription
after insert on public.clubs
for each row execute function private.create_default_club_subscription();

alter table public.subscription_plans enable row level security;
alter table public.subscription_plans force row level security;
alter table public.club_subscriptions enable row level security;
alter table public.club_subscriptions force row level security;

drop policy if exists subscription_plans_read on public.subscription_plans;
create policy subscription_plans_read
on public.subscription_plans
for select
to authenticated
using (status = 'active');

drop policy if exists club_subscriptions_read on public.club_subscriptions;
create policy club_subscriptions_read
on public.club_subscriptions
for select
to authenticated
using (public.can_read_club(club_id));

revoke all on public.subscription_plans from anon, authenticated;
revoke all on public.club_subscriptions from anon, authenticated;
grant select on public.subscription_plans to authenticated;
grant select on public.club_subscriptions to authenticated;

create or replace function private.club_subscription_access_state(target_club_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select case
    when subscription.status in ('active', 'internal') then 'full'
    when subscription.status = 'trialing' and subscription.trial_ends_at is not null and subscription.trial_ends_at > now() then 'full'
    when subscription.status = 'grace' and subscription.grace_ends_at is not null and subscription.grace_ends_at > now() then 'full'
    else 'read_only'
  end
  from public.club_subscriptions subscription
  where subscription.club_id = target_club_id;
$$;

create or replace function private.club_subscription_allows_write(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(private.club_subscription_access_state(target_club_id) = 'full', false);
$$;

create or replace function private.club_has_entitlement(target_club_id uuid, entitlement_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    case
      when subscription.entitlement_overrides ? lower(trim(entitlement_key))
        then lower(subscription.entitlement_overrides ->> lower(trim(entitlement_key))) = 'true'
      else lower(trim(entitlement_key)) = any(plan.entitlements)
    end,
    false
  )
  from public.club_subscriptions subscription
  join public.subscription_plans plan on plan.code = subscription.plan_code
  where subscription.club_id = target_club_id;
$$;

create or replace function private.club_subscription_limit(
  target_club_id uuid,
  limit_key text,
  fallback_value integer default -1
)
returns integer
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    case
      when subscription.limit_overrides ? lower(trim(limit_key))
       and (subscription.limit_overrides ->> lower(trim(limit_key))) ~ '^-?[0-9]+$'
        then (subscription.limit_overrides ->> lower(trim(limit_key)))::integer
      else null
    end,
    case
      when (plan.limits ->> lower(trim(limit_key))) ~ '^-?[0-9]+$'
        then (plan.limits ->> lower(trim(limit_key)))::integer
      else null
    end,
    fallback_value
  )
  from public.club_subscriptions subscription
  join public.subscription_plans plan on plan.code = subscription.plan_code
  where subscription.club_id = target_club_id;
$$;

create or replace function private.effective_club_entitlements(target_club_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(array_agg(distinct entitlement order by entitlement), '{}'::text[])
  from (
    select base.entitlement
    from public.club_subscriptions subscription
    join public.subscription_plans plan on plan.code = subscription.plan_code
    cross join lateral unnest(plan.entitlements) base(entitlement)
    where subscription.club_id = target_club_id
      and coalesce(lower(subscription.entitlement_overrides ->> base.entitlement), 'true') <> 'false'

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
    'limits', effective_limits,
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
begin
  if actor_id is null or not exists (
    select 1 from public.platform_support_staff staff
    where staff.user_id = actor_id and staff.status = 'active'
  ) then
    raise exception 'Active Daxora platform staff access required' using errcode = '42501';
  end if;
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

  insert into public.club_subscriptions (
    club_id, plan_code, status, billing_interval, trial_ends_at, grace_ends_at,
    current_period_end, cancel_at_period_end, cancelled_at, billing_exempt,
    entitlement_overrides, limit_overrides, created_by, updated_by, metadata
  ) values (
    target_club_id, safe_plan, safe_status, safe_interval, next_trial_ends_at,
    next_grace_ends_at, next_current_period_end, coalesce(next_cancel_at_period_end, false),
    case when safe_status = 'cancelled' then now() else null end,
    coalesce(next_billing_exempt, false), coalesce(next_entitlement_overrides, '{}'::jsonb),
    coalesce(next_limit_overrides, '{}'::jsonb), actor_id, actor_id,
    jsonb_build_object('last_manual_reason', trim(change_reason))
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
      'reason', trim(change_reason)
    ),
    'database'
  );

  return public.get_club_subscription(target_club_id);
end;
$$;

-- Operational tables stay readable after cancellation but become immutable.
create or replace function private.enforce_subscription_write()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_club_id uuid;
begin
  target_club_id := case when tg_op = 'DELETE' then old.club_id else new.club_id end;
  if auth.uid() is not null and not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The club subscription is read only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'club_config','pitches','refs','team_config','pitch_closures','history','club_onboarding'
  ] loop
    execute format('drop trigger if exists enforce_subscription_write on public.%I', table_name);
    execute format(
      'create trigger enforce_subscription_write before insert or update or delete on public.%I for each row execute function private.enforce_subscription_write()',
      table_name
    );
  end loop;
end;
$$;

create or replace function private.enforce_entitled_collection()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_club_id uuid := new.club_id;
  required_entitlement text;
begin
  required_entitlement := case tg_table_name
    when 'history' then 'matchday_scheduling'
    when 'refs' then 'officials_management'
    when 'pitch_closures' then 'pitch_intelligence'
    else null
  end;

  if auth.uid() is not null
     and required_entitlement is not null
     and not private.club_has_entitlement(target_club_id, required_entitlement) then
    raise exception 'The current plan does not include %', required_entitlement using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_history_entitlement on public.history;
create trigger enforce_history_entitlement
before insert or update on public.history
for each row execute function private.enforce_entitled_collection();

drop trigger if exists enforce_refs_entitlement on public.refs;
create trigger enforce_refs_entitlement
before insert or update on public.refs
for each row execute function private.enforce_entitled_collection();

drop trigger if exists enforce_pitch_closures_entitlement on public.pitch_closures;
create trigger enforce_pitch_closures_entitlement
before insert or update on public.pitch_closures
for each row execute function private.enforce_entitled_collection();

create or replace function private.enforce_subscription_record_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_club_id uuid := new.club_id;
  limit_key text;
  maximum integer;
  current_count integer;
begin
  limit_key := case tg_table_name
    when 'team_config' then 'teams'
    when 'pitches' then 'pitches'
    else null
  end;
  if limit_key is null or auth.uid() is null then return new; end if;

  maximum := private.club_subscription_limit(target_club_id, limit_key, -1);
  if maximum < 0 then return new; end if;

  execute format('select count(*) from public.%I where club_id = $1', tg_table_name)
    into current_count using target_club_id;

  if tg_op = 'INSERT' and current_count >= maximum then
    raise exception 'The current plan allows a maximum of % %', maximum, limit_key using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_team_limit on public.team_config;
create trigger enforce_team_limit
before insert on public.team_config
for each row execute function private.enforce_subscription_record_limit();

drop trigger if exists enforce_pitch_limit on public.pitches;
create trigger enforce_pitch_limit
before insert on public.pitches
for each row execute function private.enforce_subscription_record_limit();

create or replace function private.enforce_venue_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  maximum integer;
  venue_count integer := 1;
begin
  if auth.uid() is null then return new; end if;
  maximum := private.club_subscription_limit(new.club_id, 'venues', -1);
  if maximum < 0 then return new; end if;
  if jsonb_typeof(new.data -> 'sites') = 'array' then
    venue_count := jsonb_array_length(new.data -> 'sites');
  end if;
  if venue_count > maximum then
    raise exception 'The current plan allows a maximum of % venues', maximum using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_venue_limit on public.club_config;
create trigger enforce_venue_limit
before insert or update on public.club_config
for each row
when (new.id = 'club')
execute function private.enforce_venue_limit();

create or replace function private.enforce_membership_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  maximum integer;
  current_count integer;
begin
  if auth.uid() is null or new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.club_id = new.club_id and old.status = 'active' then return new; end if;

  maximum := private.club_subscription_limit(new.club_id, 'users', -1);
  if maximum < 0 then return new; end if;
  select count(*) into current_count
  from public.club_memberships membership
  where membership.club_id = new.club_id and membership.status = 'active';
  if current_count >= maximum then
    raise exception 'The current plan allows a maximum of % active users', maximum using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_membership_limit on public.club_memberships;
create trigger enforce_membership_limit
before insert or update of status, club_id on public.club_memberships
for each row execute function private.enforce_membership_limit();

create or replace function private.enforce_invitation_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  maximum integer;
  reserved_count integer;
begin
  if auth.uid() is null or new.status <> 'pending' then return new; end if;
  maximum := private.club_subscription_limit(new.club_id, 'users', -1);
  if maximum < 0 then return new; end if;

  select
    (select count(*) from public.club_memberships membership where membership.club_id = new.club_id and membership.status = 'active')
    +
    (select count(*) from public.club_invitations invitation where invitation.club_id = new.club_id and invitation.status = 'pending' and invitation.expires_at > now())
  into reserved_count;

  if reserved_count >= maximum then
    raise exception 'The current plan has no remaining user places' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invitation_limit on public.club_invitations;
create trigger enforce_invitation_limit
before insert on public.club_invitations
for each row execute function private.enforce_invitation_limit();

create or replace function private.prune_history_to_subscription_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  maximum_entries integer;
  retention_days integer;
begin
  maximum_entries := private.club_subscription_limit(new.club_id, 'history_entries', -1);
  retention_days := private.club_subscription_limit(new.club_id, 'history_retention_days', -1);

  if retention_days >= 0 then
    delete from public.history history_row
    where history_row.club_id = new.club_id
      and history_row.saved_at < now() - make_interval(days => retention_days);
  end if;

  if maximum_entries >= 0 then
    delete from public.history history_row
    where history_row.club_id = new.club_id
      and history_row.id in (
        select overflow.id
        from public.history overflow
        where overflow.club_id = new.club_id
        order by overflow.saved_at desc, overflow.updated_at desc
        offset maximum_entries
      );
  end if;

  return new;
end;
$$;

drop trigger if exists prune_history_to_subscription_limits on public.history;
create trigger prune_history_to_subscription_limits
after insert or update on public.history
for each row execute function private.prune_history_to_subscription_limits();

revoke all on function public.get_club_subscription(uuid) from public, anon;
grant execute on function public.get_club_subscription(uuid) to authenticated;
revoke all on function public.platform_set_club_subscription(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb,text) from public, anon;
grant execute on function public.platform_set_club_subscription(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean,boolean,jsonb,jsonb,text) to authenticated;

comment on table public.club_subscriptions is
  'Provider-neutral subscription state. External billing IDs are optional until the billing phase.';
comment on function public.platform_set_club_subscription is
  'Manual platform assignment for active Daxora staff. Intended for the future admin console; never callable by club owners.';

commit;
