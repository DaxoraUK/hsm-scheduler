-- Daxora Ground Control: funding application tracker, tasks and post-award monitoring.
-- Apply after 202607050009_funding_local_discovery.sql.

begin;

create table if not exists public.funding_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  project_id uuid not null references public.funding_projects(id) on delete cascade,
  programme_id text,
  status text not null default 'considering'
    check (status in (
      'considering', 'checking_eligibility', 'preparing', 'awaiting_quotes',
      'ready_to_apply', 'submitted', 'further_information', 'awarded',
      'unsuccessful', 'withdrawn', 'closed'
    )),
  owner_name text not null default '',
  owner_email text not null default '',
  deadline date,
  requested_amount numeric(12,2) not null default 0 check (requested_amount >= 0),
  awarded_amount numeric(12,2) not null default 0 check (awarded_amount >= 0),
  application_reference text not null default '',
  submitted_at timestamptz,
  expected_decision_date date,
  decision_date date,
  decision_notes text not null default '',
  funding_conditions text not null default '',
  next_action text not null default '',
  notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_applications_club_project_idx
  on public.funding_applications(club_id, project_id, status, deadline, updated_at desc);

create table if not exists public.funding_application_tasks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  application_id uuid not null references public.funding_applications(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 220),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  owner_name text not null default '',
  due_date date,
  notes text not null default '',
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_application_tasks_club_application_idx
  on public.funding_application_tasks(club_id, application_id, status, due_date, priority);

create table if not exists public.funding_monitoring_obligations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  application_id uuid not null references public.funding_applications(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 220),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted', 'accepted', 'overdue', 'not_required')),
  due_date date,
  reporting_period_start date,
  reporting_period_end date,
  evidence_required text not null default '',
  owner_name text not null default '',
  notes text not null default '',
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_monitoring_club_application_idx
  on public.funding_monitoring_obligations(club_id, application_id, status, due_date);

create or replace function public.guard_funding_application_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.funding_projects project
    where project.id = new.project_id and project.club_id = new.club_id
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
  return new;
end;
$$;

drop trigger if exists funding_applications_guard_write on public.funding_applications;
create trigger funding_applications_guard_write
before insert or update on public.funding_applications
for each row execute function public.guard_funding_application_write();

create or replace function public.guard_funding_application_child_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.funding_applications application
    where application.id = new.application_id and application.club_id = new.club_id
  ) then
    raise exception 'Funding application does not belong to the selected club' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' then
    new.club_id := old.club_id;
    new.application_id := old.application_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := auth.uid();
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists funding_application_tasks_guard_write on public.funding_application_tasks;
create trigger funding_application_tasks_guard_write
before insert or update on public.funding_application_tasks
for each row execute function public.guard_funding_application_child_write();

drop trigger if exists funding_monitoring_guard_write on public.funding_monitoring_obligations;
create trigger funding_monitoring_guard_write
before insert or update on public.funding_monitoring_obligations
for each row execute function public.guard_funding_application_child_write();

alter table public.funding_applications enable row level security;
alter table public.funding_applications force row level security;
alter table public.funding_application_tasks enable row level security;
alter table public.funding_application_tasks force row level security;
alter table public.funding_monitoring_obligations enable row level security;
alter table public.funding_monitoring_obligations force row level security;

revoke all on table public.funding_applications from public, anon, authenticated;
revoke all on table public.funding_application_tasks from public, anon, authenticated;
revoke all on table public.funding_monitoring_obligations from public, anon, authenticated;

create policy funding_applications_read on public.funding_applications
for select to authenticated using (public.can_read_club(club_id));
create policy funding_applications_insert on public.funding_applications
for insert to authenticated with check (public.can_manage_club(club_id));
create policy funding_applications_update on public.funding_applications
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy funding_applications_delete on public.funding_applications
for delete to authenticated using (public.can_manage_club(club_id));

create policy funding_application_tasks_read on public.funding_application_tasks
for select to authenticated using (public.can_read_club(club_id));
create policy funding_application_tasks_insert on public.funding_application_tasks
for insert to authenticated with check (public.can_manage_club(club_id));
create policy funding_application_tasks_update on public.funding_application_tasks
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy funding_application_tasks_delete on public.funding_application_tasks
for delete to authenticated using (public.can_manage_club(club_id));

create policy funding_monitoring_read on public.funding_monitoring_obligations
for select to authenticated using (public.can_read_club(club_id));
create policy funding_monitoring_insert on public.funding_monitoring_obligations
for insert to authenticated with check (public.can_manage_club(club_id));
create policy funding_monitoring_update on public.funding_monitoring_obligations
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));
create policy funding_monitoring_delete on public.funding_monitoring_obligations
for delete to authenticated using (public.can_manage_club(club_id));

grant select, insert, update, delete on public.funding_applications to authenticated;
grant select, insert, update, delete on public.funding_application_tasks to authenticated;
grant select, insert, update, delete on public.funding_monitoring_obligations to authenticated;

commit;
