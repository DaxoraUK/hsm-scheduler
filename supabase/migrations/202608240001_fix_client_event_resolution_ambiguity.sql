begin;

create or replace function public.platform_resolve_client_event(
  target_event_id uuid,
  resolution_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_row public.platform_client_events%rowtype;
  next_resolution_note text := left(coalesce(resolution_note, ''), 2000);
begin
  perform private.require_platform_staff('support');

  update public.platform_client_events as client_event
  set resolved_at = now(),
      resolved_by = actor_id,
      resolution_note = next_resolution_note
  where client_event.id = target_event_id
    and client_event.resolved_at is null
  returning client_event.* into event_row;

  if event_row.id is null then
    raise exception 'Open client event not found' using errcode = 'P0002';
  end if;

  perform private.write_platform_activity(
    'client_event_resolved', event_row.club_id, 'client_event', event_row.id::text,
    jsonb_build_object('reference', event_row.reference, 'category', event_row.category)
  );

  return to_jsonb(event_row);
end;
$$;

revoke all on function public.platform_resolve_client_event(uuid, text) from public, anon, authenticated;
grant execute on function public.platform_resolve_client_event(uuid, text) to authenticated;

commit;
