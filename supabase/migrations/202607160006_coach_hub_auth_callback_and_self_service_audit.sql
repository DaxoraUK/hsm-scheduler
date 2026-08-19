-- Daxora Ground Control v3.10.3.2
-- Complete Coach Hub account confirmation and self-service invitation acceptance.
--
-- The Coach Hub acceptance RPC linked the coach correctly, then called the
-- operator-only public.record_audit_event() function. PostgreSQL rolled the
-- whole transaction back with "Club operator access required". The private
-- helper below preserves audit integrity while allowing only an authenticated
-- club operator or an already-linked Coach Hub user to record controlled
-- Coach Hub self-service events.

create or replace function private.record_coach_hub_audit_event(
  target_club_id uuid,
  event_action text,
  entity_type text default null,
  entity_id text default null,
  event_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_id uuid;
  action_value text := trim(coalesce(event_action, ''));
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.can_operate_club(target_club_id)
     and not public.can_access_coach_hub(target_club_id) then
    raise exception 'Coach Hub access denied' using errcode = '42501';
  end if;

  if action_value not like 'coach_hub.%'
     and action_value not in (
       'annual_planner.booking.created_from_coach_request',
       'annual_planner.booking.changed_from_coach_request',
       'annual_planner.booking.cancelled_from_coach_request'
     ) then
    raise exception 'Coach Hub audit action is not permitted' using errcode = '42501';
  end if;

  insert into public.audit_events (
    club_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    detail
  ) values (
    target_club_id,
    actor_id,
    action_value,
    nullif(trim(coalesce(entity_type, '')), ''),
    nullif(trim(coalesce(entity_id, '')), ''),
    coalesce(event_detail, '{}'::jsonb)
  ) returning id into event_id;

  return event_id;
end;
$$;

revoke all on function private.record_coach_hub_audit_event(uuid,text,text,text,jsonb)
from public, anon, authenticated;

-- Replace the operator-only audit call only inside self-service Coach Hub
-- functions. Admin invitation creation/review functions retain the original
-- operator-only public audit function.
do $$
declare
  function_row record;
  function_definition text;
begin
  for function_row in
    select procedure_row.oid
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure_row.proname = any(array[
        'accept_coach_hub_invitation',
        'submit_coach_hub_request',
        'respond_to_coach_hub_alternative',
        'update_my_coach_hub_profile',
        'post_coach_hub_request_message',
        'verify_my_coach_hub_contact',
        'create_booking_from_coach_request'
      ])
      and procedure_row.prosrc like '%public.record_audit_event(%'
  loop
    function_definition := pg_catalog.pg_get_functiondef(function_row.oid);
    function_definition := replace(
      function_definition,
      'public.record_audit_event(',
      'private.record_coach_hub_audit_event('
    );
    execute function_definition;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
