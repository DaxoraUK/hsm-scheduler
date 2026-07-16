-- Daxora Ground Control v3.10.2.1: repair Coach Hub pilot metrics runtime boundaries.
begin;

create or replace function public.list_coach_hub_pilot_metrics(
  target_club_id uuid,
  range_start date default null,
  range_end date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_year integer := extract(year from current_date)::integer;
  requested_start date := coalesce(range_start, make_date(current_year, 1, 1));
  requested_end date := coalesce(range_end, make_date(current_year, 12, 31));
  start_boundary timestamptz;
  end_boundary timestamptz;
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;

  if requested_end < requested_start then
    raise exception 'Metrics end date must not be before the start date' using errcode = '22023';
  end if;

  start_boundary := requested_start::timestamptz;
  end_boundary := (requested_end + 1)::timestamptz;

  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(to_jsonb(person) - 'identity_key' order by person.display_name, person.id)
      from public.coach_hub_people person
      where person.club_id = target_club_id
        and person.status <> 'inactive'
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(assignment) order by assignment.team_key, assignment.id)
      from public.coach_hub_team_assignments assignment
      where assignment.club_id = target_club_id
        and assignment.status = 'active'
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(to_jsonb(invitation) - 'token_hash' order by invitation.created_at desc)
      from public.coach_hub_invitations invitation
      where invitation.club_id = target_club_id
        and invitation.created_at >= start_boundary
        and invitation.created_at < end_boundary
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc)
      from public.coach_hub_requests request_row
      where request_row.club_id = target_club_id
        and request_row.created_at >= start_boundary
        and request_row.created_at < end_boundary
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(
        to_jsonb(message_row) || jsonb_build_object(
          'acknowledged_at', receipt_summary.acknowledged_at
        )
        order by message_row.created_at desc
      )
      from public.coach_hub_messages message_row
      left join lateral (
        select max(receipt.acknowledged_at) as acknowledged_at
        from public.coach_hub_message_receipts receipt
        where receipt.message_id = message_row.id
      ) receipt_summary on true
      where message_row.club_id = target_club_id
        and message_row.created_at >= start_boundary
        and message_row.created_at < end_boundary
    ), '[]'::jsonb),
    'reminders', coalesce((
      select jsonb_agg(to_jsonb(reminder) order by reminder.created_at desc)
      from public.coach_hub_booking_reminders reminder
      where reminder.club_id = target_club_id
        and reminder.created_at >= start_boundary
        and reminder.created_at < end_boundary
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(to_jsonb(booking) order by booking.start_at, booking.id)
      from public.annual_planner_bookings booking
      where booking.club_id = target_club_id
        and booking.start_at >= start_boundary
        and booking.start_at < end_boundary
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_coach_hub_pilot_metrics(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.list_coach_hub_pilot_metrics(uuid, date, date)
  to authenticated;

commit;
