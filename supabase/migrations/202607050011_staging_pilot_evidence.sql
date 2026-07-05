begin;

create table if not exists public.platform_launch_gate_evidence (
  id uuid primary key default gen_random_uuid(),
  gate_code text not null references public.platform_launch_gates(code) on delete cascade,
  evidence_type text not null
    check (evidence_type in ('automated_test', 'manual_test', 'deployment', 'security_review', 'backup_restore', 'document', 'decision', 'observation')),
  result text not null
    check (result in ('pass', 'fail', 'observation')),
  environment text not null default 'staging'
    check (environment in ('local', 'development', 'staging', 'production')),
  release text,
  summary text not null,
  artifact_url text,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (length(trim(summary)) between 8 and 4000),
  check (artifact_url is null or artifact_url ~ '^https://'),
  check (jsonb_typeof(metadata) = 'object')
);

create index if not exists platform_launch_gate_evidence_gate_idx
  on public.platform_launch_gate_evidence(gate_code, observed_at desc, created_at desc);

create table if not exists public.platform_pilot_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  cycle text not null
    check (cycle in ('historical_replay', 'shadow_live', 'controlled_use', 'signoff')),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed', 'blocked')),
  session_date date not null,
  operator_name text not null default '',
  fixture_count integer not null default 0 check (fixture_count >= 0),
  auto_scheduled_count integer not null default 0 check (auto_scheduled_count >= 0),
  manual_resolved_count integer not null default 0 check (manual_resolved_count >= 0),
  unresolved_count integer not null default 0 check (unresolved_count >= 0),
  invalid_recommendation_count integer not null default 0 check (invalid_recommendation_count >= 0),
  correct_warning_count integer not null default 0 check (correct_warning_count >= 0),
  missed_warning_count integer not null default 0 check (missed_warning_count >= 0),
  override_count integer not null default 0 check (override_count >= 0),
  critical_defect_count integer not null default 0 check (critical_defect_count >= 0),
  high_defect_count integer not null default 0 check (high_defect_count >= 0),
  time_saved_minutes integer not null default 0 check (time_saved_minutes >= 0),
  outcome text not null default 'not_run'
    check (outcome in ('not_run', 'pass', 'conditional', 'fail')),
  notes text not null default '',
  signoff_name text not null default '',
  signed_off_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_pilot_sessions_club_idx
  on public.platform_pilot_sessions(club_id, session_date desc, created_at desc);
create index if not exists platform_pilot_sessions_cycle_idx
  on public.platform_pilot_sessions(cycle, status, session_date desc);

create table if not exists public.platform_pilot_findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.platform_pilot_sessions(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  finding_type text not null default 'defect'
    check (finding_type in ('defect', 'usability', 'data', 'training', 'feature_request')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'deferred')),
  title text not null,
  description text not null,
  workaround text not null default '',
  reference text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(title)) between 4 and 180),
  check (length(trim(description)) between 8 and 8000)
);

create index if not exists platform_pilot_findings_club_idx
  on public.platform_pilot_findings(club_id, status, severity, created_at desc);
create index if not exists platform_pilot_findings_session_idx
  on public.platform_pilot_findings(session_id, created_at desc);

drop trigger if exists platform_pilot_sessions_touch_updated_at on public.platform_pilot_sessions;
create trigger platform_pilot_sessions_touch_updated_at
before update on public.platform_pilot_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists platform_pilot_findings_touch_updated_at on public.platform_pilot_findings;
create trigger platform_pilot_findings_touch_updated_at
before update on public.platform_pilot_findings
for each row execute function public.touch_updated_at();

insert into public.platform_launch_gates (code, title, category, owner_label)
values
  ('staging_environment', 'Production-like staging environment configured and accessible', 'deployment', 'Daxora'),
  ('automated_release_evidence', 'Automated lint, test and production-build evidence recorded', 'product', 'Daxora'),
  ('rls_isolation_evidence', 'Cross-club Row Level Security isolation test passed on staging', 'security', 'Daxora'),
  ('funding_document_security', 'Funding document storage and signed-link isolation verified', 'security', 'Daxora'),
  ('staging_smoke_test', 'Staging smoke test passed over HTTPS', 'deployment', 'Daxora'),
  ('hsm_historical_replay', 'Horwich St Mary''s historical replay completed', 'product', 'Daxora'),
  ('hsm_shadow_live', 'Horwich St Mary''s shadow-live cycle completed', 'product', 'Daxora'),
  ('hsm_controlled_use', 'Horwich St Mary''s controlled-use cycle completed', 'product', 'Daxora'),
  ('hsm_pilot_signoff', 'Horwich St Mary''s pilot decision and sign-off recorded', 'commercial', 'Daxora')
on conflict (code) do nothing;

alter table public.platform_launch_gate_evidence enable row level security;
alter table public.platform_launch_gate_evidence force row level security;
alter table public.platform_pilot_sessions enable row level security;
alter table public.platform_pilot_sessions force row level security;
alter table public.platform_pilot_findings enable row level security;
alter table public.platform_pilot_findings force row level security;

revoke all on table public.platform_launch_gate_evidence from public, anon, authenticated;
revoke all on table public.platform_pilot_sessions from public, anon, authenticated;
revoke all on table public.platform_pilot_findings from public, anon, authenticated;

create or replace function public.platform_get_pilot_evidence(target_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  perform private.require_platform_staff('support');

  select jsonb_build_object(
    'launch_evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', evidence.id,
        'gate_code', evidence.gate_code,
        'gate_title', gate.title,
        'evidence_type', evidence.evidence_type,
        'result', evidence.result,
        'environment', evidence.environment,
        'release', evidence.release,
        'summary', evidence.summary,
        'artifact_url', evidence.artifact_url,
        'metadata', evidence.metadata,
        'observed_at', evidence.observed_at,
        'created_at', evidence.created_at,
        'created_by_name', creator.display_name
      ) order by evidence.observed_at desc, evidence.created_at desc)
      from (
        select * from public.platform_launch_gate_evidence
        order by observed_at desc, created_at desc
        limit 200
      ) evidence
      join public.platform_launch_gates gate on gate.code = evidence.gate_code
      left join public.user_profiles creator on creator.id = evidence.created_by
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', session_row.id,
        'club_id', session_row.club_id,
        'club_name', club.name,
        'cycle', session_row.cycle,
        'status', session_row.status,
        'session_date', session_row.session_date,
        'operator_name', session_row.operator_name,
        'fixture_count', session_row.fixture_count,
        'auto_scheduled_count', session_row.auto_scheduled_count,
        'manual_resolved_count', session_row.manual_resolved_count,
        'unresolved_count', session_row.unresolved_count,
        'invalid_recommendation_count', session_row.invalid_recommendation_count,
        'correct_warning_count', session_row.correct_warning_count,
        'missed_warning_count', session_row.missed_warning_count,
        'override_count', session_row.override_count,
        'critical_defect_count', session_row.critical_defect_count,
        'high_defect_count', session_row.high_defect_count,
        'time_saved_minutes', session_row.time_saved_minutes,
        'outcome', session_row.outcome,
        'notes', session_row.notes,
        'signoff_name', session_row.signoff_name,
        'signed_off_at', session_row.signed_off_at,
        'created_at', session_row.created_at,
        'updated_at', session_row.updated_at
      ) order by session_row.session_date desc, session_row.created_at desc)
      from (
        select * from public.platform_pilot_sessions
        where target_club_id is null or club_id = target_club_id
        order by session_date desc, created_at desc
        limit 150
      ) session_row
      join public.clubs club on club.id = session_row.club_id
    ), '[]'::jsonb),
    'findings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', finding.id,
        'session_id', finding.session_id,
        'club_id', finding.club_id,
        'cycle', session_row.cycle,
        'finding_type', finding.finding_type,
        'severity', finding.severity,
        'status', finding.status,
        'title', finding.title,
        'description', finding.description,
        'workaround', finding.workaround,
        'reference', finding.reference,
        'created_at', finding.created_at,
        'updated_at', finding.updated_at
      ) order by finding.created_at desc)
      from (
        select * from public.platform_pilot_findings
        where target_club_id is null or club_id = target_club_id
        order by created_at desc
        limit 250
      ) finding
      join public.platform_pilot_sessions session_row on session_row.id = finding.session_id
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'evidence_total', (select count(*) from public.platform_launch_gate_evidence),
      'evidence_passed', (select count(*) from public.platform_launch_gate_evidence where result = 'pass'),
      'sessions_total', (select count(*) from public.platform_pilot_sessions where target_club_id is null or club_id = target_club_id),
      'sessions_completed', (select count(*) from public.platform_pilot_sessions where status = 'completed' and (target_club_id is null or club_id = target_club_id)),
      'open_findings', (select count(*) from public.platform_pilot_findings where status in ('open', 'in_progress') and (target_club_id is null or club_id = target_club_id)),
      'critical_findings', (select count(*) from public.platform_pilot_findings where severity = 'critical' and status in ('open', 'in_progress') and (target_club_id is null or club_id = target_club_id))
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.platform_record_launch_gate_evidence(
  target_gate_code text,
  next_evidence_type text,
  next_result text,
  next_environment text default 'staging',
  next_release text default '',
  next_summary text default '',
  next_artifact_url text default null,
  next_observed_at timestamptz default now(),
  next_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  evidence_row public.platform_launch_gate_evidence%rowtype;
begin
  perform private.require_platform_staff('admin');

  if not exists (select 1 from public.platform_launch_gates where code = target_gate_code) then
    raise exception 'Launch gate not found' using errcode = 'P0002';
  end if;
  if next_evidence_type not in ('automated_test', 'manual_test', 'deployment', 'security_review', 'backup_restore', 'document', 'decision', 'observation') then
    raise exception 'Unsupported evidence type' using errcode = '22023';
  end if;
  if next_result not in ('pass', 'fail', 'observation') then
    raise exception 'Unsupported evidence result' using errcode = '22023';
  end if;
  if next_environment not in ('local', 'development', 'staging', 'production') then
    raise exception 'Unsupported evidence environment' using errcode = '22023';
  end if;
  if length(trim(coalesce(next_summary, ''))) < 8 then
    raise exception 'Evidence summary is too short' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(next_artifact_url, '')), '') is not null and trim(next_artifact_url) !~ '^https://' then
    raise exception 'Evidence links must use HTTPS' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(next_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Evidence metadata must be an object' using errcode = '22023';
  end if;

  insert into public.platform_launch_gate_evidence (
    gate_code, evidence_type, result, environment, release, summary,
    artifact_url, metadata, observed_at, created_by
  ) values (
    target_gate_code,
    next_evidence_type,
    next_result,
    next_environment,
    nullif(left(trim(coalesce(next_release, '')), 120), ''),
    left(trim(next_summary), 4000),
    nullif(left(trim(coalesce(next_artifact_url, '')), 1000), ''),
    coalesce(next_metadata, '{}'::jsonb),
    coalesce(next_observed_at, now()),
    actor_id
  ) returning * into evidence_row;

  update public.platform_launch_gates
  set status = case
        when next_result = 'fail' then 'blocked'
        when next_result = 'pass' and status in ('not_started', 'blocked') then 'in_progress'
        else status
      end,
      evidence = case when trim(evidence) = '' then left(trim(next_summary), 4000) else evidence end,
      updated_at = now()
  where code = target_gate_code;

  perform private.write_platform_activity(
    'launch_gate_evidence_recorded', null, 'launch_gate_evidence', evidence_row.id::text,
    jsonb_build_object('gate_code', target_gate_code, 'result', next_result, 'environment', next_environment, 'release', next_release)
  );

  return to_jsonb(evidence_row);
end;
$$;

create or replace function public.platform_upsert_pilot_session(
  target_session_id uuid default null,
  target_club_id uuid default null,
  next_cycle text default 'historical_replay',
  next_status text default 'planned',
  next_session_date date default current_date,
  next_operator_name text default '',
  next_fixture_count integer default 0,
  next_auto_scheduled_count integer default 0,
  next_manual_resolved_count integer default 0,
  next_unresolved_count integer default 0,
  next_invalid_recommendation_count integer default 0,
  next_correct_warning_count integer default 0,
  next_missed_warning_count integer default 0,
  next_override_count integer default 0,
  next_critical_defect_count integer default 0,
  next_high_defect_count integer default 0,
  next_time_saved_minutes integer default 0,
  next_outcome text default 'not_run',
  next_notes text default '',
  next_signoff_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.platform_pilot_sessions%rowtype;
  numeric_values integer[];
begin
  perform private.require_platform_staff('admin');

  if target_club_id is null or not exists (select 1 from public.platform_pilot_clubs where club_id = target_club_id) then
    raise exception 'Save the club pilot record before recording pilot sessions' using errcode = '22023';
  end if;
  if next_cycle not in ('historical_replay', 'shadow_live', 'controlled_use', 'signoff') then
    raise exception 'Unsupported pilot cycle' using errcode = '22023';
  end if;
  if next_status not in ('planned', 'in_progress', 'completed', 'blocked') then
    raise exception 'Unsupported pilot-session status' using errcode = '22023';
  end if;
  if next_outcome not in ('not_run', 'pass', 'conditional', 'fail') then
    raise exception 'Unsupported pilot-session outcome' using errcode = '22023';
  end if;
  if next_status = 'completed' and next_outcome = 'not_run' then
    raise exception 'A completed session requires an outcome' using errcode = '22023';
  end if;
  if next_cycle = 'signoff' and next_outcome = 'pass' and length(trim(coalesce(next_signoff_name, ''))) < 2 then
    raise exception 'A successful sign-off session requires the sign-off name' using errcode = '22023';
  end if;

  numeric_values := array[
    next_fixture_count, next_auto_scheduled_count, next_manual_resolved_count,
    next_unresolved_count, next_invalid_recommendation_count, next_correct_warning_count,
    next_missed_warning_count, next_override_count, next_critical_defect_count,
    next_high_defect_count, next_time_saved_minutes
  ];
  if exists (select 1 from unnest(numeric_values) value where value < 0) then
    raise exception 'Pilot metrics cannot be negative' using errcode = '22023';
  end if;

  if target_session_id is null then
    insert into public.platform_pilot_sessions (
      club_id, cycle, status, session_date, operator_name, fixture_count,
      auto_scheduled_count, manual_resolved_count, unresolved_count,
      invalid_recommendation_count, correct_warning_count, missed_warning_count,
      override_count, critical_defect_count, high_defect_count, time_saved_minutes,
      outcome, notes, signoff_name, signed_off_at, created_by, updated_by
    ) values (
      target_club_id, next_cycle, next_status, next_session_date,
      left(trim(coalesce(next_operator_name, '')), 160), next_fixture_count,
      next_auto_scheduled_count, next_manual_resolved_count, next_unresolved_count,
      next_invalid_recommendation_count, next_correct_warning_count, next_missed_warning_count,
      next_override_count, next_critical_defect_count, next_high_defect_count, next_time_saved_minutes,
      next_outcome, left(coalesce(next_notes, ''), 12000),
      left(trim(coalesce(next_signoff_name, '')), 160),
      case when next_cycle = 'signoff' and next_status = 'completed' then now() else null end,
      actor_id, actor_id
    ) returning * into session_row;
  else
    update public.platform_pilot_sessions
    set cycle = next_cycle,
        status = next_status,
        session_date = next_session_date,
        operator_name = left(trim(coalesce(next_operator_name, '')), 160),
        fixture_count = next_fixture_count,
        auto_scheduled_count = next_auto_scheduled_count,
        manual_resolved_count = next_manual_resolved_count,
        unresolved_count = next_unresolved_count,
        invalid_recommendation_count = next_invalid_recommendation_count,
        correct_warning_count = next_correct_warning_count,
        missed_warning_count = next_missed_warning_count,
        override_count = next_override_count,
        critical_defect_count = next_critical_defect_count,
        high_defect_count = next_high_defect_count,
        time_saved_minutes = next_time_saved_minutes,
        outcome = next_outcome,
        notes = left(coalesce(next_notes, ''), 12000),
        signoff_name = left(trim(coalesce(next_signoff_name, '')), 160),
        signed_off_at = case when next_cycle = 'signoff' and next_status = 'completed' then coalesce(signed_off_at, now()) else null end,
        updated_by = actor_id,
        updated_at = now()
    where id = target_session_id and club_id = target_club_id
    returning * into session_row;
  end if;

  if session_row.id is null then
    raise exception 'Pilot session not found' using errcode = 'P0002';
  end if;

  update public.platform_pilot_clubs
  set health = case
        when session_row.outcome = 'fail' or session_row.critical_defect_count > 0 or session_row.status = 'blocked' then 'blocked'
        when session_row.outcome = 'conditional' or session_row.high_defect_count > 0 then 'attention'
        else health
      end,
      updated_by = actor_id,
      updated_at = now()
  where club_id = target_club_id;

  perform private.write_platform_activity(
    'pilot_session_saved', target_club_id, 'pilot_session', session_row.id::text,
    jsonb_build_object('cycle', session_row.cycle, 'status', session_row.status, 'outcome', session_row.outcome)
  );

  return to_jsonb(session_row);
end;
$$;

create or replace function public.platform_upsert_pilot_finding(
  target_finding_id uuid default null,
  target_session_id uuid default null,
  next_finding_type text default 'defect',
  next_severity text default 'medium',
  next_status text default 'open',
  next_title text default '',
  next_description text default '',
  next_workaround text default '',
  next_reference text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_club_id uuid;
  finding_row public.platform_pilot_findings%rowtype;
begin
  perform private.require_platform_staff('admin');

  select club_id into target_club_id
  from public.platform_pilot_sessions
  where id = target_session_id;

  if target_club_id is null then
    raise exception 'Pilot session not found' using errcode = 'P0002';
  end if;
  if next_finding_type not in ('defect', 'usability', 'data', 'training', 'feature_request') then
    raise exception 'Unsupported finding type' using errcode = '22023';
  end if;
  if next_severity not in ('critical', 'high', 'medium', 'low') then
    raise exception 'Unsupported finding severity' using errcode = '22023';
  end if;
  if next_status not in ('open', 'in_progress', 'resolved', 'deferred') then
    raise exception 'Unsupported finding status' using errcode = '22023';
  end if;
  if length(trim(coalesce(next_title, ''))) < 4 or length(trim(coalesce(next_description, ''))) < 8 then
    raise exception 'Finding title and description need more detail' using errcode = '22023';
  end if;

  if target_finding_id is null then
    insert into public.platform_pilot_findings (
      session_id, club_id, finding_type, severity, status, title, description,
      workaround, reference, created_by, updated_by
    ) values (
      target_session_id, target_club_id, next_finding_type, next_severity, next_status,
      left(trim(next_title), 180), left(trim(next_description), 8000),
      left(coalesce(next_workaround, ''), 4000), left(coalesce(next_reference, ''), 120),
      actor_id, actor_id
    ) returning * into finding_row;
  else
    update public.platform_pilot_findings
    set finding_type = next_finding_type,
        severity = next_severity,
        status = next_status,
        title = left(trim(next_title), 180),
        description = left(trim(next_description), 8000),
        workaround = left(coalesce(next_workaround, ''), 4000),
        reference = left(coalesce(next_reference, ''), 120),
        updated_by = actor_id,
        updated_at = now()
    where id = target_finding_id and session_id = target_session_id
    returning * into finding_row;
  end if;

  if finding_row.id is null then
    raise exception 'Pilot finding not found' using errcode = 'P0002';
  end if;

  if finding_row.status in ('open', 'in_progress') then
    update public.platform_pilot_clubs
    set health = case
          when finding_row.severity = 'critical' then 'blocked'
          when finding_row.severity = 'high' and health <> 'blocked' then 'attention'
          else health
        end,
        updated_by = actor_id,
        updated_at = now()
    where club_id = target_club_id;
  end if;

  perform private.write_platform_activity(
    'pilot_finding_saved', target_club_id, 'pilot_finding', finding_row.id::text,
    jsonb_build_object('severity', finding_row.severity, 'status', finding_row.status, 'type', finding_row.finding_type)
  );

  return to_jsonb(finding_row);
end;
$$;

create or replace function public.platform_update_launch_gate(
  gate_code text,
  next_status text,
  next_evidence text default '',
  next_owner_label text default '',
  next_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  updated_gate public.platform_launch_gates%rowtype;
  latest_definitive_result text;
  requested_gate_code text := gate_code;
begin
  perform private.require_platform_staff('admin');
  if next_status not in ('not_started', 'in_progress', 'blocked', 'ready', 'not_applicable') then
    raise exception 'Unsupported launch-gate status' using errcode = '22023';
  end if;

  if next_status = 'ready' then
    select result into latest_definitive_result
    from public.platform_launch_gate_evidence
    where gate_code = requested_gate_code
      and result in ('pass', 'fail')
    order by observed_at desc, created_at desc
    limit 1;

    if latest_definitive_result is distinct from 'pass' then
      raise exception 'Record current passing evidence before marking this gate Ready' using errcode = '22023';
    end if;
  end if;

  update public.platform_launch_gates
  set status = next_status,
      evidence = left(coalesce(next_evidence, ''), 4000),
      owner_label = left(coalesce(next_owner_label, ''), 120),
      due_date = next_due_date,
      last_verified_at = case when next_status = 'ready' then now() else last_verified_at end,
      last_verified_by = case when next_status = 'ready' then actor_id else last_verified_by end,
      updated_at = now()
  where code = requested_gate_code
  returning * into updated_gate;

  if updated_gate.code is null then
    raise exception 'Launch gate not found' using errcode = 'P0002';
  end if;

  perform private.write_platform_activity(
    'launch_gate_updated', null, 'launch_gate', updated_gate.code,
    jsonb_build_object('status', updated_gate.status, 'due_date', updated_gate.due_date)
  );

  return to_jsonb(updated_gate);
end;
$$;

revoke all on function public.platform_get_pilot_evidence(uuid) from public, anon, authenticated;
revoke all on function public.platform_record_launch_gate_evidence(text, text, text, text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.platform_upsert_pilot_session(uuid, uuid, text, text, date, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.platform_upsert_pilot_finding(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

 grant execute on function public.platform_get_pilot_evidence(uuid) to authenticated;
 grant execute on function public.platform_record_launch_gate_evidence(text, text, text, text, text, text, text, timestamptz, jsonb) to authenticated;
 grant execute on function public.platform_upsert_pilot_session(uuid, uuid, text, text, date, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, text, text, text) to authenticated;
 grant execute on function public.platform_upsert_pilot_finding(uuid, uuid, text, text, text, text, text, text, text) to authenticated;

commit;
