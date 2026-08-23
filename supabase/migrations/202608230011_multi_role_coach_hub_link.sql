-- Keep team-scoped coach/manager responsibilities and Coach Hub identities aligned.

create or replace function private.sync_member_role_to_coach_hub(
  target_club_id uuid,
  target_user_id uuid,
  target_role text,
  target_scope_type text,
  target_scope_id text,
  activate boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  user_row auth.users%rowtype;
  person_row public.coach_hub_people%rowtype;
  team_name_value text;
  staff_role_value text;
  email_value text;
  display_name_value text;
begin
  if lower(trim(coalesce(target_role, ''))) not in ('coach', 'team_manager')
     or lower(trim(coalesce(target_scope_type, ''))) <> 'team'
     or nullif(trim(coalesce(target_scope_id, '')), '') is null then
    return jsonb_build_object('linked', false, 'reason', 'team-scoped-coach-role-required');
  end if;

  select * into user_row from auth.users where id = target_user_id;
  if user_row.id is null then return jsonb_build_object('linked', false, 'reason', 'user-not-found'); end if;

  email_value := lower(trim(coalesce(user_row.email, '')));
  display_name_value := trim(coalesce(
    user_row.raw_user_meta_data->>'full_name',
    user_row.raw_user_meta_data->>'name',
    split_part(email_value, '@', 1),
    'Club team member'
  ));
  staff_role_value := case when lower(trim(target_role)) = 'team_manager' then 'manager' else 'coach' end;

  select person.* into person_row
  from public.coach_hub_people person
  where person.club_id = target_club_id
    and (person.user_id = target_user_id or (person.user_id is null and email_value <> '' and lower(person.email) = email_value))
  order by case when person.user_id = target_user_id then 0 else 1 end, person.created_at
  limit 1
  for update;

  if not activate then
    if person_row.id is not null then
      update public.coach_hub_team_assignments assignment
      set status = 'inactive', is_primary = false, updated_at = now()
      where assignment.club_id = target_club_id
        and assignment.person_id = person_row.id
        and assignment.team_key = trim(target_scope_id)
        and assignment.staff_role = staff_role_value;
    end if;
    return jsonb_build_object('linked', false, 'revoked', person_row.id is not null);
  end if;

  if person_row.id is null then
    insert into public.coach_hub_people (
      club_id, identity_key, display_name, email, user_id, status, last_verified_at
    ) values (
      target_club_id,
      case when email_value <> '' then 'email:' || email_value else 'user:' || target_user_id::text end,
      left(display_name_value, 160), left(email_value, 254), target_user_id, 'active', now()
    )
    returning * into person_row;
  else
    if person_row.user_id is not null and person_row.user_id <> target_user_id then
      raise exception 'This Coach Hub contact belongs to another account' using errcode = '42501';
    end if;
    update public.coach_hub_people person
    set user_id = target_user_id,
        status = 'active',
        display_name = case when trim(person.display_name) = '' then left(display_name_value, 160) else person.display_name end,
        email = case when trim(person.email) = '' then left(email_value, 254) else person.email end,
        updated_at = now()
    where person.id = person_row.id
    returning * into person_row;
  end if;

  select coalesce(nullif(contact.team_name, ''), trim(target_scope_id)) into team_name_value
  from public.team_contacts contact
  where contact.club_id = target_club_id and contact.team_key = trim(target_scope_id)
  limit 1;
  team_name_value := coalesce(team_name_value, trim(target_scope_id));

  insert into public.coach_hub_team_assignments (
    club_id, person_id, team_key, team_name, staff_role, source_slot, is_primary,
    can_request_training, can_request_friendlies, can_request_changes,
    can_view_team_contacts, can_view_costs, status
  ) values (
    target_club_id, person_row.id, trim(target_scope_id), left(team_name_value, 200),
    staff_role_value, 'manual', true, true, true, true, true, false, 'active'
  )
  on conflict (club_id, person_id, team_key, staff_role) do update set
    team_name = excluded.team_name, status = 'active', updated_at = now();

  return jsonb_build_object('linked', true, 'person_id', person_row.id, 'team_key', trim(target_scope_id));
end;
$$;

create or replace function private.sync_club_member_role_to_coach_hub_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.role_code in ('coach', 'team_manager') and new.scope_type = 'team' then
    perform private.sync_member_role_to_coach_hub(
      new.club_id, new.user_id, new.role_code, new.scope_type, new.scope_id, new.status = 'active'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists club_member_roles_sync_coach_hub on public.club_member_roles;
create trigger club_member_roles_sync_coach_hub
after insert or update of status, role_code, scope_type, scope_id on public.club_member_roles
for each row execute function private.sync_club_member_role_to_coach_hub_trigger();

create or replace function public.ensure_my_coach_hub_role_access(target_club_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  role_row record;
  linked_count integer := 0;
  sync_result jsonb;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.club_memberships membership where membership.club_id = target_club_id and membership.user_id = actor_id and membership.status = 'active') then
    raise exception 'Active club membership required' using errcode = '42501';
  end if;

  for role_row in
    select member_role.role_code, member_role.scope_type, member_role.scope_id
    from public.club_member_roles member_role
    where member_role.club_id = target_club_id and member_role.user_id = actor_id
      and member_role.status = 'active' and member_role.role_code in ('coach', 'team_manager')
      and member_role.scope_type = 'team' and nullif(member_role.scope_id, '') is not null
  loop
    sync_result := private.sync_member_role_to_coach_hub(target_club_id, actor_id, role_row.role_code, role_row.scope_type, role_row.scope_id, true);
    if coalesce((sync_result->>'linked')::boolean, false) then linked_count := linked_count + 1; end if;
  end loop;

  return jsonb_build_object('linked', linked_count > 0, 'assignment_count', linked_count);
end;
$$;

create or replace function public.archive_coach_hub_person(target_club_id uuid, target_person_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  person_row public.coach_hub_people%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode = '42501'; end if;
  select person.* into person_row from public.coach_hub_people person where person.club_id = target_club_id and person.id = target_person_id for update;
  if person_row.id is null then return false; end if;

  update public.coach_hub_team_assignments set status = 'inactive', is_primary = false, updated_at = now() where club_id = target_club_id and person_id = target_person_id;
  update public.coach_hub_invitations set status = 'revoked', revoked_at = now(), updated_at = now() where club_id = target_club_id and person_id = target_person_id and status in ('pending', 'delivery_failed');
  update public.coach_hub_calendar_feeds set status = 'revoked', revoked_at = now() where club_id = target_club_id and person_id = target_person_id and status = 'active';
  update public.coach_hub_people set status = 'inactive', user_id = null, updated_at = now() where id = target_person_id;

  if person_row.user_id is not null then
    update public.club_member_roles set status = 'revoked', updated_at = now()
    where club_id = target_club_id and user_id = person_row.user_id and role_code in ('coach', 'team_manager') and status = 'active';
  end if;
  perform public.record_audit_event(target_club_id, 'coach_hub.person.archived', 'coach_hub_person', target_person_id::text, jsonb_build_object('previous_user_id', person_row.user_id));
  return true;
end;
$$;

revoke all on function public.ensure_my_coach_hub_role_access(uuid) from public, anon, authenticated;
revoke all on function public.archive_coach_hub_person(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_my_coach_hub_role_access(uuid) to authenticated;
grant execute on function public.archive_coach_hub_person(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
