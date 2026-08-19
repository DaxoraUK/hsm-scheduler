begin;

-- Final hardening pass for every communication delivery function. All local
-- identifiers use v_ prefixes and every column reference is qualified so future
-- schema changes cannot reintroduce PL/pgSQL column/variable ambiguity.

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
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_safe_recipients jsonb := coalesce(recipients, '[]'::jsonb);
  v_item jsonb;
  v_contact public.team_contacts%rowtype;
  v_recipient_type text;
  v_channel text;
  v_supplied_destination text;
  v_expected_destination text;
begin
  if v_actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(v_safe_recipients) <> 'array' or jsonb_array_length(v_safe_recipients) < 1 then
    raise exception 'Select at least one authorised coach recipient' using errcode = '22023';
  end if;
  if jsonb_array_length(v_safe_recipients) > 100 then
    raise exception 'A maximum of 100 recipients can be validated in one batch' using errcode = '22023';
  end if;

  for v_item in select element.value from jsonb_array_elements(v_safe_recipients) as element(value)
  loop
    select contact_row.* into v_contact
    from public.team_contacts as contact_row
    where contact_row.club_id = target_club_id
      and contact_row.team_key = left(trim(coalesce(v_item ->> 'teamKey', '')), 160)
    limit 1;

    if not found then
      raise exception 'The selected team contact is no longer available' using errcode = '22023';
    end if;
    if not v_contact.receive_matchday_messages then
      raise exception 'Matchday messages are disabled for %', v_contact.team_name using errcode = '22023';
    end if;
    if v_contact.privacy_notice_provided_at is null then
      raise exception 'Record the privacy notice for % before web sending', v_contact.team_name using errcode = '22023';
    end if;

    v_recipient_type := case lower(trim(coalesce(v_item ->> 'recipientType', 'coach')))
      when 'assistant' then 'assistant'
      else 'coach'
    end;
    v_channel := lower(trim(coalesce(v_item ->> 'channel', '')));
    if v_channel not in ('email', 'sms', 'whatsapp') then
      raise exception 'Unsupported communication channel' using errcode = '22023';
    end if;
    if v_recipient_type = 'assistant' and not v_contact.assistant_enabled then
      raise exception 'Assistant messages are disabled for %', v_contact.team_name using errcode = '22023';
    end if;

    v_supplied_destination := case
      when v_channel = 'email' then lower(trim(coalesce(v_item ->> 'destination', '')))
      else private.normalise_communication_phone(v_item ->> 'destination')
    end;
    v_expected_destination := case
      when v_recipient_type = 'assistant' and v_channel = 'email' then lower(trim(v_contact.assistant_email))
      when v_recipient_type = 'assistant' then private.normalise_communication_phone(v_contact.assistant_phone)
      when v_channel = 'email' then lower(trim(v_contact.coach_email))
      else private.normalise_communication_phone(v_contact.coach_phone)
    end;

    if v_supplied_destination = '' or v_expected_destination = '' or v_supplied_destination <> v_expected_destination then
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
#variable_conflict error
declare
  v_delivery public.communication_deliveries%rowtype;
  v_event_id uuid;
begin
  select delivery_row.* into v_delivery
  from public.communication_deliveries as delivery_row
  where delivery_row.id = target_delivery_id;
  if not found then return null; end if;

  insert into public.communication_events (
    club_id, actor_user_id, message_key, message_hash, fixture_id, team_key,
    team_name, action, channel, recipient_type, recipient_label, recipient_hint,
    provider_name, provider_reference, detail, occurred_at, retention_expires_at
  ) values (
    v_delivery.club_id,
    v_delivery.actor_user_id,
    v_delivery.message_key,
    v_delivery.message_hash,
    v_delivery.fixture_id,
    v_delivery.team_key,
    v_delivery.team_name,
    next_action,
    v_delivery.channel,
    v_delivery.recipient_type,
    v_delivery.recipient_label,
    v_delivery.recipient_hint,
    nullif(trim(coalesce(next_provider_name, '')), ''),
    nullif(trim(coalesce(next_provider_reference, '')), ''),
    coalesce(next_detail, '{}'::jsonb),
    now(),
    v_delivery.retention_expires_at
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.claim_communication_delivery(p_delivery_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
#variable_conflict error
declare
  v_changed integer := 0;
begin
  update public.communication_deliveries as delivery_row
  set status = 'processing', updated_at = now()
  where delivery_row.id = p_delivery_id
    and delivery_row.status = 'queued';
  get diagnostics v_changed = row_count;
  return v_changed = 1;
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
#variable_conflict error
declare
  v_safe_status text := lower(trim(coalesce(p_next_status, '')));
  v_safe_provider text := nullif(lower(trim(coalesce(p_provider_name, ''))), '');
  v_safe_reference text := nullif(trim(coalesce(p_provider_reference, '')), '');
  v_changed integer := 0;
begin
  if v_safe_status not in ('provider_accepted', 'sent', 'delivered', 'read', 'undelivered', 'failed', 'cancelled') then
    raise exception 'Unsupported delivery status' using errcode = '22023';
  end if;
  if v_safe_status in ('provider_accepted', 'sent', 'delivered', 'read')
    and (v_safe_provider is null or v_safe_reference is null) then
    raise exception 'Provider confirmation is required' using errcode = '22023';
  end if;

  update public.communication_deliveries as delivery_row
  set status = v_safe_status,
      provider_name = coalesce(v_safe_provider, delivery_row.provider_name),
      provider_reference = coalesce(v_safe_reference, delivery_row.provider_reference),
      provider_detail = coalesce(p_provider_detail, '{}'::jsonb),
      error_code = nullif(left(trim(coalesce(p_error_code, '')), 120), ''),
      error_message = nullif(left(trim(coalesce(p_error_message, '')), 1000), ''),
      provider_status_at = now(),
      delivered_at = case
        when v_safe_status in ('delivered', 'read') then coalesce(delivery_row.delivered_at, now())
        else delivery_row.delivered_at
      end,
      updated_at = now()
  where delivery_row.id = p_delivery_id;
  get diagnostics v_changed = row_count;

  if v_changed = 1 then
    perform private.write_delivery_event(
      p_delivery_id,
      v_safe_status,
      v_safe_provider,
      v_safe_reference,
      jsonb_build_object(
        'error_code', nullif(left(trim(coalesce(p_error_code, '')), 120), ''),
        'error_message', nullif(left(trim(coalesce(p_error_message, '')), 1000), ''),
        'provider', coalesce(p_provider_detail, '{}'::jsonb)
      )
    );
  end if;

  return v_changed = 1;
end;
$$;

create or replace function public.refresh_communication_delivery_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
#variable_conflict error
declare
  v_total integer := 0;
  v_accepted integer := 0;
  v_delivered integer := 0;
  v_failed integer := 0;
  v_pending integer := 0;
  v_next_status text := 'queued';
begin
  select
    count(*),
    count(*) filter (where delivery_row.status in ('provider_accepted', 'sent', 'delivered', 'read')),
    count(*) filter (where delivery_row.status in ('delivered', 'read')),
    count(*) filter (where delivery_row.status in ('failed', 'undelivered', 'cancelled')),
    count(*) filter (where delivery_row.status in ('queued', 'processing'))
  into v_total, v_accepted, v_delivered, v_failed, v_pending
  from public.communication_batch_items as batch_item_row
  join public.communication_deliveries as delivery_row
    on delivery_row.id = batch_item_row.delivery_id
  where batch_item_row.batch_id = p_batch_id;

  v_next_status := case
    when v_total = 0 then 'queued'
    when v_pending > 0 then 'processing'
    when v_failed = v_total then 'failed'
    when v_failed > 0 then 'partial'
    else 'completed'
  end;

  update public.communication_delivery_batches as batch_row
  set status = v_next_status,
      requested_count = v_total,
      accepted_count = v_accepted,
      delivered_count = v_delivered,
      failed_count = v_failed,
      completed_at = case
        when v_pending = 0 and v_total > 0 then coalesce(batch_row.completed_at, now())
        else null
      end,
      updated_at = now()
  where batch_row.id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', v_next_status,
    'requested_count', v_total,
    'accepted_count', v_accepted,
    'delivered_count', v_delivered,
    'failed_count', v_failed
  );
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
#variable_conflict error
declare
  v_delivery public.communication_deliveries%rowtype;
  v_safe_status text := lower(trim(coalesce(p_next_status, '')));
  v_batch_id uuid;
begin
  select delivery_row.* into v_delivery
  from public.communication_deliveries as delivery_row
  where delivery_row.provider_name = lower(trim(p_provider_name))
    and delivery_row.provider_reference = trim(p_provider_reference)
  limit 1;

  if not found then return false; end if;
  if v_delivery.status in ('delivered', 'read') and v_safe_status <> 'read' then return true; end if;
  if v_delivery.status = 'read' then return true; end if;

  perform public.complete_communication_delivery(
    v_delivery.id,
    v_safe_status,
    v_delivery.provider_name,
    v_delivery.provider_reference,
    p_error_code,
    p_error_message,
    p_provider_detail
  );

  for v_batch_id in
    select batch_item_row.batch_id
    from public.communication_batch_items as batch_item_row
    where batch_item_row.delivery_id = v_delivery.id
  loop
    perform public.refresh_communication_delivery_batch(v_batch_id);
  end loop;

  return true;
end;
$$;

revoke all on function public.validate_communication_delivery_recipients(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.write_delivery_event(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_communication_delivery(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_communication_delivery(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.refresh_communication_delivery_batch(uuid)
  from public, anon, authenticated;
revoke all on function public.update_communication_delivery_from_provider(text, text, text, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.validate_communication_delivery_recipients(uuid, jsonb)
  to authenticated;
grant execute on function public.claim_communication_delivery(uuid)
  to service_role;
grant execute on function public.complete_communication_delivery(uuid, text, text, text, text, text, jsonb)
  to service_role;
grant execute on function public.refresh_communication_delivery_batch(uuid)
  to service_role;
grant execute on function public.update_communication_delivery_from_provider(text, text, text, text, text, jsonb)
  to service_role;

commit;
