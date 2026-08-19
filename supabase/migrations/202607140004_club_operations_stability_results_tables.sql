-- Daxora League Operations v3.4: Club Operations RPC stability, results, tables and cup progression.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.league_memberships drop constraint if exists league_memberships_role_check;
alter table public.league_memberships add constraint league_memberships_role_check check (role in ('owner','admin','fixtures','officials','results','viewer'));
alter table public.league_invitations drop constraint if exists league_invitations_role_check;
alter table public.league_invitations add constraint league_invitations_role_check check (role in ('admin','fixtures','officials','results','viewer'));

alter table public.league_divisions
  add column if not exists win_points integer not null default 3,
  add column if not exists draw_points integer not null default 1,
  add column if not exists loss_points integer not null default 0,
  add column if not exists walkover_score integer not null default 3;
alter table public.league_divisions drop constraint if exists league_divisions_result_points_check;
alter table public.league_divisions add constraint league_divisions_result_points_check
  check (win_points between 0 and 10 and draw_points between 0 and 10 and loss_points between -10 and 10 and walkover_score between 1 and 20);

create or replace function public.upsert_league_schedule_settings_entity(
  target_league_id uuid,
  entity_type text,
  entity_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
set row_security=off
as $$
declare
  safe_type text:=lower(trim(coalesce(entity_type,'')));
  entity_id uuid:=coalesce(nullif(entity_data->>'id','')::uuid,gen_random_uuid());
  season_id uuid;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if entity_data is null or jsonb_typeof(entity_data)<>'object' then raise exception 'League entity data is required' using errcode='22023'; end if;

  if safe_type='season' then
    if nullif(entity_data->>'default_kick_off','') is null then raise exception 'The league default kick-off is required' using errcode='22023'; end if;
    insert into public.league_seasons(
      id,league_id,name,starts_on,ends_on,status,is_current,default_kick_off,primary_weekday,max_consecutive_home_away
    ) values(
      entity_id,target_league_id,trim(entity_data->>'name'),nullif(entity_data->>'starts_on','')::date,nullif(entity_data->>'ends_on','')::date,
      coalesce(nullif(entity_data->>'status',''),'draft'),coalesce((entity_data->>'is_current')::boolean,false),nullif(entity_data->>'default_kick_off','')::time,
      greatest(0,least(coalesce((entity_data->>'primary_weekday')::integer,6),6)),greatest(1,least(coalesce((entity_data->>'max_consecutive_home_away')::integer,2),6))
    ) on conflict(id) do update set
      name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,status=excluded.status,is_current=excluded.is_current,
      default_kick_off=excluded.default_kick_off,primary_weekday=excluded.primary_weekday,max_consecutive_home_away=excluded.max_consecutive_home_away,updated_at=now()
    where public.league_seasons.league_id=target_league_id;
    if coalesce((entity_data->>'is_current')::boolean,false) then update public.league_seasons set is_current=false,updated_at=now() where league_id=target_league_id and id<>entity_id and is_current; end if;
  elsif safe_type='division' then
    season_id:=nullif(entity_data->>'season_id','')::uuid;
    perform private.assert_league_reference(target_league_id,'season',season_id);
    insert into public.league_divisions(
      id,league_id,season_id,name,code,sort_order,team_limit,starts_on,ends_on,meetings_per_pairing,default_kick_off,
      playing_weekday,max_consecutive_home_away,win_points,draw_points,loss_points,walkover_score
    ) values(
      entity_id,target_league_id,season_id,trim(entity_data->>'name'),nullif(trim(coalesce(entity_data->>'code','')),''),
      coalesce((entity_data->>'sort_order')::integer,0),nullif(entity_data->>'team_limit','')::integer,nullif(entity_data->>'starts_on','')::date,
      nullif(entity_data->>'ends_on','')::date,greatest(1,least(coalesce((entity_data->>'meetings_per_pairing')::integer,2),4)),
      nullif(entity_data->>'default_kick_off','')::time,nullif(entity_data->>'playing_weekday','')::integer,
      greatest(1,least(coalesce((entity_data->>'max_consecutive_home_away')::integer,2),6)),
      greatest(0,least(coalesce((entity_data->>'win_points')::integer,3),10)),
      greatest(0,least(coalesce((entity_data->>'draw_points')::integer,1),10)),
      greatest(-10,least(coalesce((entity_data->>'loss_points')::integer,0),10)),
      greatest(1,least(coalesce((entity_data->>'walkover_score')::integer,3),20))
    ) on conflict(id) do update set
      season_id=excluded.season_id,name=excluded.name,code=excluded.code,sort_order=excluded.sort_order,team_limit=excluded.team_limit,
      starts_on=excluded.starts_on,ends_on=excluded.ends_on,meetings_per_pairing=excluded.meetings_per_pairing,default_kick_off=excluded.default_kick_off,
      playing_weekday=excluded.playing_weekday,max_consecutive_home_away=excluded.max_consecutive_home_away,win_points=excluded.win_points,
      draw_points=excluded.draw_points,loss_points=excluded.loss_points,walkover_score=excluded.walkover_score,updated_at=now()
    where public.league_divisions.league_id=target_league_id;
  else
    raise exception 'Only season and division schedule settings are supported' using errcode='22023';
  end if;
  perform private.write_league_audit(target_league_id,'league.'||safe_type||'_schedule_settings_saved',safe_type,entity_id,entity_data);
  return entity_id;
end;
$$;

create table if not exists public.league_result_submissions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  publication_fixture_id uuid not null references public.league_publication_fixtures(id) on delete restrict,
  parent_club_id uuid references public.league_parent_clubs(id) on delete set null,
  target_type text not null check (target_type in ('schedule_entry','cup_tie')),
  target_id uuid not null,
  competition_type text not null check (competition_type in ('league','cup')),
  competition_id uuid,
  home_team_id uuid not null references public.league_teams(id) on delete restrict,
  away_team_id uuid not null references public.league_teams(id) on delete restrict,
  outcome_type text not null default 'played' check (outcome_type in ('played','home_walkover','away_walkover','abandoned','void')),
  home_score integer check (home_score is null or home_score between 0 and 99),
  away_score integer check (away_score is null or away_score between 0 and 99),
  home_penalties integer check (home_penalties is null or home_penalties between 0 and 99),
  away_penalties integer check (away_penalties is null or away_penalties between 0 and 99),
  winner_team_id uuid references public.league_teams(id) on delete restrict,
  notes text,
  status text not null default 'submitted' check (status in ('submitted','verified','rejected','withdrawn')),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (winner_team_id is null or winner_team_id in (home_team_id,away_team_id))
);

create table if not exists public.league_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  fixture_key text not null,
  publication_fixture_id uuid references public.league_publication_fixtures(id) on delete set null,
  target_type text not null check (target_type in ('schedule_entry','cup_tie')),
  target_id uuid not null,
  competition_type text not null check (competition_type in ('league','cup')),
  competition_id uuid,
  division_id uuid references public.league_divisions(id) on delete restrict,
  cup_id uuid references public.league_cups(id) on delete restrict,
  home_team_id uuid not null references public.league_teams(id) on delete restrict,
  away_team_id uuid not null references public.league_teams(id) on delete restrict,
  scheduled_date date,
  outcome_type text not null default 'played' check (outcome_type in ('played','home_walkover','away_walkover','abandoned','void')),
  home_score integer check (home_score is null or home_score between 0 and 99),
  away_score integer check (away_score is null or away_score between 0 and 99),
  home_penalties integer check (home_penalties is null or home_penalties between 0 and 99),
  away_penalties integer check (away_penalties is null or away_penalties between 0 and 99),
  winner_team_id uuid references public.league_teams(id) on delete restrict,
  source text not null default 'league_entry' check (source in ('club_submission','league_entry','full_time_import')),
  status text not null default 'verified' check (status in ('verified','void')),
  notes text,
  submitted_by uuid references auth.users(id) on delete set null,
  verified_by uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id,fixture_key),
  check (home_team_id <> away_team_id),
  check (winner_team_id is null or winner_team_id in (home_team_id,away_team_id))
);

create table if not exists public.league_table_adjustments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  division_id uuid not null references public.league_divisions(id) on delete cascade,
  team_id uuid not null references public.league_teams(id) on delete cascade,
  points_delta integer not null default 0 check (points_delta between -100 and 100),
  goals_for_delta integer not null default 0 check (goals_for_delta between -100 and 100),
  goals_against_delta integer not null default 0 check (goals_against_delta between -100 and 100),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  status text not null default 'active' check (status in ('active','revoked')),
  effective_on date not null default current_date,
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_result_submissions_queue_idx on public.league_result_submissions(league_id,status,submitted_at desc);
create unique index if not exists league_result_submissions_one_open_idx on public.league_result_submissions(league_id,publication_fixture_id,parent_club_id) where status='submitted';
create index if not exists league_results_table_idx on public.league_results(league_id,season_id,division_id,status);
create index if not exists league_results_cup_idx on public.league_results(league_id,season_id,cup_id,status);
create index if not exists league_table_adjustments_idx on public.league_table_adjustments(league_id,season_id,division_id,team_id,status);

alter table public.league_result_submissions enable row level security;
alter table public.league_result_submissions force row level security;
alter table public.league_results enable row level security;
alter table public.league_results force row level security;
alter table public.league_table_adjustments enable row level security;
alter table public.league_table_adjustments force row level security;
revoke all on table public.league_result_submissions,public.league_results,public.league_table_adjustments from anon,authenticated;

drop policy if exists league_result_submissions_read on public.league_result_submissions;
create policy league_result_submissions_read on public.league_result_submissions for select to authenticated using (public.can_view_league(league_id) or parent_club_id=private.current_league_club_id(league_id,auth.uid()));
drop policy if exists league_results_read on public.league_results;
create policy league_results_read on public.league_results for select to authenticated using (
  public.can_view_league(league_id) or exists (
    select 1 from public.league_teams result_team where result_team.id in (home_team_id,away_team_id) and result_team.parent_club_id=private.current_league_club_id(league_id,auth.uid())
  )
);
drop policy if exists league_table_adjustments_read on public.league_table_adjustments;
create policy league_table_adjustments_read on public.league_table_adjustments for select to authenticated using (public.can_view_league(league_id));

create or replace function public.can_manage_league_results(target_league_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select auth.uid() is not null and (
    private.is_platform_admin(auth.uid()) or exists (
      select 1 from public.league_memberships result_membership join public.leagues result_league on result_league.id=result_membership.league_id
      where result_membership.league_id=target_league_id and result_membership.user_id=auth.uid() and result_membership.status='active'
        and result_membership.role=any(array['owner','admin','fixtures','results']) and result_league.status='active'
    )
  );
$$;

create or replace function public.create_league_invitation(target_league_id uuid,invite_email text,invite_role text default 'viewer',expiry_hours integer default 168)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); safe_email text:=lower(trim(coalesce(invite_email,''))); safe_role text:=lower(trim(coalesce(invite_role,'viewer'))); raw_token text:=encode(gen_random_bytes(32),'hex'); invitation_id uuid; invitation_expiry timestamptz;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if position('@' in safe_email)<=1 then raise exception 'A valid email address is required' using errcode='22023'; end if;
  if safe_role not in ('admin','fixtures','officials','results','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  update public.league_invitations invitation_value set status='revoked',revoked_at=now(),updated_at=now() where invitation_value.league_id=target_league_id and lower(invitation_value.email)=safe_email and invitation_value.status='pending';
  invitation_expiry:=now()+make_interval(hours=>greatest(1,least(coalesce(expiry_hours,168),720)));
  insert into public.league_invitations(league_id,email,role,token_hash,status,invited_by,expires_at) values(target_league_id,safe_email,safe_role,encode(digest(raw_token,'sha256'),'hex'),'pending',actor_id,invitation_expiry) returning id into invitation_id;
  perform private.write_league_audit(target_league_id,'league.invitation_created','invitation',invitation_id,jsonb_build_object('email',safe_email,'role',safe_role));
  return jsonb_build_object('id',invitation_id,'token',raw_token,'email',safe_email,'role',safe_role,'expires_at',invitation_expiry);
end; $$;

create or replace function public.update_league_member_role(target_league_id uuid,target_user_id uuid,next_role text)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare safe_role text:=lower(trim(coalesce(next_role,''))); target_current_role text;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if safe_role not in ('admin','fixtures','officials','results','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  select membership.role into target_current_role from public.league_memberships membership where membership.league_id=target_league_id and membership.user_id=target_user_id and membership.status='active';
  if target_current_role is null then raise exception 'League member not found' using errcode='P0002'; end if;
  if target_current_role='owner' then raise exception 'The league owner role cannot be changed here' using errcode='42501'; end if;
  update public.league_memberships membership set role=safe_role,updated_at=now() where membership.league_id=target_league_id and membership.user_id=target_user_id;
  perform private.write_league_audit(target_league_id,'league.member_role_changed','member',target_user_id,jsonb_build_object('role',safe_role));
end; $$;

create or replace function private.result_fixture_key(fixture_snapshot jsonb,target_type text,target_id uuid)
returns text language sql immutable set search_path='' as $$
  select case when target_type='cup_tie' then 'cup:'||target_id::text else concat_ws(':','league',coalesce(fixture_snapshot->>'division_id',fixture_snapshot->>'competition_id','unknown'),coalesce(fixture_snapshot->>'home_team_id','unknown'),coalesce(fixture_snapshot->>'away_team_id','unknown'),coalesce(fixture_snapshot->>'meeting_number','1')) end;
$$;

create or replace function private.normalise_result_payload(fixture_snapshot jsonb,result_data jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare safe_outcome text:=lower(trim(coalesce(result_data->>'outcome_type','played'))); safe_home_score integer; safe_away_score integer; safe_home_penalties integer; safe_away_penalties integer; safe_winner uuid; home_team uuid:=nullif(fixture_snapshot->>'home_team_id','')::uuid; away_team uuid:=nullif(fixture_snapshot->>'away_team_id','')::uuid;
begin
  if safe_outcome not in ('played','home_walkover','away_walkover','abandoned','void') then raise exception 'Invalid result outcome' using errcode='22023'; end if;
  safe_home_score:=nullif(result_data->>'home_score','')::integer; safe_away_score:=nullif(result_data->>'away_score','')::integer; safe_home_penalties:=nullif(result_data->>'home_penalties','')::integer; safe_away_penalties:=nullif(result_data->>'away_penalties','')::integer; safe_winner:=nullif(result_data->>'winner_team_id','')::uuid;
  if safe_outcome='played' and (safe_home_score is null or safe_away_score is null) then raise exception 'Enter both scores' using errcode='22023'; end if;
  if safe_outcome='home_walkover' then safe_home_score:=coalesce(safe_home_score,3); safe_away_score:=coalesce(safe_away_score,0); safe_winner:=home_team;
  elsif safe_outcome='away_walkover' then safe_home_score:=coalesce(safe_home_score,0); safe_away_score:=coalesce(safe_away_score,3); safe_winner:=away_team;
  elsif safe_outcome in ('abandoned','void') then safe_home_score:=null; safe_away_score:=null; safe_home_penalties:=null; safe_away_penalties:=null; safe_winner:=null;
  elsif safe_home_score>safe_away_score then safe_winner:=home_team;
  elsif safe_away_score>safe_home_score then safe_winner:=away_team; end if;
  if safe_winner is not null and safe_winner not in (home_team,away_team) then raise exception 'The progressing team must be one of the teams in the fixture' using errcode='22023'; end if;
  return jsonb_build_object('outcome_type',safe_outcome,'home_score',safe_home_score,'away_score',safe_away_score,'home_penalties',safe_home_penalties,'away_penalties',safe_away_penalties,'winner_team_id',safe_winner,'notes',nullif(trim(coalesce(result_data->>'notes','')),''));
end; $$;

create or replace function public.submit_league_fixture_result(target_league_id uuid,target_publication_fixture_id uuid,result_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); club_id uuid:=private.current_league_club_id(target_league_id,actor_id); actor_role text:=private.current_league_role(target_league_id,actor_id); publication_fixture public.league_publication_fixtures%rowtype; publication_status text; result_season_id uuid; safe_result jsonb; submission_id uuid; walkover_goals integer:=3;
begin
  if actor_id is null then raise exception 'Sign in to submit a result' using errcode='42501'; end if;
  select fixture_value.* into publication_fixture from public.league_publication_fixtures fixture_value where fixture_value.id=target_publication_fixture_id and fixture_value.league_id=target_league_id;
  select publication_value.status,publication_value.season_id into publication_status,result_season_id from public.league_publications publication_value where publication_value.id=publication_fixture.publication_id;
  if publication_fixture.id is null or publication_status<>'published' then raise exception 'Published fixture not found' using errcode='P0002'; end if;
  if club_id is null and not public.can_manage_league_results(target_league_id) then raise exception 'Result submission access denied' using errcode='42501'; end if;
  if club_id is not null and not (club_id=any(publication_fixture.parent_club_ids)) then raise exception 'This fixture is outside your club access' using errcode='42501'; end if;
  if club_id is not null and actor_role not in ('club_secretary','team_contact') then raise exception 'Your club role cannot submit results' using errcode='42501'; end if;
  if club_id is not null and nullif(publication_fixture.snapshot->>'scheduled_date','')::date>current_date then raise exception 'A result cannot be submitted before the fixture date' using errcode='22023'; end if;
  if club_id is not null and exists(
    select 1 from public.league_results result_value
    where result_value.league_id=target_league_id
      and result_value.fixture_key=private.result_fixture_key(publication_fixture.snapshot,publication_fixture.target_type,publication_fixture.target_id)
  ) then raise exception 'The league has already verified this fixture result' using errcode='23505'; end if;
  safe_result:=private.normalise_result_payload(publication_fixture.snapshot,result_data);
  if coalesce(publication_fixture.snapshot->>'competition_type',case when publication_fixture.target_type='cup_tie' then 'cup' else 'league' end)='league' then
    select coalesce(division_value.walkover_score,3) into walkover_goals
    from public.league_divisions division_value
    where division_value.id=nullif(coalesce(publication_fixture.snapshot->>'division_id',publication_fixture.snapshot->>'competition_id'),'')::uuid
      and division_value.league_id=target_league_id;
  end if;
  if safe_result->>'outcome_type'='home_walkover' then safe_result:=jsonb_set(jsonb_set(safe_result,'{home_score}',to_jsonb(coalesce(walkover_goals,3)),true),'{away_score}','0'::jsonb,true);
  elsif safe_result->>'outcome_type'='away_walkover' then safe_result:=jsonb_set(jsonb_set(safe_result,'{home_score}','0'::jsonb,true),'{away_score}',to_jsonb(coalesce(walkover_goals,3)),true); end if;
  insert into public.league_result_submissions(league_id,season_id,publication_fixture_id,parent_club_id,target_type,target_id,competition_type,competition_id,home_team_id,away_team_id,outcome_type,home_score,away_score,home_penalties,away_penalties,winner_team_id,notes,status,submitted_by)
  values(target_league_id,result_season_id,publication_fixture.id,club_id,publication_fixture.target_type,publication_fixture.target_id,coalesce(publication_fixture.snapshot->>'competition_type',case when publication_fixture.target_type='cup_tie' then 'cup' else 'league' end),nullif(coalesce(publication_fixture.snapshot->>'competition_id',publication_fixture.snapshot->>'division_id'),'')::uuid,nullif(publication_fixture.snapshot->>'home_team_id','')::uuid,nullif(publication_fixture.snapshot->>'away_team_id','')::uuid,safe_result->>'outcome_type',nullif(safe_result->>'home_score','')::integer,nullif(safe_result->>'away_score','')::integer,nullif(safe_result->>'home_penalties','')::integer,nullif(safe_result->>'away_penalties','')::integer,nullif(safe_result->>'winner_team_id','')::uuid,safe_result->>'notes','submitted',actor_id)
  returning id into submission_id;
  perform private.write_league_audit(target_league_id,'league.result_submitted','result_submission',submission_id,jsonb_build_object('publication_fixture_id',target_publication_fixture_id,'club_id',club_id));
  return submission_id;
end; $$;

create or replace function private.apply_verified_league_result(target_league_id uuid,result_submission public.league_result_submissions,result_source text,reviewer_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare publication_fixture public.league_publication_fixtures%rowtype; fixture_key text; result_id uuid; result_division_id uuid; result_cup_id uuid; result_round_id uuid; remaining_ties integer;
begin
  select fixture_value.* into publication_fixture from public.league_publication_fixtures fixture_value where fixture_value.id=result_submission.publication_fixture_id and fixture_value.league_id=target_league_id;
  if publication_fixture.id is null then raise exception 'Published fixture snapshot not found' using errcode='P0002'; end if;
  fixture_key:=private.result_fixture_key(publication_fixture.snapshot,publication_fixture.target_type,publication_fixture.target_id);
  result_division_id:=case when result_submission.competition_type='league' then result_submission.competition_id else null end;
  result_cup_id:=case when result_submission.competition_type='cup' then result_submission.competition_id else null end;
  insert into public.league_results(league_id,season_id,fixture_key,publication_fixture_id,target_type,target_id,competition_type,competition_id,division_id,cup_id,home_team_id,away_team_id,scheduled_date,outcome_type,home_score,away_score,home_penalties,away_penalties,winner_team_id,source,status,notes,submitted_by,verified_by,verified_at)
  values(target_league_id,result_submission.season_id,fixture_key,result_submission.publication_fixture_id,result_submission.target_type,result_submission.target_id,result_submission.competition_type,result_submission.competition_id,result_division_id,result_cup_id,result_submission.home_team_id,result_submission.away_team_id,nullif(publication_fixture.snapshot->>'scheduled_date','')::date,result_submission.outcome_type,result_submission.home_score,result_submission.away_score,result_submission.home_penalties,result_submission.away_penalties,result_submission.winner_team_id,result_source,case when result_submission.outcome_type='void' then 'void' else 'verified' end,result_submission.notes,result_submission.submitted_by,reviewer_id,now())
  on conflict(league_id,fixture_key) do update set publication_fixture_id=excluded.publication_fixture_id,target_type=excluded.target_type,target_id=excluded.target_id,competition_type=excluded.competition_type,competition_id=excluded.competition_id,division_id=excluded.division_id,cup_id=excluded.cup_id,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,scheduled_date=excluded.scheduled_date,outcome_type=excluded.outcome_type,home_score=excluded.home_score,away_score=excluded.away_score,home_penalties=excluded.home_penalties,away_penalties=excluded.away_penalties,winner_team_id=excluded.winner_team_id,source=excluded.source,status=excluded.status,notes=excluded.notes,submitted_by=excluded.submitted_by,verified_by=excluded.verified_by,verified_at=now(),updated_at=now()
  returning id into result_id;
  update public.league_result_submissions other_submission
  set status='withdrawn',reviewed_by=reviewer_id,review_notes='Superseded by the verified result',reviewed_at=now(),updated_at=now()
  where other_submission.league_id=target_league_id
    and other_submission.publication_fixture_id=result_submission.publication_fixture_id
    and other_submission.id<>result_submission.id
    and other_submission.status='submitted';
  if result_submission.target_type='cup_tie' then
    if result_submission.outcome_type='played' and result_submission.winner_team_id is null then raise exception 'Select the team progressing from this cup tie' using errcode='22023'; end if;
    update public.league_cup_ties cup_tie set home_score=result_submission.home_score,away_score=result_submission.away_score,winner_team_id=result_submission.winner_team_id,status=case when result_submission.outcome_type='void' then 'void' else 'played' end,updated_at=now() where cup_tie.id=result_submission.target_id and cup_tie.league_id=target_league_id;
    select cup_tie.cup_round_id into result_round_id from public.league_cup_ties cup_tie where cup_tie.id=result_submission.target_id and cup_tie.league_id=target_league_id;
    if result_round_id is not null then
      select count(*) into remaining_ties from public.league_cup_ties cup_tie where cup_tie.cup_round_id=result_round_id and cup_tie.away_team_id is not null and cup_tie.status not in ('played','bye','void','cancelled');
      if remaining_ties=0 then
        update public.league_cup_rounds cup_round set status='completed',updated_at=now() where cup_round.id=result_round_id;
        if (select count(*) from public.league_cup_ties cup_tie where cup_tie.cup_round_id=result_round_id and cup_tie.winner_team_id is not null)=1 then update public.league_cups cup_value set status='completed',updated_at=now() where cup_value.id=result_cup_id; end if;
      end if;
    end if;
  end if;
  return result_id;
end; $$;

create or replace function public.review_league_result_submission(target_league_id uuid,target_submission_id uuid,review_decision text,review_notes text default null)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); safe_decision text:=lower(trim(coalesce(review_decision,''))); submission_value public.league_result_submissions%rowtype; result_id uuid;
begin
  if not public.can_manage_league_results(target_league_id) then raise exception 'Results secretary access required' using errcode='42501'; end if;
  if safe_decision not in ('verify','reject') then raise exception 'Invalid result review decision' using errcode='22023'; end if;
  select submission_row.* into submission_value from public.league_result_submissions submission_row where submission_row.id=target_submission_id and submission_row.league_id=target_league_id for update;
  if submission_value.id is null or submission_value.status<>'submitted' then raise exception 'Open result submission not found' using errcode='P0002'; end if;
  if safe_decision='reject' then
    if length(trim(coalesce(review_notes,'')))<3 then raise exception 'Add a reason for rejecting the result' using errcode='22023'; end if;
    update public.league_result_submissions submission_row set status='rejected',reviewed_by=actor_id,review_notes=trim(review_notes),reviewed_at=now(),updated_at=now() where submission_row.id=submission_value.id;
    perform private.write_league_audit(target_league_id,'league.result_rejected','result_submission',submission_value.id,jsonb_build_object('notes',trim(review_notes))); return null;
  end if;
  result_id:=private.apply_verified_league_result(target_league_id,submission_value,case when submission_value.parent_club_id is null then 'league_entry' else 'club_submission' end,actor_id);
  update public.league_result_submissions submission_row set status='verified',reviewed_by=actor_id,review_notes=nullif(trim(coalesce(review_notes,'')),''),reviewed_at=now(),updated_at=now() where submission_row.id=submission_value.id;
  perform private.write_league_audit(target_league_id,'league.result_verified','result',result_id,jsonb_build_object('submission_id',submission_value.id)); return result_id;
end; $$;

create or replace function public.record_league_fixture_result(target_league_id uuid,target_publication_fixture_id uuid,result_data jsonb default '{}'::jsonb,result_source text default 'league_entry')
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); submission_id uuid; result_id uuid; submission_value public.league_result_submissions%rowtype; safe_source text:=lower(trim(coalesce(result_source,'league_entry')));
begin
  if not public.can_manage_league_results(target_league_id) then raise exception 'Results secretary access required' using errcode='42501'; end if;
  if safe_source not in ('league_entry','full_time_import') then raise exception 'Invalid result source' using errcode='22023'; end if;
  submission_id:=public.submit_league_fixture_result(target_league_id,target_publication_fixture_id,result_data);
  select submission_row.* into submission_value from public.league_result_submissions submission_row where submission_row.id=submission_id for update;
  result_id:=private.apply_verified_league_result(target_league_id,submission_value,safe_source,actor_id);
  update public.league_result_submissions submission_row set status='verified',reviewed_by=actor_id,reviewed_at=now(),updated_at=now() where submission_row.id=submission_id;
  perform private.write_league_audit(target_league_id,'league.result_recorded','result',result_id,jsonb_build_object('source',safe_source,'submission_id',submission_id)); return result_id;
end; $$;

create or replace function public.upsert_league_table_adjustment(target_league_id uuid,adjustment_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); adjustment_id uuid:=coalesce(nullif(adjustment_data->>'id','')::uuid,gen_random_uuid()); result_season_id uuid:=nullif(adjustment_data->>'season_id','')::uuid; result_division_id uuid:=nullif(adjustment_data->>'division_id','')::uuid; result_team_id uuid:=nullif(adjustment_data->>'team_id','')::uuid; safe_reason text:=trim(coalesce(adjustment_data->>'reason',''));
begin
  if not public.can_manage_league_results(target_league_id) then raise exception 'Results secretary access required' using errcode='42501'; end if;
  if result_season_id is null or result_division_id is null or result_team_id is null or length(safe_reason)<3 then raise exception 'Season, division, team and reason are required' using errcode='22023'; end if;
  if nullif(adjustment_data->>'id','') is not null and not exists(select 1 from public.league_table_adjustments adjustment_value where adjustment_value.id=adjustment_id and adjustment_value.league_id=target_league_id) then raise exception 'Table adjustment not found in this league' using errcode='P0002'; end if;
  if not exists(select 1 from public.league_teams team_value where team_value.id=result_team_id and team_value.league_id=target_league_id and team_value.season_id=result_season_id and team_value.division_id=result_division_id) then raise exception 'The selected team is not in this division' using errcode='22023'; end if;
  insert into public.league_table_adjustments(id,league_id,season_id,division_id,team_id,points_delta,goals_for_delta,goals_against_delta,reason,status,effective_on,created_by)
  values(adjustment_id,target_league_id,result_season_id,result_division_id,result_team_id,coalesce(nullif(adjustment_data->>'points_delta','')::integer,0),coalesce(nullif(adjustment_data->>'goals_for_delta','')::integer,0),coalesce(nullif(adjustment_data->>'goals_against_delta','')::integer,0),safe_reason,'active',coalesce(nullif(adjustment_data->>'effective_on','')::date,current_date),actor_id)
  on conflict(id) do update set points_delta=excluded.points_delta,goals_for_delta=excluded.goals_for_delta,goals_against_delta=excluded.goals_against_delta,reason=excluded.reason,effective_on=excluded.effective_on,status='active',revoked_by=null,revoked_at=null,updated_at=now() where public.league_table_adjustments.league_id=target_league_id;
  perform private.write_league_audit(target_league_id,'league.table_adjustment_saved','table_adjustment',adjustment_id,jsonb_build_object('team_id',result_team_id,'points_delta',coalesce(nullif(adjustment_data->>'points_delta','')::integer,0),'reason',safe_reason)); return adjustment_id;
end; $$;

create or replace function public.revoke_league_table_adjustment(target_league_id uuid,target_adjustment_id uuid)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if not public.can_manage_league_results(target_league_id) then raise exception 'Results secretary access required' using errcode='42501'; end if;
  update public.league_table_adjustments adjustment_value set status='revoked',revoked_by=auth.uid(),revoked_at=now(),updated_at=now() where adjustment_value.id=target_adjustment_id and adjustment_value.league_id=target_league_id and adjustment_value.status='active';
  if not found then raise exception 'Active table adjustment not found' using errcode='P0002'; end if;
  perform private.write_league_audit(target_league_id,'league.table_adjustment_revoked','table_adjustment',target_adjustment_id,'{}'::jsonb);
end; $$;

create or replace function public.get_league_results_data(target_league_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb;
begin
  if not public.can_view_league(target_league_id) then raise exception 'League workspace access denied' using errcode='42501'; end if;
  select jsonb_build_object(
    'access',jsonb_build_object('can_manage_results',public.can_manage_league_results(target_league_id),'can_manage',public.can_manage_league(target_league_id)),
    'results',coalesce((select jsonb_agg(to_jsonb(result_value) order by result_value.scheduled_date desc nulls last,result_value.verified_at desc) from public.league_results result_value where result_value.league_id=target_league_id),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(to_jsonb(submission_value) order by case submission_value.status when 'submitted' then 0 else 1 end,submission_value.submitted_at desc) from public.league_result_submissions submission_value where submission_value.league_id=target_league_id),'[]'::jsonb),
    'adjustments',coalesce((select jsonb_agg(to_jsonb(adjustment_value) order by adjustment_value.status,adjustment_value.effective_on desc,adjustment_value.created_at desc) from public.league_table_adjustments adjustment_value where adjustment_value.league_id=target_league_id),'[]'::jsonb),
    'published_fixtures',coalesce((select jsonb_agg(latest_fixture.fixture_json order by latest_fixture.fixture_json->>'scheduled_date',latest_fixture.fixture_json->>'kick_off') from (
      select distinct on (publication_fixture.target_type,publication_fixture.target_id) publication_fixture.snapshot||jsonb_build_object('publication_fixture_id',publication_fixture.id,'publication_id',publication_fixture.publication_id,'target_type',publication_fixture.target_type,'target_id',publication_fixture.target_id,'fixture_key',private.result_fixture_key(publication_fixture.snapshot,publication_fixture.target_type,publication_fixture.target_id)) as fixture_json
      from public.league_publication_fixtures publication_fixture join public.league_publications publication_value on publication_value.id=publication_fixture.publication_id and publication_value.status='published'
      where publication_fixture.league_id=target_league_id order by publication_fixture.target_type,publication_fixture.target_id,publication_value.published_at desc nulls last,publication_value.created_at desc
    ) latest_fixture),'[]'::jsonb)
  ) into result; return result;
end; $$;

create or replace function public.get_league_club_results_data(target_league_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor_id uuid:=auth.uid(); club_id uuid:=private.current_league_club_id(target_league_id,actor_id); club_role text:=private.current_league_role(target_league_id,actor_id); result jsonb;
begin
  if club_id is null then raise exception 'Club portal access denied' using errcode='42501'; end if;
  select jsonb_build_object(
    'access',jsonb_build_object('can_submit',club_role in ('club_secretary','team_contact')),
    'results',coalesce((select jsonb_agg(to_jsonb(result_value) order by result_value.scheduled_date desc nulls last) from public.league_results result_value where result_value.league_id=target_league_id and exists(select 1 from public.league_teams team_value where team_value.id in (result_value.home_team_id,result_value.away_team_id) and team_value.parent_club_id=club_id)),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(to_jsonb(submission_value) order by submission_value.submitted_at desc) from public.league_result_submissions submission_value where submission_value.league_id=target_league_id and submission_value.parent_club_id=club_id),'[]'::jsonb)
  ) into result; return result;
end; $$;

-- Recreate the exact RPC signature PostgREST must expose.
drop function if exists public.get_league_club_operations_data(uuid);
create function public.get_league_club_operations_data(target_league_id uuid)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb;
begin
  if not public.can_view_league(target_league_id) then raise exception 'League workspace access denied' using errcode='42501'; end if;
  update public.league_club_invitations invitation_value set status='expired',updated_at=now() where invitation_value.league_id=target_league_id and invitation_value.status='pending' and invitation_value.expires_at<=now();
  select jsonb_build_object(
    'access',jsonb_build_object('can_manage',public.can_manage_league(target_league_id),'can_operate',public.can_operate_league(target_league_id),'can_manage_clubs',public.can_manage_league(target_league_id)),
    'publications',coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.published_at desc nulls last,row_value.created_at desc) from public.league_publications row_value where row_value.league_id=target_league_id),'[]'::jsonb),
    'publication_fixtures',coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at) from public.league_publication_fixtures row_value where row_value.league_id=target_league_id),'[]'::jsonb),
    'acknowledgements',coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.status,row_value.created_at desc) from public.league_fixture_acknowledgements row_value where row_value.league_id=target_league_id),'[]'::jsonb),
    'change_requests',coalesce((select jsonb_agg(to_jsonb(row_value) order by case row_value.status when 'submitted' then 0 when 'under_review' then 1 else 2 end,row_value.created_at desc) from public.league_fixture_change_requests row_value where row_value.league_id=target_league_id),'[]'::jsonb),
    'communications',coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc) from public.league_communications row_value where row_value.league_id=target_league_id),'[]'::jsonb),
    'club_memberships',coalesce((select jsonb_agg(to_jsonb(membership)||jsonb_build_object('display_name',profile.display_name,'email',profile.email) order by club.name,coalesce(profile.display_name,profile.email)) from public.league_club_memberships membership join public.league_parent_clubs club on club.id=membership.parent_club_id left join public.user_profiles profile on profile.id=membership.user_id where membership.league_id=target_league_id and membership.status<>'revoked'),'[]'::jsonb),
    'club_invitations',case when public.can_manage_league(target_league_id) then coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc) from public.league_club_invitations row_value where row_value.league_id=target_league_id),'[]'::jsonb) else '[]'::jsonb end,
    'calendar_feeds',coalesce((select jsonb_agg(jsonb_build_object('id',token.id,'scope_type',token.scope_type,'scope_id',token.scope_id,'feed_label',token.label,'expires_at',token.expires_at,'revoked_at',token.revoked_at,'created_at',token.created_at) order by token.created_at desc) from private.league_calendar_tokens token where token.league_id=target_league_id),'[]'::jsonb)
  ) into result; return result;
end; $$;

revoke all on function public.can_manage_league_results(uuid) from public,anon;
revoke all on function public.submit_league_fixture_result(uuid,uuid,jsonb) from public,anon;
revoke all on function public.review_league_result_submission(uuid,uuid,text,text) from public,anon;
revoke all on function public.record_league_fixture_result(uuid,uuid,jsonb,text) from public,anon;
revoke all on function public.upsert_league_table_adjustment(uuid,jsonb) from public,anon;
revoke all on function public.revoke_league_table_adjustment(uuid,uuid) from public,anon;
revoke all on function public.get_league_results_data(uuid) from public,anon;
revoke all on function public.get_league_club_results_data(uuid) from public,anon;
revoke all on function public.get_league_club_operations_data(uuid) from public,anon;
grant execute on function public.can_manage_league_results(uuid) to authenticated;
grant execute on function public.submit_league_fixture_result(uuid,uuid,jsonb) to authenticated;
grant execute on function public.review_league_result_submission(uuid,uuid,text,text) to authenticated;
grant execute on function public.record_league_fixture_result(uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.upsert_league_table_adjustment(uuid,jsonb) to authenticated;
grant execute on function public.revoke_league_table_adjustment(uuid,uuid) to authenticated;
grant execute on function public.get_league_results_data(uuid) to authenticated;
grant execute on function public.get_league_club_results_data(uuid) to authenticated;
grant execute on function public.get_league_club_operations_data(uuid) to authenticated;

do $$ begin perform pg_notify('pgrst','reload schema'); end $$;
commit;
