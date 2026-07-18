-- Daxora Ground Control v3.10.13
-- Unified facility analytics inputs and safe management of team-sourced Coach Hub assignments.

begin;

create or replace function private.sync_team_contact_to_coach_hub()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  resolved_person_id uuid;
  existing_assignment public.coach_hub_team_assignments%rowtype;
  identity_value text;
  default_role text;
  slot_value text;
  name_value text;
  email_value text;
  phone_value text;
  enabled_value boolean;
begin
  if current_setting('daxora.syncing_coach_hub_person', true) = '1' then
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.coach_hub_team_assignments assignment
    set status = 'inactive', is_primary = false, updated_at = now()
    where assignment.club_id = old.club_id
      and assignment.team_key = old.team_key
      and assignment.source_slot in ('coach', 'assistant');
    return old;
  end if;

  if tg_op = 'UPDATE' and old.team_key is distinct from new.team_key then
    update public.coach_hub_team_assignments assignment
    set status = 'inactive', is_primary = false, updated_at = now()
    where assignment.club_id = old.club_id
      and assignment.team_key = old.team_key
      and assignment.source_slot in ('coach', 'assistant');
  end if;

  for slot_value, default_role, name_value, email_value, phone_value, enabled_value in
    select 'coach', 'manager', new.coach_name, lower(trim(new.coach_email)), new.coach_phone, true
    union all
    select 'assistant', 'assistant', new.assistant_name, lower(trim(new.assistant_email)), new.assistant_phone, new.assistant_enabled
  loop
    select assignment.* into existing_assignment
    from public.coach_hub_team_assignments assignment
    where assignment.club_id = new.club_id
      and assignment.team_key = new.team_key
      and assignment.source_slot = slot_value
    order by (assignment.status = 'active') desc, assignment.updated_at desc
    limit 1
    for update;

    if not enabled_value or (
      trim(coalesce(name_value, '')) = ''
      and trim(coalesce(email_value, '')) = ''
      and trim(coalesce(phone_value, '')) = ''
    ) then
      update public.coach_hub_team_assignments assignment
      set status = 'inactive', is_primary = false, updated_at = now()
      where assignment.club_id = new.club_id
        and assignment.team_key = new.team_key
        and assignment.source_slot = slot_value;
      continue;
    end if;

    identity_value := private.coach_identity_key(email_value, name_value, new.team_key, slot_value);

    insert into public.coach_hub_people (
      club_id, identity_key, display_name, email, mobile, preferred_channel,
      privacy_notice_provided_at, last_verified_at, status
    ) values (
      new.club_id,
      identity_value,
      trim(coalesce(name_value, '')),
      lower(trim(coalesce(email_value, ''))),
      trim(coalesce(phone_value, '')),
      case when new.preferred_channel in ('email', 'sms', 'whatsapp') then new.preferred_channel else 'email' end,
      new.privacy_notice_provided_at,
      new.last_verified_at,
      'active'
    )
    on conflict (club_id, identity_key) do update set
      display_name = excluded.display_name,
      email = excluded.email,
      mobile = excluded.mobile,
      preferred_channel = excluded.preferred_channel,
      privacy_notice_provided_at = coalesce(excluded.privacy_notice_provided_at, public.coach_hub_people.privacy_notice_provided_at),
      last_verified_at = coalesce(excluded.last_verified_at, public.coach_hub_people.last_verified_at),
      status = 'active',
      updated_at = now()
    returning id into resolved_person_id;

    update public.coach_hub_team_assignments assignment
    set status = 'inactive', is_primary = false, updated_at = now()
    where assignment.club_id = new.club_id
      and assignment.team_key = new.team_key
      and assignment.source_slot = slot_value
      and assignment.id is distinct from existing_assignment.id;

    if existing_assignment.id is not null then
      update public.coach_hub_team_assignments assignment
      set person_id = resolved_person_id,
          team_name = new.team_name,
          staff_role = coalesce(nullif(existing_assignment.staff_role, ''), default_role),
          source_slot = slot_value,
          status = 'active',
          updated_at = now()
      where assignment.id = existing_assignment.id;
    else
      insert into public.coach_hub_team_assignments (
        club_id, person_id, team_key, team_name, staff_role, source_slot, is_primary,
        can_request_training, can_request_friendlies, can_request_changes,
        can_view_team_contacts, can_view_costs, status
      ) values (
        new.club_id, resolved_person_id, new.team_key, new.team_name, default_role, slot_value, slot_value = 'coach',
        true, true, true, true, false, 'active'
      );
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.upsert_coach_hub_person(target_club_id uuid, person_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_person_id uuid := nullif(person_data->>'id', '')::uuid;
  existing public.coach_hub_people%rowtype;
  result public.coach_hub_people%rowtype;
  name_value text := left(trim(coalesce(person_data->>'display_name', '')), 160);
  email_value text := left(lower(trim(coalesce(person_data->>'email', ''))), 254);
  mobile_value text := left(trim(coalesce(person_data->>'mobile', '')), 40);
  channel_value text := lower(trim(coalesce(person_data->>'preferred_channel', 'email')));
  identity_value text;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode = '42501';
  end if;
  if name_value = '' then
    raise exception 'Coach name is required' using errcode = '22023';
  end if;
  if email_value = '' and mobile_value = '' then
    raise exception 'Add an email address or mobile number' using errcode = '22023';
  end if;
  if channel_value not in ('email', 'sms', 'whatsapp', 'in_app') then channel_value := 'email'; end if;

  if target_person_id is not null then
    select person.* into existing
    from public.coach_hub_people person
    where person.id = target_person_id and person.club_id = target_club_id
    for update;
    if existing.id is null then raise exception 'Coach contact not found' using errcode = 'P0002'; end if;

    if email_value <> '' and exists (
      select 1 from public.coach_hub_people person
      where person.club_id = target_club_id
        and person.id <> target_person_id
        and lower(person.email) = email_value
        and person.status <> 'inactive'
    ) then
      raise exception 'Another coach already uses this email address' using errcode = '23505';
    end if;

    update public.coach_hub_people
    set display_name = name_value,
        email = email_value,
        mobile = mobile_value,
        preferred_channel = channel_value,
        status = 'active',
        updated_at = now()
    where id = target_person_id
    returning * into result;
  else
    identity_value := case when email_value <> '' then 'email:' || email_value else 'manual:' || gen_random_uuid()::text end;
    insert into public.coach_hub_people (club_id, identity_key, display_name, email, mobile, preferred_channel, status)
    values (target_club_id, identity_value, name_value, email_value, mobile_value, channel_value, 'active')
    on conflict (club_id, identity_key) do update set
      display_name = excluded.display_name,
      email = excluded.email,
      mobile = excluded.mobile,
      preferred_channel = excluded.preferred_channel,
      status = 'active',
      updated_at = now()
    returning * into result;
  end if;

  perform set_config('daxora.syncing_coach_hub_person', '1', true);

  update public.team_contacts contact
  set coach_name = case when assignment.source_slot = 'coach' then result.display_name else contact.coach_name end,
      coach_email = case when assignment.source_slot = 'coach' then result.email else contact.coach_email end,
      coach_phone = case when assignment.source_slot = 'coach' then result.mobile else contact.coach_phone end,
      assistant_name = case when assignment.source_slot = 'assistant' then result.display_name else contact.assistant_name end,
      assistant_email = case when assignment.source_slot = 'assistant' then result.email else contact.assistant_email end,
      assistant_phone = case when assignment.source_slot = 'assistant' then result.mobile else contact.assistant_phone end,
      preferred_channel = case when result.preferred_channel in ('email', 'sms', 'whatsapp') then result.preferred_channel else contact.preferred_channel end,
      last_verified_at = now(),
      updated_at = now()
  from public.coach_hub_team_assignments assignment
  where assignment.person_id = result.id
    and assignment.club_id = contact.club_id
    and assignment.team_key = contact.team_key
    and assignment.source_slot in ('coach', 'assistant')
    and assignment.status = 'active'
    and contact.club_id = target_club_id;

  perform set_config('daxora.syncing_coach_hub_person', '0', true);

  perform public.record_audit_event(
    target_club_id,
    case when target_person_id is null then 'coach_hub.person.created' else 'coach_hub.person.updated' end,
    'coach_hub_person',
    result.id::text,
    jsonb_build_object('email', result.email, 'preferred_channel', result.preferred_channel)
  );

  return to_jsonb(result) - 'identity_key';
end;
$$;

create or replace function public.save_coach_hub_team_assignment(target_club_id uuid, assignment_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_assignment_id uuid := nullif(assignment_data->>'id', '')::uuid;
  target_person_id uuid := nullif(assignment_data->>'person_id', '')::uuid;
  team_key_value text := left(trim(coalesce(assignment_data->>'team_key', '')), 160);
  team_name_value text := left(trim(coalesce(assignment_data->>'team_name', '')), 200);
  role_value text := lower(trim(coalesce(assignment_data->>'staff_role', 'coach')));
  primary_value boolean := coalesce(nullif(assignment_data->>'is_primary', '')::boolean, false);
  existing public.coach_hub_team_assignments%rowtype;
  result public.coach_hub_team_assignments%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if not private.club_has_entitlement(target_club_id, 'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode = '42501';
  end if;
  if target_person_id is null or not exists (
    select 1 from public.coach_hub_people person
    where person.id = target_person_id and person.club_id = target_club_id and person.status = 'active'
  ) then
    raise exception 'Coach contact not found' using errcode = 'P0002';
  end if;
  if team_key_value = '' or team_name_value = '' then raise exception 'Choose a team' using errcode = '22023'; end if;
  if role_value not in ('manager', 'lead_coach', 'coach', 'assistant', 'team_secretary', 'welfare', 'emergency_contact') then
    raise exception 'Unsupported team role' using errcode = '22023';
  end if;

  if target_assignment_id is not null then
    select assignment.* into existing
    from public.coach_hub_team_assignments assignment
    where assignment.id = target_assignment_id and assignment.club_id = target_club_id
    for update;
    if existing.id is null then raise exception 'Team assignment not found' using errcode = 'P0002'; end if;
    if existing.source_slot in ('coach', 'assistant') and existing.team_key <> team_key_value then
      raise exception 'Open Team settings to move a team-managed contact' using errcode = '22023';
    end if;
  end if;

  if primary_value then
    update public.coach_hub_team_assignments assignment
    set is_primary = false, updated_at = now()
    where assignment.club_id = target_club_id
      and assignment.team_key = team_key_value
      and assignment.status = 'active'
      and assignment.id is distinct from target_assignment_id;
  end if;

  if target_assignment_id is not null then
    update public.coach_hub_team_assignments assignment
    set person_id = target_person_id,
        team_key = case when existing.source_slot in ('coach', 'assistant') then existing.team_key else team_key_value end,
        team_name = case when existing.source_slot in ('coach', 'assistant') then existing.team_name else team_name_value end,
        staff_role = role_value,
        source_slot = case when existing.source_slot in ('coach', 'assistant') then existing.source_slot else 'directory' end,
        is_primary = primary_value,
        can_request_training = coalesce(nullif(assignment_data->>'can_request_training', '')::boolean, true),
        can_request_friendlies = coalesce(nullif(assignment_data->>'can_request_friendlies', '')::boolean, true),
        can_request_changes = coalesce(nullif(assignment_data->>'can_request_changes', '')::boolean, true),
        can_view_team_contacts = coalesce(nullif(assignment_data->>'can_view_team_contacts', '')::boolean, true),
        can_view_costs = coalesce(nullif(assignment_data->>'can_view_costs', '')::boolean, false),
        status = 'active',
        updated_at = now()
    where assignment.id = target_assignment_id
    returning * into result;
  else
    insert into public.coach_hub_team_assignments (
      club_id, person_id, team_key, team_name, staff_role, source_slot, is_primary,
      can_request_training, can_request_friendlies, can_request_changes,
      can_view_team_contacts, can_view_costs, status
    ) values (
      target_club_id, target_person_id, team_key_value, team_name_value, role_value, 'directory', primary_value,
      coalesce(nullif(assignment_data->>'can_request_training', '')::boolean, true),
      coalesce(nullif(assignment_data->>'can_request_friendlies', '')::boolean, true),
      coalesce(nullif(assignment_data->>'can_request_changes', '')::boolean, true),
      coalesce(nullif(assignment_data->>'can_view_team_contacts', '')::boolean, true),
      coalesce(nullif(assignment_data->>'can_view_costs', '')::boolean, false),
      'active'
    )
    on conflict (club_id, person_id, team_key, staff_role) do update set
      source_slot = case when public.coach_hub_team_assignments.source_slot in ('coach', 'assistant') then public.coach_hub_team_assignments.source_slot else 'directory' end,
      is_primary = excluded.is_primary,
      can_request_training = excluded.can_request_training,
      can_request_friendlies = excluded.can_request_friendlies,
      can_request_changes = excluded.can_request_changes,
      can_view_team_contacts = excluded.can_view_team_contacts,
      can_view_costs = excluded.can_view_costs,
      status = 'active',
      updated_at = now()
    returning * into result;
  end if;

  if result.id is null then raise exception 'Assignment could not be saved' using errcode = 'P0002'; end if;
  perform public.record_audit_event(
    target_club_id,
    'coach_hub.assignment.saved',
    'coach_hub_team_assignment',
    result.id::text,
    jsonb_build_object('person_id', result.person_id, 'team_key', result.team_key, 'staff_role', result.staff_role, 'source_slot', result.source_slot)
  );
  return to_jsonb(result);
end;
$$;

create or replace function public.delete_coach_hub_team_assignment(target_club_id uuid, target_assignment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  assignment_row public.coach_hub_team_assignments%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  select assignment.* into assignment_row
  from public.coach_hub_team_assignments assignment
  where assignment.id = target_assignment_id and assignment.club_id = target_club_id
  for update;
  if assignment_row.id is null then return false; end if;

  update public.coach_hub_team_assignments
  set status = 'inactive', is_primary = false, updated_at = now()
  where id = target_assignment_id;

  if assignment_row.source_slot = 'coach' then
    update public.team_contacts
    set coach_name = '', coach_phone = '', coach_email = '', updated_at = now()
    where club_id = target_club_id and team_key = assignment_row.team_key;
  elsif assignment_row.source_slot = 'assistant' then
    update public.team_contacts
    set assistant_name = '', assistant_phone = '', assistant_email = '', assistant_enabled = false, updated_at = now()
    where club_id = target_club_id and team_key = assignment_row.team_key;
  end if;

  perform public.record_audit_event(
    target_club_id,
    'coach_hub.assignment.unassigned',
    'coach_hub_team_assignment',
    target_assignment_id::text,
    jsonb_build_object(
      'person_id', assignment_row.person_id,
      'team_key', assignment_row.team_key,
      'staff_role', assignment_row.staff_role,
      'source_slot', assignment_row.source_slot,
      'shared_person_retained', true
    )
  );
  return true;
end;
$$;

create or replace function public.get_annual_planner_analytics_data(target_club_id uuid, range_start date default null, range_end date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  start_boundary timestamptz := coalesce(range_start, make_date(extract(year from current_date)::integer, 1, 1))::timestamptz;
  end_boundary timestamptz := (coalesce(range_end, make_date(extract(year from current_date)::integer, 12, 31)) + 1)::timestamptz;
  can_view_costs boolean := false;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then raise exception 'Analytics access denied' using errcode = '42501'; end if;
  if not private.club_has_entitlement(target_club_id, 'analytics_core') then raise exception 'Analytics are not included in this workspace package' using errcode = '42501'; end if;
  select public.can_manage_club(target_club_id) or coalesce((select settings.show_costs_to_schedulers from public.annual_planner_settings settings where settings.club_id = target_club_id), true) into can_view_costs;

  return jsonb_build_object(
    'bookings', coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(booking) else to_jsonb(booking) - 'cost_pence' - 'supplier_reference' end order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id = target_club_id and booking.start_at < end_boundary and booking.end_at >= start_boundary), '[]'::jsonb),
    'blackouts', coalesce((select jsonb_agg(to_jsonb(blackout) order by blackout.start_at) from public.annual_planner_blackouts blackout where blackout.club_id = target_club_id and blackout.start_at < end_boundary and blackout.end_at >= start_boundary), '[]'::jsonb),
    'winter_sites', coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(site) else to_jsonb(site) - 'cost_pence' end) from public.annual_planner_sites site where site.club_id = target_club_id), '[]'::jsonb),
    'winter_slots', coalesce((select jsonb_agg(case when can_view_costs then to_jsonb(slot) else to_jsonb(slot) - 'cost_pence' end) from public.annual_planner_site_slots slot where slot.club_id = target_club_id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(request_row) - 'admin_notes' order by request_row.created_at) from public.coach_hub_requests request_row where request_row.club_id = target_club_id and request_row.created_at < end_boundary and request_row.created_at >= start_boundary), '[]'::jsonb),
    'allocation_runs', coalesce((select jsonb_agg(to_jsonb(run) order by run.created_at) from public.annual_planner_allocation_runs run where run.club_id = target_club_id and run.created_at < end_boundary and run.created_at >= start_boundary), '[]'::jsonb),
    'allocation_items', coalesce((select jsonb_agg(to_jsonb(item) order by item.created_at, item.team_name) from public.annual_planner_allocation_items item join public.annual_planner_allocation_runs run on run.id = item.run_id where item.club_id = target_club_id and run.created_at < end_boundary and run.created_at >= start_boundary), '[]'::jsonb),
    'closure_impacts', coalesce((select jsonb_agg(to_jsonb(impact) || jsonb_build_object('booking_title', booking.title, 'team_key', booking.team_key, 'team_name', booking.team_name, 'booking_start_at', booking.start_at, 'booking_end_at', booking.end_at, 'pitch_id', booking.pitch_id, 'pitch_name', booking.pitch_name, 'pitch_area_id', booking.pitch_area_id, 'pitch_area_name', booking.pitch_area_name) order by impact.created_at) from public.annual_planner_closure_impacts impact join public.annual_planner_bookings booking on booking.id = impact.booking_id where impact.club_id = target_club_id and booking.start_at < end_boundary and booking.end_at >= start_boundary), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(to_jsonb(resource) order by resource.name) from public.annual_planner_resources resource where resource.club_id = target_club_id), '[]'::jsonb),
    'waitlist', coalesce((select jsonb_agg(to_jsonb(waitlist) order by waitlist.created_at) from public.annual_planner_waitlist_entries waitlist where waitlist.club_id = target_club_id), '[]'::jsonb),
    'season_rollovers', coalesce((select jsonb_agg(to_jsonb(rollover) order by rollover.created_at) from public.annual_planner_season_rollovers rollover where rollover.club_id = target_club_id), '[]'::jsonb),
    'waitlist_offers', coalesce((select jsonb_agg(to_jsonb(offer) order by offer.created_at) from public.annual_planner_waitlist_offers offer where offer.club_id = target_club_id and offer.created_at < end_boundary and offer.created_at >= start_boundary), '[]'::jsonb),
    'bulk_commands', coalesce((select jsonb_agg(to_jsonb(command_row) order by command_row.created_at) from public.annual_planner_bulk_commands command_row where command_row.club_id = target_club_id and command_row.created_at < end_boundary and command_row.created_at >= start_boundary), '[]'::jsonb),
    'scheduling_policies', coalesce((select jsonb_agg(to_jsonb(policy) order by policy.season_phase, policy.scope_type, policy.scope_key) from public.annual_planner_scheduling_policies policy where policy.club_id = target_club_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.upsert_coach_hub_person(uuid, jsonb), public.save_coach_hub_team_assignment(uuid, jsonb), public.delete_coach_hub_team_assignment(uuid, uuid), public.get_annual_planner_analytics_data(uuid, date, date) from public, anon;
grant execute on function public.upsert_coach_hub_person(uuid, jsonb), public.save_coach_hub_team_assignment(uuid, jsonb), public.delete_coach_hub_team_assignment(uuid, uuid), public.get_annual_planner_analytics_data(uuid, date, date) to authenticated;

comment on function public.delete_coach_hub_team_assignment(uuid, uuid) is 'Unassigns one team role while retaining the shared person and all other team access.';
comment on function public.get_annual_planner_analytics_data(uuid, date, date) is 'Returns the unified Annual Planner evidence source used with saved matchday history for whole-club facility analytics.';

notify pgrst, 'reload schema';
commit;
