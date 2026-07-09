-- Fix PL/pgSQL ambiguity between the platform_update_launch_gate gate_code
-- argument and platform_launch_gate_evidence.gate_code column.

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
  requested_gate_code text := nullif(btrim($1), '');
begin
  perform private.require_platform_staff('admin');

  if requested_gate_code is null then
    raise exception 'Launch gate code is required' using errcode = '22023';
  end if;

  if next_status not in (
    'not_started',
    'in_progress',
    'blocked',
    'ready',
    'not_applicable'
  ) then
    raise exception 'Unsupported launch-gate status' using errcode = '22023';
  end if;

  if next_status = 'ready' then
    select evidence_row.result
      into latest_definitive_result
    from public.platform_launch_gate_evidence as evidence_row
    where evidence_row.gate_code = requested_gate_code
      and evidence_row.result in ('pass', 'fail')
    order by evidence_row.observed_at desc, evidence_row.created_at desc
    limit 1;

    if latest_definitive_result is distinct from 'pass' then
      raise exception 'Record current passing evidence before marking this gate Ready'
        using errcode = '22023';
    end if;
  end if;

  update public.platform_launch_gates as launch_gate
  set status = next_status,
      evidence = left(coalesce(next_evidence, ''), 4000),
      owner_label = left(coalesce(next_owner_label, ''), 120),
      due_date = next_due_date,
      last_verified_at = case
        when next_status = 'ready' then now()
        else launch_gate.last_verified_at
      end,
      last_verified_by = case
        when next_status = 'ready' then actor_id
        else launch_gate.last_verified_by
      end,
      updated_at = now()
  where launch_gate.code = requested_gate_code
  returning launch_gate.* into updated_gate;

  if updated_gate.code is null then
    raise exception 'Launch gate not found' using errcode = 'P0002';
  end if;

  perform private.write_platform_activity(
    'launch_gate_updated',
    null,
    'launch_gate',
    updated_gate.code,
    jsonb_build_object(
      'status', updated_gate.status,
      'due_date', updated_gate.due_date
    )
  );

  return to_jsonb(updated_gate);
end;
$$;
