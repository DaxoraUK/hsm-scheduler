-- Daxora Ground Control: GDPR-by-design coach contacts and communications audit.
-- Personal contact details move out of the general team configuration so viewers
-- and support sessions cannot read them. All writes are authenticated, club-scoped
-- and recorded server-side.

begin;

create table if not exists public.communication_privacy_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  controller_name text not null default '',
  privacy_contact_email text not null default '',
  lawful_basis text not null default '' check (lawful_basis in ('', 'consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')),
  purpose text not null default 'Operational matchday communication with adult team coaches and managers.',
  privacy_notice_url text not null default '',
  retention_days integer not null default 365 check (retention_days between 30 and 2555),
  dpia_status text not null default 'not_assessed' check (dpia_status in ('not_assessed', 'screened_no_high_risk', 'full_dpia_required', 'completed')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_contacts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_key text not null check (length(trim(team_key)) between 1 and 160),
  team_name text not null default '',
  coach_name text not null default '',
  coach_phone text not null default '',
  coach_email text not null default '',
  preferred_channel text not null default 'whatsapp' check (preferred_channel in ('whatsapp', 'sms', 'email')),
  assistant_name text not null default '',
  assistant_phone text not null default '',
  assistant_email text not null default '',
  assistant_enabled boolean not null default false,
  receive_matchday_messages boolean not null default true,
  privacy_notice_provided_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, team_key)
);

create table if not exists public.communication_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  message_key text not null check (length(trim(message_key)) between 1 and 240),
  message_hash text not null default '',
  fixture_id text,
  team_key text,
  team_name text not null default '',
  action text not null check (action in ('queue_opened', 'reviewed', 'copied', 'channel_opened', 'send_attempted', 'sent', 'delivered', 'failed')),
  channel text check (channel is null or channel in ('whatsapp', 'sms', 'email', 'copy', 'other')),
  recipient_type text check (recipient_type is null or recipient_type in ('coach', 'assistant', 'multiple')),
  recipient_label text not null default '',
  recipient_hint text not null default '',
  provider_name text,
  provider_reference text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retention_expires_at timestamptz not null default (now() + interval '365 days'),
  created_at timestamptz not null default now()
);

create index if not exists team_contacts_club_name_idx on public.team_contacts(club_id, team_name);
create index if not exists communication_events_club_time_idx on public.communication_events(club_id, occurred_at desc);
create index if not exists communication_events_expiry_idx on public.communication_events(retention_expires_at);

-- Move any contact details created by the preceding UI phase into the restricted table.
insert into public.team_contacts (
  club_id,
  team_key,
  team_name,
  coach_name,
  coach_phone,
  coach_email,
  preferred_channel,
  assistant_name,
  assistant_phone,
  assistant_email,
  assistant_enabled,
  receive_matchday_messages,
  privacy_notice_provided_at,
  last_verified_at
)
select
  row.club_id,
  row.id,
  coalesce(row.data ->> 'name', row.id),
  coalesce(row.data ->> 'managerName', row.data ->> 'coachName', ''),
  coalesce(row.data ->> 'managerPhone', row.data ->> 'coachPhone', ''),
  lower(coalesce(row.data ->> 'managerEmail', row.data ->> 'coachEmail', '')),
  case lower(coalesce(row.data ->> 'communicationChannel', 'whatsapp'))
    when 'sms' then 'sms'
    when 'email' then 'email'
    else 'whatsapp'
  end,
  coalesce(row.data ->> 'assistantName', ''),
  coalesce(row.data ->> 'assistantPhone', ''),
  lower(coalesce(row.data ->> 'assistantEmail', '')),
  coalesce(nullif(row.data ->> 'assistantEnabled', '')::boolean, false),
  coalesce(nullif(row.data ->> 'receiveMatchdayMessages', '')::boolean, true),
  nullif(row.data ->> 'privacyNoticeProvidedAt', '')::timestamptz,
  nullif(row.data ->> 'contactLastVerifiedAt', '')::timestamptz
from public.team_config row
where row.club_id is not null
  and (
    coalesce(row.data ->> 'managerName', row.data ->> 'coachName', '') <> '' or
    coalesce(row.data ->> 'managerPhone', row.data ->> 'coachPhone', '') <> '' or
    coalesce(row.data ->> 'managerEmail', row.data ->> 'coachEmail', '') <> '' or
    coalesce(row.data ->> 'assistantName', '') <> '' or
    coalesce(row.data ->> 'assistantPhone', '') <> '' or
    coalesce(row.data ->> 'assistantEmail', '') <> ''
  )
on conflict (club_id, team_key) do update set
  team_name = excluded.team_name,
  coach_name = excluded.coach_name,
  coach_phone = excluded.coach_phone,
  coach_email = excluded.coach_email,
  preferred_channel = excluded.preferred_channel,
  assistant_name = excluded.assistant_name,
  assistant_phone = excluded.assistant_phone,
  assistant_email = excluded.assistant_email,
  assistant_enabled = excluded.assistant_enabled,
  receive_matchday_messages = excluded.receive_matchday_messages,
  privacy_notice_provided_at = excluded.privacy_notice_provided_at,
  last_verified_at = excluded.last_verified_at,
  updated_at = now();

create or replace function private.strip_team_contact_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.data := coalesce(new.data, '{}'::jsonb)
    - 'managerName' - 'managerPhone' - 'managerEmail'
    - 'coachName' - 'coachPhone' - 'coachEmail'
    - 'communicationChannel'
    - 'assistantName' - 'assistantPhone' - 'assistantEmail' - 'assistantEnabled'
    - 'receiveMatchdayMessages' - 'privacyNoticeProvidedAt' - 'contactLastVerifiedAt';
  return new;
end;
$$;

drop trigger if exists team_config_strip_contact_fields on public.team_config;
create trigger team_config_strip_contact_fields
before insert or update of data on public.team_config
for each row execute function private.strip_team_contact_fields();

-- Strip legacy copies immediately after their migration.
update public.team_config
set data = data
  - 'managerName' - 'managerPhone' - 'managerEmail'
  - 'coachName' - 'coachPhone' - 'coachEmail'
  - 'communicationChannel'
  - 'assistantName' - 'assistantPhone' - 'assistantEmail' - 'assistantEnabled'
  - 'receiveMatchdayMessages' - 'privacyNoticeProvidedAt' - 'contactLastVerifiedAt'
where data ?| array[
  'managerName', 'managerPhone', 'managerEmail', 'coachName', 'coachPhone', 'coachEmail',
  'communicationChannel', 'assistantName', 'assistantPhone', 'assistantEmail',
  'assistantEnabled', 'receiveMatchdayMessages', 'privacyNoticeProvidedAt', 'contactLastVerifiedAt'
];

create or replace function public.get_communication_privacy_settings(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_build_object(
      'controller_name', settings.controller_name,
      'privacy_contact_email', settings.privacy_contact_email,
      'lawful_basis', settings.lawful_basis,
      'purpose', settings.purpose,
      'privacy_notice_url', settings.privacy_notice_url,
      'retention_days', settings.retention_days,
      'dpia_status', settings.dpia_status,
      'last_reviewed_at', settings.last_reviewed_at,
      'updated_at', settings.updated_at
    )
    from public.communication_privacy_settings settings
    where settings.club_id = target_club_id
  ), jsonb_build_object(
    'controller_name', '',
    'privacy_contact_email', '',
    'lawful_basis', '',
    'purpose', 'Operational matchday communication with adult team coaches and managers.',
    'privacy_notice_url', '',
    'retention_days', 365,
    'dpia_status', 'not_assessed',
    'last_reviewed_at', null,
    'updated_at', null
  ));
end;
$$;

create or replace function public.save_communication_privacy_settings(
  target_club_id uuid,
  settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  next_basis text := lower(trim(coalesce(settings ->> 'lawfulBasis', settings ->> 'lawful_basis', '')));
  next_purpose text := trim(coalesce(settings ->> 'purpose', ''));
  next_notice text := trim(coalesce(settings ->> 'privacyNoticeUrl', settings ->> 'privacy_notice_url', ''));
  next_email text := lower(trim(coalesce(settings ->> 'privacyContactEmail', settings ->> 'privacy_contact_email', '')));
  next_controller text := trim(coalesce(settings ->> 'controllerName', settings ->> 'controller_name', ''));
  next_retention integer := greatest(30, least(coalesce(nullif(settings ->> 'retentionDays', '')::integer, nullif(settings ->> 'retention_days', '')::integer, 365), 2555));
  next_dpia text := lower(trim(coalesce(settings ->> 'dpiaStatus', settings ->> 'dpia_status', 'not_assessed')));
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if next_basis not in ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests') then
    raise exception 'Select a valid lawful basis' using errcode = '22023';
  end if;
  if length(next_purpose) < 20 then
    raise exception 'Communication purpose must be specific' using errcode = '22023';
  end if;
  if next_dpia not in ('not_assessed', 'screened_no_high_risk', 'full_dpia_required', 'completed') then
    raise exception 'Select a valid DPIA status' using errcode = '22023';
  end if;

  insert into public.communication_privacy_settings (
    club_id, controller_name, privacy_contact_email, lawful_basis, purpose,
    privacy_notice_url, retention_days, dpia_status, last_reviewed_at
  ) values (
    target_club_id, next_controller, next_email, next_basis, next_purpose,
    next_notice, next_retention, next_dpia, now()
  )
  on conflict (club_id) do update set
    controller_name = excluded.controller_name,
    privacy_contact_email = excluded.privacy_contact_email,
    lawful_basis = excluded.lawful_basis,
    purpose = excluded.purpose,
    privacy_notice_url = excluded.privacy_notice_url,
    retention_days = excluded.retention_days,
    dpia_status = excluded.dpia_status,
    last_reviewed_at = now(),
    updated_at = now();

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'communications.privacy.save',
    'communication_privacy_settings',
    target_club_id::text,
    jsonb_build_object('lawful_basis', next_basis, 'retention_days', next_retention, 'dpia_status', next_dpia),
    'database'
  );

  return public.get_communication_privacy_settings(target_club_id);
end;
$$;

create or replace function public.list_team_contacts(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;

  return coalesce((
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
      'updated_at', contact.updated_at
    ) order by contact.team_name, contact.team_key)
    from public.team_contacts contact
    where contact.club_id = target_club_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.replace_team_contacts(
  target_club_id uuid,
  records jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_records jsonb := coalesce(records, '[]'::jsonb);
  record_count integer := 0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_records) <> 'array' then
    raise exception 'records must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(safe_records) > 500 then
    raise exception 'Too many team contacts' using errcode = '22023';
  end if;

  delete from public.team_contacts where club_id = target_club_id;

  insert into public.team_contacts (
    club_id, team_key, team_name, coach_name, coach_phone, coach_email,
    preferred_channel, assistant_name, assistant_phone, assistant_email,
    assistant_enabled, receive_matchday_messages, privacy_notice_provided_at,
    last_verified_at
  )
  select
    target_club_id,
    trim(item ->> 'teamKey'),
    trim(coalesce(item ->> 'teamName', '')),
    left(trim(coalesce(item ->> 'coachName', '')), 160),
    left(trim(coalesce(item ->> 'coachPhone', '')), 40),
    left(lower(trim(coalesce(item ->> 'coachEmail', ''))), 254),
    case lower(trim(coalesce(item ->> 'preferredChannel', 'whatsapp')))
      when 'sms' then 'sms'
      when 'email' then 'email'
      else 'whatsapp'
    end,
    left(trim(coalesce(item ->> 'assistantName', '')), 160),
    left(trim(coalesce(item ->> 'assistantPhone', '')), 40),
    left(lower(trim(coalesce(item ->> 'assistantEmail', ''))), 254),
    coalesce(nullif(item ->> 'assistantEnabled', '')::boolean, false),
    coalesce(nullif(item ->> 'receiveMatchdayMessages', '')::boolean, true),
    nullif(item ->> 'privacyNoticeProvidedAt', '')::timestamptz,
    coalesce(nullif(item ->> 'lastVerifiedAt', '')::timestamptz, now())
  from jsonb_array_elements(safe_records) item
  where nullif(trim(item ->> 'teamKey'), '') is not null;

  get diagnostics record_count = row_count;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'communications.contacts.replace',
    'team_contacts',
    'team_contacts',
    jsonb_build_object('record_count', record_count),
    'database'
  );

  return record_count;
end;
$$;

create or replace function public.delete_team_contact(target_club_id uuid, target_team_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  deleted_count integer := 0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  delete from public.team_contacts
  where club_id = target_club_id and team_key = trim(target_team_key);
  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    perform private.write_audit_event(
      target_club_id,
      actor_id,
      'communications.contact.delete',
      'team_contact',
      trim(target_team_key),
      '{}'::jsonb,
      'database'
    );
  end if;

  return deleted_count > 0;
end;
$$;

create or replace function public.record_communication_event(
  target_club_id uuid,
  event_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_id uuid;
  next_action text := lower(trim(coalesce(event_data ->> 'action', '')));
  next_provider text := nullif(trim(coalesce(event_data ->> 'providerName', '')), '');
  next_reference text := nullif(trim(coalesce(event_data ->> 'providerReference', '')), '');
  retention integer := 365;
begin
  if actor_id is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;
  if next_action not in ('queue_opened', 'reviewed', 'copied', 'channel_opened', 'send_attempted', 'sent', 'delivered', 'failed') then
    raise exception 'Unsupported communication action' using errcode = '22023';
  end if;
  if next_action in ('sent', 'delivered') and (next_provider is null or next_reference is null) then
    raise exception 'Provider confirmation is required before recording sent or delivered' using errcode = '22023';
  end if;

  select settings.retention_days into retention
  from public.communication_privacy_settings settings
  where settings.club_id = target_club_id;
  retention := coalesce(retention, 365);

  insert into public.communication_events (
    club_id, actor_user_id, message_key, message_hash, fixture_id, team_key,
    team_name, action, channel, recipient_type, recipient_label, recipient_hint,
    provider_name, provider_reference, detail, occurred_at, retention_expires_at
  ) values (
    target_club_id,
    actor_id,
    left(trim(coalesce(event_data ->> 'messageKey', '')), 240),
    left(trim(coalesce(event_data ->> 'messageHash', '')), 512),
    nullif(left(trim(coalesce(event_data ->> 'fixtureId', '')), 240), ''),
    nullif(left(trim(coalesce(event_data ->> 'teamKey', '')), 160), ''),
    left(trim(coalesce(event_data ->> 'teamName', '')), 180),
    next_action,
    case lower(trim(coalesce(event_data ->> 'channel', '')))
      when 'whatsapp' then 'whatsapp'
      when 'sms' then 'sms'
      when 'email' then 'email'
      when 'copy' then 'copy'
      when 'other' then 'other'
      else null
    end,
    case lower(trim(coalesce(event_data ->> 'recipientType', '')))
      when 'coach' then 'coach'
      when 'assistant' then 'assistant'
      when 'multiple' then 'multiple'
      else null
    end,
    left(trim(coalesce(event_data ->> 'recipientLabel', '')), 180),
    left(trim(coalesce(event_data ->> 'recipientHint', '')), 80),
    next_provider,
    next_reference,
    coalesce(event_data -> 'detail', '{}'::jsonb),
    coalesce(nullif(event_data ->> 'occurredAt', '')::timestamptz, now()),
    now() + make_interval(days => retention)
  ) returning id into event_id;

  return event_id;
end;
$$;

create or replace function public.list_communication_events(
  target_club_id uuid,
  result_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(result_limit, 50), 200));
begin
  if auth.uid() is null or not public.can_operate_club(target_club_id) then
    raise exception 'Club operator access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(event_row) order by event_row.occurred_at desc)
    from (
      select
        event.id,
        event.message_key,
        event.message_hash,
        event.fixture_id,
        event.team_key,
        event.team_name,
        event.action,
        event.channel,
        event.recipient_type,
        event.recipient_label,
        event.recipient_hint,
        event.provider_name,
        event.provider_reference,
        event.detail,
        event.occurred_at,
        event.retention_expires_at,
        coalesce(profile.display_name, profile.email, event.actor_user_id::text) as actor_label
      from public.communication_events event
      left join public.user_profiles profile on profile.id = event.actor_user_id
      where event.club_id = target_club_id
        and event.retention_expires_at > now()
      order by event.occurred_at desc
      limit safe_limit
    ) event_row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.purge_expired_communication_events(target_club_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  deleted_count integer := 0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  delete from public.communication_events
  where club_id = target_club_id and retention_expires_at <= now();
  get diagnostics deleted_count = row_count;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'communications.retention.purge',
    'communication_events',
    'expired',
    jsonb_build_object('deleted_count', deleted_count),
    'database'
  );

  return deleted_count;
end;
$$;

alter table public.communication_privacy_settings enable row level security;
alter table public.communication_privacy_settings force row level security;
alter table public.team_contacts enable row level security;
alter table public.team_contacts force row level security;
alter table public.communication_events enable row level security;
alter table public.communication_events force row level security;

-- No direct browser table access: all reads and writes use guarded functions.
revoke all on public.communication_privacy_settings from public, anon, authenticated;
revoke all on public.team_contacts from public, anon, authenticated;
revoke all on public.communication_events from public, anon, authenticated;

revoke all on function private.strip_team_contact_fields() from public, anon, authenticated;
revoke all on function public.get_communication_privacy_settings(uuid) from public, anon, authenticated;
revoke all on function public.save_communication_privacy_settings(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.list_team_contacts(uuid) from public, anon, authenticated;
revoke all on function public.replace_team_contacts(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.delete_team_contact(uuid, text) from public, anon, authenticated;
revoke all on function public.record_communication_event(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.list_communication_events(uuid, integer) from public, anon, authenticated;
revoke all on function public.purge_expired_communication_events(uuid) from public, anon, authenticated;

grant execute on function public.get_communication_privacy_settings(uuid) to authenticated;
grant execute on function public.save_communication_privacy_settings(uuid, jsonb) to authenticated;
grant execute on function public.list_team_contacts(uuid) to authenticated;
grant execute on function public.replace_team_contacts(uuid, jsonb) to authenticated;
grant execute on function public.delete_team_contact(uuid, text) to authenticated;
grant execute on function public.record_communication_event(uuid, jsonb) to authenticated;
grant execute on function public.list_communication_events(uuid, integer) to authenticated;
grant execute on function public.purge_expired_communication_events(uuid) to authenticated;

commit;
