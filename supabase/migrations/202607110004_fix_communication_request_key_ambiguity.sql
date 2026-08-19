begin;

-- PostgreSQL can resolve request_key as either the function argument or the
-- communication_delivery_batches column inside an ON CONFLICT column list.
-- Target the named unique constraint so the function is unambiguous.
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
  on conflict on constraint communication_delivery_batches_club_id_request_key_key do update set updated_at = now()
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


revoke all on function public.create_communication_delivery_batch(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_communication_delivery_batch(uuid, text, jsonb) to authenticated;

commit;
