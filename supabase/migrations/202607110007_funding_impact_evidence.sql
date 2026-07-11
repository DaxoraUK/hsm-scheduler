-- Daxora Ground Control: manually evidenced funding impact records.
-- Keeps completed activity, attendance and participation separate from scheduled fixtures.

begin;

create table if not exists public.funding_impact_records (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  project_id uuid not null references public.funding_projects(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'verified')),
  evidence_method text not null default 'manual_count'
    check (evidence_method in ('manual_count', 'attendance_system', 'membership_register', 'survey', 'combined')),
  source_label text not null default '',
  completed_sessions integer not null default 0 check (completed_sessions >= 0),
  attendance_visits integer not null default 0 check (attendance_visits >= 0),
  unique_participants integer not null default 0 check (unique_participants >= 0),
  youth_participants integer not null default 0 check (youth_participants >= 0),
  women_girls_participants integer not null default 0 check (women_girls_participants >= 0),
  disability_participants integer not null default 0 check (disability_participants >= 0),
  community_sessions integer not null default 0 check (community_sessions >= 0),
  cancelled_sessions integer not null default 0 check (cancelled_sessions >= 0),
  volunteer_count integer not null default 0 check (volunteer_count >= 0),
  volunteer_hours numeric(12,2) not null default 0 check (volunteer_hours >= 0),
  outcome_summary text not null default '',
  notes text not null default '',
  verified_by_label text not null default '',
  verified_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_impact_period_order check (period_end >= period_start),
  constraint funding_impact_participant_boundary check (attendance_visits = 0 or unique_participants <= attendance_visits),
  constraint funding_impact_youth_boundary check (youth_participants <= unique_participants),
  constraint funding_impact_women_girls_boundary check (women_girls_participants <= unique_participants),
  constraint funding_impact_disability_boundary check (disability_participants <= unique_participants),
  constraint funding_impact_verified_source check (status <> 'verified' or length(trim(source_label)) > 0),
  constraint funding_impact_verified_actor check (status <> 'verified' or length(trim(verified_by_label)) > 0)
);

create index if not exists funding_impact_club_project_period_idx
  on public.funding_impact_records(club_id, project_id, period_end desc, updated_at desc);

create or replace function public.guard_funding_impact_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.funding_projects project
    where project.id = new.project_id
      and project.club_id = new.club_id
  ) then
    raise exception 'Funding project does not belong to the selected club' using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' then
    new.club_id := old.club_id;
    new.project_id := old.project_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := auth.uid();
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();

  if new.status = 'verified' then
    if tg_op = 'INSERT' or old.status <> 'verified' or new.verified_at is null then
      new.verified_at := now();
    end if;
  else
    new.verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists funding_impact_guard_write on public.funding_impact_records;
create trigger funding_impact_guard_write
before insert or update on public.funding_impact_records
for each row execute function public.guard_funding_impact_write();

alter table public.funding_impact_records enable row level security;
alter table public.funding_impact_records force row level security;

revoke all on table public.funding_impact_records from public, anon, authenticated;

drop policy if exists funding_impact_read on public.funding_impact_records;
create policy funding_impact_read on public.funding_impact_records
for select to authenticated using (public.can_read_club(club_id));

drop policy if exists funding_impact_insert on public.funding_impact_records;
create policy funding_impact_insert on public.funding_impact_records
for insert to authenticated with check (public.can_manage_club(club_id));

drop policy if exists funding_impact_update on public.funding_impact_records;
create policy funding_impact_update on public.funding_impact_records
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

drop policy if exists funding_impact_delete on public.funding_impact_records;
create policy funding_impact_delete on public.funding_impact_records
for delete to authenticated using (public.can_manage_club(club_id));

grant select, insert, update, delete on public.funding_impact_records to authenticated;

-- Reuse the existing funding-workspace audit writer so every material change is attributable.
drop trigger if exists funding_impact_records_audit_change on public.funding_impact_records;
create trigger funding_impact_records_audit_change
after insert or update or delete on public.funding_impact_records
for each row execute function private.audit_funding_workspace_change();

commit;
