-- The matchday synchroniser is an operator-only RPC, but its audit helper also
-- maintains an explicit action allow-list. Add the new controlled action so a
-- successful calendar write is not rolled back at the final audit step.
begin;

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
       'annual_planner.booking.cancelled_from_coach_request',
       'matchday.calendar.synchronised'
     ) then
    raise exception 'Coach Hub audit action is not permitted' using errcode = '42501';
  end if;

  insert into public.audit_events(club_id,actor_user_id,action,entity_type,entity_id,detail)
  values (
    target_club_id,actor_id,action_value,
    nullif(trim(coalesce(entity_type, '')), ''),
    nullif(trim(coalesce(entity_id, '')), ''),
    coalesce(event_detail, '{}'::jsonb)
  ) returning id into event_id;

  return event_id;
end;
$$;

revoke all on function private.record_coach_hub_audit_event(uuid,text,text,text,jsonb)
from public,anon,authenticated;

commit;
