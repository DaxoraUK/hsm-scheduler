-- Daxora League Operations v3.7: registrations, eligibility and player administration.
begin;

alter table public.league_memberships drop constraint if exists league_memberships_role_check;
alter table public.league_memberships add constraint league_memberships_role_check
  check (role in ('owner','admin','fixtures','officials','results','discipline','registrations','viewer'));

alter table public.league_invitations drop constraint if exists league_invitations_role_check;
alter table public.league_invitations add constraint league_invitations_role_check
  check (role in ('admin','fixtures','officials','results','discipline','registrations','viewer'));

create table if not exists public.league_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  date_of_birth date not null,
  external_ref text,
  status text not null default 'active' check (status in ('active','inactive','archived','deceased')),
  confidential_notes text check (confidential_notes is null or length(confidential_notes) <= 10000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, external_ref)
);

create table if not exists public.league_player_registrations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  player_id uuid not null references public.league_players(id) on delete restrict,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  team_id uuid references public.league_teams(id) on delete restrict,
  registration_type text not null default 'new'
    check (registration_type in ('new','renewal','transfer','dual','loan')),
  status text not null default 'draft'
    check (status in ('draft','submitted','under_review','correction_required','approved','rejected','withdrawn','expired')),
  submission_notes text not null default '' check (length(submission_notes) <= 10000),
  correction_notes text not null default '' check (length(correction_notes) <= 10000),
  decision_notes text not null default '' check (length(decision_notes) <= 10000),
  effective_from date,
  effective_to date,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, season_id, player_id, team_id)
);

create table if not exists public.league_registration_documents (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  registration_id uuid not null references public.league_player_registrations(id) on delete cascade,
  document_type text not null default 'evidence'
    check (document_type in ('identity','age','consent','clearance','dispensation','evidence','other')),
  title text not null check (length(trim(title)) between 2 and 220),
  document_url text not null check (length(trim(document_url)) between 8 and 2000 and document_url ~* '^https?://'),
  visibility text not null default 'league' check (visibility in ('league','club')),
  notes text check (notes is null or length(notes) <= 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.league_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  player_id uuid not null references public.league_players(id) on delete restrict,
  from_club_id uuid references public.league_parent_clubs(id) on delete restrict,
  to_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  to_team_id uuid references public.league_teams(id) on delete restrict,
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','approved','rejected','withdrawn','completed')),
  requested_on date not null default current_date,
  effective_on date,
  reason text not null default '' check (length(reason) <= 10000),
  decision_notes text not null default '' check (length(decision_notes) <= 10000),
  requested_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete cascade,
  division_id uuid references public.league_divisions(id) on delete cascade,
  competition_type text not null default 'all' check (competition_type in ('all','league','cup')),
  competition_id uuid,
  rule_type text not null
    check (rule_type in ('minimum_age','maximum_age','registration_deadline','cup_tied','transfer_clearance','suspension','other')),
  name text not null check (length(trim(name)) between 2 and 220),
  severity text not null default 'block' check (severity in ('block','warn')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_eligibility_dispensations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  player_id uuid not null references public.league_players(id) on delete restrict,
  team_id uuid references public.league_teams(id) on delete restrict,
  rule_type text not null default 'other'
    check (rule_type in ('all','minimum_age','maximum_age','registration_deadline','cup_tied','transfer_clearance','suspension','other')),
  status text not null default 'submitted'
    check (status in ('submitted','under_review','approved','rejected','withdrawn','expired')),
  starts_on date,
  ends_on date,
  reason text not null check (length(trim(reason)) between 3 and 10000),
  decision_notes text not null default '' check (length(decision_notes) <= 10000),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_team_sheets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  publication_fixture_id uuid not null references public.league_publication_fixtures(id) on delete cascade,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete restrict,
  team_id uuid not null references public.league_teams(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','submitted','verified','rejected','withdrawn')),
  validation_status text not null default 'not_checked' check (validation_status in ('not_checked','passed','warning','failed')),
  validation_summary jsonb not null default '{}'::jsonb,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_fixture_id, team_id)
);

create table if not exists public.league_team_sheet_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_sheet_id uuid not null references public.league_team_sheets(id) on delete cascade,
  player_id uuid not null references public.league_players(id) on delete restrict,
  registration_id uuid references public.league_player_registrations(id) on delete restrict,
  squad_role text not null default 'starter' check (squad_role in ('starter','substitute','goalkeeper','non_playing')),
  shirt_number integer check (shirt_number is null or shirt_number between 0 and 999),
  eligibility_status text not null default 'not_checked' check (eligibility_status in ('not_checked','eligible','warning','ineligible')),
  eligibility_reasons jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_sheet_id, player_id)
);

create index if not exists league_players_name_dob_idx on public.league_players(league_id,lower(last_name),lower(first_name),date_of_birth);
create index if not exists league_player_registrations_queue_idx on public.league_player_registrations(league_id,status,season_id,parent_club_id,updated_at desc);
create index if not exists league_player_registrations_player_idx on public.league_player_registrations(league_id,player_id,season_id,status);
create index if not exists league_registration_documents_registration_idx on public.league_registration_documents(league_id,registration_id,created_at desc);
create index if not exists league_transfer_requests_queue_idx on public.league_transfer_requests(league_id,status,season_id,updated_at desc);
create index if not exists league_eligibility_rules_scope_idx on public.league_eligibility_rules(league_id,season_id,division_id,competition_type,active);
create index if not exists league_eligibility_dispensations_queue_idx on public.league_eligibility_dispensations(league_id,status,season_id,player_id,updated_at desc);
create index if not exists league_team_sheets_fixture_idx on public.league_team_sheets(league_id,publication_fixture_id,status);
create index if not exists league_team_sheet_players_player_idx on public.league_team_sheet_players(league_id,player_id,team_sheet_id);

alter table public.league_players enable row level security;
alter table public.league_players force row level security;
alter table public.league_player_registrations enable row level security;
alter table public.league_player_registrations force row level security;
alter table public.league_registration_documents enable row level security;
alter table public.league_registration_documents force row level security;
alter table public.league_transfer_requests enable row level security;
alter table public.league_transfer_requests force row level security;
alter table public.league_eligibility_rules enable row level security;
alter table public.league_eligibility_rules force row level security;
alter table public.league_eligibility_dispensations enable row level security;
alter table public.league_eligibility_dispensations force row level security;
alter table public.league_team_sheets enable row level security;
alter table public.league_team_sheets force row level security;
alter table public.league_team_sheet_players enable row level security;
alter table public.league_team_sheet_players force row level security;

revoke all on table public.league_players, public.league_player_registrations, public.league_registration_documents,
  public.league_transfer_requests, public.league_eligibility_rules, public.league_eligibility_dispensations,
  public.league_team_sheets, public.league_team_sheet_players from anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'league_players','league_player_registrations','league_transfer_requests','league_eligibility_rules',
    'league_eligibility_dispensations','league_team_sheets','league_team_sheet_players'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = table_name || '_touch_updated_at') then
      execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', table_name || '_touch_updated_at', table_name);
    end if;
  end loop;
end;
$$;

create or replace function public.can_view_league_registrations(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and (
    private.is_platform_admin(auth.uid()) or exists (
      select 1
      from public.league_memberships membership
      join public.leagues league on league.id = membership.league_id
      where membership.league_id = target_league_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any(array['owner','admin','registrations'])
        and league.status = 'active'
    )
  );
$$;

create or replace function public.can_manage_league_registrations(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.can_view_league_registrations(target_league_id);
$$;

create or replace function public.create_league_invitation(
  target_league_id uuid,
  invite_email text,
  invite_role text default 'viewer',
  expiry_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_email text := lower(trim(coalesce(invite_email,'')));
  safe_role text := lower(trim(coalesce(invite_role,'viewer')));
  raw_token text := encode(gen_random_bytes(32),'hex');
  invitation_id uuid;
  invitation_expiry timestamptz;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if position('@' in safe_email) <= 1 then raise exception 'A valid email address is required' using errcode='22023'; end if;
  if safe_role not in ('admin','fixtures','officials','results','discipline','registrations','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  update public.league_invitations invitation_value
    set status='revoked',revoked_at=now(),updated_at=now()
    where invitation_value.league_id=target_league_id and lower(invitation_value.email)=safe_email and invitation_value.status='pending';
  invitation_expiry := now() + make_interval(hours => greatest(1,least(coalesce(expiry_hours,168),720)));
  insert into public.league_invitations(league_id,email,role,token_hash,status,invited_by,expires_at)
    values(target_league_id,safe_email,safe_role,encode(digest(raw_token,'sha256'),'hex'),'pending',actor_id,invitation_expiry)
    returning id into invitation_id;
  perform private.write_league_audit(target_league_id,'league.invitation_created','invitation',invitation_id,jsonb_build_object('email',safe_email,'role',safe_role));
  return jsonb_build_object('id',invitation_id,'token',raw_token,'email',safe_email,'role',safe_role,'expires_at',invitation_expiry);
end;
$$;

create or replace function public.update_league_member_role(target_league_id uuid,target_user_id uuid,next_role text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_role text := lower(trim(coalesce(next_role,'')));
  target_current_role text;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if safe_role not in ('admin','fixtures','officials','results','discipline','registrations','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  select membership.role into target_current_role
  from public.league_memberships membership
  where membership.league_id=target_league_id and membership.user_id=target_user_id and membership.status='active';
  if target_current_role is null then raise exception 'League member not found' using errcode='P0002'; end if;
  if target_current_role='owner' then raise exception 'The league owner role cannot be changed here' using errcode='42501'; end if;
  update public.league_memberships membership set role=safe_role,updated_at=now()
    where membership.league_id=target_league_id and membership.user_id=target_user_id;
  perform private.write_league_audit(target_league_id,'league.member_role_changed','member',target_user_id,jsonb_build_object('role',safe_role));
end;
$$;

create or replace function private.league_registration_fixture_snapshot(target_fixture_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(fixture.snapshot,'{}'::jsonb)
  from public.league_publication_fixtures fixture
  join public.league_publications publication on publication.id=fixture.publication_id
  where fixture.id=target_fixture_id and publication.status='published';
$$;

create or replace function private.registration_fixture_team_id(snapshot jsonb, side text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare raw_value text;
begin
  raw_value := coalesce(snapshot->>(side || '_team_id'), snapshot->>(side || 'TeamId'));
  if raw_value is null or trim(raw_value)='' then return null; end if;
  return raw_value::uuid;
exception when invalid_text_representation then return null;
end;
$$;

create or replace function private.registration_fixture_date(snapshot jsonb)
returns date
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare raw_value text;
begin
  raw_value := coalesce(snapshot->>'scheduled_date',snapshot->>'scheduledDate',snapshot->>'date');
  if raw_value is null or trim(raw_value)='' then return null; end if;
  return left(raw_value,10)::date;
exception when invalid_datetime_format then return null;
end;
$$;

create or replace function private.registration_fixture_scope(snapshot jsonb, key_name text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(snapshot->>key_name,
    case key_name
      when 'season_id' then snapshot->>'seasonId'
      when 'division_id' then snapshot->>'divisionId'
      when 'competition_type' then snapshot->>'competitionType'
      when 'competition_id' then snapshot->>'competitionId'
      else null
    end,
  '');
$$;

create or replace function private.player_has_approved_dispensation(
  target_league_id uuid,
  target_player_id uuid,
  target_team_id uuid,
  target_rule_type text,
  target_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists(
    select 1 from public.league_eligibility_dispensations dispensation
    where dispensation.league_id=target_league_id
      and dispensation.player_id=target_player_id
      and (dispensation.team_id is null or dispensation.team_id=target_team_id)
      and dispensation.status='approved'
      and dispensation.rule_type in ('all',target_rule_type)
      and (dispensation.starts_on is null or dispensation.starts_on<=target_date)
      and (dispensation.ends_on is null or dispensation.ends_on>=target_date)
  );
$$;

create or replace function private.evaluate_league_player_eligibility(
  target_league_id uuid,
  target_fixture_id uuid,
  target_team_id uuid,
  target_player_id uuid,
  target_registration_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  fixture_snapshot jsonb := private.league_registration_fixture_snapshot(target_fixture_id);
  fixture_date date;
  fixture_season_id uuid;
  fixture_division_id uuid;
  fixture_competition_type text;
  fixture_competition_id text;
  registration_row public.league_player_registrations%rowtype;
  player_row public.league_players%rowtype;
  rule_row public.league_eligibility_rules%rowtype;
  reasons jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  age_years integer;
  deadline date;
  has_other_cup_appearance boolean;
  active_suspension boolean;
begin
  if fixture_snapshot is null or fixture_snapshot='{}'::jsonb then
    return jsonb_build_object('status','ineligible','reasons',jsonb_build_array(jsonb_build_object('code','FIXTURE_NOT_FOUND','label','Published fixture not found')),'warnings','[]'::jsonb);
  end if;
  fixture_date := coalesce(private.registration_fixture_date(fixture_snapshot),current_date);
  begin fixture_season_id := nullif(private.registration_fixture_scope(fixture_snapshot,'season_id'),'')::uuid; exception when invalid_text_representation then fixture_season_id := null; end;
  begin fixture_division_id := nullif(private.registration_fixture_scope(fixture_snapshot,'division_id'),'')::uuid; exception when invalid_text_representation then fixture_division_id := null; end;
  fixture_competition_type := lower(coalesce(nullif(private.registration_fixture_scope(fixture_snapshot,'competition_type'),''),'league'));
  fixture_competition_id := private.registration_fixture_scope(fixture_snapshot,'competition_id');

  select registration.* into registration_row
  from public.league_player_registrations registration
  where registration.id=target_registration_id and registration.league_id=target_league_id and registration.player_id=target_player_id;
  select player.* into player_row from public.league_players player where player.id=target_player_id and player.league_id=target_league_id;

  if player_row.id is null then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code','PLAYER_MISSING','label','Player record is missing'));
  end if;
  if registration_row.id is null then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code','REGISTRATION_MISSING','label','No registration exists for this player'));
  else
    if registration_row.status<>'approved' then reasons := reasons || jsonb_build_array(jsonb_build_object('code','REGISTRATION_NOT_APPROVED','label','Registration is not approved')); end if;
    if registration_row.team_id is not null and registration_row.team_id<>target_team_id then reasons := reasons || jsonb_build_array(jsonb_build_object('code','WRONG_TEAM','label','Registration belongs to a different team')); end if;
    if registration_row.effective_from is not null and registration_row.effective_from>fixture_date then reasons := reasons || jsonb_build_array(jsonb_build_object('code','REGISTRATION_NOT_STARTED','label','Registration is not effective on the fixture date')); end if;
    if registration_row.effective_to is not null and registration_row.effective_to<fixture_date then reasons := reasons || jsonb_build_array(jsonb_build_object('code','REGISTRATION_EXPIRED','label','Registration expired before the fixture')); end if;
  end if;

  select exists(
    select 1 from public.league_case_sanctions sanction
    where sanction.league_id=target_league_id and sanction.subject_type='person' and sanction.subject_id=target_player_id
      and sanction.status in ('active','unpaid','appealed')
      and (sanction.starts_on is null or sanction.starts_on<=fixture_date)
      and (sanction.ends_on is null or sanction.ends_on>=fixture_date)
      and (sanction.match_count=0 or sanction.matches_served<sanction.match_count)
  ) into active_suspension;
  if active_suspension and not private.player_has_approved_dispensation(target_league_id,target_player_id,target_team_id,'suspension',fixture_date) then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code','ACTIVE_SUSPENSION','label','Player has an active suspension'));
  end if;

  if player_row.date_of_birth is not null then
    age_years := extract(year from age(fixture_date,player_row.date_of_birth));
  end if;

  for rule_row in
    select rule.* from public.league_eligibility_rules rule
    where rule.league_id=target_league_id and rule.active
      and (rule.season_id is null or fixture_season_id is null or rule.season_id=fixture_season_id)
      and (rule.division_id is null or fixture_division_id is null or rule.division_id=fixture_division_id)
      and (rule.competition_type='all' or rule.competition_type=fixture_competition_type)
      and (rule.competition_id is null or rule.competition_id::text=fixture_competition_id)
    order by rule.created_at
  loop
    if private.player_has_approved_dispensation(target_league_id,target_player_id,target_team_id,rule_row.rule_type,fixture_date) then continue; end if;
    if rule_row.rule_type='minimum_age' and age_years is not null and coalesce((rule_row.config->>'age')::integer,0)>age_years then
      if rule_row.severity='warn' then warnings := warnings || jsonb_build_array(jsonb_build_object('code','RULE_MINIMUM_AGE','label',rule_row.name)); else reasons := reasons || jsonb_build_array(jsonb_build_object('code','RULE_MINIMUM_AGE','label',rule_row.name)); end if;
    elsif rule_row.rule_type='maximum_age' and age_years is not null and age_years>coalesce((rule_row.config->>'age')::integer,999) then
      if rule_row.severity='warn' then warnings := warnings || jsonb_build_array(jsonb_build_object('code','RULE_MAXIMUM_AGE','label',rule_row.name)); else reasons := reasons || jsonb_build_array(jsonb_build_object('code','RULE_MAXIMUM_AGE','label',rule_row.name)); end if;
    elsif rule_row.rule_type='registration_deadline' and nullif(rule_row.config->>'deadline','') is not null then
      begin deadline := (rule_row.config->>'deadline')::date; exception when invalid_datetime_format then deadline := null; end;
      if deadline is not null and registration_row.submitted_at::date>deadline then
        if rule_row.severity='warn' then warnings := warnings || jsonb_build_array(jsonb_build_object('code','RULE_REGISTRATION_DEADLINE','label',rule_row.name)); else reasons := reasons || jsonb_build_array(jsonb_build_object('code','RULE_REGISTRATION_DEADLINE','label',rule_row.name)); end if;
      end if;
    elsif rule_row.rule_type='transfer_clearance' and exists(
      select 1 from public.league_transfer_requests transfer
      where transfer.league_id=target_league_id and transfer.player_id=target_player_id and transfer.status in ('submitted','under_review')
    ) then
      if rule_row.severity='warn' then warnings := warnings || jsonb_build_array(jsonb_build_object('code','RULE_TRANSFER_CLEARANCE','label',rule_row.name)); else reasons := reasons || jsonb_build_array(jsonb_build_object('code','RULE_TRANSFER_CLEARANCE','label',rule_row.name)); end if;
    elsif rule_row.rule_type='cup_tied' and fixture_competition_type='cup' then
      select exists(
        select 1
        from public.league_team_sheet_players sheet_player
        join public.league_team_sheets sheet on sheet.id=sheet_player.team_sheet_id
        join public.league_publication_fixtures prior_fixture on prior_fixture.id=sheet.publication_fixture_id
        where sheet.league_id=target_league_id and sheet_player.player_id=target_player_id
          and sheet.team_id<>target_team_id and sheet.status in ('submitted','verified')
          and private.registration_fixture_scope(prior_fixture.snapshot,'competition_type')='cup'
          and private.registration_fixture_scope(prior_fixture.snapshot,'competition_id')=fixture_competition_id
      ) into has_other_cup_appearance;
      if has_other_cup_appearance then
        if rule_row.severity='warn' then warnings := warnings || jsonb_build_array(jsonb_build_object('code','RULE_CUP_TIED','label',rule_row.name)); else reasons := reasons || jsonb_build_array(jsonb_build_object('code','RULE_CUP_TIED','label',rule_row.name)); end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status',case when jsonb_array_length(reasons)>0 then 'ineligible' when jsonb_array_length(warnings)>0 then 'warning' else 'eligible' end,
    'reasons',reasons,
    'warnings',warnings,
    'checked_on',fixture_date
  );
end;
$$;

create or replace function public.get_league_registration_data(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_role text := private.current_league_role(target_league_id,auth.uid());
begin
  if not public.can_view_league_registrations(target_league_id) then raise exception 'League registration access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',public.can_manage_league_registrations(target_league_id),'can_submit',true,'is_club_portal',false),
    'players',coalesce((
      select jsonb_agg(to_jsonb(player) || jsonb_build_object('display_name',trim(player.first_name || ' ' || player.last_name)) order by lower(player.last_name),lower(player.first_name),player.date_of_birth)
      from public.league_players player where player.league_id=target_league_id
    ),'[]'::jsonb),
    'registrations',coalesce((
      select jsonb_agg(to_jsonb(registration) || jsonb_build_object(
        'player_name',trim(player.first_name || ' ' || player.last_name),
        'club_name',club.name,
        'team_name',team.name,
        'season_name',season.name
      ) order by case registration.status when 'correction_required' then 0 when 'submitted' then 1 when 'under_review' then 2 when 'approved' then 3 else 4 end,registration.updated_at desc)
      from public.league_player_registrations registration
      join public.league_players player on player.id=registration.player_id
      join public.league_parent_clubs club on club.id=registration.parent_club_id
      left join public.league_teams team on team.id=registration.team_id
      join public.league_seasons season on season.id=registration.season_id
      where registration.league_id=target_league_id
    ),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(document) order by document.created_at desc) from public.league_registration_documents document where document.league_id=target_league_id),'[]'::jsonb),
    'transfers',coalesce((
      select jsonb_agg(to_jsonb(transfer) || jsonb_build_object(
        'player_name',trim(player.first_name || ' ' || player.last_name),
        'from_club_name',from_club.name,
        'to_club_name',to_club.name,
        'to_team_name',to_team.name
      ) order by case transfer.status when 'submitted' then 0 when 'under_review' then 1 else 2 end,transfer.updated_at desc)
      from public.league_transfer_requests transfer
      join public.league_players player on player.id=transfer.player_id
      left join public.league_parent_clubs from_club on from_club.id=transfer.from_club_id
      join public.league_parent_clubs to_club on to_club.id=transfer.to_club_id
      left join public.league_teams to_team on to_team.id=transfer.to_team_id
      where transfer.league_id=target_league_id
    ),'[]'::jsonb),
    'rules',coalesce((select jsonb_agg(to_jsonb(rule) order by rule.active desc,rule.created_at desc) from public.league_eligibility_rules rule where rule.league_id=target_league_id),'[]'::jsonb),
    'dispensations',coalesce((
      select jsonb_agg(to_jsonb(dispensation) || jsonb_build_object('player_name',trim(player.first_name || ' ' || player.last_name),'team_name',team.name) order by case dispensation.status when 'submitted' then 0 when 'under_review' then 1 else 2 end,dispensation.updated_at desc)
      from public.league_eligibility_dispensations dispensation
      join public.league_players player on player.id=dispensation.player_id
      left join public.league_teams team on team.id=dispensation.team_id
      where dispensation.league_id=target_league_id
    ),'[]'::jsonb),
    'team_sheets',coalesce((
      select jsonb_agg(to_jsonb(sheet) || jsonb_build_object(
        'team_name',team.name,
        'fixture_label',coalesce(fixture.snapshot->>'fixture_label',fixture.snapshot->>'fixtureLabel',coalesce(fixture.snapshot->>'home_team_name',fixture.snapshot->>'homeTeamName','Home') || ' v ' || coalesce(fixture.snapshot->>'away_team_name',fixture.snapshot->>'awayTeamName','Away')),
        'scheduled_date',private.registration_fixture_date(fixture.snapshot)
      ) order by sheet.updated_at desc)
      from public.league_team_sheets sheet
      join public.league_teams team on team.id=sheet.team_id
      join public.league_publication_fixtures fixture on fixture.id=sheet.publication_fixture_id
      where sheet.league_id=target_league_id
    ),'[]'::jsonb),
    'team_sheet_players',coalesce((
      select jsonb_agg(to_jsonb(sheet_player) || jsonb_build_object('player_name',trim(player.first_name || ' ' || player.last_name)) order by sheet_player.team_sheet_id,sheet_player.shirt_number nulls last,player.last_name)
      from public.league_team_sheet_players sheet_player
      join public.league_players player on player.id=sheet_player.player_id
      where sheet_player.league_id=target_league_id
    ),'[]'::jsonb),
    'fixtures',coalesce((
      select jsonb_agg(to_jsonb(fixture) order by private.registration_fixture_date(fixture.snapshot),fixture.created_at)
      from public.league_publication_fixtures fixture
      join public.league_publications publication on publication.id=fixture.publication_id
      where fixture.league_id=target_league_id and publication.status='published'
    ),'[]'::jsonb),
    'sanctions',coalesce((
      select jsonb_agg(to_jsonb(sanction)) from public.league_case_sanctions sanction
      where sanction.league_id=target_league_id and sanction.subject_type='person' and sanction.status in ('active','unpaid','appealed')
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_league_club_registration_data(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  actor_role text := private.current_league_role(target_league_id,actor_id);
begin
  if club_id is null then raise exception 'Club portal access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',false,'can_submit',actor_role in ('club_secretary','team_contact'),'is_club_portal',true,'club_id',club_id),
    'club',(select to_jsonb(club) from public.league_parent_clubs club where club.id=club_id and club.league_id=target_league_id),
    'teams',coalesce((select jsonb_agg(to_jsonb(team) order by team.name) from public.league_teams team where team.league_id=target_league_id and team.parent_club_id=club_id),'[]'::jsonb),
    'seasons',coalesce((select jsonb_agg(to_jsonb(season) order by season.starts_on desc) from public.league_seasons season where season.league_id=target_league_id),'[]'::jsonb),
    'players',coalesce((
      select jsonb_agg(to_jsonb(player) || jsonb_build_object('display_name',trim(player.first_name || ' ' || player.last_name)) order by lower(player.last_name),lower(player.first_name))
      from public.league_players player
      where player.league_id=target_league_id and exists(
        select 1 from public.league_player_registrations registration
        where registration.player_id=player.id and registration.league_id=target_league_id and registration.parent_club_id=club_id
      )
    ),'[]'::jsonb),
    'registrations',coalesce((
      select jsonb_agg(to_jsonb(registration) || jsonb_build_object(
        'player_name',trim(player.first_name || ' ' || player.last_name),
        'club_name',club.name,
        'team_name',team.name,
        'season_name',season.name
      ) order by registration.updated_at desc)
      from public.league_player_registrations registration
      join public.league_players player on player.id=registration.player_id
      join public.league_parent_clubs club on club.id=registration.parent_club_id
      left join public.league_teams team on team.id=registration.team_id
      join public.league_seasons season on season.id=registration.season_id
      where registration.league_id=target_league_id and registration.parent_club_id=club_id
    ),'[]'::jsonb),
    'documents',coalesce((
      select jsonb_agg(to_jsonb(document) order by document.created_at desc)
      from public.league_registration_documents document
      join public.league_player_registrations registration on registration.id=document.registration_id
      where document.league_id=target_league_id and registration.parent_club_id=club_id and document.visibility='club'
    ),'[]'::jsonb),
    'transfers',coalesce((
      select jsonb_agg(to_jsonb(transfer) || jsonb_build_object(
        'player_name',trim(player.first_name || ' ' || player.last_name),
        'from_club_name',from_club.name,
        'to_club_name',to_club.name,
        'to_team_name',to_team.name
      ) order by transfer.updated_at desc)
      from public.league_transfer_requests transfer
      join public.league_players player on player.id=transfer.player_id
      left join public.league_parent_clubs from_club on from_club.id=transfer.from_club_id
      join public.league_parent_clubs to_club on to_club.id=transfer.to_club_id
      left join public.league_teams to_team on to_team.id=transfer.to_team_id
      where transfer.league_id=target_league_id and club_id in (transfer.from_club_id,transfer.to_club_id)
    ),'[]'::jsonb),
    'rules',coalesce((select jsonb_agg(to_jsonb(rule) order by rule.active desc,rule.created_at desc) from public.league_eligibility_rules rule where rule.league_id=target_league_id and rule.active),'[]'::jsonb),
    'dispensations',coalesce((
      select jsonb_agg(to_jsonb(dispensation) || jsonb_build_object('player_name',trim(player.first_name || ' ' || player.last_name),'team_name',team.name) order by dispensation.updated_at desc)
      from public.league_eligibility_dispensations dispensation
      join public.league_players player on player.id=dispensation.player_id
      left join public.league_teams team on team.id=dispensation.team_id
      where dispensation.league_id=target_league_id and (dispensation.team_id is null or exists(select 1 from public.league_teams own_team where own_team.id=dispensation.team_id and own_team.parent_club_id=club_id))
        and exists(select 1 from public.league_player_registrations own_registration where own_registration.player_id=dispensation.player_id and own_registration.parent_club_id=club_id)
    ),'[]'::jsonb),
    'team_sheets',coalesce((
      select jsonb_agg(to_jsonb(sheet) || jsonb_build_object(
        'team_name',team.name,
        'fixture_label',coalesce(fixture.snapshot->>'fixture_label',fixture.snapshot->>'fixtureLabel',coalesce(fixture.snapshot->>'home_team_name',fixture.snapshot->>'homeTeamName','Home') || ' v ' || coalesce(fixture.snapshot->>'away_team_name',fixture.snapshot->>'awayTeamName','Away')),
        'scheduled_date',private.registration_fixture_date(fixture.snapshot)
      ) order by sheet.updated_at desc)
      from public.league_team_sheets sheet
      join public.league_teams team on team.id=sheet.team_id
      join public.league_publication_fixtures fixture on fixture.id=sheet.publication_fixture_id
      where sheet.league_id=target_league_id and sheet.parent_club_id=club_id
    ),'[]'::jsonb),
    'team_sheet_players',coalesce((
      select jsonb_agg(to_jsonb(sheet_player) || jsonb_build_object('player_name',trim(player.first_name || ' ' || player.last_name)) order by sheet_player.team_sheet_id,sheet_player.shirt_number nulls last)
      from public.league_team_sheet_players sheet_player
      join public.league_team_sheets sheet on sheet.id=sheet_player.team_sheet_id
      join public.league_players player on player.id=sheet_player.player_id
      where sheet_player.league_id=target_league_id and sheet.parent_club_id=club_id
    ),'[]'::jsonb),
    'fixtures',coalesce((
      select jsonb_agg(to_jsonb(fixture) order by private.registration_fixture_date(fixture.snapshot),fixture.created_at)
      from public.league_publication_fixtures fixture
      join public.league_publications publication on publication.id=fixture.publication_id
      where fixture.league_id=target_league_id and publication.status='published' and club_id=any(fixture.parent_club_ids)
    ),'[]'::jsonb),
    'sanctions',coalesce((
      select jsonb_agg(to_jsonb(sanction))
      from public.league_case_sanctions sanction
      where sanction.league_id=target_league_id and sanction.subject_type='person' and sanction.status in ('active','unpaid','appealed')
        and exists(select 1 from public.league_player_registrations registration where registration.player_id=sanction.subject_id and registration.parent_club_id=club_id)
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_league_player_registration(target_league_id uuid,registration_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := private.current_league_role(target_league_id,actor_id);
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  requested_club_id uuid;
  target_club_id uuid;
  target_team_id uuid;
  target_season_id uuid;
  target_player_id uuid;
  registration_id uuid;
  safe_first_name text := trim(coalesce(registration_data->>'first_name',registration_data->>'firstName',''));
  safe_last_name text := trim(coalesce(registration_data->>'last_name',registration_data->>'lastName',''));
  safe_external_ref text := nullif(trim(coalesce(registration_data->>'external_ref',registration_data->>'externalRef','')),'');
  safe_registration_type text := lower(trim(coalesce(registration_data->>'registration_type',registration_data->>'registrationType','new')));
  safe_submission_notes text := trim(coalesce(registration_data->>'submission_notes',registration_data->>'submissionNotes',''));
  safe_dob date;
  safe_from date;
  safe_to date;
  is_staff boolean := public.can_manage_league_registrations(target_league_id);
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not is_staff and (club_id is null or actor_role='club_viewer') then raise exception 'Registration submission access required' using errcode='42501'; end if;
  begin target_season_id := coalesce(nullif(registration_data->>'season_id',''),nullif(registration_data->>'seasonId',''))::uuid; exception when invalid_text_representation then target_season_id := null; end;
  begin target_team_id := coalesce(nullif(registration_data->>'team_id',''),nullif(registration_data->>'teamId',''))::uuid; exception when invalid_text_representation then target_team_id := null; end;
  begin requested_club_id := coalesce(nullif(registration_data->>'parent_club_id',''),nullif(registration_data->>'parentClubId',''))::uuid; exception when invalid_text_representation then requested_club_id := null; end;
  target_club_id := case when club_id is not null then club_id else requested_club_id end;
  begin target_player_id := coalesce(nullif(registration_data->>'player_id',''),nullif(registration_data->>'playerId',''))::uuid; exception when invalid_text_representation then target_player_id := null; end;
  begin safe_dob := coalesce(nullif(registration_data->>'date_of_birth',''),nullif(registration_data->>'dateOfBirth',''))::date; exception when invalid_datetime_format then safe_dob := null; end;
  begin safe_from := coalesce(nullif(registration_data->>'effective_from',''),nullif(registration_data->>'effectiveFrom',''))::date; exception when invalid_datetime_format then safe_from := null; end;
  begin safe_to := coalesce(nullif(registration_data->>'effective_to',''),nullif(registration_data->>'effectiveTo',''))::date; exception when invalid_datetime_format then safe_to := null; end;
  if target_season_id is null or target_team_id is null or target_club_id is null then raise exception 'Season, club and team are required' using errcode='22023'; end if;
  if not exists(select 1 from public.league_seasons season where season.id=target_season_id and season.league_id=target_league_id) then raise exception 'Season is outside this league' using errcode='42501'; end if;
  if not exists(select 1 from public.league_teams team where team.id=target_team_id and team.league_id=target_league_id and team.parent_club_id=target_club_id) then raise exception 'Team is outside the selected club' using errcode='42501'; end if;
  if safe_registration_type not in ('new','renewal','transfer','dual','loan') then safe_registration_type := 'new'; end if;

  if target_player_id is not null then
    if not exists(select 1 from public.league_players player where player.id=target_player_id and player.league_id=target_league_id) then raise exception 'Player is outside this league' using errcode='42501'; end if;
  else
    if length(safe_first_name)<1 or length(safe_last_name)<1 or safe_dob is null then raise exception 'Player name and date of birth are required' using errcode='22023'; end if;
    if safe_external_ref is not null then select player.id into target_player_id from public.league_players player where player.league_id=target_league_id and player.external_ref=safe_external_ref limit 1; end if;
    if target_player_id is null then
      select player.id into target_player_id from public.league_players player
      where player.league_id=target_league_id and lower(trim(player.first_name))=lower(safe_first_name) and lower(trim(player.last_name))=lower(safe_last_name) and player.date_of_birth=safe_dob
      order by player.created_at limit 1;
    end if;
    if target_player_id is null then
      insert into public.league_players(league_id,first_name,last_name,date_of_birth,external_ref,status,created_by,updated_by)
        values(target_league_id,safe_first_name,safe_last_name,safe_dob,safe_external_ref,'active',actor_id,actor_id)
        returning id into target_player_id;
    end if;
  end if;

  insert into public.league_player_registrations(league_id,season_id,player_id,parent_club_id,team_id,registration_type,status,submission_notes,correction_notes,decision_notes,effective_from,effective_to,submitted_by,submitted_at,created_by,updated_by)
    values(target_league_id,target_season_id,target_player_id,target_club_id,target_team_id,safe_registration_type,'submitted',safe_submission_notes,'','',safe_from,safe_to,actor_id,now(),actor_id,actor_id)
  on conflict (league_id,season_id,player_id,team_id) do update set
    parent_club_id=excluded.parent_club_id,
    registration_type=excluded.registration_type,
    status='submitted',
    submission_notes=excluded.submission_notes,
    correction_notes='',
    decision_notes='',
    effective_from=excluded.effective_from,
    effective_to=excluded.effective_to,
    submitted_by=actor_id,
    submitted_at=now(),
    reviewed_by=null,
    reviewed_at=null,
    updated_by=actor_id,
    updated_at=now()
  returning id into registration_id;

  perform private.write_league_audit(target_league_id,'league.registration_submitted','player_registration',registration_id,jsonb_build_object('player_id',target_player_id,'club_id',target_club_id,'team_id',target_team_id,'registration_type',safe_registration_type));
  return jsonb_build_object('registration_id',registration_id,'player_id',target_player_id,'status','submitted');
end;
$$;

create or replace function public.review_league_player_registration(target_league_id uuid,target_registration_id uuid,next_status text,review_notes text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_status text := lower(trim(coalesce(next_status,'')));
  safe_notes text := trim(coalesce(review_notes,''));
  player_id uuid;
begin
  if not public.can_manage_league_registrations(target_league_id) then raise exception 'Registration officer access required' using errcode='42501'; end if;
  if safe_status not in ('under_review','correction_required','approved','rejected','withdrawn','expired') then raise exception 'Invalid registration decision' using errcode='22023'; end if;
  if safe_status in ('correction_required','rejected') and length(safe_notes)<3 then raise exception 'Decision notes are required' using errcode='22023'; end if;
  select registration.player_id into player_id from public.league_player_registrations registration where registration.id=target_registration_id and registration.league_id=target_league_id;
  if player_id is null then raise exception 'Registration not found' using errcode='P0002'; end if;
  update public.league_player_registrations registration set
    status=safe_status,
    correction_notes=case when safe_status='correction_required' then safe_notes else '' end,
    decision_notes=case when safe_status<>'correction_required' then safe_notes else registration.decision_notes end,
    reviewed_by=actor_id,
    reviewed_at=now(),
    updated_by=actor_id,
    updated_at=now()
  where registration.id=target_registration_id and registration.league_id=target_league_id;
  perform private.write_league_audit(target_league_id,'league.registration_reviewed','player_registration',target_registration_id,jsonb_build_object('player_id',player_id,'status',safe_status,'notes',safe_notes));
end;
$$;

create or replace function public.resubmit_league_player_registration(target_league_id uuid,target_registration_id uuid,resubmission_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  actor_role text := private.current_league_role(target_league_id,actor_id);
  safe_note text := trim(coalesce(resubmission_note,''));
begin
  if club_id is null or actor_role='club_viewer' then raise exception 'Club registration submission access required' using errcode='42501'; end if;
  if length(safe_note)<3 then raise exception 'Add a correction note' using errcode='22023'; end if;
  update public.league_player_registrations registration set
    status='submitted',
    submission_notes=case when registration.submission_notes='' then safe_note else registration.submission_notes || E'\n' || safe_note end,
    correction_notes='',
    submitted_by=actor_id,
    submitted_at=now(),
    reviewed_by=null,
    reviewed_at=null,
    updated_by=actor_id,
    updated_at=now()
  where registration.id=target_registration_id and registration.league_id=target_league_id and registration.parent_club_id=club_id and registration.status='correction_required';
  if not found then raise exception 'Correctable registration not found for this club' using errcode='P0002'; end if;
  perform private.write_league_audit(target_league_id,'league.registration_resubmitted','player_registration',target_registration_id,jsonb_build_object('club_id',club_id));
end;
$$;

create or replace function public.add_league_registration_document(target_league_id uuid,target_registration_id uuid,document_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  actor_role text := private.current_league_role(target_league_id,actor_id);
  document_id uuid := gen_random_uuid();
  registration_club_id uuid;
  safe_type text := lower(trim(coalesce(document_data->>'document_type',document_data->>'documentType','evidence')));
  safe_title text := trim(coalesce(document_data->>'title','Evidence'));
  safe_url text := trim(coalesce(document_data->>'document_url',document_data->>'documentUrl',''));
  safe_visibility text := lower(trim(coalesce(document_data->>'visibility','league')));
begin
  select registration.parent_club_id into registration_club_id from public.league_player_registrations registration where registration.id=target_registration_id and registration.league_id=target_league_id;
  if registration_club_id is null then raise exception 'Registration not found' using errcode='P0002'; end if;
  if not public.can_manage_league_registrations(target_league_id) and (club_id is null or club_id<>registration_club_id or actor_role='club_viewer') then raise exception 'Registration document access required' using errcode='42501'; end if;
  if safe_type not in ('identity','age','consent','clearance','dispensation','evidence','other') then safe_type:='evidence'; end if;
  if safe_visibility not in ('league','club') then safe_visibility:='league'; end if;
  if length(safe_title)<2 or safe_url !~* '^https?://' then raise exception 'Document title and HTTP or HTTPS link are required' using errcode='22023'; end if;
  insert into public.league_registration_documents(id,league_id,registration_id,document_type,title,document_url,visibility,notes,created_by)
    values(document_id,target_league_id,target_registration_id,safe_type,safe_title,safe_url,safe_visibility,nullif(trim(coalesce(document_data->>'notes','')),''),actor_id);
  perform private.write_league_audit(target_league_id,'league.registration_document_added','player_registration',target_registration_id,jsonb_build_object('document_id',document_id,'document_type',safe_type));
  return document_id;
end;
$$;

create or replace function public.submit_league_transfer_request(target_league_id uuid,transfer_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := private.current_league_role(target_league_id,actor_id);
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  is_staff boolean := public.can_manage_league_registrations(target_league_id);
  target_player_id uuid;
  target_season_id uuid;
  target_to_club_id uuid;
  target_to_team_id uuid;
  current_club_id uuid;
  request_id uuid := gen_random_uuid();
  safe_reason text := trim(coalesce(transfer_data->>'reason',''));
  safe_effective_on date;
begin
  if not is_staff and (club_id is null or actor_role='club_viewer') then raise exception 'Transfer request access required' using errcode='42501'; end if;
  begin target_player_id := coalesce(nullif(transfer_data->>'player_id',''),nullif(transfer_data->>'playerId',''))::uuid; exception when invalid_text_representation then target_player_id:=null; end;
  begin target_season_id := coalesce(nullif(transfer_data->>'season_id',''),nullif(transfer_data->>'seasonId',''))::uuid; exception when invalid_text_representation then target_season_id:=null; end;
  begin target_to_club_id := coalesce(nullif(transfer_data->>'to_club_id',''),nullif(transfer_data->>'toClubId',''))::uuid; exception when invalid_text_representation then target_to_club_id:=null; end;
  begin target_to_team_id := coalesce(nullif(transfer_data->>'to_team_id',''),nullif(transfer_data->>'toTeamId',''))::uuid; exception when invalid_text_representation then target_to_team_id:=null; end;
  begin safe_effective_on := coalesce(nullif(transfer_data->>'effective_on',''),nullif(transfer_data->>'effectiveOn',''))::date; exception when invalid_datetime_format then safe_effective_on:=null; end;
  if club_id is not null then target_to_club_id:=club_id; end if;
  if target_player_id is null or target_season_id is null or target_to_club_id is null or target_to_team_id is null then raise exception 'Player, season, destination club and team are required' using errcode='22023'; end if;
  if not exists(select 1 from public.league_teams team where team.id=target_to_team_id and team.league_id=target_league_id and team.parent_club_id=target_to_club_id) then raise exception 'Destination team is outside the selected club' using errcode='42501'; end if;
  select registration.parent_club_id into current_club_id from public.league_player_registrations registration
    where registration.league_id=target_league_id and registration.player_id=target_player_id and registration.season_id=target_season_id and registration.status='approved'
    order by registration.updated_at desc limit 1;
  if not is_staff and current_club_id is distinct from club_id and not exists(select 1 from public.league_player_registrations own_registration where own_registration.league_id=target_league_id and own_registration.player_id=target_player_id and own_registration.parent_club_id=club_id) then raise exception 'Player is outside this club access' using errcode='42501'; end if;
  if exists(select 1 from public.league_transfer_requests transfer where transfer.league_id=target_league_id and transfer.player_id=target_player_id and transfer.season_id=target_season_id and transfer.status in ('submitted','under_review')) then raise exception 'An open transfer request already exists' using errcode='23505'; end if;
  insert into public.league_transfer_requests(id,league_id,season_id,player_id,from_club_id,to_club_id,to_team_id,status,requested_on,effective_on,reason,requested_by)
    values(request_id,target_league_id,target_season_id,target_player_id,current_club_id,target_to_club_id,target_to_team_id,'submitted',current_date,safe_effective_on,safe_reason,actor_id);
  perform private.write_league_audit(target_league_id,'league.transfer_submitted','transfer_request',request_id,jsonb_build_object('player_id',target_player_id,'from_club_id',current_club_id,'to_club_id',target_to_club_id,'to_team_id',target_to_team_id));
  return request_id;
end;
$$;

create or replace function public.review_league_transfer_request(target_league_id uuid,target_transfer_id uuid,next_status text,review_notes text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_status text := lower(trim(coalesce(next_status,'')));
  safe_notes text := trim(coalesce(review_notes,''));
  transfer_row public.league_transfer_requests%rowtype;
  effective_date date;
  previous_day date;
begin
  if not public.can_manage_league_registrations(target_league_id) then raise exception 'Registration officer access required' using errcode='42501'; end if;
  if safe_status not in ('under_review','approved','rejected','withdrawn') then raise exception 'Invalid transfer decision' using errcode='22023'; end if;
  if safe_status='rejected' and length(safe_notes)<3 then raise exception 'Decision notes are required' using errcode='22023'; end if;
  select transfer.* into transfer_row from public.league_transfer_requests transfer where transfer.id=target_transfer_id and transfer.league_id=target_league_id for update;
  if transfer_row.id is null then raise exception 'Transfer request not found' using errcode='P0002'; end if;
  effective_date:=coalesce(transfer_row.effective_on,current_date);
  previous_day:=effective_date-1;
  update public.league_transfer_requests transfer set status=case when safe_status='approved' then 'completed' else safe_status end,decision_notes=safe_notes,reviewed_by=actor_id,reviewed_at=now(),updated_at=now()
    where transfer.id=target_transfer_id and transfer.league_id=target_league_id;
  if safe_status='approved' then
    update public.league_player_registrations registration set status='expired',effective_to=least(coalesce(registration.effective_to,previous_day),previous_day),updated_by=actor_id,updated_at=now()
      where registration.league_id=target_league_id and registration.season_id=transfer_row.season_id and registration.player_id=transfer_row.player_id and registration.status='approved' and registration.parent_club_id is distinct from transfer_row.to_club_id;
    insert into public.league_player_registrations(league_id,season_id,player_id,parent_club_id,team_id,registration_type,status,submission_notes,decision_notes,effective_from,effective_to,submitted_by,submitted_at,reviewed_by,reviewed_at,created_by,updated_by)
      values(target_league_id,transfer_row.season_id,transfer_row.player_id,transfer_row.to_club_id,transfer_row.to_team_id,'transfer','approved',transfer_row.reason,safe_notes,effective_date,null,transfer_row.requested_by,transfer_row.created_at,actor_id,now(),actor_id,actor_id)
    on conflict (league_id,season_id,player_id,team_id) do update set parent_club_id=excluded.parent_club_id,registration_type='transfer',status='approved',decision_notes=safe_notes,effective_from=effective_date,effective_to=null,reviewed_by=actor_id,reviewed_at=now(),updated_by=actor_id,updated_at=now();
  end if;
  perform private.write_league_audit(target_league_id,'league.transfer_reviewed','transfer_request',target_transfer_id,jsonb_build_object('status',safe_status,'notes',safe_notes));
end;
$$;

create or replace function public.upsert_league_eligibility_rule(target_league_id uuid,rule_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  rule_id uuid;
  safe_rule_type text := lower(trim(coalesce(rule_data->>'rule_type',rule_data->>'ruleType','other')));
  safe_name text := trim(coalesce(rule_data->>'name','Eligibility rule'));
  safe_severity text := lower(trim(coalesce(rule_data->>'severity','block')));
  safe_competition_type text := lower(trim(coalesce(rule_data->>'competition_type',rule_data->>'competitionType','all')));
  safe_active boolean := coalesce((rule_data->>'active')::boolean,true);
  safe_config jsonb := coalesce(rule_data->'config','{}'::jsonb);
  target_season_id uuid;
  target_division_id uuid;
  target_competition_id uuid;
begin
  if not public.can_manage_league_registrations(target_league_id) then raise exception 'Registration officer access required' using errcode='42501'; end if;
  begin rule_id := nullif(rule_data->>'id','')::uuid; exception when invalid_text_representation then rule_id:=null; end;
  begin target_season_id := coalesce(nullif(rule_data->>'season_id',''),nullif(rule_data->>'seasonId',''))::uuid; exception when invalid_text_representation then target_season_id:=null; end;
  begin target_division_id := coalesce(nullif(rule_data->>'division_id',''),nullif(rule_data->>'divisionId',''))::uuid; exception when invalid_text_representation then target_division_id:=null; end;
  begin target_competition_id := coalesce(nullif(rule_data->>'competition_id',''),nullif(rule_data->>'competitionId',''))::uuid; exception when invalid_text_representation then target_competition_id:=null; end;
  if safe_rule_type not in ('minimum_age','maximum_age','registration_deadline','cup_tied','transfer_clearance','suspension','other') then safe_rule_type:='other'; end if;
  if safe_severity not in ('block','warn') then safe_severity:='block'; end if;
  if safe_competition_type not in ('all','league','cup') then safe_competition_type:='all'; end if;
  if length(safe_name)<2 then raise exception 'Rule name is required' using errcode='22023'; end if;
  if target_season_id is not null and not exists(select 1 from public.league_seasons season where season.id=target_season_id and season.league_id=target_league_id) then raise exception 'Season is outside this league' using errcode='42501'; end if;
  if target_division_id is not null and not exists(select 1 from public.league_divisions division where division.id=target_division_id and division.league_id=target_league_id) then raise exception 'Division is outside this league' using errcode='42501'; end if;
  if rule_id is null then rule_id:=gen_random_uuid(); end if;
  insert into public.league_eligibility_rules(id,league_id,season_id,division_id,competition_type,competition_id,rule_type,name,severity,config,active,created_by,updated_by)
    values(rule_id,target_league_id,target_season_id,target_division_id,safe_competition_type,target_competition_id,safe_rule_type,safe_name,safe_severity,safe_config,safe_active,actor_id,actor_id)
  on conflict (id) do update set season_id=excluded.season_id,division_id=excluded.division_id,competition_type=excluded.competition_type,competition_id=excluded.competition_id,rule_type=excluded.rule_type,name=excluded.name,severity=excluded.severity,config=excluded.config,active=excluded.active,updated_by=actor_id,updated_at=now()
    where public.league_eligibility_rules.league_id=target_league_id;
  perform private.write_league_audit(target_league_id,'league.eligibility_rule_saved','eligibility_rule',rule_id,jsonb_build_object('rule_type',safe_rule_type,'severity',safe_severity,'active',safe_active));
  return rule_id;
end;
$$;

create or replace function public.submit_league_eligibility_dispensation(target_league_id uuid,dispensation_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := private.current_league_role(target_league_id,actor_id);
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  is_staff boolean := public.can_manage_league_registrations(target_league_id);
  dispensation_id uuid := gen_random_uuid();
  target_player_id uuid;
  target_team_id uuid;
  target_season_id uuid;
  safe_rule_type text := lower(trim(coalesce(dispensation_data->>'rule_type',dispensation_data->>'ruleType','other')));
  safe_reason text := trim(coalesce(dispensation_data->>'reason',''));
  safe_starts_on date;
  safe_ends_on date;
begin
  if not is_staff and (club_id is null or actor_role='club_viewer') then raise exception 'Eligibility request access required' using errcode='42501'; end if;
  begin target_player_id := coalesce(nullif(dispensation_data->>'player_id',''),nullif(dispensation_data->>'playerId',''))::uuid; exception when invalid_text_representation then target_player_id:=null; end;
  begin target_team_id := coalesce(nullif(dispensation_data->>'team_id',''),nullif(dispensation_data->>'teamId',''))::uuid; exception when invalid_text_representation then target_team_id:=null; end;
  begin target_season_id := coalesce(nullif(dispensation_data->>'season_id',''),nullif(dispensation_data->>'seasonId',''))::uuid; exception when invalid_text_representation then target_season_id:=null; end;
  begin safe_starts_on := coalesce(nullif(dispensation_data->>'starts_on',''),nullif(dispensation_data->>'startsOn',''))::date; exception when invalid_datetime_format then safe_starts_on:=null; end;
  begin safe_ends_on := coalesce(nullif(dispensation_data->>'ends_on',''),nullif(dispensation_data->>'endsOn',''))::date; exception when invalid_datetime_format then safe_ends_on:=null; end;
  if safe_rule_type not in ('all','minimum_age','maximum_age','registration_deadline','cup_tied','transfer_clearance','suspension','other') then safe_rule_type:='other'; end if;
  if target_player_id is null or target_season_id is null or length(safe_reason)<3 then raise exception 'Player, season and reason are required' using errcode='22023'; end if;
  if not is_staff and not exists(
    select 1 from public.league_player_registrations registration
    where registration.league_id=target_league_id and registration.player_id=target_player_id and registration.parent_club_id=club_id
      and (target_team_id is null or registration.team_id=target_team_id)
  ) then raise exception 'Player is outside this club access' using errcode='42501'; end if;
  insert into public.league_eligibility_dispensations(id,league_id,season_id,player_id,team_id,rule_type,status,starts_on,ends_on,reason,submitted_by)
    values(dispensation_id,target_league_id,target_season_id,target_player_id,target_team_id,safe_rule_type,'submitted',safe_starts_on,safe_ends_on,safe_reason,actor_id);
  perform private.write_league_audit(target_league_id,'league.eligibility_dispensation_submitted','eligibility_dispensation',dispensation_id,jsonb_build_object('player_id',target_player_id,'team_id',target_team_id,'rule_type',safe_rule_type));
  return dispensation_id;
end;
$$;

create or replace function public.review_league_eligibility_dispensation(target_league_id uuid,target_dispensation_id uuid,next_status text,review_notes text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_status text := lower(trim(coalesce(next_status,'')));
  safe_notes text := trim(coalesce(review_notes,''));
begin
  if not public.can_manage_league_registrations(target_league_id) then raise exception 'Registration officer access required' using errcode='42501'; end if;
  if safe_status not in ('under_review','approved','rejected','withdrawn','expired') then raise exception 'Invalid dispensation decision' using errcode='22023'; end if;
  if safe_status='rejected' and length(safe_notes)<3 then raise exception 'Decision notes are required' using errcode='22023'; end if;
  update public.league_eligibility_dispensations dispensation set status=safe_status,decision_notes=safe_notes,reviewed_by=actor_id,reviewed_at=now(),updated_at=now()
    where dispensation.id=target_dispensation_id and dispensation.league_id=target_league_id;
  if not found then raise exception 'Dispensation request not found' using errcode='P0002'; end if;
  perform private.write_league_audit(target_league_id,'league.eligibility_dispensation_reviewed','eligibility_dispensation',target_dispensation_id,jsonb_build_object('status',safe_status,'notes',safe_notes));
end;
$$;

create or replace function public.save_league_team_sheet(target_league_id uuid,team_sheet_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := private.current_league_role(target_league_id,actor_id);
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  is_staff boolean := public.can_manage_league_registrations(target_league_id);
  target_fixture_id uuid;
  target_team_id uuid;
  target_club_id uuid;
  sheet_id uuid;
  fixture_snapshot jsonb;
  home_team_id uuid;
  away_team_id uuid;
  safe_status text := lower(trim(coalesce(team_sheet_data->>'status','submitted')));
  player_item jsonb;
  target_player_id uuid;
  target_registration_id uuid;
  target_squad_role text;
  target_shirt_number integer;
  eligibility jsonb;
  invalid_count integer := 0;
  warning_count integer := 0;
  player_count integer := 0;
  computed_validation_status text;
begin
  if not is_staff and (club_id is null or actor_role='club_viewer') then raise exception 'Team-sheet submission access required' using errcode='42501'; end if;
  begin target_fixture_id := coalesce(nullif(team_sheet_data->>'publication_fixture_id',''),nullif(team_sheet_data->>'publicationFixtureId',''))::uuid; exception when invalid_text_representation then target_fixture_id:=null; end;
  begin target_team_id := coalesce(nullif(team_sheet_data->>'team_id',''),nullif(team_sheet_data->>'teamId',''))::uuid; exception when invalid_text_representation then target_team_id:=null; end;
  if target_fixture_id is null or target_team_id is null then raise exception 'Published fixture and team are required' using errcode='22023'; end if;
  if safe_status not in ('draft','submitted','verified','rejected','withdrawn') then safe_status:='submitted'; end if;
  select team.parent_club_id into target_club_id from public.league_teams team where team.id=target_team_id and team.league_id=target_league_id;
  if target_club_id is null then raise exception 'Team not found' using errcode='P0002'; end if;
  if not is_staff and target_club_id<>club_id then raise exception 'Team is outside this club access' using errcode='42501'; end if;
  fixture_snapshot:=private.league_registration_fixture_snapshot(target_fixture_id);
  if fixture_snapshot is null then raise exception 'Published fixture not found' using errcode='P0002'; end if;
  home_team_id:=private.registration_fixture_team_id(fixture_snapshot,'home');
  away_team_id:=private.registration_fixture_team_id(fixture_snapshot,'away');
  if target_team_id is distinct from home_team_id and target_team_id is distinct from away_team_id then raise exception 'Team is not part of the published fixture' using errcode='42501'; end if;

  insert into public.league_team_sheets(league_id,publication_fixture_id,parent_club_id,team_id,status,validation_status,validation_summary,submitted_by,submitted_at,verified_by,verified_at,created_by,updated_by)
    values(target_league_id,target_fixture_id,target_club_id,target_team_id,safe_status,'not_checked','{}'::jsonb,case when safe_status in ('submitted','verified') then actor_id else null end,case when safe_status in ('submitted','verified') then now() else null end,case when safe_status='verified' then actor_id else null end,case when safe_status='verified' then now() else null end,actor_id,actor_id)
  on conflict (publication_fixture_id,team_id) do update set status=excluded.status,submitted_by=excluded.submitted_by,submitted_at=excluded.submitted_at,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_by=actor_id,updated_at=now()
  returning id into sheet_id;

  delete from public.league_team_sheet_players sheet_player where sheet_player.team_sheet_id=sheet_id;
  for player_item in select value from jsonb_array_elements(coalesce(team_sheet_data->'players','[]'::jsonb)) loop
    begin target_player_id:=coalesce(nullif(player_item->>'player_id',''),nullif(player_item->>'playerId',''))::uuid; exception when invalid_text_representation then target_player_id:=null; end;
    begin target_registration_id:=coalesce(nullif(player_item->>'registration_id',''),nullif(player_item->>'registrationId',''))::uuid; exception when invalid_text_representation then target_registration_id:=null; end;
    target_squad_role:=lower(trim(coalesce(player_item->>'squad_role',player_item->>'squadRole','starter')));
    begin target_shirt_number:=coalesce(nullif(player_item->>'shirt_number',''),nullif(player_item->>'shirtNumber',''))::integer; exception when invalid_text_representation then target_shirt_number:=null; end;
    if target_player_id is null then continue; end if;
    if target_squad_role not in ('starter','substitute','goalkeeper','non_playing') then target_squad_role:='starter'; end if;
    if target_registration_id is null then
      select registration.id into target_registration_id from public.league_player_registrations registration
      where registration.league_id=target_league_id and registration.player_id=target_player_id and registration.team_id=target_team_id and registration.status='approved'
      order by registration.updated_at desc limit 1;
    end if;
    eligibility:=private.evaluate_league_player_eligibility(target_league_id,target_fixture_id,target_team_id,target_player_id,target_registration_id);
    player_count:=player_count+1;
    if eligibility->>'status'='ineligible' then invalid_count:=invalid_count+1; elsif eligibility->>'status'='warning' then warning_count:=warning_count+1; end if;
    insert into public.league_team_sheet_players(league_id,team_sheet_id,player_id,registration_id,squad_role,shirt_number,eligibility_status,eligibility_reasons,created_by)
      values(target_league_id,sheet_id,target_player_id,target_registration_id,target_squad_role,target_shirt_number,eligibility->>'status',coalesce(eligibility->'reasons','[]'::jsonb) || coalesce(eligibility->'warnings','[]'::jsonb),actor_id);
  end loop;

  computed_validation_status:=case when invalid_count>0 then 'failed' when warning_count>0 then 'warning' else 'passed' end;
  update public.league_team_sheets sheet set validation_status=computed_validation_status,validation_summary=jsonb_build_object('player_count',player_count,'invalid_count',invalid_count,'warning_count',warning_count,'checked_at',now()),updated_by=actor_id,updated_at=now()
    where sheet.id=sheet_id;
  perform private.write_league_audit(target_league_id,'league.team_sheet_saved','team_sheet',sheet_id,jsonb_build_object('fixture_id',target_fixture_id,'team_id',target_team_id,'status',safe_status,'player_count',player_count,'invalid_count',invalid_count,'warning_count',warning_count));
  return jsonb_build_object('team_sheet_id',sheet_id,'validation_status',computed_validation_status,'player_count',player_count,'invalid_count',invalid_count,'warning_count',warning_count);
end;
$$;

revoke all on function public.can_view_league_registrations(uuid) from public,anon;
revoke all on function public.can_manage_league_registrations(uuid) from public,anon;
revoke all on function public.get_league_registration_data(uuid) from public,anon;
revoke all on function public.get_league_club_registration_data(uuid) from public,anon;
revoke all on function public.submit_league_player_registration(uuid,jsonb) from public,anon;
revoke all on function public.review_league_player_registration(uuid,uuid,text,text) from public,anon;
revoke all on function public.resubmit_league_player_registration(uuid,uuid,text) from public,anon;
revoke all on function public.add_league_registration_document(uuid,uuid,jsonb) from public,anon;
revoke all on function public.submit_league_transfer_request(uuid,jsonb) from public,anon;
revoke all on function public.review_league_transfer_request(uuid,uuid,text,text) from public,anon;
revoke all on function public.upsert_league_eligibility_rule(uuid,jsonb) from public,anon;
revoke all on function public.submit_league_eligibility_dispensation(uuid,jsonb) from public,anon;
revoke all on function public.review_league_eligibility_dispensation(uuid,uuid,text,text) from public,anon;
revoke all on function public.save_league_team_sheet(uuid,jsonb) from public,anon;

grant execute on function public.can_view_league_registrations(uuid) to authenticated;
grant execute on function public.can_manage_league_registrations(uuid) to authenticated;
grant execute on function public.get_league_registration_data(uuid) to authenticated;
grant execute on function public.get_league_club_registration_data(uuid) to authenticated;
grant execute on function public.submit_league_player_registration(uuid,jsonb) to authenticated;
grant execute on function public.review_league_player_registration(uuid,uuid,text,text) to authenticated;
grant execute on function public.resubmit_league_player_registration(uuid,uuid,text) to authenticated;
grant execute on function public.add_league_registration_document(uuid,uuid,jsonb) to authenticated;
grant execute on function public.submit_league_transfer_request(uuid,jsonb) to authenticated;
grant execute on function public.review_league_transfer_request(uuid,uuid,text,text) to authenticated;
grant execute on function public.upsert_league_eligibility_rule(uuid,jsonb) to authenticated;
grant execute on function public.submit_league_eligibility_dispensation(uuid,jsonb) to authenticated;
grant execute on function public.review_league_eligibility_dispensation(uuid,uuid,text,text) to authenticated;
grant execute on function public.save_league_team_sheet(uuid,jsonb) to authenticated;

commit;
