-- Daxora Ground Control: resumable customer onboarding.
-- Apply after 202607030002_roles_audit_support.sql.
-- Existing clubs are marked complete so the upgrade never blocks a live workspace.
-- Clubs provisioned after this migration receive a required onboarding record.

begin;

create table if not exists public.club_onboarding (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'complete')),
  current_step integer not null default 0 check (current_step between 0 and 7),
  completed_steps text[] not null default '{}'::text[],
  draft jsonb not null default '{}'::jsonb,
  required boolean not null default true,
  started_at timestamptz,
  completed_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(draft) = 'object')
);

create index if not exists club_onboarding_status_idx
  on public.club_onboarding(status, required, updated_at desc);

drop trigger if exists club_onboarding_touch_updated_at on public.club_onboarding;
create trigger club_onboarding_touch_updated_at
before update on public.club_onboarding
for each row execute function public.touch_updated_at();

-- Do not interrupt clubs already using Ground Control. They can re-run the wizard
-- voluntarily from Settings, while newly provisioned clubs start as required.
insert into public.club_onboarding (
  club_id,
  status,
  current_step,
  completed_steps,
  required,
  started_at,
  completed_at,
  updated_by
)
select
  club.id,
  'complete',
  7,
  array['welcome', 'club', 'workspace', 'venue', 'schedule', 'resources', 'fixtures', 'review']::text[],
  false,
  club.created_at,
  now(),
  club.created_by
from public.clubs club
on conflict (club_id) do nothing;

create or replace function private.create_club_onboarding_record()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.club_onboarding (
    club_id,
    status,
    current_step,
    completed_steps,
    draft,
    required,
    updated_by
  ) values (
    new.id,
    'pending',
    0,
    '{}'::text[],
    '{}'::jsonb,
    true,
    new.created_by
  ) on conflict (club_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ground_control_create_club_onboarding on public.clubs;
create trigger ground_control_create_club_onboarding
after insert on public.clubs
for each row execute function private.create_club_onboarding_record();

alter table public.club_onboarding enable row level security;
alter table public.club_onboarding force row level security;

drop policy if exists club_onboarding_read on public.club_onboarding;
create policy club_onboarding_read
on public.club_onboarding
for select
to authenticated
using (public.can_read_club(club_id));

-- Writes are deliberately RPC-only so validation and audit events cannot be
-- bypassed by a custom REST request.
revoke all on public.club_onboarding from anon, authenticated;
grant select on public.club_onboarding to authenticated;

create or replace function public.get_club_onboarding(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  onboarding_row public.club_onboarding%rowtype;
begin
  if auth.uid() is null or not public.can_read_club(target_club_id) then
    raise exception 'Club access required' using errcode = '42501';
  end if;

  select * into onboarding_row
  from public.club_onboarding
  where club_id = target_club_id;

  if onboarding_row.club_id is null then
    return jsonb_build_object(
      'status', 'pending',
      'current_step', 0,
      'completed_steps', '[]'::jsonb,
      'draft', '{}'::jsonb,
      'required', true
    );
  end if;

  return jsonb_build_object(
    'status', onboarding_row.status,
    'current_step', onboarding_row.current_step,
    'completed_steps', to_jsonb(onboarding_row.completed_steps),
    'draft', onboarding_row.draft,
    'required', onboarding_row.required,
    'started_at', onboarding_row.started_at,
    'completed_at', onboarding_row.completed_at,
    'updated_at', onboarding_row.updated_at
  );
end;
$$;

create or replace function public.start_club_onboarding(
  target_club_id uuid,
  force_restart boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  existing_row public.club_onboarding%rowtype;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;

  select * into existing_row
  from public.club_onboarding
  where club_id = target_club_id
  for update;

  if existing_row.club_id is null then
    insert into public.club_onboarding (
      club_id,
      status,
      current_step,
      completed_steps,
      draft,
      required,
      started_at,
      updated_by
    ) values (
      target_club_id,
      'in_progress',
      0,
      '{}'::text[],
      '{}'::jsonb,
      true,
      now(),
      actor_id
    );
  elsif existing_row.status = 'complete' and not force_restart then
    return public.get_club_onboarding(target_club_id);
  else
    update public.club_onboarding
    set status = 'in_progress',
        current_step = case when force_restart then 0 else current_step end,
        completed_steps = case when force_restart then '{}'::text[] else completed_steps end,
        draft = case when force_restart then '{}'::jsonb else draft end,
        started_at = coalesce(started_at, now()),
        completed_at = case when force_restart then null else completed_at end,
        updated_by = actor_id,
        updated_at = now()
    where club_id = target_club_id;
  end if;

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    case when force_restart then 'onboarding.restart' else 'onboarding.start' end,
    'club_onboarding',
    target_club_id::text,
    jsonb_build_object('force_restart', force_restart),
    'database'
  );

  return public.get_club_onboarding(target_club_id);
end;
$$;

create or replace function public.save_club_onboarding(
  target_club_id uuid,
  step_index integer,
  completed_step_ids text[],
  onboarding_draft jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if step_index < 0 or step_index > 7 then
    raise exception 'Onboarding step is outside the supported range' using errcode = '22023';
  end if;
  if onboarding_draft is null or jsonb_typeof(onboarding_draft) <> 'object' then
    raise exception 'Onboarding draft must be a JSON object' using errcode = '22023';
  end if;

  insert into public.club_onboarding (
    club_id,
    status,
    current_step,
    completed_steps,
    draft,
    required,
    started_at,
    updated_by
  ) values (
    target_club_id,
    'in_progress',
    step_index,
    coalesce(completed_step_ids, '{}'::text[]),
    onboarding_draft,
    true,
    now(),
    actor_id
  )
  on conflict (club_id)
  do update set
    status = 'in_progress',
    current_step = excluded.current_step,
    completed_steps = excluded.completed_steps,
    draft = excluded.draft,
    started_at = coalesce(public.club_onboarding.started_at, now()),
    completed_at = null,
    updated_by = actor_id,
    updated_at = now();

  return public.get_club_onboarding(target_club_id);
end;
$$;

create or replace function public.complete_club_onboarding(
  target_club_id uuid,
  configuration jsonb,
  teams jsonb,
  pitches jsonb,
  final_draft jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  team_records jsonb;
  pitch_records jsonb;
  team_count integer := 0;
  pitch_count integer := 0;
begin
  if actor_id is null or not public.can_manage_club(target_club_id) then
    raise exception 'Club administrator access required' using errcode = '42501';
  end if;
  if configuration is null or jsonb_typeof(configuration) <> 'object' then
    raise exception 'Club configuration must be a JSON object' using errcode = '22023';
  end if;
  if teams is null or jsonb_typeof(teams) <> 'array' or jsonb_array_length(teams) < 1 then
    raise exception 'At least one team is required' using errcode = '22023';
  end if;
  if pitches is null or jsonb_typeof(pitches) <> 'array' or jsonb_array_length(pitches) < 1 then
    raise exception 'At least one pitch is required' using errcode = '22023';
  end if;
  if final_draft is null or jsonb_typeof(final_draft) <> 'object' then
    raise exception 'Final onboarding draft must be a JSON object' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', coalesce(nullif(item.value ->> 'id', ''), 'team_' || (item.ordinality - 1)::text),
        'data', item.value
      ) order by item.ordinality
    ),
    '[]'::jsonb
  ) into team_records
  from jsonb_array_elements(teams) with ordinality item(value, ordinality);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', coalesce(nullif(item.value ->> 'id', ''), 'P' || item.ordinality::text),
        'data', item.value
      ) order by item.ordinality
    ),
    '[]'::jsonb
  ) into pitch_records
  from jsonb_array_elements(pitches) with ordinality item(value, ordinality);

  perform public.save_club_configuration(target_club_id, configuration);
  team_count := public.replace_club_collection(target_club_id, 'team_config', team_records);
  pitch_count := public.replace_club_collection(target_club_id, 'pitches', pitch_records);

  insert into public.club_onboarding (
    club_id,
    status,
    current_step,
    completed_steps,
    draft,
    required,
    started_at,
    completed_at,
    updated_by
  ) values (
    target_club_id,
    'complete',
    7,
    array['welcome', 'club', 'workspace', 'venue', 'schedule', 'resources', 'fixtures', 'review']::text[],
    final_draft,
    false,
    now(),
    now(),
    actor_id
  )
  on conflict (club_id)
  do update set
    status = 'complete',
    current_step = 7,
    completed_steps = excluded.completed_steps,
    draft = excluded.draft,
    required = false,
    started_at = coalesce(public.club_onboarding.started_at, now()),
    completed_at = now(),
    updated_by = actor_id,
    updated_at = now();

  perform private.write_audit_event(
    target_club_id,
    actor_id,
    'onboarding.complete',
    'club_onboarding',
    target_club_id::text,
    jsonb_build_object(
      'team_count', team_count,
      'pitch_count', pitch_count,
      'parking_enabled', coalesce((configuration #>> '{features,parkingEnabled}')::boolean, true),
      'midweek_enabled', coalesce((configuration #>> '{features,midweekEnabled}')::boolean, true)
    ),
    'database'
  );

  return public.get_club_onboarding(target_club_id);
end;
$$;

revoke all on function public.get_club_onboarding(uuid) from public, anon;
revoke all on function public.start_club_onboarding(uuid, boolean) from public, anon;
revoke all on function public.save_club_onboarding(uuid, integer, text[], jsonb) from public, anon;
revoke all on function public.complete_club_onboarding(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;

grant execute on function public.get_club_onboarding(uuid) to authenticated;
grant execute on function public.start_club_onboarding(uuid, boolean) to authenticated;
grant execute on function public.save_club_onboarding(uuid, integer, text[], jsonb) to authenticated;
grant execute on function public.complete_club_onboarding(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

commit;
