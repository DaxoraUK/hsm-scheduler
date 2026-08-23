-- Safely repair Coach Hub access accepted by the wrong or unavailable login.

create or replace function public.reissue_coach_hub_access(target_club_id uuid,target_person_id uuid,expiry_hours integer default 168)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  actor_id uuid := auth.uid();
  person public.coach_hub_people%rowtype;
  previous_user_id uuid;
  raw_token text := encode(gen_random_bytes(32),'hex');
  invitation_id uuid;
  expires_value timestamptz;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501'; end if;
  select * into person from public.coach_hub_people where id=target_person_id and club_id=target_club_id and status='active' for update;
  if person.id is null then raise exception 'Coach contact not found' using errcode='P0002'; end if;
  if nullif(trim(person.email),'') is null then raise exception 'Add an email address before reissuing access' using errcode='22023'; end if;
  if not exists(select 1 from public.coach_hub_team_assignments assignment where assignment.person_id=person.id and assignment.club_id=target_club_id and assignment.status='active') then raise exception 'This contact is not assigned to an active team' using errcode='22023'; end if;

  previous_user_id := person.user_id;
  update public.coach_hub_people set user_id=null,updated_at=now() where id=person.id and club_id=target_club_id;

  -- Accepted records must also be revoked or verified-email recovery could
  -- restore the deliberately disconnected previous account.
  update public.coach_hub_invitations set status='revoked',revoked_at=now(),updated_at=now()
  where club_id=target_club_id and person_id=person.id and status in ('pending','delivery_failed','accepted');

  expires_value:=now()+make_interval(hours=>greatest(24,least(coalesce(expiry_hours,168),720)));
  insert into public.coach_hub_invitations(club_id,person_id,email,token_hash,invited_by,expires_at)
  values(target_club_id,person.id,lower(person.email),encode(digest(raw_token,'sha256'),'hex'),actor_id,expires_value)
  returning id into invitation_id;

  perform public.record_audit_event(target_club_id,'coach_hub.access.reissued','coach_hub_person',person.id::text,jsonb_build_object('previous_user_id',previous_user_id,'invitation_id',invitation_id,'email',person.email));
  return jsonb_build_object('id',invitation_id,'token',raw_token,'email',person.email,'display_name',person.display_name,'expires_at',expires_value);
end;
$$;

revoke all on function public.reissue_coach_hub_access(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.reissue_coach_hub_access(uuid,uuid,integer) to authenticated;
notify pgrst, 'reload schema';
