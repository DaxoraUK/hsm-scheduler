-- Daxora v3.8.2: server-backed notifications, report delivery automation and archives.
begin;

create table if not exists public.daxora_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  browser_push_enabled boolean not null default false,
  email_alerts_enabled boolean not null default true,
  daily_digest_enabled boolean not null default false,
  weekly_digest_enabled boolean not null default true,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'Europe/London' check (length(timezone) between 3 and 100),
  categories jsonb not null default '{"system":true,"fixtures":true,"results":true,"reports":true,"discipline":true,"registrations":true}'::jsonb check (jsonb_typeof(categories) = 'object'),
  last_daily_digest_at timestamptz,
  last_weekly_digest_at timestamptz,
  digest_processing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daxora_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 220),
  description text not null default '' check (length(description) <= 5000),
  severity text not null default 'info' check (severity in ('success','info','warning','error','action')),
  category text not null default 'activity' check (length(category) between 2 and 80),
  href text not null default '' check (length(href) <= 2000),
  action_label text not null default '' check (length(action_label) <= 100),
  workspace_type text not null default 'platform' check (workspace_type in ('platform','club','league')),
  workspace_id text not null default '' check (length(workspace_id) <= 120),
  workspace_name text not null default 'Daxora' check (length(workspace_name) <= 220),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  read_at timestamptz,
  resolved_at timestamptz,
  dismissed_at timestamptz,
  digest_sent_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.daxora_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 20 and 4000 and endpoint ~* '^https://'),
  p256dh text not null check (length(p256dh) between 20 and 500),
  auth_secret text not null check (length(auth_secret) between 8 and 500),
  user_agent text not null default '' check (length(user_agent) <= 500),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_report_distribution_lists (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  recipients text[] not null default '{}'::text[],
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

alter table public.league_report_definitions
  add column if not exists distribution_list_id uuid references public.league_report_distribution_lists(id) on delete set null,
  add column if not exists freshness_hours integer not null default 24 check (freshness_hours between 1 and 168),
  add column if not exists send_email boolean not null default true,
  add column if not exists archive_runs boolean not null default true;

alter table public.league_report_definitions drop constraint if exists league_report_definitions_delivery_format_check;
alter table public.league_report_definitions add constraint league_report_definitions_delivery_format_check
  check (delivery_format in ('html','csv','xls'));

create table if not exists public.league_report_delivery_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  definition_id uuid references public.league_report_definitions(id) on delete set null,
  snapshot_id uuid references public.league_report_snapshots(id) on delete set null,
  report_type text not null check (report_type in ('executive','competitions','clubs','officials','governance','funding_evidence')),
  delivery_format text not null default 'html' check (delivery_format in ('html','csv','xls')),
  recipients text[] not null default '{}'::text[],
  recipient_count integer not null default 0 check (recipient_count >= 0),
  requested_source text not null default 'manual' check (requested_source in ('manual','scheduled','retry','api')),
  status text not null default 'queued' check (status in ('queued','processing','delivered','failed','cancelled','skipped')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_attempt_at timestamptz,
  provider text,
  provider_reference text,
  error_code text,
  error_message text,
  artifact_name text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daxora_notifications_user_created_idx on public.daxora_notifications(user_id, created_at desc);
create index if not exists daxora_notifications_digest_idx on public.daxora_notifications(user_id, digest_sent_at, created_at desc) where dismissed_at is null;
create index if not exists daxora_push_subscriptions_user_idx on public.daxora_push_subscriptions(user_id, active);
create index if not exists league_report_distribution_lists_league_idx on public.league_report_distribution_lists(league_id, active, name);
create index if not exists league_report_delivery_runs_league_idx on public.league_report_delivery_runs(league_id, created_at desc);
create index if not exists league_report_delivery_runs_queue_idx on public.league_report_delivery_runs(status, next_attempt_at, queued_at);
create unique index if not exists league_report_delivery_runs_active_definition_idx
  on public.league_report_delivery_runs(definition_id)
  where definition_id is not null and status in ('queued','processing');

alter table public.daxora_notification_preferences enable row level security;
alter table public.daxora_notifications enable row level security;
alter table public.daxora_push_subscriptions enable row level security;
alter table public.league_report_distribution_lists enable row level security;
alter table public.league_report_delivery_runs enable row level security;

revoke all on public.daxora_notification_preferences, public.daxora_notifications, public.daxora_push_subscriptions,
  public.league_report_distribution_lists, public.league_report_delivery_runs from public, anon;
grant select on public.daxora_notification_preferences, public.daxora_notifications, public.daxora_push_subscriptions,
  public.league_report_distribution_lists, public.league_report_delivery_runs to authenticated;

create policy daxora_notification_preferences_own on public.daxora_notification_preferences
for select to authenticated using (user_id = auth.uid());
create policy daxora_notifications_own on public.daxora_notifications
for select to authenticated using (user_id = auth.uid());
create policy daxora_push_subscriptions_own on public.daxora_push_subscriptions
for select to authenticated using (user_id = auth.uid());
create policy league_report_distribution_lists_read on public.league_report_distribution_lists
for select to authenticated using (public.can_manage_league(league_id));
create policy league_report_delivery_runs_read on public.league_report_delivery_runs
for select to authenticated using (public.can_view_league(league_id));

create or replace function private.is_service_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function public.get_daxora_notification_centre(result_limit integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(result_limit, 120), 200));
  preference_row public.daxora_notification_preferences%rowtype;
begin
  if actor_id is null then raise exception 'Sign in to view notifications' using errcode = '42501'; end if;
  insert into public.daxora_notification_preferences(user_id) values(actor_id) on conflict (user_id) do nothing;
  select * into preference_row from public.daxora_notification_preferences where user_id = actor_id;
  return jsonb_build_object(
    'preferences', to_jsonb(preference_row),
    'push_subscriptions', (select count(*) from public.daxora_push_subscriptions subscription where subscription.user_id = actor_id and subscription.active),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(notification_value) order by notification_value.created_at desc)
      from (
        select notification_row.*
        from public.daxora_notifications notification_row
        where notification_row.user_id = actor_id
          and notification_row.dismissed_at is null
          and (notification_row.expires_at is null or notification_row.expires_at > now())
        order by notification_row.created_at desc
        limit safe_limit
      ) notification_value
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_daxora_notification_preferences(preferences_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_categories jsonb := coalesce(preferences_data->'categories', '{}'::jsonb);
  result_row public.daxora_notification_preferences%rowtype;
begin
  if actor_id is null then raise exception 'Sign in to update notification preferences' using errcode = '42501'; end if;
  if jsonb_typeof(safe_categories) <> 'object' then raise exception 'Notification categories must be an object' using errcode = '22023'; end if;
  insert into public.daxora_notification_preferences(
    user_id, in_app_enabled, browser_push_enabled, email_alerts_enabled, daily_digest_enabled, weekly_digest_enabled,
    quiet_start, quiet_end, timezone, categories, updated_at
  ) values (
    actor_id,
    coalesce((preferences_data->>'in_app_enabled')::boolean, true),
    coalesce((preferences_data->>'browser_push_enabled')::boolean, false),
    coalesce((preferences_data->>'email_alerts_enabled')::boolean, true),
    coalesce((preferences_data->>'daily_digest_enabled')::boolean, false),
    coalesce((preferences_data->>'weekly_digest_enabled')::boolean, true),
    nullif(preferences_data->>'quiet_start', '')::time,
    nullif(preferences_data->>'quiet_end', '')::time,
    left(coalesce(nullif(trim(preferences_data->>'timezone'), ''), 'Europe/London'), 100),
    safe_categories,
    now()
  ) on conflict (user_id) do update set
    in_app_enabled = excluded.in_app_enabled,
    browser_push_enabled = excluded.browser_push_enabled,
    email_alerts_enabled = excluded.email_alerts_enabled,
    daily_digest_enabled = excluded.daily_digest_enabled,
    weekly_digest_enabled = excluded.weekly_digest_enabled,
    quiet_start = excluded.quiet_start,
    quiet_end = excluded.quiet_end,
    timezone = excluded.timezone,
    categories = excluded.categories,
    updated_at = now()
  returning * into result_row;
  return to_jsonb(result_row);
end;
$$;

create or replace function public.create_daxora_notification(notification_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_id uuid := coalesce(nullif(notification_data->>'id', '')::uuid, gen_random_uuid());
  safe_severity text := lower(trim(coalesce(notification_data->>'severity', 'info')));
  safe_metadata jsonb := coalesce(notification_data->'metadata', '{}'::jsonb);
  result_row public.daxora_notifications%rowtype;
begin
  if actor_id is null then raise exception 'Sign in to retain notifications' using errcode = '42501'; end if;
  if safe_severity not in ('success','info','warning','error','action') then safe_severity := 'info'; end if;
  if jsonb_typeof(safe_metadata) <> 'object' then safe_metadata := '{}'::jsonb; end if;
  insert into public.daxora_notifications(
    id, user_id, league_id, club_id, title, description, severity, category, href, action_label,
    workspace_type, workspace_id, workspace_name, metadata, created_at
  ) values (
    target_id, actor_id,
    nullif(notification_data->>'league_id', '')::uuid,
    nullif(notification_data->>'club_id', '')::uuid,
    left(coalesce(nullif(trim(notification_data->>'title'), ''), 'Daxora update'), 220),
    left(coalesce(notification_data->>'description', ''), 5000),
    safe_severity,
    left(coalesce(nullif(trim(notification_data->>'category'), ''), 'activity'), 80),
    left(coalesce(notification_data->>'href', ''), 2000),
    left(coalesce(notification_data->>'action_label', ''), 100),
    case when notification_data->>'workspace_type' in ('platform','club','league') then notification_data->>'workspace_type' else 'platform' end,
    left(coalesce(notification_data->>'workspace_id', ''), 120),
    left(coalesce(nullif(trim(notification_data->>'workspace_name'), ''), 'Daxora'), 220),
    safe_metadata,
    coalesce(nullif(notification_data->>'created_at', '')::timestamptz, now())
  ) on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    severity = excluded.severity,
    category = excluded.category,
    href = excluded.href,
    action_label = excluded.action_label,
    metadata = excluded.metadata
  where public.daxora_notifications.user_id = actor_id
  returning * into result_row;
  return to_jsonb(result_row);
end;
$$;

create or replace function public.mark_daxora_notification(target_notification_id uuid, notification_action text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_action text := lower(trim(coalesce(notification_action, 'read')));
begin
  if auth.uid() is null then raise exception 'Sign in to update notifications' using errcode = '42501'; end if;
  update public.daxora_notifications notification_value set
    read_at = case when safe_action = 'read' then coalesce(read_at, now()) when safe_action = 'unread' then null else read_at end,
    dismissed_at = case when safe_action = 'dismiss' then now() else dismissed_at end,
    resolved_at = case when safe_action = 'resolve' then now() else resolved_at end
  where notification_value.id = target_notification_id and notification_value.user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_daxora_notifications(notification_action text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_action text:=lower(trim(coalesce(notification_action,'read')));
begin
  if auth.uid() is null then raise exception 'Sign in to update notifications' using errcode='42501'; end if;
  if safe_action='read' then update public.daxora_notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and dismissed_at is null;
  elsif safe_action='dismiss_read' then update public.daxora_notifications set dismissed_at=now() where user_id=auth.uid() and read_at is not null and dismissed_at is null;
  else raise exception 'Invalid bulk notification action' using errcode='22023'; end if;
end;
$$;

create or replace function public.register_daxora_push_subscription(subscription_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_id uuid;
  safe_endpoint text := trim(coalesce(subscription_data->>'endpoint', ''));
  safe_p256dh text := trim(coalesce(subscription_data->>'p256dh', ''));
  safe_auth text := trim(coalesce(subscription_data->>'auth', ''));
begin
  if actor_id is null then raise exception 'Sign in to enable browser push' using errcode = '42501'; end if;
  if safe_endpoint !~* '^https://' or length(safe_endpoint) > 4000 then raise exception 'Invalid push endpoint' using errcode = '22023'; end if;
  if length(safe_p256dh) < 20 or length(safe_auth) < 8 then raise exception 'Invalid push subscription keys' using errcode = '22023'; end if;
  insert into public.daxora_push_subscriptions(user_id, endpoint, p256dh, auth_secret, user_agent, active, last_seen_at, updated_at)
  values(actor_id, safe_endpoint, safe_p256dh, safe_auth, left(coalesce(subscription_data->>'user_agent',''),500), true, now(), now())
  on conflict (endpoint) do update set user_id=actor_id,p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,user_agent=excluded.user_agent,active=true,last_seen_at=now(),updated_at=now()
  returning id into target_id;
  update public.daxora_notification_preferences set browser_push_enabled=true,updated_at=now() where user_id=actor_id;
  return target_id;
end;
$$;

create or replace function public.remove_daxora_push_subscription(target_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to disable browser push' using errcode = '42501'; end if;
  update public.daxora_push_subscriptions set active=false,updated_at=now()
  where user_id=auth.uid() and endpoint=target_endpoint;
end;
$$;

create or replace function public.get_my_daxora_push_subscriptions()
returns jsonb
language sql
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(jsonb_agg(to_jsonb(subscription_value)), '[]'::jsonb)
  from public.daxora_push_subscriptions subscription_value
  where subscription_value.user_id=auth.uid() and subscription_value.active;
$$;

create or replace function public.get_daxora_push_targets(target_user_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', subscription.id, 'user_id', subscription.user_id, 'endpoint', subscription.endpoint,
      'p256dh', subscription.p256dh, 'auth', subscription.auth_secret,
      'quiet_start', preference.quiet_start, 'quiet_end', preference.quiet_end,
      'timezone', coalesce(preference.timezone,'Europe/London')
    ))
    from public.daxora_push_subscriptions subscription
    left join public.daxora_notification_preferences preference on preference.user_id=subscription.user_id
    where subscription.user_id=any(coalesce(target_user_ids,'{}'::uuid[]))
      and subscription.active
      and coalesce(preference.browser_push_enabled,true)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.deactivate_daxora_push_subscription(target_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode = '42501'; end if;
  update public.daxora_push_subscriptions set active=false,updated_at=now() where id=target_subscription_id;
end;
$$;

create or replace function public.claim_daxora_notification_digests(batch_size integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_batch integer := greatest(1,least(coalesce(batch_size,50),100)); result jsonb;
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode = '42501'; end if;
  with candidates as (
    select preference.user_id,
      case when preference.daily_digest_enabled and (preference.last_daily_digest_at is null or preference.last_daily_digest_at::date < current_date) then 'daily' else 'weekly' end as cadence
    from public.daxora_notification_preferences preference
    where preference.email_alerts_enabled
      and (preference.digest_processing_at is null or preference.digest_processing_at < now()-interval '2 hours')
      and (
        (preference.daily_digest_enabled and (preference.last_daily_digest_at is null or preference.last_daily_digest_at::date < current_date))
        or (preference.weekly_digest_enabled and extract(isodow from current_date)=1 and (preference.last_weekly_digest_at is null or preference.last_weekly_digest_at < date_trunc('week',now())))
      )
      and exists(select 1 from public.daxora_notifications notification where notification.user_id=preference.user_id and notification.dismissed_at is null and notification.digest_sent_at is null)
    order by preference.updated_at
    limit safe_batch
    for update skip locked
  ), claimed as (
    update public.daxora_notification_preferences preference set digest_processing_at=now(),updated_at=now()
    from candidates where preference.user_id=candidates.user_id
    returning preference.user_id,candidates.cadence
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', claimed.user_id,
    'cadence', claimed.cadence,
    'email', user_row.email,
    'notifications', coalesce((select jsonb_agg(to_jsonb(notification_value) order by notification_value.created_at desc)
      from (select notification.* from public.daxora_notifications notification where notification.user_id=claimed.user_id and notification.dismissed_at is null and notification.digest_sent_at is null order by notification.created_at desc limit 50) notification_value),'[]'::jsonb)
  )), '[]'::jsonb) into result
  from claimed join auth.users user_row on user_row.id=claimed.user_id
  where user_row.email is not null;
  return result;
end;
$$;

create or replace function public.complete_daxora_notification_digest(target_user_id uuid, digest_cadence text, delivered boolean)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode = '42501'; end if;
  update public.daxora_notification_preferences set
    last_daily_digest_at=case when delivered and digest_cadence='daily' then now() else last_daily_digest_at end,
    last_weekly_digest_at=case when delivered and digest_cadence='weekly' then now() else last_weekly_digest_at end,
    digest_processing_at=null,updated_at=now()
  where user_id=target_user_id;
  if delivered then update public.daxora_notifications set digest_sent_at=now() where user_id=target_user_id and dismissed_at is null and digest_sent_at is null; end if;
end;
$$;

create or replace function public.upsert_league_report_distribution_list(target_league_id uuid, list_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); target_id uuid:=nullif(list_data->>'id','')::uuid;
  safe_name text:=trim(coalesce(list_data->>'name','')); safe_recipients text[]:='{}'::text[];
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if length(safe_name) < 2 then raise exception 'A distribution-list name is required' using errcode='22023'; end if;
  select coalesce(array_agg(distinct lower(trim(value))) filter(where trim(value)<>''),'{}'::text[]) into safe_recipients
  from jsonb_array_elements_text(coalesce(list_data->'recipients','[]'::jsonb)) values_row(value);
  if exists(select 1 from unnest(safe_recipients) email where email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Every distribution-list recipient must be a valid email address' using errcode='22023'; end if;
  if target_id is null then
    insert into public.league_report_distribution_lists(league_id,name,recipients,active,created_by)
    values(target_league_id,safe_name,safe_recipients,coalesce((list_data->>'active')::boolean,true),actor_id) returning id into target_id;
  else
    update public.league_report_distribution_lists set name=safe_name,recipients=safe_recipients,active=coalesce((list_data->>'active')::boolean,true),updated_at=now()
    where id=target_id and league_id=target_league_id;
    if not found then raise exception 'Distribution list not found' using errcode='P0002'; end if;
  end if;
  perform private.write_league_audit(target_league_id,'league.report_distribution_list_saved','report_distribution_list',target_id,jsonb_build_object('name',safe_name,'recipients',cardinality(safe_recipients)));
  return target_id;
end;
$$;

create or replace function public.delete_league_report_distribution_list(target_league_id uuid, target_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  update public.league_report_definitions set distribution_list_id=null where league_id=target_league_id and distribution_list_id=target_list_id;
  delete from public.league_report_distribution_lists where id=target_list_id and league_id=target_league_id;
  if not found then raise exception 'Distribution list not found' using errcode='P0002'; end if;
  perform private.write_league_audit(target_league_id,'league.report_distribution_list_deleted','report_distribution_list',target_list_id,'{}'::jsonb);
end;
$$;

create or replace function public.get_league_report_configuration(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); actor_role text; can_manage boolean;
begin
  if actor_id is null or not public.can_view_league(target_league_id) then raise exception 'League reporting access required' using errcode='42501'; end if;
  actor_role:=private.current_league_role(target_league_id,actor_id); can_manage:=public.can_manage_league(target_league_id);
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_manage',can_manage),
    'definitions',case when can_manage then coalesce((select jsonb_agg(to_jsonb(definition) order by definition.active desc,definition.next_run_on nulls last,definition.name) from public.league_report_definitions definition where definition.league_id=target_league_id),'[]'::jsonb) else '[]'::jsonb end,
    'distribution_lists',case when can_manage then coalesce((select jsonb_agg(to_jsonb(list_value) order by list_value.active desc,list_value.name) from public.league_report_distribution_lists list_value where list_value.league_id=target_league_id),'[]'::jsonb) else '[]'::jsonb end,
    'snapshots',coalesce((select jsonb_agg(to_jsonb(snapshot_value) order by snapshot_value.created_at desc) from (select snapshot.* from public.league_report_snapshots snapshot where snapshot.league_id=target_league_id order by snapshot.created_at desc limit 72) snapshot_value),'[]'::jsonb),
    'runs',case when can_manage then coalesce((select jsonb_agg(to_jsonb(run_value) order by run_value.created_at desc) from (
      select run.*,definition.name as definition_name,snapshot.created_at as snapshot_created_at,snapshot.snapshot
      from public.league_report_delivery_runs run
      left join public.league_report_definitions definition on definition.id=run.definition_id
      left join public.league_report_snapshots snapshot on snapshot.id=run.snapshot_id
      where run.league_id=target_league_id order by run.created_at desc limit 80
    ) run_value),'[]'::jsonb) else '[]'::jsonb end,
    'delivery',jsonb_build_object(
      'queued',(select count(*) from public.league_report_delivery_runs run where run.league_id=target_league_id and run.status='queued'),
      'processing',(select count(*) from public.league_report_delivery_runs run where run.league_id=target_league_id and run.status='processing'),
      'delivered',(select count(*) from public.league_report_delivery_runs run where run.league_id=target_league_id and run.status='delivered'),
      'failed',(select count(*) from public.league_report_delivery_runs run where run.league_id=target_league_id and run.status='failed'),
      'due_definitions',(select count(*) from public.league_report_definitions definition where definition.league_id=target_league_id and definition.active and definition.send_email and definition.next_run_on<=current_date),
      'automation_ready',true
    )
  );
end;
$$;

create or replace function public.upsert_league_report_definition(target_league_id uuid, definition_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); target_id uuid:=nullif(definition_data->>'id','')::uuid;
  safe_name text:=trim(coalesce(definition_data->>'name','')); safe_report_type text:=lower(trim(coalesce(definition_data->>'report_type','executive')));
  safe_cadence text:=lower(trim(coalesce(definition_data->>'cadence','manual'))); safe_delivery_format text:=lower(trim(coalesce(definition_data->>'delivery_format','html')));
  safe_recipients text[]:='{}'::text[]; safe_filters jsonb:=coalesce(definition_data->'filters','{}'::jsonb);
  safe_next_run_on date:=nullif(definition_data->>'next_run_on','')::date; safe_active boolean:=coalesce((definition_data->>'active')::boolean,true);
  safe_distribution_list_id uuid:=nullif(definition_data->>'distribution_list_id','')::uuid;
  safe_freshness_hours integer:=greatest(1,least(coalesce((definition_data->>'freshness_hours')::integer,24),168));
  safe_send_email boolean:=coalesce((definition_data->>'send_email')::boolean,true); safe_archive_runs boolean:=coalesce((definition_data->>'archive_runs')::boolean,true);
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if safe_name='' then raise exception 'A report name is required' using errcode='22023'; end if;
  if safe_report_type not in ('executive','competitions','clubs','officials','governance','funding_evidence') then raise exception 'Invalid report type' using errcode='22023'; end if;
  if safe_cadence not in ('manual','weekly','monthly','quarterly','annual') then raise exception 'Invalid report cadence' using errcode='22023'; end if;
  if safe_delivery_format not in ('html','csv','xls') then raise exception 'Invalid report format' using errcode='22023'; end if;
  if jsonb_typeof(safe_filters)<>'object' then raise exception 'Report filters must be an object' using errcode='22023'; end if;
  select coalesce(array_agg(distinct lower(trim(value))) filter(where trim(value)<>''),'{}'::text[]) into safe_recipients from jsonb_array_elements_text(coalesce(definition_data->'recipients','[]'::jsonb)) row_value(value);
  if exists(select 1 from unnest(safe_recipients) email where email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Every report recipient must be a valid email address' using errcode='22023'; end if;
  if safe_distribution_list_id is not null and not exists(select 1 from public.league_report_distribution_lists list_value where list_value.id=safe_distribution_list_id and list_value.league_id=target_league_id) then raise exception 'Distribution list does not belong to this league' using errcode='22023'; end if;
  if target_id is null then
    insert into public.league_report_definitions(league_id,name,report_type,cadence,delivery_format,recipients,distribution_list_id,filters,next_run_on,freshness_hours,send_email,archive_runs,active,created_by)
    values(target_league_id,safe_name,safe_report_type,safe_cadence,safe_delivery_format,safe_recipients,safe_distribution_list_id,safe_filters,safe_next_run_on,safe_freshness_hours,safe_send_email,safe_archive_runs,safe_active,actor_id) returning id into target_id;
  else
    update public.league_report_definitions set name=safe_name,report_type=safe_report_type,cadence=safe_cadence,delivery_format=safe_delivery_format,recipients=safe_recipients,distribution_list_id=safe_distribution_list_id,filters=safe_filters,next_run_on=safe_next_run_on,freshness_hours=safe_freshness_hours,send_email=safe_send_email,archive_runs=safe_archive_runs,active=safe_active,updated_at=now()
    where id=target_id and league_id=target_league_id;
    if not found then raise exception 'Report definition not found' using errcode='P0002'; end if;
  end if;
  perform private.write_league_audit(target_league_id,'league.report_definition_saved','report_definition',target_id,jsonb_build_object('name',safe_name,'report_type',safe_report_type,'cadence',safe_cadence,'format',safe_delivery_format));
  return target_id;
end;
$$;

create or replace function public.queue_league_report_delivery(target_league_id uuid, target_definition_id uuid, target_snapshot_id uuid, request_source text default 'manual')
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid:=auth.uid(); target_run_id uuid; definition_row public.league_report_definitions%rowtype; list_recipients text[]:='{}'::text[]; safe_recipients text[]:='{}'::text[];
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  select * into definition_row from public.league_report_definitions where id=target_definition_id and league_id=target_league_id;
  if definition_row.id is null then raise exception 'Report definition not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.league_report_snapshots snapshot where snapshot.id=target_snapshot_id and snapshot.league_id=target_league_id and snapshot.report_type=definition_row.report_type) then raise exception 'Matching report snapshot not found' using errcode='22023'; end if;
  if definition_row.distribution_list_id is not null then select recipients into list_recipients from public.league_report_distribution_lists where id=definition_row.distribution_list_id and league_id=target_league_id and active; end if;
  select coalesce(array_agg(distinct lower(trim(email))) filter(where trim(email)<>''),'{}'::text[]) into safe_recipients from unnest(definition_row.recipients||coalesce(list_recipients,'{}'::text[])) email;
  insert into public.league_report_delivery_runs(league_id,definition_id,snapshot_id,report_type,delivery_format,recipients,recipient_count,requested_source,status,requested_by)
  values(target_league_id,target_definition_id,target_snapshot_id,definition_row.report_type,definition_row.delivery_format,safe_recipients,cardinality(safe_recipients),case when request_source in ('manual','api','retry') then request_source else 'manual' end,'queued',actor_id)
  on conflict (definition_id) where definition_id is not null and status in ('queued','processing') do update set snapshot_id=excluded.snapshot_id,recipients=excluded.recipients,recipient_count=excluded.recipient_count,updated_at=now()
  returning id into target_run_id;
  perform private.write_league_audit(target_league_id,'league.report_delivery_queued','report_delivery',target_run_id,jsonb_build_object('definition_id',target_definition_id,'recipients',cardinality(safe_recipients)));
  return target_run_id;
end;
$$;

create or replace function public.retry_league_report_delivery(target_league_id uuid, target_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  update public.league_report_delivery_runs set status='queued',requested_source='retry',next_attempt_at=now(),error_code=null,error_message=null,completed_at=null,updated_at=now()
  where id=target_run_id and league_id=target_league_id and status in ('failed','cancelled','skipped');
  if not found then raise exception 'Only failed or cancelled report runs can be retried' using errcode='22023'; end if;
end;
$$;

create or replace function public.enqueue_due_league_report_deliveries()
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare queued_count integer:=0; skipped_count integer:=0;
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode='42501'; end if;

  insert into public.league_report_delivery_runs(
    league_id,definition_id,snapshot_id,report_type,delivery_format,recipients,recipient_count,
    requested_source,status,error_code,error_message,completed_at
  )
  select definition.league_id,definition.id,null,definition.report_type,definition.delivery_format,
    recipient_values.recipients,cardinality(recipient_values.recipients),'scheduled','skipped',
    'REPORT_SNAPSHOT_MISSING','No governed report snapshot is available. Open Analytics and Reports to refresh the reporting data.',now()
  from public.league_report_definitions definition
  left join public.league_report_distribution_lists list_value on list_value.id=definition.distribution_list_id and list_value.active
  left join lateral (
    select report_snapshot.id from public.league_report_snapshots report_snapshot
    where report_snapshot.league_id=definition.league_id and report_snapshot.report_type=definition.report_type
      and (nullif(definition.filters->>'seasonId','') is null or report_snapshot.season_id::text=definition.filters->>'seasonId')
    order by report_snapshot.created_at desc limit 1
  ) snapshot on true
  cross join lateral (
    select coalesce(array_agg(distinct lower(trim(email))) filter(where trim(email)<>''),'{}'::text[]) as recipients
    from unnest(definition.recipients||coalesce(list_value.recipients,'{}'::text[])) as email
  ) recipient_values
  where definition.active and definition.send_email and definition.cadence<>'manual'
    and definition.next_run_on is not null and definition.next_run_on<=current_date and snapshot.id is null
    and not exists(
      select 1 from public.league_report_delivery_runs run
      where run.definition_id=definition.id and run.status='skipped' and run.created_at::date=current_date
    );
  get diagnostics skipped_count=row_count;

  insert into public.league_report_delivery_runs(league_id,definition_id,snapshot_id,report_type,delivery_format,recipients,recipient_count,requested_source,status)
  select definition.league_id,definition.id,snapshot.id,definition.report_type,definition.delivery_format,
    recipient_values.recipients,cardinality(recipient_values.recipients),'scheduled','queued'
  from public.league_report_definitions definition
  left join public.league_report_distribution_lists list_value on list_value.id=definition.distribution_list_id and list_value.active
  join lateral (
    select report_snapshot.id from public.league_report_snapshots report_snapshot
    where report_snapshot.league_id=definition.league_id and report_snapshot.report_type=definition.report_type
      and (nullif(definition.filters->>'seasonId','') is null or report_snapshot.season_id::text=definition.filters->>'seasonId')
    order by report_snapshot.created_at desc limit 1
  ) snapshot on true
  cross join lateral (
    select coalesce(array_agg(distinct lower(trim(email))) filter(where trim(email)<>''),'{}'::text[]) as recipients
    from unnest(definition.recipients||coalesce(list_value.recipients,'{}'::text[])) as email
  ) recipient_values
  where definition.active and definition.send_email and definition.cadence<>'manual'
    and definition.next_run_on is not null and definition.next_run_on<=current_date
    and not exists(select 1 from public.league_report_delivery_runs run where run.definition_id=definition.id and run.status in ('queued','processing'))
  on conflict do nothing;
  get diagnostics queued_count=row_count;
  return queued_count+skipped_count;
end;
$$;
create or replace function public.claim_league_report_delivery(target_league_id uuid, target_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); result jsonb;
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  with claimed as (
    update public.league_report_delivery_runs set status='processing',started_at=now(),attempt_count=attempt_count+1,updated_at=now()
    where id=target_run_id and league_id=target_league_id and status='queued' and (next_attempt_at is null or next_attempt_at<=now())
    returning *
  ) select to_jsonb(value_row) into result from (
    select claimed.*,definition.name as definition_name,definition.freshness_hours,definition.archive_runs,
      league.name as league_name,snapshot.created_at as snapshot_created_at,snapshot.snapshot
    from claimed left join public.league_report_definitions definition on definition.id=claimed.definition_id
    join public.leagues league on league.id=claimed.league_id
    left join public.league_report_snapshots snapshot on snapshot.id=claimed.snapshot_id
  ) value_row;
  return result;
end;
$$;

create or replace function public.claim_due_league_report_deliveries(batch_size integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare safe_batch integer:=greatest(1,least(coalesce(batch_size,20),50)); result jsonb;
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode='42501'; end if;
  with targets as (
    select id from public.league_report_delivery_runs
    where status='queued' and (next_attempt_at is null or next_attempt_at<=now())
    order by queued_at limit safe_batch for update skip locked
  ), claimed as (
    update public.league_report_delivery_runs run set status='processing',started_at=now(),attempt_count=attempt_count+1,updated_at=now()
    from targets where run.id=targets.id returning run.*
  ) select coalesce(jsonb_agg(to_jsonb(value_row)),'[]'::jsonb) into result from (
    select claimed.*,definition.name as definition_name,definition.freshness_hours,definition.archive_runs,
      league.name as league_name,snapshot.created_at as snapshot_created_at,snapshot.snapshot
    from claimed left join public.league_report_definitions definition on definition.id=claimed.definition_id
    join public.leagues league on league.id=claimed.league_id
    left join public.league_report_snapshots snapshot on snapshot.id=claimed.snapshot_id
  ) value_row;
  return result;
end;
$$;

create or replace function public.complete_league_report_delivery(
  target_run_id uuid, next_status text, provider_name text default null, provider_reference text default null,
  failure_code text default null, failure_message text default null, generated_artifact_name text default null,
  retry_after_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare run_row public.league_report_delivery_runs%rowtype; final_status text; notification_users uuid[]:='{}'::uuid[]; title_value text; detail_value text;
begin
  if not private.is_service_role() then raise exception 'Service role required' using errcode='42501'; end if;
  select * into run_row from public.league_report_delivery_runs where id=target_run_id for update;
  if run_row.id is null then raise exception 'Report delivery run not found' using errcode='P0002'; end if;
  if next_status='delivered' then final_status:='delivered';
  elsif retry_after_minutes is not null and retry_after_minutes>0 and run_row.attempt_count<3 then final_status:='queued';
  else final_status:='failed'; end if;
  update public.league_report_delivery_runs set status=final_status,provider=provider_name,provider_reference=provider_reference,error_code=failure_code,error_message=left(failure_message,5000),artifact_name=generated_artifact_name,
    completed_at=case when final_status in ('delivered','failed') then now() else null end,
    next_attempt_at=case when final_status='queued' then now()+make_interval(mins=>retry_after_minutes) else null end,updated_at=now()
  where id=target_run_id;
  if final_status='delivered' and run_row.definition_id is not null then
    update public.league_report_definitions set last_run_at=now(),next_run_on=case cadence when 'weekly' then current_date+7 when 'monthly' then (current_date+interval '1 month')::date when 'quarterly' then (current_date+interval '3 months')::date when 'annual' then (current_date+interval '1 year')::date else next_run_on end,updated_at=now()
    where id=run_row.definition_id;
  end if;
  if final_status in ('delivered','failed') then
    select coalesce(array_agg(membership.user_id),'{}'::uuid[]) into notification_users from public.league_memberships membership where membership.league_id=run_row.league_id and membership.status='active' and membership.role in ('owner','admin');
    title_value:=case when final_status='delivered' then 'League report delivered' else 'League report delivery failed' end;
    detail_value:=case when final_status='delivered' then format('%s report sent to %s recipient(s).',replace(run_row.report_type,'_',' '),run_row.recipient_count) else coalesce(failure_message,'The scheduled report could not be delivered.') end;
    insert into public.daxora_notifications(user_id,league_id,title,description,severity,category,href,action_label,workspace_type,workspace_id,workspace_name,metadata)
    select member_id,run_row.league_id,title_value,detail_value,case when final_status='delivered' then 'success' else 'error' end,'reports',format('/?main=league&lm_area=analytics&lm_view=reports'),'Open reports','league',run_row.league_id::text,(select name from public.leagues where id=run_row.league_id),jsonb_build_object('reportRunId',run_row.id,'status',final_status)
    from unnest(notification_users) member_id;
  end if;
  perform private.write_league_audit(run_row.league_id,case when final_status='delivered' then 'league.report_delivery_completed' else 'league.report_delivery_failed' end,'report_delivery',run_row.id,jsonb_build_object('status',final_status,'provider',provider_name,'error_code',failure_code));
  return jsonb_build_object('status',final_status,'user_ids',to_jsonb(notification_users));
end;
$$;

create or replace function public.capture_league_report_snapshot(
  target_league_id uuid,
  snapshot_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_snapshot_id uuid;
  safe_season_id uuid := nullif(snapshot_data->>'season_id', '')::uuid;
  safe_definition_id uuid := nullif(snapshot_data->>'definition_id', '')::uuid;
  safe_report_type text := lower(trim(coalesce(snapshot_data->>'report_type', 'executive')));
  safe_generated_from text := lower(trim(coalesce(snapshot_data->>'generated_from', 'manual')));
  safe_snapshot jsonb := coalesce(snapshot_data->'snapshot', '{}'::jsonb);
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if safe_report_type not in ('executive','competitions','clubs','officials','governance','funding_evidence') then raise exception 'Invalid report type' using errcode = '22023'; end if;
  if safe_generated_from not in ('manual','scheduled_run','release_evidence','api') then raise exception 'Invalid report source' using errcode = '22023'; end if;
  if jsonb_typeof(safe_snapshot) <> 'object' then raise exception 'Report snapshot must be an object' using errcode = '22023'; end if;
  if octet_length(safe_snapshot::text) > 750000 then raise exception 'Report snapshot is too large' using errcode = '22023'; end if;
  if safe_season_id is not null and not exists (select 1 from public.league_seasons season_value where season_value.id = safe_season_id and season_value.league_id = target_league_id) then
    raise exception 'Season does not belong to this league' using errcode = '22023';
  end if;
  if safe_definition_id is not null and not exists (
    select 1 from public.league_report_definitions definition_value
    where definition_value.id = safe_definition_id and definition_value.league_id = target_league_id
  ) then raise exception 'Report definition not found' using errcode = 'P0002'; end if;

  insert into public.league_report_snapshots(league_id, season_id, definition_id, report_type, generated_from, snapshot, created_by)
  values(target_league_id, safe_season_id, safe_definition_id, safe_report_type, safe_generated_from, safe_snapshot, actor_id)
  returning id into target_snapshot_id;

  perform private.write_league_audit(
    target_league_id,'league.report_snapshot_captured','report_snapshot',target_snapshot_id,
    jsonb_build_object('report_type', safe_report_type, 'generated_from', safe_generated_from, 'definition_id', safe_definition_id)
  );
  return target_snapshot_id;
end;
$$;
revoke all on function public.get_daxora_notification_centre(integer) from public,anon;
revoke all on function public.update_daxora_notification_preferences(jsonb) from public,anon;
revoke all on function public.create_daxora_notification(jsonb) from public,anon;
revoke all on function public.mark_daxora_notification(uuid,text) from public,anon;
revoke all on function public.mark_all_daxora_notifications(text) from public,anon;
revoke all on function public.register_daxora_push_subscription(jsonb) from public,anon;
revoke all on function public.remove_daxora_push_subscription(text) from public,anon;
revoke all on function public.get_my_daxora_push_subscriptions() from public,anon;
revoke all on function public.get_daxora_push_targets(uuid[]) from public,anon,authenticated;
revoke all on function public.deactivate_daxora_push_subscription(uuid) from public,anon,authenticated;
revoke all on function public.claim_daxora_notification_digests(integer) from public,anon,authenticated;
revoke all on function public.complete_daxora_notification_digest(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.upsert_league_report_distribution_list(uuid,jsonb) from public,anon;
revoke all on function public.delete_league_report_distribution_list(uuid,uuid) from public,anon;
revoke all on function public.queue_league_report_delivery(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.retry_league_report_delivery(uuid,uuid) from public,anon;
revoke all on function public.enqueue_due_league_report_deliveries() from public,anon,authenticated;
revoke all on function public.claim_league_report_delivery(uuid,uuid) from public,anon;
revoke all on function public.claim_due_league_report_deliveries(integer) from public,anon,authenticated;
revoke all on function public.complete_league_report_delivery(uuid,text,text,text,text,text,text,integer) from public,anon,authenticated;

grant execute on function public.get_daxora_notification_centre(integer) to authenticated;
grant execute on function public.update_daxora_notification_preferences(jsonb) to authenticated;
grant execute on function public.create_daxora_notification(jsonb) to authenticated;
grant execute on function public.mark_daxora_notification(uuid,text) to authenticated;
grant execute on function public.mark_all_daxora_notifications(text) to authenticated;
grant execute on function public.register_daxora_push_subscription(jsonb) to authenticated;
grant execute on function public.remove_daxora_push_subscription(text) to authenticated;
grant execute on function public.get_my_daxora_push_subscriptions() to authenticated;
grant execute on function public.upsert_league_report_distribution_list(uuid,jsonb) to authenticated;
grant execute on function public.delete_league_report_distribution_list(uuid,uuid) to authenticated;
grant execute on function public.queue_league_report_delivery(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.retry_league_report_delivery(uuid,uuid) to authenticated;
grant execute on function public.claim_league_report_delivery(uuid,uuid) to authenticated;
grant execute on function public.get_daxora_push_targets(uuid[]) to service_role;
grant execute on function public.deactivate_daxora_push_subscription(uuid) to service_role;
grant execute on function public.claim_daxora_notification_digests(integer) to service_role;
grant execute on function public.complete_daxora_notification_digest(uuid,text,boolean) to service_role;
grant execute on function public.enqueue_due_league_report_deliveries() to service_role;
grant execute on function public.claim_due_league_report_deliveries(integer) to service_role;
grant execute on function public.complete_league_report_delivery(uuid,text,text,text,text,text,text,integer) to service_role;

commit;
