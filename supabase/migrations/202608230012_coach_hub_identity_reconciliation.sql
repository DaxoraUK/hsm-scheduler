-- Make role access and Team-form contact synchronisation converge safely.

create or replace function private.sync_member_role_to_coach_hub(target_club_id uuid,target_user_id uuid,target_role text,target_scope_type text,target_scope_id text,activate boolean default true)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare user_row auth.users%rowtype; person_row public.coach_hub_people%rowtype; team_name_value text; staff_role_value text; email_value text; identity_value text; display_name_value text;
begin
  if lower(trim(coalesce(target_role,''))) not in ('coach','team_manager') or lower(trim(coalesce(target_scope_type,'')))<>'team' or nullif(trim(coalesce(target_scope_id,'')),'') is null then return jsonb_build_object('linked',false,'reason','team-scoped-coach-role-required'); end if;
  perform pg_advisory_xact_lock(hashtextextended(target_club_id::text||':'||target_user_id::text,0));
  select * into user_row from auth.users where id=target_user_id;
  if user_row.id is null then return jsonb_build_object('linked',false,'reason','user-not-found'); end if;
  email_value:=lower(trim(coalesce(user_row.email,''))); identity_value:=case when email_value<>'' then 'email:'||email_value else 'user:'||target_user_id::text end;
  display_name_value:=trim(coalesce(user_row.raw_user_meta_data->>'full_name',user_row.raw_user_meta_data->>'name',split_part(email_value,'@',1),'Club team member'));
  staff_role_value:=case when lower(trim(target_role))='team_manager' then 'manager' else 'coach' end;
  select person.* into person_row from public.coach_hub_people person where person.club_id=target_club_id and (person.user_id=target_user_id or person.identity_key=identity_value or (person.user_id is null and email_value<>'' and lower(person.email)=email_value)) order by case when person.user_id=target_user_id then 0 when person.identity_key=identity_value then 1 else 2 end,person.created_at limit 1 for update;
  if not activate then
    if person_row.id is not null then update public.coach_hub_team_assignments set status='inactive',is_primary=false,updated_at=now() where club_id=target_club_id and person_id=person_row.id and team_key=trim(target_scope_id) and staff_role=staff_role_value; end if;
    return jsonb_build_object('linked',false,'revoked',person_row.id is not null);
  end if;
  if person_row.id is not null and person_row.user_id is not null and person_row.user_id<>target_user_id then raise exception 'This Coach Hub contact belongs to another account' using errcode='42501'; end if;
  if person_row.id is null then
    insert into public.coach_hub_people(club_id,identity_key,display_name,email,user_id,status,last_verified_at) values(target_club_id,identity_value,left(display_name_value,160),left(email_value,254),target_user_id,'active',now())
    on conflict(club_id,identity_key) do update set user_id=case when public.coach_hub_people.user_id is null or public.coach_hub_people.user_id=target_user_id then target_user_id else public.coach_hub_people.user_id end,status='active',display_name=case when trim(public.coach_hub_people.display_name)='' then excluded.display_name else public.coach_hub_people.display_name end,email=case when trim(public.coach_hub_people.email)='' then excluded.email else public.coach_hub_people.email end,updated_at=now() returning * into person_row;
    if person_row.user_id<>target_user_id then raise exception 'This Coach Hub contact belongs to another account' using errcode='42501'; end if;
  else
    update public.coach_hub_people person set user_id=target_user_id,status='active',display_name=case when trim(person.display_name)='' then left(display_name_value,160) else person.display_name end,email=case when trim(person.email)='' then left(email_value,254) else person.email end,updated_at=now() where person.id=person_row.id returning * into person_row;
  end if;
  select coalesce(nullif(contact.team_name,''),trim(target_scope_id)) into team_name_value from public.team_contacts contact where contact.club_id=target_club_id and contact.team_key=trim(target_scope_id) limit 1; team_name_value:=coalesce(team_name_value,trim(target_scope_id));
  insert into public.coach_hub_team_assignments(club_id,person_id,team_key,team_name,staff_role,source_slot,is_primary,can_request_training,can_request_friendlies,can_request_changes,can_view_team_contacts,can_view_costs,status) values(target_club_id,person_row.id,trim(target_scope_id),left(team_name_value,200),staff_role_value,'manual',true,true,true,true,true,false,'active') on conflict(club_id,person_id,team_key,staff_role) do update set team_name=excluded.team_name,status='active',updated_at=now();
  return jsonb_build_object('linked',true,'person_id',person_row.id,'team_key',trim(target_scope_id));
end; $$;

create or replace function private.sync_team_contact_to_coach_hub()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare resolved_person_id uuid; existing_assignment public.coach_hub_team_assignments%rowtype; target_assignment public.coach_hub_team_assignments%rowtype; identity_value text; default_role text; slot_value text; name_value text; email_value text; phone_value text; enabled_value boolean;
begin
  if current_setting('daxora.syncing_coach_hub_person',true)='1' then return new; end if;
  if tg_op='DELETE' then update public.coach_hub_team_assignments set status='inactive',is_primary=false,updated_at=now() where club_id=old.club_id and team_key=old.team_key and source_slot in('coach','assistant'); return old; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.club_id::text||':'||new.team_key,0));
  if tg_op='UPDATE' and old.team_key is distinct from new.team_key then update public.coach_hub_team_assignments set status='inactive',is_primary=false,updated_at=now() where club_id=old.club_id and team_key=old.team_key and source_slot in('coach','assistant'); end if;
  for slot_value,default_role,name_value,email_value,phone_value,enabled_value in select 'coach','manager',new.coach_name,lower(trim(new.coach_email)),new.coach_phone,true union all select 'assistant','assistant',new.assistant_name,lower(trim(new.assistant_email)),new.assistant_phone,new.assistant_enabled loop
    select assignment.* into existing_assignment from public.coach_hub_team_assignments assignment where assignment.club_id=new.club_id and assignment.team_key=new.team_key and assignment.source_slot=slot_value order by(assignment.status='active')desc,assignment.updated_at desc limit 1 for update;
    if not enabled_value or(trim(coalesce(name_value,''))='' and trim(coalesce(email_value,''))='' and trim(coalesce(phone_value,''))='') then update public.coach_hub_team_assignments set status='inactive',is_primary=false,updated_at=now() where club_id=new.club_id and team_key=new.team_key and source_slot=slot_value; continue; end if;
    identity_value:=private.coach_identity_key(email_value,name_value,new.team_key,slot_value);
    insert into public.coach_hub_people(club_id,identity_key,display_name,email,mobile,preferred_channel,privacy_notice_provided_at,last_verified_at,status) values(new.club_id,identity_value,trim(coalesce(name_value,'')),lower(trim(coalesce(email_value,''))),trim(coalesce(phone_value,'')),case when new.preferred_channel in('email','sms','whatsapp') then new.preferred_channel else 'email' end,new.privacy_notice_provided_at,new.last_verified_at,'active') on conflict(club_id,identity_key) do update set display_name=excluded.display_name,email=excluded.email,mobile=excluded.mobile,preferred_channel=excluded.preferred_channel,privacy_notice_provided_at=coalesce(excluded.privacy_notice_provided_at,public.coach_hub_people.privacy_notice_provided_at),last_verified_at=coalesce(excluded.last_verified_at,public.coach_hub_people.last_verified_at),status='active',updated_at=now() returning id into resolved_person_id;
    select assignment.* into target_assignment from public.coach_hub_team_assignments assignment where assignment.club_id=new.club_id and assignment.person_id=resolved_person_id and assignment.team_key=new.team_key and assignment.staff_role=default_role limit 1 for update;
    update public.coach_hub_team_assignments set status='inactive',is_primary=false,updated_at=now() where club_id=new.club_id and team_key=new.team_key and source_slot=slot_value and id is distinct from coalesce(target_assignment.id,existing_assignment.id);
    if target_assignment.id is not null then
      update public.coach_hub_team_assignments set team_name=new.team_name,source_slot=slot_value,is_primary=(slot_value='coach'),status='active',updated_at=now() where id=target_assignment.id;
      if existing_assignment.id is not null and existing_assignment.id<>target_assignment.id then update public.coach_hub_team_assignments set status='inactive',is_primary=false,updated_at=now() where id=existing_assignment.id; end if;
    elsif existing_assignment.id is not null then update public.coach_hub_team_assignments set person_id=resolved_person_id,team_name=new.team_name,staff_role=default_role,source_slot=slot_value,is_primary=(slot_value='coach'),status='active',updated_at=now() where id=existing_assignment.id;
    else insert into public.coach_hub_team_assignments(club_id,person_id,team_key,team_name,staff_role,source_slot,is_primary,can_request_training,can_request_friendlies,can_request_changes,can_view_team_contacts,can_view_costs,status) values(new.club_id,resolved_person_id,new.team_key,new.team_name,default_role,slot_value,slot_value='coach',true,true,true,true,false,'active') on conflict(club_id,person_id,team_key,staff_role) do update set team_name=excluded.team_name,source_slot=excluded.source_slot,is_primary=excluded.is_primary,status='active',updated_at=now(); end if;
  end loop;
  return new;
end; $$;

notify pgrst,'reload schema';
