begin;

create table if not exists public.league_report_definitions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null,
  report_type text not null default 'executive' check (report_type in ('executive','competitions','clubs','officials','governance','funding_evidence')),
  cadence text not null default 'manual' check (cadence in ('manual','weekly','monthly','quarterly','annual')),
  delivery_format text not null default 'html' check (delivery_format in ('html','csv')),
  recipients text[] not null default '{}'::text[],
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  next_run_on date,
  last_run_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete set null,
  definition_id uuid references public.league_report_definitions(id) on delete set null,
  report_type text not null default 'executive' check (report_type in ('executive','competitions','clubs','officials','governance','funding_evidence')),
  generated_from text not null default 'manual' check (generated_from in ('manual','scheduled_run','release_evidence','api')),
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists league_report_definitions_league_due_idx
  on public.league_report_definitions(league_id, active, next_run_on);
create index if not exists league_report_snapshots_league_created_idx
  on public.league_report_snapshots(league_id, created_at desc);
create index if not exists league_report_snapshots_season_idx
  on public.league_report_snapshots(league_id, season_id, report_type, created_at desc);

alter table public.league_report_definitions enable row level security;
alter table public.league_report_snapshots enable row level security;

revoke all on public.league_report_definitions from public, anon;
revoke all on public.league_report_snapshots from public, anon;
grant select on public.league_report_definitions to authenticated;
grant select on public.league_report_snapshots to authenticated;

drop policy if exists league_report_definitions_read on public.league_report_definitions;
create policy league_report_definitions_read on public.league_report_definitions
for select to authenticated
using (public.can_manage_league(league_id));

drop policy if exists league_report_snapshots_read on public.league_report_snapshots;
create policy league_report_snapshots_read on public.league_report_snapshots
for select to authenticated
using (public.can_view_league(league_id));

create or replace function public.get_league_report_configuration(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  can_manage boolean;
begin
  if actor_id is null or not public.can_view_league(target_league_id) then
    raise exception 'League reporting access required' using errcode = '42501';
  end if;

  actor_role := private.current_league_role(target_league_id, actor_id);
  can_manage := public.can_manage_league(target_league_id);

  return jsonb_build_object(
    'access', jsonb_build_object(
      'role', actor_role,
      'can_manage', can_manage
    ),
    'definitions', case when can_manage then coalesce((
      select jsonb_agg(to_jsonb(definition_value) order by definition_value.active desc, definition_value.next_run_on nulls last, definition_value.name)
      from public.league_report_definitions definition_value
      where definition_value.league_id = target_league_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'snapshots', coalesce((
      select jsonb_agg(to_jsonb(snapshot_value) order by snapshot_value.created_at desc)
      from (
        select snapshot_row.*
        from public.league_report_snapshots snapshot_row
        where snapshot_row.league_id = target_league_id
        order by snapshot_row.created_at desc
        limit 48
      ) snapshot_value
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.upsert_league_report_definition(
  target_league_id uuid,
  definition_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_id uuid := nullif(definition_data->>'id', '')::uuid;
  safe_name text := trim(coalesce(definition_data->>'name', ''));
  safe_report_type text := lower(trim(coalesce(definition_data->>'report_type', 'executive')));
  safe_cadence text := lower(trim(coalesce(definition_data->>'cadence', 'manual')));
  safe_delivery_format text := lower(trim(coalesce(definition_data->>'delivery_format', 'html')));
  safe_recipients text[] := '{}'::text[];
  safe_filters jsonb := coalesce(definition_data->'filters', '{}'::jsonb);
  safe_next_run_on date := nullif(definition_data->>'next_run_on', '')::date;
  safe_active boolean := coalesce((definition_data->>'active')::boolean, true);
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if safe_name = '' then raise exception 'A report name is required' using errcode = '22023'; end if;
  if safe_report_type not in ('executive','competitions','clubs','officials','governance','funding_evidence') then raise exception 'Invalid report type' using errcode = '22023'; end if;
  if safe_cadence not in ('manual','weekly','monthly','quarterly','annual') then raise exception 'Invalid report cadence' using errcode = '22023'; end if;
  if safe_delivery_format not in ('html','csv') then raise exception 'Invalid report format' using errcode = '22023'; end if;
  if jsonb_typeof(safe_filters) <> 'object' then raise exception 'Report filters must be an object' using errcode = '22023'; end if;

  select coalesce(array_agg(lower(trim(recipient_rows.recipient))) filter (where trim(recipient_rows.recipient) <> ''), '{}'::text[])
  into safe_recipients
  from jsonb_array_elements_text(coalesce(definition_data->'recipients', '[]'::jsonb)) as recipient_rows(recipient);

  if exists (select 1 from unnest(safe_recipients) as recipient_rows(recipient) where position('@' in recipient_rows.recipient) <= 1) then
    raise exception 'Every report recipient must be a valid email address' using errcode = '22023';
  end if;

  if target_id is null then
    insert into public.league_report_definitions(
      league_id, name, report_type, cadence, delivery_format, recipients, filters, next_run_on, active, created_by
    ) values (
      target_league_id, safe_name, safe_report_type, safe_cadence, safe_delivery_format, safe_recipients, safe_filters, safe_next_run_on, safe_active, actor_id
    ) returning id into target_id;
  else
    update public.league_report_definitions definition_value
    set name = safe_name,
        report_type = safe_report_type,
        cadence = safe_cadence,
        delivery_format = safe_delivery_format,
        recipients = safe_recipients,
        filters = safe_filters,
        next_run_on = safe_next_run_on,
        active = safe_active,
        updated_at = now()
    where definition_value.id = target_id
      and definition_value.league_id = target_league_id;
    if not found then raise exception 'Report definition not found' using errcode = 'P0002'; end if;
  end if;

  perform private.write_league_audit(
    target_league_id,
    'league.report_definition_saved',
    'report_definition',
    target_id,
    jsonb_build_object('name', safe_name, 'report_type', safe_report_type, 'cadence', safe_cadence)
  );
  return target_id;
end;
$$;

create or replace function public.delete_league_report_definition(
  target_league_id uuid,
  target_definition_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  delete from public.league_report_definitions definition_value
  where definition_value.id = target_definition_id
    and definition_value.league_id = target_league_id;
  if not found then raise exception 'Report definition not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.report_definition_deleted', 'report_definition', target_definition_id, '{}'::jsonb);
end;
$$;

create or replace function public.capture_league_report_snapshot(
  target_league_id uuid,
  snapshot_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  target_snapshot_id uuid;
  safe_season_id uuid := nullif(snapshot_data->>'season_id', '')::uuid;
  safe_definition_id uuid := nullif(snapshot_data->>'definition_id', '')::uuid;
  safe_report_type text := lower(trim(coalesce(snapshot_data->>'report_type', 'executive')));
  safe_generated_from text := lower(trim(coalesce(snapshot_data->>'generated_from', 'manual')));
  safe_snapshot jsonb := coalesce(snapshot_data->'snapshot', '{}'::jsonb);
  definition_cadence text;
begin
  if actor_id is null or not public.can_manage_league(target_league_id) then
    raise exception 'League administrator access required' using errcode = '42501';
  end if;
  if safe_report_type not in ('executive','competitions','clubs','officials','governance','funding_evidence') then raise exception 'Invalid report type' using errcode = '22023'; end if;
  if safe_generated_from not in ('manual','scheduled_run','release_evidence','api') then raise exception 'Invalid report source' using errcode = '22023'; end if;
  if jsonb_typeof(safe_snapshot) <> 'object' then raise exception 'Report snapshot must be an object' using errcode = '22023'; end if;
  if octet_length(safe_snapshot::text) > 750000 then raise exception 'Report snapshot is too large' using errcode = '22023'; end if;
  if safe_season_id is not null and not exists (select 1 from public.league_seasons season_value where season_value.id = safe_season_id and season_value.league_id = target_league_id) then
    raise exception 'Season does not belong to this league' using errcode = '22023';
  end if;
  if safe_definition_id is not null then
    select definition_value.cadence into definition_cadence
    from public.league_report_definitions definition_value
    where definition_value.id = safe_definition_id
      and definition_value.league_id = target_league_id;
    if definition_cadence is null then raise exception 'Report definition not found' using errcode = 'P0002'; end if;
  end if;

  insert into public.league_report_snapshots(
    league_id, season_id, definition_id, report_type, generated_from, snapshot, created_by
  ) values (
    target_league_id, safe_season_id, safe_definition_id, safe_report_type, safe_generated_from, safe_snapshot, actor_id
  ) returning id into target_snapshot_id;

  if safe_definition_id is not null then
    update public.league_report_definitions definition_value
    set last_run_at = now(),
        next_run_on = case definition_value.cadence
          when 'weekly' then current_date + 7
          when 'monthly' then (current_date + interval '1 month')::date
          when 'quarterly' then (current_date + interval '3 months')::date
          when 'annual' then (current_date + interval '1 year')::date
          else null
        end,
        updated_at = now()
    where definition_value.id = safe_definition_id
      and definition_value.league_id = target_league_id;
  end if;

  perform private.write_league_audit(
    target_league_id,
    'league.report_snapshot_captured',
    'report_snapshot',
    target_snapshot_id,
    jsonb_build_object('report_type', safe_report_type, 'generated_from', safe_generated_from, 'definition_id', safe_definition_id)
  );
  return target_snapshot_id;
end;
$$;

revoke all on function public.get_league_report_configuration(uuid) from public, anon;
revoke all on function public.upsert_league_report_definition(uuid, jsonb) from public, anon;
revoke all on function public.delete_league_report_definition(uuid, uuid) from public, anon;
revoke all on function public.capture_league_report_snapshot(uuid, jsonb) from public, anon;

grant execute on function public.get_league_report_configuration(uuid) to authenticated;
grant execute on function public.upsert_league_report_definition(uuid, jsonb) to authenticated;
grant execute on function public.delete_league_report_definition(uuid, uuid) to authenticated;
grant execute on function public.capture_league_report_snapshot(uuid, jsonb) to authenticated;

commit;
