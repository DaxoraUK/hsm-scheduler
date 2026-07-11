begin;

-- Replace the delivery-batch reservation function with identifiers that cannot
-- collide with communication_delivery_batches or communication_batch_items
-- column names. PostgreSQL treats local PL/pgSQL variables and unqualified
-- column names as potentially ambiguous, including inside ON CONFLICT clauses.
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
#variable_conflict error
declare
  v_actor_id uuid := auth.uid();
  v_safe_request_key text := left(trim(coalesce(request_key, '')), 240);
  v_safe_messages jsonb := coalesce(messages, '[]'::jsonb);
  v_batch_id uuid;
  v_item jsonb;
  v_existing_delivery public.communication_deliveries%rowtype;
  v_delivery_id uuid;
  v_retention_days integer;
  v_was_reused boolean;
  v_result_rows jsonb := '[]'::jsonb;
  v_privacy public.communication_privacy_settings%rowtype;
  v_recent_delivery_count integer := 0;
begin
  if v_actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if length(v_safe_request_key) < 16 then
    raise exception 'A valid request key is required' using errcode = '22023';
  end if;
  if jsonb_typeof(v_safe_messages) <> 'array' or jsonb_array_length(v_safe_messages) < 1 then
    raise exception 'Select at least one recipient' using errcode = '22023';
  end if;
  if jsonb_array_length(v_safe_messages) > 100 then
    raise exception 'A maximum of 100 recipients can be processed in one batch' using errcode = '22023';
  end if;

  select count(*) into v_recent_delivery_count
  from public.communication_deliveries as delivery_row
  where delivery_row.club_id = target_club_id
    and delivery_row.created_at >= now() - interval '24 hours';
  if v_recent_delivery_count + jsonb_array_length(v_safe_messages) > 500 then
    raise exception 'The club web-sending safety limit has been reached for the last 24 hours' using errcode = '22023';
  end if;

  select privacy_row.* into v_privacy
  from public.communication_privacy_settings as privacy_row
  where privacy_row.club_id = target_club_id;
  if not found
    or trim(v_privacy.controller_name) = ''
    or trim(v_privacy.privacy_contact_email) = ''
    or trim(v_privacy.lawful_basis) = ''
    or trim(v_privacy.purpose) = ''
    or trim(v_privacy.privacy_notice_url) = ''
    or v_privacy.dpia_status = 'not_assessed' then
    raise exception 'Complete Privacy & contacts before using web sending' using errcode = '22023';
  end if;

  v_retention_days := private.communication_retention_days(target_club_id);
  insert into public.communication_delivery_batches as batch_row (
    club_id,
    actor_user_id,
    request_key
  ) values (
    target_club_id,
    v_actor_id,
    v_safe_request_key
  )
  on conflict on constraint communication_delivery_batches_club_id_request_key_key
  do update set updated_at = now()
  returning batch_row.id into v_batch_id;

  for v_item in select element.value from jsonb_array_elements(v_safe_messages) as element(value)
  loop
    if lower(trim(coalesce(v_item ->> 'channel', ''))) not in ('email', 'sms', 'whatsapp') then
      raise exception 'Unsupported communication channel' using errcode = '22023';
    end if;
    if length(trim(coalesce(v_item ->> 'idempotencyKey', ''))) < 32 then
      raise exception 'A valid delivery idempotency key is required' using errcode = '22023';
    end if;
    if length(trim(coalesce(v_item ->> 'messageBody', ''))) not between 10 and 4000 then
      raise exception 'Message body must contain between 10 and 4000 characters' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(target_club_id::text || ':' || (v_item ->> 'idempotencyKey'), 0)
    );

    select delivery_row.* into v_existing_delivery
    from public.communication_deliveries as delivery_row
    where delivery_row.club_id = target_club_id
      and delivery_row.idempotency_key = left(trim(v_item ->> 'idempotencyKey'), 128)
      and delivery_row.created_at >= now() - interval '24 hours'
      and delivery_row.status not in ('failed', 'undelivered', 'cancelled')
    order by delivery_row.created_at desc
    limit 1;

    v_was_reused := found;
    if v_was_reused then
      v_delivery_id := v_existing_delivery.id;
    else
      insert into public.communication_deliveries as delivery_row (
        club_id,
        actor_user_id,
        idempotency_key,
        message_key,
        message_hash,
        fixture_id,
        team_key,
        team_name,
        recipient_type,
        recipient_label,
        recipient_hint,
        channel,
        subject,
        message_body,
        retention_expires_at
      ) values (
        target_club_id,
        v_actor_id,
        left(trim(v_item ->> 'idempotencyKey'), 128),
        left(trim(coalesce(v_item ->> 'messageKey', '')), 240),
        left(trim(coalesce(v_item ->> 'messageHash', '')), 512),
        nullif(left(trim(coalesce(v_item ->> 'fixtureId', '')), 240), ''),
        nullif(left(trim(coalesce(v_item ->> 'teamKey', '')), 160), ''),
        left(trim(coalesce(v_item ->> 'teamName', '')), 180),
        case lower(trim(coalesce(v_item ->> 'recipientType', 'coach')))
          when 'assistant' then 'assistant'
          else 'coach'
        end,
        left(trim(coalesce(v_item ->> 'recipientLabel', '')), 180),
        left(trim(coalesce(v_item ->> 'recipientHint', '')), 80),
        lower(trim(v_item ->> 'channel')),
        left(trim(coalesce(v_item ->> 'subject', '')), 240),
        trim(v_item ->> 'messageBody'),
        now() + make_interval(days => v_retention_days)
      )
      returning delivery_row.id into v_delivery_id;

      perform private.write_delivery_event(
        v_delivery_id,
        'queued',
        null,
        null,
        jsonb_build_object('web_delivery', true)
      );
    end if;

    insert into public.communication_batch_items as batch_item_row (
      batch_id,
      delivery_id,
      client_key,
      reused
    ) values (
      v_batch_id,
      v_delivery_id,
      left(trim(coalesce(v_item ->> 'clientKey', '')), 240),
      v_was_reused
    )
    on conflict on constraint communication_batch_items_pkey
    do update set
      client_key = excluded.client_key,
      reused = batch_item_row.reused or excluded.reused;
  end loop;

  perform public.refresh_communication_delivery_batch(v_batch_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', delivery_row.id,
    'idempotency_key', delivery_row.idempotency_key,
    'client_key', batch_item_row.client_key,
    'status', delivery_row.status,
    'provider_name', delivery_row.provider_name,
    'provider_reference', delivery_row.provider_reference,
    'reused', batch_item_row.reused
  ) order by batch_item_row.created_at), '[]'::jsonb)
  into v_result_rows
  from public.communication_batch_items as batch_item_row
  join public.communication_deliveries as delivery_row
    on delivery_row.id = batch_item_row.delivery_id
  where batch_item_row.batch_id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'deliveries', v_result_rows
  );
end;
$$;

revoke all on function public.create_communication_delivery_batch(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_communication_delivery_batch(uuid, text, jsonb)
  to authenticated;

commit;
