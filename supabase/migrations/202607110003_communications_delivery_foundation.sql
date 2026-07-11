-- Daxora Ground Control: provider-neutral web messaging delivery foundation.
-- No provider is enabled by this migration. Vercel environment flags and
-- server-held credentials are required before any real message can be sent.

begin;

alter table public.communication_events
  drop constraint if exists communication_events_action_check;
alter table public.communication_events
  add constraint communication_events_action_check check (
    action in (
      'queue_opened', 'reviewed', 'copied', 'channel_opened',
      'queued', 'send_attempted', 'provider_accepted', 'sent',
      'delivered', 'read', 'undelivered', 'failed', 'cancelled'
    )
  );

create table if not exists public.communication_delivery_batches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_key text not null check (length(trim(request_key)) between 16 and 240),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'partial', 'failed', 'cancelled')),
  requested_count integer not null default 0 check (requested_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (club_id, request_key)
);

create table if not exists public.communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (length(trim(idempotency_key)) between 32 and 128),
  message_key text not null check (length(trim(message_key)) between 1 and 240),
  message_hash text not null default '',
  fixture_id text,
  team_key text,
  team_name text not null default '',
  recipient_type text not null check (recipient_type in ('coach', 'assistant')),
  recipient_label text not null default '',
  recipient_hint text not null default '',
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  subject text not null default '',
  message_body text not null check (length(message_body) between 10 and 4000),
  status text not null default 'queued' check (status in ('queued', 'processing', 'provider_accepted', 'sent', 'delivered', 'read', 'undelivered', 'failed', 'cancelled')),
  provider_name text,
  provider_reference text,
  provider_detail jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  provider_status_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_expires_at timestamptz not null default (now() + interval '365 days')
);

create table if not exists public.communication_batch_items (
  batch_id uuid not null references public.communication_delivery_batches(id) on delete cascade,
  delivery_id uuid not null references public.communication_deliveries(id) on delete cascade,
  client_key text not null default '',
  reused boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (batch_id, delivery_id)
);

create index if not exists communication_delivery_batches_club_time_idx
  on public.communication_delivery_batches(club_id, created_at desc);
create index if not exists communication_deliveries_club_time_idx
  on public.communication_deliveries(club_id, created_at desc);
create index if not exists communication_deliveries_dedupe_idx
  on public.communication_deliveries(club_id, idempotency_key, created_at desc);
create unique index if not exists communication_deliveries_provider_reference_idx
  on public.communication_deliveries(provider_name, provider_reference)
  where provider_name is not null and provider_reference is not null;
create index if not exists communication_deliveries_retention_idx
  on public.communication_deliveries(retention_expires_at);

create or replace function private.communication_retention_days(target_club_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select settings.retention_days
    from public.communication_privacy_settings settings
    where settings.club_id = target_club_id
  ), 365);
$$;

create or replace function private.normalise_communication_phone(value text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g');
begin
  if left(digits, 2) = '00' then digits := substring(digits from 3); end if;
  if left(digits, 1) = '0' then digits := '44' || substring(digits from 2); end if;
  if digits ~ '^[1-9][0-9]{7,14}$' then return '+' || digits; end if;
  return '';
end;
$$;

create or replace function public.validate_communication_delivery_recipients(
  target_club_id uuid,
  recipients jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_recipients jsonb := coalesce(recipients, '[]'::jsonb);
  item jsonb;
  contact public.team_contacts%rowtype;
  recipient_type text;
  channel text;
  supplied_destination text;
  expected_destination text;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_recipients) <> 'array' or jsonb_array_length(safe_recipients) < 1 then
    raise exception 'Select at least one authorised coach recipient' using errcode = '22023';
  end if;
  if jsonb_array_length(safe_recipients) > 100 then
    raise exception 'A maximum of 100 recipients can be validated in one batch' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(safe_recipients)
  loop
    select * into contact
    from public.team_contacts
    where club_id = target_club_id
      and team_key = left(trim(coalesce(item ->> 'teamKey', '')), 160)
    limit 1;

    if not found then
      raise exception 'The selected team contact is no longer available' using errcode = '22023';
    end if;
    if not contact.receive_matchday_messages then
      raise exception 'Matchday messages are disabled for %', contact.team_name using errcode = '22023';
    end if;
    if contact.privacy_notice_provided_at is null then
      raise exception 'Record the privacy notice for % before web sending', contact.team_name using errcode = '22023';
    end if;

    recipient_type := case lower(trim(coalesce(item ->> 'recipientType', 'coach')))
      when 'assistant' then 'assistant' else 'coach' end;
    channel := lower(trim(coalesce(item ->> 'channel', '')));
    if channel not in ('email', 'sms', 'whatsapp') then
      raise exception 'Unsupported communication channel' using errcode = '22023';
    end if;
    if recipient_type = 'assistant' and not contact.assistant_enabled then
      raise exception 'Assistant messages are disabled for %', contact.team_name using errcode = '22023';
    end if;

    supplied_destination := case
      when channel = 'email' then lower(trim(coalesce(item ->> 'destination', '')))
      else private.normalise_communication_phone(item ->> 'destination')
    end;
    expected_destination := case
      when recipient_type = 'assistant' and channel = 'email' then lower(trim(contact.assistant_email))
      when recipient_type = 'assistant' then private.normalise_communication_phone(contact.assistant_phone)
      when channel = 'email' then lower(trim(contact.coach_email))
      else private.normalise_communication_phone(contact.coach_phone)
    end;

    if supplied_destination = '' or expected_destination = '' or supplied_destination <> expected_destination then
      raise exception 'The selected recipient does not match the saved adult team contact' using errcode = '22023';
    end if;
  end loop;

  return true;
end;
$$;

create or replace function private.write_delivery_event(
  target_delivery_id uuid,
  next_action text,
  next_provider_name text default null,
  next_provider_reference text default null,
  next_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  delivery public.communication_deliveries%rowtype;
  event_id uuid;
begin
  select * into delivery
  from public.communication_deliveries
  where id = target_delivery_id;
  if not found then return null; end if;

  insert into public.communication_events (
    club_id, actor_user_id, message_key, message_hash, fixture_id, team_key,
    team_name, action, channel, recipient_type, recipient_label, recipient_hint,
    provider_name, provider_reference, detail, occurred_at, retention_expires_at
  ) values (
    delivery.club_id, delivery.actor_user_id, delivery.message_key, delivery.message_hash,
    delivery.fixture_id, delivery.team_key, delivery.team_name, next_action, delivery.channel,
    delivery.recipient_type, delivery.recipient_label, delivery.recipient_hint,
    nullif(trim(coalesce(next_provider_name, '')), ''),
    nullif(trim(coalesce(next_provider_reference, '')), ''),
    coalesce(next_detail, '{}'::jsonb), now(), delivery.retention_expires_at
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.create_communication_delivery_batch(
  target_club_id uuid,
  request_key text,
  messages jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_request_key text := left(trim(coalesce(request_key, '')), 240);
  safe_messages jsonb := coalesce(messages, '[]'::jsonb);
  batch_id uuid;
  item jsonb;
  existing_delivery public.communication_deliveries%rowtype;
  delivery_id uuid;
  retention integer;
  was_reused boolean;
  result_rows jsonb := '[]'::jsonb;
  privacy public.communication_privacy_settings%rowtype;
  recent_delivery_count integer := 0;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if length(safe_request_key) < 16 then
    raise exception 'A valid request key is required' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_messages) <> 'array' or jsonb_array_length(safe_messages) < 1 then
    raise exception 'Select at least one recipient' using errcode = '22023';
  end if;
  if jsonb_array_length(safe_messages) > 100 then
    raise exception 'A maximum of 100 recipients can be processed in one batch' using errcode = '22023';
  end if;

  select count(*) into recent_delivery_count
  from public.communication_deliveries delivery
  where delivery.club_id = target_club_id
    and delivery.created_at >= now() - interval '24 hours';
  if recent_delivery_count + jsonb_array_length(safe_messages) > 500 then
    raise exception 'The club web-sending safety limit has been reached for the last 24 hours' using errcode = '22023';
  end if;

  select * into privacy
  from public.communication_privacy_settings
  where club_id = target_club_id;
  if not found
    or trim(privacy.controller_name) = ''
    or trim(privacy.privacy_contact_email) = ''
    or trim(privacy.lawful_basis) = ''
    or trim(privacy.purpose) = ''
    or trim(privacy.privacy_notice_url) = ''
    or privacy.dpia_status = 'not_assessed' then
    raise exception 'Complete Privacy & contacts before using web sending' using errcode = '22023';
  end if;

  retention := private.communication_retention_days(target_club_id);
  insert into public.communication_delivery_batches (club_id, actor_user_id, request_key)
  values (target_club_id, actor_id, safe_request_key)
  on conflict (club_id, request_key) do update set updated_at = now()
  returning id into batch_id;

  for item in select value from jsonb_array_elements(safe_messages)
  loop
    if lower(trim(coalesce(item ->> 'channel', ''))) not in ('email', 'sms', 'whatsapp') then
      raise exception 'Unsupported communication channel' using errcode = '22023';
    end if;
    if length(trim(coalesce(item ->> 'idempotencyKey', ''))) < 32 then
      raise exception 'A valid delivery idempotency key is required' using errcode = '22023';
    end if;
    if length(trim(coalesce(item ->> 'messageBody', ''))) not between 10 and 4000 then
      raise exception 'Message body must contain between 10 and 4000 characters' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(target_club_id::text || ':' || (item ->> 'idempotencyKey'), 0));
    select * into existing_delivery
    from public.communication_deliveries delivery
    where delivery.club_id = target_club_id
      and delivery.idempotency_key = left(trim(item ->> 'idempotencyKey'), 128)
      and delivery.created_at >= now() - interval '24 hours'
      and delivery.status not in ('failed', 'undelivered', 'cancelled')
    order by delivery.created_at desc
    limit 1;

    was_reused := found;
    if was_reused then
      delivery_id := existing_delivery.id;
    else
      insert into public.communication_deliveries (
        club_id, actor_user_id, idempotency_key, message_key, message_hash,
        fixture_id, team_key, team_name, recipient_type, recipient_label,
        recipient_hint, channel, subject, message_body, retention_expires_at
      ) values (
        target_club_id,
        actor_id,
        left(trim(item ->> 'idempotencyKey'), 128),
        left(trim(coalesce(item ->> 'messageKey', '')), 240),
        left(trim(coalesce(item ->> 'messageHash', '')), 512),
        nullif(left(trim(coalesce(item ->> 'fixtureId', '')), 240), ''),
        nullif(left(trim(coalesce(item ->> 'teamKey', '')), 160), ''),
        left(trim(coalesce(item ->> 'teamName', '')), 180),
        case lower(trim(coalesce(item ->> 'recipientType', 'coach')))
          when 'assistant' then 'assistant' else 'coach' end,
        left(trim(coalesce(item ->> 'recipientLabel', '')), 180),
        left(trim(coalesce(item ->> 'recipientHint', '')), 80),
        lower(trim(item ->> 'channel')),
        left(trim(coalesce(item ->> 'subject', '')), 240),
        trim(item ->> 'messageBody'),
        now() + make_interval(days => retention)
      ) returning id into delivery_id;
      perform private.write_delivery_event(delivery_id, 'queued', null, null, jsonb_build_object('web_delivery', true));
    end if;

    insert into public.communication_batch_items (batch_id, delivery_id, client_key, reused)
    values (batch_id, delivery_id, left(trim(coalesce(item ->> 'clientKey', '')), 240), was_reused)
    on conflict (batch_id, delivery_id) do update set
      client_key = excluded.client_key,
      reused = communication_batch_items.reused or excluded.reused;
  end loop;

  perform public.refresh_communication_delivery_batch(batch_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', delivery.id,
    'idempotency_key', delivery.idempotency_key,
    'client_key', batch_item.client_key,
    'status', delivery.status,
    'provider_name', delivery.provider_name,
    'provider_reference', delivery.provider_reference,
    'reused', batch_item.reused
  ) order by batch_item.created_at), '[]'::jsonb)
  into result_rows
  from public.communication_batch_items batch_item
  join public.communication_deliveries delivery on delivery.id = batch_item.delivery_id
  where batch_item.batch_id = batch_id;

  return jsonb_build_object('batch_id', batch_id, 'deliveries', result_rows);
end;
$$;

create or replace function public.claim_communication_delivery(p_delivery_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  changed integer;
begin
  update public.communication_deliveries
  set status = 'processing', updated_at = now()
  where id = p_delivery_id and status = 'queued';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.complete_communication_delivery(
  p_delivery_id uuid,
  p_next_status text,
  p_provider_name text default null,
  p_provider_reference text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_provider_detail jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_status text := lower(trim(coalesce(p_next_status, '')));
  safe_provider text := nullif(lower(trim(coalesce(p_provider_name, ''))), '');
  safe_reference text := nullif(trim(coalesce(p_provider_reference, '')), '');
  changed integer;
begin
  if safe_status not in ('provider_accepted', 'sent', 'delivered', 'read', 'undelivered', 'failed', 'cancelled') then
    raise exception 'Unsupported delivery status' using errcode = '22023';
  end if;
  if safe_status in ('provider_accepted', 'sent', 'delivered', 'read') and (safe_provider is null or safe_reference is null) then
    raise exception 'Provider confirmation is required' using errcode = '22023';
  end if;

  update public.communication_deliveries
  set status = safe_status,
      provider_name = coalesce(safe_provider, public.communication_deliveries.provider_name),
      provider_reference = coalesce(safe_reference, public.communication_deliveries.provider_reference),
      provider_detail = coalesce(p_provider_detail, '{}'::jsonb),
      error_code = nullif(left(trim(coalesce(p_error_code, '')), 120), ''),
      error_message = nullif(left(trim(coalesce(p_error_message, '')), 1000), ''),
      provider_status_at = now(),
      delivered_at = case when safe_status in ('delivered', 'read') then coalesce(delivered_at, now()) else delivered_at end,
      updated_at = now()
  where id = p_delivery_id;
  get diagnostics changed = row_count;

  if changed = 1 then
    perform private.write_delivery_event(
      p_delivery_id,
      safe_status,
      safe_provider,
      safe_reference,
      jsonb_build_object(
        'error_code', nullif(left(trim(coalesce(p_error_code, '')), 120), ''),
        'error_message', nullif(left(trim(coalesce(p_error_message, '')), 1000), ''),
        'provider', coalesce(p_provider_detail, '{}'::jsonb)
      )
    );
  end if;
  return changed = 1;
end;
$$;

create or replace function public.update_communication_delivery_from_provider(
  p_provider_name text,
  p_provider_reference text,
  p_next_status text,
  p_error_code text default null,
  p_error_message text default null,
  p_provider_detail jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  delivery public.communication_deliveries%rowtype;
  safe_status text := lower(trim(coalesce(p_next_status, '')));
begin
  select * into delivery
  from public.communication_deliveries
  where public.communication_deliveries.provider_name = lower(trim(p_provider_name))
    and public.communication_deliveries.provider_reference = trim(p_provider_reference)
  limit 1;
  if not found then return false; end if;
  if delivery.status in ('delivered', 'read') and safe_status not in ('read') then return true; end if;
  if delivery.status = 'read' then return true; end if;

  perform public.complete_communication_delivery(
    delivery.id, safe_status, delivery.provider_name, delivery.provider_reference,
    p_error_code, p_error_message, p_provider_detail
  );
  perform public.refresh_communication_delivery_batch(batch_item.batch_id)
  from public.communication_batch_items batch_item
  where batch_item.delivery_id = delivery.id;
  return true;
end;
$$;

create or replace function public.refresh_communication_delivery_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  total integer := 0;
  accepted integer := 0;
  delivered integer := 0;
  failed integer := 0;
  pending integer := 0;
  next_status text := 'queued';
begin
  select
    count(*),
    count(*) filter (where delivery.status in ('provider_accepted', 'sent', 'delivered', 'read')),
    count(*) filter (where delivery.status in ('delivered', 'read')),
    count(*) filter (where delivery.status in ('failed', 'undelivered', 'cancelled')),
    count(*) filter (where delivery.status in ('queued', 'processing'))
  into total, accepted, delivered, failed, pending
  from public.communication_batch_items batch_item
  join public.communication_deliveries delivery on delivery.id = batch_item.delivery_id
  where batch_item.batch_id = p_batch_id;

  next_status := case
    when total = 0 then 'queued'
    when pending > 0 then 'processing'
    when failed = total then 'failed'
    when failed > 0 then 'partial'
    else 'completed'
  end;

  update public.communication_delivery_batches
  set status = next_status,
      requested_count = total,
      accepted_count = accepted,
      delivered_count = delivered,
      failed_count = failed,
      completed_at = case when pending = 0 and total > 0 then coalesce(completed_at, now()) else null end,
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', next_status,
    'requested_count', total,
    'accepted_count', accepted,
    'delivered_count', delivered,
    'failed_count', failed
  );
end;
$$;

create or replace function public.list_communication_delivery_batches(
  target_club_id uuid,
  result_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(result_limit, 25), 100));
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc)
    from (
      select batch.id, batch.status, batch.requested_count, batch.accepted_count,
             batch.delivered_count, batch.failed_count, batch.created_at,
             batch.updated_at, batch.completed_at,
             coalesce(profile.display_name, profile.email, batch.actor_user_id::text) as actor_label
      from public.communication_delivery_batches batch
      left join public.user_profiles profile on profile.id = batch.actor_user_id
      where batch.club_id = target_club_id
      order by batch.created_at desc
      limit safe_limit
    ) row_data
  ), '[]'::jsonb);
end;
$$;

create or replace function public.export_communication_delivery_data(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'batches', coalesce((
      select jsonb_agg(to_jsonb(batch_row) order by batch_row.created_at desc)
      from (
        select batch.id, batch.status, batch.requested_count, batch.accepted_count,
               batch.delivered_count, batch.failed_count, batch.created_at,
               batch.updated_at, batch.completed_at,
               coalesce(profile.display_name, profile.email, batch.actor_user_id::text) as actor_label
        from public.communication_delivery_batches batch
        left join public.user_profiles profile on profile.id = batch.actor_user_id
        where batch.club_id = target_club_id
        order by batch.created_at desc
      ) batch_row
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(to_jsonb(delivery_row) order by delivery_row.created_at desc)
      from (
        select delivery.id, delivery.message_key, delivery.message_hash, delivery.fixture_id,
               delivery.team_key, delivery.team_name, delivery.recipient_type,
               delivery.recipient_label, delivery.recipient_hint, delivery.channel,
               delivery.subject, delivery.message_body, delivery.status,
               delivery.provider_name, delivery.provider_reference, delivery.provider_detail,
               delivery.error_code, delivery.error_message, delivery.provider_status_at,
               delivery.delivered_at, delivery.created_at, delivery.updated_at,
               delivery.retention_expires_at,
               coalesce(profile.display_name, profile.email, delivery.actor_user_id::text) as actor_label
        from public.communication_deliveries delivery
        left join public.user_profiles profile on profile.id = delivery.actor_user_id
        where delivery.club_id = target_club_id
          and delivery.retention_expires_at > now()
        order by delivery.created_at desc
      ) delivery_row
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.purge_expired_communication_delivery_data(target_club_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  deleted_count integer := 0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  delete from public.communication_deliveries
  where club_id = target_club_id and retention_expires_at <= now();
  get diagnostics deleted_count = row_count;
  delete from public.communication_delivery_batches batch
  where batch.club_id = target_club_id
    and not exists (select 1 from public.communication_batch_items item where item.batch_id = batch.id);
  return deleted_count;
end;
$$;

alter table public.communication_delivery_batches enable row level security;
alter table public.communication_delivery_batches force row level security;
alter table public.communication_deliveries enable row level security;
alter table public.communication_deliveries force row level security;
alter table public.communication_batch_items enable row level security;
alter table public.communication_batch_items force row level security;

revoke all on public.communication_delivery_batches from public, anon, authenticated;
revoke all on public.communication_deliveries from public, anon, authenticated;
revoke all on public.communication_batch_items from public, anon, authenticated;

revoke all on function private.communication_retention_days(uuid) from public, anon, authenticated;
revoke all on function private.normalise_communication_phone(text) from public, anon, authenticated;
revoke all on function public.validate_communication_delivery_recipients(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.write_delivery_event(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_communication_delivery_batch(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_communication_delivery(uuid) from public, anon, authenticated;
revoke all on function public.complete_communication_delivery(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_communication_delivery_from_provider(text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.refresh_communication_delivery_batch(uuid) from public, anon, authenticated;
revoke all on function public.list_communication_delivery_batches(uuid, integer) from public, anon, authenticated;
revoke all on function public.export_communication_delivery_data(uuid) from public, anon, authenticated;
revoke all on function public.purge_expired_communication_delivery_data(uuid) from public, anon, authenticated;

grant execute on function public.validate_communication_delivery_recipients(uuid, jsonb) to authenticated;
grant execute on function public.create_communication_delivery_batch(uuid, text, jsonb) to authenticated;
grant execute on function public.list_communication_delivery_batches(uuid, integer) to authenticated;
grant execute on function public.export_communication_delivery_data(uuid) to authenticated;
grant execute on function public.purge_expired_communication_delivery_data(uuid) to authenticated;

grant execute on function public.claim_communication_delivery(uuid) to service_role;
grant execute on function public.complete_communication_delivery(uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.update_communication_delivery_from_provider(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.refresh_communication_delivery_batch(uuid) to service_role;

commit;
