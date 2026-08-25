-- Club-scoped clean-start tooling. Permanent configuration and operational plans are never touched.
begin;

create or replace function public.reset_club_pilot_activity(
  target_club_id uuid,
  dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club owner or administrator access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'audit_events', (select count(*) from public.audit_events where club_id = target_club_id),
    'platform_activity_events', (select count(*) from public.platform_activity_events where club_id = target_club_id),
    'client_events', (select count(*) from public.platform_client_events where club_id = target_club_id),
    'notifications', (select count(*) from public.daxora_notifications where club_id = target_club_id),
    'coach_hub_messages', (select count(*) from public.coach_hub_messages where club_id = target_club_id),
    'coach_hub_request_messages', (select count(*) from public.coach_hub_request_messages where club_id = target_club_id),
    'communication_events', (select count(*) from public.communication_events where club_id = target_club_id),
    'dry_run', dry_run
  ) into result;

  if dry_run then return result; end if;

  delete from public.coach_hub_request_messages where club_id = target_club_id;
  delete from public.coach_hub_messages where club_id = target_club_id;
  delete from public.daxora_notifications where club_id = target_club_id;
  delete from public.communication_events where club_id = target_club_id;
  delete from public.platform_client_events where club_id = target_club_id;
  delete from public.audit_events where club_id = target_club_id;
  delete from public.platform_activity_events where club_id = target_club_id;

  insert into public.platform_activity_events (actor_user_id, club_id, action, entity_type, entity_id, detail)
  values (actor_id, null, 'club_pilot_activity_reset', 'club', target_club_id::text, result - 'dry_run');

  return result || jsonb_build_object('dry_run', false, 'completed_at', now());
end;
$$;

revoke all on function public.reset_club_pilot_activity(uuid, boolean) from public, anon, authenticated;
grant execute on function public.reset_club_pilot_activity(uuid, boolean) to authenticated;

commit;
