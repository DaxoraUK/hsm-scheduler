-- Daxora Ground Control v3.10.3.3
-- Recover Coach Hub access after email confirmation when the browser no longer
-- has the raw invitation token. The authenticated Supabase email must exactly
-- match a live invitation, so this does not broaden access beyond the invite.

create or replace function public.claim_my_pending_coach_hub_invitations()
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text := lower(trim(coalesce(auth.jwt()->>'email', '')));
  invitation_row record;
  claimed_count integer := 0;
  repaired_count integer := 0;
  claimed_club_ids uuid[] := '{}'::uuid[];
begin
  if actor_id is null then
    raise exception 'Sign in to recover Coach Hub access' using errcode = '42501';
  end if;

  if actor_email = '' then
    select lower(trim(coalesce(profile.email, '')))
      into actor_email
    from public.user_profiles profile
    where profile.id = actor_id;
  end if;

  if coalesce(actor_email, '') = '' then
    raise exception 'Your signed-in account does not have a verified email address' using errcode = '42501';
  end if;

  -- Repair any historically accepted invitation that belongs to this exact
  -- account but did not leave the person row linked after an older failed flow.
  for invitation_row in
    select invitation.id,
           invitation.club_id,
           invitation.person_id
    from public.coach_hub_invitations invitation
    join public.coach_hub_people person
      on person.id = invitation.person_id
     and person.club_id = invitation.club_id
    join public.clubs club
      on club.id = invitation.club_id
    where lower(trim(invitation.email)) = actor_email
      and invitation.status = 'accepted'
      and invitation.accepted_by = actor_id
      and (person.user_id is null or person.user_id = actor_id)
      and person.status <> 'suspended'
      and club.status = 'active'
      and exists (
        select 1
        from public.coach_hub_team_assignments assignment
        where assignment.club_id = invitation.club_id
          and assignment.person_id = invitation.person_id
          and assignment.status = 'active'
      )
    for update of invitation, person
  loop
    update public.coach_hub_people
    set user_id = actor_id,
        status = 'active',
        last_verified_at = now(),
        updated_at = now()
    where id = invitation_row.person_id
      and club_id = invitation_row.club_id
      and (user_id is null or user_id = actor_id);

    if found then
      repaired_count := repaired_count + 1;
      if not invitation_row.club_id = any(claimed_club_ids) then
        claimed_club_ids := array_append(claimed_club_ids, invitation_row.club_id);
      end if;
    end if;
  end loop;

  -- Claim live invitations by the verified JWT email. This covers the common
  -- case where confirmation opened in a different browser or private window
  -- and therefore did not carry localStorage or the original query string.
  for invitation_row in
    select invitation.id,
           invitation.club_id,
           invitation.person_id
    from public.coach_hub_invitations invitation
    join public.coach_hub_people person
      on person.id = invitation.person_id
     and person.club_id = invitation.club_id
    join public.clubs club
      on club.id = invitation.club_id
    where lower(trim(invitation.email)) = actor_email
      and invitation.status in ('pending', 'delivery_failed')
      and invitation.expires_at > now()
      and (person.user_id is null or person.user_id = actor_id)
      and person.status <> 'suspended'
      and club.status = 'active'
      and private.club_has_entitlement(invitation.club_id, 'annual_planner')
      and exists (
        select 1
        from public.coach_hub_team_assignments assignment
        where assignment.club_id = invitation.club_id
          and assignment.person_id = invitation.person_id
          and assignment.status = 'active'
      )
    order by invitation.created_at
    for update of invitation, person
  loop
    update public.coach_hub_people
    set user_id = actor_id,
        status = 'active',
        last_verified_at = now(),
        updated_at = now()
    where id = invitation_row.person_id
      and club_id = invitation_row.club_id
      and (user_id is null or user_id = actor_id);

    if not found then
      continue;
    end if;

    update public.coach_hub_invitations
    set status = 'accepted',
        accepted_by = actor_id,
        accepted_at = coalesce(accepted_at, now()),
        delivery_error = null,
        updated_at = now()
    where id = invitation_row.id
      and status in ('pending', 'delivery_failed');

    if not found then
      continue;
    end if;

    insert into public.audit_events (
      club_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      detail
    ) values (
      invitation_row.club_id,
      actor_id,
      'coach_hub.invitation.recovered_by_verified_email',
      'coach_hub_person',
      invitation_row.person_id::text,
      jsonb_build_object(
        'invitation_id', invitation_row.id,
        'recovery', 'verified_email'
      )
    );

    claimed_count := claimed_count + 1;
    if not invitation_row.club_id = any(claimed_club_ids) then
      claimed_club_ids := array_append(claimed_club_ids, invitation_row.club_id);
    end if;
  end loop;

  return jsonb_build_object(
    'claimed_count', claimed_count,
    'repaired_count', repaired_count,
    'club_ids', to_jsonb(claimed_club_ids)
  );
end;
$$;

revoke all on function public.claim_my_pending_coach_hub_invitations()
from public, anon, authenticated;

grant execute on function public.claim_my_pending_coach_hub_invitations()
to authenticated;

notify pgrst, 'reload schema';
