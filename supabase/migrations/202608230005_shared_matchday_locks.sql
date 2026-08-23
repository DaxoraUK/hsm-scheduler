-- Club-wide, permission-controlled and auditable matchday schedule locks.

create table if not exists public.matchday_locks (
  club_id uuid not null references public.clubs(id) on delete cascade,
  day_scope text not null,
  matchday_date text not null,
  locked boolean not null default false,
  locked_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (club_id, day_scope, matchday_date),
  check (length(day_scope) between 1 and 40),
  check (length(matchday_date) between 1 and 80)
);

alter table public.matchday_locks enable row level security;

drop policy if exists matchday_locks_member_read on public.matchday_locks;
create policy matchday_locks_member_read on public.matchday_locks
for select to authenticated using (public.is_club_member(club_id));

revoke all on table public.matchday_locks from public, anon, authenticated;

create or replace function public.get_matchday_lock(
  target_club_id uuid,
  target_day_scope text,
  target_matchday_date text
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare saved public.matchday_locks%rowtype;
begin
  if auth.uid() is null or not public.is_club_member(target_club_id) then
    raise exception 'Club access required' using errcode = '42501';
  end if;

  select * into saved from public.matchday_locks lock_state
  where lock_state.club_id = target_club_id
    and lock_state.day_scope = left(lower(trim(coalesce(target_day_scope, ''))), 40)
    and lock_state.matchday_date = left(trim(coalesce(target_matchday_date, '')), 80);

  if not found then
    return jsonb_build_object('locked', false, 'locked_by', null, 'locked_at', null, 'updated_at', null);
  end if;

  return jsonb_build_object(
    'locked', saved.locked,
    'locked_by', saved.locked_by,
    'locked_at', saved.locked_at,
    'updated_at', saved.updated_at
  );
end; $$;

create or replace function public.set_matchday_lock(
  target_club_id uuid,
  target_day_scope text,
  target_matchday_date text,
  target_locked boolean
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  actor_id uuid := auth.uid();
  day_value text := left(lower(trim(coalesce(target_day_scope, ''))), 40);
  date_value text := left(trim(coalesce(target_matchday_date, '')), 80);
  saved public.matchday_locks%rowtype;
begin
  if actor_id is null or not public.can_publish_club_matchweek(target_club_id) then
    raise exception 'Matchweek publisher access required' using errcode = '42501';
  end if;
  if day_value = '' or date_value = '' then
    raise exception 'Matchday scope and date are required' using errcode = '22023';
  end if;

  insert into public.matchday_locks(club_id, day_scope, matchday_date, locked, locked_by, locked_at, updated_by)
  values(target_club_id, day_value, date_value, coalesce(target_locked, false),
    case when coalesce(target_locked, false) then actor_id else null end,
    case when coalesce(target_locked, false) then now() else null end,
    actor_id)
  on conflict(club_id, day_scope, matchday_date) do update set
    locked = excluded.locked,
    locked_by = excluded.locked_by,
    locked_at = excluded.locked_at,
    updated_by = actor_id,
    updated_at = now()
  returning * into saved;

  perform public.record_audit_event(
    target_club_id,
    case when saved.locked then 'matchday.schedule.locked' else 'matchday.schedule.unlocked' end,
    'matchday_lock',
    saved.day_scope || ':' || saved.matchday_date,
    jsonb_build_object('day_scope', saved.day_scope, 'matchday_date', saved.matchday_date)
  );

  return jsonb_build_object(
    'locked', saved.locked,
    'locked_by', saved.locked_by,
    'locked_at', saved.locked_at,
    'updated_at', saved.updated_at
  );
end; $$;

revoke all on function public.get_matchday_lock(uuid,text,text) from public, anon;
revoke all on function public.set_matchday_lock(uuid,text,text,boolean) from public, anon;
grant execute on function public.get_matchday_lock(uuid,text,text) to authenticated;
grant execute on function public.set_matchday_lock(uuid,text,text,boolean) to authenticated;
