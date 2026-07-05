-- Daxora Ground Control: club funding workspace, requirement tracking,
-- private supporting documents and immutable evidence snapshots.
-- Apply after 202607030007_pilot_launch_readiness.sql.

begin;

create table if not exists public.funding_projects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 180),
  project_type text not null default 'all',
  selected_programme_id text,
  status text not null default 'planning'
    check (status in ('planning', 'preparing', 'ready_to_apply', 'submitted', 'awarded', 'unsuccessful', 'closed')),
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funding_projects_club_updated_idx
  on public.funding_projects(club_id, updated_at desc);

create table if not exists public.funding_requirement_records (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  project_id uuid not null references public.funding_projects(id) on delete cascade,
  requirement_key text not null check (length(trim(requirement_key)) between 3 and 220),
  status text not null default 'missing'
    check (status in ('missing', 'in_progress', 'ready', 'not_applicable')),
  notes text not null default '',
  due_date date,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, requirement_key)
);
create index if not exists funding_requirements_club_project_idx
  on public.funding_requirement_records(club_id, project_id, status, updated_at desc);

create table if not exists public.funding_documents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  project_id uuid not null references public.funding_projects(id) on delete cascade,
  requirement_key text not null check (length(trim(requirement_key)) between 3 and 220),
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  document_type text not null default 'Supporting evidence',
  review_date date,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists funding_documents_club_project_idx
  on public.funding_documents(club_id, project_id, requirement_key, created_at desc);

create table if not exists public.funding_evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  project_id uuid not null references public.funding_projects(id) on delete cascade,
  programme_id text,
  label text not null check (length(trim(label)) between 2 and 180),
  snapshot jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists funding_snapshots_club_project_idx
  on public.funding_evidence_snapshots(club_id, project_id, created_at desc);

-- Protect tenant identity and author fields from forged browser values.
create or replace function public.guard_funding_project_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.club_id := old.club_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists funding_projects_guard_write on public.funding_projects;
create trigger funding_projects_guard_write
before insert or update on public.funding_projects
for each row execute function public.guard_funding_project_write();

create or replace function public.guard_funding_requirement_write()
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
    new.requirement_key := old.requirement_key;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists funding_requirements_guard_write on public.funding_requirement_records;
create trigger funding_requirements_guard_write
before insert or update on public.funding_requirement_records
for each row execute function public.guard_funding_requirement_write();

create or replace function public.guard_funding_document_write()
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
  if split_part(new.storage_path, '/', 1) <> new.club_id::text then
    raise exception 'Funding document storage path must begin with the selected club id' using errcode = '23514';
  end if;
  new.uploaded_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists funding_documents_guard_write on public.funding_documents;
create trigger funding_documents_guard_write
before insert on public.funding_documents
for each row execute function public.guard_funding_document_write();

create or replace function public.guard_funding_snapshot_write()
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
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists funding_snapshots_guard_write on public.funding_evidence_snapshots;
create trigger funding_snapshots_guard_write
before insert on public.funding_evidence_snapshots
for each row execute function public.guard_funding_snapshot_write();

alter table public.funding_projects enable row level security;
alter table public.funding_projects force row level security;
alter table public.funding_requirement_records enable row level security;
alter table public.funding_requirement_records force row level security;
alter table public.funding_documents enable row level security;
alter table public.funding_documents force row level security;
alter table public.funding_evidence_snapshots enable row level security;
alter table public.funding_evidence_snapshots force row level security;

revoke all on table public.funding_projects from public, anon, authenticated;
revoke all on table public.funding_requirement_records from public, anon, authenticated;
revoke all on table public.funding_documents from public, anon, authenticated;
revoke all on table public.funding_evidence_snapshots from public, anon, authenticated;

-- Read access includes explicitly granted, time-limited support sessions.
drop policy if exists funding_projects_read on public.funding_projects;
create policy funding_projects_read on public.funding_projects
for select to authenticated using (public.can_read_club(club_id));

drop policy if exists funding_requirements_read on public.funding_requirement_records;
create policy funding_requirements_read on public.funding_requirement_records
for select to authenticated using (public.can_read_club(club_id));

drop policy if exists funding_documents_read on public.funding_documents;
create policy funding_documents_read on public.funding_documents
for select to authenticated using (public.can_read_club(club_id));

drop policy if exists funding_snapshots_read on public.funding_evidence_snapshots;
create policy funding_snapshots_read on public.funding_evidence_snapshots
for select to authenticated using (public.can_read_club(club_id));

-- Only club owners and administrators manage applications and supporting files.
drop policy if exists funding_projects_insert on public.funding_projects;
create policy funding_projects_insert on public.funding_projects
for insert to authenticated with check (public.can_manage_club(club_id));

drop policy if exists funding_projects_update on public.funding_projects;
create policy funding_projects_update on public.funding_projects
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

drop policy if exists funding_projects_delete on public.funding_projects;
create policy funding_projects_delete on public.funding_projects
for delete to authenticated using (public.can_manage_club(club_id));

drop policy if exists funding_requirements_insert on public.funding_requirement_records;
create policy funding_requirements_insert on public.funding_requirement_records
for insert to authenticated with check (public.can_manage_club(club_id));

drop policy if exists funding_requirements_update on public.funding_requirement_records;
create policy funding_requirements_update on public.funding_requirement_records
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

drop policy if exists funding_requirements_delete on public.funding_requirement_records;
create policy funding_requirements_delete on public.funding_requirement_records
for delete to authenticated using (public.can_manage_club(club_id));

drop policy if exists funding_documents_insert on public.funding_documents;
create policy funding_documents_insert on public.funding_documents
for insert to authenticated with check (public.can_manage_club(club_id));

drop policy if exists funding_documents_delete on public.funding_documents;
create policy funding_documents_delete on public.funding_documents
for delete to authenticated using (public.can_manage_club(club_id));

drop policy if exists funding_snapshots_insert on public.funding_evidence_snapshots;
create policy funding_snapshots_insert on public.funding_evidence_snapshots
for insert to authenticated with check (public.can_manage_club(club_id));

-- Snapshots are intentionally immutable. A new snapshot supersedes an old one.
revoke update, delete on public.funding_evidence_snapshots from authenticated;

grant select, insert, update, delete on public.funding_projects to authenticated;
grant select, insert, update, delete on public.funding_requirement_records to authenticated;
grant select, insert, delete on public.funding_documents to authenticated;
grant select, insert on public.funding_evidence_snapshots to authenticated;

-- Resolve the club id from the first private-storage path segment without raising
-- an exception for malformed object names.
create or replace function public.funding_storage_club_id(object_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  first_segment text;
begin
  first_segment := split_part(coalesce(object_name, ''), '/', 1);
  if first_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return first_segment::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.funding_storage_club_id(text) from public, anon;
grant execute on function public.funding_storage_club_id(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'funding-documents',
  'funding-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists funding_storage_read on storage.objects;
create policy funding_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'funding-documents'
  and public.can_read_club(public.funding_storage_club_id(name))
);

drop policy if exists funding_storage_insert on storage.objects;
create policy funding_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'funding-documents'
  and public.can_manage_club(public.funding_storage_club_id(name))
);

drop policy if exists funding_storage_delete on storage.objects;
create policy funding_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'funding-documents'
  and public.can_manage_club(public.funding_storage_club_id(name))
);

-- Server-authored audit events for material funding-workspace changes.
create or replace function private.audit_funding_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  row_data jsonb;
  target_club uuid;
  target_id text;
  action_name text;
  detail jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_club := nullif(row_data ->> 'club_id', '')::uuid;
  target_id := row_data ->> 'id';
  action_name := lower(tg_table_name || '.' || tg_op);
  detail := jsonb_strip_nulls(jsonb_build_object(
    'project_id', coalesce(row_data ->> 'project_id', row_data ->> 'id'),
    'requirement_key', row_data ->> 'requirement_key',
    'file_name', row_data ->> 'file_name',
    'programme_id', row_data ->> 'programme_id'
  ));
  perform private.write_audit_event(
    target_club,
    auth.uid(),
    action_name,
    tg_table_name,
    target_id,
    detail,
    'database',
    public.get_active_support_session(target_club)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'funding_projects',
    'funding_requirement_records',
    'funding_documents',
    'funding_evidence_snapshots'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_audit_change', table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_funding_workspace_change()',
      table_name || '_audit_change',
      table_name
    );
  end loop;
end $$;

commit;
