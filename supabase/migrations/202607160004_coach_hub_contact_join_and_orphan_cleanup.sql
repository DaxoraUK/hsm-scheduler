-- Daxora Ground Control v3.10.3
-- Make Coach Hub assignments authoritative in shared team contacts and retire
-- empty bootstrap people that previously appeared as "Unnamed contact" cards.

update public.coach_hub_people person
set status = 'inactive',
    updated_at = now()
where person.status <> 'inactive'
  and person.user_id is null
  and trim(coalesce(person.display_name, '')) = ''
  and trim(coalesce(person.email, '')) = ''
  and trim(coalesce(person.mobile, '')) = ''
  and not exists (
    select 1
    from public.coach_hub_team_assignments assignment
    where assignment.person_id = person.id
      and assignment.club_id = person.club_id
      and assignment.status = 'active'
  );

create or replace function public.list_team_contacts_v2(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode='42501';
  end if;

  return coalesce((
    with contact_rows as (
      select
        contact.club_id,
        contact.team_key,
        contact.team_name,
        contact.coach_name,
        contact.coach_phone,
        contact.coach_email,
        contact.preferred_channel,
        contact.assistant_name,
        contact.assistant_phone,
        contact.assistant_email,
        contact.assistant_enabled,
        contact.receive_matchday_messages,
        contact.privacy_notice_provided_at,
        contact.last_verified_at,
        contact.updated_at
      from public.team_contacts contact
      where contact.club_id = target_club_id

      union all

      select distinct on (assignment.team_key)
        assignment.club_id,
        assignment.team_key,
        assignment.team_name,
        ''::text,
        ''::text,
        ''::text,
        'email'::text,
        ''::text,
        ''::text,
        ''::text,
        false,
        true,
        null::timestamptz,
        null::timestamptz,
        max(assignment.updated_at) over (partition by assignment.team_key)
      from public.coach_hub_team_assignments assignment
      where assignment.club_id = target_club_id
        and assignment.status = 'active'
        and not exists (
          select 1
          from public.team_contacts existing
          where existing.club_id = assignment.club_id
            and existing.team_key = assignment.team_key
        )
      order by assignment.team_key, assignment.updated_at desc
    )
    select jsonb_agg(jsonb_build_object(
      'team_key', contact.team_key,
      'team_name', contact.team_name,
      'coach_name', contact.coach_name,
      'coach_phone', contact.coach_phone,
      'coach_email', contact.coach_email,
      'preferred_channel', contact.preferred_channel,
      'assistant_name', contact.assistant_name,
      'assistant_phone', contact.assistant_phone,
      'assistant_email', contact.assistant_email,
      'assistant_enabled', contact.assistant_enabled,
      'receive_matchday_messages', contact.receive_matchday_messages,
      'privacy_notice_provided_at', contact.privacy_notice_provided_at,
      'last_verified_at', contact.last_verified_at,
      'updated_at', contact.updated_at,
      'additional_contacts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'person_id', person.id,
          'assignment_id', assignment.id,
          'name', person.display_name,
          'email', person.email,
          'mobile', person.mobile,
          'preferred_channel', person.preferred_channel,
          'staff_role', assignment.staff_role,
          'is_primary', assignment.is_primary,
          'source_slot', assignment.source_slot
        ) order by assignment.is_primary desc, assignment.staff_role, person.display_name)
        from public.coach_hub_team_assignments assignment
        join public.coach_hub_people person
          on person.id = assignment.person_id
         and person.club_id = assignment.club_id
        where assignment.club_id = contact.club_id
          and assignment.team_key = contact.team_key
          and assignment.status = 'active'
          and person.status = 'active'
      ), '[]'::jsonb)
    ) order by contact.team_name, contact.team_key)
    from contact_rows contact
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_coach_hub_admin_workspace(target_club_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode='42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501';
  end if;

  update public.coach_hub_invitations
  set status = 'expired', updated_at = now()
  where club_id = target_club_id
    and status = 'pending'
    and expires_at <= now();

  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(to_jsonb(person) - 'identity_key' order by person.display_name, person.email)
      from public.coach_hub_people person
      where person.club_id = target_club_id
        and person.status <> 'inactive'
        and (
          trim(coalesce(person.display_name, '')) <> ''
          or trim(coalesce(person.email, '')) <> ''
          or trim(coalesce(person.mobile, '')) <> ''
          or person.user_id is not null
          or exists (
            select 1
            from public.coach_hub_team_assignments assignment
            where assignment.person_id = person.id
              and assignment.club_id = person.club_id
              and assignment.status = 'active'
          )
        )
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(assignment) order by assignment.team_name, assignment.staff_role)
      from public.coach_hub_team_assignments assignment
      where assignment.club_id = target_club_id
        and assignment.status = 'active'
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(to_jsonb(invitation) - 'token_hash' order by invitation.created_at desc)
      from public.coach_hub_invitations invitation
      where invitation.club_id = target_club_id
        and invitation.status in ('pending', 'expired', 'delivery_failed')
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc)
      from public.coach_hub_requests request_row
      where request_row.club_id = target_club_id
        and request_row.status not in ('cancelled')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_team_contacts_v2(uuid) from public, anon, authenticated;
revoke all on function public.list_coach_hub_admin_workspace(uuid) from public, anon, authenticated;
grant execute on function public.list_team_contacts_v2(uuid) to authenticated;
grant execute on function public.list_coach_hub_admin_workspace(uuid) to authenticated;

notify pgrst, 'reload schema';
