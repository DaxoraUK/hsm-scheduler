-- Daxora Ground Control: Elite integrity controls and package enforcement.
-- Aligns approval snapshots with release actions, prevents duplicate decisions,
-- enforces subscription write state at the database boundary and records exports.

begin;

-- Expire stale requests and retain only the newest duplicate pending request
-- before adding the concurrency guard.
update public.elite_approval_requests
set status = 'expired', updated_at = now(),
    decision_note = case when trim(decision_note) = '' then 'Expired automatically' else decision_note end
where status = 'pending'
  and expires_at is not null
  and expires_at <= now();

with ranked as (
  select id,
         row_number() over (
           partition by club_id, approval_type, entity_key
           order by requested_at desc, id desc
         ) as row_number
  from public.elite_approval_requests
  where status = 'pending'
)
update public.elite_approval_requests request
set status = 'cancelled',
    decision_note = 'Duplicate request superseded during Elite integrity upgrade',
    updated_at = now()
from ranked
where request.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists elite_approval_requests_one_pending_idx
  on public.elite_approval_requests(club_id, approval_type, entity_key)
  where status = 'pending';

-- A site-scoped reviewer may only review requests explicitly scoped to their
-- assigned site. Organisation-wide requests remain owner/admin decisions.
create or replace function private.can_review_elite_approval(
  target_club_id uuid,
  target_site_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.has_club_role(target_club_id, array['owner','admin'])
    or (
      nullif(trim(coalesce(target_site_id, '')), '') is not null
      and exists (
        select 1
        from public.elite_site_responsibilities responsibility
        where responsibility.club_id = target_club_id
          and responsibility.user_id = auth.uid()
          and responsibility.active = true
          and responsibility.responsibility in ('site_admin','reviewer')
          and responsibility.site_id = trim(target_site_id)
      )
    ),
    false
  );
$$;

revoke all on function private.can_review_elite_approval(uuid, text) from public, anon, authenticated;

-- Enforce suspended/cancelled read-only state on every Elite governance table,
-- even if a caller bypasses the interface and invokes a mutation RPC directly.
create or replace function private.enforce_elite_subscription_write()
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
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.enforce_elite_subscription_write() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'elite_approval_policies',
    'elite_site_responsibilities',
    'elite_approval_requests',
    'elite_communication_templates'
  ] loop
    execute format('drop trigger if exists enforce_elite_subscription_write on public.%I', table_name);
    execute format(
      'create trigger enforce_elite_subscription_write before insert or update or delete on public.%I for each row execute function private.enforce_elite_subscription_write()',
      table_name
    );
  end loop;
end;
$$;

-- Duplicate requests are serialized by club/type/key. Repeating an unchanged
-- request returns the existing pending decision rather than cancelling and
-- recreating it.
create or replace function public.create_elite_approval_request(
  target_club_id uuid,
  request_type text,
  request_entity_key text,
  request_title text,
  request_summary text default '',
  request_site_id text default null,
  request_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  policy public.elite_approval_policies;
  saved public.elite_approval_requests;
  expiry_hours integer := 168;
  safe_key text := trim(coalesce(request_entity_key, ''));
  safe_site text := nullif(trim(coalesce(request_site_id, '')), '');
begin
  if not public.can_operate_club(target_club_id) then
    raise exception 'Operational club access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'approval_workflows') then
    raise exception 'Elite approval workflows are not included in this plan' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if request_type not in ('matchweek','communications','funding_pack','executive_report') then
    raise exception 'Unsupported approval type' using errcode = '22023';
  end if;
  if length(safe_key) < 3 then
    raise exception 'Approval entity key is required' using errcode = '22023';
  end if;
  if length(trim(coalesce(request_title, ''))) < 3 then
    raise exception 'Approval title is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_club_id::text || '|' || request_type || '|' || safe_key, 0));

  update public.elite_approval_requests
  set status = 'expired', updated_at = now(),
      decision_note = case when trim(decision_note) = '' then 'Expired automatically' else decision_note end
  where club_id = target_club_id
    and status = 'pending'
    and expires_at is not null
    and expires_at <= now();

  select * into saved
  from public.elite_approval_requests
  where club_id = target_club_id
    and approval_type = request_type
    and entity_key = safe_key
    and status = 'pending'
  order by requested_at desc
  limit 1;

  if saved.id is not null then
    return to_jsonb(saved);
  end if;

  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  expiry_hours := coalesce(policy.approval_expiry_hours, 168);

  -- A new immutable snapshot supersedes older pending snapshots of the same
  -- decision type and scope.
  update public.elite_approval_requests
  set status = 'cancelled', updated_at = now(), decision_note = 'Superseded by a newer snapshot'
  where club_id = target_club_id
    and approval_type = request_type
    and coalesce(site_id, '') = coalesce(safe_site, '')
    and status = 'pending';

  insert into public.elite_approval_requests (
    club_id, approval_type, entity_key, title, summary, site_id,
    requested_by, expires_at, snapshot
  ) values (
    target_club_id, request_type, safe_key, trim(request_title),
    trim(coalesce(request_summary, '')), safe_site,
    actor_id, now() + make_interval(hours => expiry_hours), coalesce(request_snapshot, '{}'::jsonb)
  ) returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.approval.request', 'elite_approval_request',
    saved.id::text,
    jsonb_build_object(
      'approval_type', saved.approval_type,
      'entity_key', saved.entity_key,
      'site_id', saved.site_id,
      'content_hash', saved.snapshot ->> 'contentHash',
      'expires_at', saved.expires_at
    ),
    'database', null
  );
  return to_jsonb(saved);
end;
$$;

create or replace function public.decide_elite_approval(
  target_club_id uuid,
  approval_id uuid,
  decision text,
  decision_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target public.elite_approval_requests;
  policy public.elite_approval_policies;
  saved public.elite_approval_requests;
  safe_note text := trim(coalesce(decision_note, ''));
begin
  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if decision = 'rejected' and length(safe_note) < 3 then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;

  select * into target from public.elite_approval_requests
  where id = approval_id and club_id = target_club_id for update;
  if target.id is null then raise exception 'Approval request not found' using errcode = 'P0002'; end if;
  if target.status <> 'pending' then raise exception 'This approval request is no longer pending' using errcode = '40900'; end if;
  if target.expires_at is not null and target.expires_at <= now() then
    update public.elite_approval_requests
    set status = 'expired', updated_at = now(), decision_note = 'Expired automatically'
    where id = target.id;
    raise exception 'This approval request has expired' using errcode = '40900';
  end if;
  if not private.can_review_elite_approval(target_club_id, target.site_id) then
    raise exception 'Reviewer or administrator access required for this scope' using errcode = '42501';
  end if;
  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  if coalesce(policy.separation_of_duties, true) and target.requested_by = actor_id then
    raise exception 'The requester cannot approve their own item while separation of duties is enabled' using errcode = '42501';
  end if;

  update public.elite_approval_requests
  set status = decision,
      decision_by = actor_id,
      decision_at = now(),
      decision_note = safe_note,
      updated_at = now()
  where id = target.id
  returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.approval.' || decision, 'elite_approval_request',
    saved.id::text,
    jsonb_build_object(
      'approval_type', saved.approval_type,
      'entity_key', saved.entity_key,
      'site_id', saved.site_id,
      'content_hash', saved.snapshot ->> 'contentHash',
      'decision_note', saved.decision_note
    ),
    'database', null
  );
  return to_jsonb(saved);
end;
$$;

create or replace function public.cancel_elite_approval_request(
  target_club_id uuid,
  approval_id uuid,
  cancellation_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target public.elite_approval_requests;
  saved public.elite_approval_requests;
begin
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  select * into target
  from public.elite_approval_requests
  where id = approval_id and club_id = target_club_id
  for update;
  if target.id is null then raise exception 'Approval request not found' using errcode = 'P0002'; end if;
  if target.status <> 'pending' then raise exception 'Only pending requests can be cancelled' using errcode = '40900'; end if;
  if target.requested_by <> actor_id and not public.has_club_role(target_club_id, array['owner','admin']) then
    raise exception 'Only the requester or a club administrator can cancel this request' using errcode = '42501';
  end if;

  update public.elite_approval_requests
  set status = 'cancelled', decision_by = actor_id, decision_at = now(),
      decision_note = coalesce(nullif(trim(cancellation_note), ''), 'Cancelled by requester'),
      updated_at = now()
  where id = target.id
  returning * into saved;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.approval.cancelled', 'elite_approval_request',
    saved.id::text,
    jsonb_build_object('approval_type', saved.approval_type, 'entity_key', saved.entity_key, 'decision_note', saved.decision_note),
    'database', null
  );
  return to_jsonb(saved);
end;
$$;

-- The dispatch service supplies the governed templates used by the exact batch.
-- A template-level requirement remains effective even when the global switch is off.
drop function if exists public.assert_elite_communication_approval(uuid, text);
create or replace function public.assert_elite_communication_approval(
  target_club_id uuid,
  request_entity_key text,
  request_template_keys text[] default '{}'::text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  policy public.elite_approval_policies;
  approval_required boolean := false;
begin
  if not public.can_operate_club(target_club_id) then
    raise exception 'Operational club access required' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'communication_governance') then
    return true;
  end if;

  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  approval_required := coalesce(policy.communications_approval_required, true)
    or exists (
      select 1
      from public.elite_communication_templates template
      where template.club_id = target_club_id
        and template.active = true
        and template.approval_required = true
        and template.template_key = any(coalesce(request_template_keys, '{}'::text[]))
    );

  if not approval_required then return true; end if;

  if exists (
    select 1
    from public.elite_approval_requests approval
    where approval.club_id = target_club_id
      and approval.approval_type = 'communications'
      and approval.entity_key = trim(request_entity_key)
      and approval.status = 'approved'
      and (approval.expires_at is null or approval.expires_at > now())
      and (
        cardinality(coalesce(request_template_keys, '{}'::text[])) = 0
        or coalesce(approval.snapshot -> 'templates', '[]'::jsonb) @> to_jsonb(request_template_keys)
      )
  ) then return true; end if;

  raise exception 'Elite communication approval is required before this exact batch can be sent' using errcode = '42501';
end;
$$;

-- Governed downloads use the same immutable approval key and snapshot hash as
-- the visible request, and every successful release is auditable.
create or replace function public.authorise_elite_governed_export(
  target_club_id uuid,
  request_type text,
  request_entity_key text,
  export_format text default 'html',
  export_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  policy public.elite_approval_policies;
  approval_required boolean := false;
  approved public.elite_approval_requests;
  entitlement_key text;
begin
  if not public.can_read_club(target_club_id) then
    raise exception 'Club access required' using errcode = '42501';
  end if;
  if request_type not in ('funding_pack','executive_report') then
    raise exception 'Unsupported governed export type' using errcode = '22023';
  end if;

  entitlement_key := case when request_type = 'funding_pack' then 'funding_portfolio' else 'executive_reporting' end;
  if not private.club_has_entitlement(target_club_id, entitlement_key) then
    raise exception 'This governed export is not included in the current plan' using errcode = '42501';
  end if;

  select * into policy from public.elite_approval_policies where club_id = target_club_id;
  approval_required := case
    when request_type = 'funding_pack' then coalesce(policy.funding_pack_approval_required, true)
    else coalesce(policy.executive_report_approval_required, false)
  end;

  if approval_required then
    select * into approved
    from public.elite_approval_requests approval
    where approval.club_id = target_club_id
      and approval.approval_type = request_type
      and approval.entity_key = trim(request_entity_key)
      and approval.status = 'approved'
      and (approval.expires_at is null or approval.expires_at > now())
      and nullif(approval.snapshot ->> 'contentHash', '') is not null
      and approval.snapshot ->> 'contentHash' = export_snapshot ->> 'contentHash'
    order by approval.decision_at desc
    limit 1;

    if approved.id is null then
      raise exception 'Approval is required before this exact export can be released' using errcode = '42501';
    end if;
  end if;

  perform private.write_audit_event(
    target_club_id, actor_id, 'elite.export.authorised', request_type,
    trim(request_entity_key),
    jsonb_build_object(
      'format', lower(trim(coalesce(export_format, 'html'))),
      'content_hash', export_snapshot ->> 'contentHash',
      'approval_id', approved.id,
      'approval_required', approval_required
    ),
    'database', null
  );

  return jsonb_build_object(
    'authorised', true,
    'approvalRequired', approval_required,
    'approvalId', approved.id,
    'approvedBy', approved.decision_by,
    'approvedAt', approved.decision_at,
    'contentHash', export_snapshot ->> 'contentHash'
  );
end;
$$;

-- Re-establish publication with both write-state and immutable snapshot checks.
create or replace function public.save_matchweek_history(
  target_club_id uuid,
  history_id text,
  history_data jsonb,
  history_saved_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_id text := nullif(trim(coalesce(history_id, '')), '');
  day_count integer := 0;
  policy public.elite_approval_policies;
  approval_key text := nullif(trim(coalesce(history_data ->> 'approvalEntityKey', '')), '');
  approval_hash text := nullif(trim(coalesce(history_data ->> 'approvalSnapshotHash', '')), '');
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if not private.club_subscription_allows_write(target_club_id) then
    raise exception 'The current subscription is read only' using errcode = '42501';
  end if;
  if safe_id is null then raise exception 'History entry requires an id' using errcode = '22023'; end if;
  if history_data is null or jsonb_typeof(history_data) <> 'object' then
    raise exception 'History entry must be a JSON object' using errcode = '22023';
  end if;

  if private.club_has_entitlement(target_club_id, 'approval_workflows') then
    select * into policy from public.elite_approval_policies where club_id = target_club_id;
    if coalesce(policy.matchweek_approval_required, true) then
      if approval_key is null or approval_hash is null then
        raise exception 'Elite matchweek approval snapshot is required' using errcode = '42501';
      end if;
      if not exists (
        select 1
        from public.elite_approval_requests approval
        where approval.club_id = target_club_id
          and approval.approval_type = 'matchweek'
          and approval.entity_key = approval_key
          and approval.status = 'approved'
          and approval.snapshot ->> 'contentHash' = approval_hash
          and (approval.expires_at is null or approval.expires_at > now())
      ) then
        raise exception 'Elite matchweek approval is required for this exact schedule before publication' using errcode = '42501';
      end if;
    end if;
  end if;

  insert into public.history (club_id, id, data, saved_at)
  values (target_club_id, safe_id, history_data, coalesce(history_saved_at, now()))
  on conflict (club_id, id)
  do update set data = excluded.data, saved_at = excluded.saved_at, updated_at = now();

  if jsonb_typeof(history_data -> 'fixtureDays') = 'array' then
    day_count := jsonb_array_length(history_data -> 'fixtureDays');
  end if;

  perform private.write_audit_event(
    target_club_id, actor_id, 'matchweek.publish', 'matchweek', safe_id,
    jsonb_build_object(
      'date_label', nullif(history_data ->> 'dateLabel', ''),
      'fixture_day_count', day_count,
      'approval_entity_key', approval_key,
      'approval_snapshot_hash', approval_hash
    ),
    'database'
  );
end;
$$;

revoke all on function public.create_elite_approval_request(uuid, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.decide_elite_approval(uuid, uuid, text, text) from public, anon;
revoke all on function public.cancel_elite_approval_request(uuid, uuid, text) from public, anon;
revoke all on function public.assert_elite_communication_approval(uuid, text, text[]) from public, anon;
revoke all on function public.authorise_elite_governed_export(uuid, text, text, text, jsonb) from public, anon;

grant execute on function public.create_elite_approval_request(uuid, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.decide_elite_approval(uuid, uuid, text, text) to authenticated;
grant execute on function public.cancel_elite_approval_request(uuid, uuid, text) to authenticated;
grant execute on function public.assert_elite_communication_approval(uuid, text, text[]) to authenticated, service_role;
grant execute on function public.authorise_elite_governed_export(uuid, text, text, text, jsonb) to authenticated;

-- Keep per-club overrides inside the supported package vocabulary and reject
-- dependency combinations that could expose a child capability without its
-- required parent workspace.
create or replace function private.sanitise_subscription_package_overrides()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  known_entitlements constant text[] := array[
    'dashboard','club_profile','fixture_import','league_link','communications','resource_registry',
    'matchday_scheduling','midweek_scheduling','operations_advanced','pitch_intelligence',
    'parking_intelligence','weather_intelligence','officials_management','reports_operations',
    'reports_advanced','analytics_core','analytics_advanced','data_export','multi_venue',
    'priority_support','premium_support','advanced_integrations','organisation_command',
    'executive_reporting','governance_controls','approval_workflows','site_responsibility',
    'communication_governance','funding_portfolio','enhanced_audit'
  ];
  known_limits constant text[] := array['teams','venues','users','pitches','history_entries','history_retention_days'];
  effective_entitlements text[] := '{}'::text[];
  safe_entitlement_overrides jsonb := '{}'::jsonb;
  safe_limit_overrides jsonb := '{}'::jsonb;
begin
  select coalesce(jsonb_object_agg(entry.key, to_jsonb(true)), '{}'::jsonb)
  into safe_entitlement_overrides
  from jsonb_each_text(coalesce(new.entitlement_overrides, '{}'::jsonb)) entry
  where entry.key = any(known_entitlements)
    and lower(entry.value) = 'true';

  select coalesce(jsonb_object_agg(entry.key, to_jsonb(greatest(0, (entry.value)::numeric))), '{}'::jsonb)
  into safe_limit_overrides
  from jsonb_each_text(coalesce(new.limit_overrides, '{}'::jsonb)) entry
  where entry.key = any(known_limits)
    and entry.value ~ '^-?[0-9]+(\.[0-9]+)?$';

  new.entitlement_overrides := safe_entitlement_overrides;
  new.limit_overrides := safe_limit_overrides;

  select coalesce(plan.entitlements, '{}'::text[]) || coalesce(array(
    select key from jsonb_each_text(safe_entitlement_overrides) where lower(value) = 'true'
  ), '{}'::text[])
  into effective_entitlements
  from public.subscription_plans plan
  where plan.code = new.plan_code;

  if 'approval_workflows' = any(effective_entitlements)
     and not ('organisation_command' = any(effective_entitlements) and 'governance_controls' = any(effective_entitlements)) then
    raise exception 'Approval workflows require Organisation Command and governance controls' using errcode = '22023';
  end if;
  if 'site_responsibility' = any(effective_entitlements) and not 'organisation_command' = any(effective_entitlements) then
    raise exception 'Site responsibility requires Organisation Command' using errcode = '22023';
  end if;
  if 'reports_advanced' = any(effective_entitlements) and not 'reports_operations' = any(effective_entitlements) then
    raise exception 'Advanced reports require operational reports' using errcode = '22023';
  end if;
  if 'analytics_advanced' = any(effective_entitlements) and not 'analytics_core' = any(effective_entitlements) then
    raise exception 'Advanced analytics require core analytics' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.sanitise_subscription_package_overrides() from public, anon, authenticated;
drop trigger if exists sanitise_subscription_package_overrides on public.club_subscriptions;
create trigger sanitise_subscription_package_overrides
before insert or update of plan_code, entitlement_overrides, limit_overrides
on public.club_subscriptions
for each row execute function private.sanitise_subscription_package_overrides();

commit;

notify pgrst, 'reload schema';
