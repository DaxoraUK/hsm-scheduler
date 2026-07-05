-- Daxora Ground Control: club funding profile and postcode/local discovery context.
-- Apply after 202607050008_funding_workspace.sql.

begin;

create table if not exists public.funding_profiles (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.guard_funding_profile_write()
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
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists funding_profiles_guard_write on public.funding_profiles;
create trigger funding_profiles_guard_write
before insert or update on public.funding_profiles
for each row execute function public.guard_funding_profile_write();

alter table public.funding_profiles enable row level security;
alter table public.funding_profiles force row level security;

revoke all on table public.funding_profiles from public, anon, authenticated;

drop policy if exists funding_profiles_read on public.funding_profiles;
create policy funding_profiles_read on public.funding_profiles
for select to authenticated using (public.can_read_club(club_id));

drop policy if exists funding_profiles_insert on public.funding_profiles;
create policy funding_profiles_insert on public.funding_profiles
for insert to authenticated with check (public.can_manage_club(club_id));

drop policy if exists funding_profiles_update on public.funding_profiles;
create policy funding_profiles_update on public.funding_profiles
for update to authenticated using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

grant select, insert, update on public.funding_profiles to authenticated;

commit;
