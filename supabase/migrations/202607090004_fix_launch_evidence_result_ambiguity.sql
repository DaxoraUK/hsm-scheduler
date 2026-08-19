begin;

create or replace function public.platform_get_pilot_evidence(target_club_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  response_payload jsonb;
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
        select *
        from public.platform_launch_gate_evidence
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
        select *
        from public.platform_pilot_sessions
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
        select *
        from public.platform_pilot_findings
        where target_club_id is null or club_id = target_club_id
        order by created_at desc
        limit 250
      ) finding
      join public.platform_pilot_sessions session_row on session_row.id = finding.session_id
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'evidence_total', (
        select count(*)
        from public.platform_launch_gate_evidence evidence_count
      ),
      'evidence_passed', (
        select count(*)
        from public.platform_launch_gate_evidence evidence_count
        where evidence_count.result = 'pass'
      ),
      'sessions_total', (
        select count(*)
        from public.platform_pilot_sessions session_count
        where target_club_id is null or session_count.club_id = target_club_id
      ),
      'sessions_completed', (
        select count(*)
        from public.platform_pilot_sessions session_count
        where session_count.status = 'completed'
          and (target_club_id is null or session_count.club_id = target_club_id)
      ),
      'open_findings', (
        select count(*)
        from public.platform_pilot_findings finding_count
        where finding_count.status in ('open', 'in_progress')
          and (target_club_id is null or finding_count.club_id = target_club_id)
      ),
      'critical_findings', (
        select count(*)
        from public.platform_pilot_findings finding_count
        where finding_count.severity = 'critical'
          and finding_count.status in ('open', 'in_progress')
          and (target_club_id is null or finding_count.club_id = target_club_id)
      )
    )
  ) into response_payload;

  return response_payload;
end;
$$;

revoke all on function public.platform_get_pilot_evidence(uuid) from public, anon, authenticated;
grant execute on function public.platform_get_pilot_evidence(uuid) to authenticated;

commit;
