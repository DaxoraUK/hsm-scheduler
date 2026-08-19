-- Daxora Ground Control v3.10.1: Coach Hub, unified team contacts and booking requests.
begin;

-- Coach Hub is bundled with Annual Planner: Core add-on, included in Pro and Elite.
update public.subscription_plans
set entitlements = case
      when 'coach_hub' = any(entitlements) then entitlements
      else array_append(entitlements, 'coach_hub')
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-15.4',
      'coach_hub', 'included',
      'coach_accounts', 'unlimited_within_team_capacity'
    ),
    updated_at = now()
where code in ('pro', 'elite');

update public.subscription_plans
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'packaging_version', '2026-07-15.4',
      'available_addon_bundles', jsonb_build_object(
        'annual_planner', jsonb_build_array('annual_planner', 'coach_hub')
      )
    ),
    updated_at = now()
where code = 'core';

create table if not exists public.coach_hub_people (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  identity_key text not null,
  display_name text not null default '',
  email text not null default '',
  mobile text not null default '',
  preferred_channel text not null default 'email' check (preferred_channel in ('email','sms','whatsapp','in_app')),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  privacy_notice_provided_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, identity_key),
  check (email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create table if not exists public.coach_hub_team_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  person_id uuid not null references public.coach_hub_people(id) on delete cascade,
  team_key text not null,
  team_name text not null default '',
  staff_role text not null default 'coach' check (staff_role in ('manager','coach','assistant','secretary','welfare','emergency')),
  source_slot text not null default 'coach' check (source_slot in ('coach','assistant','manual')),
  is_primary boolean not null default false,
  can_request_training boolean not null default true,
  can_request_friendlies boolean not null default true,
  can_request_changes boolean not null default true,
  can_view_team_contacts boolean not null default true,
  can_view_costs boolean not null default false,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, person_id, team_key, staff_role)
);

create table if not exists public.coach_hub_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  person_id uuid not null references public.coach_hub_people(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired','delivery_failed')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  delivered_at timestamptz,
  provider_name text,
  provider_reference text,
  delivery_error text,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists public.coach_hub_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  person_id uuid not null references public.coach_hub_people(id) on delete restrict,
  assignment_id uuid not null references public.coach_hub_team_assignments(id) on delete restrict,
  target_booking_id uuid references public.annual_planner_bookings(id) on delete set null,
  request_type text not null check (request_type in ('training','friendly','change','cancellation','camp','tournament')),
  status text not null default 'submitted' check (status in ('draft','submitted','needs_information','alternative_offered','accepted','approved','rejected','declined','cancelled')),
  title text not null,
  team_key text not null,
  team_name text not null default '',
  opponent_name text,
  format text,
  preferred_venue_id text,
  preferred_venue_name text,
  preferred_pitch_id text,
  preferred_pitch_name text,
  preferred_start_at timestamptz not null,
  preferred_end_at timestamptz not null,
  recurrence text not null default 'none' check (recurrence in ('none','weekly','fortnightly')),
  recurrence_until date,
  estimated_attendance integer check (estimated_attendance is null or estimated_attendance between 0 and 5000),
  referee_required boolean not null default false,
  changing_rooms_required boolean not null default false,
  coach_notes text,
  admin_notes text,
  conflict_summary jsonb not null default '[]'::jsonb,
  proposed_venue_id text,
  proposed_venue_name text,
  proposed_pitch_id text,
  proposed_pitch_name text,
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  proposed_message text,
  resulting_booking_id uuid references public.annual_planner_bookings(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_end_at > preferred_start_at),
  check (proposed_end_at is null or proposed_start_at is not null),
  check (proposed_end_at is null or proposed_end_at > proposed_start_at)
);

create table if not exists public.coach_hub_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  person_id uuid references public.coach_hub_people(id) on delete cascade,
  team_key text,
  message_type text not null default 'information' check (message_type in ('information','action_required','booking_decision','fixture_change','club_announcement','direct_reply')),
  title text not null,
  body text not null,
  related_type text,
  related_id text,
  action_url text,
  requires_acknowledgement boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.coach_hub_message_receipts (
  message_id uuid not null references public.coach_hub_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.coach_hub_calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  person_id uuid not null references public.coach_hub_people(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'My team calendar',
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_accessed_at timestamptz
);

create index if not exists coach_hub_people_user_idx on public.coach_hub_people(user_id, club_id) where user_id is not null and status = 'active';
create index if not exists coach_hub_assignments_team_idx on public.coach_hub_team_assignments(club_id, team_key, status);
create index if not exists coach_hub_invitations_status_idx on public.coach_hub_invitations(club_id, status, expires_at);
create index if not exists coach_hub_requests_queue_idx on public.coach_hub_requests(club_id, status, preferred_start_at);
create index if not exists coach_hub_messages_person_idx on public.coach_hub_messages(club_id, person_id, created_at desc);

alter table public.coach_hub_people enable row level security;
alter table public.coach_hub_people force row level security;
alter table public.coach_hub_team_assignments enable row level security;
alter table public.coach_hub_team_assignments force row level security;
alter table public.coach_hub_invitations enable row level security;
alter table public.coach_hub_invitations force row level security;
alter table public.coach_hub_requests enable row level security;
alter table public.coach_hub_requests force row level security;
alter table public.coach_hub_messages enable row level security;
alter table public.coach_hub_messages force row level security;
alter table public.coach_hub_message_receipts enable row level security;
alter table public.coach_hub_message_receipts force row level security;
alter table public.coach_hub_calendar_feeds enable row level security;
alter table public.coach_hub_calendar_feeds force row level security;

revoke all on table public.coach_hub_people, public.coach_hub_team_assignments,
  public.coach_hub_invitations, public.coach_hub_requests, public.coach_hub_messages,
  public.coach_hub_message_receipts, public.coach_hub_calendar_feeds from anon, authenticated;

create or replace function private.coach_identity_key(email_value text, name_value text, team_key_value text, slot_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(lower(trim(coalesce(email_value, ''))), '') is not null then 'email:' || lower(trim(email_value))
    else 'contact:' || lower(regexp_replace(trim(coalesce(name_value, '')), '[^a-zA-Z0-9]+', '-', 'g')) || ':' || lower(trim(coalesce(team_key_value, ''))) || ':' || lower(trim(coalesce(slot_value, 'coach')))
  end;
$$;

create or replace function public.can_access_coach_hub(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.coach_hub_people person
    join public.coach_hub_team_assignments assignment on assignment.person_id = person.id and assignment.club_id = person.club_id
    join public.clubs club on club.id = person.club_id
    where person.club_id = target_club_id
      and person.user_id = auth.uid()
      and person.status = 'active'
      and assignment.status = 'active'
      and club.status = 'active'
      and private.club_has_entitlement(target_club_id, 'annual_planner')
  );
$$;

create or replace function private.current_coach_person_id(target_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select person.id
  from public.coach_hub_people person
  where person.club_id = target_club_id
    and person.user_id = auth.uid()
    and person.status = 'active'
  order by person.created_at
  limit 1;
$$;

create or replace function private.sync_team_contact_to_coach_hub()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  person_id uuid;
  identity_value text;
  role_value text;
  slot_value text;
  name_value text;
  email_value text;
  phone_value text;
  enabled_value boolean;
begin
  if tg_op = 'DELETE' then
    update public.coach_hub_team_assignments assignment
    set status = 'inactive', updated_at = now()
    where assignment.club_id = old.club_id
      and assignment.team_key = old.team_key
      and assignment.source_slot in ('coach','assistant');
    return old;
  end if;

  if tg_op = 'UPDATE' and old.team_key is distinct from new.team_key then
    update public.coach_hub_team_assignments assignment
    set status = 'inactive', updated_at = now()
    where assignment.club_id = old.club_id
      and assignment.team_key = old.team_key
      and assignment.source_slot in ('coach','assistant');
  end if;

  for slot_value, role_value, name_value, email_value, phone_value, enabled_value in
    select 'coach', 'manager', new.coach_name, lower(trim(new.coach_email)), new.coach_phone, true
    union all
    select 'assistant', 'assistant', new.assistant_name, lower(trim(new.assistant_email)), new.assistant_phone, new.assistant_enabled
  loop
    if not enabled_value or (trim(coalesce(name_value,'')) = '' and trim(coalesce(email_value,'')) = '' and trim(coalesce(phone_value,'')) = '') then
      update public.coach_hub_team_assignments assignment
      set status = 'inactive', updated_at = now()
      where assignment.club_id = new.club_id and assignment.team_key = new.team_key and assignment.source_slot = slot_value;
      continue;
    end if;

    identity_value := private.coach_identity_key(email_value, name_value, new.team_key, slot_value);
    insert into public.coach_hub_people (
      club_id, identity_key, display_name, email, mobile, preferred_channel,
      privacy_notice_provided_at, last_verified_at, status
    ) values (
      new.club_id, identity_value, trim(coalesce(name_value,'')), lower(trim(coalesce(email_value,''))), trim(coalesce(phone_value,'')),
      case when new.preferred_channel in ('email','sms','whatsapp') then new.preferred_channel else 'email' end,
      new.privacy_notice_provided_at, new.last_verified_at, 'active'
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
    returning id into person_id;

    update public.coach_hub_team_assignments assignment
    set status = 'inactive', updated_at = now()
    where assignment.club_id = new.club_id
      and assignment.team_key = new.team_key
      and assignment.source_slot = slot_value
      and assignment.person_id <> person_id;

    insert into public.coach_hub_team_assignments (
      club_id, person_id, team_key, team_name, staff_role, source_slot, is_primary,
      can_request_training, can_request_friendlies, can_request_changes,
      can_view_team_contacts, can_view_costs, status
    ) values (
      new.club_id, person_id, new.team_key, new.team_name, role_value, slot_value, slot_value = 'coach',
      true, true, true, true, false, 'active'
    )
    on conflict (club_id, person_id, team_key, staff_role) do update set
      team_name = excluded.team_name,
      source_slot = excluded.source_slot,
      is_primary = excluded.is_primary,
      status = 'active',
      updated_at = now();
  end loop;
  return new;
end;
$$;

drop trigger if exists team_contacts_sync_coach_hub on public.team_contacts;
create trigger team_contacts_sync_coach_hub
after insert or update or delete on public.team_contacts
for each row execute function private.sync_team_contact_to_coach_hub();

-- Bootstrap current team contacts into the unified people directory.
do $$
declare row_value public.team_contacts%rowtype;
begin
  for row_value in select * from public.team_contacts loop
    perform private.coach_identity_key(row_value.coach_email, row_value.coach_name, row_value.team_key, 'coach');
    insert into public.coach_hub_people (club_id, identity_key, display_name, email, mobile, preferred_channel, privacy_notice_provided_at, last_verified_at)
    values (row_value.club_id, private.coach_identity_key(row_value.coach_email,row_value.coach_name,row_value.team_key,'coach'), coalesce(row_value.coach_name,''), lower(coalesce(row_value.coach_email,'')), coalesce(row_value.coach_phone,''), coalesce(nullif(row_value.preferred_channel,''),'email'), row_value.privacy_notice_provided_at, row_value.last_verified_at)
    on conflict (club_id, identity_key) do update set display_name=excluded.display_name,email=excluded.email,mobile=excluded.mobile,preferred_channel=excluded.preferred_channel,updated_at=now();
    if row_value.assistant_enabled and (row_value.assistant_name <> '' or row_value.assistant_email <> '' or row_value.assistant_phone <> '') then
      insert into public.coach_hub_people (club_id, identity_key, display_name, email, mobile, preferred_channel, privacy_notice_provided_at, last_verified_at)
      values (row_value.club_id, private.coach_identity_key(row_value.assistant_email,row_value.assistant_name,row_value.team_key,'assistant'), coalesce(row_value.assistant_name,''), lower(coalesce(row_value.assistant_email,'')), coalesce(row_value.assistant_phone,''), coalesce(nullif(row_value.preferred_channel,''),'email'), row_value.privacy_notice_provided_at, row_value.last_verified_at)
      on conflict (club_id, identity_key) do update set display_name=excluded.display_name,email=excluded.email,mobile=excluded.mobile,preferred_channel=excluded.preferred_channel,updated_at=now();
    end if;
  end loop;
end $$;

insert into public.coach_hub_team_assignments (club_id,person_id,team_key,team_name,staff_role,source_slot,is_primary)
select contact.club_id, person.id, contact.team_key, contact.team_name, 'manager', 'coach', true
from public.team_contacts contact
join public.coach_hub_people person on person.club_id=contact.club_id and person.identity_key=private.coach_identity_key(contact.coach_email,contact.coach_name,contact.team_key,'coach')
where contact.coach_name <> '' or contact.coach_email <> '' or contact.coach_phone <> ''
on conflict (club_id,person_id,team_key,staff_role) do update set team_name=excluded.team_name,status='active',updated_at=now();

insert into public.coach_hub_team_assignments (club_id,person_id,team_key,team_name,staff_role,source_slot,is_primary)
select contact.club_id, person.id, contact.team_key, contact.team_name, 'assistant', 'assistant', false
from public.team_contacts contact
join public.coach_hub_people person on person.club_id=contact.club_id and person.identity_key=private.coach_identity_key(contact.assistant_email,contact.assistant_name,contact.team_key,'assistant')
where contact.assistant_enabled and (contact.assistant_name <> '' or contact.assistant_email <> '' or contact.assistant_phone <> '')
on conflict (club_id,person_id,team_key,staff_role) do update set team_name=excluded.team_name,status='active',updated_at=now();

create or replace function public.sync_coach_hub_contacts(target_club_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare contact public.team_contacts%rowtype; synced integer := 0;
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode='42501';
  end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501';
  end if;
  for contact in select * from public.team_contacts where club_id=target_club_id loop
    -- A harmless update runs the secure contact-sync trigger without re-entering data.
    update public.team_contacts set updated_at=now() where id=contact.id;
    synced := synced + 1;
  end loop;
  perform public.record_audit_event(target_club_id,'coach_hub.contacts.synced','coach_hub','contacts',jsonb_build_object('team_contacts',synced));
  return synced;
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
  if not private.club_has_entitlement(target_club_id,'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501';
  end if;
  update public.coach_hub_invitations set status='expired',updated_at=now() where club_id=target_club_id and status='pending' and expires_at<=now();
  return jsonb_build_object(
    'people', coalesce((select jsonb_agg(to_jsonb(person)-'identity_key' order by person.display_name,person.email) from public.coach_hub_people person where person.club_id=target_club_id and person.status<>'inactive'),'[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(to_jsonb(assignment) order by assignment.team_name,assignment.staff_role) from public.coach_hub_team_assignments assignment where assignment.club_id=target_club_id and assignment.status='active'),'[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(to_jsonb(invitation)-'token_hash' order by invitation.created_at desc) from public.coach_hub_invitations invitation where invitation.club_id=target_club_id and invitation.status in ('pending','expired','delivery_failed')),'[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc) from public.coach_hub_requests request_row where request_row.club_id=target_club_id and request_row.status not in ('cancelled')),'[]'::jsonb)
  );
end;
$$;

create or replace function public.list_coach_hub_request_queue(target_club_id uuid)
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
  if not private.club_has_entitlement(target_club_id,'annual_planner') then
    raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501';
  end if;
  return jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(
        to_jsonb(request_row)
        || jsonb_build_object('coach_name', person.display_name)
        order by request_row.created_at desc
      )
      from public.coach_hub_requests request_row
      join public.coach_hub_people person on person.id=request_row.person_id and person.club_id=request_row.club_id
      where request_row.club_id=target_club_id
        and request_row.status not in ('cancelled')
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.create_coach_hub_invitation(target_club_id uuid,target_person_id uuid,expiry_hours integer default 168)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); person public.coach_hub_people%rowtype; raw_token text:=encode(gen_random_bytes(32),'hex'); invitation_id uuid; expires_value timestamptz;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Coach Hub requires the Annual Planner module' using errcode='42501'; end if;
  select * into person from public.coach_hub_people where id=target_person_id and club_id=target_club_id and status='active';
  if person.id is null then raise exception 'Coach contact not found' using errcode='P0002'; end if;
  if nullif(trim(person.email),'') is null then raise exception 'Add an email address to the team contact before inviting this coach' using errcode='22023'; end if;
  if not exists(select 1 from public.coach_hub_team_assignments a where a.person_id=person.id and a.club_id=target_club_id and a.status='active') then raise exception 'This contact is not assigned to an active team' using errcode='22023'; end if;
  update public.coach_hub_invitations set status='revoked',revoked_at=now(),updated_at=now() where club_id=target_club_id and person_id=person.id and status='pending';
  expires_value:=now()+make_interval(hours=>greatest(24,least(coalesce(expiry_hours,168),720)));
  insert into public.coach_hub_invitations(club_id,person_id,email,token_hash,invited_by,expires_at)
  values(target_club_id,person.id,lower(person.email),encode(digest(raw_token,'sha256'),'hex'),actor_id,expires_value)
  returning id into invitation_id;
  perform public.record_audit_event(target_club_id,'coach_hub.invitation.created','coach_hub_invitation',invitation_id::text,jsonb_build_object('person_id',person.id,'email',person.email));
  return jsonb_build_object('id',invitation_id,'token',raw_token,'email',person.email,'display_name',person.display_name,'expires_at',expires_value);
end;
$$;

create or replace function public.prepare_coach_hub_invitation_delivery(target_club_id uuid,target_invitation_id uuid,public_base_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare invitation public.coach_hub_invitations%rowtype; person public.coach_hub_people%rowtype; club_name text; team_names text; raw_link text;
begin
  if auth.uid() is null or not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode='42501'; end if;
  select * into invitation from public.coach_hub_invitations where id=target_invitation_id and club_id=target_club_id and status in ('pending','delivery_failed');
  if invitation.id is null then raise exception 'Pending coach invitation not found' using errcode='P0002'; end if;
  select * into person from public.coach_hub_people where id=invitation.person_id;
  select club.name into club_name from public.clubs club where club.id=target_club_id;
  select string_agg(distinct assignment.team_name,', ' order by assignment.team_name) into team_names from public.coach_hub_team_assignments assignment where assignment.person_id=person.id and assignment.status='active';
  -- The raw token is intentionally not stored; the browser supplies a freshly returned invitation URL.
  raw_link := trim(trailing '/' from coalesce(public_base_url,''));
  return jsonb_build_object('invitation_id',invitation.id,'email',person.email,'display_name',person.display_name,'club_name',club_name,'team_names',coalesce(team_names,''),'base_url',raw_link);
end;
$$;

create or replace function public.complete_coach_hub_invitation_delivery(target_invitation_id uuid,next_status text,provider_value text default null,reference_value text default null,error_value text default null)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if next_status not in ('delivered','failed') then raise exception 'Invitation delivery status is invalid' using errcode='22023'; end if;
  update public.coach_hub_invitations set status=case when next_status='delivered' then 'pending' else 'delivery_failed' end,
    delivered_at=case when next_status='delivered' then now() else delivered_at end,provider_name=provider_value,provider_reference=reference_value,delivery_error=nullif(error_value,''),updated_at=now()
  where id=target_invitation_id;
end;
$$;

create or replace function public.accept_coach_hub_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); actor_email text; invitation public.coach_hub_invitations%rowtype; person public.coach_hub_people%rowtype;
begin
  if actor_id is null then raise exception 'Sign in to accept this Coach Hub invitation' using errcode='42501'; end if;
  select lower(coalesce(profile.email, auth.jwt()->>'email')) into actor_email from public.user_profiles profile where profile.id=actor_id;
  actor_email := coalesce(actor_email, lower(auth.jwt()->>'email'));
  select * into invitation from public.coach_hub_invitations row_value where row_value.token_hash=encode(digest(trim(coalesce(invitation_token,'')),'sha256'),'hex') for update;
  if invitation.id is null or invitation.status not in ('pending','delivery_failed') then raise exception 'Coach Hub invitation is invalid or unavailable' using errcode='42501'; end if;
  if invitation.expires_at<=now() then update public.coach_hub_invitations set status='expired',updated_at=now() where id=invitation.id; raise exception 'Coach Hub invitation has expired' using errcode='42501'; end if;
  if actor_email is null or actor_email<>lower(invitation.email) then raise exception 'Sign in with the email address that received the Coach Hub invitation' using errcode='42501'; end if;
  select * into person from public.coach_hub_people where id=invitation.person_id for update;
  update public.coach_hub_people set user_id=actor_id,status='active',last_verified_at=now(),updated_at=now() where id=person.id;
  update public.coach_hub_invitations set status='accepted',accepted_by=actor_id,accepted_at=now(),updated_at=now() where id=invitation.id;
  perform public.record_audit_event(invitation.club_id,'coach_hub.invitation.accepted','coach_hub_person',person.id::text,jsonb_build_object('user_id',actor_id));
  return jsonb_build_object('club_id',invitation.club_id,'role','coach','person_id',person.id);
end;
$$;

-- Add team-scoped Coach Hub access to workspace discovery without granting generic club read access.
create or replace function public.list_accessible_workspaces()
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with membership_access as (
    select membership.club_id,membership.role,'membership'::text access_mode,false read_only,null::uuid support_session_id,null::timestamptz support_expires_at,membership.created_at granted_at,1 priority
    from public.club_memberships membership join public.clubs club on club.id=membership.club_id
    where membership.user_id=auth.uid() and membership.status='active' and club.status='active'
  ), coach_access as (
    select person.club_id,'coach'::text role,'coach'::text access_mode,false read_only,null::uuid support_session_id,null::timestamptz support_expires_at,min(assignment.created_at) granted_at,2 priority
    from public.coach_hub_people person join public.coach_hub_team_assignments assignment on assignment.person_id=person.id and assignment.club_id=person.club_id join public.clubs club on club.id=person.club_id
    where person.user_id=auth.uid() and person.status='active' and assignment.status='active' and club.status='active'
      and private.club_has_entitlement(person.club_id,'annual_planner')
    group by person.club_id
  ), support_access as (
    select session_row.club_id,'support'::text role,'support'::text access_mode,true read_only,session_row.id support_session_id,session_row.expires_at support_expires_at,session_row.created_at granted_at,3 priority
    from public.support_access_sessions session_row join public.platform_support_staff staff on staff.user_id=session_row.support_user_id join public.clubs club on club.id=session_row.club_id
    where session_row.support_user_id=auth.uid() and session_row.revoked_at is null and session_row.starts_at<=now() and session_row.expires_at>now() and staff.status='active' and club.status='active'
  ), combined as (select * from membership_access union all select * from coach_access union all select * from support_access),
  deduplicated as (select distinct on (club_id) * from combined order by club_id,priority)
  select coalesce(jsonb_agg(jsonb_build_object('club_id',club.id,'organisation_id',club.organisation_id,'club_name',club.name,'club_slug',club.slug,'club_status',club.status,'role',deduplicated.role,'access_mode',deduplicated.access_mode,'read_only',deduplicated.read_only,'support_session_id',deduplicated.support_session_id,'support_expires_at',deduplicated.support_expires_at,'granted_at',deduplicated.granted_at) order by club.name),'[]'::jsonb)
  from deduplicated join public.clubs club on club.id=deduplicated.club_id;
$$;

-- Permit subscription verification for Coach Hub users without granting ordinary workspace data.
create or replace function public.get_club_subscription(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare subscription public.club_subscriptions%rowtype; plan public.subscription_plans%rowtype; access_state text; effective_limits jsonb; access_message text:='';
begin
  if auth.uid() is null or (not public.can_read_club(target_club_id) and not public.can_access_coach_hub(target_club_id) and not exists(select 1 from public.platform_support_staff staff where staff.user_id=auth.uid() and staff.status='active')) then raise exception 'Club access required' using errcode='42501'; end if;
  select * into subscription from public.club_subscriptions where club_id=target_club_id;
  if subscription.club_id is null then raise exception 'Club subscription is not configured' using errcode='P0002'; end if;
  select * into plan from public.subscription_plans where code=subscription.plan_code and status='active';
  if plan.code is null then raise exception 'Subscription plan is unavailable' using errcode='P0002'; end if;
  access_state:=private.club_subscription_access_state(target_club_id); effective_limits:=plan.limits||subscription.limit_overrides;
  if subscription.status='suspended' then access_message:='This subscription is suspended. Club data remains available in read-only mode.';
  elsif subscription.status='cancelled' then access_message:='This subscription is cancelled. Club data remains available in read-only mode.';
  elsif subscription.status='trialing' and access_state='read_only' then access_message:='The trial has ended. Club data remains available in read-only mode.';
  elsif subscription.status='grace' and access_state='read_only' then access_message:='The subscription grace period has ended. Club data remains available in read-only mode.'; end if;
  return jsonb_build_object('club_id',subscription.club_id,'plan_code',plan.code,'plan_name',plan.name,'status',subscription.status,'access_state',access_state,'access_message',access_message,'billing_interval',subscription.billing_interval,'trial_ends_at',subscription.trial_ends_at,'grace_ends_at',subscription.grace_ends_at,'current_period_end',subscription.current_period_end,'cancel_at_period_end',subscription.cancel_at_period_end,'billing_exempt',subscription.billing_exempt,'entitlements',to_jsonb(private.effective_club_entitlements(target_club_id)),'plan_entitlements',to_jsonb(plan.entitlements),'entitlement_overrides',subscription.entitlement_overrides,'limits',effective_limits,'plan_limits',plan.limits,'limit_overrides',subscription.limit_overrides,'package_version',coalesce(plan.metadata->>'packaging_version',''),'updated_at',subscription.updated_at);
end;
$$;

create or replace function public.get_coach_hub_workspace(target_club_id uuid,range_start date default null,range_end date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); start_boundary timestamptz:=coalesce(range_start,current_date-interval '30 days'); end_boundary timestamptz:=coalesce(range_end,current_date+interval '400 days')+interval '1 day';
begin
  if person_id is null or not public.can_access_coach_hub(target_club_id) then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  if not private.club_has_entitlement(target_club_id,'annual_planner') then raise exception 'Coach Hub is not enabled for this club' using errcode='42501'; end if;
  return jsonb_build_object(
    'club', (select jsonb_build_object('id',club.id,'name',club.name,'slug',club.slug) from public.clubs club where club.id=target_club_id),
    'person', (select to_jsonb(person)-'identity_key' from public.coach_hub_people person where person.id=person_id),
    'assignments', coalesce((select jsonb_agg(to_jsonb(assignment) order by assignment.team_name,assignment.staff_role) from public.coach_hub_team_assignments assignment where assignment.person_id=person_id and assignment.status='active'),'[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'admin_notes' order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=person_id and assignment.status='active') and booking.start_at>=start_boundary and booking.start_at<end_boundary and booking.status not in ('cancelled','rejected')),'[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(request_row)-'admin_notes' order by request_row.created_at desc) from public.coach_hub_requests request_row where request_row.person_id=person_id and request_row.club_id=target_club_id),'[]'::jsonb),
    'messages', coalesce((select jsonb_agg((to_jsonb(message_row)||jsonb_build_object('read_at',receipt.read_at,'acknowledged_at',receipt.acknowledged_at)) order by message_row.created_at desc) from public.coach_hub_messages message_row left join public.coach_hub_message_receipts receipt on receipt.message_id=message_row.id and receipt.user_id=auth.uid() where message_row.club_id=target_club_id and (message_row.person_id=person_id or (message_row.person_id is null and (message_row.team_key is null or message_row.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=person_id and assignment.status='active')))) and (message_row.expires_at is null or message_row.expires_at>now())),'[]'::jsonb),
    'team_contacts', coalesce((select jsonb_agg(jsonb_build_object('team_key',contact.team_key,'team_name',contact.team_name,'coach_name',contact.coach_name,'coach_email',contact.coach_email,'coach_phone',contact.coach_phone,'assistant_name',case when contact.assistant_enabled then contact.assistant_name else '' end,'assistant_email',case when contact.assistant_enabled then contact.assistant_email else '' end,'assistant_phone',case when contact.assistant_enabled then contact.assistant_phone else '' end) order by contact.team_name) from public.team_contacts contact where contact.club_id=target_club_id and contact.team_key in (select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=person_id and assignment.status='active' and assignment.can_view_team_contacts)),'[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_coach_hub_request(target_club_id uuid,request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); assignment public.coach_hub_team_assignments%rowtype; target_booking public.annual_planner_bookings%rowtype; result public.coach_hub_requests%rowtype; request_type_value text:=lower(trim(coalesce(request_data->>'request_type','training'))); target_booking_id_value uuid:=nullif(request_data->>'target_booking_id','')::uuid; start_value timestamptz:=(request_data->>'preferred_start_at')::timestamptz; end_value timestamptz:=(request_data->>'preferred_end_at')::timestamptz; conflicts jsonb:='[]'::jsonb;
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into assignment from public.coach_hub_team_assignments where id=(request_data->>'assignment_id')::uuid and person_id=person_id and club_id=target_club_id and status='active';
  if assignment.id is null then raise exception 'Choose one of your assigned teams' using errcode='42501'; end if;
  if request_type_value='friendly' and not assignment.can_request_friendlies then raise exception 'Friendly requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('training','camp','tournament') and not assignment.can_request_training then raise exception 'Training requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') and not assignment.can_request_changes then raise exception 'Booking change requests are not enabled for this team role' using errcode='42501'; end if;
  if request_type_value in ('change','cancellation') then
    select * into target_booking from public.annual_planner_bookings booking
    where booking.id=target_booking_id_value and booking.club_id=target_club_id and booking.team_key=assignment.team_key and booking.status in ('requested','provisional','confirmed');
    if target_booking.id is null then raise exception 'Choose an active booking for this team' using errcode='22023'; end if;
  end if;
  if end_value<=start_value then raise exception 'Request finish time must be after the start time' using errcode='22023'; end if;
  select coalesce(jsonb_agg(conflict), '[]'::jsonb) into conflicts from (
    select jsonb_build_object('type','pitch_conflict','message','The preferred pitch is already booked','booking_id',booking.id) conflict
    from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed') and nullif(request_data->>'preferred_pitch_id','') is not null and booking.pitch_id=nullif(request_data->>'preferred_pitch_id','') and booking.start_at<end_value and booking.end_at>start_value and booking.id is distinct from target_booking_id_value
    union all
    select jsonb_build_object('type','team_conflict','message','Your team already has another booking at this time','booking_id',booking.id)
    from public.annual_planner_bookings booking where booking.club_id=target_club_id and booking.status in ('requested','provisional','confirmed') and booking.team_key=assignment.team_key and booking.start_at<end_value and booking.end_at>start_value and booking.id is distinct from target_booking_id_value
    union all
    select jsonb_build_object('type','blackout','message','The preferred facility is unavailable at this time','blackout_id',blackout.id)
    from public.annual_planner_blackouts blackout where blackout.club_id=target_club_id and blackout.start_at<end_value and blackout.end_at>start_value and (blackout.pitch_id is null or blackout.pitch_id=nullif(request_data->>'preferred_pitch_id',''))
  ) conflicts_query;
  if jsonb_array_length(conflicts)>0 and coalesce((request_data->>'allow_advisory_submission')::boolean,false)=false then raise exception 'The requested slot has a facility or team conflict' using errcode='23P01',detail=conflicts::text; end if;
  insert into public.coach_hub_requests(club_id,person_id,assignment_id,target_booking_id,request_type,status,title,team_key,team_name,opponent_name,format,preferred_venue_id,preferred_venue_name,preferred_pitch_id,preferred_pitch_name,preferred_start_at,preferred_end_at,recurrence,recurrence_until,estimated_attendance,referee_required,changing_rooms_required,coach_notes,conflict_summary)
  values(target_club_id,person_id,assignment.id,target_booking_id_value,request_type_value,'submitted',left(trim(coalesce(request_data->>'title',initcap(request_type_value)||' request')),240),assignment.team_key,assignment.team_name,nullif(trim(request_data->>'opponent_name'),''),nullif(trim(request_data->>'format'),''),nullif(request_data->>'preferred_venue_id',''),nullif(request_data->>'preferred_venue_name',''),nullif(request_data->>'preferred_pitch_id',''),nullif(request_data->>'preferred_pitch_name',''),start_value,end_value,coalesce(nullif(request_data->>'recurrence',''),'none'),nullif(request_data->>'recurrence_until','')::date,nullif(request_data->>'estimated_attendance','')::integer,coalesce((request_data->>'referee_required')::boolean,false),coalesce((request_data->>'changing_rooms_required')::boolean,false),nullif(request_data->>'coach_notes',''),conflicts)
  returning * into result;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,created_by)
  values(target_club_id,person_id,assignment.team_key,'information','Request submitted','Your '||replace(request_type_value,'_',' ')||' request for '||to_char(start_value,'Dy DD Mon at HH24:MI')||' has been sent to the club scheduler.','coach_request',result.id::text,auth.uid());
  perform public.record_audit_event(target_club_id,'coach_hub.request.submitted','coach_hub_request',result.id::text,jsonb_build_object('team_key',assignment.team_key,'request_type',request_type_value,'conflicts',jsonb_array_length(conflicts)));
  return to_jsonb(result)-'admin_notes';
end;
$$;

create or replace function private.create_booking_from_coach_request(request_row public.coach_hub_requests,actor_id uuid,use_proposal boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  first_booking_id uuid;
  next_booking_id uuid;
  target_booking public.annual_planner_bookings%rowtype;
  start_value timestamptz:=case when use_proposal then request_row.proposed_start_at else request_row.preferred_start_at end;
  end_value timestamptz:=case when use_proposal then request_row.proposed_end_at else request_row.preferred_end_at end;
  pitch_value text:=case when use_proposal then request_row.proposed_pitch_id else request_row.preferred_pitch_id end;
  pitch_name_value text:=case when use_proposal then request_row.proposed_pitch_name else request_row.preferred_pitch_name end;
  venue_value text:=case when use_proposal then request_row.proposed_venue_id else request_row.preferred_venue_id end;
  venue_name_value text:=case when use_proposal then request_row.proposed_venue_name else request_row.preferred_venue_name end;
  occurrence_start timestamptz;
  occurrence_end timestamptz;
  interval_step interval:=case when request_row.recurrence='weekly' then interval '7 days' when request_row.recurrence='fortnightly' then interval '14 days' else interval '100 years' end;
  series_key text:='coach-'||request_row.id::text;
  occurrence_count integer:=0;
  coach_name text;
  coach_email text;
begin
  if actor_id is null then raise exception 'Coach request approval actor is required' using errcode='42501'; end if;
  if start_value is null or end_value is null or end_value<=start_value then
    raise exception 'The approved booking time is invalid' using errcode='22023';
  end if;

  select person.display_name,person.email into coach_name,coach_email
  from public.coach_hub_people person where person.id=request_row.person_id and person.club_id=request_row.club_id;

  if request_row.request_type in ('change','cancellation') then
    select * into target_booking from public.annual_planner_bookings booking
    where booking.id=request_row.target_booking_id and booking.club_id=request_row.club_id for update;
    if target_booking.id is null then raise exception 'The original booking is no longer available' using errcode='P0002'; end if;

    if request_row.request_type='cancellation' then
      update public.annual_planner_bookings booking set
        status='cancelled',
        notes=concat_ws(E'\n',booking.notes,request_row.coach_notes),
        updated_by=actor_id,
        updated_at=now()
      where booking.id=target_booking.id
      returning booking.id into next_booking_id;
    else
      if pitch_value is not null then
        perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':pitch:'||pitch_value));
        if exists(
          select 1 from public.annual_planner_bookings existing
          where existing.club_id=request_row.club_id
            and existing.id is distinct from target_booking.id
            and existing.pitch_id=pitch_value
            and existing.status in ('requested','provisional','confirmed')
            and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
        ) then raise exception 'The alternative pitch is already booked at this time' using errcode='23P01'; end if;
      end if;
      perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':team:'||target_booking.team_key));
      if exists(
        select 1 from public.annual_planner_bookings existing
        where existing.club_id=request_row.club_id
          and existing.id is distinct from target_booking.id
          and existing.team_key=target_booking.team_key
          and existing.status in ('requested','provisional','confirmed')
          and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(start_value,end_value,'[)')
      ) then raise exception 'The team already has another booking at this time' using errcode='23P01'; end if;
      if exists(
        select 1 from public.annual_planner_blackouts blackout
        where blackout.club_id=request_row.club_id
          and (blackout.venue_id is null or venue_value is null or blackout.venue_id=venue_value)
          and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
          and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(start_value,end_value,'[)')
      ) then raise exception 'The alternative facility is unavailable during this period' using errcode='23P01'; end if;

      update public.annual_planner_bookings booking set
        status='confirmed',
        venue_id=venue_value,
        venue_name=venue_name_value,
        pitch_id=pitch_value,
        pitch_name=pitch_name_value,
        start_at=start_value,
        end_at=end_value,
        notes=concat_ws(E'\n',booking.notes,request_row.coach_notes),
        approved_by=actor_id,
        approved_at=coalesce(booking.approved_at,now()),
        updated_by=actor_id,
        updated_at=now()
      where booking.id=target_booking.id
      returning booking.id into next_booking_id;
    end if;

    perform public.record_audit_event(request_row.club_id,
      case when request_row.request_type='cancellation' then 'annual_planner.booking.cancelled_from_coach_request' else 'annual_planner.booking.changed_from_coach_request' end,
      'annual_planner_booking',next_booking_id::text,
      jsonb_build_object('coach_request_id',request_row.id,'start_at',start_value,'pitch_id',pitch_value));
    return next_booking_id;
  end if;

  occurrence_start:=start_value;
  occurrence_end:=end_value;
  loop
    exit when request_row.recurrence<>'none'
      and request_row.recurrence_until is not null
      and occurrence_start::date>request_row.recurrence_until;
    occurrence_count:=occurrence_count+1;
    if occurrence_count>160 then raise exception 'Coach booking series exceeds 160 occurrences' using errcode='22023'; end if;

    if pitch_value is not null then
      perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':pitch:'||pitch_value));
      if exists(
        select 1 from public.annual_planner_bookings existing
        where existing.club_id=request_row.club_id
          and existing.pitch_id=pitch_value
          and existing.status in ('requested','provisional','confirmed')
          and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
      ) then raise exception 'The approved pitch is already booked for one or more requested dates' using errcode='23P01'; end if;
    end if;

    perform pg_advisory_xact_lock(hashtext(request_row.club_id::text||':team:'||request_row.team_key));
    if exists(
      select 1 from public.annual_planner_bookings existing
      where existing.club_id=request_row.club_id
        and existing.team_key=request_row.team_key
        and existing.status in ('requested','provisional','confirmed')
        and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
    ) then raise exception 'The team already has another booking for one or more requested dates' using errcode='23P01'; end if;

    if exists(
      select 1 from public.annual_planner_blackouts blackout
      where blackout.club_id=request_row.club_id
        and (blackout.venue_id is null or venue_value is null or blackout.venue_id=venue_value)
        and (blackout.pitch_id is null or pitch_value is null or blackout.pitch_id=pitch_value)
        and tstzrange(blackout.start_at,blackout.end_at,'[)') && tstzrange(occurrence_start,occurrence_end,'[)')
    ) then raise exception 'The approved facility is unavailable for one or more requested dates' using errcode='23P01'; end if;

    insert into public.annual_planner_bookings(
      club_id,series_id,title,booking_type,status,team_key,team_name,opponent_name,
      venue_id,venue_name,pitch_id,pitch_name,start_at,end_at,recurrence,recurrence_until,
      cost_pence,supplier_reference,booking_reference,contact_name,contact_email,notes,
      source_type,source_id,approved_by,approved_at,created_by,updated_by
    ) values(
      request_row.club_id,case when request_row.recurrence='none' then null else series_key end,request_row.title,
      case when request_row.request_type='friendly' then 'friendly' when request_row.request_type in ('camp','tournament') then request_row.request_type else 'training' end,
      'confirmed',request_row.team_key,request_row.team_name,request_row.opponent_name,
      venue_value,venue_name_value,pitch_value,pitch_name_value,occurrence_start,occurrence_end,
      request_row.recurrence,request_row.recurrence_until,0,null,null,coach_name,coach_email,request_row.coach_notes,
      'coach_request',request_row.id::text,actor_id,now(),actor_id,actor_id
    ) returning id into next_booking_id;

    if first_booking_id is null then first_booking_id:=next_booking_id; end if;
    perform public.record_audit_event(request_row.club_id,'annual_planner.booking.created_from_coach_request',
      'annual_planner_booking',next_booking_id::text,
      jsonb_build_object('coach_request_id',request_row.id,'series_id',series_key,'occurrence',occurrence_count));
    exit when request_row.recurrence='none';
    occurrence_start:=occurrence_start+interval_step;
    occurrence_end:=occurrence_end+interval_step;
  end loop;
  return first_booking_id;
end;
$$;

create or replace function public.review_coach_hub_request(target_club_id uuid,target_request_id uuid,decision text,decision_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare actor_id uuid:=auth.uid(); request_row public.coach_hub_requests%rowtype; decision_value text:=lower(trim(coalesce(decision,''))); booking_id uuid; message_title text; message_body text;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then raise exception 'Club operator access required' using errcode='42501'; end if;
  select * into request_row from public.coach_hub_requests where id=target_request_id and club_id=target_club_id for update;
  if request_row.id is null then raise exception 'Coach request not found' using errcode='P0002'; end if;
  if decision_value='approve' then
    booking_id:=private.create_booking_from_coach_request(request_row,actor_id,false);
    update public.coach_hub_requests set status='approved',resulting_booking_id=booking_id,reviewed_by=actor_id,reviewed_at=now(),admin_notes=nullif(decision_data->>'message',''),updated_at=now() where id=request_row.id;
    message_title:='Request approved'; message_body:=coalesce(nullif(decision_data->>'message',''),'Your booking request has been approved and added to the club calendar.');
  elsif decision_value='alternative' then
    if request_row.request_type='cancellation' then raise exception 'Cancellation requests cannot receive an alternative slot' using errcode='22023'; end if;
    if nullif(decision_data->>'start_at','') is null or nullif(decision_data->>'end_at','') is null then raise exception 'Alternative start and finish are required' using errcode='22023'; end if;
    update public.coach_hub_requests set status='alternative_offered',proposed_venue_id=nullif(decision_data->>'venue_id',''),proposed_venue_name=nullif(decision_data->>'venue_name',''),proposed_pitch_id=nullif(decision_data->>'pitch_id',''),proposed_pitch_name=nullif(decision_data->>'pitch_name',''),proposed_start_at=(decision_data->>'start_at')::timestamptz,proposed_end_at=(decision_data->>'end_at')::timestamptz,proposed_message=nullif(decision_data->>'message',''),reviewed_by=actor_id,reviewed_at=now(),updated_at=now() where id=request_row.id;
    message_title:='Alternative booking offered'; message_body:=coalesce(nullif(decision_data->>'message',''),'The club has offered an alternative date, time or pitch. Open Coach Hub to accept or decline it.');
  elsif decision_value='needs_information' then
    update public.coach_hub_requests set status='needs_information',admin_notes=nullif(decision_data->>'message',''),reviewed_by=actor_id,reviewed_at=now(),updated_at=now() where id=request_row.id;
    message_title:='More information required'; message_body:=coalesce(nullif(decision_data->>'message',''),'The club needs more information before deciding this request.');
  elsif decision_value='reject' then
    update public.coach_hub_requests set status='rejected',admin_notes=nullif(decision_data->>'message',''),reviewed_by=actor_id,reviewed_at=now(),updated_at=now() where id=request_row.id;
    message_title:='Request declined'; message_body:=coalesce(nullif(decision_data->>'message',''),'The club could not approve this booking request.');
  else raise exception 'Unsupported coach request decision' using errcode='22023'; end if;
  insert into public.coach_hub_messages(club_id,person_id,team_key,message_type,title,body,related_type,related_id,requires_acknowledgement,created_by)
  values(target_club_id,request_row.person_id,request_row.team_key,case when decision_value in ('alternative','needs_information') then 'action_required' else 'booking_decision' end,message_title,message_body,'coach_request',request_row.id::text,decision_value in ('alternative','needs_information'),actor_id);
  perform public.record_audit_event(target_club_id,'coach_hub.request.'||decision_value,'coach_hub_request',request_row.id::text,jsonb_build_object('booking_id',booking_id));
  return (select to_jsonb(row_value) from public.coach_hub_requests row_value where row_value.id=request_row.id);
end;
$$;

create or replace function public.respond_to_coach_hub_alternative(target_club_id uuid,target_request_id uuid,response_value text,coach_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); request_row public.coach_hub_requests%rowtype; response_safe text:=lower(trim(coalesce(response_value,''))); booking_id uuid;
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select * into request_row from public.coach_hub_requests where id=target_request_id and club_id=target_club_id and person_id=person_id and status='alternative_offered' for update;
  if request_row.id is null then raise exception 'Alternative offer not found' using errcode='P0002'; end if;
  if response_safe='accept' then
    booking_id:=private.create_booking_from_coach_request(request_row,coalesce(request_row.reviewed_by,auth.uid()),true);
    update public.coach_hub_requests set status='accepted',resulting_booking_id=booking_id,coach_notes=concat_ws(E'\n',coach_notes,nullif(coach_message,'')),updated_at=now() where id=request_row.id;
  elsif response_safe='decline' then
    update public.coach_hub_requests set status='declined',coach_notes=concat_ws(E'\n',coach_notes,nullif(coach_message,'')),updated_at=now() where id=request_row.id;
  else raise exception 'Choose accept or decline' using errcode='22023'; end if;
  perform public.record_audit_event(target_club_id,'coach_hub.alternative.'||response_safe,'coach_hub_request',request_row.id::text,jsonb_build_object('booking_id',booking_id));
  return (select to_jsonb(row_value)-'admin_notes' from public.coach_hub_requests row_value where row_value.id=request_row.id);
end;
$$;

create or replace function public.mark_coach_hub_message(target_club_id uuid,target_message_id uuid,acknowledge boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare coach_person_id uuid:=private.current_coach_person_id(target_club_id); message_row public.coach_hub_messages%rowtype;
begin
  if coach_person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  select message.* into message_row
  from public.coach_hub_messages message
  where message.id=target_message_id
    and message.club_id=target_club_id
    and (message.person_id=coach_person_id or message.person_id is null);
  if message_row.id is null then raise exception 'Message not found' using errcode='P0002'; end if;
  insert into public.coach_hub_message_receipts(message_id,user_id,read_at,acknowledged_at)
  values(message_row.id,auth.uid(),now(),case when acknowledge then now() else null end)
  on conflict(message_id,user_id) do update set read_at=coalesce(public.coach_hub_message_receipts.read_at,now()),acknowledged_at=case when acknowledge then now() else public.coach_hub_message_receipts.acknowledged_at end,updated_at=now();
  return jsonb_build_object('message_id',message_row.id,'read_at',now(),'acknowledged',acknowledge);
end;
$$;

create or replace function public.update_my_coach_hub_profile(target_club_id uuid,profile_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); result public.coach_hub_people%rowtype;
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  update public.coach_hub_people set display_name=left(trim(coalesce(profile_data->>'display_name',display_name)),160),mobile=left(trim(coalesce(profile_data->>'mobile',mobile)),40),preferred_channel=case lower(trim(coalesce(profile_data->>'preferred_channel',preferred_channel))) when 'sms' then 'sms' when 'whatsapp' then 'whatsapp' when 'in_app' then 'in_app' else 'email' end,last_verified_at=now(),updated_at=now() where id=person_id returning * into result;
  update public.team_contacts contact set coach_name=case when assignment.source_slot='coach' then result.display_name else contact.coach_name end,coach_phone=case when assignment.source_slot='coach' then result.mobile else contact.coach_phone end,assistant_name=case when assignment.source_slot='assistant' then result.display_name else contact.assistant_name end,assistant_phone=case when assignment.source_slot='assistant' then result.mobile else contact.assistant_phone end,preferred_channel=case when result.preferred_channel in ('email','sms','whatsapp') then result.preferred_channel else contact.preferred_channel end,last_verified_at=now(),updated_at=now()
  from public.coach_hub_team_assignments assignment where assignment.person_id=result.id and assignment.club_id=contact.club_id and assignment.team_key=contact.team_key and contact.club_id=target_club_id;
  perform public.record_audit_event(target_club_id,'coach_hub.profile.updated','coach_hub_person',person_id::text,jsonb_build_object('preferred_channel',result.preferred_channel));
  return to_jsonb(result)-'identity_key';
end;
$$;

create or replace function public.create_coach_hub_calendar_feed(target_club_id uuid,label_value text default 'My team calendar')
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare person_id uuid:=private.current_coach_person_id(target_club_id); raw_token text:=encode(gen_random_bytes(32),'hex'); feed_id uuid;
begin
  if person_id is null then raise exception 'Coach Hub access denied' using errcode='42501'; end if;
  update public.coach_hub_calendar_feeds set status='revoked',revoked_at=now() where club_id=target_club_id and person_id=person_id and status='active';
  insert into public.coach_hub_calendar_feeds(club_id,person_id,token_hash,label) values(target_club_id,person_id,encode(digest(raw_token,'sha256'),'hex'),left(trim(coalesce(label_value,'My team calendar')),120)) returning id into feed_id;
  return jsonb_build_object('id',feed_id,'token',raw_token,'label',label_value);
end;
$$;

create or replace function public.get_coach_hub_calendar_by_token(feed_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare feed public.coach_hub_calendar_feeds%rowtype;
begin
  select * into feed from public.coach_hub_calendar_feeds row_value where row_value.token_hash=encode(digest(trim(coalesce(feed_token,'')),'sha256'),'hex') and row_value.status='active';
  if feed.id is null then raise exception 'Calendar feed is invalid or revoked' using errcode='P0002'; end if;
  update public.coach_hub_calendar_feeds set last_accessed_at=now() where id=feed.id;
  return jsonb_build_object('club_name',(select name from public.clubs where id=feed.club_id),'label',feed.label,'bookings',coalesce((select jsonb_agg(to_jsonb(booking)-'cost_pence'-'supplier_reference'-'notes' order by booking.start_at) from public.annual_planner_bookings booking where booking.club_id=feed.club_id and booking.team_key in(select assignment.team_key from public.coach_hub_team_assignments assignment where assignment.person_id=feed.person_id and assignment.status='active') and booking.status in ('provisional','confirmed') and booking.end_at>now()-interval '30 days'),'[]'::jsonb));
end;
$$;

-- Extend the fail-closed override vocabulary. Annual Planner add-on implies Coach Hub.
create or replace function private.sanitise_subscription_package_overrides()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  known_entitlements constant text[]:=array['dashboard','club_profile','fixture_import','league_link','communications','resource_registry','matchday_scheduling','midweek_scheduling','operations_advanced','pitch_intelligence','parking_intelligence','weather_intelligence','officials_management','reports_operations','reports_advanced','analytics_core','analytics_advanced','data_export','multi_venue','priority_support','premium_support','advanced_integrations','organisation_command','executive_reporting','governance_controls','approval_workflows','site_responsibility','communication_governance','funding_portfolio','enhanced_audit','annual_planner','coach_hub'];
  known_limits constant text[]:=array['teams','venues','users','pitches','history_entries','history_retention_days'];
  effective_entitlements text[]:='{}'::text[]; safe_entitlement_overrides jsonb:='{}'::jsonb; safe_limit_overrides jsonb:='{}'::jsonb;
begin
  select coalesce(jsonb_object_agg(entry.key,to_jsonb(true)),'{}'::jsonb) into safe_entitlement_overrides from jsonb_each_text(coalesce(new.entitlement_overrides,'{}'::jsonb)) entry where entry.key=any(known_entitlements) and lower(entry.value)='true';
  if coalesce((safe_entitlement_overrides->>'annual_planner')::boolean,false) then safe_entitlement_overrides:=safe_entitlement_overrides||jsonb_build_object('coach_hub',true); end if;
  select coalesce(jsonb_object_agg(entry.key,to_jsonb(greatest(0,(entry.value)::numeric))),'{}'::jsonb) into safe_limit_overrides from jsonb_each_text(coalesce(new.limit_overrides,'{}'::jsonb)) entry where entry.key=any(known_limits) and entry.value~'^-?[0-9]+(\.[0-9]+)?$';
  new.entitlement_overrides:=safe_entitlement_overrides; new.limit_overrides:=safe_limit_overrides;
  select coalesce(plan.entitlements,'{}'::text[])||coalesce(array(select key from jsonb_each_text(safe_entitlement_overrides) where lower(value)='true'),'{}'::text[]) into effective_entitlements from public.subscription_plans plan where plan.code=new.plan_code;
  if 'coach_hub'=any(effective_entitlements) and not 'annual_planner'=any(effective_entitlements) then raise exception 'Coach Hub requires Annual Planner' using errcode='22023'; end if;
  if 'approval_workflows'=any(effective_entitlements) and not ('organisation_command'=any(effective_entitlements) and 'governance_controls'=any(effective_entitlements)) then raise exception 'Approval workflows require Organisation Command and governance controls' using errcode='22023'; end if;
  if 'site_responsibility'=any(effective_entitlements) and not 'organisation_command'=any(effective_entitlements) then raise exception 'Site responsibility requires Organisation Command' using errcode='22023'; end if;
  if 'reports_advanced'=any(effective_entitlements) and not 'reports_operations'=any(effective_entitlements) then raise exception 'Advanced reports require operational reports' using errcode='22023'; end if;
  if 'analytics_advanced'=any(effective_entitlements) and not 'analytics_core'=any(effective_entitlements) then raise exception 'Advanced analytics require core analytics' using errcode='22023'; end if;
  return new;
end;
$$;

revoke all on function public.can_access_coach_hub(uuid), public.sync_coach_hub_contacts(uuid), public.list_coach_hub_admin_workspace(uuid), public.list_coach_hub_request_queue(uuid), public.create_coach_hub_invitation(uuid,uuid,integer), public.prepare_coach_hub_invitation_delivery(uuid,uuid,text), public.complete_coach_hub_invitation_delivery(uuid,text,text,text,text), public.accept_coach_hub_invitation(text), public.get_coach_hub_workspace(uuid,date,date), public.submit_coach_hub_request(uuid,jsonb), public.review_coach_hub_request(uuid,uuid,text,jsonb), public.respond_to_coach_hub_alternative(uuid,uuid,text,text), public.mark_coach_hub_message(uuid,uuid,boolean), public.update_my_coach_hub_profile(uuid,jsonb), public.create_coach_hub_calendar_feed(uuid,text), public.get_coach_hub_calendar_by_token(text) from public,anon,authenticated;

grant execute on function public.can_access_coach_hub(uuid), public.sync_coach_hub_contacts(uuid), public.list_coach_hub_admin_workspace(uuid), public.list_coach_hub_request_queue(uuid), public.create_coach_hub_invitation(uuid,uuid,integer), public.prepare_coach_hub_invitation_delivery(uuid,uuid,text), public.accept_coach_hub_invitation(text), public.get_coach_hub_workspace(uuid,date,date), public.submit_coach_hub_request(uuid,jsonb), public.review_coach_hub_request(uuid,uuid,text,jsonb), public.respond_to_coach_hub_alternative(uuid,uuid,text,text), public.mark_coach_hub_message(uuid,uuid,boolean), public.update_my_coach_hub_profile(uuid,jsonb), public.create_coach_hub_calendar_feed(uuid,text) to authenticated;
grant execute on function public.complete_coach_hub_invitation_delivery(uuid,text,text,text,text), public.get_coach_hub_calendar_by_token(text) to service_role;

commit;
notify pgrst,'reload schema';
