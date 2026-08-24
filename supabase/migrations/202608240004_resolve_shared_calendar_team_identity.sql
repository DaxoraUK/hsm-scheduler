-- Existing Annual Planner rows may carry a legacy team key while Coach Hub
-- assignments use the current team key. Resolve by exact key first, then by a
-- normalised team name, and return the current assignment identity to clients.
begin;

create or replace function public.get_coach_hub_calendar_context(
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
  coach_person_id uuid:=private.current_coach_person_id(target_club_id);
  start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days');
  end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if coach_person_id is null or not public.can_access_coach_hub(target_club_id) then
    raise exception 'Coach Hub access denied' using errcode='42501';
  end if;
  return jsonb_build_object(
    'bookings',coalesce((
      select jsonb_agg(
        to_jsonb(booking)-'cost_pence'-'supplier_reference'-'admin_notes'
        || jsonb_build_object('team_key',assignment.team_key,'team_name',assignment.team_name)
        order by booking.start_at
      )
      from public.annual_planner_bookings booking
      join lateral (
        select candidate.team_key,candidate.team_name
        from public.coach_hub_team_assignments candidate
        where candidate.person_id=coach_person_id
          and candidate.club_id=target_club_id
          and candidate.status='active'
          and (
            candidate.team_key=booking.team_key
            or (
              nullif(trim(coalesce(booking.team_name,'')),'') is not null
              and regexp_replace(lower(candidate.team_name),'[^a-z0-9]+','','g')
                = regexp_replace(lower(booking.team_name),'[^a-z0-9]+','','g')
            )
          )
        order by case when candidate.team_key=booking.team_key then 0 else 1 end,candidate.is_primary desc
        limit 1
      ) assignment on true
      where booking.club_id=target_club_id
        and booking.start_at>=start_boundary and booking.start_at<end_boundary
        and booking.status not in ('cancelled','rejected')
    ),'[]'::jsonb),
    'blackouts',coalesce((
      select jsonb_agg(
        to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by'
        || jsonb_build_object(
          'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=blackout.pitch_id limit 1),blackout.pitch_id),
          'affected_booking_count',(select count(*) from public.annual_planner_closure_impacts impact where impact.blackout_id=blackout.id and impact.status='action_required')
        ) order by blackout.start_at
      )
      from public.annual_planner_blackouts blackout
      where blackout.club_id=target_club_id
        and blackout.visibility='club'
        and blackout.start_at<end_boundary and blackout.end_at>start_boundary
    ),'[]'::jsonb),
    'pitch_closures',coalesce((
      select jsonb_agg(
        closure_row.data || jsonb_build_object(
          'id',closure_row.id,
          'pitch_id',coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id),
          'pitch_name',coalesce((select pitch.data->>'label' from public.pitches pitch where pitch.club_id=target_club_id and pitch.id=coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id) limit 1),coalesce(closure_row.data->>'pitchId',closure_row.data->>'pitch_id',closure_row.id))
        ) order by coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date')
      )
      from public.pitch_closures closure_row
      where closure_row.club_id=target_club_id
        and nullif(coalesce(closure_row.data->>'reopenedAt',closure_row.data->>'reopened_at',''),'') is null
        and coalesce(closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date <= end_boundary::date
        and (
          coalesce((closure_row.data->>'untilReopened')::boolean,(closure_row.data->>'until_reopened')::boolean,false)
          or lower(coalesce(closure_row.data->>'mode',''))='untilreopened'
          or coalesce(closure_row.data->>'effectiveTo',closure_row.data->>'effective_to',closure_row.data->>'effectiveFrom',closure_row.data->>'effective_from',closure_row.data->>'date',current_date::text)::date >= start_boundary::date
        )
    ),'[]'::jsonb),
    'closure_impacts',coalesce((
      select jsonb_agg(to_jsonb(impact) order by impact.created_at desc)
      from public.annual_planner_closure_impacts impact
      join public.annual_planner_bookings booking on booking.id=impact.booking_id
      where impact.club_id=target_club_id
        and impact.status='action_required'
        and exists (
          select 1 from public.coach_hub_team_assignments assignment
          where assignment.person_id=coach_person_id and assignment.status='active'
            and (
              assignment.team_key=booking.team_key
              or regexp_replace(lower(assignment.team_name),'[^a-z0-9]+','','g')
                = regexp_replace(lower(coalesce(booking.team_name,'')),'[^a-z0-9]+','','g')
            )
        )
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_coach_hub_calendar_context(uuid,date,date) from public,anon,authenticated;
grant execute on function public.get_coach_hub_calendar_context(uuid,date,date) to authenticated;

commit;
